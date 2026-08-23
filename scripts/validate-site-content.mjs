#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const readJson = async path => JSON.parse(await readFile(resolve(root, path), "utf8"));
const registry = await readJson("config/site-content-registry.json");
const manifest = await readJson("site-content-manifest.json");
const byId = new Map((manifest.datasets || []).map(dataset => [dataset.id, dataset]));
const errors = [];
const lifecycleStates = new Set(registry.publicationPolicy?.lifecycleStates || []);

if (registry.publicationPolicy?.allowMutableUiFallbacks !== false) {
  errors.push("Mutable UI fallbacks must remain disabled.");
}
for (const dataset of registry.datasets || []) {
  const publication = dataset.publication || "public";
  if (!lifecycleStates.has(publication)) errors.push(`${dataset.id}: unsupported publication state '${publication}'`);
  if (publication === "retired" && dataset.required !== false) errors.push(`${dataset.id}: retired dataset must be optional`);
  if (publication === "supporting" && !dataset.consumer) errors.push(`${dataset.id}: supporting dataset needs a deterministic consumer`);
  const actual = byId.get(dataset.id);
  if (!actual) {
    errors.push(`${dataset.id}: missing from site-content-manifest.json`);
    continue;
  }
  try { await stat(resolve(root, dataset.path)); } catch { errors.push(`${dataset.id}: ${dataset.path} does not exist`); }
  if (publication !== "retired" && dataset.required && actual.recordCount === 0) errors.push(`${dataset.id}: required dataset is empty`);
  if (publication !== "retired" && dataset.required && actual.status === "missing") errors.push(`${dataset.id}: required dataset is missing`);
}

const app = await readFile(resolve(root, "app.jsx"), "utf8");
const boards = await readFile(resolve(root, "boards.jsx"), "utf8");
if (/DEVICE_CO_MAP/.test(app)) errors.push("app.jsx still performs mutable company classification in the browser");
if (/strategyData\s*\|\|\s*\{\s*\.\.\.\(window\.DASH\.DECISION_FRAMEWORK/.test(boards)) {
  errors.push("MobileStrategyBoard still falls back to a bundled decision framework");
}
const newBizBoard = boards.match(/function NewBizBoard[\s\S]*?\n}\n\n\/\//)?.[0] || "";
if (/<NewBizDeepDive\s*\/>|<ForwardDeployedAIModel\s*\/>|<AIConsultingBuildSection\s*\/>|<VerticalIntegrationTables\s*\/>/.test(newBizBoard)) {
  errors.push("NewBizBoard still renders mutable hardcoded business examples");
}

if (errors.length) {
  console.error(`[site-content] ${errors.length} error(s)`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}
const publicCount = (registry.datasets || []).filter(dataset => dataset.publication === "public").length;
const supportingCount = (registry.datasets || []).filter(dataset => dataset.publication === "supporting").length;
const retiredCount = (registry.datasets || []).filter(dataset => dataset.publication === "retired").length;
console.log(`[site-content] public ${publicCount} · supporting ${supportingCount} · retired ${retiredCount} · generated views only · OK`);
