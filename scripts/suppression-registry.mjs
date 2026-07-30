import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const SUPPRESSION_FILE = "deleted.json";

export function canonicalSuppressionUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"]
      .forEach(key => url.searchParams.delete(key));
    url.searchParams.sort();
    return url.href.replace(/[?&]$/, "").replace(/\/+$/, "");
  } catch {
    return raw.replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

const textKey = value => String(value || "").normalize("NFKC").trim().toLocaleLowerCase();

export function createSuppressionRegistry(source = {}) {
  const records = Array.isArray(source.records) ? source.records : [];
  const urls = new Set([
    ...(source.urls || []),
    ...records.map(record => record.url),
  ].map(canonicalSuppressionUrl).filter(Boolean));
  const ids = new Set([
    ...(source.ids || []),
  ].map(textKey).filter(Boolean));
  const companies = new Set([
    ...(source.companies || []),
    ...records
      .filter(record => ["company", "startup"].includes(textKey(record.scope)))
      .map(record => record.name),
  ].map(textKey).filter(Boolean));
  const scopedKeys = new Set(records.map(record => {
    const scope = textKey(record.scope || "content");
    const key = textKey(record.key || record.id || record.url || record.name);
    return scope && key ? `${scope}:${key}` : "";
  }).filter(Boolean));

  const hasUrl = value => urls.has(canonicalSuppressionUrl(value));
  const hasId = value => ids.has(textKey(value));
  const hasCompany = value => companies.has(textKey(value));
  const hasKey = (scope, value) => scopedKeys.has(`${textKey(scope || "content")}:${textKey(value)}`);
  const matches = (item, scope = "content") => {
    if (!item) return false;
    const urlsToCheck = [item.url, item.sourceUrl, item.rssUrl, item.evidenceUrl].filter(Boolean);
    return urlsToCheck.some(hasUrl)
      || hasId(item.id)
      || hasCompany(item.name || item.co || item.company)
      || hasKey(scope, item.key || item.id || item.url || item.name || item.title);
  };

  return { source, records, urls, ids, companies, scopedKeys, hasUrl, hasId, hasCompany, hasKey, matches };
}

export async function loadSuppressionRegistry(root = process.cwd()) {
  let source = {};
  try {
    source = JSON.parse(await readFile(resolve(root, SUPPRESSION_FILE), "utf8"));
  } catch {}
  return createSuppressionRegistry(source);
}
