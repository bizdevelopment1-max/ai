#!/usr/bin/env node
/**
 * Source-linked startup records -> partner / investment / acquisition candidates.
 *
 * The ranking is deterministic. It never invents a valuation, transaction,
 * buyer or investment amount. Missing deal terms remain undisclosed and every
 * candidate retains at least one reader-followable source URL.
 */
import { readFile, writeFile } from "node:fs/promises";

const [startups, taxonomy] = await Promise.all([
  readFile("startups.json", "utf8").then(JSON.parse),
  readFile("config/dashboard-taxonomy.json", "utf8").then(JSON.parse),
]);

const banned = /삼성|samsung|갤럭시|galaxy|\bMX\b|휴대폰/gi;
const text = value => String(value || "").replace(banned, "단말 사업").replace(/\s+/g, " ").trim();
const slug = value => text(value).toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "");
const https = value => /^https:\/\//i.test(String(value || ""));
const clamp = value => Math.max(1, Math.min(5, Math.round(Number(value) || 1)));
const taxonomyRows = taxonomy.STARTUP_TAXONOMY || [];
const taxonomyById = new Map(taxonomyRows.map(item => [item.id, item]));
const sourceUrls = record => [...new Set([
  record.profile?.officialWebsite,
  ...(record.profile?.sourceUrls || []),
  record.latest?.url,
  ...(record.history || []).map(item => item?.url),
  ...(record.sourceLinks || []).map(item => item?.url),
  record.institution?.url,
].filter(https))];
const acquired = record => /(?:인수|산하|acquired|subsidiary|owned by)/i.test([
  record.stage, record.funding, record.val, record.overview, record.description,
].filter(Boolean).join(" "));
const roundStage = record => text(record.stage || record.funding || record.val || "조건 미공개");
const businessSummary = record => text(
  record.currentBusiness || record.businessModel || record.overview || record.description
  || record.profile?.business?.[0] || record.vertical,
);
const routeSummary = record => text(record.acqAngle || record.partnership || record.label || "사업 연계성 검토");
const categoryFor = record => {
  if (record.cat && taxonomyById.has(record.cat)) return taxonomyById.get(record.cat);
  const haystack = `${record.vertical || ""} ${businessSummary(record)}`.toLowerCase();
  return taxonomyRows.find(item => (item.match || []).some(term => haystack.includes(String(term).toLowerCase()))) || null;
};
const identity = record => text(record.canonicalId || record.domain || record.name).toLowerCase();

const universe = [
  ...(startups.large || []).map(record => ({ record, portfolioClass: "growth" })),
  ...(startups.small || []).map(record => ({ record, portfolioClass: "early" })),
  ...(startups.institutional || []).map(record => ({ record, portfolioClass: "consumer" })),
];
const seen = new Set();
const records = [];

for (const { record, portfolioClass } of universe) {
  const key = identity(record);
  const urls = sourceUrls(record);
  if (!key || seen.has(key) || !urls.length) continue;
  seen.add(key);

  const category = categoryFor(record);
  const categoryTier = category?.tier || "감시";
  const isAcquired = acquired(record);
  const stage = roundStage(record);
  const earlyRound = /(?:pre.?seed|seed|시드|series\s*[ab]|시리즈\s*[ab]|초기)/i.test(stage);
  const fit = categoryTier === "직결" ? 5 : categoryTier === "제휴" ? 4 : 3;
  const product = clamp(2
    + (businessSummary(record) ? 1 : 0)
    + (record.latest?.url ? 1 : 0)
    + ((record.organization?.executiveTeam || []).length ? 1 : 0));
  const commercial = clamp(2
    + (text(record.revenue || record.revenueModel) ? 1 : 0)
    + (text(record.businessModel || record.currentBusiness) ? 1 : 0)
    + (record.profile?.business?.length > 1 ? 1 : 0));
  const feasibility = isAcquired ? 1
    : /(?:seed|시드|pre.?seed|series\s*a|시리즈\s*a)/i.test(stage) ? 5
      : /(?:series\s*b|시리즈\s*b)/i.test(stage) ? 4
        : portfolioClass === "early" ? 3
          : portfolioClass === "consumer" ? 3 : 2;
  const information = clamp(Math.ceil(urls.length / 2) + (record.coverage?.profile?.score >= 60 ? 1 : 0));
  const dimensions = {
    strategicFit: fit,
    productReadiness: product,
    commercialReadiness: commercial,
    transactionFeasibility: feasibility,
    informationReadiness: information,
  };
  const score = Math.round((fit * 30 + product * 20 + commercial * 20 + feasibility * 20 + information * 10) / 5);
  const recommendation = !isAcquired && earlyRound && fit >= 4 && feasibility >= 4
    ? "M&A 검토"
    : fit >= 4 ? "파트너십"
      : !isAcquired && portfolioClass === "early" && product >= 4 ? "전략 투자" : "관찰";
  const routeReason = routeSummary(record);
  const profile = record.profile || {};
  const latestTitle = text(record.latest?.localization?.title || record.latest?.title);
  const risk = isAcquired ? "기존 소유구조로 인수 대상 제외"
    : !/(?:\$|€|£|₩|series|시리즈|seed|시드)/i.test(stage) ? "가격·지분 조건 추가 확인"
      : portfolioClass === "growth" ? "거래 규모·독점 조건 우선 확인" : "제품 유지율·핵심 인재 잔류 확인";

  records.push({
    id: record.canonicalId || slug(record.name),
    name: text(record.name),
    domain: text(record.domain),
    vertical: text(record.vertical || category?.ko || "AI 소프트웨어·서비스"),
    categoryId: category?.id || "other",
    category: text(category?.ko || record.vertical || "기타"),
    categoryTier,
    portfolioClass,
    recommendation,
    score,
    dimensions,
    companySummary: businessSummary(record),
    routeReason,
    businessAssessment: {
      currentBusiness: businessSummary(record),
      revenueModel: text(record.revenueModel || record.revenue || "미공개"),
      strategicDirection: text(record.strategyDirection || record.direction
        || record.latest?.localization?.summaryLines?.[0] || record.latest?.title || "최근 실행 추가 확인"),
    },
    transaction: {
      stage,
      valuation: text(record.val || "미공개"),
      funding: text(record.funding || "미공개"),
      status: isAcquired ? "existing-owner" : "screening",
    },
    companyFacts: {
      founded: text(profile.founded),
      headquarters: text(profile.hq),
      headcount: text(record.headcount || profile.headcount),
      leadership: (record.organization?.executiveTeam || []).slice(0, 3).map(person => ({
        name: text(person.name), role: text(person.role), url: https(person.profileUrl) ? person.profileUrl : "",
      })),
      products: (profile.business || []).map(text).filter(Boolean).slice(0, 4),
    },
    latestAction: latestTitle ? { title: latestTitle, date: text(record.latest?.date), url: record.latest?.url } : null,
    risk,
    sourceUrls: urls.slice(0, 8),
  });
}

records.sort((left, right) => right.score - left.score
  || ({ "M&A 검토": 4, "파트너십": 3, "전략 투자": 2, "관찰": 1 }[right.recommendation] || 0)
    - ({ "M&A 검토": 4, "파트너십": 3, "전략 투자": 2, "관찰": 1 }[left.recommendation] || 0)
  || left.name.localeCompare(right.name));

// Preserve route diversity in the executive shortlist. A single route must
// not crowd out viable partnership or investment options merely because an
// early-stage funding label adds transaction-feasibility points.
const shortlistSeed = [
  ...records.filter(record => record.recommendation === "M&A 검토").slice(0, 10),
  ...records.filter(record => record.recommendation === "파트너십").slice(0, 8),
  ...records.filter(record => record.recommendation === "전략 투자").slice(0, 4),
];
const shortlistIds = new Set(shortlistSeed.map(record => record.id));
const shortlist = [
  ...shortlistSeed,
  ...records.filter(record => record.recommendation !== "관찰" && !shortlistIds.has(record.id)),
].slice(0, 24).sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  methodology: "현재 기업 DB를 전략 적합성 30 · 제품 준비도 20 · 수익화 준비도 20 · 거래 실행성 20 · 정보 완성도 10으로 동일 평가",
  disclosurePolicy: "공개되지 않은 가격·지분·거래 조건은 미공개 유지",
  metrics: {
    universe: records.length,
    shortlist: shortlist.length,
    acquisition: records.filter(record => record.recommendation === "M&A 검토").length,
    partnership: records.filter(record => record.recommendation === "파트너십").length,
    investment: records.filter(record => record.recommendation === "전략 투자").length,
  },
  shortlist,
  records,
};

await writeFile("partner-ma-candidates.json", `${JSON.stringify(output)}\n`);
console.log(`[partner-ma] ${records.length} candidates · ${output.metrics.acquisition} acquisition · ${output.metrics.partnership} partner · top ${shortlist.length}`);
