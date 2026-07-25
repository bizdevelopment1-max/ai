#!/usr/bin/env node
/**
 * Evidence gate for every automated dashboard refresh.
 *
 * This script never invents replacement content. It annotates generated
 * records with provenance, preserves a cumulative evidence ledger, and exits
 * non-zero when the publishable bundle is critically incomplete.
 */
import { readFile, writeFile } from "node:fs/promises";

const DAY = 86_400_000;
const now = new Date();
const today = now.toISOString().slice(0, 10);

const readJson = async (file, fallback = null) => {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch { return fallback; }
};

const canonicalUrl = raw => {
  try {
    const url = new URL(raw);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach(k => url.searchParams.delete(k));
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch { return ""; }
};

const ageDays = iso => {
  const ms = Date.parse(iso || "");
  return Number.isFinite(ms) ? Math.max(0, (Date.now() - ms) / DAY) : 999;
};

const numericTokens = text => [...String(text || "").matchAll(/(?<![\p{L}\d])(?:\$|₩)?\d[\d,.]*(?:%|억|조|만|배|B|M|T)?/gu)]
  .map(m => m[0].replace(/[,.]/g, "").toLowerCase())
  .filter(v => v.length > 1 && !/^20\d{2}$/.test(v));

const unsupportedNumbers = (claim, evidence) => {
  const allowed = new Set(numericTokens(evidence));
  return [...new Set(numericTokens(claim).filter(v => !allowed.has(v)))];
};

const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) && date <= today;
const validHttp = url => /^https?:\/\//.test(String(url || ""));

const news = await readJson("news.json", { articles: [] });
const stocks = await readJson("stocks.json", { stocks: {} });
const briefing = await readJson("briefing.json", { days: [] });
const insights = await readJson("insights.json", { cards: [] });
const radar = await readJson("radar.json", { picks: [] });
const research = await readJson("research.json", { feed: [] });
const startups = await readJson("startups.json", { large: [], small: [] });
const market = await readJson("market.json", { items: [] });
const infra = await readJson("infra.json", { items: [] });
const bizmodel = await readJson("bizmodel.json", { items: [] });
const priorHistory = await readJson("history.json", { articles: [], runs: [] });
const collectionHealth = await readJson("collection-health.json", { status: "unknown", failedStreams: [], emptyStreams: [] });

const articleIssues = [];
const currentArticles = [];
const seen = new Set();

for (const input of news.articles || []) {
  const url = canonicalUrl(input.url);
  if (!url || seen.has(url)) continue;
  seen.add(url);
  const evidenceText = [input.titleEn, input.descEn].filter(Boolean).join(" — ").trim();
  const issues = [];
  if (!validHttp(url)) issues.push("invalid-url");
  if (!validDate(input.date)) issues.push("invalid-or-future-date");
  if (!String(input.source || "").trim()) issues.push("missing-source");
  if (!String(input.title || "").trim()) issues.push("missing-title");
  if (!String(input.summary || "").trim()) issues.push("missing-summary");
  if (evidenceText.length < 35) issues.push("insufficient-source-snippet");
  if (input.summaryMode !== "source-excerpt") issues.push("summary-not-source-excerpt");
  if (input.summaryMode === "source-excerpt" && !String(evidenceText).includes(String(input.summary || ""))) issues.push("source-excerpt-mismatch");
  const extraNumbers = unsupportedNumbers(input.summary, evidenceText);
  if (extraNumbers.length) issues.push("numbers-not-in-source-snippet");

  const verificationStatus = issues.length === 0 ? "source-backed" : "limited";
  const item = {
    ...input,
    url,
    provenance: {
      status: verificationStatus,
      evidenceType: input.descEn ? "publisher-or-rss-snippet" : "headline-only",
      summaryMode: input.summaryMode || "legacy-or-unknown",
      verificationTier: input.summaryMode === "source-excerpt" ? "publisher-snippet-exact" : "limited",
      checkedAt: now.toISOString(),
      issues,
      unsupportedNumbers: extraNumbers,
    },
  };
  currentArticles.push(item);
  if (issues.length) articleIssues.push({ url, title: input.title, issues });
}

const historyByUrl = new Map();
for (const item of [...(priorHistory.articles || []), ...currentArticles]) {
  const key = canonicalUrl(item.url);
  if (key) historyByUrl.set(key, { ...item, url: key });
}
const historyArticles = [...historyByUrl.values()]
  .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
  .slice(0, 5000);

const evidenceUrls = new Set(historyArticles.map(a => canonicalUrl(a.url)).filter(Boolean));
const verifyEvidenceList = evidence => {
  const rows = (evidence || []).filter(e => validHttp(e.url));
  const matched = rows.filter(e => evidenceUrls.has(canonicalUrl(e.url)));
  return {
    status: matched.length ? "evidence-linked" : "reference-only",
    evidenceCount: matched.length,
    checkedAt: now.toISOString(),
  };
};

const directSourceStatus = item => {
  const url = canonicalUrl(item?.url || item?.latest?.url);
  if (url && evidenceUrls.has(url)) return { status: "evidence-linked", evidenceCount: 1, checkedAt: now.toISOString() };
  if (url && validHttp(url)) return { status: "source-linked", evidenceCount: 1, checkedAt: now.toISOString() };
  return { status: "reference-only", evidenceCount: 0, checkedAt: now.toISOString() };
};
const derivedSourceStatus = item => item?.sourceSummaryMode === "source-excerpt"
  ? directSourceStatus(item)
  : { status: "reference-only", evidenceCount: 0, checkedAt: now.toISOString() };

for (const day of briefing.days || []) {
  day.items = (day.items || []).map(item => ({ ...item, provenance: verifyEvidenceList(item.evidence) }));
}
insights.cards = (insights.cards || []).map(card => ({ ...card, provenance: verifyEvidenceList(card.evidence) }));
radar.picks = (radar.picks || []).map(pick => ({ ...pick, provenance: verifyEvidenceList(pick.evidence) }));
research.feed = (research.feed || []).map(item => ({ ...item, provenance: directSourceStatus(item) }));
if (research.onepager) research.onepager = { ...research.onepager, provenance: { status: "reference-only", evidenceCount: 0, checkedAt: now.toISOString(), issues: ["generated-or-legacy-synthesis-not-publishable"] } };
startups.large = (startups.large || []).map(item => ({ ...item, provenance: { status: "reference-only", evidenceCount: 0, checkedAt: now.toISOString() } }));
startups.small = (startups.small || []).map(item => ({ ...item, provenance: { status: "reference-only", evidenceCount: 0, checkedAt: now.toISOString() } }));
market.items = (market.items || []).map(item => ({ ...item, provenance: directSourceStatus(item) }));
market.records = (market.records || []).map(record => ({
  ...record,
  sourceUrl: canonicalUrl(record.sourceUrl),
  provenance: directSourceStatus({ url: record.sourceUrl }),
}));
infra.items = (infra.items || []).map(item => ({ ...item, provenance: derivedSourceStatus(item) }));
bizmodel.items = (bizmodel.items || []).map(item => ({ ...item, provenance: derivedSourceStatus(item) }));

const stockRows = Object.values(stocks.stocks || {});
const stockFresh = stockRows.filter(s => ageDays(`${s.asOf}T23:59:59Z`) <= 4).length;
const sourceCounts = {};
for (const s of stockRows) sourceCounts[s.source || "unknown"] = (sourceCounts[s.source || "unknown"] || 0) + 1;
const sourceCountsNews = {};
for (const a of currentArticles) sourceCountsNews[a.source || "unknown"] = (sourceCountsNews[a.source || "unknown"] || 0) + 1;

const linkedBriefs = (briefing.days?.[0]?.items || []).filter(x => x.provenance?.status === "evidence-linked").length;
const linkedInsights = (insights.cards || []).filter(x => x.provenance?.status === "evidence-linked").length;
const backedArticles = currentArticles.filter(a => a.provenance.status === "source-backed").length;
const sourceExcerptArticles = currentArticles.filter(a => a.summaryMode === "source-excerpt").length;
const limitedRate = currentArticles.length ? articleIssues.length / currentArticles.length : 1;
const linkedInfra = (infra.items || []).filter(item => item.provenance?.status === "evidence-linked").length;
const linkedBizmodel = (bizmodel.items || []).filter(item => item.provenance?.status === "evidence-linked").length;
const linkedResearch = (research.feed || []).filter(item => item.provenance?.status !== "reference-only").length;
const linkedMarket = (market.items || []).filter(item => item.provenance?.status !== "reference-only").length;
const linkedMarketRecords = (market.records || []).filter(record => record.provenance?.status !== "reference-only").length;
const consumerSurveyRecords = (market.records || []).filter(record => record.type === "consumer-survey" && record.provenance?.status !== "reference-only").length;

const checks = [
  { id: "news-coverage", label: "뉴스 수집", status: currentArticles.length >= 20 ? "ok" : "fail", value: `${currentArticles.length}건` },
  { id: "source-backed", label: "원문 스니펫 근거", status: backedArticles >= Math.max(10, currentArticles.length * 0.35) ? "ok" : "warn", value: `${backedArticles}/${currentArticles.length}건` },
  { id: "source-excerpt-mode", label: "생성 없는 원문 발췌", status: sourceExcerptArticles >= Math.max(10, currentArticles.length * 0.8) ? "ok" : "warn", value: `${sourceExcerptArticles}/${currentArticles.length}건` },
  { id: "collection-health", label: "수집 스트림 상태", status: collectionHealth.status === "ok" ? "ok" : collectionHealth.status === "partial" ? "warn" : "fail", value: `실패 ${(collectionHealth.failedStreams || []).length} · 빈 스트림 ${(collectionHealth.emptyStreams || []).length}` },
  { id: "briefing-evidence", label: "브리핑 근거 연결", status: linkedBriefs > 0 ? "ok" : "fail", value: `${linkedBriefs}건` },
  { id: "insight-evidence", label: "인사이트 근거 연결", status: linkedInsights > 0 ? "ok" : "warn", value: `${linkedInsights}건` },
  { id: "stock-freshness", label: "주가 최신성", status: stockFresh >= Math.max(8, stockRows.length * 0.7) ? "ok" : "fail", value: `${stockFresh}/${stockRows.length}종목` },
  { id: "news-freshness", label: "뉴스 번들 최신성", status: ageDays(news.generatedAt) <= 2 ? "ok" : "fail", value: `${ageDays(news.generatedAt).toFixed(1)}일` },
  { id: "infra-evidence", label: "인프라 시그널 근거", status: linkedInfra >= Math.max(3, (infra.items || []).length * 0.5) ? "ok" : "warn", value: `${linkedInfra}/${(infra.items || []).length}건` },
  { id: "bizmodel-evidence", label: "수익화 시그널 근거", status: linkedBizmodel >= Math.max(3, (bizmodel.items || []).length * 0.5) ? "ok" : "warn", value: `${linkedBizmodel}/${(bizmodel.items || []).length}건` },
  { id: "research-source", label: "리서치 원문 링크", status: linkedResearch >= Math.max(3, (research.feed || []).length * 0.5) ? "ok" : "warn", value: `${linkedResearch}/${(research.feed || []).length}건` },
  { id: "market-source", label: "시장 데이터 원문 링크", status: linkedMarket >= Math.max(10, (market.items || []).length * 0.8) ? "ok" : "warn", value: `${linkedMarket}/${(market.items || []).length}건` },
  { id: "market-db-source", label: "신사업 정량 DB 원문 링크", status: linkedMarketRecords >= Math.max(3, (market.records || []).length * 0.95) ? "ok" : "warn", value: `${linkedMarketRecords}/${(market.records || []).length}건` },
  { id: "consumer-survey-coverage", label: "소비자 조사 레코드", status: consumerSurveyRecords >= 2 ? "ok" : "warn", value: `${consumerSurveyRecords}건` },
];

const fails = checks.filter(c => c.status === "fail").length;
const warns = checks.filter(c => c.status === "warn").length;
const overall = fails ? "fail" : warns ? "warn" : "ok";
const quality = {
  generatedAt: now.toISOString(),
  overall,
  policy: "뉴스는 원문 제목·RSS 스니펫에서 정제한 발췌만 표시하며, 생성형 요약·번역 API를 사용하지 않습니다. 규칙 기반 해석은 원문 사실과 분리해 표시합니다.",
  summary: `검증 ${checks.length}개 · 정상 ${checks.length - fails - warns} · 주의 ${warns} · 실패 ${fails}`,
  checks,
  metrics: {
    currentArticles: currentArticles.length,
    accumulatedArticles: historyArticles.length,
    sourceBackedArticles: backedArticles,
    sourceExcerptArticles,
    limitedArticles: articleIssues.length,
    limitedRate,
    freshStocks: stockFresh,
    totalStocks: stockRows.length,
    linkedInfra,
    linkedBizmodel,
    linkedResearch,
    linkedMarket,
    linkedMarketRecords,
    consumerSurveyRecords,
  },
  sources: { news: sourceCountsNews, stocks: sourceCounts },
  collection: collectionHealth,
  notices: [
    "뉴스 카드는 공개 제목·RSS 스니펫을 정제한 원문 발췌이며, 자동 생성 요약이 아닙니다.",
    `검증 제한 기사 비율: ${(limitedRate * 100).toFixed(1)}% (${articleIssues.length}/${currentArticles.length})`,
    "투자·인수·매출 추정치는 의사결정 전 원문과 공시를 다시 확인해야 합니다.",
    "근거 없는 레이더 후보는 reference-only로 분리됩니다.",
    "원문이 연결되지 않은 스타트업 투자·인수 후보와 리서치 1페이지는 화면에서 제외됩니다.",
  ],
};

const runs = [...(priorHistory.runs || []), {
  generatedAt: now.toISOString(),
  newsGeneratedAt: news.generatedAt || null,
  stocksGeneratedAt: stocks.generatedAt || null,
  articles: currentArticles.length,
  sourceBacked: backedArticles,
  sourceExcerpt: sourceExcerptArticles,
  limited: articleIssues.length,
  freshStocks: stockFresh,
  status: overall,
}].slice(-365);

news.articles = currentArticles;
news.count = currentArticles.length;
news.quality = { sourceBacked: backedArticles, sourceExcerpt: sourceExcerptArticles, limited: articleIssues.length, limitedRate };

const llmHealth = {
  generatedAt: now.toISOString(),
  mode: "not-used",
  summaryEngine: "source-excerpt",
  externalModelApiCalls: 0,
  policy: "No generative model/API is used in the data collection and news summary path. Rule-based analysis is separately labelled as unverified interpretation.",
  articleSummaryModes: { sourceExcerpt: sourceExcerptArticles, legacyOrLimited: currentArticles.length - sourceExcerptArticles },
};

await Promise.all([
  writeFile("news.json", JSON.stringify(news, null, 2) + "\n"),
  writeFile("briefing.json", JSON.stringify(briefing) + "\n"),
  writeFile("insights.json", JSON.stringify(insights) + "\n"),
  writeFile("radar.json", JSON.stringify(radar) + "\n"),
  writeFile("research.json", JSON.stringify(research) + "\n"),
  writeFile("startups.json", JSON.stringify(startups) + "\n"),
  writeFile("market.json", JSON.stringify(market) + "\n"),
  writeFile("infra.json", JSON.stringify(infra) + "\n"),
  writeFile("bizmodel.json", JSON.stringify(bizmodel) + "\n"),
  writeFile("history.json", JSON.stringify({ generatedAt: now.toISOString(), articles: historyArticles, runs }, null, 2) + "\n"),
  writeFile("quality.json", JSON.stringify(quality, null, 2) + "\n"),
  writeFile("llm-health.json", JSON.stringify(llmHealth, null, 2) + "\n"),
]);

console.log(`[verify] ${quality.summary}`);
console.log(`[verify] 누적 기사 ${historyArticles.length}건 · 원문 스니펫 근거 ${backedArticles}건 · 최신 주가 ${stockFresh}/${stockRows.length}`);
if (fails) {
  console.error("[verify] Critical evidence checks failed. Refusing to publish this refresh.");
  process.exit(1);
}
