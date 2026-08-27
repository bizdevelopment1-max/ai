#!/usr/bin/env node
/**
 * Continuously refreshed company records -> partner / investment / M&A screen.
 *
 * The screen is rebuilt from the startup ledger, the source-grounded company
 * profiles and each company's latest article stream. It never invents a
 * valuation, transaction, buyer or investment amount. Missing deal terms
 * stay undisclosed and every candidate retains followable evidence URLs.
 */
import { readFile, writeFile } from "node:fs/promises";

const readJson = async (file, fallback = {}) => {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; }
};

const [startups, companyDb, companyNewsDb, taxonomy, previous] = await Promise.all([
  readJson("startups.json", { large: [], small: [], institutional: [] }),
  readJson("companies.json", { companies: {} }),
  readJson("company-news.json", { companies: {} }),
  readJson("config/dashboard-taxonomy.json", { STARTUP_TAXONOMY: [] }),
  readJson("partner-ma-candidates.json", { records: [] }),
]);

const banned = /삼성|samsung|갤럭시|galaxy|\bMX\b|휴대폰/gi;
const text = value => String(value || "").replace(banned, "단말 사업").replace(/\s+/g, " ").trim();
const slug = value => text(value).toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "");
const normalize = value => text(value).toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9가-힣]+/g, "");
const https = value => /^https:\/\//i.test(String(value || ""));
const clamp = value => Math.max(1, Math.min(5, Math.round(Number(value) || 1)));
const taxonomyRows = taxonomy.STARTUP_TAXONOMY || [];
const taxonomyById = new Map(taxonomyRows.map(item => [item.id, item]));
const companyMap = companyDb.companies || {};
const companyNews = companyNewsDb.companies || {};
const generatedAt = new Date().toISOString();
const generatedDay = generatedAt.slice(0, 10);

const dated = item => item && https(item.url) && item.title ? {
  title: text(item.localization?.status === "accepted" ? item.localization.title : item.title),
  date: text(item.date || item.publishedAt || item.checkedAt).slice(0, 10),
  url: item.url,
  source: text(item.source || item.publisher || item.label || "원문"),
} : null;
const newest = items => items.filter(Boolean).sort((left, right) =>
  String(right.date || "").localeCompare(String(left.date || "")))[0] || null;
const ageDays = date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return null;
  return Math.max(0, Math.floor((Date.parse(`${generatedDay}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000));
};
const sourceGrounded = section => section?.groundingStatus === "source-grounded" && text(section.summary);
const evidenceFromIntelligence = company => [
  company?.intelligence?.currentBusiness,
  company?.intelligence?.revenueModel,
  company?.intelligence?.strategyDirection,
  company?.intelligence?.investmentDirection,
].flatMap(section => section?.evidence || []);
const actionCandidates = (name, seed, company) => [
  seed?.latest,
  ...(seed?.history || []),
  company?.latest,
  company?.intelligence?.publication?.latestEvidence,
  ...(company?.intelligence?.corePractices || []).map(item => item?.evidence),
  ...(companyNews[name] || []),
].map(dated).filter(Boolean);
const sourceUrls = (name, seed, company) => [...new Set([
  seed?.profile?.officialWebsite,
  ...(seed?.profile?.sourceUrls || []),
  seed?.latest?.url,
  ...(seed?.history || []).map(item => item?.url),
  ...(seed?.sourceLinks || []).map(item => item?.url),
  seed?.institution?.url,
  ...(company?.strategyProfile?.sourceUrls || []),
  ...(company?.organization?.officialPages || []).flatMap(item => [item?.resolvedUrl, item?.url]),
  ...evidenceFromIntelligence(company).map(item => item?.url),
  company?.latest?.url,
  ...(companyNews[name] || []).slice(0, 6).map(item => item?.url),
].filter(https))];
const acquired = record => /(?:인수|산하|acquired|subsidiary|owned by)/i.test([
  record?.stage, record?.funding, record?.val, record?.overview, record?.description,
].filter(Boolean).join(" "));
const roundStage = (seed, company, isTracked) => text(
  seed?.stage || seed?.funding || seed?.val || company?.strategyProfile?.classification?.stage
  || (isTracked ? "전략 제휴 대상" : "조건 미공개"),
);
const businessSummary = (seed, company) => text(
  sourceGrounded(company?.intelligence?.currentBusiness)
  || company?.strategyProfile?.currentBusiness
  || seed?.currentBusiness || seed?.businessModel || seed?.overview || seed?.description
  || company?.profile?.business?.[0] || seed?.profile?.business?.[0]
  || company?.strategyProfile?.classification?.vertical || seed?.vertical,
);
const revenueSummary = (seed, company) => text(
  sourceGrounded(company?.intelligence?.revenueModel)
  || company?.strategyProfile?.revenueModel || seed?.revenueModel || seed?.revenue || "미공개",
);
const strategySummary = (seed, company, latest) => text(
  sourceGrounded(company?.intelligence?.strategyDirection)
  || company?.strategyProfile?.strategyDirection || seed?.strategyDirection || seed?.direction
  || latest?.title || "최근 실행 추가 확인",
);
const routeSummary = (seed, company, latest) => text(
  company?.intelligence?.strategicImplications?.[0]?.assessment
  || seed?.acqAngle || seed?.partnership || seed?.label
  || latest?.title || "제품·서비스 연계 조건 검토",
);
const categoryFor = (seed, company) => {
  const explicit = seed?.cat || company?.portfolioReference?.category;
  if (explicit && taxonomyById.has(explicit)) return taxonomyById.get(explicit);
  const haystack = [
    seed?.vertical,
    company?.strategyProfile?.classification?.vertical,
    businessSummary(seed, company),
    company?.intelligence?.capabilityProfile?.summary,
  ].filter(Boolean).join(" ").toLowerCase();
  return taxonomyRows.find(item => (item.match || []).some(term =>
    haystack.includes(String(term).toLowerCase()))) || null;
};

const startupUniverse = [
  ...(startups.large || []).map(record => ({ record, portfolioClass: "growth" })),
  ...(startups.small || []).map(record => ({ record, portfolioClass: "early" })),
  ...(startups.institutional || []).map(record => ({ record, portfolioClass: "consumer" })),
];
const startupAliases = new Map();
for (const entry of startupUniverse) {
  [entry.record?.canonicalId, entry.record?.domain, entry.record?.name].map(normalize).filter(Boolean)
    .forEach(alias => startupAliases.set(alias, entry));
}
const matchedStartup = (name, company) => [
  company?.portfolioReference?.canonicalId,
  company?.portfolioReference?.name,
  company?.domain,
  name,
].map(normalize).filter(Boolean).map(alias => startupAliases.get(alias)).find(Boolean) || null;

// companies.json is the authoritative universe because its daily builder
// already merges the tracked roster and discovered startup portfolios.
const universe = [];
const companyAliases = new Set();
for (const [name, company] of Object.entries(companyMap)) {
  const startupEntry = matchedStartup(name, company);
  universe.push({
    name,
    company,
    seed: startupEntry?.record || null,
    portfolioClass: startupEntry?.portfolioClass || "tracked",
    isTracked: !startupEntry,
  });
  [name, company?.portfolioReference?.canonicalId, company?.domain].map(normalize).filter(Boolean)
    .forEach(alias => companyAliases.add(alias));
}
for (const entry of startupUniverse) {
  const aliases = [entry.record?.canonicalId, entry.record?.domain, entry.record?.name].map(normalize).filter(Boolean);
  if (aliases.some(alias => companyAliases.has(alias))) continue;
  universe.push({ name: entry.record.name, company: null, seed: entry.record, portfolioClass: entry.portfolioClass, isTracked: false });
}

const seen = new Set();
const records = [];
for (const { name, company, seed, portfolioClass, isTracked } of universe) {
  const key = normalize(company?.portfolioReference?.canonicalId || seed?.canonicalId || seed?.domain || name);
  const urls = sourceUrls(name, seed, company);
  if (!key || seen.has(key) || !urls.length) continue;
  seen.add(key);

  const actions = actionCandidates(name, seed, company);
  const latest = newest(actions);
  const latestAge = ageDays(latest?.date);
  const category = categoryFor(seed, company);
  const categoryTier = category?.tier || "감시";
  const isAcquired = acquired(seed);
  const stage = roundStage(seed, company, isTracked);
  const earlyRound = /(?:pre.?seed|seed|시드|series\s*[ab]|시리즈\s*[ab]|초기)/i.test(stage);
  const fit = categoryTier === "직결" ? 5 : categoryTier === "제휴" ? 4 : 3;
  const currentBusiness = businessSummary(seed, company);
  const profile = company?.profile || seed?.profile || {};
  const organization = company?.organization || seed?.organization || {};
  const officialSourceCount = urls.filter(url => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      const officialUrl = profile.officialWebsite || company?.strategyProfile?.sourceUrls?.[0] || `https://${seed?.domain || "invalid.local"}`;
      const official = new URL(officialUrl).hostname.replace(/^www\./, "");
      return host === official || host.endsWith(`.${official}`);
    } catch { return false; }
  }).length;
  const product = clamp(2 + (currentBusiness ? 1 : 0) + (latest?.url ? 1 : 0)
    + ((organization.executiveTeam || []).length ? 1 : 0));
  const commercial = clamp(2 + (revenueSummary(seed, company) !== "미공개" ? 1 : 0)
    + (currentBusiness ? 1 : 0) + ((profile.business || []).length > 1 ? 1 : 0));
  const feasibility = isAcquired || isTracked ? 1
    : /(?:seed|시드|pre.?seed|series\s*a|시리즈\s*a)/i.test(stage) ? 5
      : /(?:series\s*b|시리즈\s*b)/i.test(stage) ? 4
        : portfolioClass === "early" || portfolioClass === "consumer" ? 3 : 2;
  const information = clamp(Math.ceil(urls.length / 3)
    + (company?.coverage?.profile?.score >= 60 ? 1 : 0) + (officialSourceCount > 0 ? 1 : 0));
  const dimensions = {
    strategicFit: fit,
    productReadiness: product,
    commercialReadiness: commercial,
    transactionFeasibility: feasibility,
    informationReadiness: information,
  };
  const score = Math.round((fit * 30 + product * 20 + commercial * 20 + feasibility * 20 + information * 10) / 5);
  const recommendation = isTracked
    ? (fit >= 4 ? "파트너십" : "관찰")
    : !isAcquired && earlyRound && fit >= 4 && feasibility >= 4
      ? "M&A 검토"
      : fit >= 4 ? "파트너십"
        : !isAcquired && portfolioClass === "early" && product >= 4 ? "전략 투자" : "관찰";
  const risk = isAcquired ? "기존 소유구조로 인수 대상 제외"
    : isTracked ? "인수보다 제품·유통·기술 제휴 조건 우선 검토"
      : !/(?:\$|€|£|₩|series|시리즈|seed|시드)/i.test(stage) ? "가격·지분 조건 추가 확인"
        : portfolioClass === "growth" ? "거래 규모·독점 조건 우선 확인" : "제품 유지율·핵심 인재 잔류 확인";
  const checkedAt = text(company?.updatedAt || company?.coverage?.checkedAt || company?.strategyProfile?.checkedAt || startups.generatedAt);

  records.push({
    id: company?.portfolioReference?.canonicalId || seed?.canonicalId || slug(name),
    name: text(name),
    domain: text(seed?.domain || company?.domain || profile.officialWebsite),
    vertical: text(seed?.vertical || company?.strategyProfile?.classification?.vertical || category?.ko || "AI 소프트웨어·서비스"),
    categoryId: category?.id || "other",
    category: text(category?.ko || seed?.vertical || company?.strategyProfile?.classification?.vertical || "기타"),
    categoryTier,
    portfolioClass,
    discoveryMode: isTracked ? "tracked-company" : company ? "portfolio+company-profile" : "portfolio-ledger",
    recommendation,
    score,
    dimensions,
    companySummary: currentBusiness,
    routeReason: routeSummary(seed, company, latest),
    businessAssessment: {
      currentBusiness,
      revenueModel: revenueSummary(seed, company),
      strategicDirection: strategySummary(seed, company, latest),
    },
    transaction: {
      stage,
      valuation: text(seed?.val || "미공개"),
      funding: text(seed?.funding || "미공개"),
      status: isAcquired ? "existing-owner" : isTracked ? "strategic-partner-only" : "screening",
    },
    companyFacts: {
      founded: text(profile.founded),
      headquarters: text(profile.hq),
      headcount: text(seed?.headcount || profile.headcount || company?.employees),
      leadership: (organization.executiveTeam || []).slice(0, 3).map(person => ({
        name: text(person.name), role: text(person.role),
        url: https(person.profileUrl || person.li) ? (person.profileUrl || person.li) : "",
      })),
      products: (profile.business || []).map(text).filter(Boolean).slice(0, 4),
    },
    latestAction: latest,
    freshness: {
      latestEvidenceDate: latest?.date || "",
      profileCheckedAt: checkedAt,
      ageDays: latestAge,
      status: latestAge === null ? "unknown" : latestAge <= 30 ? "fresh" : latestAge <= 90 ? "monitor" : "stale",
    },
    evidenceStats: {
      sourceCount: urls.length,
      officialSourceCount,
      recentActionCount: actions.filter(item => (ageDays(item.date) ?? 9999) <= 90).length,
    },
    risk,
    sourceUrls: urls.slice(0, 14),
  });
}

const routeRank = { "M&A 검토": 4, "파트너십": 3, "전략 투자": 2, "관찰": 1 };
records.sort((left, right) => right.score - left.score
  || (routeRank[right.recommendation] || 0) - (routeRank[left.recommendation] || 0)
  || String(right.freshness.latestEvidenceDate).localeCompare(String(left.freshness.latestEvidenceDate))
  || left.name.localeCompare(right.name));

// Preserve route diversity, then fill by score. The UI progressively reveals
// every shortlisted row instead of hard-coding a 12-card ceiling.
const shortlistSeed = [
  ...records.filter(record => record.recommendation === "M&A 검토").slice(0, 14),
  ...records.filter(record => record.recommendation === "파트너십").slice(0, 14),
  ...records.filter(record => record.recommendation === "전략 투자").slice(0, 8),
];
const shortlistIds = new Set(shortlistSeed.map(record => record.id));
const shortlist = [
  ...shortlistSeed,
  ...records.filter(record => record.recommendation !== "관찰" && !shortlistIds.has(record.id)),
].slice(0, 40).sort((left, right) => right.score - left.score
  || String(right.freshness.latestEvidenceDate).localeCompare(String(left.freshness.latestEvidenceDate))
  || left.name.localeCompare(right.name));

const previousById = new Map((previous.records || []).map(record => [record.id, record]));
const added = records.filter(record => !previousById.has(record.id)).length;
const updated = records.filter(record => {
  const old = previousById.get(record.id);
  return old && (old.freshness?.latestEvidenceDate !== record.freshness.latestEvidenceDate
    || old.businessAssessment?.strategicDirection !== record.businessAssessment.strategicDirection
    || old.categoryId !== record.categoryId || old.recommendation !== record.recommendation
    || old.sourceUrls?.length !== record.sourceUrls.length);
}).length;
const output = {
  schemaVersion: 2,
  generatedAt,
  methodology: "기업·스타트업·최근 기사 DB를 전략 적합성 30 · 제품 준비도 20 · 수익화 준비도 20 · 거래 실행성 20 · 정보 완성도 10으로 매 실행마다 재평가",
  disclosurePolicy: "공개되지 않은 가격·지분·거래 조건은 미공개 유지하며 기존 대형사는 인수 후보가 아닌 제휴 대상으로 분리",
  discoveryPolicy: "startups.json + companies.json + company-news.json을 회사 식별자로 통합하고 최신 원문·공식 프로필 변경을 자동 반영",
  metrics: {
    universe: records.length,
    shortlist: shortlist.length,
    acquisition: records.filter(record => record.recommendation === "M&A 검토").length,
    partnership: records.filter(record => record.recommendation === "파트너십").length,
    investment: records.filter(record => record.recommendation === "전략 투자").length,
    fresh90Days: records.filter(record => Number.isFinite(record.freshness.ageDays) && record.freshness.ageDays <= 90).length,
    addedSincePreviousBuild: added,
    updatedSincePreviousBuild: updated,
    sourceInputs: {
      startupLedger: startupUniverse.length,
      companyProfiles: Object.keys(companyMap).length,
      companyNewsStreams: Object.keys(companyNews).length,
    },
  },
  shortlist,
  records,
};

await writeFile("partner-ma-candidates.json", `${JSON.stringify(output)}\n`);
console.log(`[partner-ma] ${records.length} candidates · +${added} new · ${updated} refreshed · ${output.metrics.acquisition} acquisition · ${output.metrics.partnership} partner · top ${shortlist.length}`);
