#!/usr/bin/env node
/* ============================================================
   crawl-stock-events.mjs — 주가 변곡점 자동 설명(규칙 기반 · 뉴스 크롤 근거)
   목적: 대시보드 상장사의 일별 시세에서 '변곡점(급등·급락일)'을 규칙으로 탐지하고,
         같은 기업의 같은 시점 크롤 뉴스와 매칭해 '왜 올랐/빠졌는지'를 자동 설명.
         LLM 없이 규칙(임계 등락률) + 뉴스 제목 매칭으로만 생성.
   입력: stocks.json(일별 points) + news.json(articles: co·date·title·url·source)
   출력: stock-events.json { generatedAt, thresholdPct, events: { [ticker]: [ {date,dir,label,reason,changePct,url,source,auto} ] } }
   병합: 프런트에서 에디토리얼 이벤트(data.js)와 합쳐 표시(같은 날짜는 에디토리얼 우선).
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";
import { isExcludedText } from "./news-policy.mjs";

// 대시보드 상장사(밸류체인 기업 카드가 있는 업체) 티커 → 뉴스 co 라벨
const TICKER_CO = {
  NVDA: "NVIDIA", MSFT: "Microsoft", AMZN: "Amazon", AAPL: "Apple",
  GOOGL: "Google DeepMind", META: "Meta AI", SPCX: "SpaceX (xAI, Cursor)",
};
const THRESHOLD = 0.04;      // 일간 ±4% 이상 = 변곡점(대형주는 급변동이 드물어 4%로)
const MIN_GAP_DAYS = 4;      // 근접 변곡점은 더 큰 등락만 채택(중복 방지)
const MAX_PER_TICKER = 12;   // 티커당 변곡점 최대 개수
const RECENT_DAYS = 220;     // 뉴스 크롤 커버리지 창 — 이 구간 변곡점만 자동 설명(과거는 에디토리얼 담당)
const MATCH_DAYS = 3;        // 변곡일 ±3일 내 같은 기업 뉴스와 매칭

const decode = s => String(s || "")
  .replace(/&apos;|&#39;/g, "'").replace(/&quot;|&#34;/g, '"').replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();
const daysApart = (a, b) => Math.abs((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);
const daysAgo = d => (Date.now() - Date.parse(d + "T00:00:00Z")) / 86400000;

async function main() {
  let stocks = {}, articles = [];
  try { stocks = JSON.parse(await readFile("stocks.json", "utf8")).stocks || {}; } catch {}
  try { articles = JSON.parse(await readFile("news.json", "utf8")).articles || []; } catch {}

  const byCo = {};
  for (const a of articles) {
    const co = (a.co || "").trim();
    if (!co || !a.date || !a.title) continue;
    if (isExcludedText(`${a.title} ${a.summary || ""}`)) continue;   // 금지어 기사 제외
    (byCo[co] = byCo[co] || []).push(a);
  }

  // 티커별 일간 수익률(날짜→pct) — 변곡일의 '동종사 동반 여부'로 섹터/개별 요인 분석
  const dailyRet = {};
  for (const [ticker] of Object.entries(TICKER_CO)) {
    const s = ((stocks[ticker] && stocks[ticker].points) || []).slice().sort((x, y) => (x.d < y.d ? -1 : 1));
    const m = new Map();
    for (let i = 1; i < s.length; i++) { if (s[i - 1].p && s[i].p) m.set(s[i].d, s[i].p / s[i - 1].p - 1); }
    dailyRet[ticker] = m;
  }
  // 변곡일의 동종사 동반 분석 — 근접일(±1일)까지 허용해 거래일 차이를 흡수
  const peerContext = (selfTicker, date, dir) => {
    const peers = [];
    for (const [t, m] of Object.entries(dailyRet)) {
      if (t === selfTicker) continue;
      let r = m.get(date);
      if (r == null) { for (const [d, v] of m) { if (daysApart(d, date) <= 1) { r = v; break; } } }
      if (r != null) peers.push(r);
    }
    if (peers.length < 3) return null;
    const same = peers.filter(r => (dir === "up" ? r > 0.01 : r < -0.01));
    const avgSame = same.length ? same.reduce((a, b) => a + b, 0) / same.length : 0;
    const avgAll = peers.reduce((a, b) => a + b, 0) / peers.length;
    const pct = n => `${n > 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
    const word = dir === "up" ? "상승" : "하락";
    if (same.length / peers.length >= 0.5) {
      return `섹터 동반 ${word} — 동종 상장사 ${peers.length}곳 중 ${same.length}곳 같은 방향(동종 평균 ${pct(avgSame)}) · 개별 기업 재료 뉴스는 미확보, 시장·섹터 전반 변동으로 추정`;
    }
    return `회사 고유 변동 추정 — 같은 날 동종사 평균 ${pct(avgAll)}로 동반 미미(${same.length}/${peers.length}곳만 동조) · 개별 기업 뉴스는 미확보`;
  };

  const events = {};
  for (const [ticker, co] of Object.entries(TICKER_CO)) {
    const series = (stocks[ticker] && stocks[ticker].points) || [];
    if (series.length < 5) continue;
    const sorted = series.slice().sort((x, y) => (x.d < y.d ? -1 : 1));
    // 변곡점 탐지
    let inflections = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].p, cur = sorted[i].p;
      if (!prev || !cur) continue;
      const pct = cur / prev - 1;
      // 최근(뉴스 커버리지) 구간의 변곡점만 — 뉴스 근거로 자동 설명 가능
      if (Math.abs(pct) >= THRESHOLD && daysAgo(sorted[i].d) <= RECENT_DAYS) inflections.push({ date: sorted[i].d, pct });
    }
    // 최대 등락 우선, 근접 변곡점 병합(가장 큰 등락만)
    inflections.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    const chosen = [];
    for (const inf of inflections) {
      if (chosen.some(c => daysApart(c.date, inf.date) < MIN_GAP_DAYS)) continue;
      chosen.push(inf);
      if (chosen.length >= MAX_PER_TICKER) break;
    }
    // 각 변곡점을 같은 기업·같은 시점 뉴스와 매칭
    const arts = (byCo[co] || []).filter(a => a.url && a.title);
    const rows = chosen.map(inf => {
      const dir = inf.pct > 0 ? "up" : "down";
      const label = `${inf.pct > 0 ? "+" : ""}${(inf.pct * 100).toFixed(1)}%`;
      const near = arts.filter(a => daysApart(a.date, inf.date) <= MATCH_DAYS)
        .sort((x, y) => daysApart(x.date, inf.date) - daysApart(y.date, inf.date));
      const hit = near[0];
      const why = dir === "up" ? "왜 올랐나" : "왜 빠졌나";
      const reason = hit
        ? `${why}: ${decode(hit.title).replace(/\s+-\s+[^-]*$/, "").trim()}`
        : `${why}: ${peerContext(ticker, inf.date, dir) || "개별·섹터 데이터 부족 — 추가 확인 필요"}`;
      return {
        date: inf.date, dir, label, changePct: +(inf.pct * 100).toFixed(1),
        reason, url: hit ? hit.url : "", source: hit ? (hit.source || "") : "", matched: !!hit, auto: true,
      };
    }).filter(r => !isExcludedText(r.reason))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    if (rows.length) events[ticker] = rows;
  }

  const matched = Object.values(events).flat().filter(e => e.matched).length;
  const total = Object.values(events).flat().length;
  const out = { generatedAt: new Date().toISOString(), thresholdPct: THRESHOLD * 100, events };
  await writeFile("stock-events.json", JSON.stringify(out) + "\n");
  console.log(`Wrote stock-events.json — ${Object.keys(events).length} tickers · ${total} inflection points (${matched} news-matched)`);
}

main().catch(e => { console.error(e); process.exit(1); });
