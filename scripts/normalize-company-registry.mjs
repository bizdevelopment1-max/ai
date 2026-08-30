#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { canonicalizeStartupSnapshot, companyRegistryHasDuplicates } from "./company-identity.mjs";
import { loadDash } from "./load-dash.mjs";
import { corporateRelationship, loadCorporateEntities } from "./corporate-entities.mjs";

const snapshot = JSON.parse(await readFile("startups.json", "utf8"));
const normalized = canonicalizeStartupSnapshot(snapshot, loadDash().COMPANIES || []);
const corporateRegistry = loadCorporateEntities();
const consolidatedProducts = [];
for (const section of ["large", "small", "institutional"]) {
  normalized[section] = (normalized[section] || []).filter(record => {
    const relationship = corporateRelationship(record.name || record.domain, "", corporateRegistry);
    const consolidated = relationship?.subsidiary?.countingPolicy === "parent-only";
    if (consolidated) consolidatedProducts.push({
      name: record.name,
      parentName: relationship.entity.canonicalName,
      section,
      domain: record.domain || "",
      institution: record.institution || null,
      sourceLinks: record.sourceLinks || [],
    });
    return !consolidated;
  });
}
const retainedReferences = (normalized.companyRegistry?.trackedReferences || []).filter(reference =>
  corporateRelationship(reference.name || reference.canonicalId, "", corporateRegistry)?.subsidiary?.countingPolicy !== "parent-only");
if (normalized.companyRegistry) {
  normalized.companyRegistry.trackedReferences = retainedReferences;
  normalized.companyRegistry.a16zUniqueCompanies = [...(normalized.large || []), ...(normalized.small || []), ...(normalized.institutional || [])]
    .filter(record => record.a16z || record.institution).length
    + retainedReferences.filter(record => record.a16z || record.institution).length;
  normalized.companyRegistry.corporateAggregationPolicy = corporateRegistry.aggregationPolicy;
  normalized.companyRegistry.consolidatedProducts = consolidatedProducts;
  normalized.companyRegistry.uniqueDisplayedCompanies = [
    ...(normalized.large || []), ...(normalized.small || []), ...(normalized.institutional || []),
  ].length;
}
if (normalized.institutionalSource) normalized.institutionalSource.uniqueCount = normalized.companyRegistry?.a16zUniqueCompanies || 0;
if (companyRegistryHasDuplicates(normalized, loadDash().COMPANIES || [])) {
  throw new Error("canonical company registry still contains cross-section duplicates");
}
await writeFile("startups.json", `${JSON.stringify(normalized)}\n`);
console.log(`[company-registry] ${normalized.companyRegistry.rawStartupRecords} records → ${normalized.companyRegistry.uniqueDisplayedCompanies} unique startup companies · ${normalized.companyRegistry.duplicateRecordsMerged} duplicates merged · ${normalized.companyRegistry.trackedReferences.length} tracked references`);
