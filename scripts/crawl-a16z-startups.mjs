#!/usr/bin/env node
/**
 * Crawls the complete company/product link lists published in a16z's
 * "Top 100 Gen AI Consumer Apps — 6th Edition".
 *
 * The source page is the authority for membership. Product metadata is read
 * from each linked page so newly added products can enter the dashboard
 * without a hand-maintained company allow-list.
 */
import { readFile, writeFile } from "node:fs/promises";

const SOURCE_URL = "https://a16z.com/100-gen-ai-apps-6/";
const SOURCE_TITLE = "The Top 100 Gen AI Consumer Apps — 6th Edition";
const UA = "Mozilla/5.0 (compatible; AI-Strategy-Research/1.0; +https://bizdevelopment1-max.github.io/ai/)";
const FRESH_DAYS = 6.5;
const FORCE = /^(1|true|yes)$/i.test(String(process.env.A16Z_REFRESH_FORCE || ""));

const decode = value => String(value || "")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, "\"")
  .replace(/&#0*39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const absolute = (value, base = SOURCE_URL) => {
  try {
    const url = new URL(decode(value), base);
    if (url.protocol === "http:") url.protocol = "https:";
    return url.href;
  } catch { return ""; }
};

const sectionLinks = (html, headingPattern) => {
  const re = new RegExp(`<h2[^>]*>[^<]*${headingPattern}[^<]*<\\/h2>\\s*<div[^>]*>([\\s\\S]*?)<\\/div>`, "i");
  const section = html.match(re)?.[1] || "";
  return [...section.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match, index) => ({
      name: decode(match[2]),
      productUrl: absolute(match[1]),
      listOrder: index + 1,
    }))
    .filter(item => item.name && /^https?:\/\//.test(item.productUrl));
};

const metaValue = (html, attr, key) => {
  const variants = [
    new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key}["'][^>]*>`, "i"),
  ];
  for (const re of variants) {
    const match = html.match(re);
    if (match) return decode(match[1]);
  }
  return "";
};

const jsonLdPublisher = html => {
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const value = JSON.parse(match[1]);
      const nodes = Array.isArray(value) ? value : [value];
      for (const node of nodes) {
        const author = node?.author || node?.publisher;
        const name = typeof author === "string" ? author : author?.name;
        if (name) return decode(name);
      }
    } catch {}
  }
  return "";
};

async function fetchMeta(item) {
  try {
    const response = await fetch(item.productUrl, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return item;
    const html = await response.text();
    const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || response.url;
    const finalUrl = absolute(canonical, response.url || item.productUrl) || response.url || item.productUrl;
    const host = (() => {
      try {
        const parsed = new URL(finalUrl);
        return /apps\.apple\.com|play\.google\.com/.test(parsed.hostname) ? "" : parsed.hostname.replace(/^www\./, "");
      } catch { return ""; }
    })();
    return {
      ...item,
      productUrl: finalUrl,
      domain: host,
      pageTitle: metaValue(html, "property", "og:title") || metaValue(html, "name", "twitter:title"),
      description: metaValue(html, "property", "og:description") || metaValue(html, "name", "description"),
      publisher: jsonLdPublisher(html),
      metadataStatus: "publisher-page",
    };
  } catch {
    return { ...item, metadataStatus: "source-link" };
  }
}

async function mapLimit(rows, limit, fn) {
  const out = new Array(rows.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, rows.length) }, async () => {
    while (cursor < rows.length) {
      const index = cursor++;
      out[index] = await fn(rows[index], index);
    }
  }));
  return out;
}

async function main() {
  let previous = null;
  try { previous = JSON.parse(await readFile("a16z-startups.json", "utf8")); } catch {}
  const age = previous?.generatedAt
    ? (Date.now() - new Date(previous.generatedAt).getTime()) / 86_400_000
    : 999;
  if (!FORCE && age < FRESH_DAYS && previous?.sourceUrl === SOURCE_URL
    && previous?.web?.length === 50 && previous?.mobile?.length === 50) {
    console.log(`[a16z] fresh ${age.toFixed(1)}d — 50 web + 50 mobile retained`);
    return;
  }

  const response = await fetch(SOURCE_URL, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`a16z source returned ${response.status}`);
  const html = await response.text();
  const web = sectionLinks(html, "Top 50 Gen AI Consumer Web Products");
  const mobile = sectionLinks(html, "Top 50 Gen AI(?:&nbsp;|\\s)+Consumer Mobile Apps");
  if (web.length !== 50 || mobile.length !== 50) {
    throw new Error(`a16z list shape changed: web=${web.length}, mobile=${mobile.length}`);
  }

  const priorIndex = new Map([...(previous?.web || []), ...(previous?.mobile || [])]
    .map(item => [`${item.name}|${item.productUrl}`, item]));
  const enrich = item => {
    const prior = priorIndex.get(`${item.name}|${item.productUrl}`);
    return prior?.description ? prior : fetchMeta(item);
  };
  const [webRich, mobileRich] = await Promise.all([
    mapLimit(web.map(item => ({ ...item, cohort: "web" })), 10, enrich),
    mapLimit(mobile.map(item => ({ ...item, cohort: "mobile" })), 10, enrich),
  ]);

  const publishedAt = html.match(/article:published_time["'][^>]+content=["']([^"']+)/i)?.[1]?.slice(0, 10) || "2026-03-09";
  const out = {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    source: "Andreessen Horowitz (a16z)",
    sourceTitle: SOURCE_TITLE,
    sourceUrl: SOURCE_URL,
    publishedAt,
    methodology: "publisher-page-complete-link-lists+linked-product-metadata",
    web: webRich,
    mobile: mobileRich,
  };
  await writeFile("a16z-startups.json", `${JSON.stringify(out)}\n`);
  console.log(`[a16z] wrote complete list — web ${webRich.length} · mobile ${mobileRich.length}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
