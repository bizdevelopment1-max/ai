/**
 * Builds the small, source-backed datasets consumed by the public site.
 *
 * The append-only crawler ledgers remain in the repository for audit and
 * recovery.  They are intentionally not sent to every browser: a record is
 * published only when its publisher page was extracted and the display gate
 * accepted the resulting source evidence.
 */
import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isExcludedText } from "./news-policy.mjs";
import { normalizeLocalizedRecord } from "./korean-copy.mjs";
import { consolidateMarketRecords } from "./market-consolidation.mjs";
import { loadSuppressionRegistry } from "./suppression-registry.mjs";
import { loadDash } from "./load-dash.mjs";
import { sanitizePublicCopy } from "./public-copy.mjs";
import { buildConsultingNavigation, buildStrategyView } from "./strategy-view.mjs";
import { buildRelationshipLandscape } from "./relationship-landscape.mjs";

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

const [news, research, market, infra] = await Promise.all([
  readJson("news.json"), readJson("research.json"), readJson("market.json"),
  readJson("infra.json"),
]);
const consultingArchitecture = await readJson("config/consulting-architecture.json");

// 삭제 블록리스트(비밀번호 삭제 항목) — 뷰에서 영구 제외해 '다음 업데이트 시 안 보이게'.
const suppression = await loadSuppressionRegistry(root);
const notDeleted = scope => item => !suppression.matches(item, scope);

const articleKeys = [
  "id", "date", "co", "cat", "source", "title", "titleKo", "url", "tag",
  "summaryLinesEn", "summaryMode", "displayEligible", "summaryRoles", "insightSelection",
  "sourceScope", "sourceRegion", "sourceLanguage", "sourceLocale",
];
const researchKeys = [
  "id", "house", "type", "title", "titleKo", "source", "url", "date", "desc",
  "summaryLinesEn", "summaryMode", "displayEligible", "summaryRoles", "insightSelection",
  "sourceScope", "sourceRegion", "sourceLanguage", "sourceLocale",
];
const recordKeys = [
  "id", "stableKey", "isLatestForTopic", "type", "group", "verticalId", "collectionTrack", "discoveryQueryId", "topic",
  "title", "titleEn", "metricLabel", "values",
  "sourceName", "sourceUrl", "publishedAt", "collectedAt", "evidence", "origin",
  "provenance", "displayEligible", "sourceQuantifiedLines", "sourceQuantities", "sourceMetricValues", "localization",
  "summaryLinesEn", "summaryLinesKo", "consolidatedTitle", "consolidatedInsights",
  "relatedSources", "mergedRecordIds", "mergedRecordCount", "duplicateRecordCount", "consolidation",
];
const signalKeys = ["id", "group", "title", "signal", "quant", "source", "date", "url", "sourceSummaryMode", "provenance"];
const marketItemKeys = [
  "id", "group", "name", "def", "size", "forecast", "cagr", "source", "date", "url",
  "extra", "latest", "provenance",
];

const compactLocalizedRecord = (item, keys) => {
  const normalized = normalizeLocalizedRecord(item);
  const localization = normalized.localization || {};
  return {
    ...compact(normalized, keys),
    provenance: {
      status: normalized.provenance?.status || "",
      verificationTier: normalized.provenance?.verificationTier || "",
      checkedAt: normalized.provenance?.checkedAt || "",
    },
    localization: {
      status: localization.status || "",
      displayLanguage: localization.displayLanguage || "",
      title: localization.title || normalized.titleKo || "",
      summaryLines: Array.isArray(localization.summaryLines) ? localization.summaryLines : (normalized.summaryLinesKo || []),
      summaryRoles: Array.isArray(localization.summaryRoles) ? localization.summaryRoles : (normalized.summaryRoles || []),
    },
  };
};
const visibleArticles = (news.articles || []).filter(sourceBacked).filter(notBanned).filter(notRetiredFocus).filter(notDeleted("article"))
  .map(item => compactLocalizedRecord(item, articleKeys));
const visibleResearch = (research.feed || []).filter(sourceBacked).filter(notBanned).filter(notRetiredFocus).filter(notDeleted("research"))
  .map(item => compactLocalizedRecord(item, researchKeys));
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
// The public view mirrors the append-only audit ledger: independent dated
// observations remain visible. Only reports of the same event are merged by
// consolidateMarketRecords(). A topic's newest row is marked for orientation,
// never used to delete its earlier verified history.
const visibleRecords = consolidatedMarketRecords
  .sort((left, right) => marketDateValue(right) - marketDateValue(left))
  .map(item => {
    const stableKey = marketStableKey(item);
    const latest = latestRecordByKey.get(stableKey);
    return normalizeLocalizedRecord(compact({
      ...item,
      stableKey,
      isLatestForTopic: latest?.id === item.id,
    }, recordKeys));
  });
const latestTopicCount = latestRecordByKey.size;
const historicalRecordCount = Math.max(0, visibleRecords.length - latestTopicCount);
const visibleSignals = (data, scope) => (data.items || [])
  .filter(item => item?.provenance?.status === "evidence-linked" && item?.sourceSummaryMode === "source-content-extractive")
  .filter(notBanned).filter(notRetiredFocus).filter(notDeleted(scope))
  .map(item => normalizeLocalizedRecord(compact(item, signalKeys)));
const visibleMarketItems = (market.items || [])
  .filter(item => item?.provenance?.status === "source-linked" && /^https?:\/\//.test(String(item?.url || "")))
  .filter(notBanned).filter(notRetiredFocus).filter(notDeleted("market"))
  .map(item => normalizeLocalizedRecord(compact(item, marketItemKeys)));

const generatedAt = new Date().toISOString();
const newestTimestamp = values => values
  .map(value => Date.parse(String(value || "")))
  .filter(Number.isFinite)
  .sort((left, right) => right - left)
  .map(value => new Date(value).toISOString())[0] || "";
const sectionMetric = (recordCount, sourceTimestamp, maxAgeHours) => {
  const timestamp = Date.parse(String(sourceTimestamp || ""));
  const reference = Date.parse(generatedAt);
  const ageHours = Number.isFinite(timestamp) && Number.isFinite(reference)
    ? Math.max(0, (reference - timestamp) / 3600000)
    : null;
  return {
    recordCount: Number(recordCount || 0),
    currentCount: Number(recordCount || 0),
    sourceTimestamp: sourceTimestamp || "",
    maxAgeHours,
    ageHours: ageHours == null ? null : Number(ageHours.toFixed(2)),
    status: Number(recordCount || 0) === 0 ? "empty" : ageHours != null && ageHours > maxAgeHours ? "stale" : "current",
  };
};
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
    latestTopicCount,
    historicalRecordCount,
    database: {
      mode: "append-only-verified-view",
      replacementPolicy: "exact and semantic duplicate reports consolidated; dated topic records retained",
      publicRetention: "all-verified-history",
      rawLedger: "append-only-audit-ledger",
    },
    records: visibleRecords,
    items: visibleMarketItems,
  },
  "infra-view.json": { generatedAt, count: visibleSignals(infra, "infra-signal").length, groups: (infra.groups || []).filter(notRetiredFocus), items: visibleSignals(infra, "infra-signal") },
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
  const relationshipLandscape = buildRelationshipLandscape({ dash, companyLedger: companies });
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
  const compactProfile = profile => profile ? {
    business: Array.isArray(profile.business) ? profile.business.slice(0, 4) : [],
    officialWebsite: profile.officialWebsite || "",
  } : null;
  const compactLatest = latest => latest ? compact(latest, [
    "title", "titleEn", "titleKo", "date", "source", "url",
  ]) : null;
  const overviewCompanies = Object.fromEntries(trackedNames
    .filter(name => companies.companies?.[name])
    .map(name => {
      const company = companies.companies[name];
      return [name, {
        mentions7: company.mentions7 || 0,
        mentions30: company.mentions30 || 0,
        latest: compactLatest(company.latest),
        profile: compactProfile(company.profile),
        intelligence: compactIntelligence(company.intelligence),
        logo: company.logo || null,
        cap: company.cap || "",
        capAsof: company.capAsof || "",
        ticker: company.ticker || "",
        updatedAt: company.updatedAt || "",
      }];
    }));
  const relationshipCompanies = relationshipLandscape.companies.map(identity => {
    const record = companies.companies?.[identity.name] || {};
    const {
      sourceScore: _sourceScore, registered, group: _group,
      unit: _unit, mobileFit: _mobileFit, ...publicIdentity
    } = identity;
    const snapshot = identity.registered ? {} : {
      mentions30: record.mentions30 || 0,
      latest: compactLatest(record.latest),
      sourceEvidenceCount: new Set([
        record.intelligence?.currentBusiness,
        record.intelligence?.revenueModel,
        record.intelligence?.strategyDirection,
        record.intelligence?.investmentDirection,
      ].flatMap(section => section?.evidence || []).map(item => item?.url).filter(Boolean)).size,
      lastVerifiedAt: record.intelligence?.publication?.lastVerifiedAt || "",
    };
    return { ...publicIdentity, ...snapshot };
  });

  const byNewest = [...visibleArticles]
    .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")));
  const articleIdentity = article => `${article.url || ""}|${article.titleEn || article.title || ""}`;
  const selected = new Map();
  const add = article => selected.set(articleIdentity(article), article);
  // The first screen needs relationship headlines and one recent reference
  // per tracked company, not the complete evidence ledger. Full history is
  // fetched only when the reader opens an evidence-heavy section.
  byNewest.slice(0, 12).forEach(add);
  for (const name of trackedNames) {
    const key = name.replace(/\s*\(.*\)$/, "").toLowerCase();
    byNewest.filter(article => {
      const articleKey = String(article.co || "").replace(/\s*\(.*\)$/, "").toLowerCase();
      return articleKey === key || (articleKey && trackedKeys.has(articleKey) && (articleKey.includes(key) || key.includes(articleKey)));
    }).slice(0, 1).forEach(add);
  }
  const relationWords = /\b(?:partner|partnership|collaborat|integrat|invest|acquir|supply|license|deal|alliance|compete|versus|vs\.?|rival)\b|파트너|협력|통합|투자|인수|공급|라이선스|계약|경쟁/i;
  byNewest.filter(article => relationWords.test(`${article.titleEn || ""} ${article.title || ""}`))
    .slice(0, 48).forEach(add);
  const overviewArticleKeys = [
    "date", "co", "cat", "source", "title", "titleEn", "titleKo", "url", "tag",
    "displayEligible", "provenance", "sourceRegion", "sourceLanguage",
  ];
  const insights = await readJson("insights.json");
  const intelligenceTracks = await readJson("intelligence-tracks.json");
  const sourceSummary = Object.entries([...selected.values()].reduce((counts, article) => {
    const source = String(article.source || "").trim();
    if (source) counts[source] = (counts[source] || 0) + 1;
    return counts;
  }, {})).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8).map(([name, count]) => ({ name, count }));
  const overview = {
    generatedAt,
    schemaVersion: 1,
    sourceMode: "generated-source-backed",
    consultingNavigation: buildConsultingNavigation(consultingArchitecture),
    companyCount: Object.keys(overviewCompanies).length,
    relationshipLandscape: {
      ...relationshipLandscape,
      companies: relationshipCompanies,
    },
    articleCount: selected.size,
    sourceSummary,
    intelligenceTracks: Object.fromEntries(Object.entries(intelligenceTracks.tracks || {}).map(([id, track]) => [id, {
      label: track.label,
      recordCount: track.recordCount,
      sourceBackedCount: track.sourceBackedCount,
      sourceBackedRatio: track.sourceBackedRatio,
      newestPublishedAt: track.newestPublishedAt,
      status: track.status,
    }])),
    companies: overviewCompanies,
    articles: [...selected.values()].map(article => ({
      ...compact(article, overviewArticleKeys.filter(key => key !== "provenance")),
      provenance: { status: article.provenance?.status || "" },
      payloadMode: "relationship-headline",
    })),
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
  const opportunityDb = await readJson("mobile-ai-business-view.json");
  const [companies, startups, monetization, stocks] = await Promise.all([
    readJson("companies.json"),
    readJson("startups.json"),
    readJson("monetization.json"),
    readJson("stocks.json"),
  ]);
  const opportunityCount = (opportunityDb.generatedOpportunities || []).length;
  const startupCount = ["large", "small", "institutional"]
    .reduce((sum, key) => sum + (Array.isArray(startups[key]) ? startups[key].length : 0), 0);
  const newestArticle = newestTimestamp(visibleArticles.map(article => article.date));
  const newestResearch = newestTimestamp(visibleResearch.map(item => item.date));
  const newestMarket = newestTimestamp(visibleRecords.map(item => item.publishedAt || item.collectedAt));
  const sourceStats = {
    overview: sectionMetric(visibleArticles.length, newestArticle, 168),
    strategy: sectionMetric(opportunityCount, opportunityDb.generatedAt || opportunityDb.asOf || generatedAt, 25),
    opportunity: sectionMetric(opportunityCount, opportunityDb.generatedAt || opportunityDb.asOf || generatedAt, 25),
    newbiz: sectionMetric((monetization.companies || []).length,
      newestTimestamp([monetization.generatedAt, monetization.updatedAt]) || generatedAt, 25),
    valuechain: sectionMetric(Object.keys(companies.companies || {}).length,
      companies.generatedAt || companies.updatedAt || generatedAt, 25),
    signals: sectionMetric((views["infra-view.json"].items || []).length,
      infra.generatedAt || infra.updatedAt || generatedAt, 25),
    sanalysis: sectionMetric(startupCount, startups.generatedAt || startups.updatedAt || generatedAt, 169),
    evidence: sectionMetric(visibleArticles.length + visibleResearch.length,
      newestTimestamp([newestArticle, newestResearch]), 168),
    validation: sectionMetric(visibleRecords.length + Object.keys(stocks.stocks || {}).length,
      newestTimestamp([newestMarket, stocks.generatedAt, stocks.updatedAt]) || generatedAt, 49),
  };
  const strategyView = buildStrategyView({
    generatedAt,
    architecture: consultingArchitecture,
    sourceStats,
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

// Build one browser-facing content inventory from the declarative registry.
// Components can therefore rely only on generated views, while operators can
// see missing, empty and stale sections before approving publication.
const contentRegistry = await readJson("config/site-content-registry.json");
const consultingSectionIndex = new Map((consultingArchitecture.workstreams || []).flatMap(workstream =>
  (workstream.sections || []).map(section => [section.id, {
    workstreamId: workstream.id,
    workstreamLabel: workstream.label,
    question: section.question,
    output: section.output,
  }])));
const valueAtPath = (value, path) => String(path || "").split(".").filter(Boolean)
  .reduce((current, key) => current == null ? undefined : current[key], value);
const contentDatasets = [];
for (const definition of contentRegistry.datasets || []) {
  try {
    const [payload, fileStat, raw] = await Promise.all([
      readJson(definition.path),
      stat(resolve(root, definition.path)),
      readFile(resolve(root, definition.path)),
    ]);
    const records = valueAtPath(payload, definition.recordPath);
    const recordCount = definition.countMode === "object"
      ? Object.keys(records || {}).length
      : Array.isArray(records) ? records.length : records == null ? 0 : 1;
    const sourceTimestamp = payload.generatedAt || payload.updatedAt || payload.lastUpdated || fileStat.mtime.toISOString();
    const timestamp = Date.parse(sourceTimestamp);
    const ageHours = Number.isFinite(timestamp) ? Math.max(0, (Date.now() - timestamp) / 3600000) : null;
    const status = recordCount === 0
      ? "empty"
      : ageHours != null && ageHours > Number(definition.maxAgeHours || 24) ? "stale" : "current";
    contentDatasets.push({
      id: definition.id,
      path: definition.path,
      section: definition.section,
      publication: definition.publication || "public",
      consumer: definition.consumer || null,
      ...consultingSectionIndex.get(definition.section),
      collector: definition.collector,
      required: definition.required !== false,
      recordCount,
      sourceTimestamp,
      maxAgeHours: definition.maxAgeHours,
      ageHours: ageHours == null ? null : Number(ageHours.toFixed(2)),
      status,
      checksum: createHash("sha256").update(raw).digest("hex").slice(0, 16),
    });
  } catch {
    contentDatasets.push({
      id: definition.id,
      path: definition.path,
      section: definition.section,
      publication: definition.publication || "public",
      consumer: definition.consumer || null,
      ...consultingSectionIndex.get(definition.section),
      collector: definition.collector,
      required: definition.required !== false,
      recordCount: 0,
      sourceTimestamp: null,
      maxAgeHours: definition.maxAgeHours,
      ageHours: null,
      status: "missing",
      checksum: null,
    });
  }
}
const activeContentDatasets = contentDatasets.filter(dataset => dataset.publication !== "retired");
const contentSummary = activeContentDatasets.reduce((summary, dataset) => {
  summary[dataset.status] = (summary[dataset.status] || 0) + 1;
  return summary;
}, { current: 0, stale: 0, empty: 0, missing: 0 });
contentSummary.public = activeContentDatasets.filter(dataset => dataset.publication === "public").length;
contentSummary.supporting = activeContentDatasets.filter(dataset => dataset.publication === "supporting").length;
contentSummary.retired = contentDatasets.filter(dataset => dataset.publication === "retired").length;
const workstreamSummary = (consultingArchitecture.workstreams || []).map(workstream => {
  const sectionIds = new Set((workstream.sections || []).map(section => section.id));
  const datasets = activeContentDatasets.filter(dataset => sectionIds.has(dataset.section));
  const recordCount = datasets.reduce((sum, dataset) => sum + Number(dataset.recordCount || 0), 0);
  const currentDatasets = datasets.filter(dataset => dataset.status === "current").length;
  return {
    id: workstream.id,
    order: workstream.order,
    label: workstream.label,
    question: workstream.question,
    output: workstream.output,
    gate: workstream.gate,
    datasetCount: datasets.length,
    currentDatasets,
    recordCount,
    status: recordCount === 0 ? "empty" : currentDatasets === datasets.length ? "current" : "review",
  };
});
const siteContentManifest = {
  schemaVersion: 3,
  generatedAt,
  refreshCadenceHours: contentRegistry.refreshCadenceHours,
  publicationPolicy: contentRegistry.publicationPolicy,
  summary: contentSummary,
  consultingArchitecture: {
    schemaVersion: consultingArchitecture.schemaVersion,
    methodology: consultingArchitecture.methodology,
    statement: consultingArchitecture.statement,
    workstreams: workstreamSummary,
  },
  datasets: contentDatasets,
};
await writeJson("site-content-manifest.json", siteContentManifest);

const versionInputs = [
  ...Object.values(views).map(value => JSON.stringify(value)),
  JSON.stringify(siteContentManifest),
  createHash("sha256").update(await readFile(resolve(root, "assets/competitive-dynamics.mp4"))).digest("hex"),
  ...await Promise.all(["overview-view.json", "strategy-view.json", "site-content-manifest.json", "intelligence-tracks.json", "insights.json", "briefing.json", "companies.json", "company-news.json", "startups.json", "a16z-startups.json", "strategic-ventures.json", "business-model-forecasts.json", "mobile-ai-business-view.json", "metric-history.json", "volatile-metrics-audit.json", "market-reverification-queue.json", "price-change-flags.json", "monetization-review-queue.json", "stocks.json", "stock-events.json", "nvidia-investments.json", "monetization.json", "audit.json", "quality.json", "collection-health.json"]
    .map(async file => { try { return await readFile(resolve(root, file), "utf8"); } catch { return ""; } })),
];
const version = createHash("sha256").update(versionInputs.join("\n")).digest("hex").slice(0, 16);
await writeJson("data-version.json", {
  version,
  generatedAt,
  contentStatus: contentSummary,
  assets: ["site-content-manifest.json", ...new Set((contentRegistry.datasets || [])
    .filter(dataset => dataset.publication !== "retired")
    .map(dataset => dataset.path)), "metric-history.json", "volatile-metrics-audit.json", "market-reverification-queue.json", "price-change-flags.json", "monetization-review-queue.json"],
});

console.log(`[public-data] ${visibleArticles.length} articles · ${visibleResearch.length} research · ${visibleRecords.length} cumulative market insights · ${historicalRecordCount} historical topic rows retained · ${consolidatedDuplicateCount} duplicate reports consolidated · version ${version}`);
