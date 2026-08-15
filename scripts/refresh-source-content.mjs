#!/usr/bin/env node
/** Refresh stored source text without deleting the cumulative feed ledger. */
import { readFile, writeFile } from "node:fs/promises";
import { enrichSourceBatch, isContentBacked } from "./source-content.mjs";
import { loadSuppressionRegistry } from "./suppression-registry.mjs";

const limit = Number(process.env.SOURCE_REFRESH_LIMIT || 0);
const concurrency = Number(process.env.SOURCE_REFRESH_CONCURRENCY || 4);
const scope = String(process.env.SOURCE_REFRESH_SCOPE || "all").toLowerCase();
const force = /^(1|true|yes)$/i.test(String(process.env.SOURCE_REFRESH_FORCE || ""));
const match = String(process.env.SOURCE_REFRESH_MATCH || "").trim().toLowerCase();
const readJson = async (file, fallback) => { try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; } };
const suppression = await loadSuppressionRegistry();

async function refresh(file, key) {
  const data = await readJson(file, { [key]: [] });
  const rows = Array.isArray(data[key]) ? data[key] : [];
  const itemScope = key === "feed" ? "research" : "article";
  const candidates = rows
    .filter(row => !suppression.matches(row, itemScope))
    .filter(row => !match || [row.url, row.rssUrl, row.title, row.titleEn]
      .some(value => String(value || "").toLowerCase().includes(match)))
    .filter(row => force || !isContentBacked(row));
  const target = limit > 0 ? candidates.slice(0, limit) : candidates;
  console.log(`[source-refresh] ${file}: ${target.length}/${rows.length} record(s) need source-page extraction`);
  const enriched = await enrichSourceBatch(target, concurrency);
  const byKey = new Map(enriched.map(item => [item.rssUrl || item.url, item]));
  const updated = rows
    .filter(row => !suppression.matches(row, itemScope))
    .map(row => byKey.get(row.rssUrl || row.url) || row);
  const ok = enriched.filter(isContentBacked).length;
  const unavailable = enriched.length - ok;
  data[key] = updated;
  data.generatedAt = new Date().toISOString();
  await writeFile(file, JSON.stringify(data, null, 2) + "\n");
  console.log(`[source-refresh] ${file}: content ${ok}, retained-not-displayed ${unavailable}`);
  return { ok, unavailable, total: rows.length };
}

const results = [];
if (scope === "all" || scope === "news") results.push(await refresh("news.json", "articles"));
if (scope === "all" || scope === "research") results.push(await refresh("research.json", "feed"));
console.log(`[source-refresh] complete: ${results.reduce((sum, value) => sum + value.ok, 0)} source-backed records; ${results.reduce((sum, value) => sum + value.unavailable, 0)} retained records withheld from display`);
