#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const readJson = async (path, fallback = {}) => { try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; } };
const minutesOld = value => {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? Math.max(0, (Date.now() - parsed) / 60_000) : null;
};
const [policy, health, quality, queue, version, sourceReport, manifest] = await Promise.all([
  readJson("config/slo-policy.json"), readJson("collection-health.json"), readJson("quality.json"),
  readJson("market-reverification-queue.json"), readJson("data-version.json"),
  readJson("source-collection-report.json"), readJson("dataset-manifest.json"),
]);
const queueRows = queue.rows || queue.queue || [];
const p0 = queueRows.filter(row => row.priority === "P0");
const p1 = queueRows.filter(row => row.priority === "P1");
const oldestP0Hours = p0.reduce((oldest, row) => {
  const age = minutesOld(row.queuedAt || row.firstSeenAt || row.publishedAt || row.date);
  return age == null ? oldest : Math.max(oldest, age / 60);
}, 0);
const directEvidence = (quality.checks || []).find(row => row.id === "market-db-source");
const directEvidenceMatch = String(directEvidence?.value || "").match(/([\d.]+)%/);
const directEvidenceRate = directEvidenceMatch ? Number(directEvidenceMatch[1]) / 100 : null;
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  policyVersion: policy.version,
  hardTier0SlaClaimed: false,
  metrics: {
    sourceFreshnessLagMinutes: minutesOld(sourceReport.generatedAt),
    publicSnapshotAgeMinutes: minutesOld(version.generatedAt),
    directEvidence: directEvidence?.value || "unknown",
    directEvidenceRate,
    directEvidenceTarget: policy.qualityTargets?.directEvidenceRate ?? null,
    directEvidenceWithinSlo: directEvidenceRate != null && directEvidenceRate >= Number(policy.qualityTargets?.directEvidenceRate || 0),
    p0ReverificationQueue: p0.length,
    p1ReverificationQueue: p1.length,
    p0ReverificationQueueOldestHours: Number(oldestP0Hours.toFixed(1)),
    currentSourceFailures: (health.failedStreams || []).length,
    persistentSourceFailures: (health.watchdogBreaches || []).filter(row => row.state === "failed").length,
    persistentEmptyStreams: (health.watchdogBreaches || []).filter(row => row.state === "empty").length,
    datasetVersion: manifest.datasetVersion || null,
  },
  serviceClasses: policy.serviceClasses || [],
};
await writeFile("slo-report.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(`[slo] failures ${report.metrics.currentSourceFailures}/${report.metrics.persistentSourceFailures} persistent · P0 queue ${p0.length}`);
