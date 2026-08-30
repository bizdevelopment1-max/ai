#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { loadCorporateEntities } from "./corporate-entities.mjs";

const readJson = async (file, fallback = {}) => {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; }
};
const host = value => {
  try { return new URL(/^https?:\/\//i.test(String(value || "")) ? value : `https://${value}`).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
};
const norm = value => String(value || "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
const registry = loadCorporateEntities();
const [taxonomy, companies, news, partner] = await Promise.all([
  readJson("config/dashboard-taxonomy.json"),
  readJson("companies.json", { companies: {} }),
  readJson("news.json", { articles: [] }),
  readJson("partner-ma-candidates.json", { records: [] }),
]);
const violations = [];
const warnings = [];
const changeSignals = [];
const companyNames = new Set((taxonomy.COMPANIES || []).map(item => norm(item.name)));
const companyOrder = new Set((taxonomy.COMPANY_ORDER || []).map(norm));
const companyLayer = new Set(Object.keys(taxonomy.COMPANY_LAYER || {}).map(norm));
const generatedNames = new Set(Object.keys(companies.companies || {}).map(norm));
const partnerNames = new Set((partner.records || []).map(item => norm(item.name)));
const stockByTicker = new Map((taxonomy.STOCKS || []).map(item => [item.ticker, item]));

for (const entity of registry.entities || []) {
  const verifiedAge = (Date.now() - Date.parse(`${entity.lastVerifiedAt}T00:00:00Z`)) / 86400000;
  if (!Number.isFinite(verifiedAge) || verifiedAge > Number(registry.reviewMaxAgeDays || 90)) {
    warnings.push({ type: "stale-entity-verification", entity: entity.canonicalName, lastVerifiedAt: entity.lastVerifiedAt });
  }
  const stock = entity.ticker ? stockByTicker.get(entity.ticker) : null;
  if (entity.ticker && !stock) violations.push({ type: "missing-listed-entity", ticker: entity.ticker, entity: entity.canonicalName });
  if (stock && entity.primaryDomain && host(stock.domain) !== host(entity.primaryDomain)) {
    violations.push({ type: "issuer-domain-mismatch", ticker: entity.ticker, actual: stock.domain, expected: entity.primaryDomain });
  }
  if (stock && entity.stockGroup && stock.group !== entity.stockGroup) {
    violations.push({ type: "stock-group-mismatch", ticker: entity.ticker, actual: stock.group, expected: entity.stockGroup });
  }
  if (entity.ticker && entity.valueChainLayer && taxonomy.STOCK_LAYER?.[entity.ticker] !== entity.valueChainLayer) {
    violations.push({ type: "stock-layer-mismatch", ticker: entity.ticker, actual: taxonomy.STOCK_LAYER?.[entity.ticker], expected: entity.valueChainLayer });
  }
  for (const subsidiary of entity.subsidiaries || []) {
    if (subsidiary.countingPolicy !== "parent-only") continue;
    const aliases = [subsidiary.name, subsidiary.legalName, subsidiary.canonicalId, ...(subsidiary.aliases || [])].map(norm).filter(Boolean);
    const independentlyListed = aliases.some(alias => companyNames.has(alias) || companyOrder.has(alias) || companyLayer.has(alias));
    const independentlyGenerated = aliases.some(alias => generatedNames.has(alias));
    const independentCandidate = aliases.some(alias => partnerNames.has(alias));
    if (independentlyListed) violations.push({ type: "subsidiary-double-counted-in-taxonomy", parent: entity.canonicalName, subsidiary: subsidiary.name });
    if (independentlyGenerated) violations.push({ type: "subsidiary-double-counted-in-company-db", parent: entity.canonicalName, subsidiary: subsidiary.name });
    if (independentCandidate) violations.push({ type: "subsidiary-double-counted-in-partner-db", parent: entity.canonicalName, subsidiary: subsidiary.name });
  }
}

const acquisitionTerms = /\b(acquir(?:e|es|ed|ing)|merg(?:e|es|ed|ing)|subsidiary|rebrand(?:s|ed|ing)?)\b|인수|합병|자회사|사명\s*변경/i;
const trackedAliases = (registry.entities || []).flatMap(entity => [
  { entity, name: entity.canonicalName },
  ...(entity.subsidiaries || []).flatMap(subsidiary => [subsidiary.name, subsidiary.legalName, ...(subsidiary.aliases || [])]
    .filter(Boolean).map(name => ({ entity, subsidiary, name }))),
]);
for (const article of news.articles || []) {
  const body = `${article.titleEn || article.title || ""} ${article.descEn || article.summary || ""}`;
  if (!article.url || !acquisitionTerms.test(body)) continue;
  const matches = trackedAliases.filter(item => new RegExp(`\\b${String(item.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(body));
  if (!matches.length) continue;
  changeSignals.push({
    date: article.date || "",
    title: article.title || article.titleEn || "",
    url: article.url,
    entities: [...new Set(matches.map(item => item.entity.canonicalName))],
    status: matches.some(item => item.subsidiary && item.subsidiary.sourceUrl === article.url) ? "registered" : "review",
  });
}

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  policy: registry.aggregationPolicy,
  summary: {
    entities: (registry.entities || []).length,
    subsidiaries: (registry.entities || []).reduce((sum, entity) => sum + (entity.subsidiaries || []).length, 0),
    violations: violations.length,
    warnings: warnings.length,
    changeSignals: changeSignals.length,
    reviewQueue: changeSignals.filter(item => item.status === "review").length,
  },
  violations,
  warnings,
  changeSignals: changeSignals.slice(0, 100),
};
await writeFile("corporate-entity-audit.json", `${JSON.stringify(output)}\n`);
if (violations.length) throw new Error(`Corporate entity validation failed: ${violations.length} violation(s)`);
console.log(`[corporate-entities] ${output.summary.entities} parents · ${output.summary.subsidiaries} subsidiaries · ${output.summary.changeSignals} change signals · 0 violations`);

