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
import { llmJSON, llmAvailable } from "./llm.mjs";

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
  { co: "", cat: "bigtech", tag: "AI 폰", topic: true, n: 3, q: '("AI smartphone" OR "AI phone" OR "Pixel AI" OR "Apple Intelligence" OR "on-device AI" phone)' },
  // 경쟁 단말·칩 진영(중국 제조사·모바일 실리콘) — 단말 사업 경쟁 관점 핵심 스트림
  { co: "", cat: "bigtech", tag: "경쟁 단말", topic: true, n: 3, q: '("Xiaomi" OR "Honor" OR "OPPO" OR "vivo" OR "Snapdragon" OR "Dimensity") AI smartphone' },
  // 탭별 전용 스트림: 인프라(Signal 탭)·수익화(BizModel 탭)·규제
  { co: "", cat: "bigtech", tag: "Infra", topic: true, n: 3, q: '(HBM OR "data center" OR "AI infrastructure" OR "co-packaged optics" OR hyperscaler OR capex) AI' },
  { co: "", cat: "native", tag: "수익화", topic: true, n: 2, q: '("AI pricing" OR "AI subscription" OR "AI revenue" OR "API pricing" OR "AI monetization")' },
  { co: "", cat: "native", tag: "규제", topic: true, n: 2, q: '("AI regulation" OR "AI export control" OR "AI Act" OR "chip export controls")' },
];

// ---- 직접 퍼블리셔 RSS 피드(구글뉴스 비경유 — 소스 다변화, 단일 게이트웨이 리스크 제거) ----
const DIRECT_FEEDS = [
  { source: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { source: "The Verge", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", atom: true },
  { source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/technology-lab" },
  { source: "VentureBeat", url: "https://venturebeat.com/category/ai/feed/" },
  { source: "MIT Tech Review", url: "https://www.technologyreview.com/feed/" },
  { source: "IEEE Spectrum", url: "https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss" },
];
const AI_RE = /\bAI\b|artificial intelligence|\bLLM\b|GPT|Claude|Gemini|agentic|chatbot|machine learning|foundation model|inference|GPU|HBM|data center/i;

async function pullDirect(feed, limit = 2) {
  try {
    const res = await fetch(feed.url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const xml = await res.text();
    const blockRe = feed.atom ? /<entry>([\s\S]*?)<\/entry>/g : /<item>([\s\S]*?)<\/item>/g;
    const out = []; let m;
    while ((m = blockRe.exec(xml)) && out.length < limit) {
      const it = m[1];
      const title = decode(tag(it, "title"));
      if (!title || !AI_RE.test(title)) continue;
      let link = decode(tag(it, "link"));
      if (feed.atom && (!link || !/^http/.test(link))) { const lm = it.match(/<link[^>]*href="([^"]+)"/i); link = lm ? decode(lm[1]) : ""; }
      if (!link) continue;
      const date = pubDateOf(tag(it, "pubDate") || tag(it, "published") || tag(it, "updated"));
      if ((Date.now() - new Date(date + "T00:00:00Z").getTime()) / 86400000 > 7) continue;   // 최근 7일만
      const desc = cleanDesc(decode(tag(it, "description") || tag(it, "summary"))).slice(0, 240);
      out.push({ date, co: deviceCo(title), cat: "bigtech", source: feed.source, title, descEn: desc, url: link, tag: "글로벌" });
    }
    console.log(`[news:rss:${feed.source}] ${out.length} item(s)`);
    return out;
  } catch (e) { console.warn(`[news:rss:${feed.source}] ${e.message}`); return []; }
}

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
    .replace(/<style[\s\S]*?<\/style>/gi, " ")                                // kill CSS blocks (leaked into feed)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")                             // kill inline JS blocks
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")  // entities FIRST
    .replace(/<[^>]+>/g, " ")                                                 // then strip tags (kills <font ...>)
    .replace(/\{[^{}]*\}/g, " ")                                              // leftover CSS rule bodies { … }
    .replace(/\s+/g, " ").trim();
}

// Residue cleaner for article DESCRIPTIONS only (never titles). Publisher RSS feeds (MIT TR /
// IEEE 등) sometimes append their stylesheet or nav chrome as plain text after the real prose.
// Strategy: cut the description at the first CSS/JS junk marker (prose comes first, chrome after),
// then remove nav-keyword runs and trailing punctuation fragments.
const JUNK_MARK = /(\{|\}|!important|no-repeat|widget__|::?(?:before|after)|\.fa-|@media|font-family|rgba?\(|\d+px;|cssRules)/i;
function cleanDesc(t) {
  let s = String(t || "");
  const at = s.search(JUNK_MARK);
  if (at >= 20) s = s.slice(0, at);                              // keep the clean lead, drop the chrome tail
  else if (at !== -1) s = s.replace(new RegExp(JUNK_MARK.source + "[\\s\\S]*$", "i"), " "); // junk very early → drop from marker on
  s = s.replace(/https?:\/\/\S+/g, " ")                          // stray urls
    // remove runs of 2+ consecutive nav keywords ("주요 주제 뉴스레터 이벤트 오디오 …")
    // (JS \b is ASCII-only, so match keyword + optional trailing space instead)
    .replace(/(?:(?:주요\s*주제|뉴스레터|이벤트|오디오|다운로드|구독|메뉴|검색|로그인|회원가입|더보기)\s*){2,}/g, " ")
    .replace(/\s+/g, " ").trim()
    .replace(/[\s'"()\-–—:;,·]+$/,"").trim();                    // trailing partial fragment ("제안 ')")
  return s;
}
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i")); return m ? m[1] : ""; };

// 게재일 파싱 — 원문에 표기된 '현지 달력 날짜'를 그대로 사용(UTC 변환에 따른 하루 오차 방지).
// RFC822("Fri, 12 Jun 2026 21:00:00 -0400")·ISO("2026-07-20T12:43:00-04:00") 모두 표기된 날짜를 직접 추출.
const MON = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
function pubDateOf(raw) {
  const s = decode(raw || "").trim();
  const today = () => new Date().toISOString().slice(0, 10);
  if (!s) return today();
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);                     // ISO 8601 — 표기된 날짜부(오프셋 로컬)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);            // RFC822 — "12 Jun 2026" 리터럴 날짜
  if (m) { const mo = MON[m[2].slice(0, 3).toLowerCase()]; if (mo) return `${m[3]}-${mo}-${String(m[1]).padStart(2, "0")}`; }
  const d = new Date(s);                                          // 폴백
  return isNaN(d) ? today() : d.toISOString().slice(0, 10);
}
const attr = (xml, name, a) => { const m = xml.match(new RegExp(`<${name}[^>]*\\b${a}="([^"]*)"`, "i")); return m ? m[1] : ""; };
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } }
function allowed(host) { return ALLOW.some(d => host === d || host.endsWith("." + d)); }

function parseItems(xml) {
  const items = []; const re = /<item>([\s\S]*?)<\/item>/g; let m;
  while ((m = re.exec(xml))) items.push(m[1]);
  return items;
}

// ---- 개조식 정규화 · 매체 꼬리 제거 · 금지어 ---------------------------------
// 존댓말·평서형 종결 → 명사형("~함/~음/~임"), 끝 마침표 제거
const NOUN_END = [
  [/합니다$/, "함"], [/입니다$/, "임"], [/됩니다$/, "됨"], [/갑니다$/, "감"], [/옵니다$/, "옴"],
  [/있습니다$/, "있음"], [/없습니다$/, "없음"], [/([가-힣])습니다$/, "$1음"],
  [/한다$/, "함"], [/이다$/, "임"], [/된다$/, "됨"], [/있다$/, "있음"], [/없다$/, "없음"],
  [/했다$/, "했음"], [/였다$/, "였음"], [/왔다$/, "왔음"], [/([가-힣])었다$/, "$1었음"], [/([가-힣])았다$/, "$1았음"],
];
function nounize(line) {
  let l = String(line || "").trim().replace(/[.。]+\s*$/, "");
  l = l.replace(/([가-힣])(?:습니다|ㅂ니다)[.。]\s+/g, "$1음 — ").replace(/합니다[.。]\s+/g, "함 — ")
       .replace(/([가-힣])다[.。]\s+(?=[가-힣A-Za-z])/g, "$1다 — ");
  for (const [re, to] of NOUN_END) { if (re.test(l)) { l = l.replace(re, to); break; } }
  return l.replace(/[.。]+\s*$/, "").trim();
}
const nounizeSummary = sm => String(sm || "").split("\n").map(l => l.trim()).filter(Boolean)
  .map(l => "· " + nounize(l.replace(/^[·\-•]\s*/, ""))).join("\n");

// 화면 노출 금지어 — 제목·요약에 포함되면 해당 기사 제외
const BANNED = /삼성|samsung|갤럭시|galaxy|\bMX\b/i;

// 주요 매체명(영문·한글) — 요약/제목 끝의 매체 꼬리 제거용
const PUBS = /(business insider|비즈니스\s*인사이더|reuters|로이터|bloomberg|블룸버그|techcrunch|테크크런치|the verge|버지|cnbc|wsj|wall street journal|월스트리트|financial times|the information|axios|engadget|ars technica|the guardian|가디언|venturebeat|벤처비트|forbes|포브스|wired|와이어드|cnet|new york times|뉴욕\s*타임스|associated press|ap통신|mit tech review|technology review|ieee spectrum|9to5|fast company|패스트컴퍼니)/i;

// 본문/제목 끝에 붙은 매체명 꼬리 제거(" - Business Insider", " | 비즈니스 인사이더" 등)
function stripSourceTail(text, source) {
  let t = String(text || "").trim();
  if (source) {
    const esc = String(source).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp("[\\-\\|·,–—]\\s*" + esc + "\\s*$", "i"), "").trim();
  }
  t = t.replace(/[\-\|·,–—]\s*[A-Za-z][\w .&'\-]{1,28}$/, (m) => PUBS.test(m) ? "" : m).trim();
  return t;
}

// 제목 정리: '독점:'/'Exclusive:' 등 라벨과 끝의 매체명 꼬리 제거(제목=요약 중복 방지) + 개조식
function cleanTitle(t, source) {
  let s = String(t || "").trim();
  s = s.replace(/^\s*(독점|단독|속보|Exclusive|Breaking|Opinion|Analysis|Update)\s*[:：]\s*/i, "");
  s = stripSourceTail(s, source);
  s = nounize(s);
  return s.trim() || String(t || "").trim();
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
      const desc = cleanDesc(decode(tag(it, "description"))).slice(0, 240);
      const date = pubDateOf(tag(it, "pubDate"));
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
const SYS = "당신은 글로벌 스마트폰·온디바이스 AI 기기 제조사의 전략 분석가입니다. 경쟁 제조사·모델사·칩사의 움직임이 자사 단말 사업에 주는 시사점 관점에서 영문 AI 뉴스를 한국어로 요약합니다. 자사·소속 기업명(삼성, MX, Galaxy, 사업부 등)은 절대 언급하지 않습니다. 과장 없이 사실에 근거해 작성합니다.";
function userPrompt(a) {
  return `다음 영문 AI 뉴스를 한국어로 정리하세요.\n\n제목: ${a.title}\n내용: ${a.descEn || "(본문 요약 없음)"}\n\n출력(JSON):\n- title_ko: 위 영문 제목을 자연스러운 한국어로 번역(30자 내외, 직역 아닌 의역 허용).\n- summary: 주요 내용을 정확히 3줄, 한국어 개조식으로 요약. 각 줄은 "· "로 시작하고 명사형 종결("~함/~음/~임")로 끝냅니다. 마침표(.)로 끝내지 마세요. 1줄=핵심 사실, 2줄=수치·배경, 3줄=온디바이스 AI·AI 에이전트·스마트폰/노트북 단말 전략 관점의 시사점.\n\n금지: 출처/매체명을 본문에 적지 마세요. 특정 회사명(삼성·MX·사업부 등)을 시사점에 적지 마세요.`;
}

// 배치 요약: 10건/1콜(GitHub Models 무료 쿼터 보호). 실패 청크는 영문 폴백.
async function summarizeBatch(arts) {
  const out = new Array(arts.length).fill(null);
  for (let i = 0; i < arts.length; i += 10) {
    const chunk = arts.slice(i, i + 10);
    const user = `다음 영문 AI 뉴스들을 한국어로 정리해 JSON으로 출력하세요.\n\n` +
      chunk.map((a, k) => `[${k}] 제목: ${a.title}\n내용: ${a.descEn || "(본문 요약 없음)"}`).join("\n\n") +
      `\n\n각 항목을 rows 배열로: {idx, title_ko(자연스러운 한국어 번역 30자 내외), summary(4~5줄 개조식, 각 줄 "· " 시작·명사형 종결·마침표 금지 — 1줄=핵심 사실 상세, 2줄=구체 수치·규모·가격, 3줄=배경·맥락(누가·왜 지금), 4줄=경쟁·시장 파급, 5줄=온디바이스 AI·단말 전략 시사점)}.\n금지: 출처/매체명, 특정 회사명(삼성·MX 등)을 시사점에 쓰지 마세요.`;
    const r = await llmJSON({
      system: SYS, user, maxTokens: 2600,
      schema: { type: "object", properties: { rows: { type: "array", items: { type: "object", properties: { idx: { type: "integer" }, title_ko: { type: "string" }, summary: { type: "string" } }, required: ["idx", "title_ko", "summary"], additionalProperties: false } } }, required: ["rows"], additionalProperties: false },
    });
    if (r && r.data && Array.isArray(r.data.rows)) {
      for (const row of r.data.rows) {
        const t = chunk[row.idx];
        if (t && row.title_ko && row.summary) out[i + row.idx] = { title_ko: decode(row.title_ko), summary: decode(String(row.summary).replace(/\\n/g, "\n")) };
      }
    }
  }
  return out;
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

// 한국어 제목 + 한국어 개조식 다줄(최소 2줄, 보통 3줄) 요약을 갖춘 항목만 유효로 간주
const isKoreanSummary = a => a && /[가-힣]/.test(a.title || "") && a.summary && /[가-힣]/.test(a.summary)
  && a.summary.split("\n").map(l => l.trim()).filter(Boolean).length >= 2
  && !/출처\s*[:：]/.test(a.summary);

async function main() {
  console.log(`Crawling authoritative English AI news… (LLM: ${llmAvailable() || "OFF — rules only"})`);
  const companyItems = (await Promise.all(COMPANIES.map(c => pull(c, 1)))).flat();
  const topicItems = (await Promise.all(TOPICS.map(t => pull(t, t.n)))).flat();
  const directItems = (await Promise.all(DIRECT_FEEDS.map(f => pullDirect(f, 2)))).flat();

  // de-dupe this run by URL
  const seen = new Set();
  const BANNED_SRC = /삼성|samsung|갤럭시|galaxy|\bMX\b/i;   // 관점 노출 방지 — 수집 단계에서 원천 차단
  const raw = [...companyItems, ...topicItems, ...directItems]
    .filter(a => a.url && !seen.has(a.url) && seen.add(a.url))
    .filter(a => !BANNED_SRC.test(`${a.title} ${a.descEn || ""}`));

  // previously stored articles — reuse their summaries so we never re-crawl/re-summarize duplicates
  let prev = [];
  try { prev = JSON.parse(await readFile("news.json", "utf8")).articles || []; } catch {}
  const prevByUrl = new Map(prev.map(a => [a.url, a]));
  // 영문 원제목(titleEn)으로도 매칭 — URL이 리다이렉트/이미지로 바뀌어도 수동 보정 요약을 보존
  const prevByTitleEn = new Map(prev.filter(a => a.titleEn).map(a => [a.titleEn, a]));
  const findOld = a => prevByUrl.get(a.url) || prevByTitleEn.get(a.title);

  // only summarize genuinely new URLs (or prior entries lacking a good Korean summary)
  // 키 없는 GitHub Models(llm.mjs 공급자 체인)로 배치 요약 — 실패 시 원문 폴백
  const toSummarize = raw.filter(a => !isKoreanSummary(findOld(a)));
  const sums = await summarizeBatch(toSummarize);
  const sumByUrl = new Map();
  toSummarize.forEach((a, k) => { if (sums[k]) sumByUrl.set(a.url, sums[k]); });

  const lineCount = sm => String(sm || "").split("\n").map(l => l.trim()).filter(Boolean).length;
  const processed = raw.map(a => {
    const old = findOld(a);
    if (isKoreanSummary(old) && lineCount(old.summary) >= 3) return old;   // 3줄 인사이트(수동 보정 포함)면 재사용
    const s = sumByUrl.get(a.url);
    // LLM 요약 실패 시에도 피드에 요약이 보이도록 — 정제한 원문 설명(descEn)을 폴백으로 사용
    const cleanFallback = cleanDesc(a.descEn || "");
    const summary = s ? s.summary : (cleanFallback ? `· ${cleanFallback.slice(0, 200)}` : `· ${a.title}`);
    return {
      date: a.date, co: a.co, cat: a.cat, source: a.source, tag: a.tag,
      url: (s && s.url) ? s.url : a.url,                   // Google News 리다이렉트 대신 원문 URL
      title: cleanTitle(s ? s.title_ko : a.title, a.source), // 한국어 번역 제목(라벨·매체꼬리 제거)
      titleEn: a.title,                                   // 원문(영문) 제목 — CLI 재요약용
      descEn: (s && s.contentEn) || a.descEn || "",       // 보강된 원문 — CLI 재요약용
      summary,
      needsLLM: lineCount(summary) < 3,                   // 3줄 미만이면 다른 PC Claude CLI가 보강
    };
  });

  // accumulate: this run + older prev not re-seen, de-duped by URL, newest first, capped
  // 하단 '출처:' 줄은 어떤 항목에서도 노출되지 않도록 제거(출처는 상단에 표기)
  const stripSrc = s => String(s || "").split("\n").filter(l => !/출처\s*[:：]/.test(l)).join("\n").trim();
  // 제목=요약(1줄 에코) 또는 본문 없는 깨진 항목 탐지 → 노출 제외(원문 url이 이미지/에셋이면 본문 수집 실패한 쓰레기)
  const norm = s => String(s || "").replace(/^[·\-•]\s*/, "").replace(/^(독점|단독|속보|Exclusive|Breaking)\s*[:：]\s*/i, "").replace(/\s+/g, " ").trim();
  const isTitleEcho = a => {
    const lines = String(a.summary || "").split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length >= 2) return false;                 // 2줄 이상이면 정상 취급
    const sm = norm(lines[0]), t = norm(a.title), te = norm(a.titleEn);
    return !sm || sm === t || sm === te || sm.includes(t) || (te && sm.includes(te));
  };
  const isAssetUrl = u => /googleusercontent\.com|=w\d+|\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(String(u || ""));
  const curUrls = new Set(raw.map(a => a.url));
  const dseen = new Set();
  const final = [...processed, ...prev.filter(a => !curUrls.has(a.url))]
    .filter(a => !BANNED_SRC.test(JSON.stringify(a)))
    .filter(a => a.url && !dseen.has(a.url) && dseen.add(a.url))
    .map(a => ({ ...a, title: nounize(a.title), summary: nounizeSummary(stripSrc(a.summary)) }))  // 개조식·마침표 제거(기존 항목 포함)
    .filter(a => a.title && a.summary)                   // 요약은 한글 우선(번역), 불가 시 영문 폴백 허용
    .filter(a => !isTitleEcho(a) && !isAssetUrl(a.url))   // 제목=요약 에코·이미지 url 깨진 항목 제외
    .filter(a => {                                        // 화면 노출 금지어 포함 기사 제외(드롭 로그 남김)
      const hit = BANNED.test((a.title || "") + " " + (a.summary || ""));
      if (hit) console.log(`[policy] dropped banned-term article: ${String(a.title).slice(0, 60)}`);
      return !hit;
    })
    .sort((x, y) => (x.date < y.date ? 1 : -1))
    .slice(0, 500);   // 계속 누적(과거 기사 유지) — UI가 페이지네이션으로 초기 렌더 경량화

  // network failure → keep prev, but still enforce the banned-term policy on it
  const out = raw.length ? final : prev.filter(a => !BANNED.test((a.title || "") + " " + (a.summary || "")));
  await writeFile("news.json", JSON.stringify({ generatedAt: new Date().toISOString(), count: out.length, articles: out }, null, 2) + "\n");
  console.log(`Wrote news.json with ${out.length} articles (${sums.filter(Boolean).length} new Korean summaries).`);
}

main().catch((e) => { console.error(e); process.exit(0); });
