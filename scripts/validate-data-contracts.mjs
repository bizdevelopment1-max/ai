#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const stageArg = process.argv.find(value => value.startsWith("--stage="));
const stage = stageArg?.split("=")[1] || "publish";
const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const config = await readJson("config/data-contracts.json");
const errors = [];

const typeMatches = (value, type) => {
  if (Array.isArray(type)) return type.some(candidate => typeMatches(value, candidate));
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
};

function validate(value, schema, path) {
  if (!schema || typeof schema !== "object") return;
  if (schema.type && !typeMatches(value, schema.type)) {
    errors.push(`${path}: expected ${schema.type}`);
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: value is outside enum`);
  if (typeof value === "string") {
    if (schema.minLength != null && value.length < schema.minLength) errors.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: pattern mismatch`);
  }
  if (typeof value === "number" && schema.minimum != null && value < schema.minimum) errors.push(`${path}: below minimum ${schema.minimum}`);
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${path}: fewer than ${schema.minItems} items`);
    if (schema.items) value.forEach((item, index) => validate(item, schema.items, `${path}[${index}]`));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of schema.required || []) if (!(key in value)) errors.push(`${path}.${key}: required`);
    for (const [key, child] of Object.entries(schema.properties || {})) if (key in value) validate(value[key], child, `${path}.${key}`);
  }
}

const contracts = (config.contracts || []).filter(contract => (contract.stages || []).includes(stage));
for (const contract of contracts) {
  try {
    const [dataset, schema] = await Promise.all([readJson(contract.dataset), readJson(contract.schema)]);
    if (schema.$schema !== config.dialect) errors.push(`${contract.schema}: dialect must be ${config.dialect}`);
    validate(dataset, schema, contract.dataset);
    if (contract.dataset === "news.json" && Number(dataset.count) !== (dataset.articles || []).length) {
      errors.push("news.json.count: must equal articles.length");
    }
    if (contract.dataset === "market.json" && Number(dataset.database?.recordCount) !== (dataset.records || []).length) {
      errors.push("market.json.database.recordCount: must equal records.length");
    }
  } catch (error) {
    errors.push(`${contract.dataset}: ${error.message}`);
  }
}

if (errors.length) {
  console.error(`[data-contracts] ${errors.length} violation(s) at ${stage}`);
  errors.slice(0, 30).forEach(error => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`[data-contracts] ${contracts.length} contract(s) valid at ${stage}`);
