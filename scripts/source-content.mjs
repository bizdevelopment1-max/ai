/**
 * Source-page retrieval and extractive briefing.
 *
 * The crawler stores a bounded, cleaned copy of public article text and picks
 * only complete sentences from that stored text.  It never writes a generated
 * claim, so every displayed bullet can be checked against sourceContent.text.
 */
import { createHash } from "node:crypto";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MAX_TEXT = 12_000;
const JUNK = /(?:^|\b)(?:advertisement|advertising|subscribe|sign up|read more|cookie|privacy policy|all rights reserved|share this article|follow us|related articles?|news tips|newsletters?|get this delivered to your inbox|confidential news tip|data is a real-time snapshot|global business and financial news|stock quotes and market data)(?:\b|$)/i;

export const cleanText = value => String(value || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#x([\da-f]+);?/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);?/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
  .replace(/\s+/g, " ").trim();

const htmlToText = html => cleanText(String(html || "")
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
  .replace(/<(?:br|\/p|\/li|\/h[1-6]|\/div)>/gi, "\n")
  .replace(/<[^>]+>/g, " "));

const normal = text => cleanText(text).toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const similarity = (a, b) => {
  const aa = new Set(normal(a).split(" ").filter(Boolean));
  const bb = new Set(normal(b).split(" ").filter(Boolean));
  if (!aa.size || !bb.size) return 0;
  let same = 0; for (const word of aa) if (bb.has(word)) same++;
  return same / Math.min(aa.size, bb.size);
};

const malformedEncoding = value => /\uFFFD|(?:Ã.|Â.|â..){2,}/.test(String(value || ""));

async function fetchText(url, tries = 2) {
  let error;
  for (let i = 0; i < tries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 11_000);
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (text.length < 120) throw new Error("empty-html");
      return { text, url: response.url };
    } catch (cause) {
      error = cause;
      if (i + 1 < tries) await new Promise(resolve => setTimeout(resolve, 450 * (i + 1)));
    } finally { clearTimeout(timeout); }
  }
  throw error || new Error("source-fetch-failed");
}

const attr = (tag, name) => {
  const found = String(tag || "").match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return cleanText(found?.[1] || found?.[2] || found?.[3] || "");
};

function meta(html, names) {
  for (const found of String(html || "").matchAll(/<meta\b[^>]*>/gi)) {
    const tag = found[0];
    const key = [attr(tag, "property"), attr(tag, "name"), attr(tag, "itemprop")].map(v => v.toLowerCase());
    if (key.some(v => names.includes(v))) return attr(tag, "content");
  }
  return "";
}

function jsonLdBodies(html) {
  const values = [];
  const visit = node => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (typeof node.articleBody === "string") values.push(node.articleBody);
    if (Array.isArray(node["@graph"])) node["@graph"].forEach(visit);
  };
  for (const match of String(html || "").matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(match[1])); } catch { /* malformed schema is optional */ }
  }
  return values.map(htmlToText).filter(text => text.length >= 120);
}

function paragraphsFromHtml(html) {
  const article = String(html || "").match(/<(article|main)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2] || html;
  const raw = [];
  for (const match of String(article || "").matchAll(/<(p|li|h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/gi)) raw.push(htmlToText(match[2]));
  return raw
    .map(cleanText)
    .filter(text => text.length >= 55 && text.length <= 1_600 && !JUNK.test(text))
    .filter((text, index, all) => all.findIndex(other => similarity(other, text) > 0.94) === index)
    .slice(0, 18);
}

const splitSentences = text => {
  const value = cleanText(text);
  try {
    return [...new Intl.Segmenter(undefined, { granularity: "sentence" }).segment(value)]
      .map(part => cleanText(part.segment)).filter(Boolean);
  } catch {
    return value.split(/(?<=[.!?。！？])\s+/).map(cleanText).filter(Boolean);
  }
};

export function selectCoreLines(text, title = "") {
  const candidates = splitSentences(text)
    .filter(line => line.length >= 45 && line.length <= 460 && !JUNK.test(line))
    .filter(line => similarity(line, title) < 0.87);
  const selected = [];
  for (const line of candidates) {
    if (selected.some(previous => similarity(previous, line) > 0.72)) continue;
    selected.push(line);
    if (selected.length === 3) break;
  }
  return selected;
}

async function resolveGoogleNews(url) {
  const parsed = new URL(url);
  if (!/(^|\.)news\.google\.com$/i.test(parsed.hostname)) return url;
  const articleId = parsed.pathname.match(/\/(?:rss\/)?articles\/([^/?]+)/i)?.[1];
  if (!articleId) return url;
  const page = await fetchText(`https://news.google.com/articles/${articleId}?hl=en-US&gl=US&ceid=US:en`, 1);
  const encoded = page.text.match(/<c-wiz\b[^>]*\bdata-p="([^"]+)"/i)?.[1];
  if (!encoded) throw new Error("google-news-decode-params-missing");
  const decoded = encoded.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const payload = JSON.parse(decoded.replace(/^%.@\./, '["garturlreq",'));
  if (!Array.isArray(payload) || payload.length < 5) throw new Error("google-news-decode-payload-invalid");
  const request = JSON.stringify([payload[0], payload[2], payload[1], payload.at(-2), payload.at(-1)]);
  const body = JSON.stringify([[["Fbv4je", request, null, "generic"]]]);
  const response = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je", {
    method: "POST",
    headers: { "User-Agent": UA, Referer: "https://news.google.com/", "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ "f.req": body }).toString(),
  });
  if (!response.ok) throw new Error(`google-news-decode-http-${response.status}`);
  const responseText = await response.text();
  for (const line of responseText.split("\n")) {
    if (!line.startsWith("[[")) continue;
    try {
      const events = JSON.parse(line);
      const event = events.find(value => value?.[1] === "Fbv4je" && typeof value?.[2] === "string");
      const result = event && JSON.parse(event[2]);
      if (result?.[0] === "garturlres" && /^https?:\/\//.test(result[1])) return result[1];
    } catch { /* continue through batched events */ }
  }
  throw new Error("google-news-decode-result-missing");
}

export async function enrichSourceRecord(record) {
  const checkedAt = new Date().toISOString();
  const originalUrl = String(record.url || "");
  try {
    const sourceUrl = await resolveGoogleNews(originalUrl);
    const page = await fetchText(sourceUrl);
    const rawHeadline = meta(page.text, ["og:title", "twitter:title"]) || cleanText(record.titleEn || record.title);
    const headline = cleanText(rawHeadline).replace(/\s*[|｜]\s*(?:techcrunch|the verge|wired|engadget|cnbc|reuters|bloomberg)\s*$/i, "").trim();
    const description = meta(page.text, ["og:description", "description", "twitter:description"]);
    let paragraphs = paragraphsFromHtml(page.text);
    if (paragraphs.length < 2) {
      const schemaParagraphs = jsonLdBodies(page.text).flatMap(splitSentences)
        .map(cleanText).filter(line => line.length >= 55 && !JUNK.test(line)).slice(0, 18);
      if (schemaParagraphs.length >= 2) paragraphs = schemaParagraphs;
    }
    if (malformedEncoding(headline) || paragraphs.some(malformedEncoding)) throw new Error("malformed-source-encoding");
    const sourceText = paragraphs.join("\n\n").slice(0, MAX_TEXT);
    const summaryLinesEn = selectCoreLines(sourceText, headline);
    if (summaryLinesEn.length < 2) throw new Error("insufficient-distinct-source-sentences");
    const canonical = meta(page.text, ["og:url"]) || page.url;
    const sourceContent = {
      version: 1,
      status: "content-extracted",
      retrievedAt: checkedAt,
      originalUrl,
      resolvedUrl: sourceUrl,
      canonicalUrl: canonical,
      headline,
      description,
      paragraphs: paragraphs.slice(0, 12),
      text: sourceText,
      contentHash: createHash("sha256").update(`${headline}\n${sourceText}`).digest("hex"),
    };
    return {
      ...record,
      ...(originalUrl !== canonical ? { rssUrl: record.rssUrl || originalUrl } : {}),
      url: canonical,
      title: headline,
      titleEn: headline,
      descEn: description || record.descEn || record.desc || "",
      summaryLinesEn,
      summary: summaryLinesEn.join("\n"),
      summaryVersion: 4,
      summaryMode: "source-content-extractive",
      summaryEngine: "source-content-extractive",
      displayEligible: true,
      sourceContent,
    };
  } catch (error) {
    return {
      ...record,
      displayEligible: false,
      sourceContent: {
        version: 1,
        status: "unavailable",
        checkedAt,
        originalUrl,
        error: String(error?.message || error).slice(0, 160),
      },
    };
  }
}

export async function enrichSourceBatch(records, concurrency = 4) {
  const out = new Array(records.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, records.length) }, async () => {
    while (cursor < records.length) { const index = cursor++; out[index] = await enrichSourceRecord(records[index]); }
  }));
  return out;
}

export const isContentBacked = record => record?.summaryVersion === 4
  && record?.summaryMode === "source-content-extractive"
  && record?.displayEligible === true
  && record?.sourceContent?.status === "content-extracted"
  && Array.isArray(record?.summaryLinesEn) && record.summaryLinesEn.length >= 2;
