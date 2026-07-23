#!/usr/bin/env node
/* ============================================================
   crawl-bizmodel.mjs — AI 수익화(비즈니스 모델) 시그널 누적 갱신
   입력: news.json(매일 크롤된 최신 기사) — 별도 네트워크 호출 없이
         이미 수집된 기사에서 '돈 버는 방식(과금·수익모델)' 신호만 선별·분류.
   동작: 구독·사용량/API·광고/커머스·하드웨어/번들·성과기반·엔터프라이즈 라이선스
         6개 MECE 수익화 유형으로 분류하고 한글 개조식 시그널 + 정량 수치를 추출해
         bizmodel.json 으로 누적(merge). 하드코딩이 아니라 기사 기반으로 계속 쌓임.
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";

const BANNED = /삼성|samsung|갤럭시|galaxy|\bMX\b/i;
const TODAY = new Date().toISOString().slice(0, 10);

// 6개 MECE 수익화(비즈니스 모델) 유형 — 위에서부터 우선 매칭
const GROUPS = [
  { id: "subscription", ko: "구독·시트", desc: "월정액·좌석당 구독(SaaS) — 반복 매출", accent: "#16A34A",
    re: /구독|subscription|월정액|시트당|좌석당|per-seat|seat|프리미엄 요금|premium tier|pro 요금|유료 전환|paywall|플러스 요금|멤버십/i },
  { id: "usage", ko: "사용량·API·토큰", desc: "종량제·API 호출·토큰당 과금", accent: "#2D6BFF",
    re: /\bAPI\b|토큰당|per-token|사용량 기반|usage-based|종량|pay-as-you-go|크레딧|credit|추론 단가|inference cost|호출당|메터링|metered/i },
  { id: "ads", ko: "광고·커머스·수수료", desc: "광고·거래 수수료·커머스 중개", accent: "#EA580C",
    re: /광고|advertis|\bads\b|커머스|commerce|수수료|commission|중개|affiliate|마켓플레이스|marketplace|거래 수수료|takerate|take rate/i },
  { id: "hardware", ko: "하드웨어·단말·번들", desc: "기기 판매·단말 프리미엄·번들 크레딧", accent: "#C026D3",
    re: /단말|디바이스|device|하드웨어|hardware|번들|bundle|기기 판매|프리미엄 폰|웨어러블|이어버드|글라스|dongle|기기 가격|가격 프리미엄/i },
  { id: "outcome", ko: "성과·아웃컴 기반", desc: "해결 건당·ROI 성과 기반 과금", accent: "#DB2777",
    re: /성과 기반|아웃컴|outcome|해결 건당|per-resolution|성공 보수|success fee|ROI 기반|결과 기반|performance-based/i },
  { id: "enterprise", ko: "엔터프라이즈·라이선스", desc: "온프레미스·라이선스·기업 계약·소버린", accent: "#0D9488",
    re: /엔터프라이즈|enterprise|라이선스|licen[sc]e|온프레미스|on-?prem|기업 계약|소버린|sovereign|연간 계약|annual contract|\bTCV\b|\bACV\b|B2B 계약/i },
];

const QUANT = /(\$[\d,.]+\s?(?:[TBM]|억|조)?(?:\+)?|\d+\.?\d*\s?%|\d+\.?\d*\s?억\+?|\d+\.?\d*\s?조\+?|\d+\s?배|ARR\s?\$?[\d,.]+\s?[TBM억]?|\$?\d+\.?\d*\/(?:월|mo|month|년|year)|[0-9]{2,}\s?M\+?)/i;
// 수익화 맥락 키워드(어느 카테고리든 이게 있어야 '돈 버는 방식' 신호로 채택)
const MONETIZE = /수익|매출|과금|가격|요금|단가|구독|arr|매출화|monetiz|revenue|pricing|가격제|수익모델|수익화|유료|무료화|커머스|수수료|margin|마진/i;

const firstLine = sm => String(sm || "").split("\n").map(l => l.replace(/^[·\-•]\s*/, "").trim()).filter(Boolean)[0] || "";
const classify = (text) => { for (const g of GROUPS) if (g.re.test(text)) return g.id; return null; };
const idOf = (url, title) => "bm_" + Buffer.from(String(url || title || "")).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(-16);

async function main() {
  let news = [];
  try { news = JSON.parse(await readFile("news.json", "utf8")).articles || []; }
  catch { console.log("[bizmodel] news.json 없음 — crawl-news.mjs 먼저 실행"); }

  let prev = { groups: GROUPS.map(({ re, ...g }) => g), items: [] };
  try { const p = JSON.parse(await readFile("bizmodel.json", "utf8")); if (p && Array.isArray(p.items)) prev = p; } catch {}
  const byUrl = new Map(prev.items.map(it => [it.url, it]));

  let added = 0;
  for (const a of news) {
    const hay = `${a.title || ""} ${a.tag || ""} ${a.summary || ""}`;
    if (BANNED.test(hay)) continue;
    if (!MONETIZE.test(hay)) continue;                     // 수익화 맥락이 없으면 skip
    const group = classify(hay);
    if (!group) continue;
    const url = a.url; if (!url) continue;
    const line = firstLine(a.summary) || a.title;
    const signal = line.replace(/[.。]+\s*$/, "").trim();
    if (!signal || BANNED.test(signal)) continue;
    const qm = (a.summary || "").match(QUANT) || (a.title || "").match(QUANT);
    const item = {
      id: idOf(url, a.title), group,
      title: String(a.title || "").replace(/[.。]+\s*$/, "").trim(),
      signal, quant: qm ? qm[0].replace(/\s+/g, "") : "",
      source: a.source || "", date: a.date || TODAY, url,
    };
    if (!byUrl.has(url)) added++;
    byUrl.set(url, { ...byUrl.get(url), ...item });
  }

  const items = [...byUrl.values()]
    .filter(it => it.group && it.signal && it.url && !BANNED.test(JSON.stringify(it)))
    .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0))
    .slice(0, 140);

  const out = { generatedAt: new Date().toISOString(), count: items.length, groups: GROUPS.map(({ re, ...g }) => g), items };
  await writeFile("bizmodel.json", JSON.stringify(out) + "\n");
  const per = GROUPS.map(g => `${g.id}:${items.filter(i => i.group === g.id).length}`).join(" ");
  console.log(`Wrote bizmodel.json — ${items.length} signals (+${added} new) [${per}]`);
}

main().catch(e => { console.error(e); process.exit(0); });
