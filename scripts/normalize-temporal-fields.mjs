#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const files = [
  { path: "news.json", records: data => data.articles || [] },
  { path: "market.json", records: data => data.records || [] },
];

const parseEffective = value => {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return { effectiveFrom: raw.slice(0, 10), effectivePrecision: "day" };
  if (/^\d{4}-\d{2}$/.test(raw)) return { effectiveFrom: `${raw}-01`, effectivePrecision: "month" };
  if (/^\d{4}$/.test(raw)) return { effectiveFrom: `${raw}-01-01`, effectivePrecision: "year" };
  const short = raw.match(/^'(\d{2})(?:\.(\d{1,2}))?$/);
  if (short) {
    const year = Number(short[1]) >= 70 ? `19${short[1]}` : `20${short[1]}`;
    const month = short[2] ? String(short[2]).padStart(2, "0") : "01";
    return { effectiveFrom: `${year}-${month}-01`, effectivePrecision: short[2] ? "month" : "year" };
  }
  return { effectiveFrom: null, effectivePrecision: "unknown" };
};

let changed = 0;
for (const file of files) {
  const data = JSON.parse(await readFile(file.path, "utf8"));
  const fallbackObservedAt = data.generatedAt || new Date().toISOString();
  for (const record of file.records(data)) {
    const temporal = parseEffective(record.publishedAt || record.date || record.asOf);
    const observedAt = record.observedAt || record.collectedAt || record.sourceContent?.retrievedAt || fallbackObservedAt;
    const publishedAt = record.publishedAt || record.date || null;
    const eventAt = record.eventAt || record.eventDate || record.asOf || temporal.effectiveFrom || publishedAt;
    const retrievedAt = record.retrievedAt || record.sourceContent?.retrievedAt || observedAt;
    const verifiedAt = record.verifiedAt || record.provenance?.verifiedAt || (record.displayEligible ? observedAt : null);
    if (record.effectiveFrom !== temporal.effectiveFrom || record.effectivePrecision !== temporal.effectivePrecision
      || record.observedAt !== observedAt || record.eventAt !== eventAt || record.retrievedAt !== retrievedAt || record.verifiedAt !== verifiedAt) changed++;
    record.effectiveFrom = temporal.effectiveFrom;
    record.effectiveTo ??= null;
    record.effectivePrecision = temporal.effectivePrecision;
    record.observedAt = observedAt;
    record.eventAt = eventAt;
    record.publishedAt = publishedAt;
    record.retrievedAt = retrievedAt;
    record.verifiedAt = verifiedAt;
    record.supersededAt ??= null;
  }
  // Git is only a transitional ledger store; keep normalized snapshots
  // compact until the external immutable store migration is completed.
  await writeFile(file.path, `${JSON.stringify(data)}\n`);
}
console.log(`[temporal] normalized ${changed} records with valid-time and system-time fields`);
