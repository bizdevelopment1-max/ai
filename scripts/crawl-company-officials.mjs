#!/usr/bin/env node
/**
 * Re-checks official company/leadership pages and verifies curated executives
 * by exact full-name presence. A missing or blocked page never deletes the
 * prior roster; it only lowers verification status.
 */
import { writeFile } from "node:fs/promises";
import { loadDash } from "./load-dash.mjs";
import { COMPANY_SOURCES } from "./company-sources.mjs";
import { isExcludedText } from "./news-policy.mjs";

const UA = "Mozilla/5.0 (compatible; AI-Strategy-Research/1.0; +https://bizdevelopment1-max.github.io/ai/)";
const clean = value => String(value || "").replace(/\s+/g, " ").trim();
const strip = html => String(html || "")
  .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&#0*39;|&apos;/gi, "'")
  .replace(/&quot;/gi, "\"")
  .replace(/\s+/g, " ")
  .trim();
const people = leadership => (leadership || []).flatMap(person =>
  String(person.name || "").split("·").map(name => ({ name: clean(name), role: clean(person.role) })).filter(person => person.name));
const roleTerms = role => {
  const value = clean(role);
  const terms = [
    ["chief executive|\\bceo\\b", /chief executive|\bceo\b/i],
    ["chief technology|\\bcto\\b", /chief technology|\bcto\b/i],
    ["chief financial|\\bcfo\\b", /chief financial|\bcfo\b/i],
    ["chief product|\\bcpo\\b", /chief product|\bcpo\b/i],
    ["founder|co-founder", /founder|co-founder/i],
    ["chair|board", /chair|board/i],
    ["president", /president/i],
    ["scientist|research", /scientist|research/i],
    ["engineering|software|hardware|technology", /engineering|software|hardware|technology/i],
    ["finance|operations|legal|people|commercial", /finance|operations|legal|people|commercial/i],
    ["\\bAI\\b|artificial intelligence", /\bAI\b|artificial intelligence/i],
  ];
  return terms.filter(([pattern]) => new RegExp(pattern, "i").test(value)).map(([, re]) => re);
};

async function fetchOfficial(source) {
  const entry = typeof source === "string" ? { url: source, category: "company-leadership", date: "" } : source;
  const url = entry.url;
  try {
    const directResponse = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    let response = directResponse;
    let retrievalVia = "direct";
    if (!directResponse.ok && [403, 429].includes(directResponse.status)) {
      const target = new URL(url);
      const readerUrl = `https://r.jina.ai/http://${target.host}${target.pathname}${target.search}`;
      const reader = await fetch(readerUrl, {
        headers: { "User-Agent": UA, Accept: "text/plain" },
        signal: AbortSignal.timeout(20_000),
      });
      if (reader.ok) {
        response = reader;
        retrievalVia = "jina-reader";
      }
    }
    const raw = response.ok ? await response.text() : "";
    const isMarkdown = retrievalVia === "jina-reader";
    const body = isMarkdown ? clean(raw) : strip(raw);
    const pageTitle = clean((isMarkdown
      ? (raw.match(/^Title:\s*(.+)$/mi) || [])[1]
      : (raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1])).replace(/&amp;/gi, "&");
    const description = clean((isMarkdown
      ? (raw.match(/Markdown Content:\s*\n+([^#\n][^\n]{30,500})/i) || [])[1]
      : (raw.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i)
        || raw.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i)
        || [])[1])).replace(/&amp;/gi, "&");
    return {
      ...entry,
      url,
      resolvedUrl: directResponse.url || url,
      status: response.ok && body.length > 400 ? "reachable" : "partial",
      httpStatus: response.status,
      sourceHttpStatus: directResponse.status,
      retrievalVia,
      checkedAt: new Date().toISOString(),
      lastModified: directResponse.headers.get("last-modified") || "",
      pageTitle,
      description,
      body,
    };
  } catch (error) {
    return { ...entry, url, resolvedUrl: url, status: "unavailable", httpStatus: 0, checkedAt: new Date().toISOString(), error: error.message, body: "" };
  }
}

async function main() {
  const dash = loadDash();
  const tracked = dash.COMPANIES || [];
  const orgs = dash.COMPANY_ORG || {};
  const companies = {};
  let cursor = 0;
  const collect = async () => {
    while (cursor < tracked.length) {
      const company = tracked[cursor++];
    const config = COMPANY_SOURCES[company.name] || {};
    const pageEntries = [
      ...(config.official || []).map(url => ({ url, category: "company-leadership", date: "" })),
      ...(config.updates || []).map(update => ({ ...update, category: "official-update" })),
    ];
    const pages = await Promise.all(pageEntries.map(fetchOfficial));
    const leaders = people(orgs[company.name]?.leadership);
    const verifiedExecutives = leaders.map(person => {
      const lower = person.name.toLowerCase();
      const page = pages.find(item => item.body.toLowerCase().includes(lower));
      const index = page ? page.body.toLowerCase().indexOf(lower) : -1;
      const context = page && index >= 0 ? page.body.slice(Math.max(0, index - 260), index + lower.length + 260) : "";
      const terms = roleTerms(person.role);
      const roleMatched = !!page && (terms.length === 0 || terms.some(re => re.test(context)));
      return {
        name: person.name,
        role: person.role,
        status: roleMatched ? "official-role-match" : page ? "official-page-name-match" : "unverified",
        sourceUrl: page?.resolvedUrl || "",
        checkedAt: page?.checkedAt || "",
      };
    });
    // A curated or live-fetched page can concern a third company (e.g. a
    // partner-deployment press release) whose name must never surface on
    // this dashboard. Drop the whole page rather than scrub individual
    // fields — a partially-redacted entry would still leak via its URL.
    const safePages = pages.filter(page => !isExcludedText(
      [page.titleKo, page.summaryKo, page.pageTitle, page.description, page.url].filter(Boolean).join(" ")));
    companies[company.name] = {
      officialPages: safePages.map(({ body, ...page }) => page),
      verifiedExecutives,
      sourceStatus: safePages.some(page => page.status === "reachable") ? "official-source-reachable" : "official-source-unavailable",
    };
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, tracked.length) }, collect));

  const out = {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    methodology: "official-page-recrawl+exact-executive-name-and-role-context-match",
    companies,
  };
  await writeFile("company-officials.json", `${JSON.stringify(out)}\n`);
  const verified = Object.values(companies).flatMap(company => company.verifiedExecutives)
    .filter(person => person.status === "official-role-match").length;
  console.log(`[company-officials] ${verified} executive names and roles matched on reachable official pages`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
