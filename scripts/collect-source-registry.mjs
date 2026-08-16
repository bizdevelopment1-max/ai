#!/usr/bin/env node
/**
 * Collect every executable entry in the source registry.
 *
 * The browser never loads the append-only ledger.  It consumes derived,
 * verified views, while this collector keeps every newly discovered or
 * revised source observation in month-partitioned JSONL files.
 */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const REGISTRY_FILE = "config/official-source-registry.json";
const SNAPSHOT_FILE = "source-snapshot.json";
const REPORT_FILE = "source-collection-report.json";
const LEDGER_DIR = "source-ledger";
const UA = process.env.SOURCE_COLLECTOR_USER_AGENT || "bizdevelopment1-max-ai/1.0 source-registry-collector";
const now = new Date();
const observedAt = now.toISOString();
const month = observedAt.slice(0, 7);

const readJson = async (file, fallback) => {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch { return fallback; }
};
const sha = value => createHash("sha256").update(String(value || "")).digest("hex");
const clean = value => String(value || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"").replace(/&#(?:39|x27);/gi, "'").replace(/&nbsp;/gi, " ")
  .replace(/\s+/g, " ").trim();
const tag = (xml, name) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1] || "";
const canonicalUrl = value => {
  try {
    const url = new URL(String(value || ""));
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch { return String(value || "").trim(); }
};
const normalizedDate = value => {
  const parsed = Date.parse(clean(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
};

async function fetchText(url, { headers = {}, timeoutMs = 25_000, tries = 3 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/json, application/xml, text/xml, */*", ...headers },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { text: await response.text(), contentType: response.headers.get("content-type") || "" };
    } catch (error) {
      lastError = error;
      if (attempt < tries) await new Promise(resolve => setTimeout(resolve, 350 * (2 ** (attempt - 1))));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function feedRows(xml, source, limit = 8) {
  const blocks = [...String(xml).matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(match => match[2]);
  const pattern = source.matchPattern ? new RegExp(source.matchPattern, "i") : null;
  const rows = [];
  for (const block of blocks) {
    const title = clean(tag(block, "title"));
    if (!title || (pattern && !pattern.test(`${title} ${clean(tag(block, "description") || tag(block, "summary") || tag(block, "content"))}`))) continue;
    let url = clean(tag(block, "link"));
    if (!/^https?:/i.test(url)) url = clean(block.match(/<link[^>]+href=["']([^"']+)/i)?.[1]);
    url = canonicalUrl(url);
    if (!url) continue;
    rows.push({
      externalId: clean(tag(block, "guid") || tag(block, "id")) || url,
      title,
      url,
      publishedAt: normalizedDate(tag(block, "pubDate") || tag(block, "published") || tag(block, "updated")),
      excerpt: clean(tag(block, "description") || tag(block, "summary") || tag(block, "content")).slice(0, 700),
      kind: "article",
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

const sitemapRows = xml => [...String(xml).matchAll(/<url>\s*([\s\S]*?)<\/url>/gi)].map(match => ({
  url: canonicalUrl(clean(tag(match[1], "loc"))),
  lastmod: normalizedDate(tag(match[1], "lastmod")),
}));
const sitemapChildren = xml => [...String(xml).matchAll(/<sitemap>\s*([\s\S]*?)<\/sitemap>/gi)]
  .map(match => canonicalUrl(clean(tag(match[1], "loc")))).filter(Boolean);
const titleFromUrl = url => {
  try { return decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).at(-1) || "official update").replace(/[-_]+/g, " "); }
  catch { return "official update"; }
};
const isPlaceholderSitemapRow = row => {
  const title = titleFromUrl(row.url).trim();
  let decodedPath = "";
  try { decodedPath = decodeURIComponent(new URL(row.url).pathname); } catch {}
  return !title
    || /^(?:official update|index|home|news|blog)$/i.test(title)
    || /^\d+$/.test(title)
    || /^\d+\s*(?:day|week|month|year)s?$/i.test(title)
    || /^page\s*\d+$/i.test(title)
    || /\/(?:tag|category)\/\d/i.test(decodedPath);
};

async function collectSitemap(source) {
  const root = await fetchText(source.url, { timeoutMs: Number(source.timeoutMs || 30_000) });
  let rows = sitemapRows(root.text);
  if (!rows.length) {
    const children = sitemapChildren(root.text).slice(0, Number(source.maxSitemapChildren || 8));
    const nested = await Promise.all(children.map(url => fetchText(url, { timeoutMs: 30_000, tries: 2 }).then(result => result.text).catch(() => "")));
    rows = nested.flatMap(sitemapRows);
  }
  const pattern = new RegExp(source.pathPattern || "/news/|/blog/|/research/", "i");
  const cutoff = Date.now() - Number(source.maxAgeDays || 45) * 86_400_000;
  return rows
    .filter(row => row.url && pattern.test(row.url))
    .filter(row => !isPlaceholderSitemapRow(row))
    .filter(row => !row.lastmod || Date.parse(row.lastmod) >= cutoff)
    .sort((left, right) => Date.parse(right.lastmod || 0) - Date.parse(left.lastmod || 0))
    .slice(0, Number(source.maxItems || 8))
    .map(row => ({ externalId: row.url, title: titleFromUrl(row.url), url: row.url, publishedAt: row.lastmod, excerpt: "", kind: row.lastmod ? "article" : "undated-page" }));
}

function apiRows(connector, text) {
  if (connector.adapter === "atom") return feedRows(text, connector, Number(connector.maxItems || 10));
  const data = JSON.parse(text);
  if (connector.adapter === "huggingface-trending") {
    return (data.recentlyTrending || []).slice(0, Number(connector.maxItems || 10)).map(entry => {
      const repo = entry.repoData || {};
      const id = repo.id || [repo.author, repo.repoName].filter(Boolean).join("/");
      return { externalId: id, title: id, url: `https://huggingface.co/${id}`, publishedAt: normalizedDate(repo.lastModified), excerpt: (repo.tags || []).join(" · "), kind: repo.type || "model", metrics: { likes: repo.likes ?? null, downloads: repo.downloads ?? null } };
    }).filter(row => row.externalId);
  }
  if (connector.adapter === "github-search") {
    return (data.items || []).slice(0, Number(connector.maxItems || 10)).map(repo => ({
      externalId: String(repo.id || repo.full_name), title: repo.full_name, url: repo.html_url,
      publishedAt: normalizedDate(repo.updated_at), excerpt: clean(repo.description).slice(0, 700), kind: "repository",
      metrics: { stars: repo.stargazers_count ?? null, forks: repo.forks_count ?? null, openIssues: repo.open_issues_count ?? null },
    }));
  }
  if (connector.adapter === "apple-app-store") {
    const pattern = new RegExp(connector.matchPattern || "AI|ChatGPT|Gemini|Claude|Perplexity|Poe|Character", "i");
    return (data.feed?.results || []).map((app, index) => ({ app, chartRank: index + 1 }))
      .filter(({ app }) => pattern.test(`${app.name || ""} ${app.artistName || ""}`))
      .slice(0, Number(connector.maxItems || 20)).map(({ app, chartRank }) => ({
      externalId: app.id, title: app.name, url: app.url, publishedAt: normalizedDate(app.releaseDate), excerpt: app.artistName || "", kind: "app",
      metrics: { chartRank, chart: data.feed?.title || "top-free" },
    }));
  }
  throw new Error(`unsupported adapter ${connector.adapter || connector.format || "unknown"}`);
}

const registry = await readJson(REGISTRY_FILE, null);
if (!registry) throw new Error(`${REGISTRY_FILE} is missing or invalid`);
const priorSnapshot = await readJson(SNAPSHOT_FILE, { items: [] });
const priorReport = await readJson(REPORT_FILE, { streamHealth: [] });
const priorByKey = new Map((priorSnapshot.items || []).map(item => [item.stableKey, item]));
const priorHealth = new Map((priorReport.streamHealth || []).map(item => [item.stream, item]));
const observations = [];
const streamHealth = [];

async function runStream(stream, collector) {
  const started = Date.now();
  const previous = priorHealth.get(stream.id) || {};
  try {
    const rows = await collector();
    observations.push(...rows.map(row => ({ ...row, sourceId: stream.id, source: stream.source, company: stream.company || "", category: stream.category || "uncategorized", sourceTier: stream.sourceTier || "official", sourceType: stream.sourceType })));
    const state = rows.length ? "healthy" : "reachable-quiet";
    streamHealth.push({ stream: stream.id, source: stream.source, category: stream.category, state, itemCount: rows.length, lastAttemptAt: observedAt, lastSuccessAt: rows.length ? observedAt : previous.lastSuccessAt || null, consecutiveFailureRuns: 0, durationMs: Date.now() - started });
  } catch (error) {
    streamHealth.push({ stream: stream.id, source: stream.source, category: stream.category, state: "failed", itemCount: 0, lastAttemptAt: observedAt, lastSuccessAt: previous.lastSuccessAt || null, failureSince: previous.failureSince || observedAt, consecutiveFailureRuns: Number(previous.consecutiveFailureRuns || 0) + 1, error: String(error.message || error).slice(0, 240), durationMs: Date.now() - started });
  }
}

const jobs = [];
for (const feed of registry.officialFeeds || []) {
  if (String(feed.status || "active").startsWith("disabled")) continue;
  jobs.push(runStream({ ...feed, id: `official-feed:${feed.source}`, sourceType: "official-feed" }, async () => {
    const result = await fetchText(feed.url);
    return feedRows(result.text, feed, Number(feed.maxItems || 8));
  }));
}
for (const sitemap of registry.sitemaps || []) {
  if (String(sitemap.status || "active").startsWith("disabled")) continue;
  jobs.push(runStream({ ...sitemap, id: `official-sitemap:${sitemap.source}`, sourceTier: "official", sourceType: "official-sitemap" }, () => collectSitemap(sitemap)));
}

const connectorStatus = [];
for (const connector of registry.apiConnectors || []) {
  const missingEnv = (connector.requiredEnv || []).filter(name => !process.env[name]);
  if (missingEnv.length || !connector.adapter) {
    connectorStatus.push({ id: connector.id, source: connector.source, category: connector.category, status: missingEnv.length ? "credential-gated" : "registered-not-executable", missingEnv });
    continue;
  }
  connectorStatus.push({ id: connector.id, source: connector.source, category: connector.category, status: "executed" });
  jobs.push(runStream({ ...connector, sourceType: "official-api" }, async () => {
    const headers = {};
    if (connector.optionalAuthEnv && process.env[connector.optionalAuthEnv]) headers.Authorization = `Bearer ${process.env[connector.optionalAuthEnv]}`;
    const result = await fetchText(connector.endpoint, { headers });
    return apiRows(connector, result.text);
  }));
}
await Promise.all(jobs);

const latestByKey = new Map(priorByKey);
const events = [];
for (const observation of observations) {
  const url = canonicalUrl(observation.url);
  const stableKey = sha(`${observation.sourceId}|${observation.externalId || url}`).slice(0, 24);
  const payload = {
    stableKey, sourceId: observation.sourceId, source: observation.source, company: observation.company,
    category: observation.category, sourceTier: observation.sourceTier, sourceType: observation.sourceType,
    externalId: String(observation.externalId || url), title: clean(observation.title), url,
    publishedAt: observation.publishedAt || null, excerpt: clean(observation.excerpt).slice(0, 700),
    kind: observation.kind || "article", ...(observation.metrics ? { metrics: observation.metrics } : {}),
  };
  const contentHash = sha(JSON.stringify(payload));
  const previous = priorByKey.get(stableKey);
  const next = { ...payload, contentHash, firstSeenAt: previous?.firstSeenAt || observedAt, lastSeenAt: observedAt, revision: previous ? Number(previous.revision || 1) + (previous.contentHash === contentHash ? 0 : 1) : 1 };
  latestByKey.set(stableKey, next);
  if (!previous || previous.contentHash !== contentHash) {
    events.push({ eventId: sha(`${stableKey}|${contentHash}|${observedAt}`).slice(0, 32), eventType: previous ? "revised" : "discovered", observedAt, stableKey, previousHash: previous?.contentHash || null, record: next });
  }
}

const retentionDays = Number(registry.storagePolicy?.snapshotRetentionDays || 120);
const cutoff = Date.now() - retentionDays * 86_400_000;
const currentItems = [...latestByKey.values()]
  .filter(item => item.sourceType !== "official-sitemap" || !isPlaceholderSitemapRow(item))
  .filter(item => Math.max(Date.parse(item.publishedAt || 0) || 0, Date.parse(item.lastSeenAt || 0) || 0) >= cutoff)
  .sort((left, right) => String(right.publishedAt || right.lastSeenAt).localeCompare(String(left.publishedAt || left.lastSeenAt)));

await mkdir(LEDGER_DIR, { recursive: true });
if (events.length) await appendFile(`${LEDGER_DIR}/events-${month}.jsonl`, `${events.map(event => JSON.stringify(event)).join("\n")}\n`);
const run = {
  runId: sha(`${observedAt}|${streamHealth.map(row => `${row.stream}:${row.state}:${row.itemCount}`).join("|")}`).slice(0, 24),
  observedAt, registryVersion: registry.version, attempted: streamHealth.length,
  healthy: streamHealth.filter(row => row.state === "healthy").length,
  quiet: streamHealth.filter(row => row.state === "reachable-quiet").length,
  failed: streamHealth.filter(row => row.state === "failed").length,
  observations: observations.length, newOrRevised: events.length,
};
await appendFile(`${LEDGER_DIR}/runs-${month}.jsonl`, `${JSON.stringify(run)}\n`);

const priorManifest = await readJson(`${LEDGER_DIR}/manifest.json`, { cumulativeEvents: 0, cumulativeRuns: 0, partitions: [] });
const partitions = [...new Set([...(priorManifest.partitions || []), month])].sort();
const manifest = {
  schemaVersion: 1, policy: "append-only-monthly-jsonl", updatedAt: observedAt,
  cumulativeEvents: Number(priorManifest.cumulativeEvents || 0) + events.length,
  cumulativeRuns: Number(priorManifest.cumulativeRuns || 0) + 1,
  currentItems: currentItems.length, partitions, latestRun: run,
};
const categoryCoverage = Object.entries(observations.reduce((counts, item) => ({ ...counts, [item.category]: (counts[item.category] || 0) + 1 }), {}))
  .map(([category, itemCount]) => ({ category, itemCount })).sort((a, b) => b.itemCount - a.itemCount);
const report = {
  schemaVersion: 1, generatedAt: observedAt, registryVersion: registry.version,
  status: run.failed ? "partial" : "ok", summary: run, categoryCoverage, streamHealth, connectorStatus,
  ledger: { mode: "append-only-monthly-jsonl", manifest: `${LEDGER_DIR}/manifest.json`, partitions, cumulativeEvents: manifest.cumulativeEvents },
};

await Promise.all([
  writeFile(SNAPSHOT_FILE, `${JSON.stringify({ schemaVersion: 1, generatedAt: observedAt, retentionDays, itemCount: currentItems.length, items: currentItems }, null, 2)}\n`),
  writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`),
  writeFile(`${LEDGER_DIR}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`),
]);
console.log(`[source-registry] ${observations.length} observations · ${events.length} new/revised · ${run.failed} failed · ${manifest.cumulativeEvents} cumulative events`);
if (process.argv.includes("--strict") && run.failed) process.exitCode = 2;
