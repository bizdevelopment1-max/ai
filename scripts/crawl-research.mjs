#!/usr/bin/env node
/* ============================================================
   crawl-research.mjs — 증권사(IB)·시장기관 리서치 크롤러
   출력: research.json  { generatedAt, onepager, archive[], feed[] }

   [feed]  기관별 Google News RSS 크롤(기관명 필수 매칭, 14일 창):
           Morgan Stanley·Goldman Sachs·JPMorgan·UBS·BofA·Citi·
           TrendForce·IDC·Gartner·Counterpoint·Canalys — 탭 전용 크롤.
   [onepager] 피드+뉴스 상위 신호를 LLM이 'IB 리서치 브리핑 1페이저'
           (논지→핵심 인사이트→지표→영역별 분석→시사점→결론)로 합성.
           수치는 입력 기사에 있는 것만 사용(생성 금지 지시).
           키 없으면 기존 1페이저 유지(품질 후퇴 방지) + 피드만 갱신.
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";
import { llmJSON } from "./llm.mjs";

const KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = "claude-opus-4-8";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TODAY = new Date().toISOString().slice(0, 10);

const HOUSES = [
  { house: "Morgan Stanley", type: "Securities", q: '"Morgan Stanley" AI (research OR forecast OR estimates OR memory OR semiconductor)' },
  { house: "Goldman Sachs", type: "Securities", q: '"Goldman Sachs" AI (research OR forecast OR capex OR infrastructure)' },
  { house: "JPMorgan", type: "Securities", q: '"JPMorgan" OR "J.P. Morgan" AI (research OR forecast OR outlook)' },
  { house: "UBS", type: "Securities", q: '"UBS" AI (forecast OR memory OR DRAM OR outlook)' },
  { house: "Bank of America", type: "Securities", q: '"Bank of America" OR "BofA" AI (research OR forecast)' },
  { house: "Citi", type: "Securities", q: '"Citi" OR "Citigroup" AI (research OR forecast OR semiconductor)' },
  { house: "TrendForce", type: "Market", q: "TrendForce (AI OR HBM OR DRAM OR CPO OR server)" },
  { house: "IDC", type: "Market", q: '"IDC" (AI OR smartphone OR PC) forecast' },
  { house: "Gartner", type: "Market", q: "Gartner (AI OR agentic) forecast" },
  { house: "Counterpoint", type: "Market", q: '"Counterpoint Research" (AI OR smartphone)' },
  { house: "Canalys", type: "Market", q: "Canalys (AI OR smartphone OR PC)" },
];

const decode = s => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i")); return m ? m[1] : ""; };

async function pullHouse(h) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(h.q + " when:14d")}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const xml = await res.text();
    const items = []; const re = /<item>([\s\S]*?)<\/item>/g; let m;
    while ((m = re.exec(xml)) && items.length < 4) {
      const it = m[1];
      const rawTitle = decode(tag(it, "title"));
      // 기관명이 제목에 실제로 등장해야 채택(노이즈 컷)
      const nameKey = h.house.split(" ")[0].toLowerCase();
      if (!rawTitle.toLowerCase().includes(nameKey)) continue;
      const pub = tag(it, "pubDate");
      const d = pub ? new Date(pub) : new Date();
      items.push({
        house: h.house, type: h.type,
        title: rawTitle.replace(/ - [^-]*$/, "").trim(),
        source: decode(tag(it, "source")) || "Google News",
        url: decode(tag(it, "link")),
        date: isNaN(d) ? TODAY : d.toISOString().slice(0, 10),
        desc: decode(tag(it, "description")).slice(0, 220),
      });
    }
    console.log(`[research:${h.house}] ${items.length} item(s)`);
    return items.slice(0, 2);
  } catch (e) { console.warn(`[research:${h.house}] ${e.message}`); return []; }
}

// ---- 피드 한국어 요약(LLM, 선택) ----------------------------------------
async function koSummarize(items) {
  if (!items.length) return items;
  const list = items.map((a, i) => `[${i}] ${a.house}: ${a.title} — ${a.desc}`).join("\n");
  const r = await llmJSON({
    system: "영문 리서치 뉴스 제목을 한국어로 번역·요약합니다. 개조식 명사형 종결. 기사에 없는 수치 생성 금지. JSON으로 출력.",
    user: `각 항목을 rows 배열의 {idx, ko(한국어 제목 30자 내외), sum(핵심 1줄 요약 — 가능하면 단말 사업 관점 함의 포함)}로 정리:\n${list}`,
    maxTokens: 2000,
    schema: { type: "object", properties: { rows: { type: "array", items: { type: "object", properties: { idx: { type: "integer" }, ko: { type: "string" }, sum: { type: "string" } }, required: ["idx", "ko", "sum"], additionalProperties: false } } }, required: ["rows"], additionalProperties: false },
  });
  if (r) for (const row of r.data.rows || []) if (items[row.idx]) { items[row.idx].titleKo = row.ko; items[row.idx].sum = row.sum; }
  return items;
}

// ---- 1페이저 합성(LLM) ---------------------------------------------------
const OP_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" }, sourceLine: { type: "string" }, scope: { type: "string" },
    thesis: { type: "string" },
    insights: { type: "array", items: { type: "object", properties: { title: { type: "string" }, body: { type: "string" } }, required: ["title", "body"], additionalProperties: false } },
    metrics: { type: "array", items: { type: "object", properties: { k: { type: "string" }, t: { type: "string" } }, required: ["k", "t"], additionalProperties: false } },
    areas: { type: "array", items: { type: "object", properties: { area: { type: "string" }, change: { type: "string" }, winner: { type: "string" } }, required: ["area", "change", "winner"], additionalProperties: false } },
    implications: { type: "array", items: { type: "object", properties: { pill: { type: "string" }, text: { type: "string" } }, required: ["pill", "text"], additionalProperties: false } },
    conclusion: { type: "string" }, watch: { type: "string" },
  },
  required: ["title", "sourceLine", "scope", "thesis", "insights", "metrics", "areas", "implications", "conclusion", "watch"],
  additionalProperties: false,
};

async function llmOnepager(feed, articles) {
  const fl = feed.map(f => `- [${f.house}] (${f.date}) ${f.title} — ${f.desc || ""}`).join("\n");
  const nl = articles.slice(0, 12).map(a => `- (${a.date}) ${a.title}: ${(a.summary || "").split("\n")[0]}`).join("\n");
  const r = await llmJSON({
    system: "당신은 글로벌 스마트폰 제조사 무선사업부(스마트폰·태블릿·웨어러블·XR과 그 위의 서비스) 소속 IB 리서치 브리핑 애널리스트입니다. 모든 인사이트·시사점은 단말 사업(온디바이스 AI·부품 조달·서비스 수익화·경쟁 단말) 관점으로 해석합니다. 특정 기업명(삼성, 갤럭시, MX 등)은 출력에 절대 쓰지 않습니다. 한국어로, 근거 기반으로만 작성합니다. 절대 규칙: 입력에 없는 수치·전망을 만들지 마세요. JSON으로 출력합니다.",
    user: `아래 증권사·시장기관 리서치 뉴스와 산업 뉴스에서 이번 주 가장 중요한 리서치 테마 1개를 골라 'IB 리서치 브리핑 1페이저'를 작성하세요.\n\n[리서치 피드]\n${fl}\n\n[산업 뉴스]\n${nl}\n\n필드: title(브리핑 제목, 2줄 이내) / sourceLine(근거 기관·자료 요약) / scope(커버 영역) / thesis(한 줄 논지) / insights(핵심 인사이트 4~6개, 각 title+body 3~4문장) / metrics(핵심 지표 타일 4개, k=수치·t=설명 — 입력에 있는 수치만) / areas(영역별 분석 4~6행: area·change·winner) / implications(투자·전략 시사점 4~5개: pill(2~6자 태그)+text — 이 중 2개 이상은 단말 사업(온디바이스 AI·부품 조달·서비스 과금) 관점 시사점) / conclusion(최종 결론 2~3문장) / watch(주의·검증 필요 사항 1~2문장)`,
    maxTokens: 3500, schema: OP_SCHEMA,
  });
  if (!r) { console.warn("[research:onepager] LLM unavailable → 기존 1페이저 유지"); return null; }
  const op = r.data;
  if (!op.insights || op.insights.length < 3) { console.warn("[research:onepager] thin → 기존 유지"); return null; }
  return { ...op, date: TODAY, engine: r.engine };
}

async function main() {
  let articles = [];
  try { articles = JSON.parse(await readFile("news.json", "utf8")).articles || []; } catch {}
  let prev = {};
  try { prev = JSON.parse(await readFile("research.json", "utf8")); } catch {}

  // 1) 기관별 피드 크롤
  const raw = (await Promise.all(HOUSES.map(pullHouse))).flat();
  const seen = new Set(); const fresh = raw.filter(a => a.url && !seen.has(a.url) && seen.add(a.url));
  // 이전 피드와 병합(30일 보존), 최신순
  const prevFeed = (prev.feed || []).filter(a => !seen.has(a.url) && seen.add(a.url));
  let feed = [...fresh, ...prevFeed]
    .filter(a => (Date.now() - new Date(a.date).getTime()) / 86400000 < 30)
    .sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 40);
  const needKo = feed.filter(a => !a.titleKo);
  await koSummarize(needKo);

  // 2) 1페이저: 주 1회(7일 경과) 또는 부재 시 갱신 시도, LLM 실패 시 기존 유지
  let onepager = prev.onepager || null;
  let archive = prev.archive || [];
  const opAge = onepager ? (Date.now() - new Date(onepager.date).getTime()) / 86400000 : 99;
  if (opAge >= 6.5 || !onepager) {
    const op = await llmOnepager(feed, articles);
    if (op) {
      if (onepager) archive = [onepager, ...archive].slice(0, 4);
      onepager = op;
    }
  }

  const out = { generatedAt: new Date().toISOString(), onepager, archive, feed };
  await writeFile("research.json", JSON.stringify(out) + "\n");
  console.log(`Wrote research.json — onepager: ${onepager ? onepager.date + "/" + onepager.engine : "none"}, feed ${feed.length} item(s)`);
}

main().catch(e => { console.error(e); process.exit(0); });
