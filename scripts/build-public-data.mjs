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
let deleted = { ids: [], urls: [] };
try { deleted = await readJson("deleted.json"); } catch {}
const canonUrl = u => { const s = String(u || ""); try { const p = new URL(s); p.hash = ""; p.search = ""; return p.href.replace(/\/+$/, ""); } catch { return s.replace(/[?#].*$/, "").replace(/\/+$/, ""); } };
const deletedIds = new Set((deleted.ids || []).map(String));
const deletedUrls = new Set((deleted.urls || []).map(canonUrl));
const notDeleted = item => !deletedIds.has(String(item?.id))
  && !deletedUrls.has(canonUrl(item?.url || item?.sourceUrl));

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
  "id", "type", "group", "verticalId", "title", "titleEn", "metricLabel", "values",
  "sourceName", "sourceUrl", "publishedAt", "collectedAt", "evidence", "origin",
  "provenance", "displayEligible", "sourceQuantifiedLines", "sourceQuantities", "localization",
  "summaryLinesEn", "summaryLinesKo",
];
const signalKeys = ["id", "group", "title", "signal", "quant", "source", "date", "url", "sourceSummaryMode", "provenance"];

const visibleArticles = (news.articles || []).filter(sourceBacked).filter(notBanned).filter(notDeleted)
  .map(item => normalizeLocalizedRecord(compact(item, articleKeys)));
const visibleResearch = (research.feed || []).filter(sourceBacked).filter(notBanned).filter(notDeleted)
  .map(item => normalizeLocalizedRecord(compact(item, researchKeys)));
const visibleRecords = (market.records || []).filter(record => sourceBacked(record)
  && Array.isArray(record.sourceQuantifiedLines) && record.sourceQuantifiedLines.length
  && Array.isArray(record.sourceQuantities) && record.sourceQuantities.length)
  .filter(notBanned).filter(notDeleted)
  .map(item => normalizeLocalizedRecord(compact(item, recordKeys)));
const visibleSignals = data => (data.items || [])
  .filter(item => item?.provenance?.status === "evidence-linked" && item?.sourceSummaryMode === "source-content-extractive")
  .filter(notBanned).filter(notDeleted)
  .map(item => normalizeLocalizedRecord(compact(item, signalKeys)));

const generatedAt = new Date().toISOString();
const views = {
  "news-view.json": { generatedAt, count: visibleArticles.length, articles: visibleArticles },
  "research-view.json": { generatedAt, count: visibleResearch.length, feed: visibleResearch },
  "market-view.json": { generatedAt, engine: market.engine, groups: market.groups || [], records: visibleRecords },
  "infra-view.json": { generatedAt, count: visibleSignals(infra).length, groups: infra.groups || [], items: visibleSignals(infra) },
  "bizmodel-view.json": { generatedAt, count: visibleSignals(bizmodel).length, groups: bizmodel.groups || [], items: visibleSignals(bizmodel) },
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
  ...await Promise.all(["insights.json", "briefing.json", "companies.json", "company-news.json", "startups.json", "a16z-startups.json", "strategic-ventures.json", "stocks.json", "stock-events.json", "nvidia-investments.json", "monetization.json", "audit.json", "quality.json", "collection-health.json"]
    .map(async file => { try { return await readFile(resolve(root, file), "utf8"); } catch { return ""; } })),
];
const version = createHash("sha256").update(versionInputs.join("\n")).digest("hex").slice(0, 16);
await writeJson("data-version.json", { version, generatedAt, assets: [...Object.keys(views), "company-news.json"] });

console.log(`[public-data] ${visibleArticles.length} articles · ${visibleResearch.length} research · ${visibleRecords.length} quantified records · version ${version}`);
