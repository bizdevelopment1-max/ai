#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const [database, manifest, governance, scoringPolicy] = await Promise.all([
  readJson("mobile-ai-business-view.json"),
  readJson("dataset-manifest.json"),
  readJson("config/decision-governance.json"),
  readJson("config/opportunity-generation.json"),
]);
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };
const control = database.publicationControl || {};
const gate = governance.publicationGate || {};
const requiredAxes = governance.taxonomy?.axes || [];
const evidenceIds = new Set((database.evidenceSpans || []).map(row => row.evidenceSpanId));
const documentIds = new Set((database.evidenceSpans || []).map(row => row.documentId));
const claimIds = new Set();

for (const claim of database.claims || []) {
  expect(!claimIds.has(claim.claimId), `${claim.claimId}: duplicate claim id`);
  claimIds.add(claim.claimId);
  expect((claim.evidenceSpanIds || []).length > 0, `${claim.claimId}: no evidence span`);
  expect((claim.evidenceSpanIds || []).every(id => evidenceIds.has(id)), `${claim.claimId}: unresolved evidence span`);
  expect((claim.documentIds || []).length > 0 && claim.documentIds.every(id => documentIds.has(id)), `${claim.claimId}: unresolved document`);
  for (const field of governance.temporal?.requiredFields || []) expect(field in claim, `${claim.claimId}: temporal field missing: ${field}`);
  for (const axis of requiredAxes) expect(Array.isArray(claim.taxonomy?.[axis]) && claim.taxonomy[axis].length, `${claim.claimId}: taxonomy axis missing: ${axis}`);
}

const records = [...(database.signals || []), ...(database.generatedOpportunities || [])];
for (const record of records) {
  expect((record.claimIds || []).length > 0 && record.claimIds.every(id => claimIds.has(id)), `${record.id}: unresolved claim linkage`);
  expect((record.evidenceIds || []).length > 0, `${record.id}: evidence linkage missing`);
  for (const axis of requiredAxes) expect(Array.isArray(record.taxonomy?.[axis]) && record.taxonomy[axis].length, `${record.id}: taxonomy axis missing: ${axis}`);
}

const scoringDimensions = governance.opportunityScoring?.dimensions || [];
expect(scoringDimensions.reduce((sum, row) => sum + Number(row.weight || 0), 0) === 100, "opportunity scoring weights must total 100");
expect(JSON.stringify(scoringPolicy.scoreWeights) === JSON.stringify(Object.fromEntries(scoringDimensions.map(row => [row.id, row.weight]))), "scoring config and governance rubric differ");
for (const opportunity of database.generatedOpportunities || []) {
  expect(opportunity.rubricVersion === governance.opportunityScoring?.rubricVersion, `${opportunity.id}: rubric version mismatch`);
  expect(opportunity.scoredBy?.id === governance.opportunityScoring?.scorer, `${opportunity.id}: scorer identity missing`);
  expect((opportunity.scorecard || []).length === scoringDimensions.length, `${opportunity.id}: incomplete scorecard`);
  expect((opportunity.scorecard || []).every(row => row.evidenceIds?.length), `${opportunity.id}: score dimension lacks evidence`);
  const recomputed = Number((opportunity.scorecard || []).reduce((sum, row) => sum + Number(row.weightedPoints || 0), 0).toFixed(1));
  expect(Math.abs(recomputed - Number(opportunity.opportunityScore)) <= 0.1, `${opportunity.id}: score does not reconcile`);
}

const publishedRecords = [
  ...(database.signals || []).filter(row => row.workflow?.stage === "published").map(row => row.id),
  ...(database.generatedOpportunities || []).filter(row => row.status === "published" || row.workflow?.stage === "published").map(row => row.id),
  ...(database.claims || []).filter(row => row.workflowStage === "published").map(row => row.claimId),
];
if (publishedRecords.length) {
  expect(control.state === "published", "published records require publicationControl.state=published");
  expect(control.approvalStatus === gate.approvalStatusRequired, "published records require approved status");
  expect(Boolean(control.reviewerId), "published records require reviewer id");
  expect(control.verifiedClaimRatio >= Number(gate.minimumVerifiedClaimRatio), "published records fail verified claim ratio");
  expect(control.citationCompleteness === Number(gate.requiredCitationCompleteness), "published records fail citation completeness");
  expect(control.criticalPolicyViolations <= Number(gate.criticalPolicyViolationsAllowed), "published records contain critical policy violations");
}
if (["working", "staging"].includes(control.state)) expect(publishedRecords.length === 0, `${control.state} decision view contains published records`);
expect(control.publishedInvariantSatisfied === true, "publication invariant is not satisfied");
expect(Array.isArray(control.publicationBlockingChecks), "publication blocking check IDs are missing");
expect(control.criticalPolicyViolations >= control.publicationBlockingChecks.length, "critical policy violation count is smaller than its blocking-check lineage");
expect(database.claimSummary?.citationCompleteness === control.citationCompleteness, "claim and publication citation summaries differ");
expect(database.claimSummary?.verifiedClaimRatio === control.verifiedClaimRatio, "claim and publication verification summaries differ");

expect(manifest.publicationState === control.state || (manifest.publicationState === "working" && control.state === "staging"), "manifest and decision publication states differ");
if (manifest.publicationState === "published") {
  expect(manifest.approval?.status === "approved" && Boolean(manifest.approval?.reviewerId), "published manifest lacks approval identity");
  expect(control.state === "published", "published manifest points to a non-published decision view");
}
if (manifest.storage?.migrationRequired && manifest.storage?.externalImmutableStore !== "configured") {
  expect(manifest.publicationState !== "published", "published manifest bypassed required external immutable storage");
  expect(manifest.storage?.migrationGate === "staging-warning", "migration debt is not explicit in staging manifest");
}

if (errors.length) {
  console.error(`[publication-policy] ${errors.length} violation(s)`);
  errors.slice(0, 50).forEach(error => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`[publication-policy] ${database.claims.length} claims · ${database.evidenceSpans.length} spans · ${publishedRecords.length} published records · ${manifest.storage?.migrationGate || "unknown"}`);
