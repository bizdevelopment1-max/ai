#!/usr/bin/env node
/**
 * Resolve append-only market discovery rows to publisher pages.
 *
 * The market crawler is intentionally allowed to keep an RSS discovery row
 * when a source is temporarily unavailable.  This pass is the publication
 * gate: only exact sentences and numeric tokens extracted from the resolved
 * publisher page can make a record displayEligible.
 */
import { readFile, writeFile } from "node:fs/promises";
import { cleanText, enrichSourceBatch, isContentBacked } from "./source-content.mjs";
import { canonicalUrl } from "./market-db.mjs";

const limit = Number(process.env.MARKET_SOURCE_REFRESH_LIMIT || 0);
const concurrency = Math.max(1, Number(process.env.MARKET_SOURCE_REFRESH_CONCURRENCY || 4));
const force = /^(1|true|yes)$/i.test(String(process.env.MARKET_SOURCE_REFRESH_FORCE || ""));
const now = () => new Date().toISOString();
const NON_FACT_MARKET_COPY = /(?:license granted|custom research|request (?:a )?sample|buy now|contact us|advertise|report purchase|cookie|privacy policy|sign up|user license|access to (?:the )?product|all rights reserved|register now|newsletter)/i;
const MARKET_FACT_TERMS = /(?:market|cagr|forecast|project(?:ed|ion)?|expect(?:ed|s)?|reach(?:ed|es)?|grow(?:th|ing)?|survey|respondents?|consumer|shipment|units?|adoption|spending|revenue|sales|demand|supply|valuation|investment|percent|million|billion|trillion|\$)/i;

const isGoogleNews = url => {
  try { return /(^|\.)news\.google\.com$/i.test(new URL(url).hostname); } catch { return false; }
};

const splitSentences = text => {
  const value = cleanText(text);
  try {
    return [...new Intl.Segmenter(undefined, { granularity: "sentence" }).segment(value)]
      .map(part => cleanText(part.segment)).filter(Boolean);
  } catch {
    return value.split(/(?<=[.!?。！？])\s+/).map(cleanText).filter(Boolean);
  }
};

// This deliberately captures literal source quantities rather than inferring
// a metric. Cards also show every source sentence containing a number, so a
// reader can inspect units, dates, bases and qualifying context together.
const quantityTokens = text => {
  const patterns = [
    /(?:US\$|USD|\$|€|£|¥|₩|₹|R\$)\s?\d[\d,.]*(?:\s?(?:trillion|billion|million|thousand|trn|bn|mn|T|B|M))?/gi,
    /\b\d+(?:\.\d+)?\s?%|\b\d+(?:\.\d+)?\s?(?:percent|per cent|basis points?|bps)\b/gi,
    /\b\d[\d,.]*(?:\s?(?:trillion|billion|million|thousand|trn|bn|mn|T|B|M|k))\b/gi,
    /\b20(?:1\d|2\d|3\d)\b/g,
    /\b\d+(?:\.\d+)?\s?(?:years?|months?|days?|hours?|users?|consumers?|respondents?|shipments?|units?|devices?|people|adults?)\b/gi,
  ];
  return [...new Set(patterns.flatMap(pattern => [...String(text || "").matchAll(pattern)]
    .map(match => cleanText(match[0]))).filter(Boolean))];
};

const sourceQuantifiedLines = (headline, sourceText) => {
  const seen = new Set();
  const result = [];
  // Keep a headline separate from paragraphs. Merging on a newline makes an
  // invented-looking hybrid sentence and breaks exact source traceability.
  for (const line of [cleanText(headline), ...splitSentences(sourceText)]) {
    const values = quantityTokens(line);
    const key = line.toLocaleLowerCase();
    const hasNonDateQuantity = values.some(value => !/^20(?:1\d|2\d|3\d)$/.test(value));
    if (!values.length || !hasNonDateQuantity || !MARKET_FACT_TERMS.test(line) || NON_FACT_MARKET_COPY.test(line) || seen.has(key)) continue;
    seen.add(key);
    result.push({ line, values });
  }
  return result;
};

const normalizedQuantity = value => cleanText(value).toLocaleLowerCase()
  .replace(/(?:us\$|usd|\$|€|£|¥|₩|₹|r\$)\s*/g, "")
  .replace(/\s+/g, " ");

const sourceQuantities = lines => {
  const candidates = [...new Set(lines.flatMap(item => item.values || []))]
    .sort((a, b) => String(b).length - String(a).length);
  const kept = [];
  for (const value of candidates) {
    const normalized = normalizedQuantity(value);
    // "$85.48 billion" and "85.48 billion" are the same source quantity.
    // Preserve the most explicit literal form while removing presentation-only
    // duplicates; every original numeric sentence remains below the card.
    if (kept.some(previous => normalizedQuantity(previous) === normalized)) continue;
    kept.push(value);
  }
  return kept;
};

const sourceSummaryLines = (summaryLines, quantifiedLines) => {
  const chosen = [];
  const take = line => {
    const value = cleanText(line);
    if (!value || NON_FACT_MARKET_COPY.test(value) || chosen.some(existing => existing === value)) return;
    chosen.push(value);
  };
  for (const line of summaryLines || []) take(line);
  for (const item of quantifiedLines) take(item.line);
  return chosen.slice(0, 3);
};

const asSourceInput = record => ({
  ...record,
  // enrichSourceRecord reads url while market rows use sourceUrl.
  url: record.sourceUrl,
  titleEn: record.titleEn || record.title,
  descEn: record.descEn || record.evidence || "",
  source: record.sourceName || "",
  date: record.publishedAt || "",
});

const needsRefresh = record => force || !(
  isContentBacked(record)
  && record.provenance?.status === "source-backed"
  && Array.isArray(record.sourceQuantifiedLines)
  && record.sourceQuantifiedLines.length
  && Array.isArray(record.sourceQuantities)
  && record.sourceQuantities.length
);

const withPublisherEvidence = (record, enriched, checkedAt) => {
  const sourceContent = enriched.sourceContent || {};
  const pageUrl = canonicalUrl(sourceContent.canonicalUrl || enriched.url || record.sourceUrl);
  const lines = sourceContent.status === "content-extracted"
    ? sourceQuantifiedLines(enriched.title || sourceContent.headline || record.title, sourceContent.text)
    : [];
  const quantities = sourceQuantities(lines);
  const summaryLinesEn = sourceSummaryLines(enriched.summaryLinesEn, lines);
  const valid = isContentBacked(enriched) && !isGoogleNews(pageUrl) && lines.length > 0 && quantities.length > 0 && summaryLinesEn.length === 3;
  const originalUrl = canonicalUrl(record.sourceUrl);
  const oldDiscovery = record.rssEvidence || record.evidence || "";

  if (!valid) {
    return {
      ...record,
      displayEligible: false,
      sourceContent,
      sourceQuantifiedLines: [],
      sourceQuantities: [],
      provenance: {
        status: "reference-only",
        evidenceCount: 0,
        evidenceType: "publisher-page-not-verified",
        checkedAt,
        issues: [sourceContent.error || (sourceContent.status === "content-extracted" ? "no-source-quantities-found" : "publisher-page-extraction-required")],
      },
    };
  }

  return {
    ...record,
    // Retain discovery data for audit/history but never render it as facts.
    ...(isGoogleNews(originalUrl) ? { rssUrl: record.rssUrl || originalUrl } : {}),
    rssEvidence: oldDiscovery,
    discoveryValues: record.discoveryValues || record.values || [],
    sourceUrl: pageUrl,
    sourceName: record.sourceName || new URL(pageUrl).hostname.replace(/^www\./, ""),
    title: enriched.title || sourceContent.headline || record.title,
    titleEn: enriched.titleEn || enriched.title || sourceContent.headline || record.title,
    descEn: enriched.descEn || sourceContent.description || "",
    summaryLinesEn,
    summaryRoles: (enriched.summaryRoles || []).slice(0, summaryLinesEn.length),
    summary: summaryLinesEn.join("\n"),
    summaryVersion: enriched.summaryVersion,
    summaryMode: enriched.summaryMode,
    summaryEngine: enriched.summaryEngine,
    sourceContent,
    sourceQuantifiedLines: lines,
    sourceQuantities: quantities,
    values: quantities.map((value, index) => ({ label: `원문 수치 ${index + 1}`, value })),
    // The UI may use this compact extract for an audit fallback, but it never
    // uses the Google/RSS description after source-page verification.
    evidence: (enriched.summaryLinesEn || []).join("\n"),
    displayEligible: true,
    provenance: {
      status: "source-backed",
      evidenceCount: lines.length,
      evidenceType: "publisher-page-text-with-quantities",
      checkedAt,
      sourceContentHash: sourceContent.contentHash || "",
    },
  };
};

async function main() {
  const data = JSON.parse(await readFile("market.json", "utf8"));
  const records = Array.isArray(data.records) ? data.records : [];
  const candidates = records.filter(needsRefresh);
  const target = limit > 0 ? candidates.slice(0, limit) : candidates;
  console.log(`[market-source-refresh] ${target.length}/${records.length} records need publisher-page extraction`);

  const enriched = await enrichSourceBatch(target.map(asSourceInput), concurrency);
  const byId = new Map(enriched.map(row => [row.id, row]));
  const checkedAt = now();
  const updated = records.map(record => byId.has(record.id)
    ? withPublisherEvidence(record, byId.get(record.id), checkedAt)
    : record);
  const published = updated.filter(record => record.provenance?.status === "source-backed").length;
  const withheld = updated.filter(record => record.provenance?.status !== "source-backed").length;

  data.records = updated;
  data.generatedAt = checkedAt;
  data.database = {
    ...(data.database || {}),
    recordCount: updated.length,
    lastSourceRefreshAt: checkedAt,
    lastSourceRefresh: { attempted: target.length, sourceBacked: published, withheld, concurrency },
  };
  await writeFile("market.json", JSON.stringify(data, null, 2) + "\n");
  console.log(`[market-source-refresh] visible source-backed ${published}; append-only retained but withheld ${withheld}`);
}

main().catch(error => { console.error(error); process.exit(1); });
