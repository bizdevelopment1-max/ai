#!/usr/bin/env node
/**
 * NVIDIA 자본·전략 생태계 공개 뷰.
 *
 * - NVentures가 공개하는 공식 포트폴리오 JSON을 매 실행마다 직접 동기화한다.
 * - 기업 공식 발표로 확인되는 전략투자·라이선스는 별도 데이터 계약으로 합친다.
 * - 산업 분류를 6개 MECE 밸류체인으로 결정론적으로 정규화한다.
 * - daily-news 원장에서는 회사명과 투자 행위가 함께 확인된 최신 근거만 결합한다.
 * - 공식 목록 수집이 실패하면 직전 공개 스냅샷을 보존해 빈 화면을 만들지 않는다.
 */
import { readFile, writeFile } from "node:fs/promises";
import { loadSuppressionRegistry } from "./suppression-registry.mjs";

const CONFIG_FILE = "config/nvidia-investment-taxonomy.json";
const OUTPUT_FILE = "nvidia-investments.json";
const config = JSON.parse(await readFile(CONFIG_FILE, "utf8"));
const valueChains = config.valueChains || [];
const chainMap = new Map(valueChains.map(chain => [chain.id, chain]));

const clean = value => String(value || "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, " ").trim();
const slugify = value => clean(value).replace(/\s+/g, "-") || "company";
const escapeRe = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentions = (text, alias) => new RegExp(`(^|[^a-z0-9])${escapeRe(clean(alias))}([^a-z0-9]|$)`, "i").test(text);
const investmentTerms = /invest|investment|funding|financing|round|stake|equity|license|licensing|strategic partnership|투자|지분|라운드|라이선스/i;
const sourceBacked = article => article?.displayEligible !== false
  && article?.summaryMode === "source-content-extractive"
  && article?.provenance?.status === "source-backed"
  && /^https?:\/\//.test(article?.url || "");
const isoDate = value => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.valueOf()) ? parsed.toISOString().slice(0, 10) : "";
};
const domainFromUrl = value => {
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return "nvidia.com"; }
};
const layerForIndustry = industry => {
  const normalized = clean(industry);
  return valueChains.find(chain => (chain.matchIndustries || []).some(item => normalized === clean(item)))?.id
    || "applications";
};

let previous = null;
try { previous = JSON.parse(await readFile(OUTPUT_FILE, "utf8")); } catch {}

async function fetchOfficialPortfolio() {
  const response = await fetch(config.officialPortfolio.dataUrl, {
    headers: { "user-agent": "ai-intelligence-dashboard/1.0 (+https://bizdevelopment1-max.github.io/ai/)" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`official portfolio HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length < 20) throw new Error("official portfolio payload is incomplete");
  const asOf = isoDate(response.headers.get("last-modified")) || new Date().toISOString().slice(0, 10);
  return {
    status: "live",
    asOf,
    items: rows.map(row => {
      const layer = layerForIndustry(row.industry);
      const chain = chainMap.get(layer) || {};
      return {
        id: `nventures-${slugify(row.companyName)}`,
        name: row.companyName,
        shortName: row.companyName,
        aliases: [row.companyName],
        layer,
        domain: domainFromUrl(row.websiteUrl),
        websiteUrl: row.websiteUrl,
        logoUrl: row.logoUrl?.startsWith("/") ? `https://www.nvidia.com${row.logoUrl}` : row.logoUrl,
        relationType: "NVentures 포트폴리오",
        transaction: `${row.industry} · 공식 포트폴리오 등재`,
        officialIndustry: row.industry,
        why: `NVentures 공식 포트폴리오가 ${row.companyName}을(를) ${row.industry} 분야 투자사로 공개합니다.`,
        strategicFit: chain.strategicLogic || "NVIDIA 가속 컴퓨팅 생태계의 적용 산업과 반복 워크로드를 확대합니다.",
        origin: "nventures",
        source: {
          label: config.officialPortfolio.label,
          url: config.officialPortfolio.pageUrl,
          date: asOf,
          type: "공식 포트폴리오",
        },
      };
    }),
  };
}

let official;
try {
  official = await fetchOfficialPortfolio();
} catch (error) {
  const fallback = (previous?.portfolio || []).filter(item => item.origin === "nventures");
  official = {
    status: fallback.length ? "cached" : "unavailable",
    asOf: previous?.officialCatalog?.asOf || "",
    items: fallback,
    error: error.message,
  };
}

let articles = [];
const suppression = await loadSuppressionRegistry();
try {
  const news = JSON.parse(await readFile("news.json", "utf8"));
  articles = (news.articles || []).filter(sourceBacked).filter(article => !suppression.matches(article, "article"));
} catch {}

const findLatestEvidence = company => articles
  .filter(article => {
    const text = clean([article.co, article.title, article.titleKo, article.summary].join(" "));
    return /\bnvidia\b/i.test(text)
      && (company.aliases || [company.name]).some(alias => mentions(text, alias))
      && investmentTerms.test(text);
  })
  .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];

const strategic = (config.strategicRecords || []).map(item => ({ ...item, origin: "strategic" }));
const merged = new Map();
for (const item of [...official.items, ...strategic]) {
  const key = clean(item.name);
  if (!key || suppression.hasCompany(item.name)) continue;
  merged.set(key, item);
}

const layerOrder = new Map(valueChains.map((chain, index) => [chain.id, index]));
const relationRank = value => /지분 투자|전략적 투자|기업형 전략 투자/.test(value || "") ? 0
  : /라이선스/.test(value || "") ? 1 : 2;
const portfolio = [...merged.values()]
  .map(company => {
    const latest = findLatestEvidence(company);
    const { aliases, ...publicCompany } = company;
    return {
      ...publicCompany,
      latestEvidence: latest ? {
        title: latest.titleKo || latest.title || "",
        date: latest.date || "",
        source: latest.source || "",
        url: latest.url,
        summary: latest.summary || "",
      } : null,
    };
  })
  .sort((a, b) => (layerOrder.get(a.layer) ?? 99) - (layerOrder.get(b.layer) ?? 99)
    || relationRank(a.relationType) - relationRank(b.relationType)
    || a.name.localeCompare(b.name, "en"));

const enrichedChains = valueChains.map(chain => ({
  ...chain,
  count: portfolio.filter(item => item.layer === chain.id).length,
  strategicCount: portfolio.filter(item => item.layer === chain.id && item.origin === "strategic").length,
}));
const officialCount = portfolio.filter(item => item.origin === "nventures").length;
const strategicCount = portfolio.filter(item => item.origin === "strategic").length;

const output = {
  generatedAt: new Date().toISOString(),
  company: "NVIDIA",
  featuredId: "groq",
  scope: `NVentures 공식 포트폴리오 ${officialCount}개사와 별도 전략 관계 ${strategicCount}건을 6개 밸류체인으로 정규화`,
  methodology: "NVentures 공식 JSON을 매일 동기화하고, 별도 기업 발표에서 확인된 투자·라이선스를 관계 유형별로 결합합니다. 공식 목록 수집 실패 시 직전 스냅샷을 보존하며, 투자와 라이선스는 같은 지분 관계로 표시하지 않습니다.",
  officialCatalog: {
    status: official.status,
    asOf: official.asOf,
    count: officialCount,
    pageUrl: config.officialPortfolio.pageUrl,
    dataUrl: config.officialPortfolio.dataUrl,
    error: official.error || null,
  },
  valueChains: enrichedChains,
  portfolio,
};

await writeFile(OUTPUT_FILE, `${JSON.stringify(output)}\n`);
console.log(`[nvidia-investments] ${portfolio.length} companies · ${enrichedChains.length} value chains · ${official.status} official catalog · ${portfolio.filter(item => item.latestEvidence).length} latest crawl matches`);
