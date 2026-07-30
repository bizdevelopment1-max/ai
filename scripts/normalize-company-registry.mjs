#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { canonicalizeStartupSnapshot, companyRegistryHasDuplicates } from "./company-identity.mjs";
import { loadDash } from "./load-dash.mjs";

const snapshot = JSON.parse(await readFile("startups.json", "utf8"));
const normalized = canonicalizeStartupSnapshot(snapshot, loadDash().COMPANIES || []);
if (companyRegistryHasDuplicates(normalized, loadDash().COMPANIES || [])) {
  throw new Error("canonical company registry still contains cross-section duplicates");
}
await writeFile("startups.json", `${JSON.stringify(normalized)}\n`);
console.log(`[company-registry] ${normalized.companyRegistry.rawStartupRecords} records → ${normalized.companyRegistry.uniqueDisplayedCompanies} unique startup companies · ${normalized.companyRegistry.duplicateRecordsMerged} duplicates merged · ${normalized.companyRegistry.trackedReferences.length} tracked references`);
