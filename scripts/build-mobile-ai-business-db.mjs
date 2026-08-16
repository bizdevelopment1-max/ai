#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { sanitizePublicCopy } from "./public-copy.mjs";
import { independentSourceKey, sourceOwnerGroup } from "./source-independence.mjs";

const OUTPUT = "mobile-ai-business-view.json";
const SEED = "config/mx-intelligence-seed.json";
const SOURCE_POLICY = "config/mx-source-policy.json";
const PIPELINE_POLICY = "config/intelligence-pipeline.json";
const OPPORTUNITY_POLICY = "config/opportunity-generation.json";
const DECISION_GOVERNANCE = "config/decision-governance.json";
const DEDUP_CALIBRATION = "config/dedup-calibration.json";
const DAY_MS = 86400000;

const readJson = async (file, fallback = null) => {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) {
    if (fallback !== null) return fallback;
    throw new Error(`${file}: ${error.message}`);
  }
};

const stableHash = value => createHash("sha256")
  .update(JSON.stringify(value))
  .digest("hex")
  .slice(0, 16);

const ageDays = (date, now) => {
  const value = Date.parse(date || "");
  return Number.isFinite(value) ? Math.max(0, Math.floor((now - value) / DAY_MS)) : 9999;
};

const evidenceText = signal => (signal.evidence || [])
  .flatMap(source => source.spans || [])
  .join(" ");

const requiredSignalFields = [
  "id", "name", "product", "entityType", "priority", "decisionAxes",
  "fact", "implication", "decision", "actionOption", "ownerOrg",
  "lastVerifiedAt", "confidence", "workflow", "mxMapping", "scorecard",
  "financials", "evidence",
];

const validateSignal = signal => {
  const issues = [];
  for (const field of requiredSignalFields) {
    const value = signal[field];
    if (value === undefined || value === null || value === "") issues.push(`missing:${field}`);
  }

  const axes = signal.decisionAxes || {};
  for (const field of ["touchpoint", "integration", "posture", "regions", "maturity"]) {
    if (!axes[field] || (Array.isArray(axes[field]) && !axes[field].length)) issues.push(`missing-axis:${field}`);
  }
  if (!["Buy", "Build", "Partner", "Watch", "License"].includes(signal.actionOption)) issues.push("invalid-action-option");
  if (!["제품기획팀", "R&D", "서비스기획", "구매"].includes(signal.ownerOrg)) issues.push("invalid-owner-org");

  const mapping = signal.mxMapping || {};
  for (const field of ["galaxyDifferentiation", "bomImpact", "partnershipHistory", "patentLitigationRisk", "svicPortfolio"]) {
    if (!mapping[field]) issues.push(`missing-mx-mapping:${field}`);
  }

  const spans = (signal.evidence || []).flatMap(source => source.spans || []).filter(Boolean);
  if (spans.length < 3) issues.push("evidence-spans-below-3");
  if ((signal.evidence || []).some(source => !source.url || !source.publisher || !source.publishedAt)) {
    issues.push("incomplete-source-record");
  }

  const independentSources = new Set((signal.evidence || []).map(independentSourceKey).filter(Boolean)).size;
  if (signal.confidence === "high" && independentSources < 2) issues.push("high-confidence-needs-2-independent-sources");
  const sourceText = evidenceText(signal).toLowerCase();
  for (const metric of signal.metrics || []) {
    if (!metric.evidenceLiteral || !sourceText.includes(String(metric.evidenceLiteral).toLowerCase())) {
      issues.push(`numeric-evidence-missing:${metric.label}`);
    }
  }
  return { issues, independentSources, evidenceSpanCount: spans.length };
};

const metricDiffs = (before = [], after = []) => {
  const oldValues = new Map(before.map(metric => [metric.label, metric.value]));
  return after
    .filter(metric => oldValues.has(metric.label) && oldValues.get(metric.label) !== metric.value)
    .map(metric => ({ label: metric.label, before: oldValues.get(metric.label), after: metric.value }));
};

const embeddingVector = (text, dimensions = 384) => {
  const normalized = String(text || "").toLowerCase().replace(/[^a-z0-9가-힣\s]/g, " ").replace(/\s+/g, " ").trim();
  const words = normalized.split(" ").filter(token => token.length > 1);
  const features = [...words, ...words.slice(0, -1).map((word, index) => `${word}_${words[index + 1]}`)];
  const vector = new Float64Array(dimensions);
  for (const feature of features) {
    let hash = 2166136261;
    for (const char of feature) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    vector[Math.abs(hash) % dimensions] += 1;
  }
  return vector;
};

const cosine = (left, right) => {
  let dot = 0; let leftNorm = 0; let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
};

const matchOpportunityPartners = (opportunities = [], picks = []) => opportunities.map(opportunity => {
  const terms = (opportunity.matchTerms || []).map(term => String(term).toLowerCase());
  const partnerMatches = picks.map(pick => {
    const text = [pick.name, pick.vertical, pick.why, pick.partnership, ...(pick.labels || [])].join(" ").toLowerCase();
    const matchedTerms = terms.filter(term => text.includes(term));
    return {
      name: pick.name,
      vertical: pick.vertical,
      region: pick.region,
      radarScore: pick.total,
      matchScore: matchedTerms.length * 20 + Number(pick.total || 0),
      matchedTerms,
      urgent: Boolean(pick.urgent),
      evidence: (pick.evidence || []).slice(0, 2),
    };
  }).filter(match => match.matchedTerms.length)
    .sort((left, right) => right.matchScore - left.matchScore)
    .slice(0, 3);
  return { ...opportunity, partnerMatches, matchStatus: partnerMatches.length ? "matched" : "no-match" };
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeSourceKey = url => {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return String(url || "unknown").toLowerCase(); }
};
const textOf = value => Array.isArray(value) ? value.join(" ") : String(value || "");

const publicationContext = governance => {
  const requestedState = String(process.env.DATASET_PUBLICATION_STATE || governance.publicationGate?.nonPublishedDefaultState || "staging").toLowerCase();
  const reviewerId = String(process.env.DATASET_REVIEWER_ID || process.env.DATASET_APPROVED_BY || "").trim() || null;
  const approvalStatus = String(process.env.DATASET_APPROVAL_STATUS || (reviewerId ? "approved" : "pending")).toLowerCase();
  const approved = requestedState === "published"
    && Boolean(reviewerId)
    && approvalStatus === governance.publicationGate?.approvalStatusRequired;
  if (requestedState === "published" && !approved) {
    throw new Error("published decision snapshot requires DATASET_REVIEWER_ID/DATASET_APPROVED_BY and DATASET_APPROVAL_STATUS=approved");
  }
  return { requestedState, state: approved ? "published" : requestedState === "working" ? "working" : "staging", reviewerId, approvalStatus, approved };
};

const taxonomyForOpportunity = ({ archetype, evidenceConfidence, workflowStage }) => {
  const id = String(archetype.id || "");
  const terms = (archetype.terms || []).map(value => String(value).toLowerCase());
  const assets = archetype.assets || [];
  const revenues = archetype.revenueModels || [];
  const has = pattern => pattern.test(`${id} ${terms.join(" ")}`);
  const vertical = has(/health|medical|clinical|헬스|의료/) ? "health"
    : has(/financial|commerce|purchase|payment|bank|금융|결제|커머스/) ? "commerce-finance"
      : has(/enterprise|field|기업|현장/) ? "enterprise"
        : has(/home|가전|홈/) ? "connected-home"
          : has(/vehicle|car|자동차|차량/) ? "automotive" : "horizontal";
  const device = assets.includes("wearable-network") ? ["wearable", "multi-device"]
    : assets.includes("large-screen") ? ["large-screen", "multi-device"]
      : assets.includes("camera-media") ? ["camera-device", "multi-device"] : ["multi-device"];
  const modality = has(/camera|image|video|vision|glasses|카메라|영상|글래스/) ? ["vision", "multimodal"]
    : has(/voice|call|message|통화|음성|메시지/) ? ["voice", "text"] : ["text", "multimodal"];
  const payer = [...new Set([
    revenues.includes("enterprise") ? "enterprise" : null,
    revenues.includes("subscription") ? "consumer-or-seat-subscriber" : null,
    revenues.some(value => ["commission", "outcome", "usage"].includes(value)) ? "partner-or-transaction-payer" : null,
  ].filter(Boolean))];
  return {
    user_need: [id],
    value_chain_layer: [...new Set(assets.map(asset => asset === "os-control" ? "experience-and-runtime"
      : asset === "app-distribution" || asset === "wallet-payment" ? "service-platform-and-monetization"
        : asset === "account-identity" || asset === "secure-workspace" ? "data-context-and-trust"
          : asset === "global-channel" ? "distribution" : "device-and-sensor"))],
    ai_capability: [has(/agent|automation|action|에이전트|자동화/) ? "agentic-action" : "intelligence-service"],
    modality,
    device,
    inference_location: has(/on-device|offline|secure|trust|privacy|온디바이스|오프라인|보안/) ? ["on-device", "hybrid"] : ["hybrid"],
    business_model: revenues,
    payer: payer.length ? payer : ["undetermined"],
    industry_vertical: [vertical],
    geography: ["global"],
    maturity: [(archetype.baseFit?.feasibility || 0) >= 4 ? "PoC-to-GA" : "research-to-PoC"],
    strategic_posture: [archetype.preferredAction || "Watch"],
    risk: [(archetype.baseFit?.risk || 0) >= 4 ? "heightened-review" : "standard-review"],
    source_tier: [evidenceConfidence === "high" ? "multi-source" : "limited-source"],
    confidence: [evidenceConfidence],
    workflow_stage: [workflowStage],
  };
};

const taxonomyForSignal = (signal, workflowStage) => ({
  user_need: [signal.product || signal.name],
  value_chain_layer: Array.isArray(signal.decisionAxes?.integration) ? signal.decisionAxes.integration : [signal.decisionAxes?.integration].filter(Boolean),
  ai_capability: Array.isArray(signal.decisionAxes?.touchpoint) ? signal.decisionAxes.touchpoint : [signal.decisionAxes?.touchpoint].filter(Boolean),
  modality: Array.isArray(signal.modality) ? signal.modality : [signal.modality || "multimodal"],
  device: Array.isArray(signal.device) ? signal.device : [signal.device || signal.entityType || "multi-device"],
  inference_location: Array.isArray(signal.decisionAxes?.touchpoint) ? signal.decisionAxes.touchpoint : [signal.decisionAxes?.touchpoint].filter(Boolean),
  business_model: signal.financials?.revenueModel ? [signal.financials.revenueModel] : ["undetermined"],
  payer: signal.payer ? [signal.payer] : ["undetermined"],
  industry_vertical: signal.industryVertical ? [signal.industryVertical] : ["horizontal"],
  geography: signal.decisionAxes?.regions || [],
  maturity: [signal.decisionAxes?.maturity || "Research"],
  strategic_posture: signal.decisionAxes?.posture || [signal.actionOption],
  risk: [signal.mxMapping?.patentLitigationRisk || "review-required"],
  source_tier: [signal.confidence === "high" ? "multi-source" : "limited-source"],
  confidence: [signal.confidence || "low"],
  workflow_stage: [workflowStage],
});

const buildOpportunityEvidence = ({ signals = [], market = {}, monetization = {} }) => {
  const rows = [];
  for (const signal of signals) {
    for (const source of signal.evidence || []) {
      rows.push({
        id: `signal:${signal.id}:${stableHash(source.url || source.publisher)}`,
        type: "decision-signal",
        title: `${signal.name} · ${signal.product}`,
        text: [signal.name, signal.product, signal.fact, signal.implication, signal.decision, ...(source.spans || [])].join(" "),
        url: source.url || "",
        source: source.publisher || normalizeSourceKey(source.url),
        independentKey: independentSourceKey(source),
        sourceOwnerGroup: sourceOwnerGroup(source) || null,
        publishedAt: source.publishedAt || signal.lastVerifiedAt || "",
        observedAt: source.observedAt || signal.lastVerifiedAt || "",
        retrievedAt: source.retrievedAt || signal.lastVerifiedAt || "",
        verifiedAt: signal.lastVerifiedAt || "",
        spans: (source.spans || []).filter(Boolean).slice(0, 3),
        sourceTier: source.tier || (signal.confidence === "high" ? "reported" : "estimate"),
        confidence: signal.confidence || "medium",
        priority: signal.priority || "P2",
      });
    }
  }
  for (const record of market.records || []) {
    if (record.provenance?.status !== "source-backed" && !(record.sourceQuantifiedLines || []).length) continue;
    rows.push({
      id: `market:${record.id || stableHash([record.sourceUrl, record.title])}`,
      type: "market-record",
      title: record.titleEn || record.title || record.topic || "Market evidence",
      text: [record.title, record.titleEn, record.topic, record.summary, record.evidence, ...(record.sourceQuantifiedLines || [])].join(" "),
      url: record.sourceUrl || record.url || "",
      source: record.sourceName || normalizeSourceKey(record.sourceUrl || record.url),
      independentKey: independentSourceKey(record),
      sourceOwnerGroup: sourceOwnerGroup(record) || null,
      publishedAt: record.publishedAt || record.collectedAt || "",
      observedAt: record.observedAt || record.collectedAt || "",
      retrievedAt: record.sourceContent?.retrievedAt || record.collectedAt || "",
      verifiedAt: record.provenance?.verifiedAt || record.collectedAt || "",
      spans: (record.sourceQuantifiedLines || record.sourceContent?.evidenceSpans || []).filter(Boolean).slice(0, 3),
      sourceTier: record.provenance?.status === "source-backed" ? "reported" : "estimate",
      confidence: record.provenance?.status === "source-backed" ? "high" : "medium",
      priority: /price|revenue|security|fraud|health|carrier|satellite/i.test(`${record.type} ${record.topic}`) ? "P1" : "P2",
    });
  }
  for (const company of monetization.companies || []) {
    for (const item of company.monetize || []) {
      if (item.classificationGate?.status !== "passed") continue;
      rows.push({
        id: `revenue:${company.name}:${stableHash(item.url || item.signal)}`,
        type: "revenue-signal",
        title: `${company.name} · ${item.model}`,
        text: [company.name, company.vertical, item.signal, item.model, ...Object.values(item.classificationGate?.fields || {})].join(" "),
        url: item.url || "",
        source: item.source || normalizeSourceKey(item.url),
        independentKey: independentSourceKey({ ...item, sourceName: item.source, sourceUrl: item.url }),
        sourceOwnerGroup: sourceOwnerGroup({ ...item, sourceName: item.source, sourceUrl: item.url }) || null,
        publishedAt: item.date || "",
        observedAt: item.observedAt || item.date || "",
        retrievedAt: item.retrievedAt || item.date || "",
        verifiedAt: item.verifiedAt || item.date || "",
        spans: [item.signal, item.classificationGate?.reason].filter(Boolean).slice(0, 3),
        sourceTier: "reported",
        confidence: "high",
        priority: "P1",
        revenueModel: item.model,
      });
    }
  }
  return rows;
};

const generateOpportunities = ({ policy, governance, publication, signals, market, monetization, previous, generatedAt }) => {
  const evidencePool = buildOpportunityEvidence({ signals, market, monetization });
  const assetMap = new Map((policy.assetCatalog || []).map(asset => [asset.id, asset]));
  const previousMap = new Map((previous.generatedOpportunities || []).map(item => [item.id, item]));
  const gate = policy.publicationGate || {};
  const candidates = (policy.archetypes || []).slice(0, policy.monthlyCandidateTarget?.max || 20).map(archetype => {
    const terms = (archetype.terms || []).map(term => String(term).toLowerCase());
    const matches = evidencePool.map(row => {
      const haystack = row.text.toLowerCase();
      const matchedTerms = terms.filter(term => haystack.includes(term));
      return matchedTerms.length ? { ...row, matchedTerms } : null;
    }).filter(Boolean)
      .sort((left, right) => right.matchedTerms.length - left.matchedTerms.length || String(right.publishedAt).localeCompare(String(left.publishedAt)))
      .slice(0, 12);
    const independentSources = new Set(matches.map(row => row.independentKey).filter(Boolean)).size;
    const revenueMatches = new Set(matches.map(row => row.revenueModel).filter(model => (archetype.revenueModels || []).includes(model))).size;
    const marketMatches = matches.filter(row => row.type === "market-record").length;
    const signalMatches = matches.filter(row => row.type === "decision-signal").length;
    const base = archetype.baseFit || {};
    const riskMentions = matches.filter(row => /lawsuit|regulat|privacy|risk|소송|규제|개인정보/i.test(row.text)).length;
    const ratings = {
      marketSizeGrowth: clamp((base.demand || 1) + Math.min(1, marketMatches * 0.2), 1, 5),
      strategicFit: clamp(base.asset || 1, 1, 5),
      executionFeasibility: clamp(base.feasibility || 1, 1, 5),
      defensibleAdvantage: clamp(((base.differentiation || 1) + (base.data || 1)) / 2, 1, 5),
      monetizationClarity: clamp((base.recurring || 1) + Math.min(1, revenueMatches * 0.25), 1, 5),
      customerProblem: clamp((base.demand || 1) + Math.min(0.5, signalMatches * 0.1), 1, 5),
      competitivePosition: clamp(base.differentiation || 1, 1, 5),
      regulatoryControllability: clamp(6 - (base.risk || 3) - Math.min(1, riskMentions * 0.1), 1, 5),
    };
    const evidenceIdsFor = type => {
      const selected = type === "market" ? matches.filter(row => row.type === "market-record")
        : type === "revenue" ? matches.filter(row => row.type === "revenue-signal")
          : type === "signal" ? matches.filter(row => row.type === "decision-signal") : matches;
      return (selected.length ? selected : matches).slice(0, 6).map(row => row.id);
    };
    const evidenceType = { marketSizeGrowth: "market", strategicFit: "signal", executionFeasibility: "signal", defensibleAdvantage: "signal", monetizationClarity: "revenue", customerProblem: "signal", competitivePosition: "signal", regulatoryControllability: "all" };
    const scoringDimensions = governance.opportunityScoring?.dimensions || [];
    const scorecard = scoringDimensions.map(dimension => ({
      dimension: dimension.id,
      label: dimension.label,
      weight: dimension.weight,
      rating: Number(ratings[dimension.id].toFixed(2)),
      weightedPoints: Number((dimension.weight * ratings[dimension.id] / 5).toFixed(2)),
      evidenceIds: evidenceIdsFor(evidenceType[dimension.id]),
    }));
    const scoreBreakdown = Object.fromEntries(scorecard.map(row => [row.dimension, row.weightedPoints]));
    const opportunityScore = Number(clamp(scorecard.reduce((sum, row) => sum + row.weightedPoints, 0), 0, 100).toFixed(1));
    const recencyScores = matches.map(row => clamp(100 - ageDays(row.publishedAt, Date.parse(generatedAt)) * 1.5, 10, 100));
    const confidenceScores = matches.map(row => row.confidence === "high" ? 100 : row.confidence === "medium" ? 70 : 40);
    const priorityScores = matches.map(row => row.priority === "P0" ? 100 : row.priority === "P1" ? 85 : 60);
    const combined = [...recencyScores, ...confidenceScores, ...priorityScores];
    const signalScore = combined.length ? Math.round(combined.reduce((sum, value) => sum + value, 0) / combined.length) : 0;
    const evidenceConfidence = independentSources >= 2 && matches.length >= 3 ? "high" : matches.length >= 2 ? "medium" : "low";
    const evidenceGatePassed = matches.length >= (gate.minimumEvidenceUnits || 2) && independentSources >= (gate.minimumIndependentSources || 2);
    const decisionEligible = evidenceGatePassed && opportunityScore >= (gate.minimumOpportunityScore || 45);
    const workflowStage = decisionEligible ? (publication.approved ? "published" : "verified") : "draft";
    const status = workflowStage;
    const previousScore = previousMap.get(archetype.id)?.opportunityScore;
    const scoreDelta = Number.isFinite(Number(previousScore)) ? opportunityScore - Number(previousScore) : null;
    const assetLabels = (archetype.assets || []).map(id => assetMap.get(id)?.label || id);
    const evidence = matches.slice(0, 6).map(row => ({
      id: row.id,
      type: row.type,
      title: row.title,
      url: row.url,
      source: row.source,
      publishedAt: row.publishedAt,
      matchedTerms: row.matchedTerms,
      spans: (row.spans || []).slice(0, 3),
      sourceTier: row.sourceTier || "reported",
      observedAt: row.observedAt || row.publishedAt,
      retrievedAt: row.retrievedAt || row.observedAt || row.publishedAt,
      verifiedAt: row.verifiedAt || generatedAt,
    }));
    const nextDecisionAt = new Date(Date.parse(generatedAt) + (policy.experimentTemplate?.durationDays || 90) * DAY_MS).toISOString();
    return {
      id: archetype.id,
      title: archetype.title,
      generatedAt,
      status,
      signalScore,
      opportunityScore,
      scoreDelta,
      trend: scoreDelta === null ? "new" : scoreDelta > 0 ? "up" : scoreDelta < 0 ? "down" : "flat",
      evidenceConfidence,
      evidenceCount: matches.length,
      independentSources,
      scoreBreakdown,
      scorecard,
      rubricVersion: governance.opportunityScoring?.rubricVersion,
      scoredAt: generatedAt,
      scoredBy: { type: "deterministic-rule", id: governance.opportunityScoring?.scorer },
      evidenceIds: evidence.map(row => row.id),
      claimIds: [`claim:opportunity:${archetype.id}`],
      decisionEligible,
      workflow: {
        stage: workflowStage,
        reviewStatus: publication.approved ? "approved" : "pending",
        reviewerId: publication.reviewerId,
        approvalStatus: publication.approvalStatus,
      },
      taxonomy: taxonomyForOpportunity({ archetype, evidenceConfidence, workflowStage }),
      ownAssetFit: Math.round(((base.asset || 0) / 5) * 100),
      ownAssets: assetLabels,
      assetIds: archetype.assets || [],
      revenueModels: archetype.revenueModels || [],
      actionOption: archetype.preferredAction || "Watch",
      ownerOrg: archetype.ownerOrg || "제품기획팀",
      matchTerms: terms,
      matching: { terms, marketEvidence: marketMatches, decisionSignals: signalMatches, revenueSignals: revenueMatches },
      evidence,
      reason: status === "published"
        ? `${independentSources}개 독립 출처·${matches.length}개 근거·승인 조건을 모두 충족했습니다.`
        : decisionEligible
          ? `${independentSources}개 독립 출처와 ${matches.length}개 근거를 충족했으며 사람 승인을 기다립니다.`
          : `근거 ${matches.length}개·독립 출처 ${independentSources}개로 검증 기준을 충족하지 못했습니다.`,
      experimentPlan: {
        durationDays: policy.experimentTemplate?.durationDays || 90,
        hypothesis: `${archetype.title}이 핵심 과업의 완료율과 반복 사용을 동시에 높일 수 있는지 검증`,
        targetUsers: "핵심 사용 시나리오별 초기 사용자군",
        prototype: "핵심 과업 1개를 완결하는 제한형 프로토타입",
        abVariations: policy.experimentTemplate?.abVariations || [],
        priceOptions: policy.experimentTemplate?.priceOptions || [],
        successMetrics: policy.experimentTemplate?.successMetrics || [],
        reviewGates: policy.experimentTemplate?.reviewGates || [],
        ownerOrg: archetype.ownerOrg || "제품기획팀",
        nextDecisionAt,
      },
    };
  });
  const ranked = candidates.slice().sort((left, right) => right.opportunityScore - left.opportunityScore || right.signalScore - left.signalScore);
  const shortlist = ranked.filter(item => item.decisionEligible).slice(0, policy.monthlyCandidateTarget?.experimentShortlist || 3);
  const matrix = (policy.assetCatalog || []).map(asset => ({
    assetId: asset.id,
    asset: asset.label,
    opportunityIds: ranked.filter(item => item.assetIds.includes(asset.id)).map(item => item.id),
    verifiedCandidateCount: ranked.filter(item => item.decisionEligible && item.assetIds.includes(asset.id)).length,
    publishedCount: ranked.filter(item => item.status === "published" && item.assetIds.includes(asset.id)).length,
  }));
  return {
    candidates: ranked,
    shortlist,
    matrix,
    evidencePoolSize: evidencePool.length,
    published: ranked.filter(item => item.status === "published").length,
    verified: ranked.filter(item => item.status === "verified").length,
    reviewPending: ranked.filter(item => item.decisionEligible && item.status !== "published").length,
  };
};

const enrichCompanionEconomics = (economics = {}, governance = {}) => {
  const metrics = new Map((economics.headlineMetrics || []).map(metric => [metric.id, metric]));
  const requiredBasisFields = governance.comparisonGuardrail?.requiredBasisFields || ["metricType", "unit", "geography", "period", "population", "channel"];
  const basisKey = metric => requiredBasisFields.map(field => String(metric?.[field] ?? "")).join("|");
  const comparisons = (economics.comparisons || []).map(comparison => {
    if (!comparison.comparisonAllowed) {
      const hasRange = Number.isFinite(Number(comparison.low)) && Number.isFinite(Number(comparison.high)) && Number(comparison.low) > 0;
      return {
        ...comparison,
        status: "blocked-definition-mismatch",
        computedRatio: null,
        headlineSpreadRatio: hasRange ? Number((Number(comparison.high) / Number(comparison.low)).toFixed(2)) : null,
      };
    }
    const left = metrics.get(comparison.leftMetricId);
    const right = metrics.get(comparison.rightMetricId);
    const basisMatches = left && right && basisKey(left) === basisKey(right);
    const divisor = Number(right?.value);
    if (!basisMatches || !Number.isFinite(Number(left?.value)) || !Number.isFinite(divisor) || divisor === 0) {
      return {
        ...comparison,
        status: "blocked-basis-mismatch",
        computedRatio: null,
        reason: comparison.reason || `basis mismatch: ${requiredBasisFields.join(", ")}`,
      };
    }
    return {
      ...comparison,
      status: "comparable",
      computedRatio: Number((Number(left.value) / divisor).toFixed(2)),
      basis: Object.fromEntries(requiredBasisFields.map(field => [field, left[field]])),
    };
  });
  return { ...economics, comparisons };
};

const buildClaimGraph = ({ signals, opportunities, generatedAt }) => {
  const evidenceSpans = new Map();
  const addEvidence = ({ source, spanText, index = 0, fallbackId = "" }) => {
    const sourceUrl = source.url || "";
    const documentId = `document:${stableHash(sourceUrl || fallbackId || source.title || source.source)}`;
    const evidenceSpanId = `evidence:${stableHash([documentId, spanText, index])}`;
    if (!evidenceSpans.has(evidenceSpanId)) {
      const publishedAt = source.publishedAt || source.date || "";
      const observedAt = source.observedAt || source.collectedAt || publishedAt || generatedAt;
      const retrievedAt = source.retrievedAt || observedAt;
      const verifiedAt = source.verifiedAt || generatedAt;
      evidenceSpans.set(evidenceSpanId, {
        evidenceSpanId,
        documentId,
        sourceUrl,
        publisher: source.publisher || source.source || normalizeSourceKey(sourceUrl),
        sourceTier: source.sourceTier || source.tier || "reported",
        spanText: String(spanText || source.title || "").trim(),
        spanHash: stableHash(String(spanText || source.title || "")),
        eventAt: source.eventAt || publishedAt || null,
        publishedAt: publishedAt || null,
        observedAt,
        retrievedAt,
        verifiedAt,
        validFrom: source.effectiveFrom || publishedAt || null,
        validTo: source.effectiveTo ?? null,
        systemFrom: observedAt,
        systemTo: source.supersededAt ?? null,
      });
    }
    return { evidenceSpanId, documentId };
  };

  const claims = [];
  for (const signal of signals) {
    const links = [];
    for (const source of signal.evidence || []) {
      const spans = (source.spans || []).filter(Boolean);
      (spans.length ? spans : [source.title || signal.fact]).forEach((spanText, index) => {
        links.push(addEvidence({ source, spanText, index, fallbackId: signal.id }));
      });
    }
    const evidenceSpanIds = [...new Set(links.map(link => link.evidenceSpanId))];
    const documentIds = [...new Set(links.map(link => link.documentId))];
    for (const [claimType, value] of [["fact", signal.fact], ["implication", signal.implication], ["decision", signal.decision]]) {
      claims.push({
        claimId: `claim:signal:${signal.id}:${claimType}`,
        entityId: signal.id,
        predicate: claimType,
        claimType,
        value,
        evidenceSpanIds,
        documentIds,
        eventAt: evidenceSpans.get(evidenceSpanIds[0])?.eventAt || null,
        publishedAt: evidenceSpans.get(evidenceSpanIds[0])?.publishedAt || null,
        observedAt: signal.lastVerifiedAt || generatedAt,
        retrievedAt: evidenceSpans.get(evidenceSpanIds[0])?.retrievedAt || generatedAt,
        verifiedAt: signal.lastVerifiedAt || generatedAt,
        validFrom: evidenceSpans.get(evidenceSpanIds[0])?.validFrom || null,
        validTo: null,
        systemFrom: generatedAt,
        systemTo: null,
        workflowStage: signal.workflow?.stage || "draft",
        reviewStatus: signal.workflow?.reviewStatus === "approved" ? "approved" : "unreviewed",
        reviewerId: signal.workflow?.reviewerId || null,
        confidence: signal.confidence || "low",
        verificationStatus: evidenceSpanIds.length && Number(signal.validation?.independentSources || 0) >= 2 ? "verified" : "draft",
        taxonomy: signal.taxonomy,
        extraction: { method: claimType === "fact" ? "deterministic-source-span" : "evidence-linked-analysis", extractorVersion: "claim-graph-v1" },
        supersedesId: null,
        correctionReason: null,
      });
    }
  }

  for (const opportunity of opportunities) {
    const links = [];
    for (const source of opportunity.evidence || []) {
      const spans = (source.spans || []).filter(Boolean);
      (spans.length ? spans : [source.title]).filter(Boolean).forEach((spanText, index) => {
        links.push(addEvidence({ source, spanText, index, fallbackId: source.id || opportunity.id }));
      });
    }
    const evidenceSpanIds = [...new Set(links.map(link => link.evidenceSpanId))];
    const documentIds = [...new Set(links.map(link => link.documentId))];
    claims.push({
      claimId: `claim:opportunity:${opportunity.id}`,
      entityId: opportunity.id,
      predicate: "opportunity-score",
      claimType: "opportunity-assessment",
      value: opportunity.opportunityScore,
      unit: "score-out-of-100",
      evidenceSpanIds,
      documentIds,
      eventAt: evidenceSpans.get(evidenceSpanIds[0])?.eventAt || null,
      publishedAt: evidenceSpans.get(evidenceSpanIds[0])?.publishedAt || null,
      observedAt: generatedAt,
      retrievedAt: evidenceSpans.get(evidenceSpanIds[0])?.retrievedAt || generatedAt,
      verifiedAt: generatedAt,
      validFrom: generatedAt,
      validTo: null,
      systemFrom: generatedAt,
      systemTo: null,
      workflowStage: opportunity.workflow?.stage || "draft",
      reviewStatus: opportunity.workflow?.reviewStatus === "approved" ? "approved" : "unreviewed",
      reviewerId: opportunity.workflow?.reviewerId || null,
      confidence: opportunity.evidenceConfidence || "low",
      verificationStatus: opportunity.decisionEligible && evidenceSpanIds.length ? "verified" : "draft",
      taxonomy: opportunity.taxonomy,
      extraction: { method: "deterministic-evidence-weighted-score", extractorVersion: opportunity.rubricVersion },
      supersedesId: null,
      correctionReason: null,
    });
  }

  const evidenceIds = new Set(evidenceSpans.keys());
  const citedClaims = claims.filter(claim => claim.evidenceSpanIds.length && claim.evidenceSpanIds.every(id => evidenceIds.has(id))).length;
  const verifiedClaims = claims.filter(claim => claim.verificationStatus === "verified").length;
  return {
    claims,
    evidenceSpans: [...evidenceSpans.values()],
    summary: {
      claims: claims.length,
      evidenceSpans: evidenceSpans.size,
      verifiedClaims,
      verifiedClaimRatio: claims.length ? Number((verifiedClaims / claims.length).toFixed(4)) : 0,
      citationCompleteness: claims.length ? Number((citedClaims / claims.length).toFixed(4)) : 0,
    },
  };
};

const main = async () => {
  const [seed, sourcePolicy, pipelinePolicy, previous, startupStats, radar, metricHistory, volatileMetricAudit, metricGovernance, newsPolicy, collectionHealth, marketReverificationQueue, priceChangeFlags, officialSourceRegistry, opportunityPolicy, decisionGovernance, dedupCalibration, market, monetization] = await Promise.all([
    readJson(SEED),
    readJson(SOURCE_POLICY),
    readJson(PIPELINE_POLICY),
    readJson(OUTPUT, {}),
    readFile("startups.json").then(buffer => ({ bytes: buffer.length })).catch(() => ({ bytes: 0 })),
    readJson("radar.json", { picks: [] }),
    readJson("metric-history.json", { series: [] }),
    readJson("volatile-metrics-audit.json", { rows: [], summary: {} }),
    readJson("config/metric-governance.json"),
    readJson("config/news-policy.json"),
    readJson("collection-health.json", { streamHealth: [], connectorStatus: [], recoveredStreams: [] }),
    readJson("market-reverification-queue.json", { queue: [], total: 0 }),
    readJson("price-change-flags.json", { summary: {}, rows: [] }),
    readJson("config/official-source-registry.json", { officialFeeds: [], sitemaps: [], apiConnectors: [] }),
    readJson(OPPORTUNITY_POLICY),
    readJson(DECISION_GOVERNANCE),
    readJson(DEDUP_CALIBRATION),
    readJson("market.json", { records: [] }),
    readJson("monetization.json", { companies: [] }),
  ]);
  const generatedAt = new Date().toISOString();
  const publication = publicationContext(decisionGovernance);
  const now = Date.now();
  const marketRecords = Array.isArray(market.records) ? market.records : [];
  const directMarketEvidenceCount = marketRecords.filter(record => record.provenance?.status === "source-backed"
    && record.sourceContent?.status === "content-extracted"
    && record.displayEligible === true
    && record.summaryMode === "source-content-extractive"
    && Array.isArray(record.sourceQuantifiedLines) && record.sourceQuantifiedLines.length
    && Array.isArray(record.sourceQuantities) && record.sourceQuantities.length).length;
  const dataQualityTargets = {
    ...(seed.dataQualityTargets || {}),
    directMarketEvidence: {
      ...(seed.dataQualityTargets?.directMarketEvidence || {}),
      currentNumerator: directMarketEvidenceCount,
      currentDenominator: marketRecords.length,
      currentRate: marketRecords.length ? Number((directMarketEvidenceCount / marketRecords.length).toFixed(3)) : 0,
    },
  };
  const previousSignals = new Map((previous.signals || []).map(signal => [signal.id, signal]));
  const validationIssues = [];
  const numericDiffs = [];

  const signals = (seed.signals || []).map(signal => {
    const validation = validateSignal(signal);
    if (validation.issues.length) validationIssues.push({ id: signal.id, issues: validation.issues });
    const publishedDates = (signal.evidence || []).map(source => source.publishedAt).filter(Boolean).sort();
    const newestSourceAt = publishedDates.at(-1) || "";
    const sourceAgeDays = ageDays(newestSourceAt, now);
    const verifiedAgeHours = Math.max(0, Math.round((now - Date.parse(signal.lastVerifiedAt)) / 3600000));
    const tierKey = String(signal.freshnessTier || "Tier 2").replace(/\s/g, "").toLowerCase();
    const slaHours = sourcePolicy.freshnessSlaHours[tierKey] ?? 24;
    const archiveStatus = sourceAgeDays > sourcePolicy.archive.afterDays && !signal.masterData ? "archived" : "active";
    const previousSignal = previousSignals.get(signal.id);
    const diffs = metricDiffs(previousSignal?.metrics, signal.metrics);
    if (diffs.length) numericDiffs.push({ id: signal.id, diffs });
    const evidenceVerified = validation.independentSources >= 2 && validation.issues.length === 0;
    const reviewed = Boolean(publication.reviewerId) && publication.approvalStatus === "approved";
    const workflowStage = publication.approved && validation.issues.length === 0
      ? "published"
      : reviewed ? "reviewed" : evidenceVerified ? "verified" : "draft";
    return {
      ...signal,
      workflow: {
        ...signal.workflow,
        stage: workflowStage,
        reviewStatus: reviewed ? "approved" : "pending",
        humanReview: reviewed,
        reviewerId: publication.reviewerId,
        approvalStatus: publication.approvalStatus,
      },
      taxonomy: taxonomyForSignal(signal, workflowStage),
      claimIds: ["fact", "implication", "decision"].map(type => `claim:signal:${signal.id}:${type}`),
      evidenceIds: (signal.evidence || []).map(source => `document:${stableHash(source.url || source.publisher)}`),
      sourceFreshness: {
        newestSourceAt,
        ageDays: sourceAgeDays,
        badge: sourceAgeDays <= 7 ? "fresh" : sourceAgeDays <= 30 ? "aging" : "stale",
      },
      verificationSla: {
        tier: signal.freshnessTier,
        targetHours: slaHours,
        ageHours: verifiedAgeHours,
        status: verifiedAgeHours <= slaHours ? "within-sla" : "overdue",
      },
      archiveStatus,
      validation: {
        status: validation.issues.length ? "flagged" : "passed",
        independentSources: validation.independentSources,
        evidenceSpanCount: validation.evidenceSpanCount,
        issues: validation.issues,
      },
      metricDiffs: diffs,
    };
  });

  if (validationIssues.length) {
    throw new Error(`MX intelligence validation failed:\n${validationIssues.map(row => `${row.id}: ${row.issues.join(", ")}`).join("\n")}`);
  }

  const clusters = [...signals.reduce((map, signal) => {
    const row = map.get(signal.eventClusterId) || { id: signal.eventClusterId, signalIds: [], evidenceUrls: new Set() };
    row.signalIds.push(signal.id);
    for (const source of signal.evidence || []) row.evidenceUrls.add(source.url);
    map.set(signal.eventClusterId, row);
    return map;
  }, new Map()).values()].map(cluster => ({
    id: cluster.id,
    signalIds: cluster.signalIds,
    evidenceCount: cluster.evidenceUrls.size,
    representativeSignalId: cluster.signalIds[0],
  }));

  const semanticThreshold = Number(dedupCalibration.defaultThreshold || sourcePolicy.deduplication.threshold || 0.85);
  const semanticVectors = new Map(signals.map(signal => [signal.id, embeddingVector(`${signal.name} ${signal.product} ${signal.fact}`, sourcePolicy.deduplication.dimensions || 384)]));
  const semanticDuplicatePairs = [];
  for (let leftIndex = 0; leftIndex < signals.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < signals.length; rightIndex += 1) {
      const left = signals[leftIndex];
      const right = signals[rightIndex];
      const similarity = cosine(semanticVectors.get(left.id), semanticVectors.get(right.id));
      if (similarity >= semanticThreshold) semanticDuplicatePairs.push({ left: left.id, right: right.id, similarity: Number(similarity.toFixed(3)) });
    }
  }

  const activeSignals = signals.filter(signal => signal.archiveStatus === "active");
  const pipeline = {
    raw: signals.length,
    draft: signals.length,
    verified: signals.filter(signal => signal.validation.independentSources >= 2).length,
    reviewed: signals.filter(signal => signal.workflow.humanReview).length,
    published: signals.filter(signal => signal.workflow.stage === "published").length,
    reconciled: signals.filter(signal => !signal.metricDiffs.length).length,
    flagged: signals.filter(signal => signal.validation.status === "flagged").length,
  };

  const sourceCoverage = {
    regionalPublishers: sourcePolicy.regionalPublishers.length,
    regions: new Set(sourcePolicy.regionalPublishers.map(source => source.region)).size,
    primarySources: sourcePolicy.primarySources.length,
    supplyChainSources: sourcePolicy.supplyChain.length,
    researchAndMarketSources: (sourcePolicy.researchAndMarketData || []).length,
    connectorGroups: (sourcePolicy.connectorRegistry || []).length,
    conferenceAndStandards: (sourcePolicy.conferenceAndStandards || []).length,
    configured: [...sourcePolicy.regionalPublishers, ...sourcePolicy.primarySources].filter(source => source.status === "configured").length,
    paidReconciliation: pipelinePolicy.numericEvidence.paidProviderStatus,
    selfBenchmarkTrack: newsPolicy.mxDecisionDatabasePolicy?.selfBenchmarkTrack?.enabled === true,
    directOfficialFeeds: (officialSourceRegistry.officialFeeds || []).length,
    officialSitemaps: (officialSourceRegistry.sitemaps || []).length,
    officialApiConnectors: (officialSourceRegistry.apiConnectors || []).length,
    recoveredStreams: (collectionHealth.recoveredStreams || []).length,
    persistentEmptyStreams: (collectionHealth.watchdogBreaches || []).length,
  };
  const opportunityGeneration = generateOpportunities({
    policy: opportunityPolicy,
    governance: decisionGovernance,
    publication,
    signals,
    market,
    monetization,
    previous,
    generatedAt,
  });
  const claimGraph = buildClaimGraph({ signals, opportunities: opportunityGeneration.candidates, generatedAt });
  const publicationGate = decisionGovernance.publicationGate || {};
  const criticalPolicyViolations = validationIssues.length;
  const claimGatePassed = claimGraph.summary.verifiedClaimRatio >= Number(publicationGate.minimumVerifiedClaimRatio || 0)
    && claimGraph.summary.citationCompleteness === Number(publicationGate.requiredCitationCompleteness ?? 1)
    && criticalPolicyViolations <= Number(publicationGate.criticalPolicyViolationsAllowed ?? 0);
  if (publication.approved && !claimGatePassed) {
    throw new Error(`published decision snapshot failed claim gate: verified=${claimGraph.summary.verifiedClaimRatio}, citations=${claimGraph.summary.citationCompleteness}, critical=${criticalPolicyViolations}`);
  }
  const publicationControl = {
    state: publication.state,
    requestedState: publication.requestedState,
    approvalStatus: publication.approvalStatus,
    reviewerId: publication.reviewerId,
    minimumApprovals: pipelinePolicy.publishing?.minimumApprovals || 1,
    verifiedClaimRatio: claimGraph.summary.verifiedClaimRatio,
    verifiedClaimRatioThreshold: publicationGate.minimumVerifiedClaimRatio,
    citationCompleteness: claimGraph.summary.citationCompleteness,
    requiredCitationCompleteness: publicationGate.requiredCitationCompleteness,
    criticalPolicyViolations,
    claimGatePassed,
    publishedInvariantSatisfied: publication.state !== "published" || (publication.approved && claimGatePassed),
  };
  const opportunityPartnerLinks = matchOpportunityPartners(opportunityGeneration.candidates, radar.picks || []);
  const companionEconomics = enrichCompanionEconomics(seed.companionEconomics || {}, metricGovernance);
  const comparisonAudit = {
    total: (companionEconomics.comparisons || []).length,
    comparable: (companionEconomics.comparisons || []).filter(item => item.status === "comparable").length,
    blocked: (companionEconomics.comparisons || []).filter(item => item.status.startsWith("blocked")).length,
    invalid: (companionEconomics.comparisons || []).filter(item => item.comparisonAllowed && item.status !== "comparable").length,
  };

  const snapshotCore = {
    signals,
    deviceMatrix: seed.deviceMatrix || [],
    featureRoadmap: seed.featureRoadmap || [],
    regulations: seed.regulations || [],
    decisionTree: seed.decisionTree || [],
    sidebarCategories: seed.sidebarCategories || [],
    pricingBenchmarks: seed.pricingBenchmarks || [],
    monetizationModels: seed.monetizationModels || [],
    osAgentStack: seed.osAgentStack || [],
    uxUseCases: seed.uxUseCases || [],
    partnershipNetwork: seed.partnershipNetwork || {},
    formFactors: seed.formFactors || [],
    marketSignals: seed.marketSignals || [],
    securityBusinessCases: seed.securityBusinessCases || {},
    healthMonetizationLadder: seed.healthMonetizationLadder || [],
    companionEconomics,
    generatedOpportunities: opportunityGeneration.candidates,
    experimentShortlist: opportunityGeneration.shortlist,
    assetOpportunityMatrix: opportunityGeneration.matrix,
    opportunityPartnerLinks,
    metricHistory: metricHistory.series || [],
    claims: claimGraph.claims,
    evidenceSpans: claimGraph.evidenceSpans,
    publicationControl,
  };
  const snapshotVersion = stableHash(snapshotCore);
  const changedSignals = signals.filter(signal => {
    const before = previousSignals.get(signal.id);
    return before && stableHash({ ...before, sourceFreshness: undefined, verificationSla: undefined, validation: undefined }) !== stableHash({ ...signal, sourceFreshness: undefined, verificationSla: undefined, validation: undefined });
  }).length;

  const output = {
    generatedAt,
    asOf: seed.asOf,
    schemaVersion: 9,
    snapshotVersion,
    database: {
      mode: "mx-decision-intelligence",
      lifecycle: "raw-draft-verified-reviewed-published-reconciled",
      publicRetention: "active-plus-master-data",
      archiveAfterDays: sourcePolicy.archive.afterDays,
      deduplication: { ...sourcePolicy.deduplication, threshold: semanticThreshold, calibration: dedupCalibration },
      previousSnapshotVersion: previous.snapshotVersion || "",
      changedSignals,
      storage: "git-materialized-view-with-external-immutable-migration-gate",
      startupFileMb: Number((startupStats.bytes / 1048576).toFixed(2)),
      migrationRecommended: startupStats.bytes >= (pipelinePolicy.storageTarget.migrationTriggerMb * 1048576),
      targetStorage: pipelinePolicy.storageTarget.recommended,
    },
    summary: {
      activeSignals: activeSignals.length,
      deviceMakers: activeSignals.filter(signal => signal.entityType === "device-maker").length,
      carriers: activeSignals.filter(signal => signal.entityType === "carrier").length,
      partnersAndComponents: activeSignals.filter(signal => /partner|candidate/.test(signal.entityType)).length,
      highConfidence: activeSignals.filter(signal => signal.confidence === "high").length,
      sourceUrls: new Set(activeSignals.flatMap(signal => signal.evidence.map(source => source.url))).size,
      overdue: activeSignals.filter(signal => signal.verificationSla.status === "overdue").length,
    },
    pipeline,
    publicationControl,
    taxonomyAxes: decisionGovernance.taxonomy,
    claims: claimGraph.claims,
    evidenceSpans: claimGraph.evidenceSpans,
    claimSummary: claimGraph.summary,
    sourceCoverage,
    signals,
    clusters,
    semanticDuplicatePairs,
    deviceMatrix: seed.deviceMatrix || [],
    featureRoadmap: seed.featureRoadmap || [],
    regulations: seed.regulations || [],
    decisionTree: seed.decisionTree || [],
    sidebarCategories: seed.sidebarCategories || [],
    monetizationFramework: seed.monetizationFramework || {},
    monetizationModels: seed.monetizationModels || [],
    monetizationMethodSource: seed.monetizationMethodSource || {},
    pricingBenchmarks: seed.pricingBenchmarks || [],
    marketSignals: seed.marketSignals || [],
    securityBusinessCases: seed.securityBusinessCases || {},
    healthMonetizationLadder: seed.healthMonetizationLadder || [],
    companionEconomics,
    comparisonAudit,
    generatedOpportunities: opportunityGeneration.candidates,
    experimentShortlist: opportunityGeneration.shortlist,
    assetOpportunityMatrix: opportunityGeneration.matrix,
    opportunityGeneration: {
      generatedAt,
      policyVersion: opportunityPolicy.version,
      candidateTarget: opportunityPolicy.monthlyCandidateTarget,
      publicationGate: opportunityPolicy.publicationGate,
      scoreWeights: opportunityPolicy.scoreWeights,
      rubricVersion: decisionGovernance.opportunityScoring?.rubricVersion,
      scorer: decisionGovernance.opportunityScoring?.scorer,
      evidencePoolSize: opportunityGeneration.evidencePoolSize,
      candidates: opportunityGeneration.candidates.length,
      published: opportunityGeneration.published,
      verified: opportunityGeneration.verified,
      reviewPending: opportunityGeneration.reviewPending,
    },
    opportunityPartnerLinks,
    metricHistory: metricHistory.series || [],
    metricGovernance,
    volatileMetricAudit,
    collectionHealth,
    marketReverificationQueue,
    priceChangeFlags,
    dataQualityTargets,
    selfBenchmarkPolicy: newsPolicy.mxDecisionDatabasePolicy?.selfBenchmarkTrack || {},
    roiModel: seed.roiModel || {},
    osAgentStack: seed.osAgentStack || [],
    uxUseCases: seed.uxUseCases || [],
    partnershipNetwork: seed.partnershipNetwork || { nodes: [], edges: [] },
    formFactors: seed.formFactors || [],
    failureCases: seed.failureCases || [],
    hardwareSlmTrack: seed.hardwareSlmTrack || [],
    consumerPainPointTrack: seed.consumerPainPointTrack || {},
    appMetricsTrack: seed.appMetricsTrack || {},
    dealWatch: seed.dealWatch || {},
    audit: {
      status: "passed",
      checkedAt: generatedAt,
      numericEvidenceFlags: 0,
      highConfidenceCrossChecks: signals.filter(signal => signal.confidence === "high").length,
      metricDiffs: numericDiffs,
      semanticDuplicatePairs: semanticDuplicatePairs.length,
      comparisonGuardrail: comparisonAudit,
      sourcePolicyVersion: sourcePolicy.version,
      pipelinePolicyVersion: pipelinePolicy.version,
      decisionGovernanceVersion: decisionGovernance.version,
      taxonomyVersion: decisionGovernance.taxonomy?.version,
      dedupCalibrationVersion: dedupCalibration.version,
      dedupCalibrationStatus: dedupCalibration.status,
    },
  };

  const publicOutput = sanitizePublicCopy(output);
  await writeFile(OUTPUT, `${JSON.stringify(publicOutput)}\n`);
  console.log(`[decision-intelligence] ${signals.length} signals · ${output.summary.sourceUrls} sources · ${clusters.length} clusters · ${opportunityGeneration.candidates.length} opportunities · ${snapshotVersion}`);
};

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
