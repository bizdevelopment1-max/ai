#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { isExcludedText } from "./news-policy.mjs";
import { loadDash } from "./load-dash.mjs";
import { sanitizePublicCopy } from "./public-copy.mjs";
import { loadSuppressionRegistry } from "./suppression-registry.mjs";

const TODAY = new Date().toISOString().slice(0, 10);
const volatileMetricConfig = JSON.parse(await readFile("config/volatile-metrics.json", "utf8"));

const COMPANY_ALIASES = [
  { name: "Microsoft", layer: "infra", vertical: "하이퍼스케일 클라우드", alias: ["Microsoft", "Azure", "Copilot"] },
  { name: "Amazon", layer: "infra", vertical: "하이퍼스케일 클라우드", alias: ["Amazon", "AWS", "Bedrock"] },
  { name: "NVIDIA", layer: "infra", vertical: "AI 가속기·칩", alias: ["NVIDIA", "Nvidia"] },
  { name: "OpenAI", layer: "model", vertical: "프런티어 모델", alias: ["OpenAI", "ChatGPT", "GPT-4", "GPT-5", "Sora"] },
  { name: "Anthropic", layer: "model", vertical: "프런티어 모델", alias: ["Anthropic", "Claude"] },
  { name: "Google DeepMind", layer: "model", vertical: "프런티어 모델", alias: ["Google DeepMind", "DeepMind", "Gemini"] },
  { name: "Meta AI", layer: "model", vertical: "오픈 모델", alias: ["Meta AI", "Llama"] },
  { name: "DeepSeek", layer: "model", vertical: "오픈·저비용 모델", alias: ["DeepSeek"] },
  { name: "Mistral AI", layer: "model", vertical: "오픈·소버린 모델", alias: ["Mistral"] },
  { name: "Cohere", layer: "model", vertical: "엔터프라이즈 모델", alias: ["Cohere"] },
  { name: "SpaceX (xAI, Cursor)", layer: "model", vertical: "프런티어 모델", alias: ["xAI", "Grok"] },
  { name: "Databricks", layer: "data", vertical: "데이터 레이크하우스", alias: ["Databricks"] },
  { name: "Scale AI", layer: "data", vertical: "데이터 라벨링·평가", alias: ["Scale AI"] },
  { name: "Hugging Face", layer: "data", vertical: "모델 허브·오픈소스", alias: ["Hugging Face", "HuggingFace"] },
  { name: "Together AI", layer: "data", vertical: "추론·학습 클라우드", alias: ["Together AI"] },
  { name: "Apple", layer: "app", vertical: "온디바이스·생태계", alias: ["Apple Intelligence", "Apple", "Siri"] },
  { name: "Perplexity", layer: "app", vertical: "검색·어시스턴트", alias: ["Perplexity"] },
  { name: "Glean", layer: "app", vertical: "엔터프라이즈 검색", alias: ["Glean"] },
  { name: "Sierra AI", layer: "app", vertical: "고객경험 에이전트", alias: ["Sierra AI"] },
  { name: "Writer", layer: "app", vertical: "엔터프라이즈 생산성", alias: ["Writer.com", "Writer AI"] },
  { name: "Harvey", layer: "app", vertical: "법률", alias: ["Harvey AI", "Harvey"] },
  { name: "Abridge", layer: "app", vertical: "의료", alias: ["Abridge"] },
  { name: "Cursor", layer: "app", vertical: "코딩", alias: ["Cursor"] },
  { name: "Replit", layer: "app", vertical: "코딩", alias: ["Replit"] },
  { name: "Lovable", layer: "app", vertical: "코딩", alias: ["Lovable"] },
  { name: "Midjourney", layer: "app", vertical: "크리에이티브·이미지", alias: ["Midjourney"] },
  { name: "Stability AI", layer: "app", vertical: "크리에이티브·이미지", alias: ["Stability AI"] },
  { name: "Runway", layer: "app", vertical: "크리에이티브·영상", alias: ["Runway ML", "RunwayML", "Runway"] },
  { name: "Kling AI", layer: "app", vertical: "크리에이티브·영상", alias: ["Kling"] },
  { name: "Hailuo (MiniMax)", layer: "app", vertical: "크리에이티브·영상", alias: ["Hailuo", "MiniMax"] },
  { name: "Synthesia", layer: "app", vertical: "크리에이티브·영상", alias: ["Synthesia"] },
  { name: "Suno", layer: "app", vertical: "크리에이티브·음악", alias: ["Suno"] },
  { name: "ElevenLabs", layer: "app", vertical: "크리에이티브·음성", alias: ["ElevenLabs", "Eleven Labs"] },
];

const DASH_LAYER = loadDash().COMPANY_LAYER || {};
const COMPANIES = COMPANY_ALIASES.map(company => ({
  ...company,
  layer: DASH_LAYER[company.name]?.layer || company.layer,
  vertical: DASH_LAYER[company.name]?.vertical || company.vertical,
}));

const bound = value => {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `${/^[A-Za-z0-9]/.test(value) ? "\\b" : ""}${escaped}${/[A-Za-z0-9]$/.test(value) ? "\\b" : ""}`;
};
const withRegex = rows => rows.map(row => ({ ...row, re: new RegExp(`(?:${row.alias.map(bound).join("|")})`, "i") }));

const MODELS = [
  { id: "vertical", ko: "수직통합·자체 서비스", accent: "#66558C", re: /subsidiary|spin[-\s]?(?:off|out)|vertical integrat|first-party|자회사|수직통합|자체 서비스/i },
  { id: "subscription", ko: "구독·좌석", accent: "#397A68", re: /subscription|per[-\s]?seat|premium tier|pro plan|paywall|membership|구독|좌석|유료 전환/i },
  { id: "usage", ko: "사용량·API·토큰", accent: "#3E648D", re: /\bAPI\b|per[-\s]?token|usage[-\s]?based|pay[-\s]?as[-\s]?you[-\s]?go|credit|inference|metered|사용량|토큰|호출량/i },
  { id: "ads", ko: "광고·커머스·수수료", accent: "#A56A35", re: /advertis|\bads\b|commerce|commission|affiliate|marketplace|take rate|광고|커머스|수수료|중개/i },
  { id: "hardware", ko: "하드웨어·단말·번들", accent: "#6E607D", re: /device|hardware|bundle|phone|wearable|glasses|단말|기기|하드웨어|번들/i },
  { id: "outcome", ko: "성과 기반", accent: "#8B5366", re: /per[-\s]?resolution|success fee|outcome[-\s]?based|performance[-\s]?based|per[-\s]?outcome|성과 기반|건당 해결/i },
  { id: "enterprise", ko: "기업용·라이선스", accent: "#287A78", re: /enterprise|licen[sc]e|on[-\s]?prem|sovereign|\bTCV\b|\bACV\b|기업 계약|라이선스|연간 계약/i },
];

const DIRECTIONS = [
  { id: "ma", ko: "인수·합병", accent: "#6E607D", re: /acqui|merger|\bM&A\b|takeover|인수|합병/i },
  { id: "invest", ko: "투자·자금", accent: "#397A68", re: /invest|stake|funding|\bround\b|valuation|\bIPO\b|투자|지분|조달|상장/i },
  { id: "expand", ko: "확장·신제품", accent: "#3E648D", re: /launch|unveil|roll ?out|expand|capacity|entry|출시|공개|신제품|진출|확장/i },
  { id: "partner", ko: "제휴·파트너십", accent: "#A56A35", re: /partner|collaborat|joint venture|제휴|협력|합작/i },
];

const toLines = value => String(value || "").split("\n").map(line => line.replace(/^[•\-*\s]+/, "").trim()).filter(Boolean);
const canonUrl = value => {
  const source = String(value || "");
  try { const url = new URL(source); url.hash = ""; url.search = ""; return url.href.replace(/\/+$/, ""); }
  catch { return source.replace(/[?#].*$/, "").replace(/\/+$/, ""); }
};
const classify = (groups, text) => groups.find(group => group.re.test(text)) || null;
const snippet = (text, pattern) => String(text || "").match(pattern)?.[0]?.trim() || "";

const BUYER_PATTERNS = [
  /enterprise customers?|business customers?|companies|organizations|developers?|consumers?|subscribers?|users?|carriers?|retailers?|advertisers?|banks?|insurers?|governments?/i,
  /기업 고객|기업|개발자|소비자|구독자|사용자|통신사|유통사|광고주|은행|보험사|정부/i,
];
const OFFERING_PATTERN = /[A-Za-z0-9][A-Za-z0-9+.-]*(?:\s+[A-Za-z0-9][A-Za-z0-9+.-]*){0,4}\s+(?:platform|service|software|product|app|assistant|agent|model|API|device|subscription|plan|suite)|(?:플랫폼|서비스|소프트웨어|제품|앱|어시스턴트|에이전트|모델|API|단말|구독|요금제|솔루션)/i;
const BILLING_PATTERN = /per (?:month|year|user|seat|token|call|request|transaction|device|resolution)|monthly|annual(?:ly)?|usage[- ]based|subscription|commission|license fee|take rate|월(?:간)?|연(?:간)?|사용자당|좌석당|토큰당|호출당|거래당|단말당|건당|사용량 기반|구독|수수료|라이선스/i;
const PRICE_REVENUE_PATTERN = /(?:\$|€|£|₩|USD|EUR|GBP|KRW)\s?[0-9][0-9,.]*(?:\s?(?:million|billion|trillion|m|bn))?|[0-9][0-9,.]*\s?(?:달러|원|억원|조원|million|billion)\s*(?:revenue|sales|price|fee|ARR|매출|가격|요금|수수료)?|revenue from|sales from|subscription revenue|license revenue|commission revenue|매출원|구독 매출|라이선스 매출|수수료 매출/i;
const RECURRING_PATTERN = /subscription|monthly|annual|recurring|renewal|usage[- ]based|per[- ](?:user|seat|token|call|request|transaction|device|resolution)|license|commission|구독|월간|연간|반복 매출|갱신|사용량 기반|사용자당|좌석당|토큰당|호출당|거래당|라이선스|수수료/i;
const ONE_TIME_PATTERN = /one[- ]time|device sale|hardware sale|upfront purchase|일회성|기기 판매|단말 판매/i;

const commercialGate = ({ company, text }) => {
  const buyer = BUYER_PATTERNS.map(pattern => snippet(text, pattern)).find(Boolean) || "";
  const offering = snippet(text, OFFERING_PATTERN);
  const billingUnit = snippet(text, BILLING_PATTERN);
  const priceOrRevenue = snippet(text, PRICE_REVENUE_PATTERN);
  const recurring = RECURRING_PATTERN.test(text) ? "yes" : ONE_TIME_PATTERN.test(text) ? "no" : "";
  const fields = { seller: company.name, buyer, offering, billingUnit, priceOrRevenue, recurringRevenue: recurring };
  const missing = Object.entries(fields).filter(([, value]) => !value).map(([key]) => key);
  return { status: missing.length ? "review-pending" : "passed", fields, missing };
};

const directionGate = ({ company, line }) => {
  const sellerMentioned = company.re.test(line);
  return {
    status: sellerMentioned ? "passed" : "review-pending",
    fields: { entity: sellerMentioned ? company.name : "", actionStatement: line },
    missing: sellerMentioned ? [] : ["entityMentionInEvidenceLine"],
  };
};

async function main() {
  const suppression = await loadSuppressionRegistry();
  let news = [];
  try {
    news = (JSON.parse(await readFile("news.json", "utf8")).articles || []).filter(article => !suppression.matches(article, "article"));
  } catch {
    console.log("[monetization] news.json이 없어 공개 후보를 만들지 않았습니다.");
  }

  let startupNames = [];
  try {
    const startups = JSON.parse(await readFile("startups.json", "utf8"));
    startupNames = [...(startups.large || []), ...(startups.small || [])].filter(item => !suppression.hasCompany(item.name));
  } catch {}
  const knownNames = new Set(COMPANIES.map(company => company.name));
  const startupEntries = startupNames.filter(item => item.name && !knownNames.has(item.name)).map(item => ({
    name: item.name,
    layer: DASH_LAYER[item.name]?.layer || "app",
    vertical: DASH_LAYER[item.name]?.vertical || item.vertical || "스타트업",
    alias: [item.name],
  }));
  const allCompanies = withRegex([...COMPANIES, ...startupEntries].filter(company => !suppression.hasCompany(company.name)));
  const buckets = new Map();
  const getBucket = name => {
    if (!buckets.has(name)) buckets.set(name, { monetize: new Map(), direction: new Map() });
    return buckets.get(name);
  };
  const reviewQueue = [];
  let candidatesScanned = 0;

  for (const article of news) {
    if (article.displayEligible === false || article.summaryMode !== "source-content-extractive") continue;
    const fullText = `${article.title || ""}\n${article.summary || ""}`;
    if (isExcludedText(fullText) || !article.url) continue;
    const lines = [article.title || "", ...toLines(article.summary)].filter(line => line && !isExcludedText(line));
    if (!lines.length) continue;
    for (const company of allCompanies) {
      const assigned = article.co ? article.co === company.name : company.re.test(article.title || "");
      if (!assigned) continue;
      const bucket = getBucket(company.name);
      const key = canonUrl(article.url);
      const meta = { source: article.source || "", date: article.date || TODAY, url: article.url };
      for (const line of lines) {
        const model = classify(MODELS, line);
        if (model) {
          candidatesScanned += 1;
          const gate = commercialGate({ company, text: fullText });
          const row = { signal: line.replace(/[.。]+$/, "").trim(), model: model.id, classificationGate: gate, ...meta };
          if (gate.status === "passed") bucket.monetize.set(`${key}:${model.id}`, row);
          else reviewQueue.push({ type: "monetization", company: company.name, candidateModel: model.id, ...row, reasons: gate.missing.map(field => `missing:${field}`) });
        }
        const direction = classify(DIRECTIONS, line);
        if (direction) {
          const gate = directionGate({ company, line });
          const row = { signal: line.replace(/[.。]+$/, "").trim(), kind: direction.id, classificationGate: gate, ...meta };
          if (gate.status === "passed") bucket.direction.set(`${key}:${direction.id}`, row);
          else reviewQueue.push({ type: "direction", company: company.name, candidateKind: direction.id, ...row, reasons: gate.missing.map(field => `missing:${field}`) });
        }
      }
    }
  }

  const recentByType = (map, field, limit) => [...map.values()]
    .filter(row => !isExcludedText(JSON.stringify(row)))
    .sort((left, right) => String(right.date).localeCompare(String(left.date)))
    .filter((row, index, rows) => rows.findIndex(candidate => candidate[field] === row[field]) === index)
    .slice(0, limit);

  const companies = allCompanies.map(company => {
    const bucket = buckets.get(company.name) || { monetize: new Map(), direction: new Map() };
    const monetize = recentByType(bucket.monetize, "model", 3);
    const direction = recentByType(bucket.direction, "kind", 3);
    const counts = {};
    for (const row of bucket.monetize.values()) counts[row.model] = (counts[row.model] || 0) + 1;
    const modelMix = Object.entries(counts).sort((left, right) => right[1] - left[1]).map(([id, n]) => ({ id, n }));
    const volatileMetrics = (volatileMetricConfig.metrics || []).filter(metric => metric.entity === company.name).map(metric => ({
      id: metric.id,
      kind: metric.kind,
      label: metric.label,
      values: metric.values,
      marketVariants: metric.marketVariants || [],
      announcedAt: metric.announcedAt,
      metricObservedAt: metric.metricObservedAt,
      observedWindow: metric.observedWindow,
      lastVerifiedAt: metric.lastVerifiedAt,
      region: metric.region,
      currency: metric.currency,
      priceType: metric.priceType,
      sources: metric.sources,
    }));
    return {
      name: company.name,
      layer: company.layer,
      vertical: company.vertical,
      primaryModel: modelMix[0]?.id || null,
      modelMix,
      monetize,
      direction,
      volatileMetrics,
    };
  }).filter(company => company.monetize.length || company.direction.length || company.volatileMetrics.length);

  const generatedAt = new Date().toISOString();
  const output = sanitizePublicCopy({
    generatedAt,
    schemaVersion: 3,
    database: {
      mode: "latest-verified-snapshot",
      replacementPolicy: "company + signal type + newest source date",
      publicRetention: "current-only",
    },
    classificationPolicy: {
      monetizationRequiredFields: ["seller", "buyer", "offering", "billingUnit", "priceOrRevenue", "recurringRevenue"],
      directionRequiresEntityInEvidenceLine: true,
      lowConfidenceDestination: "monetization-review-queue.json",
    },
    quality: {
      candidatesScanned,
      publishedMonetizationRows: companies.reduce((sum, company) => sum + company.monetize.length, 0),
      publishedDirectionRows: companies.reduce((sum, company) => sum + company.direction.length, 0),
      reviewPending: reviewQueue.length,
    },
    count: companies.length,
    models: MODELS.map(({ re, ...model }) => model),
    directions: DIRECTIONS.map(({ re, ...direction }) => direction),
    metricGovernance: "config/metric-governance.json",
    volatileMetricPolicy: { source: "config/volatile-metrics.json", reverify: "weekly", history: "metric-history.json" },
    companies,
  });
  const reviewOutput = sanitizePublicCopy({
    generatedAt,
    schemaVersion: 1,
    policy: "상업 필드 6개 또는 행위 주체가 모두 확인되지 않으면 공개하지 않고 검토 대기열로 이동합니다.",
    total: reviewQueue.length,
    rows: reviewQueue.sort((left, right) => String(right.date).localeCompare(String(left.date))),
  });
  await Promise.all([
    writeFile("monetization.json", `${JSON.stringify(output)}\n`),
    writeFile("monetization-review-queue.json", `${JSON.stringify(reviewOutput, null, 2)}\n`),
  ]);
  console.log(`[monetization] public ${output.quality.publishedMonetizationRows} · direction ${output.quality.publishedDirectionRows} · review ${reviewOutput.total}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
