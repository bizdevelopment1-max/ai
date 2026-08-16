#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const inputArg = process.argv.find(value => value.startsWith("--input="));
const input = inputArg?.slice("--input=".length) || process.env.DEDUP_GOLD_SET || "";
const write = process.argv.includes("--write");
const configPath = "config/dedup-calibration.json";
const config = JSON.parse(await readFile(configPath, "utf8"));

if (!input) {
  console.log(`[dedup-calibration] ${config.status} · target ${config.goldSet.targetPairs}-${config.goldSet.stretchTargetPairs} labeled pairs · current thresholds remain provisional`);
  process.exit(0);
}

const vector = (text, dimensions) => {
  const normalized = String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = normalized.split(" ").filter(token => token.length > 1);
  const features = [...tokens, ...tokens.slice(0, -1).map((token, index) => `${token}_${tokens[index + 1]}`)];
  const result = new Float64Array(dimensions);
  for (const feature of features) {
    let hash = 2166136261;
    for (const char of feature) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    result[Math.abs(hash) % dimensions] += 1;
  }
  return result;
};

const cosine = (left, right) => {
  let dot = 0;
  let a = 0;
  let b = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    a += left[index] ** 2;
    b += right[index] ** 2;
  }
  return a && b ? dot / Math.sqrt(a * b) : 0;
};

const rows = (await readFile(input, "utf8"))
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line, index) => {
    const row = JSON.parse(line);
    if (!config.goldSet.requiredLabels.includes(row.label) || !row.leftText || !row.rightText || !row.corpus) {
      throw new Error(`gold row ${index + 1}: invalid contract`);
    }
    return {
      ...row,
      similarity: cosine(vector(row.leftText, config.embeddingDimensions), vector(row.rightText, config.embeddingDimensions))
    };
  });

if (rows.length < config.goldSet.targetPairs) {
  throw new Error(`gold set needs at least ${config.goldSet.targetPairs} pairs; received ${rows.length}`);
}

const metricsAt = (items, threshold) => {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const row of items) {
    const predicted = row.similarity >= threshold;
    const actual = row.label === "same-event";
    if (predicted && actual) tp += 1;
    else if (predicted) fp += 1;
    else if (actual) fn += 1;
  }
  return {
    threshold,
    precision: tp + fp ? tp / (tp + fp) : 1,
    recall: tp + fn ? tp / (tp + fn) : 0,
    tp,
    fp,
    fn
  };
};

const thresholds = Array.from({ length: 51 }, (_, index) => Number((0.7 + index * 0.005).toFixed(3)));
const corpora = [...new Set(rows.map(row => row.corpus))];
const results = {};
for (const corpus of corpora) {
  const items = rows.filter(row => row.corpus === corpus);
  const candidates = thresholds.map(threshold => metricsAt(items, threshold));
  const chosen = candidates
    .filter(row => row.precision >= 0.98)
    .sort((left, right) => right.recall - left.recall || left.threshold - right.threshold)[0]
    || candidates.sort((left, right) => right.precision - left.precision || right.recall - left.recall)[0];
  results[corpus] = { ...chosen, labeledPairs: items.length, calibrated: true };
}

console.log(JSON.stringify(results, null, 2));
if (write) {
  config.status = "calibrated";
  config.calibratedAt = new Date().toISOString();
  config.goldSet.actualPairs = rows.length;
  config.corpusThresholds = { ...config.corpusThresholds, ...results };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`[dedup-calibration] wrote ${corpora.length} corpus thresholds from ${rows.length} labeled pairs`);
}
