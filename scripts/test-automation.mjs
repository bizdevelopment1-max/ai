#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";

const required = [
  ".github/workflows/daily-news.yml",
  ".github/workflows/daily-news-update.yml",
  "scripts/crawl-news.mjs",
  "scripts/crawl-stocks.mjs",
  "scripts/verify-pipeline.mjs",
  "scripts/audit-agent.mjs",
  "news.json",
  "stocks.json",
  "quality.json",
  "history.json",
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

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  failed = true;
  console.error(`  실패  Node.js ${process.version} (20 이상 필요)`);
} else {
  console.log(`  정상  Node.js ${process.version}`);
}

const llm = process.env.ANTHROPIC_API_KEY
  ? "Anthropic API"
  : (process.env.GITHUB_TOKEN || process.env.GH_MODELS_TOKEN)
    ? "GitHub Models"
    : "없음(규칙 기반 폴백)";
console.log(`  정보  요약 엔진: ${llm}`);
console.log("  정보  기본 파이프라인: 매일 06:30 · 12:30 · 19:30 · 00:30 KST");
console.log("  정보  보조 업데이트: 수동 복구 전용(동시 쓰기 방지)");

if (failed) process.exit(1);
console.log("자동화 구성 정상");
