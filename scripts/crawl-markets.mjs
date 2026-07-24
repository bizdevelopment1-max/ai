#!/usr/bin/env node
/*
 * Append-only market intelligence crawler.
 * Keeps the existing six-axis market map intact, then adds only new,
 * source-linked quantitative observations to market.json.records.
 */
import { readFile, writeFile } from "node:fs/promises";
import { appendRecords, ensureMarketDatabase, hasSurveyEvidence } from "./market-db.mjs";

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
    ...String(text || "").matchAll(/(?:US\$|USD|\$)\s?\d[\d,.]*(?:\s?(?:trillion|billion|million|trn|bn|mn|T|B|M))?/gi),
    ...String(text || "").matchAll(/\b\d+(?:\.\d+)?%/g),
    ...String(text || "").matchAll(/\b\d[\d,.]*(?:\s?(?:million|billion|bn|mn|thousand|m|b))\s+(?:users|consumers|respondents|shipments|units|adults|people)/gi),
  ].map(match => match[0].replace(/\s+/g, " ").trim());
  return [...new Set(found)].slice(0, 4);
};

const kindOf = record => hasSurveyEvidence(record)
  ? "consumer-survey"
  : /\b(?:shipments?|units?)\b/i.test(`${record.title || ""} ${record.evidence || ""}`) ? "shipment" : "market-observation";

async function rss(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:14d`)}&hl=en-US&gl=US&ceid=US:en`;
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  if (!response.ok) throw new Error(`Google News RSS ${response.status} for ${query}`);
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
  if (ageHours < 20) {
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
  for (const config of QUERIES) {
    try {
      const rows = await rss(config.query);
      fetched += rows.length;
      for (const row of rows) {
        const combined = `${row.title} ${row.evidence}`;
        const values = quantified(combined).map((value, index) => ({ label: index === 0 ? "공개 수치" : "추가 수치", value }));
        if (!values.length) continue;
        const record = {
          type: kindOf(row),
          group: config.group,
          verticalId: config.verticalId,
          topic: config.topic,
          title: row.title,
          metricLabel: config.topic,
          values,
          scope: "검색 결과의 제목·공개 스니펫 범위. 원문에서 정의·표본·기준연도를 재확인해야 합니다.",
          sourceName: row.sourceName,
          sourceUrl: row.sourceUrl,
          publishedAt: row.publishedAt,
          evidence: row.evidence.slice(0, 900),
          origin: "rss-quantitative-crawl",
        };
        candidates.push(record);
        if (!latestByVertical.has(config.verticalId)) latestByVertical.set(config.verticalId, row);
      }
    } catch (error) {
      failures++;
      console.error(`[market-db] ${config.id}: ${error.message}`);
    }
  }

  if (!fetched && failures === QUERIES.length) throw new Error("All market-data sources failed; refusing to mark the database refreshed");
  const added = appendRecords(data, candidates, startedAt);
  for (const item of data.items || []) {
    const latest = latestByVertical.get(item.id);
    if (latest) item.latest = { title: latest.title, url: latest.sourceUrl, source: latest.sourceName, date: latest.publishedAt };
  }
  data.database = {
    ...(data.database || {}),
    recordCount: data.records.length,
    lastCrawledAt: startedAt,
    lastCrawl: { queries: QUERIES.length, rssRows: fetched, appended: added, failures },
  };
  data.freshAt = startedAt;
  data.generatedAt = startedAt;
  await writeFile("market.json", JSON.stringify(data, null, 2) + "\n");
  console.log(`[market-db] appended ${added} source-linked records; retained ${data.records.length}; RSS rows ${fetched}/${QUERIES.length} queries`);
}

main().catch(error => { console.error(error); process.exit(1); });
