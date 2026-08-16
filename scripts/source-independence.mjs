import { readFile } from "node:fs/promises";

const policy = JSON.parse(await readFile(new URL("../config/source-independence.json", import.meta.url), "utf8"));
const normalize = value => String(value || "").toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim();
const hostOf = value => {
  try { return new URL(String(value || "")).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
};

export function sourceOwnerGroup(source = {}) {
  if (source.sourceOwnerGroup) return normalize(source.sourceOwnerGroup);
  const haystack = normalize([source.publisher, source.source, source.sourceName, source.upstreamSource, hostOf(source.url || source.sourceUrl)].join(" "));
  const match = (policy.ownerGroups || []).find(group => (group.patterns || []).some(pattern => haystack.includes(normalize(pattern))));
  return match?.id || "";
}

export function independentSourceKey(source = {}) {
  if (source.syndicationClusterId) return `syndication:${normalize(source.syndicationClusterId)}`;
  const owner = sourceOwnerGroup(source);
  if (owner) return `owner:${owner}`;
  if (source.independentKey) return `declared:${normalize(source.independentKey)}`;
  const host = hostOf(source.url || source.sourceUrl);
  return host ? `domain:${host}` : `publisher:${normalize(source.publisher || source.source || source.sourceName)}`;
}

export const sourceIndependencePolicy = policy;
