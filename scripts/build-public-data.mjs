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

const root = process.cwd();
const readJson = async file => JSON.parse(await readFile(resolve(root, file), "utf8"));
const writeJson = (file, value) => writeFile(resolve(root, file), `${JSON.stringify(value)}\n`);
// 표시 최종 게이트: 금지어(삼성·samsung·갤럭시·galaxy·MX)가 조금이라도 포함된 레코드는
// 원장에 남아 있어도 절대 공개 뷰(*-view.json)에 내보내지 않음 — 사이트 노출 금지 보장.
const notBanned = item => !isExcludedText(JSON.stringify(item || {}));
const sourceBacked = item => item?.displayEligible !== false
  && item?.summaryMode === "source-content-extractive"
  && item?.provenance?.status === "source-backed";
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

const visibleArticles = (news.articles || []).filter(sourceBacked).filter(notBanned).filter(notDeleted("article"))
  .map(item => normalizeLocalizedRecord(compact(item, articleKeys)));
const visibleResearch = (research.feed || []).filter(sourceBacked).filter(notBanned).filter(notDeleted("research"))
  .map(item => normalizeLocalizedRecord(compact(item, researchKeys)));
const visibleRecordSources = (market.records || []).filter(record => sourceBacked(record)
  && Array.isArray(record.sourceQuantifiedLines) && record.sourceQuantifiedLines.length
  && Array.isArray(record.sourceQuantities) && record.sourceQuantities.length)
  .filter(notBanned).filter(notDeleted("market"));
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
  .filter(notBanned).filter(notDeleted(scope))
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
  "infra-view.json": { generatedAt, count: visibleSignals(infra, "infra-signal").length, groups: infra.groups || [], items: visibleSignals(infra, "infra-signal") },
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

const versionInputs = [
  ...Object.values(views).map(value => JSON.stringify(value)),
  ...await Promise.all(["insights.json", "briefing.json", "companies.json", "company-news.json", "startups.json", "a16z-startups.json", "strategic-ventures.json", "business-model-forecasts.json", "mobile-ai-business-view.json", "stocks.json", "stock-events.json", "nvidia-investments.json", "monetization.json", "audit.json", "quality.json", "collection-health.json"]
    .map(async file => { try { return await readFile(resolve(root, file), "utf8"); } catch { return ""; } })),
];
const version = createHash("sha256").update(versionInputs.join("\n")).digest("hex").slice(0, 16);
await writeJson("data-version.json", { version, generatedAt, assets: [...Object.keys(views), "company-news.json", "business-model-forecasts.json", "mobile-ai-business-view.json"] });

console.log(`[public-data] ${visibleArticles.length} articles · ${visibleResearch.length} research · ${visibleRecords.length} current market insights · ${consolidatedDuplicateCount} duplicate records consolidated · ${replacedRecordCount} prior topic values replaced · version ${version}`);
