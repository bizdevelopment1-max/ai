/** Build the strategy page from verified cumulative datasets, never JSX facts. */

const text = value => String(value || "").replace(/\s+/g, " ").trim();
const firstSentence = value => {
  const normalized = text(value);
  const stop = normalized.search(/[.!?。]\s/);
  return stop > 40 ? normalized.slice(0, stop + 1) : normalized;
};
const evidenceUrl = item => /^https?:\/\//i.test(String(item?.url || ""));
const scoreOf = item => Number(item?.opportunityScore || item?.signalScore || 0);

const compactOpportunity = (item, index) => {
  const evidence = (item.evidence || []).filter(evidenceUrl);
  const independentSources = Number(item.independentSources || 0);
  const evidenceCount = Number(item.evidenceCount || evidence.length);
  const nextDecision = String(item.experimentPlan?.nextDecisionAt || "").slice(0, 10);
  return {
    id: item.id || `generated-opportunity-${index + 1}`,
    sourceOpportunityId: item.id || `generated-opportunity-${index + 1}`,
    title: text(item.title),
    horizon: scoreOf(item) >= 85 ? "H1 · NOW" : scoreOf(item) >= 72 ? "H2 · NEXT" : "H3 · WATCH",
    score: `${scoreOf(item)}/100`,
    customer: text(item.experimentPlan?.targetUsers || item.ownerOrg || "검증 대상 사용자군"),
    thesis: firstSentence(item.reason || item.experimentPlan?.hypothesis),
    offer: [item.actionOption, ...(item.revenueModels || [])].filter(Boolean).join(" · "),
    gate: [
      independentSources ? `독립 출처 ${independentSources}개` : "",
      evidenceCount ? `근거 ${evidenceCount}건` : "",
      nextDecision ? `다음 판단 ${nextDecision}` : "",
    ].filter(Boolean).join(" · "),
    ownAssets: (item.ownAssets || []).filter(Boolean),
    nextMetrics: [
      { label: "OPPORTUNITY", value: `${scoreOf(item)}/100`, status: "verified" },
      { label: "EVIDENCE", value: `${evidenceCount}건`, status: evidenceCount >= 5 ? "verified" : "review" },
      { label: "INDEPENDENT", value: `${independentSources}개`, status: independentSources >= 2 ? "verified" : "review" },
    ],
    evidence: evidence.slice(0, 6),
    generatedAt: item.generatedAt || "",
  };
};

// These are decision-portfolio buckets, not business facts. Each bucket is
// populated only when the cumulative opportunity ledger contains a published,
// source-backed candidate. This keeps strategically distinct lower-scoring
// themes visible without pinning any claim, score or company to the UI.
const PORTFOLIO_COVERAGE = [
  { id: "on-device-trust-security", sourceIds: ["financial-trust-api", "secure-enterprise-agent"] },
  { id: "clinical-health-ai", sourceIds: ["health-intelligence"] },
  { id: "companion-distribution", sourceIds: ["companion-distribution"] },
];

const selectOpportunityPortfolio = (opportunities, limit = 12) => {
  const selected = [];
  const usedSourceIds = new Set();
  PORTFOLIO_COVERAGE.forEach(bucket => {
    const match = bucket.sourceIds
      .map(id => opportunities.find(item => item.sourceOpportunityId === id))
      .find(Boolean);
    if (!match) return;
    selected.push({ ...match, id: bucket.id, portfolioBucket: bucket.id });
    usedSourceIds.add(match.sourceOpportunityId);
  });
  opportunities.forEach(item => {
    if (selected.length >= limit || usedSourceIds.has(item.sourceOpportunityId)) return;
    selected.push(item);
    usedSourceIds.add(item.sourceOpportunityId);
  });
  return selected.slice(0, limit);
};

const companyAccount = (base, company) => {
  const intelligence = company?.intelligence || {};
  const current = intelligence.currentBusiness || {};
  const direction = intelligence.strategyDirection || {};
  const revenue = intelligence.revenueModel || {};
  const official = (current.evidence || []).find(evidenceUrl);
  if (!official || current.groundingStatus !== "source-grounded") return null;
  const profileBusiness = Array.isArray(company?.profile?.business) ? company.profile.business.join(" · ") : "";
  const latest = company?.latest || {};
  const mentions30 = Number(company?.mentions30 || 0);
  return {
    name: base.name,
    relation: "SOURCE-GROUNDED",
    tier: text(base.group || base.cat || "tracked company").toUpperCase(),
    platform: firstSentence(current.summary || profileBusiness || base.unit),
    demand: firstSentence(latest.title || profileBusiness || current.summary),
    signal: firstSentence(direction.summary || latest.title || current.summary),
    pain: firstSentence(revenue.summary || direction.details?.[0] || "공개 근거와 실제 이용·수익 지표의 간극 검증"),
    move: firstSentence(direction.summary || intelligence.investmentDirection?.summary || current.summary),
    gate: `${mentions30}건의 최근 30일 연결 근거 · ${current.evidenceCount || current.evidence?.length || 1}건 직접 근거`,
    source: text(official.source || official.title || "Official source"),
    sourceDate: text(official.date || company.updatedAt || "").slice(0, 10),
    sourceUrl: official.url,
    mentions30,
  };
};

export function buildStrategyView({ generatedAt, framework, registry, companies, articles, opportunityDb }) {
  const generatedOpportunities = (opportunityDb?.generatedOpportunities || [])
    .filter(item => item?.decisionEligible !== false && ["verified", "reviewed", "published"].includes(item?.workflow?.stage || item?.status) && item?.evidenceConfidence !== "low")
    .filter(item => (item.evidence || []).some(evidenceUrl))
    .sort((left, right) => scoreOf(right) - scoreOf(left))
    .map(compactOpportunity);
  const opportunityPortfolio = selectOpportunityPortfolio(generatedOpportunities, 12);

  const accountPortfolio = (registry || [])
    .map(base => companyAccount(base, companies?.[base.name]))
    .filter(Boolean)
    .sort((left, right) => right.mentions30 - left.mentions30 || left.name.localeCompare(right.name))
    .slice(0, 8);

  const sourceSeen = new Set();
  const expertSignals = [...(articles || [])]
    .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")))
    .filter(article => {
      const key = text(article.source).toLowerCase();
      if (!evidenceUrl(article) || !key || sourceSeen.has(key)) return false;
      sourceSeen.add(key);
      return true;
    })
    .slice(0, 10)
    .map(article => ({
      lens: text(article.tag || article.cat || "EVIDENCE").toUpperCase(),
      source: text(article.source),
      date: text(article.date),
      title: text(article.titleKo || article.title),
      implication: firstSentence(article.summaryLinesKo?.[0] || article.summary),
      url: article.url,
    }));

  const choices = opportunityPortfolio.slice(0, 4).map((item, index) => ({
    no: `0${index + 1}`,
    title: item.title,
    where: item.ownAssets.join(" · ") || item.customer,
    win: item.thesis,
    kpi: item.nextMetrics.map(metric => `${metric.label} ${metric.value}`).join(" · "),
  }));
  const workloadMap = opportunityPortfolio.slice(0, 7).map((item, index) => ({
    no: `0${index + 1}`,
    workload: item.title,
    shift: item.customer,
    bottleneck: item.thesis,
    platform: item.ownAssets.join(" · "),
    opportunity: item.offer,
    proof: item.gate,
  }));
  const evidenceTotal = opportunityPortfolio.reduce((sum, item) => sum + Number(item.nextMetrics[1]?.value?.replace(/\D/g, "") || 0), 0);

  return {
    generatedAt,
    schemaVersion: 1,
    sourceMode: "generated-from-verified-ledgers",
    northStar: opportunityPortfolio.length
      ? `${opportunityPortfolio.slice(0, 3).map(item => item.title).join(" · ")} — ${evidenceTotal}건 근거로 우선순위 자동 갱신`
      : "검증된 근거가 확보될 때까지 전략 후보 공개 보류",
    accountScope: `${accountPortfolio.length}개 기업의 공식·원문 근거와 최근 30일 신호를 동일 기준으로 비교`,
    operatingModel: framework?.operatingModel || [],
    decisionOutputs: framework?.decisionOutputs || [],
    capabilities: framework?.capabilities || [],
    horizons: framework?.horizons || [],
    choices,
    workloadMap,
    accountPortfolio,
    opportunityPortfolio,
    expertSignals,
    lineage: {
      companies: accountPortfolio.length,
      opportunities: opportunityPortfolio.length,
      articles: expertSignals.length,
      generatedFrom: ["companies.json", "news.json", "mobile-ai-business-view.json", "config/dashboard-taxonomy.json"],
    },
  };
}
