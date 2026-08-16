#!/usr/bin/env node
/* ============================================================
   crawl-research.mjs — 증권사(IB)·시장기관 리서치 크롤러
   출력: research.json  { generatedAt, onepager, archive[], feed[] }

   [feed]  기관별 Google News RSS 크롤(기관명 필수 매칭, 14일 창):
           Morgan Stanley·Goldman Sachs·JPMorgan·UBS·BofA·Citi·
           TrendForce·IDC·Gartner·Counterpoint·Canalys — 탭 전용 크롤.
   [onepager] 생성형 합성은 사용하지 않는다. 직접 수집한 기관 피드만
           갱신하고, 기존 합성 1페이지는 reference-only로 분리한다.
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";
import { globalLocales, googleNewsUrl } from "./global-sources.mjs";
import { enrichSourceBatch, isContentBacked } from "./source-content.mjs";
import { CRAWLER_USER_AGENT } from "./crawler-identity.mjs";
import { isExcludedText } from "./news-policy.mjs";
import { loadSuppressionRegistry } from "./suppression-registry.mjs";

const UA = CRAWLER_USER_AGENT;
const TODAY = new Date().toISOString().slice(0, 10);

const HOUSES = [
  { house: "Morgan Stanley", type: "Securities", q: '"Morgan Stanley" AI (smartphone OR mobile OR consumer OR services OR monetization)', locale: "us-en" },
  { house: "Goldman Sachs", type: "Securities", q: '"Goldman Sachs" AI (smartphone OR mobile OR consumer OR services OR monetization)', locale: "us-en" },
  { house: "JPMorgan", type: "Securities", q: '"JPMorgan" OR "J.P. Morgan" AI (research OR forecast OR outlook)', locale: "us-en" },
  { house: "UBS", type: "Securities", q: '"UBS" AI (smartphone OR mobile OR consumer OR services OR outlook)', locale: "eu-en" },
  { house: "Bank of America", type: "Securities", q: '"Bank of America" OR "BofA" AI (research OR forecast)', locale: "us-en" },
  { house: "Citi", type: "Securities", q: '"Citi" OR "Citigroup" AI (research OR forecast OR semiconductor)', locale: "us-en" },
  { house: "TrendForce", type: "Market", q: "TrendForce (AI smartphone OR mobile AI OR edge AI OR consumer device)", locale: "us-en" },
  { house: "IDC", type: "Market", q: '"IDC" (AI OR smartphone OR PC) forecast', locale: "us-en" },
  { house: "Gartner", type: "Market", q: "Gartner (AI OR agentic) forecast", locale: "us-en" },
  { house: "Counterpoint", type: "Market", q: '"Counterpoint Research" (AI OR smartphone)', locale: "us-en" },
  { house: "Canalys", type: "Market", q: "Canalys (AI OR smartphone OR PC)", locale: "eu-en" },
  { house: "OECD", type: "Public policy", q: 'OECD artificial intelligence (survey OR outlook OR adoption)', locale: "eu-en" },
  { house: "ITU", type: "UN agency", q: 'ITU artificial intelligence (statistics OR report OR digital)', locale: "eu-en" },
  { house: "European Commission", type: "Public policy", q: 'European Commission artificial intelligence (survey OR report OR digital)', locale: "eu-fr", match: ["European Commission", "Commission européenne"] },
  { house: "KISDI", type: "Korean research", q: 'KISDI 인공지능 (조사 OR 보고서 OR 이용자)', locale: "kr-ko", match: ["KISDI", "정보통신정책연구원"] },
  { house: "MIC Japan", type: "Japanese public research", q: '総務省 AI 人工知能 調査 報告書', locale: "jp-ja", match: ["総務省", "MIC"] },
  { house: "NASSCOM", type: "Indian industry", q: 'NASSCOM AI (report OR survey OR adoption)', locale: "in-en" },
  { house: "CETIC.br", type: "Brazilian research", q: 'CETIC inteligência artificial pesquisa', locale: "br-pt", match: ["CETIC", "Cetic.br"] },
  { house: "CEPAL", type: "Latin America public research", q: 'CEPAL inteligencia artificial encuesta informe', locale: "latam-es", match: ["CEPAL", "CEPALSTAT"] },
];

const decode = s => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i")); return m ? m[1] : ""; };
const localeById = new Map(globalLocales.map(locale => [locale.id, locale]));

async function pullHouse(h) {
  try {
    const locale = localeById.get(h.locale) || globalLocales[0];
    const url = googleNewsUrl(h.q, locale, 21);
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const xml = await res.text();
    const items = []; const re = /<item>([\s\S]*?)<\/item>/g; let m;
    while ((m = re.exec(xml)) && items.length < 4) {
      const it = m[1];
      const rawTitle = decode(tag(it, "title"));
      // 기관명이 제목·스니펫에 실제로 등장해야 채택(지역 언어 별칭 포함).
      const text = `${rawTitle} ${decode(tag(it, "description"))}`.toLowerCase();
      const aliases = h.match || [h.house.split(" ")[0]];
      if (!aliases.some(alias => text.includes(String(alias).toLowerCase()))) continue;
      const pub = tag(it, "pubDate");
      const d = pub ? new Date(pub) : new Date();
      items.push({
        house: h.house, type: h.type,
        title: rawTitle.replace(/ - [^-]*$/, "").trim(),
        source: decode(tag(it, "source")) || "Google News",
        url: decode(tag(it, "link")),
        date: isNaN(d) ? TODAY : d.toISOString().slice(0, 10),
        desc: decode(tag(it, "description")).slice(0, 220),
        sourceScope: "global-localized-rss",
        sourceRegion: locale.region,
        sourceLanguage: locale.language,
        sourceLocale: locale.id,
      });
    }
    console.log(`[research:${h.house}/${locale.id}] ${items.length} item(s)`);
    return items.slice(0, 2);
  } catch (e) { console.warn(`[research:${h.house}] ${e.message}`); return []; }
}

// ---- Source-only feed: preserve original title and publisher snippet ------
async function koSummarize(items) {
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
  // A synthesized report is intentionally not generated from snippets.
  return null;
}

async function main() {
  const suppression = await loadSuppressionRegistry();
  let articles = [];
  try { articles = JSON.parse(await readFile("news.json", "utf8")).articles || []; } catch {}
  let prev = {};
  try { prev = JSON.parse(await readFile("research.json", "utf8")); } catch {}

  // 1) 기관별 피드 크롤
  const raw = (await Promise.all(HOUSES.map(pullHouse))).flat();
  const reviewedByUrl = new Map((prev.feed || [])
    .filter(item => !suppression.matches(item, "research"))
    .filter(isContentBacked)
    .flatMap(item => [[item.url, item], ...(item.rssUrl ? [[item.rssUrl, item]] : [])]));
  const seen = new Set();
  const freshCandidates = raw
    .filter(item => !suppression.matches(item, "research"))
    .filter(a => a.url && !seen.has(a.url) && seen.add(a.url)).map(item => {
    const reviewed = reviewedByUrl.get(item.url);
    return reviewed || item;
  });
  const newCandidates = freshCandidates.filter(item => !isContentBacked(item));
  const refreshed = await enrichSourceBatch(newCandidates, 4);
  const byRssUrl = new Map(refreshed.map(item => [item.rssUrl || item.url, item]));
  const fresh = freshCandidates.map(item => byRssUrl.get(item.rssUrl || item.url) || item);
  // 이전 피드와 병합(30일 보존), 최신순
  const prevFeed = (prev.feed || [])
    .filter(item => !suppression.matches(item, "research"))
    .filter(a => !seen.has(a.rssUrl || a.url) && seen.add(a.rssUrl || a.url));
  let feed = [...fresh, ...prevFeed]
    .filter(a => !isExcludedText(JSON.stringify(a || {})))   // 금지어(삼성·갤럭시 등) 포함 리서치 제외
    .filter(a => (Date.now() - new Date(a.date).getTime()) / 86400000 < 120)   // 누적 보존 확대
    .sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 150);
  await koSummarize([]);

  // 2) 1페이저: 주 1회(7일 경과) 또는 부재 시 갱신 시도, LLM 실패 시 기존 유지
  let onepager = prev.onepager || null;
  let archive = prev.archive || [];
  const opAge = onepager ? (Date.now() - new Date(onepager.date).getTime()) / 86400000 : 99;
  if (opAge >= 6.5 || !onepager) {
    const op = await llmOnepager(feed, articles);
    if (op) {
      if (onepager) archive = [onepager, ...archive].slice(0, 12);   // 과거 1페이저 누적
      onepager = op;
    }
  }

  // Curated source summaries are explicitly supplied and checked outside the
  // RSS job. Keep them intact when the automated feed refreshes.
  const pinned = prev.pinned || [];
  const out = { generatedAt: new Date().toISOString(), pinned, onepager, archive, feed };
  await writeFile("research.json", JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote research.json — onepager: ${onepager ? onepager.date + "/" + onepager.engine : "none"}, feed ${feed.length} item(s)`);
}

main().catch(e => { console.error(e); process.exit(1); });
