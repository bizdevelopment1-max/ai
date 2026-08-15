#!/usr/bin/env node
/**
 * Evidence gate for every automated dashboard refresh.
 *
 * This script never invents replacement content. It annotates generated
 * records with provenance, preserves a cumulative evidence ledger, and exits
 * non-zero when the publishable bundle is critically incomplete.
 */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isExcludedText } from "./news-policy.mjs";

const DAY = 86_400_000;
const now = new Date();
const today = now.toISOString().slice(0, 10);

const readJson = async (file, fallback = null) => {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch { return fallback; }
};

const sourceTitleFor = input => String(input?.titleEn || input?.sourceContent?.headline || input?.title || "");
const sourceExcerptFor = input => {
  const lines = Array.isArray(input?.summaryLinesEn) ? input.summaryLinesEn.filter(Boolean) : [];
  return lines.length ? lines.join("\n") : String(input?.descEn || input?.desc || input?.summary || "");
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
const companies = await readJson("companies.json", { companies: {} });
const market = await readJson("market.json", { items: [] });
const infra = await readJson("infra.json", { items: [] });
const bizmodel = await readJson("bizmodel.json", { items: [] });
const priorHistory = await readJson("history.json", { articles: [], runs: [] });
const collectionHealth = await readJson("collection-health.json", { status: "unknown", failedStreams: [], emptyStreams: [] });
const volatileMetricConfig = await readJson("config/volatile-metrics.json", { metrics: [] });
const volatileMetricHistory = await readJson("metric-history.json", { verificationRuns: [] });
const volatileMetricAudit = await readJson("volatile-metrics-audit.json", { rows: [] });
const qualityThresholds = await readJson("config/quality-thresholds.json", {});
const monetization = await readJson("monetization.json", { companies: [] });
const monetizationReviewQueue = await readJson("monetization-review-queue.json", { total: 0, rows: [] });
const opportunityView = await readJson("mobile-ai-business-view.json", { generatedOpportunities: [], experimentShortlist: [] });

const articleIssues = [];
const currentArticles = [];
const seen = new Set();
let duplicateArticles = 0;

for (const input of news.articles || []) {
  const url = canonicalUrl(input.url);
  if (!url) continue;
  if (seen.has(url)) { duplicateArticles += 1; continue; }
  seen.add(url);
  const evidenceText = [sourceTitleFor(input), sourceExcerptFor(input), input?.sourceContent?.text].filter(Boolean).join("\n").trim();
  const issues = [];
  if (!validHttp(url)) issues.push("invalid-url");
  if (!validDate(input.date)) issues.push("invalid-or-future-date");
  if (!String(input.source || "").trim()) issues.push("missing-source");
  if (!String(input.title || "").trim()) issues.push("missing-title");
  if (!String(input.summary || "").trim()) issues.push("missing-summary");
  if (evidenceText.length < 35) issues.push("insufficient-source-snippet");
  if (input.summaryMode !== "source-content-extractive") issues.push("summary-not-source-content-extractive");
  if (input.displayEligible !== false && input.sourceContent?.status !== "content-extracted") issues.push("source-content-unavailable");
  if (input.summaryMode === "source-content-extractive" && !String(evidenceText).includes(String(input.summary || ""))) issues.push("source-content-mismatch");
  const extraNumbers = unsupportedNumbers(input.summary, evidenceText);
  if (extraNumbers.length) issues.push("numbers-not-in-source-snippet");

  const verificationStatus = issues.length === 0 ? "source-backed" : "limited";
  const localization = validLocalization(input, sourceTitleFor(input), sourceExcerptFor(input));
  const item = {
    ...input,
    url,
    ...(localization ? { localization } : {}),
    provenance: {
      status: verificationStatus,
      evidenceType: input.sourceContent?.status === "content-extracted" ? "publisher-page-text" : "retained-without-source-page",
      summaryMode: input.summaryMode || "legacy-or-unknown",
      verificationTier: input.summaryMode === "source-content-extractive" ? "publisher-page-extractive" : "limited",
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

const sourceBackedUrls = new Set(historyArticles
  .filter(item => item?.provenance?.status === "source-backed")
  .map(item => canonicalUrl(item.url)).filter(Boolean));
const verifyEvidenceList = evidence => {
  const rows = (evidence || []).filter(e => validHttp(e.url));
  const matched = rows.filter(e => sourceBackedUrls.has(canonicalUrl(e.url)));
  return {
    status: matched.length ? "evidence-linked" : "reference-only",
    evidenceCount: matched.length,
    checkedAt: now.toISOString(),
  };
};

const directSourceStatus = item => {
  const url = canonicalUrl(item?.url || item?.latest?.url);
  const content = item?.sourceContent || {};
  const sourceText = cleanLocalizationText(`${content.headline || item?.title || ""}\n${content.text || ""}`);
  const summaryLines = Array.isArray(item?.summaryLinesEn) ? item.summaryLinesEn.filter(Boolean) : [];
  const hasOwnPublisherEvidence = validHttp(url)
    && content.status === "content-extracted"
    && item?.summaryMode === "source-content-extractive"
    && item?.displayEligible !== false
    && sourceText.length >= 120
    && summaryLines.length === 3
    && summaryLines.every(line => sourceText.includes(cleanLocalizationText(line)));
  if (hasOwnPublisherEvidence) return {
    status: "source-backed",
    evidenceCount: summaryLines.length,
    evidenceType: "publisher-page-text",
    checkedAt: now.toISOString(),
    sourceContentHash: content.contentHash || "",
  };
  if (url && sourceBackedUrls.has(url)) return { status: "evidence-linked", evidenceCount: 1, checkedAt: now.toISOString() };
  if (url && validHttp(url)) return { status: "source-linked", evidenceCount: 1, checkedAt: now.toISOString() };
  return { status: "reference-only", evidenceCount: 0, checkedAt: now.toISOString() };
};

// Korean is a display-only translation of source snippets. Any stale,
// malformed, or untraceable translation is replaced by the original language.
function cleanLocalizationText(value) {
  return String(value || "")
    .replace(/&#(\d+);?/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);?/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&zwnj;/gi, "\u200c").replace(/&zwj;/gi, "\u200d")
    .replace(/&mdash;/gi, "—").replace(/&ndash;/gi, "–").replace(/&apos;/gi, "'")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
// Verification may need to repair a stale localization after a source excerpt
// changes. Keep that English fallback in the same compact bullet style as the
// normal localization job, without modifying the source-bound evidence lines.
function compactFallbackText(value) {
  return cleanLocalizationText(value)
    .replace(/\b(\d{4})\.(\d{1,2})\.(\d{1,2})\b/g, "$1-$2-$3")
    .replace(/(?<=[A-Za-z])\.(?=[A-Za-z])/g, "·")
    .replace(/([^0-9])\.(?=\s+)/g, "$1 ·")
    .replace(/([^0-9])\.(?=["”’']?\s*$)/g, "$1")
    .replace(/[。!?]+$/g, "").trim();
}
function localizationHash(title, excerpt) {
  return createHash("sha256").update(`${cleanLocalizationText(title)}\n${cleanLocalizationText(excerpt)}`).digest("hex");
}
function fallbackLines(title, excerpt, source, date) {
  return cleanLocalizationText(excerpt).split(/\n+/).map(compactFallbackText).filter(Boolean).slice(0, 3);
}
function validLocalization(input, title, excerpt) {
  const loc = input?.localization;
  if (!loc) return null;
  const sourceLines = Array.isArray(loc.sourceLines) ? loc.sourceLines.map(cleanLocalizationText) : [];
  const evidence = cleanLocalizationText(`${title} ${excerpt}`);
  const sourceBound = sourceLines.length >= 1 && sourceLines.length <= 3 && sourceLines.every(line => line && evidence.includes(line));
  const hashMatches = loc.sourceHash === localizationHash(title, excerpt);
  const korean = text => /[가-힣]/.test(String(text || ""));
  const accepted = loc.status === "accepted" && loc.displayLanguage === "ko" && korean(loc.title)
    && Array.isArray(loc.summaryLines) && loc.summaryLines.length >= 1 && loc.summaryLines.length <= 3 && loc.summaryLines.every(korean);
  const fallback = loc.status === "fallback-english" && loc.displayLanguage === "en"
    && typeof loc.title === "string" && Array.isArray(loc.summaryLines) && loc.summaryLines.length >= 1 && loc.summaryLines.length <= 3;
  if ((accepted || fallback) && sourceBound && hashMatches) return { ...loc, sourceLines };
  const lines = sourceLines.length >= 1 ? sourceLines.slice(0, 3) : fallbackLines(title, excerpt, input?.source, input?.date);
  const evidenceLines = sourceLines.length >= 1 ? sourceLines.slice(0, 3) : fallbackLines(title, excerpt, input?.source, input?.date);
  return {
    version: 13,
    status: "fallback-english",
    displayLanguage: "en",
    title: compactFallbackText(title),
    summaryLines: evidenceLines.map(compactFallbackText),
    summaryRoles: Array.isArray(input?.summaryRoles) ? input.summaryRoles.slice(0, evidenceLines.length) : [],
    sourceLines: evidenceLines,
    sourceHash: localizationHash(title, excerpt),
    checkedAt: now.toISOString(),
    method: "verification-fallback",
    issues: ["localization-verification-failed"],
  };
}
const derivedSourceStatus = item => item?.sourceSummaryMode === "source-content-extractive"
  ? directSourceStatus(item)
  : { status: "reference-only", evidenceCount: 0, checkedAt: now.toISOString() };

const startupSourceStatus = item => {
  const latestUrl = canonicalUrl(item?.latest?.url || item?.url);
  const history = (item?.history || []).filter(entry => validHttp(entry?.url));
  if (latestUrl && validHttp(latestUrl)) {
    return {
      status: "source-linked",
      evidenceCount: 1,
      evidenceType: item?.latest?.sourceContent?.status === "content-extracted" ? "publisher-page-latest" : "publisher-link-latest",
      historyCount: history.length,
      checkedAt: now.toISOString(),
    };
  }
  if (history.length) {
    return { status: "source-linked", evidenceCount: history.length, evidenceType: "historical-publisher-links", historyCount: history.length, checkedAt: now.toISOString() };
  }
  return { status: "reference-only", evidenceCount: 0, checkedAt: now.toISOString() };
};

// A URL alone is not evidence for the market database.  In particular, Google
// News RSS descriptions are discovery metadata rather than publisher facts.
// Keep every row in the append-only ledger, but make it source-backed only
// when the resolved publisher page, exact source text, and literal quantities
// are all present and internally traceable.
const marketSourceStatus = record => {
  const content = record?.sourceContent || {};
  const url = canonicalUrl(content.canonicalUrl || record?.sourceUrl);
  const googleNews = (() => { try { return /(^|\.)news\.google\.com$/i.test(new URL(url).hostname); } catch { return false; } })();
  const sourceText = cleanLocalizationText(`${content.headline || record?.title || ""}\n${content.text || ""}`);
  const summaryLines = Array.isArray(record?.summaryLinesEn) ? record.summaryLinesEn.filter(Boolean) : [];
  const quantifiedLines = Array.isArray(record?.sourceQuantifiedLines) ? record.sourceQuantifiedLines : [];
  const quantities = Array.isArray(record?.sourceQuantities) ? record.sourceQuantities.filter(Boolean) : [];
  const exactLines = quantifiedLines.length > 0 && quantifiedLines.every(item => item?.line && sourceText.includes(cleanLocalizationText(item.line))
    && Array.isArray(item.values) && item.values.every(value => String(item.line).includes(value)));
  const exactQuantities = quantities.length > 0 && quantities.every(value => quantifiedLines.some(item => (item.values || []).includes(value)));
  const valid = validHttp(url)
    && !googleNews
    && content.status === "content-extracted"
    && record?.summaryMode === "source-content-extractive"
    && record?.displayEligible === true
    && sourceText.length >= 120
    && summaryLines.length === 3
    && summaryLines.every(line => sourceText.includes(cleanLocalizationText(line)))
    && exactLines
    && exactQuantities;
  return valid
    ? { status: "source-backed", evidenceCount: quantifiedLines.length, evidenceType: "publisher-page-text-with-quantities", checkedAt: now.toISOString(), sourceContentHash: content.contentHash || "" }
    : { status: "reference-only", evidenceCount: 0, evidenceType: "publisher-page-not-verified", checkedAt: now.toISOString(), issues: [googleNews ? "unresolved-google-news-url" : "source-page-extraction-required"] };
};

for (const day of briefing.days || []) {
  day.items = (day.items || []).map(item => ({ ...item, provenance: verifyEvidenceList(item.evidence) }));
}
insights.cards = (insights.cards || []).map(card => ({ ...card, provenance: verifyEvidenceList(card.evidence) }));
radar.picks = (radar.picks || []).map(pick => ({ ...pick, provenance: verifyEvidenceList(pick.evidence) }));
research.feed = (research.feed || []).map(item => {
  const localization = validLocalization(item, sourceTitleFor(item), sourceExcerptFor(item));
  // A research row is a Korean three-point brief by contract. Preserve an
  // unverified/English record in JSON, but do not expose it until the next
  // translation retry can satisfy that contract.
  const researchVisible = localization?.status === "accepted"
    && localization?.displayLanguage === "ko"
    && Array.isArray(localization?.summaryLines) && localization.summaryLines.length === 3;
  return { ...item, ...(localization ? { localization } : {}), ...(researchVisible ? {} : { displayEligible: false }), provenance: directSourceStatus(item) };
});
if (research.onepager) research.onepager = { ...research.onepager, provenance: { status: "reference-only", evidenceCount: 0, checkedAt: now.toISOString(), issues: ["generated-or-legacy-synthesis-not-publishable"] } };
research.pinned = (research.pinned || []).map(brief => {
  const valid = brief?.provenance?.status === "user-provided-source"
    && typeof brief.sourceLine === "string" && brief.sourceLine.length > 8
    && Array.isArray(brief.summaryLines) && brief.summaryLines.length === 3
    && brief.summaryLines.every(line => typeof line === "string" && line.trim().length >= 20)
    && Array.isArray(brief.sourcePages) && brief.sourcePages.length > 0;
  return valid
    ? { ...brief, provenance: { ...brief.provenance, checkedAt: now.toISOString() } }
    : { ...brief, provenance: { status: "reference-only", evidenceCount: 0, checkedAt: now.toISOString(), issues: ["invalid-curated-source-summary"] } };
});
startups.large = (startups.large || []).map(item => ({ ...item, provenance: startupSourceStatus(item) }));
startups.small = (startups.small || []).map(item => ({ ...item, provenance: startupSourceStatus(item) }));
market.items = (market.items || []).map(item => ({ ...item, provenance: directSourceStatus(item) }));
market.records = (market.records || []).map(record => {
  const excluded = isExcludedText(`${record.title || ""} ${record.evidence || ""} ${record.sourceName || ""}`);
  const verifiedUrl = canonicalUrl(record.sourceContent?.canonicalUrl || record.sourceUrl);
  const sourceStatus = marketSourceStatus({ ...record, sourceUrl: verifiedUrl });
  return {
    ...record,
    sourceUrl: verifiedUrl,
    displayEligible: !excluded && sourceStatus.status === "source-backed",
    provenance: excluded
      ? { status: "reference-only", evidenceCount: 0, checkedAt: now.toISOString(), issues: ["configured-display-exclusion"] }
      : sourceStatus,
  };
});
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
const sourceExcerptArticles = currentArticles.filter(a => a.summaryMode === "source-content-extractive" && a.displayEligible !== false).length;
const localizedArticles = currentArticles.filter(a => a.localization?.status === "accepted").length;
const localizedFallbackArticles = currentArticles.filter(a => a.localization?.status === "fallback-english").length;
const limitedRate = currentArticles.length ? articleIssues.length / currentArticles.length : 1;
const linkedInfra = (infra.items || []).filter(item => item.provenance?.status === "evidence-linked").length;
const linkedBizmodel = (bizmodel.items || []).filter(item => item.provenance?.status === "evidence-linked").length;
const linkedResearch = (research.feed || []).filter(item => item.provenance?.status === "source-backed").length;
const localizedResearch = (research.feed || []).filter(item => item.localization?.status === "accepted").length;
const localizedFallbackResearch = (research.feed || []).filter(item => item.localization?.status === "fallback-english").length;
const archivedMarketBaselines = (market.items || []).length;
const linkedMarketRecords = (market.records || []).filter(record => record.provenance?.status === "source-backed").length;
const marketDirectEvidenceRate = (market.records || []).length ? linkedMarketRecords / market.records.length : 0;
const marketDirectEvidenceTarget = Number(qualityThresholds.directMarketEvidenceRate || 0.9);
const consumerSurveyRecords = (market.records || []).filter(record => record.type === "consumer-survey" && record.provenance?.status === "source-backed").length;
const eligibleArticles = currentArticles.filter(article => article.displayEligible !== false).length;
const sourceContentRate = eligibleArticles ? sourceExcerptArticles / eligibleArticles : 0;
const duplicateRate = (currentArticles.length + duplicateArticles) ? duplicateArticles / (currentArticles.length + duplicateArticles) : 0;
const criticalEmptyStreams = (collectionHealth.watchdogBreaches || []).length;
const publishedMonetizationRows = (monetization.companies || []).flatMap(company => company.monetize || []);
const ungatedMonetizationRows = publishedMonetizationRows.filter(row => row.classificationGate?.status !== "passed");
const generatedOpportunities = opportunityView.generatedOpportunities || [];
const experimentShortlist = opportunityView.experimentShortlist || [];
const invalidPublishedOpportunities = generatedOpportunities.filter(item => item.status === "published" && (
  item.evidenceCount < 2 || item.independentSources < (qualityThresholds.minimumIndependentSourcesForDecision || 2)
));

// Unverified quantitative rows become an explicit work queue. Numeric and
// pricing records receive the highest priority because they are the most
// likely to affect an MX business decision when stale or weakly sourced.
const marketReverificationQueue = (market.records || [])
  .filter(record => record.provenance?.status !== "source-backed")
  .map(record => {
    const text = `${record.title || ""} ${record.topic || ""} ${record.summary || ""}`;
    const hasNumbers = numericTokens(text).length > 0 || (record.values || record.sourceMetricValues || []).length > 0;
    const priceSensitive = /price|pricing|subscription|fee|cost|asp|arr|revenue|valuation|funding|가격|요금|구독|매출|밸류/i.test(text);
    const staleDays = ageDays(record.publishedAt || record.collectedAt);
    const priorityScore = (priceSensitive ? 40 : 0) + (hasNumbers ? 30 : 0)
      + (!validHttp(record.sourceUrl) ? 20 : 0) + Math.min(10, Math.floor(staleDays / 30));
    return {
      id: record.id || createHash("sha256").update(`${record.sourceUrl || ""}|${record.title || ""}`).digest("hex").slice(0, 16),
      title: record.titleEn || record.title || record.topic || "Untitled quantitative record",
      sourceUrl: record.sourceUrl || record.url || "",
      publishedAt: record.publishedAt || null,
      collectedAt: record.collectedAt || null,
      priority: priorityScore >= 70 ? "P0" : priorityScore >= 40 ? "P1" : "P2",
      priorityScore,
      reasons: [
        priceSensitive ? "volatile-price-or-financial-metric" : null,
        hasNumbers ? "quantitative-claim" : null,
        !validHttp(record.sourceUrl) ? "publisher-page-unresolved" : null,
        staleDays > 90 ? "older-than-90-days" : null,
      ].filter(Boolean),
      nextAction: validHttp(record.sourceUrl) ? "re-extract-publisher-page" : "resolve-publisher-url-from-discovery-ledger",
    };
  })
  .sort((left, right) => right.priorityScore - left.priorityScore || String(right.publishedAt || "").localeCompare(String(left.publishedAt || "")));

const metricFingerprint = values => JSON.stringify((values || []).map(value => ({
  plan: value.plan,
  value: value.value,
  rangeHigh: value.rangeHigh,
  unit: value.unit,
  billingPeriod: value.billingPeriod,
})));
const priceKinds = new Set(["subscription-price", "device-price"]);
const priceChangeRows = (volatileMetricConfig.metrics || []).filter(metric => priceKinds.has(metric.kind)).map(metric => {
  const runs = (volatileMetricHistory.verificationRuns || []).filter(run => run.metricId === metric.id);
  const previous = runs.at(-1) || null;
  const audit = (volatileMetricAudit.rows || []).find(row => row.id === metric.id) || null;
  const changed = !!previous && metricFingerprint(previous.values) !== metricFingerprint(metric.values);
  const sourceVerified = audit?.status === "verified";
  return {
    metricId: metric.id,
    label: metric.label,
    kind: metric.kind,
    region: metric.region,
    previousCheckedAt: previous?.checkedAt || null,
    previousValues: previous?.values || [],
    currentValues: metric.values || [],
    changed,
    status: !previous ? "baseline-required" : changed && !sourceVerified ? "change-pending-verification" : changed ? "verified-change" : "unchanged",
    sourceVerificationStatus: audit?.status || "not-run",
    detectedAt: now.toISOString(),
  };
});
const pendingPriceChanges = priceChangeRows.filter(row => row.status === "change-pending-verification");
const verifiedPriceChanges = priceChangeRows.filter(row => row.status === "verified-change");
const priceChangeFlags = {
  generatedAt: now.toISOString(),
  policy: "Compare price fields with the last verified snapshot; do not publish a changed price until its configured evidence literals are verified.",
  summary: {
    tracked: priceChangeRows.length,
    changed: priceChangeRows.filter(row => row.changed).length,
    pendingVerification: pendingPriceChanges.length,
    verifiedChanges: verifiedPriceChanges.length,
  },
  rows: priceChangeRows,
};

const checks = [
  { id: "news-coverage", label: "뉴스 수집", status: currentArticles.length >= 20 ? "ok" : "fail", value: `${currentArticles.length}건` },
  { id: "source-backed", label: "원문 스니펫 근거", status: backedArticles >= Math.max(10, currentArticles.length * 0.35) ? "ok" : "warn", value: `${backedArticles}/${currentArticles.length}건` },
  { id: "source-content-mode", label: "원문 본문 추출", status: sourceContentRate >= Number(qualityThresholds.sourceContentExtractionRate || 0.97) ? "ok" : "warn", value: `${sourceExcerptArticles}/${eligibleArticles}건 · ${(sourceContentRate * 100).toFixed(1)}% / 목표 ${((qualityThresholds.sourceContentExtractionRate || 0.97) * 100).toFixed(0)}%` },
  { id: "feed-localization", label: "기사 한국어 표시·영문 폴백", status: localizedArticles + localizedFallbackArticles >= Math.max(10, currentArticles.length * 0.95) ? "ok" : "warn", value: `한국어 ${localizedArticles} · 영문 폴백 ${localizedFallbackArticles}` },
  { id: "collection-health", label: "수집 스트림 상태", status: (collectionHealth.failedStreams || []).length ? "fail" : criticalEmptyStreams > Number(qualityThresholds.maximumCriticalEmptyStreams ?? 0) || (collectionHealth.emptyStreams || []).length ? "warn" : "ok", value: `실패 ${(collectionHealth.failedStreams || []).length} · 빈 스트림 ${(collectionHealth.emptyStreams || []).length} · 지속 실패 ${criticalEmptyStreams}` },
  { id: "briefing-evidence", label: "브리핑 근거 연결", status: linkedBriefs > 0 ? "ok" : "fail", value: `${linkedBriefs}건` },
  { id: "insight-evidence", label: "인사이트 근거 연결", status: linkedInsights > 0 ? "ok" : "warn", value: `${linkedInsights}건` },
  { id: "stock-freshness", label: "주가 최신성", status: stockFresh >= Math.max(8, stockRows.length * 0.7) ? "ok" : "fail", value: `${stockFresh}/${stockRows.length}종목` },
  { id: "news-freshness", label: "뉴스 번들 최신성", status: ageDays(news.generatedAt) <= 2 ? "ok" : "fail", value: `${ageDays(news.generatedAt).toFixed(1)}일` },
  { id: "infra-evidence", label: "인프라 시그널 근거", status: linkedInfra >= 3 ? "ok" : "warn", value: `공개 ${linkedInfra}건 · 보존 ${(infra.items || []).length - linkedInfra}건` },
  { id: "bizmodel-evidence", label: "수익화 시그널 근거", status: linkedBizmodel >= 3 ? "ok" : "warn", value: `공개 ${linkedBizmodel}건 · 보존 ${(bizmodel.items || []).length - linkedBizmodel}건` },
  { id: "research-source", label: "리서치 원문 링크", status: linkedResearch >= 3 ? "ok" : "warn", value: `공개 ${linkedResearch}건 · 보존 ${(research.feed || []).length - linkedResearch}건` },
  { id: "research-localization", label: "리서치 3줄 표시", status: localizedResearch + localizedFallbackResearch >= Math.max(3, (research.feed || []).length * 0.95) ? "ok" : "warn", value: `한국어 ${localizedResearch} · 영문 폴백 ${localizedFallbackResearch}` },
  { id: "market-source", label: "시장 기준선 보존", status: "ok", value: `화면 비노출 기준선 ${archivedMarketBaselines}건` },
  { id: "market-db-source", label: "신사업 정량 DB 원문 직접 검증", status: marketDirectEvidenceRate >= marketDirectEvidenceTarget ? "ok" : "warn", value: `${linkedMarketRecords}/${(market.records || []).length}건 · ${(marketDirectEvidenceRate * 100).toFixed(1)}% / 목표 ${(marketDirectEvidenceTarget * 100).toFixed(0)}%` },
  { id: "market-reverification-queue", label: "정량 DB 우선 재검증 큐", status: marketReverificationQueue.some(row => row.priority === "P0") ? "warn" : "ok", value: `${marketReverificationQueue.length}건 · P0 ${marketReverificationQueue.filter(row => row.priority === "P0").length}건` },
  { id: "volatile-price-change", label: "가격·요금제 변경 감지", status: pendingPriceChanges.length ? "warn" : "ok", value: `추적 ${priceChangeRows.length}건 · 검증 대기 ${pendingPriceChanges.length}건 · 확인된 변경 ${verifiedPriceChanges.length}건` },
  { id: "consumer-survey-coverage", label: "소비자 조사 레코드", status: consumerSurveyRecords >= 2 ? "ok" : "warn", value: `${consumerSurveyRecords}건` },
  { id: "duplicate-rate", label: "중복 기사 비율", status: duplicateRate <= Number(qualityThresholds.maximumDuplicateRate || 0.02) ? "ok" : "warn", value: `${duplicateArticles}건 · ${(duplicateRate * 100).toFixed(1)}% / 상한 ${((qualityThresholds.maximumDuplicateRate || 0.02) * 100).toFixed(0)}%` },
  { id: "monetization-classification-gate", label: "수익모델 분류 게이트", status: ungatedMonetizationRows.length ? "fail" : monetizationReviewQueue.total ? "warn" : "ok", value: `공개 ${publishedMonetizationRows.length}건 · 무게이트 ${ungatedMonetizationRows.length}건 · 검토 대기 ${monetizationReviewQueue.total || 0}건` },
  { id: "opportunity-generation", label: "월간 기회 후보 자동 생성", status: generatedOpportunities.length >= Number(qualityThresholds.minimumGeneratedOpportunities || 10) && generatedOpportunities.length <= Number(qualityThresholds.maximumGeneratedOpportunities || 20) && experimentShortlist.length <= Number(qualityThresholds.maximumExperimentShortlist || 3) && !invalidPublishedOpportunities.length ? "ok" : "warn", value: `후보 ${generatedOpportunities.length}건 · 실험 ${experimentShortlist.length}건 · 근거 미달 공개 ${invalidPublishedOpportunities.length}건` },
];

const fails = checks.filter(c => c.status === "fail").length;
const warns = checks.filter(c => c.status === "warn").length;
const overall = fails ? "fail" : warns ? "warn" : "ok";
const quality = {
  generatedAt: now.toISOString(),
  overall,
  policy: "뉴스 사실은 원문 제목·RSS 스니펫에서 정제한 발췌만 사용합니다. 한국어 화면 문구는 저장된 원문 조각만 번역하고 해시로 연결합니다. 3줄·한글 품질 검사 또는 번역 요청에 실패하면 원문 영어를 표시합니다.",
  summary: `검증 ${checks.length}개 · 정상 ${checks.length - fails - warns} · 주의 ${warns} · 실패 ${fails}`,
  checks,
  metrics: {
    currentArticles: currentArticles.length,
    accumulatedArticles: historyArticles.length,
    sourceBackedArticles: backedArticles,
    sourceExcerptArticles,
    sourceContentRate,
    sourceContentTarget: Number(qualityThresholds.sourceContentExtractionRate || 0.97),
    localizedArticles,
    localizedFallbackArticles,
    limitedArticles: articleIssues.length,
    limitedRate,
    duplicateArticles,
    duplicateRate,
    duplicateRateTarget: Number(qualityThresholds.maximumDuplicateRate || 0.02),
    freshStocks: stockFresh,
    totalStocks: stockRows.length,
    linkedInfra,
    linkedBizmodel,
    linkedResearch,
    localizedResearch,
    localizedFallbackResearch,
    archivedMarketBaselines,
    linkedMarketRecords,
    marketDirectEvidenceRate,
    marketDirectEvidenceTarget,
    marketReverificationQueueSize: marketReverificationQueue.length,
    marketReverificationP0: marketReverificationQueue.filter(row => row.priority === "P0").length,
    pendingPriceChanges: pendingPriceChanges.length,
    verifiedPriceChanges: verifiedPriceChanges.length,
    consumerSurveyRecords,
    criticalEmptyStreams,
    publishedMonetizationRows: publishedMonetizationRows.length,
    ungatedMonetizationRows: ungatedMonetizationRows.length,
    monetizationReviewQueue: monetizationReviewQueue.total || 0,
    generatedOpportunities: generatedOpportunities.length,
    experimentShortlist: experimentShortlist.length,
    invalidPublishedOpportunities: invalidPublishedOpportunities.length,
  },
  sources: { news: sourceCountsNews, stocks: sourceCounts },
  collection: collectionHealth,
  notices: [
    "뉴스 카드는 공개 제목·RSS 스니펫을 정제한 원문 발췌이며, 한국어 문구는 해당 원문 조각만 번역해 표시합니다.",
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
  localized: localizedArticles,
  localizationFallback: localizedFallbackArticles,
  limited: articleIssues.length,
  freshStocks: stockFresh,
  status: overall,
}].slice(-365);

news.articles = currentArticles;
news.count = currentArticles.length;
news.quality = { sourceBacked: backedArticles, sourceExcerpt: sourceExcerptArticles, localized: localizedArticles, localizationFallback: localizedFallbackArticles, limited: articleIssues.length, limitedRate };

const companyEngineCounts = Object.values(companies.companies || {}).reduce((counts, company) => {
  const engine = company?.intelligence?.engine || "missing";
  counts[engine] = (counts[engine] || 0) + 1;
  return counts;
}, {});
const companyAiCount = Object.entries(companyEngineCounts)
  .filter(([engine]) => engine.startsWith("github-models:"))
  .reduce((sum, [, count]) => sum + count, 0);
const llmHealth = {
  generatedAt: now.toISOString(),
  mode: companyAiCount ? "source-extractive-facts+grounded-company-synthesis" : "source-extractive-facts",
  summaryEngine: "source-content-extractive",
  externalModelApiCalls: companyAiCount ? "source-grounded-company-batches" : 0,
  policy: "Article facts remain distinct sentences extracted from stored publisher-page text. Company business-model and strategy synthesis may use GitHub Models only with supplied publisher evidence IDs; every visible company conclusion retains its source links. Failed model calls fall back to source-extractive synthesis.",
  displayLocalization: "source-fragment-translation-with-english-fallback",
  articleSummaryModes: { sourceExcerpt: sourceExcerptArticles, legacyOrLimited: currentArticles.length - sourceExcerptArticles },
  companySynthesis: {
    policy: "publisher-evidence-id-grounded",
    companies: Object.keys(companies.companies || {}).length,
    githubModelsCompanies: companyAiCount,
    engineCounts: companyEngineCounts,
  },
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
  writeFile("market-reverification-queue.json", JSON.stringify({
    generatedAt: now.toISOString(),
    targetDirectEvidenceRate: marketDirectEvidenceTarget,
    currentDirectEvidenceRate: marketDirectEvidenceRate,
    total: marketReverificationQueue.length,
    queue: marketReverificationQueue,
  }, null, 2) + "\n"),
  writeFile("price-change-flags.json", JSON.stringify(priceChangeFlags, null, 2) + "\n"),
  writeFile("llm-health.json", JSON.stringify(llmHealth, null, 2) + "\n"),
]);

console.log(`[verify] ${quality.summary}`);
console.log(`[verify] 누적 기사 ${historyArticles.length}건 · 원문 스니펫 근거 ${backedArticles}건 · 최신 주가 ${stockFresh}/${stockRows.length}`);
if (fails) {
  console.error("[verify] Critical evidence checks failed. Refusing to publish this refresh.");
  process.exit(1);
}
