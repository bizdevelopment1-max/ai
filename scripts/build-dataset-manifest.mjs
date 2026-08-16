#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const readJson = async (path, fallback = {}) => {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
};
const sha256 = value => createHash("sha256").update(value).digest("hex");
const getPath = (value, dotted) => String(dotted || "").split(".").filter(Boolean).reduce((current, key) => current?.[key], value);

async function fingerprint(path) {
  const info = await stat(path);
  if (info.isFile()) {
    const bytes = await readFile(path);
    return { bytes: info.size, sha256: sha256(bytes), files: 1 };
  }
  const files = [];
  const walk = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const child = join(directory, entry.name);
      if (entry.isDirectory()) await walk(child);
      else files.push(child.replaceAll("\\", "/"));
    }
  };
  await walk(path);
  files.sort();
  const rows = await Promise.all(files.map(async file => ({ file, bytes: await readFile(file) })));
  return {
    bytes: rows.reduce((total, row) => total + row.bytes.length, 0),
    sha256: sha256(rows.map(row => `${row.file}\0${sha256(row.bytes)}`).join("\n")),
    files: rows.length,
  };
}

const [catalog, storage, quality, contracts, sourceRegistry, qualityPolicy, llmHealth, pipelinePolicy, decisionGovernance] = await Promise.all([
  readJson("config/data-catalog.json"),
  readJson("config/storage-backends.json"),
  readJson("quality.json"),
  readJson("config/data-contracts.json"),
  readJson("config/official-source-registry.json"),
  readJson("config/quality-thresholds.json"),
  readJson("llm-health.json"),
  readJson("config/intelligence-pipeline.json"),
  readJson("config/decision-governance.json"),
]);
const datasets = [];
for (const dataset of catalog.datasets || []) {
  try {
    const print = await fingerprint(dataset.path);
    let recordCount = null;
    if (dataset.recordPath && String(dataset.path).endsWith(".json")) {
      const parsed = await readJson(dataset.path);
      const records = getPath(parsed, dataset.recordPath);
      recordCount = Array.isArray(records) ? records.length : null;
    }
    datasets.push({
      id: dataset.id,
      path: dataset.path,
      role: dataset.role,
      sensitivity: dataset.sensitivity,
      publication: dataset.publication,
      recordCount,
      ...print,
      migrationTriggerExceeded: print.bytes >= Number(storage.migrationTriggerMb || 1) * 1_048_576,
    });
  } catch (error) {
    datasets.push({ id: dataset.id, path: dataset.path, status: "unavailable", error: error.message });
  }
}

const createdAt = new Date().toISOString();
const codeGitSha = process.env.GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const policyFiles = [
  "config/intelligence-pipeline.json",
  "config/news-policy.json",
  "config/official-source-registry.json",
  "config/source-independence.json",
  "config/slo-policy.json",
  "config/decision-governance.json",
  "config/dedup-calibration.json",
];
const policyHash = sha256((await Promise.all(policyFiles.map(async file => `${file}\0${sha256(await readFile(file))}`))).join("\n"));
const catalogHash = sha256(await readFile("config/data-catalog.json", "utf8"));
const datasetVersion = sha256(JSON.stringify({ codeGitSha, policyHash, catalogHash, datasets: datasets.map(row => [row.id, row.sha256]) })).slice(0, 24);
const checks = quality.checks || [];
const publicationState = process.env.DATASET_PUBLICATION_STATE || "working";
const reviewerId = String(process.env.DATASET_REVIEWER_ID || process.env.DATASET_APPROVED_BY || "").trim() || null;
const approvalStatus = String(process.env.DATASET_APPROVAL_STATUS || (reviewerId ? "approved" : "pending")).toLowerCase();
const migrationRequired = datasets.some(row => row.migrationTriggerExceeded);
const externalStoreConfigured = Boolean(process.env.DATA_LAKE_ROOT);
if (publicationState === "published" && (!reviewerId || approvalStatus !== "approved")) {
  throw new Error("published manifest requires an approved reviewer identity");
}
if (publicationState === "published" && migrationRequired && !externalStoreConfigured
  && decisionGovernance.storageGate?.blockPublishedSnapshotWhenMigrationRequiredAndExternalStoreMissing) {
  throw new Error("published manifest blocked: migration trigger exceeded and DATA_LAKE_ROOT is not configured");
}
const manifest = {
  schemaVersion: 2,
  datasetVersion,
  createdAt,
  pipelineRunId: process.env.GITHUB_RUN_ID || `local-${createdAt}`,
  codeGitSha,
  catalogVersion: catalog.version,
  schemaRegistryVersion: contracts.version,
  sourcePolicyVersion: sourceRegistry.version,
  qualityPolicyVersion: qualityPolicy.version || 1,
  policyHash,
  policyFiles,
  catalogHash,
  publicationState,
  approvedBy: reviewerId,
  approval: {
    status: approvalStatus,
    minimumApprovals: Number(pipelinePolicy.publishing?.minimumApprovals || 1),
    reviewerId,
  },
  previousVersion: (await readJson("dataset-manifest.json")).datasetVersion || null,
  datasets,
  storage: {
    currentMode: storage.currentMode,
    migrationRequired,
    externalImmutableStore: externalStoreConfigured ? "configured" : "not-configured",
    migrationGate: migrationRequired && !externalStoreConfigured
      ? publicationState === "published" ? "blocked" : "staging-warning"
      : "passed",
    recommendedTargets: storage.backends?.map(row => ({ id: row.id, status: row.status })) || [],
  },
  qualitySummary: {
    overall: quality.overall || quality.status || "unknown",
    checks: checks.length,
    ok: checks.filter(row => row.status === "ok").length,
    warn: checks.filter(row => row.status === "warn").length,
    fail: checks.filter(row => row.status === "fail").length,
  },
  modelSummary: {
    externalModelApiCalls: Number(llmHealth.externalModelApiCalls || 0),
    provider: llmHealth.provider || "none",
    model: llmHealth.model || null,
  },
};
await writeFile("dataset-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[dataset-manifest] ${datasetVersion} · ${datasets.length} datasets · migration ${manifest.storage.migrationRequired ? "required" : "not-required"}`);
