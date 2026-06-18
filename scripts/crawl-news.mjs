#!/usr/bin/env node
/* ============================================================
   Daily AI news crawler — multiple concurrent per-company agents.
   Each company is crawled by its own agent against Google News RSS
   (authoritative outlets surface naturally). Results are written to
   news.json at the repo root; the dashboard fetches and merges it
   over the static ARTICLES at load. Runs daily before 07:00 KST.
   No external dependencies — uses Node 20+ global fetch.
   ============================================================ */
import { writeFile, readFile } from "node:fs/promises";

// Company roster mirrors data.js COMPANIES (co must match exactly for filtering).
const COMPANIES = [
  { co: "OpenAI", cat: "native", q: "OpenAI" },
  { co: "Anthropic", cat: "native", q: "Anthropic Claude" },
  { co: "xAI", cat: "native", q: "xAI Grok Musk" },
  { co: "DeepSeek", cat: "native", q: "DeepSeek AI" },
  { co: "SpaceX (xAI, Cursor)", cat: "native", q: "SpaceX Cursor Anysphere AI" },
  { co: "Google DeepMind", cat: "bigtech", q: "Google DeepMind Gemini" },
  { co: "Apple", cat: "bigtech", q: "Apple Intelligence AI" },
  { co: "Microsoft", cat: "bigtech", q: "Microsoft Copilot AI" },
  { co: "Amazon", cat: "bigtech", q: "Amazon AWS AI Bedrock" },
  { co: "NVIDIA", cat: "bigtech", q: "Nvidia AI GPU" },
  { co: "Meta AI", cat: "bigtech", q: "Meta Llama AI" },
  { co: "Perplexity", cat: "startup", q: "Perplexity AI" },
  { co: "Mistral AI", cat: "startup", q: "Mistral AI" },
  { co: "Cohere", cat: "startup", q: "Cohere AI" },
  { co: "Stability AI", cat: "startup", q: "Stability AI" },
  { co: "Databricks", cat: "startup", q: "Databricks AI" },
  { co: "Scale AI", cat: "startup", q: "Scale AI" },
  { co: "Runway", cat: "startup", q: "Runway AI video" },
  { co: "ElevenLabs", cat: "startup", q: "ElevenLabs voice AI" },
  { co: "Harvey", cat: "startup", q: "Harvey legal AI" },
  { co: "Glean", cat: "startup", q: "Glean enterprise AI" },
  { co: "Sierra AI", cat: "startup", q: "Sierra AI agent customer service" },
];

const decode = (s) =>
  (s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
};

function parseItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) items.push(m[1]);
  return items;
}

async function crawlOne(c) {
  // 한국어판 Google News — 제목·요약이 한국어로 수집됨
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(c.q + " when:7d")}&hl=ko&gl=KR&ceid=KR:ko`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (AI-Dashboard NewsBot)" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const xml = await res.text();
    const items = parseItems(xml).slice(0, 2);
    const out = items.map((it) => {
      const rawTitle = decode(tag(it, "title"));
      const link = decode(tag(it, "link"));
      const pub = tag(it, "pubDate");
      const src = decode(tag(it, "source")) || (rawTitle.includes(" - ") ? rawTitle.split(" - ").pop() : "Google News");
      const title = rawTitle.replace(/ - [^-]*$/, "").trim() || rawTitle;        // 한국어 제목 요약
      const descTxt = decode(tag(it, "description")).replace(/^.*?<\/a>/, "").slice(0, 140);
      const d = pub ? new Date(pub) : new Date();
      const date = isNaN(d) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
      const summary = `· ${title}\n· 출처: ${src}${descTxt ? "\n· " + descTxt : ""}`;   // 한국어 요약
      return { date, co: c.co, cat: c.cat, source: src, title, summary, tag: "최신", url: link };
    }).filter((a) => a.title && a.url);
    console.log(`[agent:${c.co}] ${out.length} item(s)`);
    return out;
  } catch (e) {
    console.warn(`[agent:${c.co}] failed: ${e.message}`);
    return [];
  }
}

async function main() {
  console.log(`Launching ${COMPANIES.length} crawler agents…`);
  // run all per-company agents concurrently
  const results = await Promise.all(COMPANIES.map(crawlOne));
  const articles = results.flat();

  // de-dupe by url, keep newest first
  const seen = new Set();
  const merged = articles
    .filter((a) => (a.url && !seen.has(a.url)) && seen.add(a.url))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  let prev = [];
  try { prev = JSON.parse(await readFile("news.json", "utf8")).articles || []; } catch {}
  // if every agent failed (e.g., network blocked), keep the previous file
  const final = merged.length ? merged : prev;

  const payload = { generatedAt: new Date().toISOString(), count: final.length, articles: final };
  await writeFile("news.json", JSON.stringify(payload, null, 2) + "\n");
  console.log(`Wrote news.json with ${final.length} articles.`);
}

main().catch((e) => { console.error(e); process.exit(0); }); // never hard-fail the workflow
