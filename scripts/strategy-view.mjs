/** Build the strategy page from verified cumulative datasets, never JSX facts. */

const text = value => String(value || "").replace(/\s+/g, " ").trim();
const firstSentence = value => {
  const normalized = text(value);
  const stop = normalized.search(/[.!?。]\s/);
  return stop > 40 ? normalized.slice(0, stop + 1) : normalized;
};
const evidenceUrl = item => /^https?:\/\//i.test(String(item?.url || ""));
const scoreOf = item => Number(item?.scoreValue ?? item?.opportunityScore ?? item?.signalScore ?? 0);
const confidenceRank = value => ({ high: 3, medium: 2, low: 1 }[String(value || "").toLowerCase()] || 0);
const comparePriority = (left, right) =>
  scoreOf(right) - scoreOf(left)
  || confidenceRank(right.evidenceConfidence) - confidenceRank(left.evidenceConfidence)
  || Number(right.signalScore || 0) - Number(left.signalScore || 0)
  || Number(right.independentSources || 0) - Number(left.independentSources || 0)
  || Number(right.evidenceCount || 0) - Number(left.evidenceCount || 0)
  || text(left.title).localeCompare(text(right.title));

const compactOpportunity = (item, index) => {
  const evidence = (item.evidence || []).filter(evidenceUrl);
  const independentSources = Number(item.independentSources || 0);
  const evidenceCount = Number(item.evidenceCount || evidence.length);
  const nextDecision = String(item.experimentPlan?.nextDecisionAt || "").slice(0, 10);
  const scorecard = (item.scorecard || [])
    .filter(row => row?.label && Number.isFinite(Number(row.weightedPoints)))
    .map(row => ({
      dimension: row.dimension,
      label: text(row.label),
      weight: Number(row.weight || 0),
      rating: Number(row.rating || 0),
      weightedPoints: Number(row.weightedPoints || 0),
    }));
  return {
    id: item.id || `generated-opportunity-${index + 1}`,
    sourceOpportunityId: item.id || `generated-opportunity-${index + 1}`,
    title: text(item.title),
    scoreValue: scoreOf(item),
    signalScore: Number(item.signalScore || 0),
    scoreDelta: item.scoreDelta !== null && item.scoreDelta !== undefined && Number.isFinite(Number(item.scoreDelta))
      ? Number(item.scoreDelta)
      : null,
    trend: text(item.trend || "flat"),
    evidenceConfidence: text(item.evidenceConfidence || "low"),
    evidenceCount,
    independentSources,
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
    scorecard,
    priorityDrivers: [...scorecard]
      .sort((left, right) => right.weightedPoints - left.weightedPoints || right.weight - left.weight)
      .slice(0, 3)
      .map(row => ({ label: row.label, points: row.weightedPoints, weight: row.weight })),
    evidence: evidence.slice(0, 6),
    generatedAt: item.generatedAt || "",
  };
};

// Rank every decision-eligible candidate with the same deterministic rule.
// No business theme or company receives a reserved slot in the public view.
const selectOpportunityPortfolio = (opportunities, limit = 12) =>
  [...opportunities].sort(comparePriority).slice(0, limit);

export function buildStrategyView({ generatedAt, framework, articles, opportunityDb }) {
  const generatedOpportunities = (opportunityDb?.generatedOpportunities || [])
    .filter(item => item?.decisionEligible !== false && ["verified", "reviewed", "published"].includes(item?.workflow?.stage || item?.status) && item?.evidenceConfidence !== "low")
    .filter(item => (item.evidence || []).some(evidenceUrl))
    .sort(comparePriority)
    .map(compactOpportunity);
  const opportunityPortfolio = selectOpportunityPortfolio(generatedOpportunities, 12);
  const generationPolicy = opportunityDb?.opportunityGeneration || {};
  const publicationGate = generationPolicy.publicationGate || {};
  const scoreCriteria = (opportunityPortfolio[0]?.scorecard || [])
    .map(row => ({ dimension: row.dimension, label: row.label, weight: row.weight }));
  const priorityItems = opportunityPortfolio.slice(0, 4).map((item, index) => ({
    rank: index + 1,
    sourceOpportunityId: item.sourceOpportunityId,
    title: item.title,
    score: item.scoreValue,
    signalScore: item.signalScore,
    scoreDelta: item.scoreDelta,
    trend: item.trend,
    confidence: item.evidenceConfidence,
    evidenceCount: item.evidenceCount,
    independentSources: item.independentSources,
    action: item.offer,
    drivers: item.priorityDrivers,
  }));

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

  const workloadMap = opportunityPortfolio.slice(0, 7).map((item, index) => ({
    no: `0${index + 1}`,
    workload: item.title,
    shift: item.customer,
    bottleneck: item.thesis,
    platform: item.ownAssets.join(" · "),
    opportunity: item.offer,
    proof: item.gate,
  }));
  const evidenceTotal = priorityItems.reduce((sum, item) => sum + item.evidenceCount, 0);
  const averageScore = priorityItems.length
    ? (priorityItems.reduce((sum, item) => sum + item.score, 0) / priorityItems.length).toFixed(1)
    : "0.0";

  return {
    generatedAt,
    schemaVersion: 2,
    sourceMode: "generated-from-verified-ledgers",
    northStar: priorityItems.length
      ? `검증 적격 ${generatedOpportunities.length}개 후보 중 상위 ${priorityItems.length}개 · 평균 ${averageScore}점 · 근거 ${evidenceTotal}건`
      : "검증된 근거가 확보될 때까지 전략 후보 공개 보류",
    decisionOutputs: framework?.decisionOutputs || [],
    capabilities: framework?.capabilities || [],
    priorityFramework: {
      label: "EVIDENCE-WEIGHTED PRIORITY",
      method: generationPolicy.scorer || "deterministic-evidence-weighted",
      rubricVersion: generationPolicy.rubricVersion || "",
      rankingOrder: ["opportunityScore", "evidenceConfidence", "signalScore", "independentSources", "evidenceCount"],
      eligibilityGate: {
        minimumEvidenceUnits: Number(publicationGate.minimumEvidenceUnits || 0),
        minimumIndependentSources: Number(publicationGate.minimumIndependentSources || 0),
        minimumOpportunityScore: Number(publicationGate.minimumOpportunityScore || 0),
      },
      criteria: scoreCriteria,
      candidateCount: generatedOpportunities.length,
      items: priorityItems,
      refreshedAt: generatedAt,
    },
    workloadMap,
    opportunityPortfolio,
    expertSignals,
    lineage: {
      opportunities: opportunityPortfolio.length,
      eligibleOpportunities: generatedOpportunities.length,
      articles: expertSignals.length,
      generatedFrom: ["news.json", "mobile-ai-business-view.json", "config/dashboard-taxonomy.json"],
    },
  };
}
