#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const readJson = async (file, fallback = {}) => {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; }
};
const text = value => String(value || "").replace(/\s+/g, " ").trim();
const norm = value => text(value).toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
const round1 = value => Math.round(value * 10) / 10;
const secHeaders = {
  "User-Agent": process.env.SEC_USER_AGENT || "bizdevelopment1-max AI intelligence taxonomy audit https://github.com/bizdevelopment1-max/ai",
  "Accept-Encoding": "gzip, deflate",
};
const fetchText = async url => {
  const response = await fetch(url, { headers: secHeaders, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
};
const fetchJson = async url => JSON.parse(await fetchText(url));
const htmlText = source => source
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&#x?[0-9a-f]+;/gi, " ")
  .replace(/\s+/g, " ");
const extractRevenueMix = plain => {
  const rows = [...plain.matchAll(/License and Other Revenue\s*\(?\d*\)?\s*\$?\s*([\d,]+)\s*\$?\s*([\d,]+)[\s\S]{0,1600}?Royalty Revenue\s*\$?\s*([\d,]+)\s*\$?\s*([\d,]+)/gi)]
    .map(match => ({
      licenseOtherRevenue: Number(match[1].replace(/,/g, "")),
      priorLicenseOtherRevenue: Number(match[2].replace(/,/g, "")),
      royaltyRevenue: Number(match[3].replace(/,/g, "")),
      priorRoyaltyRevenue: Number(match[4].replace(/,/g, "")),
    })).filter(row => Object.values(row).every(Number.isFinite));
  return rows.sort((left, right) =>
    (right.licenseOtherRevenue + right.royaltyRevenue) - (left.licenseOtherRevenue + left.royaltyRevenue))[0] || null;
};
const buildRevenueMix = (row, filing, sourceUrl) => {
  const totalRevenue = row.licenseOtherRevenue + row.royaltyRevenue;
  return {
    status: "official-current",
    form: filing.form,
    filingDate: filing.filingDate,
    periodEnd: filing.periodEnd,
    unit: "USD millions",
    totalRevenue,
    royaltyRevenue: row.royaltyRevenue,
    licenseOtherRevenue: row.licenseOtherRevenue,
    royaltyPct: round1(row.royaltyRevenue / totalRevenue * 100),
    licenseOtherPct: round1(row.licenseOtherRevenue / totalRevenue * 100),
    sourceUrl,
  };
};

async function latestArmRevenue(rule, previous = null) {
  try {
    for (const filing of rule.officialFilingUrls || []) {
      try {
        const row = extractRevenueMix(htmlText(await fetchText(filing.url)));
        if (row) return buildRevenueMix(row, filing, filing.url);
      } catch {}
    }
    const cik = String(rule.sec?.cik || "").padStart(10, "0");
    const submissions = await fetchJson(`https://data.sec.gov/submissions/CIK${cik}.json`);
    const recent = submissions.filings?.recent || {};
    const allowed = new Set(rule.sec?.forms || ["6-K", "20-F"]);
    const candidates = (recent.form || []).map((form, index) => ({
      form,
      filingDate: recent.filingDate?.[index] || "",
      accession: recent.accessionNumber?.[index] || "",
      primaryDocument: recent.primaryDocument?.[index] || "",
    })).filter(item => allowed.has(item.form) && /^arm-\d{8}\.htm$/i.test(item.primaryDocument))
      .slice(0, Number(rule.sec?.maxFilingsToTry || 8));
    for (const filing of candidates) {
      const accession = filing.accession.replace(/-/g, "");
      const entity = cik.replace(/^0+/, "");
      const sourceUrl = `https://www.sec.gov/Archives/edgar/data/${entity}/${accession}/${filing.primaryDocument}`;
      const plain = htmlText(await fetchText(sourceUrl));
      const row = extractRevenueMix(plain);
      if (!row) continue;
      const periodToken = filing.primaryDocument.match(/(\d{4})(\d{2})(\d{2})/)?.slice(1) || [];
      const periodEnd = periodToken.length ? `${periodToken[0]}-${periodToken[1]}-${periodToken[2]}` : "";
      return buildRevenueMix(row, { ...filing, periodEnd }, sourceUrl);
    }
    throw new Error("No revenue disaggregation table in recent Arm filings");
  } catch (error) {
    if (previous?.latestRevenueMix) return {
      ...previous.latestRevenueMix,
      status: "cached-official-fallback",
      refreshError: text(error.message),
    };
    throw error;
  }
}

const [policy, taxonomy, companiesDb, partnerDb, newsDb, previous] = await Promise.all([
  readJson("config/business-classifications.json"),
  readJson("config/dashboard-taxonomy.json"),
  readJson("companies.json", { companies: {} }),
  readJson("partner-ma-candidates.json", { records: [] }),
  readJson("news.json", { articles: [] }),
  readJson("business-classification-audit.json", { stockProfiles: {} }),
]);
const violations = [];
const warnings = [];
const companyProfiles = {};
const stockProfiles = {};
const layerIds = new Set((taxonomy.VALUE_CHAIN || []).map(item => item.id));
const groupIds = new Set((taxonomy.STOCK_GROUPS || []).map(item => item.id));
const stockLayerIds = new Set((taxonomy.STOCK_VALUE_CHAIN || []).map(item => item.id));
const stockByTicker = new Map((taxonomy.STOCKS || []).map(item => [item.ticker, item]));
const companyByName = new Map((taxonomy.COMPANIES || []).map(item => [item.name, item]));
const listedCompanies = new Set((taxonomy.COMPANIES || []).map(item => item.name));
const generatedCompanies = new Set(Object.keys(companiesDb.companies || {}));
const candidateCompanies = new Set((partnerDb.records || []).map(item => item.name));

for (const [name, classification] of Object.entries(taxonomy.COMPANY_LAYER || {})) {
  if (!layerIds.has(classification.layer)) violations.push({ type: "unknown-company-layer", name, layer: classification.layer });
}
for (const category of taxonomy.CATEGORIES || []) {
  if (!text(category.desc)) violations.push({ type: "missing-category-description", category: category.id });
}
for (const name of taxonomy.COMPANY_ORDER || []) {
  if (!taxonomy.COMPANY_LAYER?.[name] || !listedCompanies.has(name)) violations.push({ type: "company-registry-reference-mismatch", name });
}
for (const company of taxonomy.COMPANIES || []) {
  if (!taxonomy.COMPANY_LAYER?.[company.name]) violations.push({ type: "missing-company-layer", name: company.name });
  if (!generatedCompanies.has(company.name)) violations.push({ type: "missing-generated-company", name: company.name });
  if (!candidateCompanies.has(company.name)) violations.push({ type: "missing-partner-candidate", name: company.name });
}
if (Object.hasOwn(taxonomy, "STOCK_LAYER")) violations.push({ type: "redundant-stock-layer-table", policy: "group-only" });
for (const stock of taxonomy.STOCKS || []) {
  const layer = taxonomy.STOCK_GROUP_LAYER?.[stock.group];
  if (!groupIds.has(stock.group)) violations.push({ type: "unknown-stock-group", ticker: stock.ticker, group: stock.group });
  if (!stockLayerIds.has(layer)) violations.push({ type: "unknown-stock-layer", ticker: stock.ticker, layer });
}
for (const layer of taxonomy.VALUE_CHAIN || []) {
  const count = Object.values(taxonomy.COMPANY_LAYER || {}).filter(item => item.layer === layer.id).length;
  if (!count) violations.push({ type: "dead-company-value-chain-layer", layer: layer.id });
}

const trustAllowlist = new Set((policy.companyRules || []).filter(rule => rule.expectedLayer === "trust").map(rule => rule.name));
for (const rule of policy.companyRules || []) {
  const actual = taxonomy.COMPANY_LAYER?.[rule.name]?.layer || "";
  const company = companyByName.get(rule.name);
  if (actual !== rule.expectedLayer) violations.push({ type: "company-primary-layer-mismatch", name: rule.name, expected: rule.expectedLayer, actual });
  if (rule.expectedVertical && taxonomy.COMPANY_LAYER?.[rule.name]?.vertical !== rule.expectedVertical) {
    violations.push({ type: "company-vertical-mismatch", name: rule.name, expected: rule.expectedVertical, actual: taxonomy.COMPANY_LAYER?.[rule.name]?.vertical });
  }
  if (rule.expectedUnit && company?.unit !== rule.expectedUnit) {
    violations.push({ type: "company-business-description-mismatch", name: rule.name, expected: rule.expectedUnit, actual: company?.unit });
  }
  const ageDays = (Date.now() - Date.parse(`${rule.lastVerifiedAt}T00:00:00Z`)) / 86400000;
  if (!Number.isFinite(ageDays) || ageDays > Number(policy.reviewMaxAgeDays || 90)) warnings.push({ type: "stale-company-classification", name: rule.name, lastVerifiedAt: rule.lastVerifiedAt });
  companyProfiles[rule.name] = {
    primaryLayer: rule.expectedLayer,
    primaryProduct: rule.primaryProduct,
    reason: rule.reason,
    businessDescription: rule.expectedUnit || company?.unit || "",
    modelAccess: rule.modelAccess || "",
    lastVerifiedAt: rule.lastVerifiedAt,
    sourceUrl: rule.sourceUrl,
    secondarySourceUrl: rule.secondarySourceUrl || "",
  };
}
for (const [name, classification] of Object.entries(taxonomy.COMPANY_LAYER || {})) {
  if (classification.layer === "trust" && !trustAllowlist.has(name)) violations.push({ type: "trust-layer-scope-violation", name });
}

for (const rule of policy.stockRules || []) {
  const stock = stockByTicker.get(rule.ticker);
  const actualLayer = taxonomy.STOCK_GROUP_LAYER?.[stock?.group];
  if (!stock) violations.push({ type: "missing-classified-stock", ticker: rule.ticker });
  if (stock?.group !== rule.expectedGroup) violations.push({ type: "stock-revenue-group-mismatch", ticker: rule.ticker, expected: rule.expectedGroup, actual: stock?.group });
  if (actualLayer !== rule.expectedLayer) violations.push({ type: "stock-value-chain-layer-mismatch", ticker: rule.ticker, expected: rule.expectedLayer, actual: actualLayer });
  const latestRevenueMix = await latestArmRevenue(rule, previous.stockProfiles?.[rule.ticker]);
  if (latestRevenueMix.status !== "official-current") warnings.push({ type: "stock-revenue-refresh-fallback", ticker: rule.ticker, detail: latestRevenueMix.refreshError });
  stockProfiles[rule.ticker] = {
    name: rule.name,
    group: rule.expectedGroup,
    valueChainLayer: rule.expectedLayer,
    businessModel: rule.businessModel,
    comparisonBasis: rule.comparisonBasis,
    transitionSignal: rule.transitionSignal,
    lastVerifiedAt: rule.lastVerifiedAt,
    businessSourceUrl: rule.businessSourceUrl,
    latestRevenueMix,
  };
}

const watchedNames = [...(policy.companyRules || []).map(rule => rule.name), ...(policy.stockRules || []).map(rule => rule.name)];
const changePattern = /launch|silicon|chip|license|royalt|revenue|business model|governance|privacy|compliance|acquir|merge|출시|칩|라이선스|로열티|매출|거버넌스|프라이버시|컴플라이언스|인수|합병/i;
const changeSignals = (newsDb.articles || []).filter(article => {
  const body = `${article.titleEn || article.title || ""} ${article.descEn || article.summary || ""}`;
  return changePattern.test(body) && watchedNames.some(name => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(body));
}).slice(0, 100).map(article => ({
  date: article.date || "",
  title: article.title || article.titleEn || "",
  url: article.url || "",
  status: "review",
}));

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  policies: {
    company: policy.companyClassificationBasis,
    stock: policy.stockClassificationBasis,
    stockLayer: policy.stockLayerResolution,
    trust: policy.trustLayerPolicy,
  },
  coverage: [
    "CATEGORIES", "COMPANY_LAYER", "COMPANY_ORDER", "COMPANIES", "VALUE_CHAIN",
    "STARTUP_TAXONOMY", "STARTUP_VERTICALS", "STOCK_GROUPS", "STOCKS",
    "STOCK_GROUP_LAYER", "STOCK_VALUE_CHAIN", "STOCK_VALUE_CHAIN_FAMILIES", "companies.json", "partner-ma-candidates.json"
  ],
  summary: {
    datasetsChecked: 14,
    companyRules: (policy.companyRules || []).length,
    stockRules: (policy.stockRules || []).length,
    valueChainLayers: (taxonomy.VALUE_CHAIN || []).length,
    violations: violations.length,
    warnings: warnings.length,
    changeSignals: changeSignals.length,
  },
  companyProfiles,
  stockProfiles,
  violations,
  warnings,
  changeSignals,
};
await writeFile("business-classification-audit.json", `${JSON.stringify(output)}\n`);
if (violations.length) throw new Error(`Business classification validation failed: ${violations.length} violation(s)`);
console.log(`[business-classification] ${output.summary.datasetsChecked} datasets · ${output.summary.companyRules} company rules · ${output.summary.stockRules} stock rules · ${output.summary.violations} violations · ${output.summary.warnings} warnings`);
