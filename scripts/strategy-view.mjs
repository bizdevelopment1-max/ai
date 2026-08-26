/** Build the strategy page from verified cumulative datasets, never JSX facts. */

const text = value => String(value || "").replace(/\s+/g, " ").trim();
const firstSentence = value => {
  const normalized = text(value);
  const stop = normalized.search(/[.!?。]\s/);
  return stop > 40 ? normalized.slice(0, stop + 1) : normalized;
};
// Public evidence cards accept only transport-secured source links. Records
// with an unresolved or HTTP-only URL remain in their upstream ledger but do
// not enter the materialized strategy view.
const evidenceUrl = item => /^https:\/\//i.test(String(item?.url || ""));
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
  const priorityDrivers = [...scorecard]
    .sort((left, right) => right.weightedPoints - left.weightedPoints || right.weight - left.weight)
    .slice(0, 3)
    .map(row => ({ label: row.label, points: row.weightedPoints, weight: row.weight }));
  const hypothesis = text(item.experimentPlan?.hypothesis || "");
  const conciseHypothesis = firstSentence(hypothesis
    .replace(text(item.title), "")
    .replace(/^이\s*/, "")) || "핵심 과업 완료율·반복 사용 검증";
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
    score: `${scoreOf(item)}/100`,
    customer: text(item.experimentPlan?.targetUsers || item.ownerOrg || "검증 대상 사용자군"),
    thesis: conciseHypothesis,
    offer: [item.actionOption, ...(item.revenueModels || [])].filter(Boolean).join(" · "),
    decision: [
      ...priorityDrivers.map(driver => `${driver.label} ${driver.points}`),
      nextDecision ? `다음 판단 ${nextDecision}` : "",
    ].filter(Boolean).join(" · "),
    ownAssets: (item.ownAssets || []).filter(Boolean),
    scorecard,
    priorityDrivers,
    evidence: evidence.slice(0, 6),
    generatedAt: item.generatedAt || "",
  };
};

// Rank every decision-eligible candidate with the same deterministic rule.
// No business theme or company receives a reserved slot in the public view.
const selectOpportunityPortfolio = (opportunities, limit = 12) =>
  [...opportunities].sort(comparePriority).slice(0, limit);

export const buildConsultingNavigation = architecture => (architecture?.workstreams || [])
  .slice()
  .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
  .flatMap(workstream => (workstream.sections || []).map(section => ({
    id: section.id,
    ko: text(section.label),
    en: text(section.labelEn),
    icon: text(section.icon || "grid"),
    group: `${String(workstream.order || "").padStart(2, "0")} · ${text(workstream.label)}`,
    groupId: workstream.id,
    question: text(section.question),
    output: text(section.output),
    children: (section.children || []).map(child => ({ key: child.key, ko: text(child.label) })),
  })));

const buildConsultingModel = ({ architecture, sourceStats, priorityItems, generatedAt }) => {
  const stats = sourceStats || {};
  const workstreams = (architecture?.workstreams || [])
    .slice()
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .map(workstream => {
      const sections = (workstream.sections || []).map(section => {
        const metric = stats[section.id] || {};
        return {
          id: section.id,
          label: text(section.label),
          labelEn: text(section.labelEn),
          question: text(section.question),
          output: text(section.output),
          recordCount: Number(metric.recordCount || 0),
          currentCount: Number(metric.currentCount ?? metric.recordCount ?? 0),
          sourceTimestamp: text(metric.sourceTimestamp),
          ageHours: Number.isFinite(Number(metric.ageHours)) ? Number(metric.ageHours) : null,
          status: text(metric.status || (Number(metric.recordCount || 0) ? "current" : "empty")),
        };
      });
      const totalRecords = sections.reduce((sum, section) => sum + section.recordCount, 0);
      const currentSections = sections.filter(section => section.status === "current").length;
      return {
        id: workstream.id,
        order: Number(workstream.order || 0),
        label: text(workstream.label),
        labelEn: text(workstream.labelEn),
        question: text(workstream.question),
        output: text(workstream.output),
        gate: text(workstream.gate),
        sections,
        totalRecords,
        currentSections,
        sectionCount: sections.length,
        status: totalRecords === 0 ? "empty" : currentSections === sections.length ? "current" : "review",
      };
    });
  const sections = workstreams.flatMap(workstream => workstream.sections);
  return {
    methodology: text(architecture?.methodology || "MECE decision architecture"),
    statement: text(architecture?.statement),
    workstreams,
    navigation: buildConsultingNavigation(architecture),
    coverage: {
      workstreams: workstreams.length,
      sections: sections.length,
      currentSections: sections.filter(section => section.status === "current").length,
      records: sections.reduce((sum, section) => sum + section.recordCount, 0),
      priorityCandidates: priorityItems.length,
    },
    refreshedAt: generatedAt,
  };
};

export function buildStrategyView({ generatedAt, architecture, sourceStats, articles, opportunityDb }) {
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

  const averageScore = priorityItems.length
    ? (priorityItems.reduce((sum, item) => sum + item.score, 0) / priorityItems.length).toFixed(1)
    : "0.0";
  const consultingModel = buildConsultingModel({ architecture, sourceStats, priorityItems, generatedAt });

  return {
    generatedAt,
    schemaVersion: 3,
    sourceMode: "generated-from-verified-ledgers",
    northStar: priorityItems.length
      ? `전체 후보 ${generatedOpportunities.length}개 중 상위 ${priorityItems.length}개 · 평균 ${averageScore}점 · 동일 평가 기준으로 자동 갱신`
      : "평가 기준을 충족한 후보가 생기면 자동 공개",
    priorityFramework: {
      label: "PRIORITY INDEX",
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
    consultingModel,
    opportunityPortfolio,
    expertSignals,
    lineage: {
      opportunities: opportunityPortfolio.length,
      eligibleOpportunities: generatedOpportunities.length,
      articles: expertSignals.length,
      generatedFrom: ["news.json", "mobile-ai-business-view.json", "config/dashboard-taxonomy.json"],
      architecture: "config/consulting-architecture.json",
    },
  };
}
