#!/usr/bin/env node
/* ============================================================
   Daily AI news crawler — authoritative ENGLISH sources only.
   - Per-company + device-topic (AI agent / AI PC / AI phone) streams
     from Google News (en-US), filtered to an allowlist of authoritative
     English outlets. Korean sources are excluded by construction.
   - Each item is summarized into a 3-line KOREAN brief via the Claude API
     (claude-opus-4-8), written from the strategic lens of a global
     smartphone / on-device-AI device maker — WITHOUT naming any company.
   - Source label is always the original English outlet (never an aggregator).
   - HTML (e.g. <font color>) is stripped from all text.
   Requires ANTHROPIC_API_KEY (repo secret). Degrades gracefully if absent.
   ============================================================ */
import { writeFile, readFile } from "node:fs/promises";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = "claude-opus-4-8";

// Authoritative English outlets (publisher homepage hostnames). Anything not here is dropped.
const ALLOW = [
  "reuters.com", "bloomberg.com", "cnbc.com", "techcrunch.com", "theverge.com", "wsj.com",
  "ft.com", "nytimes.com", "wired.com", "arstechnica.com", "axios.com", "theinformation.com",
  "engadget.com", "venturebeat.com", "theguardian.com", "businessinsider.com", "forbes.com",
  "fortune.com", "cnet.com", "zdnet.com", "semafor.com", "theregister.com", "technologyreview.com",
  "spectrum.ieee.org", "androidauthority.com", "9to5google.com", "9to5mac.com", "macrumors.com",
  "tomshardware.com", "anandtech.com", "nikkei.com", "restofworld.org", "platformer.news",
];

// co must match data.js COMPANIES names exactly (for per-company filtering in the feed).
const COMPANIES = [
  { co: "OpenAI", cat: "native", q: "OpenAI" },
  { co: "Anthropic", cat: "native", q: "Anthropic Claude" },
  { co: "DeepSeek", cat: "native", q: "DeepSeek AI" },
  { co: "SpaceX (xAI, Cursor)", cat: "native", q: "(xAI OR Grok OR SpaceX OR Cursor OR Anysphere) AI" },
  { co: "Google DeepMind", cat: "bigtech", q: "Google DeepMind Gemini" },
  { co: "Apple", cat: "bigtech", q: "Apple Intelligence on-device AI" },
  { co: "Microsoft", cat: "bigtech", q: "Microsoft Copilot AI" },
  { co: "Amazon", cat: "bigtech", q: "Amazon AWS Bedrock AI" },
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
  { co: "Sierra AI", cat: "startup", q: "Sierra AI agent" },
];

// Device-relevant AI topics (most material for an on-device-AI device maker).
const TOPICS = [
  { co: "AI 에이전트", cat: "native", tag: "AI 에이전트", n: 3, q: '("AI agent" OR "agentic AI" OR "AI agents")' },
  { co: "", cat: "bigtech", tag: "AI 노트북", topic: true, n: 3, q: '("AI PC" OR "AI laptop" OR "Copilot+ PC" OR "on-device AI" OR "NPU laptop")' },
  { co: "", cat: "bigtech", tag: "AI 폰", topic: true, n: 3, q: '("AI smartphone" OR "AI phone" OR "Galaxy AI" OR "Apple Intelligence" OR "on-device AI" phone)' },
];

// device-topic 기사를 제목 기준으로 실제 업체에 재분류(매칭 없으면 업체 미지정). 토픽은 tag로만 남김.
const DEVICE_CO = [
  [/iphone|ipad|siri|apple intelligence|\bapple\b|macbook|vision pro/i, "Apple"],
  [/copilot\+|surface|windows|\bmicrosoft\b/i, "Microsoft"],
  [/nvidia|geforce|\brtx\b|n1x|\bgb10\b|project digits|jetson/i, "NVIDIA"],
  [/pixel|gemini|\bgoogle\b|android|tensor/i, "Google DeepMind"],
  [/\bmeta\b|llama|ray-ban|quest/i, "Meta AI"],
];
const deviceCo = (title) => { const h = DEVICE_CO.find(([re]) => re.test(title || "")); return h ? h[1] : ""; };

// ---- XML / HTML helpers -------------------------------------------------
function decode(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")  // entities FIRST
    .replace(/<[^>]+>/g, " ")                                                 // then strip tags (kills <font ...>)
    .replace(/\s+/g, " ").trim();
}
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i")); return m ? m[1] : ""; };
const attr = (xml, name, a) => { const m = xml.match(new RegExp(`<${name}[^>]*\\b${a}="([^"]*)"`, "i")); return m ? m[1] : ""; };
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } }
function allowed(host) { return ALLOW.some(d => host === d || host.endsWith("." + d)); }

function parseItems(xml) {
  const items = []; const re = /<item>([\s\S]*?)<\/item>/g; let m;
  while ((m = re.exec(xml))) items.push(m[1]);
  return items;
}

async function fetchRss(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:14d")}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.text();
}

// pull authoritative English items for one query
async function pull(src, limit) {
  try {
    const xml = await fetchRss(src.q);
    const out = [];
    for (const it of parseItems(xml)) {
      const rawTitle = decode(tag(it, "title"));
      const link = decode(tag(it, "link"));
      const srcUrl = attr(it, "source", "url");
      const srcName = decode(tag(it, "source")) || (rawTitle.includes(" - ") ? rawTitle.split(" - ").pop() : "");
      const host = hostOf(srcUrl);
      if (!host || !allowed(host)) continue;                 // authoritative English only
      const title = rawTitle.replace(/ - [^-]*$/, "").trim() || rawTitle;
      const desc = decode(tag(it, "description")).slice(0, 240);
      const pub = tag(it, "pubDate");
      const d = pub ? new Date(pub) : new Date();
      const date = isNaN(d) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
      const co = src.topic ? deviceCo(title) : src.co;
      out.push({ date, co, cat: src.cat, source: srcName || host, title, descEn: desc, url: link, tag: src.tag || "최신" });
      if (out.length >= limit) break;
    }
    console.log(`[news:${src.tag || src.co || "topic"}] ${out.length} authoritative item(s)`);
    return out;
  } catch (e) {
    console.warn(`[news:${src.tag || src.co || "topic"}] failed: ${e.message}`);
    return [];
  }
}

// ---- Claude summarization: 3-line Korean brief, device-maker lens ----
const SYS = "당신은 글로벌 스마트폰·온디바이스 AI 기기 제조사의 전략 분석가입니다. 영문 AI 뉴스를 한국어로 요약합니다. 특정 기업명(삼성, MX, 사업부 등)은 절대 언급하지 않습니다. 과장 없이 사실에 근거해 작성합니다.";
function userPrompt(a) {
  return `다음 영문 AI 뉴스를 한국어로 정리하세요.\n\n제목: ${a.title}\n내용: ${a.descEn || "(본문 요약 없음)"}\n\n출력(JSON):\n- title_ko: 위 영문 제목을 자연스러운 한국어로 번역(30자 내외, 직역 아닌 의역 허용).\n- summary: 주요 내용을 정확히 3줄, 한국어 개조식으로 요약. 각 줄은 "· "로 시작하고 명사형 종결("~함/~음/~임")로 끝냅니다. 1줄=핵심 사실, 2줄=수치·배경, 3줄=온디바이스 AI·AI 에이전트·스마트폰/노트북 단말 전략 관점의 시사점.\n\n금지: 출처/매체명을 본문에 적지 마세요. 특정 회사명(삼성·MX·사업부 등)을 시사점에 적지 마세요.`;
}

async function summarize(a) {
  if (!KEY) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: SYS,
        messages: [{ role: "user", content: userPrompt(a) }],
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: { title_ko: { type: "string" }, summary: { type: "string" } },
              required: ["title_ko", "summary"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status + " " + (await res.text()).slice(0, 120));
    const j = await res.json();
    if (j.stop_reason === "refusal") throw new Error("refusal");
    const block = (j.content || []).find(b => b.type === "text");
    if (!block) throw new Error("no text");
    const parsed = JSON.parse(block.text);
    if (!parsed.title_ko || !parsed.summary) throw new Error("bad json");
    return { title_ko: decode(parsed.title_ko), summary: decode(parsed.summary.replace(/\\n/g, "\n")) };
  } catch (e) {
    console.warn(`[sum:${a.co}] ${e.message}`);
    return null;
  }
}

// limited-concurrency map
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  }));
  return out;
}

const isKoreanSummary = a => a && /[가-힣]/.test(a.title || "") && a.summary && !/출처\s*[:：]/.test(a.summary);

async function main() {
  console.log(`Crawling authoritative English AI news… (LLM summaries: ${KEY ? "on" : "OFF — set ANTHROPIC_API_KEY"})`);
  const companyItems = (await Promise.all(COMPANIES.map(c => pull(c, 1)))).flat();
  const topicItems = (await Promise.all(TOPICS.map(t => pull(t, t.n)))).flat();

  // de-dupe this run by URL
  const seen = new Set();
  const raw = [...companyItems, ...topicItems].filter(a => a.url && !seen.has(a.url) && seen.add(a.url));

  // previously stored articles — reuse their summaries so we never re-crawl/re-summarize duplicates
  let prev = [];
  try { prev = JSON.parse(await readFile("news.json", "utf8")).articles || []; } catch {}
  const prevByUrl = new Map(prev.map(a => [a.url, a]));

  // only call the API for genuinely new URLs (or prior entries that lack a good Korean summary)
  const toSummarize = raw.filter(a => !isKoreanSummary(prevByUrl.get(a.url)));
  const sums = await pool(toSummarize, 3, summarize);
  const sumByUrl = new Map();
  toSummarize.forEach((a, k) => { if (sums[k]) sumByUrl.set(a.url, sums[k]); });

  const processed = raw.map(a => {
    const old = prevByUrl.get(a.url);
    if (isKoreanSummary(old)) return old;                 // reuse — no duplicate work
    const s = sumByUrl.get(a.url);
    return {
      date: a.date, co: a.co, cat: a.cat, source: a.source, tag: a.tag, url: a.url,
      title: s ? s.title_ko : a.title,                    // 한국어 번역 제목
      summary: s ? s.summary : `· ${a.title}`,            // 출처 줄 없음 (출처는 상단 표기)
    };
  });

  // accumulate: this run + older prev not re-seen, de-duped by URL, newest first, capped
  // 하단 '출처:' 줄은 어떤 항목에서도 노출되지 않도록 제거(출처는 상단에 표기)
  const stripSrc = s => String(s || "").split("\n").filter(l => !/출처\s*[:：]/.test(l)).join("\n").trim();
  const curUrls = new Set(raw.map(a => a.url));
  const dseen = new Set();
  const final = [...processed, ...prev.filter(a => !curUrls.has(a.url))]
    .filter(a => a.url && !dseen.has(a.url) && dseen.add(a.url))
    .map(a => ({ ...a, summary: stripSrc(a.summary) }))
    .sort((x, y) => (x.date < y.date ? 1 : -1))
    .slice(0, 100);

  const out = raw.length ? final : prev;   // network failure → keep prev untouched
  await writeFile("news.json", JSON.stringify({ generatedAt: new Date().toISOString(), count: out.length, articles: out }, null, 2) + "\n");
  console.log(`Wrote news.json with ${out.length} articles (${sums.filter(Boolean).length} new Korean summaries).`);
}

main().catch((e) => { console.error(e); process.exit(0); });
