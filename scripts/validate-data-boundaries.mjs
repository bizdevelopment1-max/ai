#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";

const catalog = JSON.parse(await readFile("config/data-catalog.json", "utf8"));
const jekyll = await readFile("_config.yml", "utf8");
const excluded = new Set([...jekyll.matchAll(/^\s*-\s+([^#\r\n]+)\s*$/gm)].map(match => match[1].trim()));
const errors = [];

for (const dataset of catalog.datasets || []) {
  if (dataset.publication !== "never") continue;
  const root = String(dataset.path || "").split(/[\\/]/)[0];
  if (!excluded.has(dataset.path) && !excluded.has(root)) errors.push(`${dataset.path}: private dataset is not excluded from Pages`);
}

const forbidden = new Set((catalog.sensitiveFieldPolicy?.publicForbiddenKeys || []).map(value => value.toLowerCase()));
const scanKeys = (value, path, hits) => {
  if (Array.isArray(value)) return value.forEach((item, index) => scanKeys(item, `${path}[${index}]`, hits));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key.toLowerCase())) hits.push(`${path}.${key}`);
    scanKeys(child, `${path}.${key}`, hits);
  }
};

for (const dataset of (catalog.datasets || []).filter(row => row.publication === "public" && String(row.path).endsWith(".json"))) {
  try {
    if (!(await stat(dataset.path)).isFile()) continue;
    const hits = [];
    scanKeys(JSON.parse(await readFile(dataset.path, "utf8")), dataset.path, hits);
    if (hits.length) errors.push(`${dataset.path}: forbidden public fields ${hits.slice(0, 5).join(", ")}`);
  } catch (error) {
    errors.push(`${dataset.path}: ${error.message}`);
  }
}

if (errors.length) {
  errors.forEach(error => console.error(`[data-boundary] ${error}`));
  process.exit(1);
}
console.log(`[data-boundary] ${(catalog.datasets || []).length} dataset boundaries valid`);
