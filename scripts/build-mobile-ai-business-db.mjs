#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { sanitizePublicCopy } from "./public-copy.mjs";

const OUTPUT = "mobile-ai-business-view.json";
const SEED = "config/mx-intelligence-seed.json";
const SOURCE_POLICY = "config/mx-source-policy.json";
const PIPELINE_POLICY = "config/intelligence-pipeline.json";
const OPPORTUNITY_POLICY = "config/opportunity-generation.json";
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

  const independentSources = new Set((signal.evidence || []).map(source => source.independentKey).filter(Boolean)).size;
  if (signal.confidence === "high" && independentSources < 2) issues.push("high-confidence-needs-2-independent-sources");
  if (signal.priority === "P1" && !(signal.workflow?.humanReview && signal.workflow?.reviewStatus === "approved")) {
    issues.push("p1-human-review-required");
  }

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
        independentKey: source.independentKey || normalizeSourceKey(source.url),
        publishedAt: source.publishedAt || signal.lastVerifiedAt || "",
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
      independentKey: normalizeSourceKey(record.sourceUrl || record.url),
      publishedAt: record.publishedAt || record.collectedAt || "",
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
        independentKey: normalizeSourceKey(item.url) || item.source,
        publishedAt: item.date || "",
        confidence: "high",
        priority: "P1",
        revenueModel: item.model,
      });
    }
  }
  return rows;
};

const generateOpportunities = ({ policy, signals, market, monetization, previous, generatedAt }) => {
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
    const scoreBreakdown = {
      userDemand: clamp((base.demand || 0) * 3 + Math.min(5, marketMatches * 2) + Math.min(3, matches.length), 0, 20),
      ownedAssetLeverage: clamp((base.asset || 0) * 4, 0, 20),
      differentiation: clamp((base.differentiation || 0) * 3, 0, 15),
      recurringRevenue: clamp((base.recurring || 0) * 2 + Math.min(5, revenueMatches * 3), 0, 15),
      technicalFeasibility: clamp((base.feasibility || 0) * 2, 0, 10),
      dataAdvantage: clamp((base.data || 0) * 2, 0, 10),
      distributionScale: clamp((base.distribution || 0) * 2, 0, 10),
      riskPenalty: clamp((base.risk || 0) * 2 + matches.filter(row => /lawsuit|regulat|privacy|risk|소송|규제|개인정보/i.test(row.text)).length, 0, 20),
    };
    const positiveScore = Object.entries(scoreBreakdown).filter(([key]) => key !== "riskPenalty").reduce((sum, [, value]) => sum + value, 0);
    const opportunityScore = clamp(Math.round(positiveScore - scoreBreakdown.riskPenalty), 0, 100);
    const recencyScores = matches.map(row => clamp(100 - ageDays(row.publishedAt, Date.parse(generatedAt)) * 1.5, 10, 100));
    const confidenceScores = matches.map(row => row.confidence === "high" ? 100 : row.confidence === "medium" ? 70 : 40);
    const priorityScores = matches.map(row => row.priority === "P0" ? 100 : row.priority === "P1" ? 85 : 60);
    const combined = [...recencyScores, ...confidenceScores, ...priorityScores];
    const signalScore = combined.length ? Math.round(combined.reduce((sum, value) => sum + value, 0) / combined.length) : 0;
    const evidenceConfidence = independentSources >= 2 && matches.length >= 3 ? "high" : matches.length >= 2 ? "medium" : "low";
    const evidenceGatePassed = matches.length >= (gate.minimumEvidenceUnits || 2) && independentSources >= (gate.minimumIndependentSources || 2);
    const status = evidenceGatePassed && opportunityScore >= (gate.minimumOpportunityScore || 45) ? "published" : "review-pending";
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
        ? `${independentSources}개 독립 출처와 ${matches.length}개 근거가 기준을 충족했습니다.`
        : `근거 ${matches.length}개·독립 출처 ${independentSources}개로 공개 기준을 충족하지 못해 검토 대기열로 이동했습니다.`,
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
  const shortlist = ranked.filter(item => item.status === "published").slice(0, policy.monthlyCandidateTarget?.experimentShortlist || 3);
  const matrix = (policy.assetCatalog || []).map(asset => ({
    assetId: asset.id,
    asset: asset.label,
    opportunityIds: ranked.filter(item => item.assetIds.includes(asset.id)).map(item => item.id),
    publishedCount: ranked.filter(item => item.status === "published" && item.assetIds.includes(asset.id)).length,
  }));
  return {
    candidates: ranked,
    shortlist,
    matrix,
    evidencePoolSize: evidencePool.length,
    published: ranked.filter(item => item.status === "published").length,
    reviewPending: ranked.filter(item => item.status === "review-pending").length,
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

const main = async () => {
  const [seed, sourcePolicy, pipelinePolicy, previous, startupStats, radar, metricHistory, volatileMetricAudit, metricGovernance, newsPolicy, collectionHealth, marketReverificationQueue, priceChangeFlags, officialSourceRegistry, opportunityPolicy, market, monetization] = await Promise.all([
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
    readJson("market.json", { records: [] }),
    readJson("monetization.json", { companies: [] }),
  ]);
  const generatedAt = new Date().toISOString();
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
    return {
      ...signal,
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

  const semanticThreshold = Number(sourcePolicy.deduplication.threshold || 0.85);
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
    signals,
    market,
    monetization,
    previous,
    generatedAt,
  });
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
  };
  const snapshotVersion = stableHash(snapshotCore);
  const changedSignals = signals.filter(signal => {
    const before = previousSignals.get(signal.id);
    return before && stableHash({ ...before, sourceFreshness: undefined, verificationSla: undefined, validation: undefined }) !== stableHash({ ...signal, sourceFreshness: undefined, verificationSla: undefined, validation: undefined });
  }).length;

  const output = {
    generatedAt,
    asOf: seed.asOf,
    schemaVersion: 8,
    snapshotVersion,
    database: {
      mode: "mx-decision-intelligence",
      lifecycle: "raw-draft-verified-reviewed-published-reconciled",
      publicRetention: "active-plus-master-data",
      archiveAfterDays: sourcePolicy.archive.afterDays,
      deduplication: sourcePolicy.deduplication,
      previousSnapshotVersion: previous.snapshotVersion || "",
      changedSignals,
      storage: "versioned-json",
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
      evidencePoolSize: opportunityGeneration.evidencePoolSize,
      candidates: opportunityGeneration.candidates.length,
      published: opportunityGeneration.published,
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
