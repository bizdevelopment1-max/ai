#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ensureMarketDatabase } from "./market-db.mjs";

const root = process.cwd();
const file = resolve(root, "market.json");
const market = JSON.parse(await readFile(file, "utf8"));
const before = (market.records || []).length;
const result = ensureMarketDatabase(market, new Date().toISOString());
const after = (market.records || []).length;

if (result.changed || before !== after) {
  await writeFile(file, `${JSON.stringify(market, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({
  changed: result.changed,
  addedCuratedRecords: result.addedCuratedRecords,
  recordCountBefore: before,
  recordCountAfter: after,
}, null, 2));
