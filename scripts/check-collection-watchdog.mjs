#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const DAY = 86_400_000;
const health = JSON.parse(await readFile("collection-health.json", "utf8"));
const policy = health.watchdogPolicy || { emptyRunLimit: 3, emptyDayLimit: 3 };
const now = new Date();
const ageDays = value => {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? Math.max(0, (now.getTime() - time) / DAY) : 0;
};

const breaches = (health.streamHealth || [])
  // Topic discovery queries can legitimately be quiet. They are useful for
  // opportunistic breadth but are not a data field or a source connector, so
  // an empty optional query must not open a false "dead stream" incident.
  // Critical official feeds/APIs still retain the same strict watchdog.
  .filter(row => row.criticality !== "optional-topic" && ["empty", "failed"].includes(row.state))
  .map(row => ({
    stream: row.stream,
    state: row.state,
    consecutiveEmptyRuns: Number(row.consecutiveEmptyRuns || 0),
    consecutiveFailureRuns: Number(row.consecutiveFailureRuns || 0),
    emptyDays: Number(ageDays(row.emptySince).toFixed(1)),
    failureDays: Number(ageDays(row.failureSince).toFixed(1)),
    emptySince: row.emptySince || null,
    failureSince: row.failureSince || null,
    lastSuccessAt: row.lastSuccessAt || null,
    error: row.error || null,
  }))
  .filter(row => row.consecutiveEmptyRuns >= Number(policy.emptyRunLimit || 3)
    || row.emptyDays >= Number(policy.emptyDayLimit || 3)
    || row.consecutiveFailureRuns >= Number(policy.failureRunLimit || policy.emptyRunLimit || 3)
    || row.failureDays >= Number(policy.failureDayLimit || policy.emptyDayLimit || 3))
  .sort((left, right) => right.consecutiveFailureRuns - left.consecutiveFailureRuns
    || right.consecutiveEmptyRuns - left.consecutiveEmptyRuns
    || Math.max(right.failureDays, right.emptyDays) - Math.max(left.failureDays, left.emptyDays));

const report = {
  generatedAt: now.toISOString(),
  sourceGeneratedAt: health.generatedAt || null,
  policy,
  status: breaches.length ? "action-required" : "healthy",
  breachCount: breaches.length,
  breaches,
  optionalQuietStreams: (health.streamHealth || [])
    .filter(row => row.criticality === "optional-topic" && row.state === "empty")
    .map(row => ({ stream: row.stream, consecutiveEmptyRuns: Number(row.consecutiveEmptyRuns || 0) })),
  recoveredStreams: health.recoveredStreams || [],
  credentialGatedConnectors: (health.connectorStatus || []).filter(row => row.status === "credential-gated"),
};

if (process.argv.includes("--write")) {
  await writeFile("collection-watchdog.json", `${JSON.stringify(report, null, 2)}\n`);
}
console.log(`[collection-watchdog] ${report.status} · ${breaches.length} persistent empty stream(s)`);
if (process.argv.includes("--strict") && breaches.length) process.exitCode = 2;
