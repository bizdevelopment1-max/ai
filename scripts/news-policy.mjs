import { readFile } from "node:fs/promises";

const DEFAULT_POLICY = {
  version: 2,
  summaryMode: "source-content-extractive",
  excludedTerms: [],
};

let loaded = DEFAULT_POLICY;
try {
  loaded = { ...DEFAULT_POLICY, ...JSON.parse(await readFile("config/news-policy.json", "utf8")) };
} catch (error) {
  console.warn(`[news-policy] config unavailable; no terms excluded: ${error.message}`);
}

export const newsPolicy = Object.freeze(loaded);

export const isExcludedText = value => {
  const text = String(value || "");
  return newsPolicy.excludedTerms.some(term => {
    const escaped = String(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = /^[A-Za-z0-9]+$/.test(String(term)) ? `\\b${escaped}\\b` : escaped;
    return new RegExp(pattern, "i").test(text);
  });
};

export const excludedReason = () => newsPolicy.excludedTermsReason || "configured exclusion";
