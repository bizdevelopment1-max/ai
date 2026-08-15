#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { hasRestrictedPublicCopy } from "./public-copy.mjs";

const readJson = async file => JSON.parse(await readFile(file, "utf8"));
const fail = message => { throw new Error(message); };

const [database, sourcePolicy, pipelinePolicy, newsPolicy, boards, styles, crawler, officialSources, watchdogWorkflow, verificationQueue, priceFlags, qualityThresholds, monetization, monetizationReviewQueue] = await Promise.all([
  readJson("mobile-ai-business-view.json"),
  readJson("config/mx-source-policy.json"),
  readJson("config/intelligence-pipeline.json"),
  readJson("config/news-policy.json"),
  readFile("boards.jsx", "utf8"),
  readFile("styles.css", "utf8"),
  readFile("scripts/crawl-news.mjs", "utf8"),
  readJson("config/official-source-registry.json"),
  readFile(".github/workflows/collection-watchdog.yml", "utf8"),
  readJson("market-reverification-queue.json"),
  readJson("price-change-flags.json"),
  readJson("config/quality-thresholds.json"),
  readJson("monetization.json"),
  readJson("monetization-review-queue.json"),
]);

if (database.schemaVersion < 3 || database.database?.mode !== "mx-decision-intelligence") fail("MX schema v3 is not active");
if ((database.signals || []).length < 12) fail("MX signal coverage is below the minimum");
if ((database.deviceMatrix || []).length < 8 || !(database.deviceMatrix || []).some(row => row.isSelf && row.security)) fail("Direct device competitor matrix and Galaxy security benchmark are incomplete");
if ((database.regulations || []).length < 4) fail("Global compliance coverage is incomplete");
if ((database.decisionTree || []).length < 4) fail("Build vs Buy decision tree is incomplete");
if (database.schemaVersion < 4) fail("MX monetization and agent schema v4 is not active");
if ((database.sidebarCategories || []).length !== 3) fail("MX priority sidebar categories are incomplete");
if ((database.monetizationModels || []).length !== 7 || (database.pricingBenchmarks || []).length < 5) fail("AI monetization model coverage is incomplete");
if ((database.osAgentStack || []).length < 7 || (database.uxUseCases || []).length < 7) fail("OS agent and killer UX coverage is incomplete");
if ((database.partnershipNetwork?.edges || []).length < 5) fail("AI partnership network is incomplete");
if ((database.formFactors || []).length < 7 || (database.hardwareSlmTrack || []).length < 4) fail("form-factor and SLM tracks are incomplete");
if (database.consumerPainPointTrack?.status !== "connector-required") fail("consumer pain-point mining must not publish synthetic rankings");
if (database.schemaVersion < 8) fail("decision-intelligence schema v8 is not active");
if ((database.securityBusinessCases?.offers || []).length < 3 || (database.securityBusinessCases?.competitiveTiming || []).length < 3) fail("on-device trust business case is incomplete");
if ((database.healthMonetizationLadder || []).length !== 3 || !String(database.healthMonetizationLadder[0]?.mixClaim).includes("게시 보류")) fail("health monetization evidence gate is incomplete");
if ((database.companionEconomics?.headlineMetrics || []).length < 5 || (database.companionEconomics?.comparisons || []).length < 3) fail("companion economics coverage is incomplete");
if (database.comparisonAudit?.invalid !== 0 || database.comparisonAudit?.comparable !== 1 || database.comparisonAudit?.blocked < 2) fail("metric comparison guardrail failed");
if ((database.opportunityPartnerLinks || []).length < 10) fail("opportunity-to-partner mapping is incomplete");
if ((database.generatedOpportunities || []).length < Number(qualityThresholds.minimumGeneratedOpportunities || 10) || (database.generatedOpportunities || []).length > Number(qualityThresholds.maximumGeneratedOpportunities || 20)) fail("monthly opportunity candidate target is not satisfied");
if ((database.experimentShortlist || []).length > Number(qualityThresholds.maximumExperimentShortlist || 3)) fail("experiment shortlist exceeds the configured limit");
if ((database.assetOpportunityMatrix || []).length < 8) fail("asset-to-opportunity matrix is incomplete");
for (const opportunity of database.generatedOpportunities || []) {
  if (!Number.isFinite(opportunity.signalScore) || !Number.isFinite(opportunity.opportunityScore) || !Number.isFinite(opportunity.ownAssetFit)) fail(`${opportunity.id}: score fields are incomplete`);
  if (!opportunity.evidenceConfidence || !opportunity.experimentPlan?.nextDecisionAt) fail(`${opportunity.id}: confidence or experiment plan is incomplete`);
  if (opportunity.status === "published" && (opportunity.evidenceCount < 2 || opportunity.independentSources < 2)) fail(`${opportunity.id}: evidence gate bypassed`);
}
const foldable = (database.formFactors || []).find(item => item.id === "foldable");
const satellite = (database.formFactors || []).find(item => item.id === "satellite");
if (!foldable?.businessOption || !foldable?.boundary || !foldable?.sourceUrl) fail("foldable local-AI business case is incomplete");
if (!satellite?.businessOption || !satellite?.boundary || !satellite?.sourceUrl) fail("satellite AI-continuity business case is incomplete");
if ((database.partnershipNetwork?.edges || []).filter(edge => edge.contractType?.includes("위성")).length < 2) fail("satellite carrier partnership evidence is incomplete");
if ((verificationQueue.queue || []).length !== verificationQueue.total || verificationQueue.targetDirectEvidenceRate !== Number(qualityThresholds.directMarketEvidenceRate || 0.9)) fail("market reverification queue is incomplete");
if ((priceFlags.rows || []).length < 2 || priceFlags.summary?.pendingVerification === undefined) fail("price change diff flags are incomplete");
if (monetization.schemaVersion < 3) fail("commercial classification gate is not active");
if ((monetization.companies || []).flatMap(company => company.monetize || []).some(row => row.classificationGate?.status !== "passed")) fail("ungated monetization row reached public output");
if ((monetizationReviewQueue.rows || []).length !== monetizationReviewQueue.total) fail("monetization review queue is incomplete");
if (hasRestrictedPublicCopy(database) || hasRestrictedPublicCopy(monetization) || hasRestrictedPublicCopy(monetizationReviewQueue)) fail("restricted display copy reached public JSON");
for (const comparison of database.companionEconomics?.comparisons || []) {
  if (!comparison.comparisonAllowed && comparison.computedRatio !== null) fail(`${comparison.id}: blocked comparison produced a ratio`);
}

const requiredOwners = new Set(["제품기획팀", "R&D", "서비스기획", "구매"]);
const requiredActions = new Set(["Buy", "Build", "Partner", "Watch", "License"]);
for (const signal of database.signals || []) {
  const axes = signal.decisionAxes || {};
  if (![axes.touchpoint, axes.integration, axes.posture, axes.regions].every(value => Array.isArray(value) && value.length) || !axes.maturity) fail(`${signal.id}: missing MX decision axes`);
  if (!requiredOwners.has(signal.ownerOrg)) fail(`${signal.id}: invalid owner`);
  if (!requiredActions.has(signal.actionOption)) fail(`${signal.id}: invalid action`);
  if (!signal.fact || !signal.implication || !signal.decision) fail(`${signal.id}: FACT/IMPLICATION/DECISION incomplete`);
  if (!signal.mxMapping?.galaxyDifferentiation || !signal.mxMapping?.bomImpact || !signal.mxMapping?.partnershipHistory || !signal.mxMapping?.patentLitigationRisk || !signal.mxMapping?.svicPortfolio) fail(`${signal.id}: MX mapping incomplete`);
  if (signal.validation?.evidenceSpanCount < 3) fail(`${signal.id}: fewer than three evidence spans`);
  if (signal.confidence === "high" && signal.validation?.independentSources < 2) fail(`${signal.id}: high confidence without cross-check`);
  if (signal.priority === "P1" && !(signal.workflow?.humanReview && signal.workflow?.reviewStatus === "approved")) fail(`${signal.id}: P1 bypassed human review`);
  if (signal.validation?.status !== "passed") fail(`${signal.id}: validation flag`);
}

const expectedPublishers = ["36Kr", "TechNode", "Nikkei XTECH", "ITmedia", "Inc42", "YourStory", "ETNews", "ZDNet Korea", "The Elec", "DigiTimes"];
const publisherNames = new Set((sourcePolicy.regionalPublishers || []).map(source => source.name));
for (const publisher of expectedPublishers) if (!publisherNames.has(publisher)) fail(`missing publisher: ${publisher}`);

const expectedPrimary = ["USPTO Open Data", "KIPRIS", "CNIPA patent publication", "SEC EDGAR", "DART", "arXiv", "Hugging Face model cards", "GitHub Trending", "Google Play", "Apple App Store", "FCC", "KC", "China 3C"];
const primaryNames = new Set((sourcePolicy.primarySources || []).map(source => source.name));
for (const source of expectedPrimary) if (!primaryNames.has(source)) fail(`missing primary source: ${source}`);
if (!crawler.includes("PRIMARY_SOURCE_TOPICS") || !crawler.includes("primarySource: PRIMARY_SOURCE_TOPICS.length")) fail("primary-source streams are not scheduled in the crawler");
if ((officialSources.officialFeeds || []).length < 5 || (officialSources.apiConnectors || []).length < 5 || (officialSources.sitemaps || []).length < 15) fail("direct official source registry is incomplete");
if (!crawler.includes("recovered-by-official-fallback") || !crawler.includes("consecutiveEmptyRuns") || !watchdogWorkflow.includes("issues: write")) fail("persistent empty-stream fallback/watchdog is incomplete");

for (const term of ["SK hynix", "Micron", "memory", "DRAM", "NAND"]) {
  if ((newsPolicy.excludedTerms || []).some(item => String(item).toLowerCase() === term.toLowerCase())) fail(`supply-chain term remains excluded: ${term}`);
}
const collectionCategoryIds = new Set((newsPolicy.mxCollectionCategories || []).map(item => item.id));
for (const id of ["on-device-trust-security", "clinical-health-ai", "ai-companion-economics"]) {
  if (!collectionCategoryIds.has(id)) fail(`missing MX collection category: ${id}`);
}
for (const label of ["온디바이스 신뢰·보안", "임상·보험형 헬스 AI", "AI 컴패니언 경제성"]) {
  if (!crawler.includes(label)) fail(`missing scheduled MX topic: ${label}`);
}

if (sourcePolicy.deduplication?.threshold !== 0.85 || !String(sourcePolicy.deduplication?.strategy).includes("embedding")) fail("semantic deduplication policy is not active");
if (pipelinePolicy.publishing?.automatedMerge !== false || pipelinePolicy.publishing?.minimumApprovals !== 1) fail("human approval publishing policy is incomplete");
if (database.audit?.numericEvidenceFlags !== 0 || database.pipeline?.flagged !== 0) fail("MX audit has unresolved flags");

for (const label of ["Decision Radar", "기회 후보·90일 실험", "단말·기능 Matrix", "수익화·ROI", "OS·Killer UX", "보안·헬스·컴패니언", "ON-DEVICE TRUST · B2B2C", "HEALTH MONETIZATION LADDER", "AI COMPANION ECONOMICS", "COMPARISON FRAMEWORK", "Partner Score", "PARTNERSHIP NETWORK", "폼팩터·SLM", "가격 변경 감지", "정량 DB 재검증 큐", "빈 스트림 official 폴백", "Compliance", "Build vs Buy · Trust", "예상 BOM 영향", "특허·소송 리스크"]) {
  if (!boards.includes(label)) fail(`UI contract missing: ${label}`);
}
if (!styles.includes(".mxc-radar-layout") || !styles.includes(".mxc-generated-grid") || !styles.includes(".mxc-experiment-grid") || !styles.includes(".mxc-partner-grid") || !styles.includes(".mxc-reg-grid") || !styles.includes(".mxc-security-proof-grid") || !styles.includes(".mxc-health-ladder") || !styles.includes(".mxc-comparison-grid")) fail("responsive visual system is incomplete");

console.log(`mx-intelligence: ok · ${database.signals.length} signals · ${database.summary.sourceUrls} sources · ${database.clusters.length} clusters`);
