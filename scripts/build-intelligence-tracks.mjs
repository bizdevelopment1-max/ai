#!/usr/bin/env node
/**
 * Materialize four independently governed intelligence tracks and append a
 * new monthly JSONL revision only when source-backed content changes.
 *
 * The snapshot is browser-safe and compact. The monthly ledgers are excluded
 * from the public site and can be mirrored to DATA_LAKE_ROOT by the existing
 * immutable archive adapter.
 */
import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { sanitizePublicCopy } from "./public-copy.mjs";
import { loadSuppressionRegistry } from "./suppression-registry.mjs";

const root = process.cwd();
const generatedAt = new Date().toISOString();
const month = generatedAt.slice(0, 7);
const readJson = async (file, fallback = {}) => {
  try { return JSON.parse(await readFile(resolve(root, file), "utf8")); }
  catch { return fallback; }
};
const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
const clip = (value, limit = 320) => clean(value).slice(0, limit);
const sha = value => createHash("sha256").update(String(value ?? "")).digest("hex");
const slug = value => clean(value).normalize("NFKC").toLowerCase()
  .replace(/[^a-z0-9\p{L}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 120);
const canonicalUrl = value => {
  try {
    const url = new URL(String(value || ""));
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch { return ""; }
};
const dateValue = (...values) => values.map(value => clean(value)).find(value => Number.isFinite(Date.parse(value))) || null;
const stableStringify = value => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const sourceBacked = value => canonicalUrl(value);
const ratio = (part, total) => total ? Number((part / total).toFixed(4)) : 0;
const ageHours = value => {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? Math.max(0, (Date.now() - parsed) / 3_600_000) : null;
};

const [policy, companies, market, sources, previous, suppression] = await Promise.all([
  readJson("config/intelligence-tracks.json"),
  readJson("companies.json", { companies: {} }),
  readJson("market.json", { records: [] }),
  readJson("source-snapshot.json", { items: [] }),
  readJson("intelligence-tracks.json", { tracks: {} }),
  loadSuppressionRegistry(root),
]);
const trackPolicies = new Map((policy.tracks || []).map(track => [track.id, track]));
const previousRecords = new Map(Object.values(previous.tracks || {}).flatMap(track => track.records || [])
  .map(record => [`${record.track}:${record.stableKey}`, record]));
const ledgerDirectory = resolve(root, policy.ledgerDirectory || "intelligence-ledger");
await mkdir(ledgerDirectory, { recursive: true });

const ledgerState = new Map();
for (const file of (await readdir(ledgerDirectory)).filter(name => name.endsWith(".jsonl"))) {
  const raw = await readFile(resolve(ledgerDirectory, file), "utf8");
  for (const line of raw.split(/\r?\n/).filter(Boolean)) {
    try {
      const record = JSON.parse(line);
      if (!record.track || !record.stableKey || !record.versionKey) continue;
      const key = `${record.track}:${record.stableKey}`;
      const state = ledgerState.get(key) || { versions: new Set(), revision: 0, firstSeenAt: record.firstSeenAt || record.observedAt };
      state.versions.add(record.versionKey);
      state.revision = Math.max(state.revision, Number(record.revision || 1));
      state.firstSeenAt = state.firstSeenAt || record.firstSeenAt || record.observedAt;
      ledgerState.set(key, state);
    } catch {}
  }
}

const evidenceFromCompany = company => {
  const candidates = [
    ...(company.intelligence?.currentBusiness?.evidence || []),
    ...(company.intelligence?.strategyDirection?.evidence || []),
    ...(company.intelligence?.corePractices || []).map(item => item.evidence),
    company.latest,
  ].filter(Boolean);
  const evidence = candidates.find(item => canonicalUrl(item.url));
  const fallback = (company.strategyProfile?.sourceUrls || []).map(url => ({ url })).find(item => canonicalUrl(item.url));
  return evidence || fallback || {};
};
const companyPayload = (name, company) => ({
  entity: name,
  currentBusiness: clip(company.intelligence?.currentBusiness?.summary
    || company.strategyProfile?.currentBusiness || (company.profile?.business || []).join(" · "), 520),
  strategyDirection: clip(company.intelligence?.strategyDirection?.summary || company.strategyProfile?.strategyDirection, 520),
  latestSignal: clip(company.latest?.titleKo || company.latest?.title, 260),
  classification: {
    category: clean(company.strategyProfile?.classification?.category),
    vertical: clean(company.strategyProfile?.classification?.vertical),
    valueChainLayer: clean(company.strategyProfile?.classification?.valueChainLayer),
    stage: clean(company.strategyProfile?.classification?.stage),
  },
  profileCoverage: Number(company.coverage?.profile?.score || 0),
  organizationCoverage: Number(company.coverage?.organization?.score || 0),
  executiveCount: Number(company.coverage?.organization?.executiveCount || 0),
});
const companyRows = Object.entries(companies.companies || {})
  .filter(([name, company]) => !suppression.hasCompany(name) && !suppression.matches({ name, ...company }, "company"))
  .map(([name, company]) => {
    const evidence = evidenceFromCompany(company);
    return {
      track: "company",
      stableKey: `company:${slug(name)}`,
      title: name,
      sourceName: clean(evidence.source || (canonicalUrl(evidence.url) ? "Company source" : "")),
      sourceUrl: canonicalUrl(evidence.url),
      publishedAt: dateValue(evidence.date, company.latest?.date),
      observedAt: dateValue(company.updatedAt, companies.generatedAt, generatedAt),
      verifiedAt: dateValue(company.coverage?.checkedAt, company.strategyProfile?.checkedAt),
      payload: companyPayload(name, company),
    };
  });

const marketRows = (market.records || [])
  .filter(record => !suppression.matches(record, "market"))
  .map(record => ({
    track: record.type === "consumer-survey" || record.collectionTrack === "consumer-survey" ? "consumer-survey" : "market",
    stableKey: `${record.type === "consumer-survey" || record.collectionTrack === "consumer-survey" ? "survey" : "market"}:${slug(record.stableKey || record.id || record.sourceUrl)}`,
    title: clip(record.title || record.metricLabel, 240),
    sourceName: clean(record.sourceName),
    sourceUrl: canonicalUrl(record.sourceUrl),
    publishedAt: dateValue(record.publishedAt, record.eventAt, record.effectiveFrom),
    observedAt: dateValue(record.observedAt, record.collectedAt, market.generatedAt, generatedAt),
    verifiedAt: dateValue(record.verifiedAt),
    evidenceStatus: record.provenance?.status === "source-backed" && canonicalUrl(record.sourceUrl) ? "source-backed" : "reference-only",
    payload: {
      recordType: clean(record.type),
      group: clean(record.group),
      verticalId: clean(record.verticalId),
      metricLabel: clip(record.metricLabel, 240),
      values: (record.values || []).slice(0, 8).map(value => ({ label: clip(value.label, 100), value: clip(value.value, 160) })),
      evidence: clip(record.evidence, 520),
      displayEligible: Boolean(record.displayEligible),
    },
  }));

const categoryByCompany = new Map((sources.items || []).filter(item => item.company)
  .sort((left, right) => String(right.lastSeenAt || "").localeCompare(String(left.lastSeenAt || "")))
  .map(item => [clean(item.company).toLowerCase(), item]));
const valueChainRows = companyRows.map(row => {
  const source = categoryByCompany.get(clean(row.title).toLowerCase());
  const company = companies.companies?.[row.title] || {};
  const layer = clean(company.strategyProfile?.classification?.valueChainLayer);
  const category = clean(source?.category);
  const allowedCategories = new Set(trackPolicies.get("value-chain")?.sourceCategories || []);
  if (!layer && !allowedCategories.has(category)) return null;
  const sourceUrl = canonicalUrl(source?.url) || row.sourceUrl;
  return {
    track: "value-chain",
    stableKey: `value-chain:${slug(row.title)}`,
    title: row.title,
    sourceName: clean(source?.source || row.sourceName),
    sourceUrl,
    publishedAt: dateValue(source?.publishedAt, row.publishedAt),
    observedAt: dateValue(source?.lastSeenAt, row.observedAt),
    verifiedAt: row.verifiedAt,
    payload: {
      entity: row.title,
      layer: layer || category || "unclassified",
      category,
      vertical: row.payload.classification.vertical,
      currentBusiness: row.payload.currentBusiness,
      strategyDirection: row.payload.strategyDirection,
      latestSignal: clip(source?.title || row.payload.latestSignal, 260),
    },
  };
}).filter(Boolean);

const sourceSurveyRows = (sources.items || [])
  .filter(item => item.category === "consumer-survey" && canonicalUrl(item.url) && !suppression.matches(item, "market"))
  .map(item => ({
    track: "consumer-survey",
    stableKey: `survey:${slug(item.stableKey || item.url)}`,
    title: clip(item.title, 240),
    sourceName: clean(item.source),
    sourceUrl: canonicalUrl(item.url),
    publishedAt: dateValue(item.publishedAt),
    observedAt: dateValue(item.lastSeenAt, sources.generatedAt, generatedAt),
    verifiedAt: dateValue(item.lastSeenAt),
    evidenceStatus: "source-backed",
    payload: {
      organization: clean(item.company),
      category: clean(item.category),
      excerpt: clip(item.excerpt, 520),
      sourceTier: clean(item.sourceTier),
    },
  }));

const candidateRows = [...companyRows, ...marketRows, ...valueChainRows, ...sourceSurveyRows];
const candidates = new Map();
for (const row of candidateRows) {
  if (!trackPolicies.has(row.track) || !row.stableKey || !row.title) continue;
  const key = `${row.track}:${row.stableKey}`;
  const current = candidates.get(key);
  const score = (row.evidenceStatus === "source-backed" || canonicalUrl(row.sourceUrl) ? 2 : 0) + (Date.parse(row.publishedAt || 0) || 0) / 1e15;
  if (!current || score > current.score) candidates.set(key, { ...row, score });
}

const newLines = new Map();
const latestByTrack = new Map((policy.tracks || []).map(track => [track.id, []]));
for (const candidate of candidates.values()) {
  const payload = sanitizePublicCopy(candidate.payload);
  const payloadHash = sha(stableStringify(payload));
  const versionKey = sha(`${candidate.track}\0${candidate.stableKey}\0${payloadHash}`);
  const key = `${candidate.track}:${candidate.stableKey}`;
  const prior = previousRecords.get(key);
  const state = ledgerState.get(key) || { versions: new Set(), revision: Number(prior?.revision || 0), firstSeenAt: prior?.firstSeenAt || generatedAt };
  const changed = !state.versions.has(versionKey);
  const revision = changed ? Math.max(state.revision, Number(prior?.revision || 0)) + 1 : Math.max(1, state.revision, Number(prior?.revision || 1));
  const evidenceStatus = candidate.evidenceStatus || (sourceBacked(candidate.sourceUrl) ? "source-backed" : "reference-only");
  const record = sanitizePublicCopy({
    schemaVersion: 1,
    track: candidate.track,
    stableKey: candidate.stableKey,
    versionKey,
    revision,
    payloadHash,
    title: candidate.title,
    sourceName: candidate.sourceName || "",
    sourceUrl: candidate.sourceUrl || "",
    evidenceStatus,
    publishedAt: candidate.publishedAt,
    observedAt: candidate.observedAt || generatedAt,
    verifiedAt: candidate.verifiedAt,
    firstSeenAt: state.firstSeenAt || prior?.firstSeenAt || generatedAt,
    lastSeenAt: generatedAt,
    payload,
  });
  latestByTrack.get(candidate.track).push({ ...record, isNewVersion: changed });
  if (changed) {
    const rows = newLines.get(candidate.track) || [];
    rows.push(record);
    newLines.set(candidate.track, rows);
  }
}

for (const [track, records] of newLines) {
  if (!records.length) continue;
  const file = resolve(ledgerDirectory, `${track}-${month}.jsonl`);
  await appendFile(file, `${records.map(record => JSON.stringify(record)).join("\n")}\n`, "utf8");
}

const tracks = {};
const reverification = [];
for (const definition of policy.tracks || []) {
  const records = (latestByTrack.get(definition.id) || [])
    .sort((left, right) => String(right.publishedAt || right.observedAt || "").localeCompare(String(left.publishedAt || left.observedAt || ""))
      || left.title.localeCompare(right.title));
  const sourceBackedCount = records.filter(record => record.evidenceStatus === "source-backed").length;
  const newestPublishedAt = records.map(record => record.publishedAt).filter(Boolean).sort().at(-1) || null;
  for (const record of records) {
    const stale = ageHours(record.verifiedAt || record.publishedAt || record.observedAt);
    if (record.evidenceStatus !== "source-backed" || stale == null || stale > Number(definition.maxAgeHours || 24)) {
      reverification.push({
        track: definition.id,
        stableKey: record.stableKey,
        title: record.title,
        priority: record.evidenceStatus !== "source-backed" ? "P0" : stale > Number(definition.maxAgeHours || 24) * 4 ? "P1" : "P2",
        reason: record.evidenceStatus !== "source-backed" ? "direct-source-required" : "freshness-window-exceeded",
        sourceUrl: record.sourceUrl,
        ageHours: stale == null ? null : Number(stale.toFixed(1)),
      });
    }
  }
  tracks[definition.id] = {
    id: definition.id,
    label: definition.label,
    sourceDatasets: definition.sourceDatasets,
    maxAgeHours: definition.maxAgeHours,
    recordCount: records.length,
    sourceBackedCount,
    sourceBackedRatio: ratio(sourceBackedCount, records.length),
    newVersionCount: records.filter(record => record.isNewVersion).length,
    newestPublishedAt,
    status: records.length < Number(definition.minimumRecords || 1)
      ? "coverage-warning"
      : ratio(sourceBackedCount, records.length) < Number(definition.minimumSourceBackedRatio || 0)
        ? "evidence-warning" : "healthy",
    records: records.map(({ isNewVersion, ...record }) => record),
  };
}
reverification.sort((left, right) => left.priority.localeCompare(right.priority)
  || Number(right.ageHours || 0) - Number(left.ageHours || 0));
const trackValues = Object.values(tracks);
const snapshot = sanitizePublicCopy({
  schemaVersion: 1,
  generatedAt,
  policyVersion: Number(policy.version || 1),
  revisionPolicy: policy.revisionPolicy,
  latestSelection: policy.latestSelection,
  ledger: {
    directory: policy.ledgerDirectory,
    partition: month,
    newVersionsByTrack: Object.fromEntries(trackValues.map(track => [track.id, track.newVersionCount])),
  },
  summary: {
    trackCount: trackValues.length,
    recordCount: trackValues.reduce((sum, track) => sum + track.recordCount, 0),
    sourceBackedCount: trackValues.reduce((sum, track) => sum + track.sourceBackedCount, 0),
    newVersionCount: trackValues.reduce((sum, track) => sum + track.newVersionCount, 0),
    healthyTracks: trackValues.filter(track => track.status === "healthy").length,
  },
  tracks,
  reverificationQueue: { total: reverification.length, records: reverification },
});
await writeFile(resolve(root, policy.snapshotPath || "intelligence-tracks.json"), `${JSON.stringify(snapshot)}\n`, "utf8");
console.log(`[intelligence-tracks] ${snapshot.summary.recordCount} latest records · ${snapshot.summary.newVersionCount} new revisions · ${snapshot.summary.sourceBackedCount} source-backed`);
