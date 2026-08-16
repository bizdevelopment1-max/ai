/**
 * Source-page retrieval and extractive briefing.
 *
 * The crawler stores a bounded, cleaned copy of public article text and picks
 * only complete sentences from that stored text.  It never writes a generated
 * claim, so every displayed bullet can be checked against sourceContent.text.
 */
import { createHash } from "node:crypto";
import { CRAWLER_USER_AGENT } from "./crawler-identity.mjs";

const UA = CRAWLER_USER_AGENT;
const MAX_TEXT = 18_000;   // 원문 추출 확장 — 정량 문장 발굴 범위 확대
const JUNK = /(?:^|\b)(?:advertisement|advertising|affiliate commission|purchase through links|subscribe|sign up|read more|cookie|privacy policy|all rights reserved|share this article|follow us|related articles?|news tips|newsletters?|get this delivered to your inbox|confidential news tip|data is a real-time snapshot|global business and financial news|stock quotes and market data|sorry, an error occurred while processing your request|we(?:'|’)re aware of the situation and are working to address the problem|we harness every resource|our award-winning podcast|we help entrepreneurs|proactive financial news|all our content is produced independently|our human content creators|request a demo|talk to your .* team|no new portal|no new login|see how it works|what it means for your organization|already use.*tools)(?:\b|$)/i;
const GENERIC_LEDE = /(?:^|\b)(?:every vendor claims|this is what actually happens|you don['’]t have to take .* word for it|at the .* webinar|here['’]s what .* says|that['’]s the theory|elsewhere in the workforce|the team delivers news|we are experts in|we(?:'|’)re focused on providing|stay ahead in a rapidly evolving market|whether you['’]re driving innovation|everything you need to track the market|the architecture.*easier to evaluate|you know|i mean|all right|thanks for joining|today is|i['’]m .* (?:here|with)|trading floor)(?:\b|$)/i;
const FACT_TERMS = /(?:\$|€|£|\b\d+(?:\.\d+)?\s*(?:%|percent|per cent|billion|million|trillion|basis points?|bps|years?|months?)\b|\b(?:forecast|forecasted|project(?:s|ed|ion)?|estimate(?:s|d)?|expect(?:s|ed)?|reached|total(?:s|ed)?|grew|growth|rose|fell|declin(?:e|ed|ing)|increase(?:d)?|decrease(?:d)?|up|down|share|spending|revenue|sales|demand|supply|capacity|capex|investment|adoption|usage)\b)/i;
const CHANGE_TERMS = /\b(?:overtook|surpassed|shift(?:ed|ing)?|moved|launched|introduced|expanded|accelerat(?:ed|ing)|transition(?:ed|ing)?|displace(?:d|s|ment)|prioriti[sz](?:ed|ing)|tight(?:ened|ness)|eas(?:ed|ing)|recover(?:ed|y)|normaliz(?:ed|ing)|restore(?:d|s|ing)?|rebalance(?:d|s|ing)?)\b/i;
const IMPACT_TERMS = /\b(?:therefore|consequently|means?|because|driven by|due to|impact|risk|pressure|benefit|supports?|enables?|requires?|need(?:s|ed)?|helps?|competition|cost|margin|efficien(?:cy|t))\b/i;

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

export const textSimilarity = (a, b) => {
  const aa = new Set(normal(a).split(" ").filter(Boolean));
  const bb = new Set(normal(b).split(" ").filter(Boolean));
  if (!aa.size || !bb.size) return 0;
  let same = 0; for (const word of aa) if (bb.has(word)) same++;
  return same / Math.min(aa.size, bb.size);
};
const similarity = textSimilarity;

const malformedEncoding = value => /\uFFFD|(?:Ã.|Â.|â[€™“”¦])|(?:ðŸ)|(?:\?[가-힣]){2,}|(?:(?:ì|ë|í|ê)[\u0080-\u00BF].){2,}/
  .test(String(value || ""));

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
    .slice(0, 32);   // 문단 수집 확대(18→32) — 발행사 원문에서 정량 문장 더 발굴
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

function insightRole(line) {
  // A sentence can contain a metric and an implication. The implication role
  // is more useful for a three-part brief, so classify it first.
  if (IMPACT_TERMS.test(line)) return "implication";
  if (/(?:ため|より|必要|課題|影響|可能)/.test(line)) return "implication";
  if (CHANGE_TERMS.test(line)) return "change";
  if (/(?:高ま|増加|増え|伸び|上回|下回|拡大|転換)/.test(line)) return "change";
  if (FACT_TERMS.test(line)) return "fact";
  if (/[０-９0-9][％%]/.test(line)) return "fact";
  return "evidence";
}

function titleRelevance(line, title) {
  const ignored = new Set(["the", "and", "with", "from", "that", "this", "will", "into", "over", "says", "said", "how", "for"]);
  const titleWords = new Set(normal(title).split(" ").filter(word => word.length >= 4 && !ignored.has(word)));
  if (!titleWords.size) return 0;
  const lineWords = new Set(normal(line).split(" "));
  let matches = 0;
  for (const word of titleWords) if (lineWords.has(word)) matches++;
  return Math.min(matches, 4) * 3;
}

function insightScore(line, index, role, title) {
  const numeric = (line.match(/(?:\$|€|£|\b\d)/g) || []).length;
  const fact = FACT_TERMS.test(line) ? 8 : 0;
  const change = CHANGE_TERMS.test(line) ? 5 : 0;
  const impact = IMPACT_TERMS.test(line) ? 4 : 0;
  const named = /\b(?:according to|reported|said|announced|survey|tracker|study|research)\b/i.test(line) ? 3 : 0;
  // Later paragraphs are usually the evidence and implication, rather than
  // boilerplate page introductions. Keep a small early-position preference.
  return fact + change + impact + named + titleRelevance(line, title) + Math.min(numeric, 4) * 2 + Math.max(0, 3 - index * 0.16) + (role === "evidence" ? 0 : 2);
}

function numericClaimTokens(line) {
  return [...String(line || "").matchAll(/(?:\$|€|£)?\d+(?:\.\d+)?(?:%|percent|per cent|billion|million|trillion|bp|bps)?/gi)]
    .map(match => match[0].toLowerCase().replace(/\s+/g, ""))
    .filter(token => !/^20(?:2\d|3\d)$/.test(token));
}

function repeatsPrimaryFact(candidate, selected) {
  if (candidate.role !== "fact") return false;
  const candidateTokens = new Set(numericClaimTokens(candidate.line));
  if (!candidateTokens.size) return false;
  return selected.some(previous => {
    if (previous.role !== "fact") return false;
    const previousTokens = numericClaimTokens(previous.line);
    return previousTokens.some(token => candidateTokens.has(token));
  });
}

// Select source sentences for three distinct jobs: the verifiable fact, the
// market change, and its practical implication. This is extractive only — it
// never adds a claim that does not appear in the publisher text.
export function selectInsightLines(text, title = "") {
  const candidates = splitSentences(text)
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.length >= 45 && line.length <= 460 && !JUNK.test(line) && !GENERIC_LEDE.test(line))
    .filter(({ line }) => similarity(line, title) < 0.87)
    .map(item => ({ ...item, role: insightRole(item.line) }))
    .map(item => ({ ...item, score: insightScore(item.line, item.index, item.role, title) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = [];
  const take = candidate => {
    if (!candidate || selected.some(previous => similarity(previous.line, candidate.line) > 0.68) || repeatsPrimaryFact(candidate, selected)) return false;
    selected.push(candidate);
    return true;
  };

  // Use each role at most once before filling remaining slots. This prevents
  // three translations of the same fact from becoming a visibly repetitive brief.
  for (const role of ["fact", "change", "implication"]) take(candidates.find(candidate => candidate.role === role));
  for (const candidate of candidates) {
    if (selected.length >= 3) break;
    take(candidate);
  }
  return selected.slice(0, 3).map(({ line, role }) => ({ line, role }));
}

export function selectCoreLines(text, title = "") {
  return selectInsightLines(text, title).map(item => item.line);
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
        .map(cleanText).filter(line => line.length >= 55 && !JUNK.test(line)).slice(0, 30);
      if (schemaParagraphs.length >= 2) paragraphs = schemaParagraphs;
    }
    if (malformedEncoding(headline) || paragraphs.some(malformedEncoding)) throw new Error("malformed-source-encoding");
    const sourceText = paragraphs.join("\n\n").slice(0, MAX_TEXT);
    const insightLines = selectInsightLines(sourceText, headline);
    const summaryLinesEn = insightLines.map(item => item.line);
    // The research feed promises a three-point brief. Keep a record with
    // thinner evidence in the append-only data set, but do not surface it
    // until three distinct publisher sentences can support the display.
    const minLines = record.house ? 3 : 2;
    if (summaryLinesEn.length < minLines) throw new Error(record.house ? "insufficient-three-source-sentences" : "insufficient-distinct-source-sentences");
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
      paragraphs: paragraphs.slice(0, 18),
      text: sourceText,
      contentHash: createHash("sha256").update(`${headline}\n${sourceText}`).digest("hex"),
      retentionMode: "transient-fulltext",
      originalTextBytes: Buffer.byteLength(sourceText),
    };
    return {
      ...record,
      ...(originalUrl !== canonical ? { rssUrl: record.rssUrl || originalUrl } : {}),
      url: canonical,
      title: headline,
      titleEn: headline,
      descEn: description || record.descEn || record.desc || "",
      summaryLinesEn,
      summaryRoles: insightLines.map(item => item.role),
      summary: summaryLinesEn.join("\n"),
      summaryVersion: 5,
      summaryMode: "source-content-extractive",
      summaryEngine: "source-content-extractive",
      displayEligible: true,
      sourceContent: { ...sourceContent, selectionVersion: 7 },
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

export const isContentBacked = record => Number(record?.summaryVersion) >= 4
  && record?.summaryMode === "source-content-extractive"
  && record?.displayEligible === true
  && record?.sourceContent?.status === "content-extracted"
  && Array.isArray(record?.summaryLinesEn) && record.summaryLinesEn.length >= 2;
