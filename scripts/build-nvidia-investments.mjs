#!/usr/bin/env node
/**
 * NVIDIA 자본·전략 생태계 공개 뷰.
 *
 * - NVentures가 공개하는 공식 포트폴리오 JSON을 매 실행마다 직접 동기화한다.
 * - 기업 공식 발표로 확인되는 전략투자·라이선스는 별도 claim ledger로 합친다.
 * - 산업 분류를 6개 MECE 밸류체인으로 결정론적으로 정규화한다.
 * - NVIDIA 개별 투자액과 전체 라운드 규모를 절대 같은 숫자로 취급하지 않는다.
 * - 개별 금액·라운드·투자 사유가 공개되지 않았으면 추정 문장을 만들지 않는다.
 * - 공식 목록 수집이 실패하면 직전 공개 스냅샷을 보존해 빈 화면을 만들지 않는다.
 */
import { readFile, writeFile } from "node:fs/promises";
import { loadSuppressionRegistry } from "./suppression-registry.mjs";

const CONFIG_FILE = "config/nvidia-investment-taxonomy.json";
const DEAL_FILE = "config/nvidia-investment-deals.json";
const OUTPUT_FILE = "nvidia-investments.json";
const config = JSON.parse(await readFile(CONFIG_FILE, "utf8"));
const dealLedger = JSON.parse(await readFile(DEAL_FILE, "utf8"));
const valueChains = config.valueChains || [];

const clean = value => String(value || "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, " ").trim();
const slugify = value => clean(value).replace(/\s+/g, "-") || "company";
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
      return {
        id: `nventures-${slugify(row.companyName)}`,
        name: row.companyName,
        shortName: row.companyName,
        aliases: [row.companyName],
        layer,
        domain: domainFromUrl(row.websiteUrl),
        websiteUrl: row.websiteUrl,
        logoUrl: row.logoUrl?.startsWith("/") ? `https://www.nvidia.com${row.logoUrl}` : row.logoUrl,
        relationship: {
          type: "NVentures 공식 포트폴리오 등재",
          status: "verified-catalog",
          role: "투자 관계 확인",
          equity: true,
        },
        nvidiaInvestment: {
          display: "미공개",
          amountUsd: null,
          status: "undisclosed",
          basis: "NVentures 목록에는 NVIDIA 개별 투자액이 없음",
        },
        round: {
          display: "개별 라운드 미확인",
          totalAmountUsd: null,
          status: "not-disclosed",
          date: "",
        },
        officialIndustry: row.industry,
        relationshipDetail: "NVentures 공식 JSON 등재로 투자 관계만 확인됩니다. 개별 거래 시점·라운드·금액은 이 원문에 공개되지 않았습니다.",
        rationale: {
          status: "not-disclosed",
          summary: "개별 투자 사유 미공개",
        },
        dealHistory: [],
        catalogEntry: true,
        origin: "nventures-catalog",
        evidence: [{
          id: `catalog-${slugify(row.companyName)}`,
          claim: "NVentures 공식 포트폴리오 등재",
          quote: `${row.companyName} · ${row.industry}`,
          url: config.officialPortfolio.pageUrl,
          date: asOf,
          publisher: config.officialPortfolio.label,
          tier: "official",
        }],
      };
    }),
  };
}

let official;
try {
  official = await fetchOfficialPortfolio();
} catch (error) {
  const fallback = (previous?.portfolio || []).filter(item => item.catalogEntry === true || item.origin === "nventures-catalog");
  official = {
    status: fallback.length ? "cached" : "unavailable",
    asOf: previous?.officialCatalog?.asOf || "",
    items: fallback,
    error: error.message,
  };
}

const suppression = await loadSuppressionRegistry();
const merged = new Map();
for (const item of official.items) {
  const key = clean(item.name);
  if (!key || suppression.hasCompany(item.name)) continue;
  merged.set(key, item);
}
for (const deal of dealLedger.records || []) {
  const key = clean(deal.name);
  if (!key || suppression.hasCompany(deal.name)) continue;
  const catalog = merged.get(key);
  merged.set(key, {
    ...catalog,
    ...deal,
    websiteUrl: deal.websiteUrl || catalog?.websiteUrl,
    logoUrl: deal.logoUrl || catalog?.logoUrl,
    officialIndustry: deal.officialIndustry || catalog?.officialIndustry,
    catalogEntry: Boolean(catalog),
    origin: "deal-ledger",
  });
}

const layerOrder = new Map(valueChains.map((chain, index) => [chain.id, index]));
const hasRoundAmount = company => Number.isFinite(company.round?.totalAmountUsd)
  || (Number.isFinite(company.round?.totalAmount) && Boolean(company.round?.currency));
const disclosureRank = company => company.nvidiaInvestment?.status === "disclosed" ? 0
  : company.nvidiaInvestment?.status === "reported" ? 1
    : hasRoundAmount(company) ? 2 : 3;
const portfolio = [...merged.values()]
  .map(company => {
    const { aliases, ...publicCompany } = company;
    return {
      ...publicCompany,
      aliases: aliases || [company.name],
      disclosure: company.nvidiaInvestment?.status === "disclosed" ? "nvidia-amount-disclosed"
        : company.nvidiaInvestment?.status === "reported" ? "nvidia-amount-reported"
          : ["planned", "committed"].includes(company.nvidiaInvestment?.status) ? "nvidia-amount-planned"
          : hasRoundAmount(company) ? "round-total-only"
            : "relationship-only",
    };
  })
  .sort((a, b) => (layerOrder.get(a.layer) ?? 99) - (layerOrder.get(b.layer) ?? 99)
    || disclosureRank(a) - disclosureRank(b)
    || a.name.localeCompare(b.name, "en"));

const enrichedChains = valueChains.map(chain => ({
  ...chain,
  count: portfolio.filter(item => item.layer === chain.id).length,
  detailedCount: portfolio.filter(item => item.layer === chain.id && item.origin === "deal-ledger").length,
}));
const officialCount = portfolio.filter(item => item.catalogEntry).length;
const detailedCount = portfolio.filter(item => item.origin === "deal-ledger").length;
const nvidiaAmountCount = portfolio.filter(item => ["disclosed", "reported", "planned", "committed"].includes(item.nvidiaInvestment?.status)).length;
const roundAmountCount = portfolio.filter(hasRoundAmount).length;
const relationshipOnlyCount = portfolio.filter(item => item.disclosure === "relationship-only").length;

const output = {
  generatedAt: new Date().toISOString(),
  company: "NVIDIA",
  featuredId: "runway",
  scope: `NVentures 공식 포트폴리오 ${officialCount}개사와 거래 원문이 별도 검증된 ${detailedCount}개사를 6개 밸류체인으로 정규화`,
  methodology: dealLedger.methodology,
  disclosurePolicy: {
    nvidiaAmount: "NVIDIA 개별 투자액만 표시하며 라운드 총액으로 대체하지 않음",
    roundAmount: "해당 기업이 조달한 전체 라운드 금액으로 별도 표시",
    unknown: "공개되지 않은 금액·지분율·사유는 추정하지 않음",
    news: "일반 뉴스 요약은 거래 근거로 자동 승격하지 않음",
  },
  metrics: {
    detailedCount,
    nvidiaAmountCount,
    roundAmountCount,
    relationshipOnlyCount,
  },
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
console.log(`[nvidia-investments] ${portfolio.length} companies · ${enrichedChains.length} value chains · ${official.status} catalog · ${detailedCount} sourced deals · ${nvidiaAmountCount} NVIDIA amounts · ${roundAmountCount} round totals`);
