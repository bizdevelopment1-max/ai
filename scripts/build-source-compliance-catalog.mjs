#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const registry = JSON.parse(await readFile("config/official-source-registry.json", "utf8"));
const policy = registry.compliancePolicy || {};
const groups = [
  ["feed", registry.officialFeeds || []],
  ["sitemap", registry.sitemaps || []],
  ["html-index", registry.htmlIndexes || []],
  ["api", registry.apiConnectors || []],
];

const sources = groups.flatMap(([sourceKind, rows]) => rows.map((row, index) => {
  const compliance = row.compliance || {};
  const uri = row.url || row.feed || row.endpoint || row.baseUrl || "";
  const termsUrl = compliance.termsUrl || row.termsUrl || "";
  const termsReviewedAt = compliance.termsReviewedAt || null;
  const robotsPolicy = compliance.robotsPolicy || policy.defaultRobotsPolicy || "respect";
  return {
    sourceId: row.id || `${sourceKind}-${index + 1}`,
    sourceKind,
    sourceName: row.source || row.publisher || row.id || "unnamed-source",
    category: row.category || "unspecified",
    uri,
    licenseClass: compliance.licenseClass || policy.defaultLicenseClass || "unreviewed-public-web",
    termsUrlHash: termsUrl ? createHash("sha256").update(termsUrl).digest("hex") : null,
    robotsPolicy,
    fullTextStorageAllowed: compliance.fullTextStorageAllowed ?? policy.fullTextStorageDefault ?? false,
    excerptAllowed: compliance.excerptAllowed ?? policy.excerptAllowedDefault ?? true,
    redistributionRule: compliance.redistributionRule || policy.redistributionDefault || "metadata-only",
    redistributionAllowed: compliance.redistributionAllowed
      ?? (termsReviewedAt ? !/^(?:none|prohibited)$/i.test(compliance.redistributionRule || policy.redistributionDefault || "metadata-only") : null),
    apiAllowed: sourceKind === "api" && robotsPolicy !== "disallow",
    crawlAllowed: sourceKind !== "api" && robotsPolicy !== "disallow",
    commercialUseAllowed: compliance.commercialUseAllowed ?? null,
    retentionDays: Number(compliance.retentionDays || registry.storagePolicy?.snapshotRetentionDays || 120),
    termsReviewedAt,
    termsReviewStatus: termsReviewedAt ? "reviewed" : "pending",
    personalDataClass: compliance.personalDataClass || policy.personalDataClass || "none-expected",
    legalOwner: compliance.legalOwner || "Data Steward",
    collectionAllowed: robotsPolicy !== "disallow",
  };
}));

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  policyVersion: registry.version,
  defaults: {
    licenseClass: policy.defaultLicenseClass,
    robotsPolicy: policy.defaultRobotsPolicy,
    fullTextStorageAllowed: policy.fullTextStorageDefault,
    redistributionRule: policy.redistributionDefault,
  },
  summary: {
    total: sources.length,
    collectionAllowed: sources.filter(row => row.collectionAllowed).length,
    termsReviewPending: sources.filter(row => row.termsReviewStatus === "pending").length,
    fullTextStorageAllowed: sources.filter(row => row.fullTextStorageAllowed).length,
  },
  sources,
};

await writeFile("source-compliance-report.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(`[source-compliance] ${report.summary.total} sources; ${report.summary.termsReviewPending} terms reviews pending`);
