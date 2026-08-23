#!/usr/bin/env node
/**
 * Prevents two silent failure modes in the static site:
 * 1) a declared public dataset is generated but never requested by the UI;
 * 2) a removed board keeps crawling and inflating freshness/coverage metrics.
 *
 * Public datasets must be referenced by the production bundle, supporting
 * datasets must be referenced by their deterministic materializer, and
 * retired ledgers must be optional and absent from the public runtime.
 */
import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const read = file => readFile(resolve(root, file), "utf8");
const registry = JSON.parse(await read("config/site-content-registry.json"));
const bundle = await read("app.bundle.js");
const sourceCache = new Map();
const rows = [];
const failures = [];

for (const dataset of registry.datasets || []) {
  const publication = dataset.publication || "public";
  let exists = true;
  try { await access(resolve(root, dataset.path)); } catch { exists = false; }
  let consumed = false;
  let reason = "";

  if (publication === "public") {
    consumed = bundle.includes(dataset.path);
    reason = consumed ? "requested-by-production-bundle" : "dead-public-output";
  } else if (publication === "supporting") {
    if (!dataset.consumer) {
      reason = "supporting-consumer-missing";
    } else {
      if (!sourceCache.has(dataset.consumer)) {
        try { sourceCache.set(dataset.consumer, await read(dataset.consumer)); }
        catch { sourceCache.set(dataset.consumer, ""); }
      }
      consumed = sourceCache.get(dataset.consumer).includes(dataset.path);
      reason = consumed ? `materialized-by:${dataset.consumer}` : "supporting-consumer-does-not-read-output";
    }
  } else if (publication === "retired") {
    consumed = !bundle.includes(dataset.path) && dataset.required === false;
    reason = consumed ? "retained-ledger-not-published" : "retired-output-still-public-or-required";
  } else {
    reason = "unknown-publication-state";
  }

  const status = exists && consumed ? "healthy" : "dead";
  rows.push({
    id: dataset.id,
    path: dataset.path,
    publication,
    collector: dataset.collector,
    consumer: dataset.consumer || null,
    exists,
    consumed,
    status,
    reason,
  });
  if (status !== "healthy") failures.push(`${dataset.id}: ${reason}${exists ? "" : " · file-missing"}`);
}

const count = state => rows.filter(row => row.publication === state).length;
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  summary: {
    public: count("public"),
    supporting: count("supporting"),
    retired: count("retired"),
    dead: rows.filter(row => row.status === "dead").length,
  },
  datasets: rows,
};
await writeFile(resolve(root, "content-lifecycle-report.json"), `${JSON.stringify(report, null, 2)}\n`);

if (failures.length) {
  failures.forEach(failure => console.error(`[content-lifecycle] ${failure}`));
  process.exit(1);
}
console.log(`[content-lifecycle] public ${report.summary.public} · supporting ${report.summary.supporting} · retired ${report.summary.retired} · dead 0`);
