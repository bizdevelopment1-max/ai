#!/usr/bin/env node
/*
 * Append-only market intelligence crawler.
 * Keeps the existing six-axis market map intact, then adds only new,
 * RSS discovery observations to market.json.records. RSS content is retained
 * as a discovery ledger only; a separate source-page pass must resolve and
 * extract the publisher page before a record is allowed onto the site.
 */
import { readFile, writeFile } from "node:fs/promises";
import { appendRecords, ensureMarketDatabase, hasSurveyEvidence } from "./market-db.mjs";
import { googleNewsUrl, rotatingLocales } from "./global-sources.mjs";
import { isExcludedText } from "./news-policy.mjs";

const UA = "Mozilla/5.0 (compatible; AI-Intelligence-Market-DB/1.0)";
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const decode = raw => String(raw || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tag = (xml, name) => (xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i")) || [])[1] || "";
const cleanTitle = title => decode(title).replace(/\s+-\s+[^-]{2,}$/, "").trim();

const QUERIES = [
  { id: "ai-phone", group: "core", verticalId: "core-0", topic: "생성형 AI폰 시장·출하", query: "generative AI smartphone market size forecast shipments" },
  { id: "device-ai", group: "core", verticalId: "core-1", topic: "온디바이스 AI·AI PC", query: "on-device AI AI PC market size forecast" },
  { id: "agents", group: "assistant", verticalId: "assistant-0", topic: "AI 에이전트·어시스턴트", query: "AI agent consumer adoption market size survey" },
  { id: "consumer-phone", group: "assistant", verticalId: "assistant-0", topic: "AI 스마트폰 소비자 조사", query: "generative AI smartphone consumer survey respondents adoption" },
  { id: "wearables", group: "wearxr", verticalId: "wearxr-1", topic: "스마트글라스·웨어러블", query: "smart glasses wearable AI consumer survey shipments forecast" },
  { id: "creative", group: "creative", verticalId: "creative-0", topic: "생성형 콘텐츠·카메라", query: "generative AI content creation consumer survey market size" },
  { id: "service", group: "service", verticalId: "service-0", topic: "AI 서비스 플랫폼", query: "AI healthcare smart home fintech consumer survey market size" },
  { id: "trust", group: "trust", verticalId: "trust-0", topic: "AI 신뢰·보안 소비자 조사", query: "AI privacy trust consumer survey respondents" },
];

const quantified = text => {
  const found = [
    ...String(text || "").matchAll(/(?:US\$|USD|\$|EUR|€|GBP|£|JPY|CNY|CN¥|¥|KRW|₩|INR|₹|BRL|R\$)\s?\d[\d,.]*(?:\s?(?:trillion|billion|million|trn|bn|mn|T|B|M|조|억|만|억엔|億元|亿|万))?/gi),
    ...String(text || "").matchAll(/\b\d+(?:\.\d+)?\s?(?:%|％)/g),
    ...String(text || "").matchAll(/\b\d[\d,.]*(?:\s?(?:million|billion|bn|mn|thousand|m|b))\s+(?:users|consumers|respondents|shipments|units|adults|people)/gi),
    ...String(text || "").matchAll(/\b\d[\d,.]*(?:명|대|만명|만 대|억명|억 대|조원|억원|만 원|万人|万台|億人|億台|万人|台|億|万)/g),
  ].map(match => match[0].replace(/\s+/g, " ").trim());
  return [...new Set(found)].slice(0, 4);
};

const kindOf = record => hasSurveyEvidence(record)
  ? "consumer-survey"
  : /\b(?:shipments?|units?)\b|출하|판매량|台|出荷|出货/i.test(`${record.title || ""} ${record.evidence || ""}`) ? "shipment" : "market-observation";

async function rss(query, locale) {
  const url = googleNewsUrl(query, locale, 14);
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  if (!response.ok) throw new Error(`Google News RSS ${response.status} for ${query} (${locale.id})`);
  const xml = await response.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 8).map(match => {
    const item = match[1];
    const published = new Date(tag(item, "pubDate"));
    return {
      title: cleanTitle(tag(item, "title")),
      sourceUrl: decode(tag(item, "link")),
      sourceName: decode(tag(item, "source")) || "Google News",
      publishedAt: Number.isNaN(published.getTime()) ? today() : published.toISOString().slice(0, 10),
      evidence: decode(tag(item, "description")),
      region: locale.region,
      language: locale.language,
      locale: locale.id,
    };
  }).filter(item => item.title && item.sourceUrl);
}

async function main() {
  let data;
  try {
    data = JSON.parse(await readFile("market.json", "utf8"));
  } catch {
    throw new Error("market.json is missing or invalid; run seed-markets.mjs before refreshing signals");
  }

  const startedAt = now();
  const migration = ensureMarketDatabase(data, startedAt);
  const ageHours = data.database?.lastCrawledAt ? (Date.now() - Date.parse(data.database.lastCrawledAt)) / 3_600_000 : 999;
  if (ageHours < 20 && process.env.MARKET_FORCE !== "1") {
    if (migration.changed) {
      data.generatedAt = startedAt;
      await writeFile("market.json", JSON.stringify(data, null, 2) + "\n");
    }
    console.log(`[market-db] crawl is fresh (${ageHours.toFixed(1)}h); preserved ${data.records.length} append-only records`);
    return;
  }

  let fetched = 0;
  let failures = 0;
  const candidates = [];
  const latestByVertical = new Map();
  const locales = rotatingLocales();
  for (const config of QUERIES) {
    for (const locale of locales) {
      try {
        const rows = await rss(config.query, locale);
        fetched += rows.length;
        for (const row of rows) {
          const combined = `${row.title} ${row.evidence}`;
          if (isExcludedText(`${combined} ${row.sourceName}`)) continue;
          const values = quantified(combined).map((value, index) => ({ label: index === 0 ? "공개 수치" : "추가 수치", value }));
          if (!values.length) continue;
          const record = {
            type: kindOf(row),
            group: config.group,
            verticalId: config.verticalId,
            topic: config.topic,
            title: row.title,
            metricLabel: config.topic,
            // These values are discovery hints from the RSS title/snippet.
            // They must never be rendered as source facts. The source-page
            // refresher replaces them with sourceQuantifiedLines only after
            // extracting the linked publisher page.
            values,
            scope: `발견 경로 ${row.region} · ${row.language} RSS · 발행사 원문 확인 전`,
            sourceName: row.sourceName,
            sourceUrl: row.sourceUrl,
            publishedAt: row.publishedAt,
            evidence: row.evidence.slice(0, 900),
            rssEvidence: row.evidence.slice(0, 900),
            displayEligible: false,
            provenance: {
              status: "pending-source-page",
              evidenceCount: 0,
              evidenceType: "rss-discovery-only",
              checkedAt: startedAt,
              issues: ["publisher-page-extraction-required"],
            },
            origin: "rss-quantitative-crawl",
            sourceScope: "global-localized-rss",
            sourceRegion: row.region,
            sourceLanguage: row.language,
            sourceLocale: row.locale,
          };
          candidates.push(record);
          if (!latestByVertical.has(config.verticalId)) latestByVertical.set(config.verticalId, row);
        }
      } catch (error) {
        failures++;
        console.error(`[market-db] ${config.id}/${locale.id}: ${error.message}`);
      }
    }
  }

  if (!fetched && failures === QUERIES.length * locales.length) throw new Error("All global market-data sources failed; refusing to mark the database refreshed");
  const added = appendRecords(data, candidates, startedAt);
  for (const item of data.items || []) {
    const latest = latestByVertical.get(item.id);
    if (latest) item.latest = { title: latest.title, url: latest.sourceUrl, source: latest.sourceName, date: latest.publishedAt };
  }
  data.database = {
    ...(data.database || {}),
    recordCount: data.records.length,
    lastCrawledAt: startedAt,
    lastCrawl: { queries: QUERIES.length, locales: locales.map(locale => ({ id: locale.id, region: locale.region, language: locale.language })), rssRows: fetched, appended: added, failures },
  };
  data.freshAt = startedAt;
  data.generatedAt = startedAt;
  await writeFile("market.json", JSON.stringify(data, null, 2) + "\n");
  console.log(`[market-db] appended ${added} discovery records awaiting publisher-page extraction; retained ${data.records.length}; RSS rows ${fetched}/${QUERIES.length * locales.length} global query streams`);
}

main().catch(error => { console.error(error); process.exit(1); });
