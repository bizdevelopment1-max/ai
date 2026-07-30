#!/usr/bin/env node
/**
 * Builds the only company-specific news index consumed by the browser.
 *
 * Discovery queries remain intentionally broad.  Publication is intentionally
 * narrow: the article must be source-backed and must pass the exact headline
 * entity or official-domain gate in company-sources.mjs.
 */
import { readFile, writeFile } from "node:fs/promises";
import { loadDash } from "./load-dash.mjs";
import { directCompanyNewsMatch } from "./company-sources.mjs";

const readJson = async (file, fallback = null) => {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch { return fallback; }
};
const canonicalUrl = value => {
  try {
    const url = new URL(String(value || ""));
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(key => url.searchParams.delete(key));
    return url.href.replace(/[?&]$/, "").replace(/\/+$/, "");
  } catch {
    return String(value || "").replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
};
const titleKey = value => String(value || "").toLowerCase()
  .replace(/&(?:apos|#39);/g, "'")
  .replace(/[^a-z0-9가-힣]+/g, "")
  .slice(0, 120);
const sourceBacked = article => article?.displayEligible !== false
  && article?.summaryMode === "source-content-extractive"
  && article?.provenance?.status === "source-backed"
  && /^https?:\/\//.test(String(article?.url || ""));
const compact = (article, match) => {
  const keys = [
    "id", "date", "co", "cat", "source", "title", "titleEn", "titleKo", "url", "tag",
    "summary", "summaryLinesEn", "summaryLinesKo", "summaryMode", "displayEligible",
    "provenance", "localization",
  ];
  return {
    ...Object.fromEntries(keys.filter(key => Object.hasOwn(article, key)).map(key => [key, article[key]])),
    companyMatch: { mode: match.mode, term: match.term },
  };
};

const news = await readJson("news.json", { articles: [] });
const previous = await readJson("company-news.json", null);
const companies = loadDash().COMPANIES || [];
const eligible = (news.articles || []).filter(sourceBacked);
const companyIndex = {};

for (const company of companies) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  companyIndex[company.name] = eligible
    .map(article => ({ article, match: directCompanyNewsMatch(company.name, article, company.domain) }))
    .filter(row => row.match.matched)
    .sort((left, right) => String(right.article.date || "").localeCompare(String(left.article.date || "")))
    .filter(({ article }) => {
      const url = canonicalUrl(article.url);
      const title = titleKey(article.titleEn || article.title);
      if (!url || !title || seenUrls.has(url) || seenTitles.has(title)) return false;
      seenUrls.add(url);
      seenTitles.add(title);
      return true;
    })
    .slice(0, 8)
    .map(({ article, match }) => compact(article, match));
}

const assigned = Object.values(companyIndex).flat();
const content = {
  schemaVersion: 1,
  methodology: "source-backed+headline-entity-or-official-domain+canonical-url-dedupe",
  generatedAt: new Date().toISOString(),
  sourceGeneratedAt: news.generatedAt || "",
  coverage: {
    companiesTracked: companies.length,
    companiesWithNews: Object.values(companyIndex).filter(rows => rows.length).length,
    articleAssignments: assigned.length,
    uniqueArticles: new Set(assigned.map(article => canonicalUrl(article.url))).size,
    latestArticleDate: assigned.reduce((latest, article) => String(article.date || "") > latest ? String(article.date || "") : latest, ""),
  },
  companies: companyIndex,
};

const stable = value => JSON.stringify({ ...(value || {}), generatedAt: "" });
if (previous && stable(previous) === stable(content)) content.generatedAt = previous.generatedAt || content.generatedAt;
await writeFile("company-news.json", `${JSON.stringify(content)}\n`);
console.log(`[company-news] ${content.coverage.companiesWithNews}/${content.coverage.companiesTracked} companies · ${content.coverage.articleAssignments} verified assignments · ${content.coverage.uniqueArticles} unique articles`);
