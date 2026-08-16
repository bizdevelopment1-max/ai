#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";

const read = path => readFile(path, "utf8");
const json = async path => JSON.parse(await read(path));
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const [catalog, contracts, storage, slo, pipeline, registry, packageJson, jekyll, index, sourceContent, marketCrawler, sourceCompliance, decisionGovernance, publicationValidator] = await Promise.all([
  json("config/data-catalog.json"),
  json("config/data-contracts.json"),
  json("config/storage-backends.json"),
  json("config/slo-policy.json"),
  json("config/intelligence-pipeline.json"),
  json("config/official-source-registry.json"),
  json("package.json"),
  read("_config.yml"),
  read("index.html"),
  read("scripts/source-content.mjs"),
  read("scripts/crawl-markets.mjs"),
  json("source-compliance-report.json"),
  json("config/decision-governance.json"),
  read("scripts/validate-publication-policy.mjs"),
]);

expect(storage.migrationRequired === true, "storage migration must remain explicit until an external backend is configured");
expect(storage.currentMode === "git-manifest-and-materialized-views", "Git must be limited to manifests and materialized views");
expect(pipeline.temporalModel?.mode === "bitemporal", "the normalized data contract must be bitemporal");
expect(pipeline.lanes?.decisionPublication?.minimumApprovals === 1, "decision publication requires one reviewer");
expect(pipeline.sourceIndependence?.sameWireCopyCountsAsOne === true, "syndicated copies must count as one source");
expect((decisionGovernance.taxonomy?.axes || []).length === 16, "decision taxonomy must preserve 16 independent axes");
expect((decisionGovernance.opportunityScoring?.dimensions || []).reduce((sum, row) => sum + row.weight, 0) === 100, "opportunity rubric weights must total 100");
expect(publicationValidator.includes("publishedRecords") && publicationValidator.includes("citationCompleteness") && publicationValidator.includes("reviewerId"), "publication invariant validator is incomplete");
expect((await read("scripts/build-mobile-ai-business-db.mjs")).includes("independentSourceKey"), "decision confidence must use owner-aware source independence");
expect(registry.compliancePolicy?.fullTextStorageDefault === false, "publisher full text must not be retained by default");
expect(registry.storagePolicy?.publisherContentRetention === "evidence-spans-only", "long-lived publisher text must be evidence-only");
for (const source of sourceCompliance.sources || []) {
  for (const field of registry.compliancePolicy?.requiredCatalogFields || []) {
    expect(Object.prototype.hasOwnProperty.call(source, field), `${source.sourceId}: compliance field missing: ${field}`);
  }
}
expect(sourceContent.includes('retentionMode: "transient-fulltext"'), "source extraction must mark full text as transient");
expect(marketCrawler.includes("candidateBudgetFor") && marketCrawler.includes("p0ReverificationBacklog"), "market discovery must slow down when verification debt is high");

const tier0 = (slo.serviceClasses || []).find(item => item.tier === "Tier 0");
expect(tier0?.targetMinutes === 30 && tier0?.guaranteed === false, "Tier 0 must disclose the 30-minute target without claiming a scheduler guarantee");

for (const script of ["build:manifest", "build:slo", "build:source-compliance", "archive:immutable", "minimize:source-content", "normalize:temporal", "validate:contracts", "validate:publication", "calibrate:dedup", "validate:boundaries", "validate:dag"]) {
  expect(Boolean(packageJson.scripts?.[script]), `package script missing: ${script}`);
}

for (const dataset of catalog.datasets || []) {
  if (dataset.publication === "never") expect(jekyll.includes(`- ${dataset.path}`), `${dataset.path} must be excluded from the public site`);
}

expect(index.includes("Content-Security-Policy"), "index.html needs a Content Security Policy");
expect((index.match(/integrity="sha384-/g) || []).length >= 2, "runtime CDN scripts need SRI hashes");

const schemaFiles = await readdir("schemas");
for (const schemaFile of schemaFiles.filter(file => file.endsWith(".schema.json"))) {
  const schema = await json(`schemas/${schemaFile}`);
  expect(schema.$schema === contracts.dialect, `${schemaFile} must use the configured JSON Schema dialect`);
}

const workflowFiles = (await readdir(".github/workflows")).filter(file => /\.ya?ml$/i.test(file));
for (const workflowFile of workflowFiles) {
  const workflow = await read(`.github/workflows/${workflowFile}`);
  for (const match of workflow.matchAll(/uses:\s*([^\s#]+)@([^\s#]+)/g)) {
    expect(/^[0-9a-f]{40}$/i.test(match[2]), `${workflowFile}: ${match[1]} must be pinned to a full commit SHA`);
  }
}
for (const workflowFile of ["daily-news.yml", "daily-news-update.yml", "weekly-metric-reverification.yml"]) {
  const workflow = await read(`.github/workflows/${workflowFile}`);
  expect(/group:\s*intelligence-data-writer\b/.test(workflow), `${workflowFile} must share the data-writer lock`);
}

if (failures.length) {
  console.error(`[data-platform-test] ${failures.length} failure(s)`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`[data-platform-test] ${schemaFiles.length} schemas, ${workflowFiles.length} workflows and platform guardrails passed`);
