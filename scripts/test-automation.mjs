#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { BUNDLE_FILE, readBrowserSources, sourceStamp } from "./build-browser-bundle.mjs";

const required = [
  ".github/workflows/daily-news.yml",
  ".github/workflows/daily-news-update.yml",
  "scripts/crawl-news.mjs",
  "scripts/crawl-stocks.mjs",
  "scripts/crawl-markets.mjs",
  "scripts/market-db.mjs",
  "scripts/global-sources.mjs",
  "scripts/build-browser-bundle.mjs",
  "scripts/run-with-retry.mjs",
  "scripts/verify-pipeline.mjs",
  "scripts/audit-agent.mjs",
  "news.json",
  "stocks.json",
  "quality.json",
  "history.json",
  "llm-health.json",
  "collection-health.json",
  "config/news-policy.json",
  "config/global-source-policy.json",
  "index.html",
  "app.bundle.js",
];

let failed = false;
console.log("자동화 구성 검사");
for (const file of required) {
  try {
    await access(file);
    if (file.endsWith(".json")) JSON.parse(await readFile(file, "utf8"));
    console.log(`  정상  ${file}`);
  } catch (error) {
    failed = true;
    console.error(`  실패  ${file}: ${error.message}`);
  }
}

try {
  const [sources, bundle, index] = await Promise.all([readBrowserSources(), readFile(BUNDLE_FILE, "utf8"), readFile("index.html", "utf8")]);
  const expected = `/* ai-dashboard-bundle:${sourceStamp(sources)} */`;
  if (!bundle.startsWith(expected)) throw new Error("bundle is stale; run npm run build:browser before publishing");
  if (/babel\.min\.js|text\/babel/.test(index) || !/defer src="app\.bundle\.js/.test(index)) {
    throw new Error("index must serve the precompiled browser bundle without a runtime JSX compiler");
  }
  console.log("  정상  browser bundle is current (no runtime JSX compiler)");
} catch (error) {
  failed = true;
  console.error(`  실패  browser bundle: ${error.message}`);
}

try {
  const policy = JSON.parse(await readFile("config/global-source-policy.json", "utf8"));
  if (!Array.isArray(policy.locales) || policy.locales.length < 5 || !policy.locales.every(locale => locale.id && locale.region && locale.language && locale.hl && locale.gl && locale.ceid)) {
    throw new Error("global source policy needs at least five complete regional locale definitions");
  }
  console.log(`  정상  글로벌 비기사 수집 범위 ${policy.locales.length}개 지역·언어 로캘`);
} catch (error) {
  failed = true;
  console.error(`  실패  global source policy: ${error.message}`);
}

try {
  const newsCrawler = await readFile("scripts/crawl-news.mjs", "utf8");
  if (!/hl=en-US&gl=US&ceid=US:en/.test(newsCrawler) || /global-sources\.mjs/.test(newsCrawler)) {
    throw new Error("daily article feed must remain independently limited to English authoritative sources");
  }
  console.log("  정상  기사 피드는 영문 권위 소스 제한 유지");
} catch (error) {
  failed = true;
  console.error(`  실패  article source boundary: ${error.message}`);
}

try {
  const market = JSON.parse(await readFile("market.json", "utf8"));
  const records = market.records || [];
  const ids = new Set(records.map(record => record.id));
  const linked = records.filter(record => /^https?:\/\//.test(record.sourceUrl || ""));
  if (market.database?.mode !== "append-only" || records.length < 3 || ids.size !== records.length || linked.length !== records.length) {
    throw new Error("append-only market database requires unique, source-linked records");
  }
  console.log(`  정상  market.json 누적 정량 DB ${records.length}건`);
} catch (error) {
  failed = true;
  console.error(`  실패  market.json 누적 정량 DB: ${error.message}`);
}

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  failed = true;
  console.error(`  실패  Node.js ${process.version} (20 이상 필요)`);
} else {
  console.log(`  정상  Node.js ${process.version}`);
}

console.log("  정보  요약 엔진: 원문 발췌(외부 AI API 미사용)");
console.log("  정보  기본 파이프라인: 매일 06:30 · 12:30 · 19:30 · 00:30 KST");
console.log("  정보  보조 업데이트: 수동 복구 전용(동시 쓰기 방지)");

const pipelineScripts = [
  "scripts/crawl-news.mjs", "scripts/crawl-stocks.mjs", "scripts/crawl-research.mjs",
  "scripts/crawl-startups.mjs", "scripts/crawl-markets.mjs", "scripts/crawl-infra.mjs",
  "scripts/crawl-bizmodel.mjs", "scripts/generate-briefing.mjs", "scripts/startup-radar.mjs",
  "scripts/build-insights.mjs", "scripts/crawl-companies.mjs",
];
for (const file of pipelineScripts) {
  const source = await readFile(file, "utf8");
  if (/process\.exit\(0\)/.test(source)) {
    failed = true;
    console.error(`  실패  ${file}: 오류를 성공으로 종료하는 코드가 남아 있음`);
  }
}

try {
  const policy = JSON.parse(await readFile("config/news-policy.json", "utf8"));
  const health = JSON.parse(await readFile("llm-health.json", "utf8"));
  if (policy.summaryMode !== "source-excerpt" || health.externalModelApiCalls !== 0) {
    throw new Error("source-only policy or model API health declaration is invalid");
  }
  const sources = await Promise.all(pipelineScripts.concat(["scripts/llm.mjs"]).map(file => readFile(file, "utf8")));
  if (sources.some(source => /api\.anthropic\.com|models\.github\.ai|@anthropic-ai\/sdk/.test(source))) {
    throw new Error("a model API endpoint or SDK remains in an active pipeline source");
  }
  console.log("  정상  source-only summary policy (external AI API calls: 0)");
} catch (error) {
  failed = true;
  console.error(`  실패  source-only policy: ${error.message}`);
}

if (failed) process.exit(1);
console.log("자동화 구성 정상");
