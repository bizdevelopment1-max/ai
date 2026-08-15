#!/usr/bin/env node
/* ============================================================
   Daily AI news crawler — authoritative ENGLISH sources only.
   - Per-company + device-topic (AI agent / AI PC / AI phone) streams
     from Google News (en-US), filtered to an allowlist of authoritative
     English outlets. Korean sources are excluded by construction.
   - Each card preserves a cleaned publisher/RSS excerpt. No text-generation
     or translation API is called, so the pipeline cannot invent a summary.
   - Source label is always the original English outlet (never an aggregator).
   - HTML (e.g. <font color>) is stripped from all text.
   ============================================================ */
import { writeFile, readFile } from "node:fs/promises";
import { isExcludedText, newsPolicy } from "./news-policy.mjs";
import { enrichSourceBatch, isContentBacked, textSimilarity } from "./source-content.mjs";
import { loadDash } from "./load-dash.mjs";
import { directCompanyNewsMatch, newsQueryFor } from "./company-sources.mjs";
import { loadSuppressionRegistry } from "./suppression-registry.mjs";

// Company-card facts need first-party disclosures or a named publisher report,
// rather than an undated category page. The same policy supplies priority
// streams for the daily crawler, so verified company sources keep refreshing.
const companySourcePolicy = JSON.parse(await readFile("config/company-source-policy.json", "utf8"));
const PRIORITY_STREAMS = Array.isArray(companySourcePolicy.priorityStreams) ? companySourcePolicy.priorityStreams : [];

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const sourceHealth = { failedStreams: [], emptyStreams: [] };

// 네트워크 복원력: 타임아웃 + 지수 백오프 재시도(소스 확대에 따른 일시적 실패 흡수)
async function fetchText(url, opts = {}, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, 400 * Math.pow(2, i)));   // 0.4s → 0.8s → 1.6s
    }
  }
}

// Authoritative English outlets (publisher homepage hostnames). Anything not here is dropped.
const BASE_ALLOW = [
  "reuters.com", "bloomberg.com", "cnbc.com", "techcrunch.com", "theverge.com", "wsj.com",
  "ft.com", "nytimes.com", "wired.com", "arstechnica.com", "axios.com", "theinformation.com",
  "engadget.com", "venturebeat.com", "theguardian.com", "businessinsider.com", "forbes.com",
  "fortune.com", "cnet.com", "zdnet.com", "semafor.com", "theregister.com", "technologyreview.com",
  "spectrum.ieee.org", "androidauthority.com", "9to5google.com", "9to5mac.com", "macrumors.com",
  "tomshardware.com", "anandtech.com", "nikkei.com", "restofworld.org", "platformer.news",
  // ── 추가 소스(권위 영문 매체 확대) ──
  "the-decoder.com", "sifted.eu", "asia.nikkei.com", "scmp.com", "qz.com", "infoq.com",
  "datacenterdynamics.com", "hpcwire.com", "semianalysis.com", "eetimes.com", "huggingface.co",
  "aibusiness.com", "analyticsindiamag.com", "siliconangle.com", "innovationorigins.com",
];
const ALLOW = [...new Set([...BASE_ALLOW, ...(companySourcePolicy.publisherDomains || [])])];

// The site registry is the single source of truth.  Adding a company to the
// dashboard automatically adds a bounded discovery stream on the next run.
// The query may be broad; the direct-company gate below decides attribution.
const COMPANIES = (loadDash().COMPANIES || []).map(company => ({
  co: company.name,
  cat: company.cat,
  domain: company.domain,
  q: newsQueryFor(company.name),
}));

// Device-relevant AI topics (most material for an on-device-AI device maker).
const TOPICS = [
  { co: "AI 에이전트", cat: "native", tag: "AI 에이전트", n: 3, q: '("AI agent" OR "agentic AI" OR "AI agents")' },
  { co: "", cat: "bigtech", tag: "AI 노트북", topic: true, n: 3, q: '("AI PC" OR "AI laptop" OR "Copilot+ PC" OR "on-device AI" OR "NPU laptop")' },
  { co: "", cat: "bigtech", tag: "AI 폰", topic: true, n: 3, q: '("AI smartphone" OR "AI phone" OR "Pixel AI" OR "Apple Intelligence" OR "on-device AI" phone)' },
  // 경쟁 단말·칩 진영(중국 제조사·모바일 실리콘) — 단말 사업 경쟁 관점 핵심 스트림
  { co: "", cat: "bigtech", tag: "경쟁 단말", topic: true, n: 3, q: '("Xiaomi" OR "Honor" OR "OPPO" OR "vivo" OR "Snapdragon" OR "Dimensity") AI smartphone' },
  // 휴대폰 AI 신사업 전용 스트림: 사용자 과업·경험·수익화·파트너십
  { co: "", cat: "bigtech", tag: "개인 AI", topic: true, n: 3, q: '("personal AI" OR "AI assistant" OR "mobile agent") (smartphone OR mobile OR Android OR iPhone)' },
  { co: "", cat: "bigtech", tag: "카메라·크리에이터", topic: true, n: 3, q: '("AI camera" OR "generative edit" OR "mobile video" OR "creator AI") (smartphone OR mobile app)' },
  { co: "", cat: "bigtech", tag: "통화·커뮤니케이션", topic: true, n: 3, q: '("live translation" OR "call summary" OR "voice assistant" OR "messaging AI") (phone OR mobile)' },
  { co: "", cat: "bigtech", tag: "모바일 개발·배포", topic: true, n: 3, q: '("on-device AI" OR "mobile AI SDK" OR "agent API" OR "AI app store") (Android OR iOS OR smartphone)' },
  { co: "", cat: "native", tag: "수익화", topic: true, n: 2, q: '("AI pricing" OR "AI subscription" OR "AI revenue" OR "API pricing" OR "AI monetization")' },
  { co: "", cat: "native", tag: "규제", topic: true, n: 2, q: '("AI regulation" OR "AI export control" OR "AI Act" OR "chip export controls")' },
  // ── 신규 스트림(신사업·경쟁 관점 확대) ──
  { co: "", cat: "bigtech", tag: "로보틱스", topic: true, n: 2, q: '("humanoid robot" OR "physical AI" OR "Figure AI" OR "1X robot" OR "robotics foundation model")' },
  { co: "", cat: "bigtech", tag: "모바일 AI 칩", topic: true, n: 2, q: '("mobile NPU" OR "smartphone AI chip" OR Snapdragon OR Dimensity OR "Apple Neural Engine")' },
  { co: "", cat: "native", tag: "오픈소스", topic: true, n: 2, q: '("open-weight model" OR "open source LLM" OR "open model release" OR "Llama" OR "sovereign AI")' },
  { co: "", cat: "native", tag: "엔터프라이즈", topic: true, n: 2, q: '("enterprise AI adoption" OR "AI ROI" OR "AI agent enterprise" OR "AI productivity")' },
  { co: "", cat: "bigtech", tag: "웨어러블·XR", topic: true, n: 2, q: '("smart glasses" OR "AI wearable" OR "AI earbuds" OR "mixed reality AI" OR "AR glasses AI")' },
];

// ---- 직접 퍼블리셔 RSS 피드(구글뉴스 비경유 — 소스 다변화, 단일 게이트웨이 리스크 제거) ----
const DIRECT_FEEDS = [
  { source: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { source: "The Verge", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", atom: true },
  { source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/technology-lab" },
  { source: "VentureBeat", url: "https://venturebeat.com/category/ai/feed/" },
  { source: "MIT Tech Review", url: "https://www.technologyreview.com/feed/" },
  { source: "IEEE Spectrum", url: "https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss" },
  // ── 추가 직접 RSS(소스 다변화·복원력) ──
  { source: "The Decoder", url: "https://the-decoder.com/feed/" },
  { source: "ZDNet", url: "https://www.zdnet.com/topic/artificial-intelligence/rss.xml" },
  { source: "The Register", url: "https://www.theregister.com/headlines.atom", atom: true },
  { source: "Hugging Face", url: "https://huggingface.co/blog/feed.xml", atom: true },
  { source: "Wired", url: "https://www.wired.com/feed/tag/ai/latest/rss" },
  { source: "Engadget", url: "https://www.engadget.com/rss.xml" },
  { source: "SiliconANGLE", url: "https://siliconangle.com/category/ai/feed/" },
  { source: "AI Business", url: "https://aibusiness.com/rss.xml" },
];
const AI_RE = /\bAI\b|artificial intelligence|\bLLM\b|GPT|Claude|Gemini|agentic|chatbot|machine learning|foundation model|on-device|smartphone|mobile assistant|mobile agent/i;

async function pullDirect(feed, limit = 2) {
  try {
    const xml = await fetchText(feed.url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
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
    if (!out.length) sourceHealth.emptyStreams.push(`rss:${feed.source}`);
    console.log(`[news:rss:${feed.source}] ${out.length} item(s)`);
    return out;
  } catch (e) {
    sourceHealth.failedStreams.push({ stream: `rss:${feed.source}`, error: e.message });
    console.warn(`[news:rss:${feed.source}] ${e.message}`);
    return [];
  }
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
  return fetchText(url, { headers: { "User-Agent": UA } });
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
      const companyMatch = src.topic
        ? { matched: true }
        : directCompanyNewsMatch(src.co, { titleEn: title, url: link }, src.domain);
      // A query label is never sufficient company evidence.  Unmatched
      // articles may stay in the general feed but cannot enter a company panel.
      const co = src.topic ? deviceCo(title) : (companyMatch.matched ? src.co : "");
      out.push({ date, co, cat: src.cat, source: srcName || host, title, descEn: desc, url: link, tag: src.tag || "최신" });
      if (out.length >= limit) break;
    }
    const stream = src.tag || src.co || "topic";
    if (!out.length) sourceHealth.emptyStreams.push(`google-news:${stream}`);
    console.log(`[news:${stream}] ${out.length} authoritative item(s)`);
    return out;
  } catch (e) {
    sourceHealth.failedStreams.push({ stream: `google-news:${src.tag || src.co || "topic"}`, error: e.message });
    console.warn(`[news:${src.tag || src.co || "topic"}] failed: ${e.message}`);
    return [];
  }
}

// ---- Source excerpt: deterministic cleaning only, never generated text ----
async function summarizeBatch(arts) {
  return enrichSourceBatch(arts, 4);
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

const SUMMARY_VERSION = 4;

function dedupeLatestBriefings(rows) {
  const accepted = [];
  const latestFirst = [...rows].sort((left, right) =>
    String(right.date || "").localeCompare(String(left.date || "")));
  for (const article of latestFirst) {
    const articleDate = Date.parse(article.date || "") || 0;
    const repeated = accepted.some(previous => {
      const previousDate = Date.parse(previous.date || "") || 0;
      const withinThreeDays = articleDate && previousDate
        ? Math.abs(articleDate - previousDate) <= 3 * 86_400_000
        : true;
      const sameSubject = article.co && previous.co
        ? article.co === previous.co
        : article.cat && article.cat === previous.cat;
      return withinThreeDays && sameSubject
        && textSimilarity(article.titleEn || article.title, previous.titleEn || previous.title) >= 0.84;
    });
    if (!repeated) accepted.push(article);
  }
  return accepted;
}

async function main() {
  console.log("Crawling authoritative English AI news… (publisher/RSS excerpts; no AI API)");
  const suppression = await loadSuppressionRegistry();
  const activeCompanies = COMPANIES.filter(company => !suppression.hasCompany(company.name || company.co || company));
  const companyItems = (await pool(activeCompanies, 8, c => pull(c, 1))).flat();
  const topicItems = (await Promise.all(TOPICS.map(t => pull(t, t.n)))).flat();
  const priorityItems = (await Promise.all(PRIORITY_STREAMS.map(stream => pull(stream, stream.n || 1)))).flat();
  const directItems = (await Promise.all(DIRECT_FEEDS.map(f => pullDirect(f, 2)))).flat();

  // 삭제 블록리스트(비밀번호 삭제) — 해당 URL은 다시 크롤하지 않음
  // de-dupe this run by URL
  const seen = new Set();
  const raw = [...companyItems, ...topicItems, ...priorityItems, ...directItems]
    .filter(a => a.url && !seen.has(a.url) && seen.add(a.url))
    .filter(a => !isExcludedText(`${a.title} ${a.descEn || ""}`))
    .filter(a => !suppression.hasUrl(a.url) && !suppression.hasCompany(a.co));

  // previously stored articles — reuse their summaries so we never re-crawl/re-summarize duplicates
  let prev = [];
  try { prev = (JSON.parse(await readFile("news.json", "utf8")).articles || [])
    .filter(article => !suppression.matches(article, "article")); } catch {}
  const prevByUrl = new Map(prev.flatMap(a => [[a.url, a], ...(a.rssUrl ? [[a.rssUrl, a]] : [])]));
  // 영문 원제목(titleEn)으로도 매칭 — URL이 리다이렉트/이미지로 바뀌어도 수동 보정 요약을 보존
  const prevByTitleEn = new Map(prev.filter(a => a.titleEn).map(a => [a.titleEn, a]));
  const findOld = a => prevByUrl.get(a.url) || prevByTitleEn.get(a.title);

  // Only extract newly seen URLs. Legacy generated entries are preserved in
  // history but are not reused as displayable source excerpts.
  const toSummarize = raw.filter(a => !isContentBacked(findOld(a)));
  const sums = await summarizeBatch(toSummarize);
  const sumByUrl = new Map();
  toSummarize.forEach((a, k) => { if (sums[k]) sumByUrl.set(a.url, sums[k]); });

  const processed = raw.map(a => {
    const old = findOld(a);
    if (isContentBacked(old)) return old;
    const s = sumByUrl.get(a.url);
    return {
      ...(s || a),
      date: a.date, co: a.co, cat: a.cat, source: a.source, tag: a.tag,
      ...(s?.rssUrl ? {} : { rssUrl: a.url }),
      collectedAt: new Date().toISOString(),
      needsLLM: false,
      displayEligible: isContentBacked(s),
      ...(s?.summaryVersion ? {} : {
        title: cleanTitle(a.title, a.source), titleEn: a.title, descEn: a.descEn || "",
        summary: "", summaryLinesEn: [], summaryVersion: SUMMARY_VERSION,
        summaryMode: "source-content-extractive", summaryEngine: "source-content-extractive",
      }),
    };
  });

  // accumulate: this run + older prev not re-seen, de-duped by URL, newest first, capped
  const isAssetUrl = u => /googleusercontent\.com|=w\d+|\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(String(u || ""));
  const curUrls = new Set(raw.map(a => a.url));
  const dseen = new Set();
  // 제목 정규화 키 — 같은 사건을 여러 소스가 다룬 근사 중복 제거(소스 확대 시 유용)
  const tkey = a => String(a.titleEn || a.title || "").toLowerCase().replace(/[^a-z0-9가-힣]/g, "").slice(0, 48);
  const tseen = new Set();
  const final = dedupeLatestBriefings([...processed, ...prev.filter(a => !curUrls.has(a.rssUrl || a.url))])
    .filter(a => !isExcludedText(JSON.stringify(a)))
    .filter(a => a.url && !dseen.has(a.url) && dseen.add(a.url))
    .filter(a => { const k = tkey(a); if (!k || tseen.has(k)) return !k; tseen.add(k); return true; })  // 제목 근사 중복 제거
    .filter(a => a.title && a.summary)
    .filter(a => !isAssetUrl(a.url))
    .filter(a => {
      const hit = isExcludedText((a.title || "") + " " + (a.summary || ""));
      if (hit) console.log(`[policy] dropped banned-term article: ${String(a.title).slice(0, 60)}`);
      return !hit;
    })
    .sort((x, y) => (x.date < y.date ? 1 : -1))
    .slice(0, 500);   // 계속 누적(과거 기사 유지) — UI가 페이지네이션으로 초기 렌더 경량화

  const crawlHealth = {
    generatedAt: new Date().toISOString(),
    mode: "source-content-extractive",
    policyVersion: newsPolicy.version,
    streams: { googleNews: COMPANIES.length + TOPICS.length + PRIORITY_STREAMS.length, directRss: DIRECT_FEEDS.length },
    acceptedCandidates: raw.length,
    failedStreams: sourceHealth.failedStreams,
    emptyStreams: sourceHealth.emptyStreams,
    status: sourceHealth.failedStreams.length ? "partial" : "ok",
  };
  await writeFile("collection-health.json", JSON.stringify(crawlHealth, null, 2) + "\n");

  if (!raw.length) {
    throw new Error("No new candidates were collected from any news source; keeping the previous bundle unchanged.");
  }
  const out = final;
  await writeFile("news.json", JSON.stringify({ generatedAt: new Date().toISOString(), count: out.length, articles: out }, null, 2) + "\n");
  console.log(`Wrote news.json with ${out.length} articles (${sums.filter(isContentBacked).length} new source-page briefings; failed streams: ${sourceHealth.failedStreams.length}).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
