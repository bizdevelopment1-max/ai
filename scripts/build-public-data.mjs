/**
 * Builds the small, source-backed datasets consumed by the public site.
 *
 * The append-only crawler ledgers remain in the repository for audit and
 * recovery.  They are intentionally not sent to every browser: a record is
 * published only when its publisher page was extracted and the display gate
 * accepted the resulting source evidence.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isExcludedText } from "./news-policy.mjs";
import { normalizeLocalizedRecord } from "./korean-copy.mjs";
import { consolidateMarketRecords } from "./market-consolidation.mjs";
import { loadSuppressionRegistry } from "./suppression-registry.mjs";
import { loadDash } from "./load-dash.mjs";
import { sanitizePublicCopy } from "./public-copy.mjs";
import { buildStrategyView } from "./strategy-view.mjs";

const root = process.cwd();
const readJson = async file => JSON.parse(await readFile(resolve(root, file), "utf8"));
const writeJson = (file, value) => writeFile(resolve(root, file), `${JSON.stringify(sanitizePublicCopy(value))}\n`);
const writePrettyJson = (file, value) => writeFile(resolve(root, file), `${JSON.stringify(sanitizePublicCopy(value), null, 2)}\n`);
// 표시 최종 게이트: 실제 필드값을 재귀 검사해 JSON의 이스케이프 문자와
// 짧은 영문 금지어가 우연히 이어지는 오탐을 방지함
const hasBanned = value => {
  if (typeof value === "string") return isExcludedText(value);
  if (Array.isArray(value)) return value.some(hasBanned);
  if (value && typeof value === "object") return Object.values(value).some(hasBanned);
  return false;
};
const notBanned = item => !hasBanned(item);
// Mobile NPU, DRAM, storage and packaging are first-class MX signals.  The
// previous memory-sector exclusion is intentionally retired; the normal
// publisher, suppression and evidence gates remain in force.
const hasRetiredFocus = () => false;
const notRetiredFocus = item => !hasRetiredFocus(item);
const sourceBacked = item => item?.displayEligible !== false
  && item?.summaryMode === "source-content-extractive"
  && item?.provenance?.status === "source-backed";
const MARKET_SCOPE_PATTERN = /\b(?:ai|artificial intelligence|genai|generative|agentic|chatbot|assistant|smartphone|on-device|edge|npu|gpu|hbm|dram|nand|memory|semiconductor|data center|cloud|app|wearable|robot|autonomous|satellite|commerce|cybersecurity|software|model)\b|인공지능|생성형|에이전트|스마트폰|온디바이스|반도체|메모리|데이터센터|클라우드|앱|웨어러블|로봇|위성|커머스|보안|소프트웨어|모델/i;
const MARKET_OFF_SCOPE_PATTERN = /\b(?:breast cancer|disposable gloves|fresh fruits?|acrylic emulsion|travel retail|dietary supplements?|water treatment chemicals?)\b/i;
const marketInScope = record => {
  const text = [
    record?.title, record?.titleEn, record?.topic, record?.metricLabel, record?.evidence,
    record?.sourceContent?.headline, record?.sourceContent?.text,
  ].filter(Boolean).join(" ");
  return MARKET_SCOPE_PATTERN.test(text) && !MARKET_OFF_SCOPE_PATTERN.test(text);
};
const compact = (item, keys) => Object.fromEntries(keys
  .filter(key => Object.hasOwn(item || {}, key))
  .map(key => [key, item[key]]));

const [news, research, market, infra, bizmodel] = await Promise.all([
  readJson("news.json"), readJson("research.json"), readJson("market.json"),
  readJson("infra.json"), readJson("bizmodel.json"),
]);

// 삭제 블록리스트(비밀번호 삭제 항목) — 뷰에서 영구 제외해 '다음 업데이트 시 안 보이게'.
const suppression = await loadSuppressionRegistry(root);
const notDeleted = scope => item => !suppression.matches(item, scope);

const articleKeys = [
  "id", "date", "co", "cat", "source", "title", "titleEn", "titleKo", "url", "tag",
  "summary", "summaryLinesEn", "summaryLinesKo", "summaryVersion", "summaryMode",
  "summaryEngine", "displayEligible", "provenance", "summaryRoles", "insightSelection",
  "localization", "sourceScope", "sourceRegion", "sourceLanguage", "sourceLocale",
];
const researchKeys = [
  "id", "house", "type", "title", "titleEn", "titleKo", "source", "url", "date", "desc",
  "descEn", "summary", "summaryLinesEn", "summaryLinesKo", "summaryVersion", "summaryMode",
  "summaryEngine", "displayEligible", "provenance", "summaryRoles", "insightSelection",
  "localization", "sourceScope", "sourceRegion", "sourceLanguage", "sourceLocale",
];
const recordKeys = [
  "id", "stableKey", "type", "group", "verticalId", "collectionTrack", "discoveryQueryId", "topic",
  "title", "titleEn", "metricLabel", "values",
  "sourceName", "sourceUrl", "publishedAt", "collectedAt", "evidence", "origin",
  "provenance", "displayEligible", "sourceQuantifiedLines", "sourceQuantities", "sourceMetricValues", "localization",
  "summaryLinesEn", "summaryLinesKo", "consolidatedTitle", "consolidatedInsights",
  "relatedSources", "mergedRecordIds", "mergedRecordCount", "duplicateRecordCount", "consolidation",
];
const signalKeys = ["id", "group", "title", "signal", "quant", "source", "date", "url", "sourceSummaryMode", "provenance"];

const visibleArticles = (news.articles || []).filter(sourceBacked).filter(notBanned).filter(notRetiredFocus).filter(notDeleted("article"))
  .map(item => normalizeLocalizedRecord(compact(item, articleKeys)));
const visibleResearch = (research.feed || []).filter(sourceBacked).filter(notBanned).filter(notRetiredFocus).filter(notDeleted("research"))
  .map(item => normalizeLocalizedRecord(compact(item, researchKeys)));
const visibleRecordSources = (market.records || []).filter(record => sourceBacked(record)
  && Array.isArray(record.sourceQuantifiedLines) && record.sourceQuantifiedLines.length
  && Array.isArray(record.sourceQuantities) && record.sourceQuantities.length)
  .filter(marketInScope).filter(notBanned).filter(notRetiredFocus).filter(notDeleted("market"));
const compactKey = value => String(value || "").toLocaleLowerCase()
  .replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "");
const marketStableKey = record => {
  const track = record.collectionTrack || (record.type === "consumer-survey" ? "consumer-survey" : "ai-market");
  const topic = record.discoveryQueryId
    || record.verticalId
    || compactKey(record.topic || record.consolidatedTitle || record.title || record.id);
  return `${track}:${topic}`;
};
const marketDateValue = record => {
  const direct = Date.parse(String(record.publishedAt || ""));
  if (Number.isFinite(direct)) return direct;
  const shorthand = String(record.publishedAt || "").match(/'?([0-9]{2})(?:\.([0-9]{1,2}))?/);
  if (shorthand) return Date.UTC(2000 + Number(shorthand[1]), Number(shorthand[2] || 1) - 1, 1);
  const collected = Date.parse(String(record.collectedAt || ""));
  return Number.isFinite(collected) ? collected : 0;
};
const consolidatedMarketRecords = consolidateMarketRecords(visibleRecordSources);
const consolidatedDuplicateCount = consolidatedMarketRecords
  .reduce((count, record) => count + Number(record.duplicateRecordCount || 0), 0);
const latestRecordByKey = new Map();
for (const record of consolidatedMarketRecords) {
  const stableKey = marketStableKey(record);
  const current = latestRecordByKey.get(stableKey);
  if (!current || marketDateValue(record) > marketDateValue(current)) {
    latestRecordByKey.set(stableKey, { ...record, stableKey });
  }
}
const replacedRecordCount = Math.max(0, consolidatedMarketRecords.length - latestRecordByKey.size);
const visibleRecords = [...latestRecordByKey.values()]
  .sort((left, right) => marketDateValue(right) - marketDateValue(left))
  .map(item => normalizeLocalizedRecord(compact(item, recordKeys)));
const visibleSignals = (data, scope) => (data.items || [])
  .filter(item => item?.provenance?.status === "evidence-linked" && item?.sourceSummaryMode === "source-content-extractive")
  .filter(notBanned).filter(notRetiredFocus).filter(notDeleted(scope))
  .map(item => normalizeLocalizedRecord(compact(item, signalKeys)));

const generatedAt = new Date().toISOString();
const views = {
  "news-view.json": { generatedAt, count: visibleArticles.length, articles: visibleArticles },
  "research-view.json": { generatedAt, count: visibleResearch.length, feed: visibleResearch },
  "market-view.json": {
    generatedAt,
    engine: market.engine,
    groups: market.groups || [],
    sourceRecordCount: visibleRecordSources.length,
    insightCount: visibleRecords.length,
    consolidatedDuplicateCount,
    replacedRecordCount,
    database: {
      mode: "latest-verified-snapshot",
      replacementPolicy: "collection-track + discovery-topic + newest verified source",
      publicRetention: "current-only",
      rawLedger: "audit-only",
    },
    records: visibleRecords,
  },
  "infra-view.json": { generatedAt, count: visibleSignals(infra, "infra-signal").length, groups: (infra.groups || []).filter(notRetiredFocus), items: visibleSignals(infra, "infra-signal") },
  "bizmodel-view.json": { generatedAt, count: visibleSignals(bizmodel, "bizmodel-signal").length, groups: bizmodel.groups || [], items: visibleSignals(bizmodel, "bizmodel-signal") },
};

await Promise.all(Object.entries(views).map(async ([file, value]) => {
  let previous = null;
  try { previous = await readJson(file); } catch {}
  const withoutTimestamp = input => JSON.stringify({ ...(input || {}), generatedAt: "" });
  if (previous && withoutTimestamp(previous) === withoutTimestamp(value)) {
    value.generatedAt = previous.generatedAt || generatedAt;
  }
  await writeJson(file, value);
}));

// 브라우저가 직접 읽는 보조 자산도 중앙 제외 레지스트리를 동일하게 적용한다.
// 원장 전체를 지우지 않고, 공개 브리핑 항목·최신 투자 근거·품질 통계의 제외 기업 표기만 제거한다.
try {
  const briefing = await readJson("briefing.json");
  briefing.days = (briefing.days || []).map(day => ({
    ...day,
    items: (day.items || []).filter(item => !suppression.matches(item, "briefing") && notRetiredFocus(item)),
  }));
  await writeJson("briefing.json", briefing);
} catch {}

try {
  const investments = await readJson("nvidia-investments.json");
  investments.portfolio = (investments.portfolio || [])
    .filter(item => !suppression.hasCompany(item.name))
    .map(item => ({
      ...item,
      latestEvidence: item.latestEvidence && (suppression.matches(item.latestEvidence, "investment-evidence") || hasRetiredFocus(item.latestEvidence))
        ? null
        : item.latestEvidence,
    }));
  await writeJson("nvidia-investments.json", investments);
} catch {}

const scrubSuppressedLabels = value => {
  if (Array.isArray(value)) return value
    .filter(item => !(typeof item === "string" && suppression.hasCompanyMention(item)))
    .map(scrubSuppressedLabels);
  if (!value || typeof value !== "object") {
    return typeof value === "string" && suppression.hasCompanyMention(value) ? "" : value;
  }
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !suppression.hasCompanyMention(key))
    .map(([key, item]) => [key, scrubSuppressedLabels(item)]));
};
const scrubRetiredDetails = value => {
  if (Array.isArray(value)) return value
    .filter(item => !(typeof item === "string" && hasRetiredFocus(item)))
    .filter(item => !(item && typeof item === "object"
      && (item.url || item.sourceUrl || item.quoteOriginal || item.title)
      && hasRetiredFocus(item)))
    .map(scrubRetiredDetails);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => !(typeof item === "string" && hasRetiredFocus(item)))
    .map(([key, item]) => [key, scrubRetiredDetails(item)]));
};
try {
  const quality = await readJson("quality.json");
  await writePrettyJson("quality.json", scrubSuppressedLabels(quality));
} catch {}

try {
  const companies = scrubRetiredDetails(await readJson("companies.json"));
  companies.companies = Object.fromEntries(Object.entries(companies.companies || {})
    .filter(([name]) => !suppression.hasCompany(name)));
  if (companies.coverage?.companiesTracked != null) {
    companies.coverage.companiesTracked = Object.keys(companies.companies).length;
  }
  await writeJson("companies.json", companies);
} catch {}

try {
  const companyNews = await readJson("company-news.json");
  companyNews.companies = Object.fromEntries(Object.entries(companyNews.companies || {})
    .filter(([name]) => !suppression.hasCompany(name))
    .map(([name, items]) => [name, (items || []).filter(notRetiredFocus)]));
  await writeJson("company-news.json", companyNews);
} catch {}

for (const file of ["business-model-forecasts.json", "mobile-ai-business-view.json", "strategic-ventures.json", "startups.json", "a16z-startups.json", "insights.json"]) {
  try {
    await writeJson(file, scrubRetiredDetails(await readJson(file)));
  } catch {}
}

// The first screen needs only the tracked-company snapshot, recent source
// evidence and topline cards. Build one compact, versioned payload instead of
// making every browser download the complete news and company ledgers.
try {
  const dash = loadDash();
  const registry = dash.COMPANIES || [];
  const trackedNames = registry.map(company => company.name);
  const trackedKeys = new Set(trackedNames.map(name => name.replace(/\s*\(.*\)$/, "").toLowerCase()));
  const companies = await readJson("companies.json");
  const compactEvidence = evidence => (evidence || []).slice(0, 3).map(item => compact(item, [
    "title", "titleEn", "titleKo", "date", "source", "url",
  ]));
  const compactSection = section => section ? {
    summary: section.summary || "",
    groundingStatus: section.groundingStatus || "",
    evidence: compactEvidence(section.evidence),
  } : null;
  const compactIntelligence = intelligence => intelligence ? {
    currentBusiness: compactSection(intelligence.currentBusiness),
    revenueModel: compactSection(intelligence.revenueModel),
    strategyDirection: compactSection(intelligence.strategyDirection),
    investmentDirection: compactSection(intelligence.investmentDirection),
    publication: intelligence.publication || null,
  } : null;
  const overviewCompanies = Object.fromEntries(trackedNames
    .filter(name => companies.companies?.[name])
    .map(name => {
      const company = companies.companies[name];
      return [name, {
        mentions7: company.mentions7 || 0,
        mentions30: company.mentions30 || 0,
        latest: company.latest || null,
        profile: company.profile || null,
        intelligence: compactIntelligence(company.intelligence),
        cap: company.cap || "",
        capAsof: company.capAsof || "",
        ticker: company.ticker || "",
        updatedAt: company.updatedAt || "",
      }];
    }));

  const byNewest = [...visibleArticles]
    .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")));
  const articleIdentity = article => `${article.url || ""}|${article.titleEn || article.title || ""}`;
  const selected = new Map();
  const add = article => selected.set(articleIdentity(article), article);
  byNewest.slice(0, 48).forEach(add);
  for (const name of trackedNames) {
    const key = name.replace(/\s*\(.*\)$/, "").toLowerCase();
    byNewest.filter(article => {
      const articleKey = String(article.co || "").replace(/\s*\(.*\)$/, "").toLowerCase();
      return articleKey === key || (articleKey && trackedKeys.has(articleKey) && (articleKey.includes(key) || key.includes(articleKey)));
    }).slice(0, 2).forEach(add);
  }
  const relationWords = /\b(?:partner|partnership|collaborat|integrat|invest|acquir|supply|license|deal|alliance|compete|versus|vs\.?|rival)\b|파트너|협력|통합|투자|인수|공급|라이선스|계약|경쟁/i;
  byNewest.filter(article => relationWords.test(`${article.titleEn || ""} ${article.title || ""}`))
    .slice(0, 36).forEach(add);
  const overviewArticleKeys = [
    "date", "co", "cat", "source", "title", "titleEn", "titleKo", "url", "tag",
    "summary", "summaryLinesKo", "summaryMode", "displayEligible",
    "provenance", "sourceRegion", "sourceLanguage",
  ];
  const insights = await readJson("insights.json");
  const overview = {
    generatedAt,
    schemaVersion: 1,
    sourceMode: "generated-source-backed",
    companyCount: Object.keys(overviewCompanies).length,
    articleCount: selected.size,
    companies: overviewCompanies,
    articles: [...selected.values()].map(article => compact(article, overviewArticleKeys)),
    insights: {
      engine: insights.engine || "rules",
      cards: (insights.cards || []).filter(card => card.provenance?.status === "evidence-linked"),
    },
  };
  let previous = null;
  try { previous = await readJson("overview-view.json"); } catch {}
  if (previous && JSON.stringify({ ...previous, generatedAt: "" }) === JSON.stringify({ ...overview, generatedAt: "" })) {
    overview.generatedAt = previous.generatedAt || generatedAt;
  }
  await writeJson("overview-view.json", overview);
} catch (error) {
  throw new Error(`Could not build overview-view.json: ${error.message}`);
}

// Strategy copy is a generated materialized view. The browser owns only the
// visual framework; opportunities, proof counts and priorities are
// rebuilt from the newest verified ledgers on every publication run.
try {
  const dash = loadDash();
  const opportunityDb = await readJson("mobile-ai-business-view.json");
  const strategyView = buildStrategyView({
    generatedAt,
    framework: dash.DECISION_FRAMEWORK || {},
    articles: visibleArticles,
    opportunityDb,
  });
  let previous = null;
  try { previous = await readJson("strategy-view.json"); } catch {}
  if (previous && JSON.stringify({ ...previous, generatedAt: "" }) === JSON.stringify({ ...strategyView, generatedAt: "" })) {
    strategyView.generatedAt = previous.generatedAt || generatedAt;
  }
  await writeJson("strategy-view.json", strategyView);
} catch (error) {
  throw new Error(`Could not build strategy-view.json: ${error.message}`);
}

try {
  const dash = loadDash();
  const allowedTickers = new Set((dash.STOCKS || []).map(item => item.ticker));
  const stocks = await readJson("stocks.json");
  stocks.stocks = Object.fromEntries(Object.entries(stocks.stocks || {})
    .filter(([ticker]) => allowedTickers.has(ticker)));
  await writeJson("stocks.json", stocks);
  const stockEvents = await readJson("stock-events.json");
  stockEvents.events = Object.fromEntries(Object.entries(stockEvents.events || {})
    .filter(([ticker]) => allowedTickers.has(ticker))
    .map(([ticker, value]) => [ticker, scrubRetiredDetails(value)]));
  await writeJson("stock-events.json", stockEvents);
} catch {}

const versionInputs = [
  ...Object.values(views).map(value => JSON.stringify(value)),
  createHash("sha256").update(await readFile(resolve(root, "assets/competitive-dynamics.mp4"))).digest("hex"),
  ...await Promise.all(["overview-view.json", "strategy-view.json", "insights.json", "briefing.json", "companies.json", "company-news.json", "startups.json", "a16z-startups.json", "strategic-ventures.json", "business-model-forecasts.json", "mobile-ai-business-view.json", "metric-history.json", "volatile-metrics-audit.json", "market-reverification-queue.json", "price-change-flags.json", "monetization-review-queue.json", "stocks.json", "stock-events.json", "nvidia-investments.json", "monetization.json", "audit.json", "quality.json", "collection-health.json"]
    .map(async file => { try { return await readFile(resolve(root, file), "utf8"); } catch { return ""; } })),
];
const version = createHash("sha256").update(versionInputs.join("\n")).digest("hex").slice(0, 16);
await writeJson("data-version.json", { version, generatedAt, assets: ["overview-view.json", "strategy-view.json", ...Object.keys(views), "company-news.json", "business-model-forecasts.json", "mobile-ai-business-view.json", "metric-history.json", "volatile-metrics-audit.json", "market-reverification-queue.json", "price-change-flags.json", "monetization-review-queue.json"] });

console.log(`[public-data] ${visibleArticles.length} articles · ${visibleResearch.length} research · ${visibleRecords.length} current market insights · ${consolidatedDuplicateCount} duplicate records consolidated · ${replacedRecordCount} prior topic values replaced · version ${version}`);
