#!/usr/bin/env node
/* ============================================================
   crawl-companies.mjs — 기업 탭 라이브 데이터 생성기
   입력: news.json + stocks.json  →  출력: companies.json

   기업(뉴스 co 필드 기준)별로:
   - mentions7 / mentions30: 최근 7·30일 언급 기사 수(주목도)
   - latest: 최신 기사 {title, url, date, source}
   - cap / capAsof: 상장사는 stocks.json 실시세 시총 연동
   하드코딩 없음 — 전부 크롤 산출물에서 유도. 매일 실행.
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";

// 기업명 → 상장 티커(시총 연동용 매핑 — 데이터가 아니라 조인 키)
const TICKER_OF = {
  "NVIDIA": "NVDA", "Microsoft": "MSFT", "Amazon": "AMZN", "Apple": "AAPL",
  "Google DeepMind": "GOOGL", "Meta AI": "META", "SpaceX (xAI, Cursor)": "SPCX",
  "SK hynix": "SKHY", "Oracle": "ORCL", "AMD": "AMD", "Broadcom": "AVGO",
  "TSMC": "TSM", "Micron": "MU", "CoreWeave": "CRWV", "Applied Digital": "APLD",
};

const days = d => { const t = new Date(String(d) + "T00:00:00Z").getTime(); return isNaN(t) ? 999 : (Date.now() - t) / 86400000; };

// Core Practices — 기업이 '무엇에 집중하는가'를 크롤 기사에서 규칙 기반으로 분류(뉴스 누적으로 자동 갱신).
const PRACTICE = [
  { id: "model", ko: "모델·연구", re: /\bmodel\b|research|reasoning|추론|벤치마크|benchmark|frontier|foundation|파운데이션|GPT|Claude|Gemini|Llama|Grok|multimodal|멀티모달|학습|training/i },
  { id: "product", ko: "제품·서비스 출시", re: /launch|release|출시|unveil|공개|feature|기능|preview|\bapp\b|앱|product|GA\b|rollout|업데이트|update/i },
  { id: "partner", ko: "파트너십·생태계", re: /partner|협력|integration|통합|생태계|ecosystem|deal|계약|adopt|채택|customer|고객|enterprise|기업 고객/i },
  { id: "infra", ko: "인프라·컴퓨트", re: /data ?center|데이터센터|\bGPU\b|\bchip\b|칩|compute|컴퓨트|cloud|클라우드|capex|infrastructure|인프라|서버|server|electricity|전력/i },
  { id: "capital", ko: "자본·M&A", re: /funding|raise|조달|invest|투자|acqui|인수|valuation|밸류|IPO|상장|revenue|매출|financ|equity|지분/i },
  { id: "safety", ko: "안전·규제", re: /safety|안전|regulat|규제|policy|정책|govern|거버넌스|lawsuit|소송|copyright|저작권|privacy|프라이버시|보안|security/i },
  { id: "talent", ko: "인재·조직", re: /\bhire\b|채용|talent|인재|\bCEO\b|executive|경영진|leadership|리더십|founder|창업|layoff|감원|조직/i },
];
const classifyPractices = (arts) => {
  const recent = arts.filter(a => days(a.date) <= 60);
  const src = recent.length >= 3 ? recent : arts.slice(0, 12);   // 최근 60일 우선, 부족하면 최신 12건
  const buckets = PRACTICE.map(p => {
    const hits = src.filter(a => p.re.test(`${a.title || ""} ${a.descEn || ""} ${a.summary || ""} ${a.tag || ""}`));
    if (!hits.length) return null;
    hits.sort((x, y) => (x.date < y.date ? 1 : -1));
    const l = hits[0];
    return { id: p.id, ko: p.ko, count: hits.length, latest: { title: l.title, url: l.url, date: l.date } };
  }).filter(Boolean).sort((a, b) => b.count - a.count);
  return buckets;
};

async function main() {
  let articles = [], stocks = {}, financials = {};
  try { articles = JSON.parse(await readFile("news.json", "utf8")).articles || []; } catch {}
  try { stocks = JSON.parse(await readFile("stocks.json", "utf8")).stocks || {}; } catch {}
  try { financials = JSON.parse(await readFile("financials.json", "utf8")).financials || {}; } catch {}
  // 기업 개요의 변동 항목을 크롤 값으로 붙임(crawl-financials.mjs — 공시·분기 주기로 자동 최신화)
  const joinFin = (rec, tk) => {
    const f = tk && financials[tk];
    if (!f) return;
    if (f.ceo) rec.ceo = f.ceo;
    if (f.hq) rec.hq = f.hq;
    if (f.sector) rec.sector = f.sector;
    if (f.topHolders) rec.topHolders = f.topHolders;
    if (Array.isArray(f.officers) && f.officers.length) rec.officers = f.officers;
    if (f.revenueQ) { rec.revenueQ = f.revenueQ; rec.quarterEnd = f.quarterEnd || ""; }
    if (f.netIncomeQ) rec.netIncomeQ = f.netIncomeQ;
    if (f.employees) { rec.employees = f.employees; rec.employeesAsof = f.asOf || ""; }
  };

  const byCo = {};
  for (const a of articles) {
    const co = (a.co || "").trim();
    if (!co) continue;
    (byCo[co] = byCo[co] || []).push(a);
  }

  const companies = {};
  for (const [co, arts] of Object.entries(byCo)) {
    arts.sort((x, y) => (x.date < y.date ? 1 : -1));
    const latest = arts[0];
    companies[co] = {
      mentions7: arts.filter(a => days(a.date) <= 7).length,
      mentions30: arts.filter(a => days(a.date) <= 30).length,
      latest: { title: latest.title, url: latest.url, date: latest.date, source: latest.source },
      practices: classifyPractices(arts),
    };
    const tk = TICKER_OF[co];
    if (tk && stocks[tk] && stocks[tk].marketCap) {
      companies[co].cap = stocks[tk].marketCap;
      companies[co].capAsof = stocks[tk].asOf;
      companies[co].ticker = tk;
    }
    joinFin(companies[co], tk);
  }
  // 뉴스 co에 없는 상장사도 시총·실적은 제공(티커 역방향)
  for (const [co, tk] of Object.entries(TICKER_OF)) {
    if (!companies[co] && stocks[tk] && stocks[tk].marketCap) {
      companies[co] = { mentions7: 0, mentions30: 0, latest: null, cap: stocks[tk].marketCap, capAsof: stocks[tk].asOf, ticker: tk };
      joinFin(companies[co], tk);
    }
  }

  const out = { generatedAt: new Date().toISOString(), companies };
  await writeFile("companies.json", JSON.stringify(out) + "\n");
  console.log(`Wrote companies.json — ${Object.keys(companies).length} companies (live mentions + market caps)`);
}

main().catch(e => { console.error(e); process.exit(1); });
