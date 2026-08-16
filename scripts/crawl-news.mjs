#!/usr/bin/env node
/* ============================================================
   Daily AI news crawler — original-language, authoritative sources.
   - Per-company + device-topic + MX regional/supply-chain streams from
     Google News, filtered to a versioned publisher allowlist.
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
import { sanitizePublicCopy } from "./public-copy.mjs";

// Company-card facts need first-party disclosures or a named publisher report,
// rather than an undated category page. The same policy supplies priority
// streams for the daily crawler, so verified company sources keep refreshing.
const companySourcePolicy = JSON.parse(await readFile("config/company-source-policy.json", "utf8"));
const mxSourcePolicy = JSON.parse(await readFile("config/mx-source-policy.json", "utf8"));
const officialSourceRegistry = JSON.parse(await readFile("config/official-source-registry.json", "utf8"));
const sourceRegistrySnapshot = await readFile("source-snapshot.json", "utf8").then(JSON.parse).catch(() => ({ items: [] }));
const sourceRegistryReport = await readFile("source-collection-report.json", "utf8").then(JSON.parse).catch(() => ({ streamHealth: [], connectorStatus: [] }));
const registryReportAgeMs = Date.now() - Date.parse(sourceRegistryReport.generatedAt || 0);
const registryCollectionFresh = Number.isFinite(registryReportAgeMs) && registryReportAgeMs >= 0 && registryReportAgeMs <= 8 * 60 * 60 * 1000;
const PRIORITY_STREAMS = Array.isArray(companySourcePolicy.priorityStreams) ? companySourcePolicy.priorityStreams : [];
const OFFICIAL_SITEMAPS = Array.isArray(officialSourceRegistry.sitemaps)
  ? officialSourceRegistry.sitemaps.filter(stream => !String(stream.status || "").startsWith("disabled"))
  : [];
const OFFICIAL_FEEDS = Array.isArray(officialSourceRegistry.officialFeeds) ? officialSourceRegistry.officialFeeds : [];
const OFFICIAL_HTML_INDEXES = Array.isArray(officialSourceRegistry.htmlIndexes)
  ? officialSourceRegistry.htmlIndexes.filter(stream => !String(stream.status || "").startsWith("disabled"))
  : [];
const OFFICIAL_API_CONNECTORS = Array.isArray(officialSourceRegistry.apiConnectors) ? officialSourceRegistry.apiConnectors : [];
const REGISTRY_SOURCE_DEFINITIONS = [
  ...OFFICIAL_FEEDS.map(source => ({ ...source, registryId: `official-feed:${source.source}` })),
  ...OFFICIAL_SITEMAPS.map(source => ({ ...source, registryId: `official-sitemap:${source.source}` })),
  ...OFFICIAL_HTML_INDEXES.map(source => ({ ...source, registryId: `official-html:${source.source}` })),
  ...OFFICIAL_API_CONNECTORS.map(source => ({ ...source, registryId: source.id })),
];
const normalizedEntity = value => String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const registrySourceMatches = (source, company) => {
  const target = normalizedEntity(company);
  return [source.company, source.source, ...(source.aliases || [])].some(value => normalizedEntity(value) === target);
};
const isPlaceholderRegistryEntry = item => {
  const title = String(item.titleEn || item.title || "").trim();
  let decodedPath = "";
  try { decodedPath = decodeURIComponent(new URL(item.url || item.rssUrl || "").pathname); } catch {}
  return /^(?:official update|index|home|news|blog|\d+|\d+\s*(?:day|week|month|year)s?|page\s*\d+)$/i.test(title)
    || /\/(?:tag|category)\/\d/i.test(decodedPath);
};
const UNDATED_REGISTRY_URLS = new Set((sourceRegistrySnapshot.items || [])
  .filter(item => item.kind === "undated-page")
  .map(item => item.url));
const REGISTRY_ARTICLES = (sourceRegistrySnapshot.items || [])
  .filter(item => item.kind === "article" && /^https?:\/\//.test(item.url || "") && Number.isFinite(Date.parse(item.publishedAt || "")))
  .filter(item => !isPlaceholderRegistryEntry(item))
  .filter(item => {
    const published = Date.parse(item.publishedAt || 0);
    return Number.isFinite(published) && published >= Date.now() - 45 * 86_400_000;
  })
  .map(item => ({
    date: String(item.publishedAt || item.lastSeenAt).slice(0, 10),
    co: item.company || "",
    cat: /model|research|open-source|developer/i.test(item.category || "") ? "native" : "bigtech",
    source: item.source,
    sourceId: item.sourceId,
    title: item.title,
    descEn: item.excerpt || "",
    url: item.url,
    tag: item.category || "official-source",
    evidenceTier: item.sourceTier || "official",
    sourceType: item.sourceType || "official-registry",
  }));

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const sourceHealth = { failedStreams: [], emptyStreams: [], quietStreams: [], reachableStreams: [], successfulStreams: [] };

// 네트워크 복원력: 타임아웃 + 지수 백오프 재시도(소스 확대에 따른 일시적 실패 흡수)
async function fetchText(url, opts = {}, tries = 3) {
  const { timeoutMs = 12000, ...fetchOptions } = opts;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, { ...fetchOptions, signal: ctrl.signal });
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
  // MX regional device, carrier and supply-chain coverage
  "36kr.com", "technode.com", "jiemian.com", "ithome.com", "xinsheng.huawei.com", "mi.com",
  "xtech.nikkei.com", "itmedia.co.jp", "inc42.com", "yourstory.com", "etnews.com", "zdnet.co.kr",
  "thelec.net", "digitimes.com", "qualcomm.com", "mediatek.com", "arm.com", "investor.tsmc.com",
  "news.skhynix.com", "micron.com", "verizon.com", "att.com", "t-mobile.com", "news.sktelecom.com",
  "cls.cn", "huxiu.com", "geekpark.net", "ifanr.com", "sspai.com", "ijiwei.com", "oppo.com", "vivo.com",
  "ascii.jp", "entrackr.com", "the-ken.com", "techinasia.com", "kr-asia.com", "thenextweb.com",
  "handelsblatt.com", "lesechos.fr", "patentscope.wipo.int", "patents.google.com", "paperswithcode.com",
  "mlcommons.org", "lmarena.ai", "artificialanalysis.ai", "digital-strategy.ec.europa.eu", "support.google.com", "developer.apple.com",
  "counterpointresearch.com", "omdia.tech.informa.com", "canalys.com", "idc.com", "gartner.com",
  "fda.gov", "dtxalliance.org", "sensortower.com", "appfigures.com", "scam.ai", "businesswire.com",
  "stripe.com", "coinbase.com", "gsma.com", "visa.com", "mastercard.com", "news.samsung.com",
];
const MX_POLICY_DOMAINS = [
  ...(mxSourcePolicy.regionalPublishers || []).map(source => source.domain),
  ...(mxSourcePolicy.primarySources || []).map(source => source.domain),
  ...(mxSourcePolicy.supplyChain || []).map(source => source.domain),
];
const ALLOW = [...new Set([...BASE_ALLOW, ...(companySourcePolicy.publisherDomains || []), ...MX_POLICY_DOMAINS])];

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
  // 모바일 AI 신사업 전용 스트림: 사용자 과업·경험·수익화·파트너십
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
  { co: "", cat: "bigtech", tag: "통신사 AI 번들", topic: true, n: 3, q: '(SKT OR KT OR Verizon OR AT&T OR T-Mobile) (AI agent OR AI assistant OR Gemini OR Perplexity OR AI plan)' },
  { co: "", cat: "bigtech", tag: "모바일 공급망", topic: true, n: 3, q: '(Qualcomm OR MediaTek OR Arm OR TSMC OR Micron OR "SK hynix") (mobile NPU OR LPDDR OR UFS OR on-device AI)' },
  { co: "", cat: "native", tag: "에이전틱 커머스", topic: true, n: 3, q: '("agentic commerce" OR "AI shopping agent" OR "AI checkout" OR "agent commission" OR "Perplexity Shopping" OR "OpenAI Operator" OR UCP OR AP2)' },
  { co: "", cat: "bigtech", tag: "웨어러블·폼팩터", topic: true, n: 3, q: '("AI wearable" OR "smart glasses" OR "AI pin" OR foldable OR trifold OR rollable OR "Direct-to-Cell") (AI OR agent)' },
  { co: "", cat: "bigtech", tag: "에이전트·OS 통합", topic: true, n: 3, q: '("App Intents" OR AICore OR "Android AI" OR HyperOS OR Xiaoyi OR AndesGPT OR BlueLM OR MCP OR A2A) (mobile OR smartphone OR OS)' },
  { co: "", cat: "native", tag: "Series C·M&A", topic: true, n: 2, q: '("Series C" OR "Series D" OR acquisition OR M&A) (AI agent OR on-device AI OR AI startup)' },
  { co: "", cat: "bigtech", tag: "AI 앱 지표", topic: true, n: 2, q: '(ChatGPT OR Gemini OR Claude OR Character.ai OR Perplexity OR Poe) (downloads OR MAU OR DAU OR app ranking)' },
  { co: "", cat: "bigtech", tag: "AI UX 페인포인트", topic: true, n: 2, q: '(smartphone AI OR AI assistant OR AI wearable) (review OR complaint OR privacy OR failed OR not useful)' },
  { co: "", cat: "bigtech", tag: "온디바이스 신뢰·보안", topic: true, n: 3, q: '("on-device scam detection" OR "deepfake call detection" OR "voice clone detection" OR "financial fraud API" OR "Pixel Scam Detection" OR "Samsung Phone scam" OR "Halo deepfake")' },
  { co: "", cat: "bigtech", tag: "임상·보험형 헬스 AI", topic: true, n: 2, q: '("digital therapeutic" OR "clinical AI wearable" OR "mobile medical app" OR "payer reimbursement" OR "employer digital health") (AI OR app OR wearable)' },
  { co: "", cat: "native", tag: "AI 컴패니언 경제성", topic: true, n: 3, q: '("AI companion app" OR Character.AI OR Replika) (revenue OR engagement OR subscription OR safety OR market size)' },
];

const REGIONAL_TOPICS = [
  { co: "", cat: "bigtech", tag: "중화권 단말", topic: true, n: 3, locale: { hl: "zh-TW", gl: "TW", ceid: "TW:zh-Hant" }, q: '(Xiaomi OR HONOR OR OPPO OR vivo OR Huawei) (AI手機 OR AI phone OR 端側AI OR 大模型)' },
  { co: "", cat: "bigtech", tag: "일본 모바일 AI", topic: true, n: 2, locale: { hl: "ja", gl: "JP", ceid: "JP:ja" }, q: '(スマートフォン OR モバイル) (生成AI OR オンデバイスAI OR AIエージェント)' },
  { co: "", cat: "bigtech", tag: "인도 모바일 AI", topic: true, n: 2, locale: { hl: "en-IN", gl: "IN", ceid: "IN:en" }, q: '(smartphone OR telecom) (AI assistant OR on-device AI OR AI subscription)' },
  { co: "", cat: "bigtech", tag: "국내 모바일 AI", topic: true, n: 2, locale: { hl: "ko", gl: "KR", ceid: "KR:ko" }, q: '(스마트폰 OR 통신사 OR NPU) (AI 에이전트 OR 온디바이스 AI OR AI 요금제)' },
  { co: "", cat: "bigtech", tag: "중국 AI UX·폼팩터", topic: true, n: 2, locale: { hl: "zh-CN", gl: "CN", ceid: "CN:zh-Hans" }, q: '(折叠屏 OR 三折叠 OR AI眼镜 OR 端侧大模型) (体验 OR 评测 OR 用户)' },
  { co: "", cat: "native", tag: "인도 AI 앱·통신사", topic: true, n: 2, locale: { hl: "en-IN", gl: "IN", ceid: "IN:en" }, q: '(AI app OR AI agent OR telecom bundle OR on-device AI) (India OR Indian users)' },
];

// Primary-source discovery streams. Google News is used only as a discovery
// gateway; the existing publisher-domain gate keeps the resulting record
// bound to the official filing, patent, model, app-store or certification URL.
const PRIMARY_SOURCE_TOPICS = [
  { co: "", cat: "bigtech", tag: "특허 공시", topic: true, n: 2, q: '(site:data.uspto.gov OR site:kipris.or.kr OR site:cnipa.gov.cn) (smartphone OR mobile OR on-device AI OR NPU)' },
  { co: "", cat: "bigtech", tag: "기업 공시", topic: true, n: 2, q: '(site:sec.gov OR site:dart.fss.or.kr) (AI OR smartphone OR mobile) (10-K OR 10-Q OR 8-K OR 사업보고서)' },
  { co: "", cat: "native", tag: "모델·코드 공개", topic: true, n: 3, q: '(site:arxiv.org OR site:huggingface.co OR site:github.com) (mobile AI OR on-device model OR Android agent)' },
  { co: "", cat: "bigtech", tag: "앱 출시·랭킹", topic: true, n: 2, q: '(site:play.google.com OR site:apps.apple.com) (AI assistant OR AI agent OR generative AI)' },
  { co: "", cat: "bigtech", tag: "단말 인증", topic: true, n: 2, q: '(site:fcc.gov OR site:safetykorea.kr OR site:cnca.gov.cn) (smartphone OR handset OR mobile device)' },
  { co: "", cat: "native", tag: "벤치마크·표준", topic: true, n: 2, q: '(site:mlcommons.org OR site:lmarena.ai OR site:artificialanalysis.ai OR site:3gpp.org OR site:etsi.org) (mobile AI OR on-device OR agent)' },
  { co: "", cat: "bigtech", tag: "앱 정책 변경", topic: true, n: 2, q: '(site:developer.apple.com OR site:support.google.com) (App Store Review Guidelines OR Google Play policy) (AI OR subscription OR agent)' },
];

// ---- 직접 퍼블리셔 RSS 피드(구글뉴스 비경유 — 소스 다변화, 단일 게이트웨이 리스크 제거) ----
const DIRECT_FEEDS = [
  { source: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { source: "The Verge", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", atom: true },
  { source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/technology-lab" },
  { source: "VentureBeat", url: "https://venturebeat.com/category/ai/feed/", matchPattern: ".", maxAgeDays: 14 },
  { source: "MIT Tech Review", url: "https://www.technologyreview.com/feed/" },
  { source: "IEEE Spectrum", url: "https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss" },
  // ── 추가 직접 RSS(소스 다변화·복원력) ──
  { source: "The Decoder", url: "https://the-decoder.com/feed/" },
  { source: "ZDNet", url: "https://www.zdnet.com/topic/artificial-intelligence/rss.xml" },
  { source: "The Register", url: "https://www.theregister.com/headlines.atom", atom: true, maxAgeDays: 14 },
  { source: "Wired", url: "https://www.wired.com/feed/tag/ai/latest/rss" },
  { source: "Engadget", url: "https://www.engadget.com/rss.xml" },
  { source: "SiliconANGLE", url: "https://siliconangle.com/category/ai/feed/" },
  { source: "AI Business", url: "https://aibusiness.com/rss.xml" },
  ...(registryCollectionFresh ? [] : OFFICIAL_FEEDS.map(feed => ({ ...feed, official: true }))),
];
const AI_RE = /\bAI\b|artificial intelligence|\bLLM\b|GPT|Claude|Gemini|agentic|chatbot|machine learning|foundation model|on-device|smartphone|mobile assistant|mobile agent/i;

async function pullDirect(feed, limit = 2) {
  const streamName = `${feed.official ? "official-feed" : "rss"}:${feed.source}`;
  try {
    const xml = await fetchText(feed.url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
    sourceHealth.reachableStreams.push(streamName);
    const blockRe = feed.atom ? /<entry>([\s\S]*?)<\/entry>/g : /<item>([\s\S]*?)<\/item>/g;
    const out = []; let m;
    while ((m = blockRe.exec(xml)) && out.length < limit) {
      const it = m[1];
      const title = decode(tag(it, "title"));
      const match = feed.matchPattern ? new RegExp(feed.matchPattern, "i") : AI_RE;
      if (!title || !match.test(title)) continue;
      let link = decode(tag(it, "link"));
      if (feed.atom && (!link || !/^http/.test(link))) { const lm = it.match(/<link[^>]*href="([^"]+)"/i); link = lm ? decode(lm[1]) : ""; }
      if (!link) continue;
      const date = pubDateOf(tag(it, "pubDate") || tag(it, "published") || tag(it, "updated"));
      const maxAgeDays = Number(feed.maxAgeDays || (feed.official ? 14 : 7));
      if ((Date.now() - new Date(date + "T00:00:00Z").getTime()) / 86400000 > maxAgeDays) continue;
      const desc = cleanDesc(decode(tag(it, "description") || tag(it, "summary"))).slice(0, 240);
      out.push({
        date,
        co: feed.company || deviceCo(title),
        cat: feed.cat || "bigtech",
        source: feed.source,
        title,
        descEn: desc,
        url: link,
        tag: feed.category || "글로벌",
        evidenceTier: feed.sourceTier || (feed.official ? "official" : "reported"),
        sourceType: feed.official ? "official-feed" : "publisher-rss",
      });
    }
    if (!out.length) sourceHealth.quietStreams.push({ stream: streamName, reason: "reachable-no-recent-matching-items" });
    else sourceHealth.successfulStreams.push(streamName);
    console.log(`[news:${streamName}] ${out.length} item(s)`);
    return out;
  } catch (e) {
    sourceHealth.failedStreams.push({ stream: streamName, error: e.message });
    console.warn(`[news:${streamName}] ${e.message}`);
    return [];
  }
}

const sitemapBlocks = xml => [...String(xml || "").matchAll(/<url>([\s\S]*?)<\/url>/gi)].map(match => ({
  url: decode(tag(match[1], "loc")),
  lastmod: decode(tag(match[1], "lastmod")),
}));
const sitemapChildren = xml => [...String(xml || "").matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/gi)]
  .map(match => decode(tag(match[1], "loc"))).filter(Boolean);
const titleFromUrl = url => {
  try {
    const slug = new URL(url).pathname.split("/").filter(Boolean).at(-1) || "official update";
    return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, character => character.toUpperCase());
  } catch { return "Official update"; }
};

async function pullOfficialSitemap(stream, limit = 2) {
  const streamName = `official-sitemap:${stream.source}`;
  try {
    const rootXml = await fetchText(stream.url, { timeoutMs: 25000, headers: { "User-Agent": UA, Accept: "application/xml,text/xml" } });
    sourceHealth.reachableStreams.push(streamName);
    let rows = sitemapBlocks(rootXml);
    if (!rows.length) {
      const children = sitemapChildren(rootXml).slice(0, 4);
      const nested = await Promise.all(children.map(url => fetchText(url, { headers: { "User-Agent": UA, Accept: "application/xml,text/xml" } }).catch(() => "")));
      rows = nested.flatMap(sitemapBlocks);
    }
    const pattern = stream.pathPattern ? new RegExp(stream.pathPattern, "i") : /\/news\/|\/blog\/|\/research\//i;
    const cutoff = Date.now() - 14 * 86400000;
    const out = rows
      .filter(row => row.url && pattern.test(row.url))
      .filter(row => {
        const time = Date.parse(row.lastmod || "");
        return Number.isFinite(time) && time >= cutoff;
      })
      .sort((left, right) => Date.parse(right.lastmod) - Date.parse(left.lastmod))
      .slice(0, limit)
      .map(row => ({
        date: pubDateOf(row.lastmod), co: stream.company || stream.source, cat: "native", source: stream.source,
        title: titleFromUrl(row.url), descEn: "First-party newsroom or research update discovered from the official sitemap.",
        url: row.url, tag: "공식 발표", evidenceTier: "official", sourceType: "official-sitemap",
      }));
    if (!out.length) sourceHealth.quietStreams.push({ stream: streamName, reason: "reachable-no-recent-matching-items" });
    else sourceHealth.successfulStreams.push(streamName);
    console.log(`[news:${streamName}] ${out.length} item(s)`);
    return out;
  } catch (error) {
    sourceHealth.failedStreams.push({ stream: streamName, error: error.message });
    console.warn(`[news:${streamName}] ${error.message}`);
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
  [/xiaomi|redmi|hyperai|샤오미|小米/i, "Xiaomi"],
  [/\bhonor\b|magic7|아너|荣耀/i, "HONOR"],
  [/\boppo\b|coloros|오포/i, "OPPO"],
  [/\bvivo\b|funtouch|비보/i, "vivo"],
  [/huawei|harmonyos|xiaoyi|화웨이|华为|小艺/i, "Huawei"],
  [/verizon|버라이즌/i, "Verizon"],
  [/\bat&t\b|\batt\b/i, "AT&T"],
  [/t-mobile|티모바일/i, "T-Mobile"],
  [/sk telecom|\bskt\b|에이닷|a\.dot/i, "SK Telecom"],
  [/qualcomm|snapdragon|퀄컴/i, "Qualcomm"],
  [/mediatek|dimensity|미디어텍/i, "MediaTek"],
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

async function fetchRss(query, locale = { hl: "en-US", gl: "US", ceid: "US:en" }) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:14d")}&hl=${locale.hl}&gl=${locale.gl}&ceid=${locale.ceid}`;
  return fetchText(url, { headers: { "User-Agent": UA } });
}

// pull authoritative English items for one query
async function pull(src, limit) {
  const streamName = `google-news:${src.tag || src.co || "topic"}`;
  try {
    const xml = await fetchRss(src.q, src.locale);
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
    if (!out.length) sourceHealth.emptyStreams.push(streamName);
    else sourceHealth.successfulStreams.push(streamName);
    console.log(`[news:${stream}] ${out.length} authoritative item(s)`);
    return out;
  } catch (e) {
    sourceHealth.failedStreams.push({ stream: streamName, error: e.message });
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
  const criticalGoogleNewsStreams = new Set(activeCompanies.map(company => `google-news:${company.co}`));
  const companyItems = (await pool(activeCompanies, 8, c => pull(c, 1))).flat();
  const topicItems = (await Promise.all(TOPICS.map(t => pull(t, t.n)))).flat();
  const priorityItems = (await Promise.all(PRIORITY_STREAMS.map(stream => pull(stream, stream.n || 1)))).flat();
  const regionalItems = (await Promise.all(REGIONAL_TOPICS.map(stream => pull(stream, stream.n || 1)))).flat();
  const primaryItems = (await Promise.all(PRIMARY_SOURCE_TOPICS.map(stream => pull(stream, stream.n || 1)))).flat();
  const directItems = (await Promise.all(DIRECT_FEEDS.map(f => pullDirect(f, f.official ? 3 : 2)))).flat();
  const officialItems = registryCollectionFresh ? [] : (await Promise.all(OFFICIAL_SITEMAPS.map(stream => pullOfficialSitemap(stream, 2)))).flat();
  const registryItems = registryCollectionFresh ? REGISTRY_ARTICLES : [];

  // Treat a direct first-party feed or sitemap as a deterministic recovery
  // when a company-specific Google News query is empty. Persist each stream's
  // empty streak so a watchdog can distinguish one quiet day from a broken
  // collector without relying on model inference.
  const priorCollectionHealth = await readFile("collection-health.json", "utf8")
    .then(JSON.parse)
    .catch(() => ({ streamHealth: [] }));
  const priorStreamHealth = new Map((priorCollectionHealth.streamHealth || []).map(row => [row.stream, row]));
  const fallbackRecoveries = sourceHealth.emptyStreams
    .filter(stream => stream.startsWith("google-news:"))
    .map(stream => {
      const company = stream.slice("google-news:".length);
      const matchingRegistryIds = new Set(REGISTRY_SOURCE_DEFINITIONS.filter(source => registrySourceMatches(source, company)).map(source => source.registryId));
      const fallback = registryItems.find(item => normalizedEntity(item.co) === normalizedEntity(company) || matchingRegistryIds.has(item.sourceId))
        || officialItems.find(item => normalizedEntity(item.co) === normalizedEntity(company))
        || directItems.find(item => normalizedEntity(item.co) === normalizedEntity(company) && item.evidenceTier === "official");
      if (fallback) return { stream, via: fallback.sourceType || "official-source", source: fallback.source, recoveredItems: 1, coverageStatus: "recent-item-recovered" };
      const sitemapProbe = OFFICIAL_SITEMAPS.find(item => registrySourceMatches(item, company));
      const feedProbe = OFFICIAL_FEEDS.find(item => registrySourceMatches(item, company));
      const htmlProbe = OFFICIAL_HTML_INDEXES.find(item => registrySourceMatches(item, company));
      const probeStream = sitemapProbe ? `official-sitemap:${sitemapProbe.source}`
        : feedProbe ? `official-feed:${feedProbe.source}`
          : htmlProbe ? `official-html:${htmlProbe.source}` : "";
      const registryProbe = (sourceRegistryReport.streamHealth || []).find(item => item.stream === probeStream);
      if (probeStream && (sourceHealth.reachableStreams.includes(probeStream) || ["healthy", "reachable-quiet"].includes(registryProbe?.state))) {
        return { stream, via: sitemapProbe ? "official-sitemap" : feedProbe ? "official-feed" : "official-html", source: (sitemapProbe || feedProbe || htmlProbe).source, recoveredItems: 0, coverageStatus: "official-source-reachable-no-recent-items" };
      }
      return null;
    })
    .filter(Boolean);
  const recoveredKeys = new Set(fallbackRecoveries.map(row => row.stream));
  const unresolvedEmptyStreams = [...new Set(sourceHealth.emptyStreams.filter(stream => !recoveredKeys.has(stream)))];
  const registryHealthRows = registryCollectionFresh ? (sourceRegistryReport.streamHealth || []) : [];
  const registryFailedStreams = registryHealthRows.filter(row => row.state === "failed").map(row => ({ stream: row.stream, error: row.error || "registry collector failed" }));
  const failedStreams = [...sourceHealth.failedStreams, ...registryFailedStreams]
    .filter((row, index, rows) => rows.findIndex(candidate => candidate.stream === row.stream) === index);
  const failedByStream = new Map(failedStreams.map(row => [row.stream, row]));
  const quietByStream = new Map(sourceHealth.quietStreams.map(row => [row.stream, row]));
  const attemptedStreams = new Set([
    ...registryHealthRows.map(row => row.stream),
    ...sourceHealth.successfulStreams,
    ...unresolvedEmptyStreams,
    ...failedByStream.keys(),
    ...quietByStream.keys(),
    ...fallbackRecoveries.map(row => row.stream),
  ]);
  const checkedAt = new Date().toISOString();
  const registryHealthByStream = new Map(registryHealthRows.map(row => [row.stream, row]));
  const streamHealth = [...attemptedStreams].sort().map(stream => {
    const registryHealth = registryHealthByStream.get(stream);
    if (registryHealth) return { ...registryHealth, registryCollector: true };
    const prior = priorStreamHealth.get(stream) || {};
    const recovery = fallbackRecoveries.find(row => row.stream === stream);
    const failed = failedByStream.get(stream);
    const empty = unresolvedEmptyStreams.includes(stream);
    const quiet = quietByStream.get(stream);
    const state = recovery ? "recovered-by-official-fallback" : failed ? "failed" : empty ? "empty" : quiet ? "reachable-quiet" : "healthy";
    const criticality = stream.startsWith("google-news:") && !criticalGoogleNewsStreams.has(stream) ? "optional-topic" : "critical";
    const consecutiveEmptyRuns = state === "empty" ? Number(prior.consecutiveEmptyRuns || 0) + 1 : 0;
    const consecutiveFailureRuns = state === "failed" ? Number(prior.consecutiveFailureRuns || 0) + 1 : 0;
    return {
      stream,
      state,
      lastAttemptAt: checkedAt,
      lastSuccessAt: ["healthy", "recovered-by-official-fallback"].includes(state) ? checkedAt : prior.lastSuccessAt || null,
      emptySince: state === "empty" ? prior.emptySince || checkedAt : null,
      failureSince: state === "failed" ? prior.failureSince || checkedAt : null,
      consecutiveEmptyRuns,
      consecutiveFailureRuns,
      criticality,
      ...(recovery ? { fallback: recovery } : {}),
      ...(quiet ? { reason: quiet.reason } : {}),
      ...(failed ? { error: failed.error } : {}),
    };
  });
  const healthPolicy = officialSourceRegistry.healthPolicy || {};
  const emptyRunLimit = Number(healthPolicy.watchdogAfterConsecutiveEmptyRuns || 3);
  const emptyDayLimit = Number(healthPolicy.watchdogAfterEmptyDays || 3);
  const failureRunLimit = Number(healthPolicy.watchdogAfterConsecutiveFailureRuns || emptyRunLimit);
  const failureDayLimit = Number(healthPolicy.watchdogAfterFailureDays || emptyDayLimit);
  const watchdogBreaches = streamHealth.filter(row => row.criticality !== "optional-topic" && (row.state === "empty" && (
    row.consecutiveEmptyRuns >= emptyRunLimit
    || (Date.now() - Date.parse(row.emptySince || checkedAt)) / 86_400_000 >= emptyDayLimit
  ) || row.state === "failed" && (
    Number(row.consecutiveFailureRuns || 0) >= failureRunLimit
    || (Date.now() - Date.parse(row.failureSince || checkedAt)) / 86_400_000 >= failureDayLimit
  )));
  const fallbackConnectorStatus = OFFICIAL_API_CONNECTORS.map(connector => {
    const missingEnv = (connector.requiredEnv || []).filter(name => !process.env[name]);
    return {
      id: connector.id,
      source: connector.source,
      category: connector.category,
      sourceTier: connector.sourceTier,
      schedule: connector.schedule,
      status: missingEnv.length ? "credential-gated" : "configured-ready",
      missingEnv,
    };
  });
  const connectorStatus = registryCollectionFresh && (sourceRegistryReport.connectorStatus || []).length
    ? sourceRegistryReport.connectorStatus
    : fallbackConnectorStatus;

  // 삭제 블록리스트(비밀번호 삭제) — 해당 URL은 다시 크롤하지 않음
  // de-dupe this run by URL
  const seen = new Set();
  const raw = [...companyItems, ...topicItems, ...priorityItems, ...regionalItems, ...primaryItems, ...registryItems, ...directItems, ...officialItems]
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
      evidenceTier: a.evidenceTier || "reported",
      sourceType: a.sourceType || "publisher-discovery",
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
    .filter(a => a.sourceType !== "official-sitemap" || !isPlaceholderRegistryEntry(a))
    .filter(a => a.sourceType !== "official-sitemap" || !UNDATED_REGISTRY_URLS.has(a.url || a.rssUrl))
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
    generatedAt: checkedAt,
    mode: "source-content-extractive",
    policyVersion: newsPolicy.version,
    streams: {
      googleNews: COMPANIES.length + TOPICS.length + PRIORITY_STREAMS.length + REGIONAL_TOPICS.length + PRIMARY_SOURCE_TOPICS.length,
      regional: REGIONAL_TOPICS.length,
      primarySource: PRIMARY_SOURCE_TOPICS.length,
      directRss: DIRECT_FEEDS.length,
      officialFeeds: OFFICIAL_FEEDS.length,
      officialSitemaps: OFFICIAL_SITEMAPS.length,
      officialApiConnectors: OFFICIAL_API_CONNECTORS.length,
      registrySnapshotArticles: registryItems.length,
    },
    acceptedCandidates: raw.length,
    failedStreams,
    emptyStreams: unresolvedEmptyStreams,
    recoveredStreams: fallbackRecoveries,
    quietStreams: sourceHealth.quietStreams,
    streamHealth,
    connectorStatus,
    registryCollector: registryCollectionFresh ? {
      generatedAt: sourceRegistryReport.generatedAt,
      status: sourceRegistryReport.status,
      summary: sourceRegistryReport.summary,
      categoryCoverage: sourceRegistryReport.categoryCoverage,
      ledger: sourceRegistryReport.ledger,
    } : { status: "stale-or-unavailable", generatedAt: sourceRegistryReport.generatedAt || null },
    watchdogPolicy: { emptyRunLimit, emptyDayLimit, failureRunLimit, failureDayLimit },
    watchdogBreaches,
    status: failedStreams.length || watchdogBreaches.length ? "partial" : "ok",
  };
  await writeFile("collection-health.json", JSON.stringify(crawlHealth, null, 2) + "\n");

  if (!raw.length) {
    throw new Error("No new candidates were collected from any news source; keeping the previous bundle unchanged.");
  }
  const out = final;
  const publicArticles = sanitizePublicCopy(out);
  await writeFile("news.json", JSON.stringify({ generatedAt: new Date().toISOString(), count: publicArticles.length, articles: publicArticles }, null, 2) + "\n");
  console.log(`Wrote news.json with ${out.length} articles (${sums.filter(isContentBacked).length} new source-page briefings; registry articles: ${registryItems.length}; failed streams: ${failedStreams.length}).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
