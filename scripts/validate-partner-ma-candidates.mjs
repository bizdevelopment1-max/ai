#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const data = JSON.parse(await readFile("partner-ma-candidates.json", "utf8"));
const errors = [];
const rows = data.records || [];
if (rows.length < 80) errors.push(`candidate universe too small: ${rows.length}`);
if ((data.shortlist || []).length < 16) errors.push("shortlist must contain at least 16 candidates");
if (Number(data.metrics?.acquisition || 0) < 8) errors.push("acquisition candidate coverage below 8");
if (Number(data.metrics?.partnership || 0) < 8) errors.push("partnership candidate coverage below 8");
for (const item of rows) {
  if (!item.name || !item.companySummary || !item.routeReason) errors.push(`${item.name || item.id}: incomplete company assessment`);
  if (!Number.isFinite(item.score) || item.score < 20 || item.score > 100) errors.push(`${item.name}: invalid score`);
  if (!["M&A 검토", "파트너십", "전략 투자", "관찰"].includes(item.recommendation)) errors.push(`${item.name}: invalid recommendation`);
  if (!Array.isArray(item.sourceUrls) || !item.sourceUrls.length || item.sourceUrls.some(url => !/^https:\/\//.test(url))) errors.push(`${item.name}: source URL required`);
  if (item.recommendation === "M&A 검토" && item.transaction?.status === "existing-owner") errors.push(`${item.name}: acquired company cannot remain an acquisition candidate`);
  if (/삼성|samsung|갤럭시|galaxy|\bMX\b|휴대폰/i.test(JSON.stringify(item))) errors.push(`${item.name}: forbidden public wording`);
}
if (errors.length) {
  console.error(`[partner-ma] validation failed (${errors.length})`);
  errors.slice(0, 40).forEach(error => console.error(`  - ${error}`));
  process.exit(1);
}
console.log(`[partner-ma] validated ${rows.length} candidates · shortlist ${(data.shortlist || []).length}`);
