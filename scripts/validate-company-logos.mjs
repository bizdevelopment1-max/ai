#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const readJson = file => readFile(file, "utf8").then(JSON.parse);
const [companiesData, overview, investments] = await Promise.all([
  readJson("companies.json"),
  readJson("overview-view.json"),
  readJson("nvidia-investments.json"),
]);

const failures = [];
const validUrl = value => /^https?:\/\//.test(String(value || ""));
const companies = Object.entries(companiesData.companies || {});
for (const [name, company] of companies) {
  if (!company.logo?.domain) failures.push(`${name}: official logo domain missing`);
  if (!validUrl(company.logo?.url)) failures.push(`${name}: resolvable logo URL missing`);
  if (!validUrl(company.logo?.sourceUrl)) failures.push(`${name}: logo source page missing`);
}

const landscape = overview.relationshipLandscape?.companies || [];
for (const company of landscape) {
  if (!company.domain) failures.push(`${company.name}: public landscape domain missing`);
  if (!validUrl(company.logoUrl)) failures.push(`${company.name}: public landscape logo missing`);
}

const portfolio = investments.portfolio || [];
for (const company of portfolio) {
  if (!company.logoUrl && !company.domain) failures.push(`${company.name}: investment portfolio logo source missing`);
}

if (companiesData.quality?.allCompaniesLogoResolvable !== true
    || companiesData.quality?.logoReadyCompanies !== companies.length) {
  failures.push("company logo quality summary is incomplete");
}

if (failures.length) {
  console.error(`[company-logos] ${failures.length} failure(s)`);
  failures.slice(0, 40).forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`[company-logos] ${companies.length} companies · ${landscape.length} relationship nodes · ${portfolio.length} investment companies ready`);
