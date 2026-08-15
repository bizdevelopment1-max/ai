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
  .filter(row => row.state === "empty")
  .map(row => ({
    stream: row.stream,
    consecutiveEmptyRuns: Number(row.consecutiveEmptyRuns || 0),
    emptyDays: Number(ageDays(row.emptySince).toFixed(1)),
    emptySince: row.emptySince || null,
    lastSuccessAt: row.lastSuccessAt || null,
  }))
  .filter(row => row.consecutiveEmptyRuns >= Number(policy.emptyRunLimit || 3)
    || row.emptyDays >= Number(policy.emptyDayLimit || 3))
  .sort((left, right) => right.consecutiveEmptyRuns - left.consecutiveEmptyRuns || right.emptyDays - left.emptyDays);

const report = {
  generatedAt: now.toISOString(),
  sourceGeneratedAt: health.generatedAt || null,
  policy,
  status: breaches.length ? "action-required" : "healthy",
  breachCount: breaches.length,
  breaches,
  recoveredStreams: health.recoveredStreams || [],
  credentialGatedConnectors: (health.connectorStatus || []).filter(row => row.status === "credential-gated"),
};

if (process.argv.includes("--write")) {
  await writeFile("collection-watchdog.json", `${JSON.stringify(report, null, 2)}\n`);
}
console.log(`[collection-watchdog] ${report.status} · ${breaches.length} persistent empty stream(s)`);
if (process.argv.includes("--strict") && breaches.length) process.exitCode = 2;

