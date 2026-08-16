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

const envValue = (name, fallback = "") => process.env[name] || fallback;
const resolveTemplate = value => String(value || "")
  .replace(/\{today\}/g, observedAt.slice(0, 10))
  .replace(/\{yesterday\}/g, new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10))
  .replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => envValue(name));

async function fetchText(url, { headers = {}, timeoutMs = 25_000, tries = 3, method = "GET", body } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/json, application/xml, text/xml, */*", ...headers },
        method,
        ...(body !== undefined ? { body } : {}),
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
const absoluteUrl = (href, base) => {
  try { return canonicalUrl(new URL(String(href || ""), base).toString()); }
  catch { return ""; }
};
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

const metaContent = (html, keys) => {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
    ];
    for (const pattern of patterns) {
      const value = clean(html.match(pattern)?.[1]);
      if (value) return value;
    }
  }
  return "";
};

function articleFromHtml(html, url) {
  const title = metaContent(html, ["og:title", "twitter:title"])
    || clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])
    || titleFromUrl(url);
  const publishedAt = normalizedDate(metaContent(html, ["article:published_time", "datePublished", "date", "pubdate"])
    || html.match(/["']datePublished["']\s*:\s*["']([^"']+)/i)?.[1]
    || html.match(/<time[^>]+datetime=["']([^"']+)/i)?.[1]);
  const excerpt = metaContent(html, ["og:description", "twitter:description", "description"]);
  return { externalId: url, title, url, publishedAt, excerpt: excerpt.slice(0, 700), kind: publishedAt ? "article" : "undated-page" };
}

async function collectHtmlIndex(source) {
  const root = await fetchText(source.url, { timeoutMs: Number(source.timeoutMs || 30_000) });
  const linkPattern = new RegExp(source.linkPattern || "/news/|/blog/|/discover/", "i");
  const candidates = [...root.text.matchAll(/<a\b[^>]+href=["']([^"'#]+)["'][^>]*>/gi)]
    .map(match => absoluteUrl(match[1], source.url))
    .filter(url => url && linkPattern.test(url));
  const unique = [...new Set(candidates)].slice(0, Number(source.maxCandidates || 16));
  const pages = await Promise.all(unique.map(async url => {
    try {
      const page = await fetchText(url, { timeoutMs: Number(source.articleTimeoutMs || 20_000), tries: 2 });
      return articleFromHtml(page.text, url);
    } catch { return null; }
  }));
  return pages.filter(Boolean)
    .sort((left, right) => String(right.publishedAt || "").localeCompare(String(left.publishedAt || "")))
    .slice(0, Number(source.maxItems || 8));
}

async function collectWithFallbacks(source, collector) {
  const urls = [source.url, ...(source.fallbackUrls || [])].filter(Boolean);
  const failures = [];
  let lastReachableEmpty = null;
  for (const [index, url] of urls.entries()) {
    try {
      const rows = await collector({ ...source, url });
      const result = { rows, activeEndpoint: url, attemptedEndpoints: urls.slice(0, index + 1) };
      if (rows.length || index === urls.length - 1) return result;
      lastReachableEmpty = result;
    } catch (error) {
      failures.push(`${url}: ${String(error.message || error)}`);
    }
  }
  if (lastReachableEmpty) return { ...lastReachableEmpty, attemptedEndpoints: urls };
  throw new Error(failures.join(" | ").slice(0, 500));
}

function apiRows(connector, text) {
  if (["atom", "sec-atom"].includes(connector.adapter)) return feedRows(text, connector, Number(connector.maxItems || 10));
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
  if (connector.adapter === "github-releases") {
    return (Array.isArray(data) ? data : []).slice(0, Number(connector.maxItems || 20)).map(release => ({
      externalId: String(release.id || release.tag_name), title: release.name || release.tag_name,
      url: release.html_url, publishedAt: normalizedDate(release.published_at || release.created_at),
      excerpt: clean(release.body).slice(0, 700), kind: "release",
      metrics: { prerelease: !!release.prerelease, draft: !!release.draft },
    })).filter(row => row.externalId && row.url && !row.metrics.draft);
  }
  if (connector.adapter === "xiaomi-discovery") {
    const assemblies = data.data?.page_data || [];
    const entries = assemblies.flatMap(assembly => assembly.assembly_info || [])
      .filter(entry => /\/discover\/article/i.test(entry.go_to_url || ""));
    return entries.slice(0, Number(connector.maxItems || 20)).map(entry => {
      let extended = {};
      try { extended = JSON.parse(entry.extended || "{}"); } catch {}
      const id = extended.material_id || new URL(entry.go_to_url).searchParams.get("id") || entry.view_id;
      const epoch = Number(extended.online_time || extended.add_time || 0);
      return {
        externalId: String(id || ""), title: clean(entry.title),
        url: `https://www.mi.com/global/discover/article?id=${encodeURIComponent(id)}`,
        publishedAt: epoch > 1_000_000_000 ? new Date(epoch * 1000).toISOString() : null,
        excerpt: clean(entry.description).slice(0, 700), kind: "article",
        metrics: { views: Number(extended.view_cnt || 0) || null, likes: Number(extended.like_cnt || 0) || null },
      };
    }).filter(row => row.externalId && row.title);
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
  if (connector.adapter === "appfigures-products") {
    const products = Array.isArray(data) ? data : Object.values(data.products || data.entries || data).filter(value => value && typeof value === "object");
    const pattern = new RegExp(connector.matchPattern || "AI|ChatGPT|Gemini|Claude|Perplexity|Poe|Character", "i");
    return products.filter(product => pattern.test(`${product.name || ""} ${product.developer || ""}`))
      .slice(0, Number(connector.maxItems || 20)).map(product => ({
        externalId: String(product.id || product.vendor_identifier || product.package_name),
        title: product.name,
        url: product.store_url || product.url || `https://api.appfigures.com/v2/products/${product.id}`,
        publishedAt: normalizedDate(product.updated_date || product.release_date || product.added_date),
        excerpt: product.developer || "",
        kind: "app",
        metrics: { store: product.store || null, price: product.price?.price ?? null, currency: product.price?.currency ?? null },
      })).filter(row => row.externalId && row.title);
  }
  if (connector.adapter === "uspto-patent-search") {
    const rows = data.patentFileWrapperDataBag || data.patentApplicationDataBag || data.results || data.items || [];
    return rows.slice(0, Number(connector.maxItems || 20)).map(record => {
      const id = record.applicationNumberText || record.applicationMetaData?.applicationNumberText || record.patentNumber || record.id;
      const title = record.inventionTitle || record.applicationMetaData?.inventionTitle || record.title || `Patent application ${id}`;
      return {
        externalId: String(id || ""), title, url: record.documentUrl || record.url || `https://data.uspto.gov/patent-file-wrapper/search/details/${id}/application-data`,
        publishedAt: normalizedDate(record.publicationDate || record.applicationMetaData?.publicationDate || record.lastModifiedDateTime || record.filingDate),
        excerpt: clean([record.applicantName, record.applicationMetaData?.applicantName, record.firstNamedInventorName].filter(Boolean).join(" · ")),
        kind: "patent",
      };
    }).filter(row => row.externalId);
  }
  if (connector.adapter === "sensor-tower-apps") {
    const apps = data.rankings || data.apps || data.data || data.results || data.entries || [];
    return apps.slice(0, Number(connector.maxItems || 20)).map((app, index) => ({
      externalId: String(app.app_id || app.id || app.package_name || ""), title: app.name || app.app_name || app.title || `App ${app.app_id || app.id}`,
      url: app.url || app.store_url || `https://app.sensortower.com/overview/${app.app_id || app.id}`,
      publishedAt: normalizedDate(app.updated_at || app.release_date || app.date), excerpt: app.publisher_name || app.publisher || "", kind: "app",
      metrics: { chartRank: app.rank ?? index + 1, downloads: app.downloads ?? null, revenue: app.revenue ?? null },
    })).filter(row => row.externalId && row.title);
  }
  throw new Error(`unsupported adapter ${connector.adapter || connector.format || "unknown"}`);
}

function connectorRequest(connector) {
  const headers = {};
  for (const [header, envName] of Object.entries(connector.headersFromEnv || {})) {
    if (process.env[envName]) headers[header] = process.env[envName];
  }
  for (const [header, value] of Object.entries(connector.headers || {})) headers[header] = resolveTemplate(value);
  if (connector.bearerTokenEnv && process.env[connector.bearerTokenEnv]) headers.Authorization = `Bearer ${process.env[connector.bearerTokenEnv]}`;
  if (connector.apiKeyEnv && process.env[connector.apiKeyEnv]) headers[connector.apiKeyHeader || "X-API-KEY"] = process.env[connector.apiKeyEnv];
  return {
    headers,
    method: connector.method || "GET",
    ...(connector.body ? { body: resolveTemplate(typeof connector.body === "string" ? connector.body : JSON.stringify(connector.body)) } : {}),
  };
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
    const collected = await collector();
    const rows = Array.isArray(collected) ? collected : collected.rows;
    observations.push(...rows.map(row => ({ ...row, sourceId: stream.id, source: stream.source, company: stream.company || "", category: stream.category || "uncategorized", sourceTier: stream.sourceTier || "official", sourceType: stream.sourceType })));
    const state = rows.length ? "healthy" : "reachable-quiet";
    streamHealth.push({ stream: stream.id, source: stream.source, category: stream.category, state, itemCount: rows.length, lastAttemptAt: observedAt, lastSuccessAt: rows.length ? observedAt : previous.lastSuccessAt || null, consecutiveFailureRuns: 0, durationMs: Date.now() - started, ...(collected?.activeEndpoint ? { activeEndpoint: collected.activeEndpoint, attemptedEndpoints: collected.attemptedEndpoints } : {}) });
  } catch (error) {
    streamHealth.push({ stream: stream.id, source: stream.source, category: stream.category, state: "failed", itemCount: 0, lastAttemptAt: observedAt, lastSuccessAt: previous.lastSuccessAt || null, failureSince: previous.failureSince || observedAt, consecutiveFailureRuns: Number(previous.consecutiveFailureRuns || 0) + 1, error: String(error.message || error).slice(0, 240), durationMs: Date.now() - started });
  }
}

const jobs = [];
for (const feed of registry.officialFeeds || []) {
  if (String(feed.status || "active").startsWith("disabled")) continue;
  jobs.push(runStream({ ...feed, id: `official-feed:${feed.source}`, sourceType: "official-feed" }, async () => {
    return collectWithFallbacks(feed, async candidate => {
      const result = await fetchText(candidate.url);
      return feedRows(result.text, candidate, Number(candidate.maxItems || 8));
    });
  }));
}
for (const sitemap of registry.sitemaps || []) {
  if (String(sitemap.status || "active").startsWith("disabled")) continue;
  jobs.push(runStream({ ...sitemap, id: `official-sitemap:${sitemap.source}`, sourceTier: "official", sourceType: "official-sitemap" }, () => collectWithFallbacks(sitemap, collectSitemap)));
}
for (const htmlIndex of registry.htmlIndexes || []) {
  if (String(htmlIndex.status || "active").startsWith("disabled")) continue;
  jobs.push(runStream({ ...htmlIndex, id: `official-html:${htmlIndex.source}`, sourceTier: "official", sourceType: "official-html" }, () => collectWithFallbacks(htmlIndex, collectHtmlIndex)));
}

const connectorStatus = [];
for (const connector of registry.apiConnectors || []) {
  const missingEnv = (connector.requiredEnv || []).filter(name => !process.env[name]);
  if (missingEnv.length || !connector.adapter) {
    connectorStatus.push({ id: connector.id, source: connector.source, category: connector.category, status: missingEnv.length ? "credential-gated" : "licensed-connector-required", missingEnv, ...(connector.activationNote ? { activationNote: connector.activationNote } : {}) });
    continue;
  }
  connectorStatus.push({ id: connector.id, source: connector.source, category: connector.category, status: "scheduled" });
  jobs.push(runStream({ ...connector, sourceType: "official-api" }, async () => {
    const request = connectorRequest(connector);
    if (connector.optionalAuthEnv && process.env[connector.optionalAuthEnv]) request.headers.Authorization = `Bearer ${process.env[connector.optionalAuthEnv]}`;
    const result = await fetchText(resolveTemplate(connector.endpoint), request);
    return apiRows(connector, result.text);
  }));
}
await Promise.all(jobs);
for (const connector of connectorStatus.filter(row => row.status === "scheduled")) {
  const health = streamHealth.find(row => row.stream === connector.id);
  connector.status = health?.state === "failed" ? "failed" : "executed";
  connector.itemCount = health?.itemCount || 0;
  if (health?.error) connector.error = health.error;
}

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
