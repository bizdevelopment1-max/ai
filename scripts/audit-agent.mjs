#!/usr/bin/env node
/**
 * Publish audit.
 * Reports freshness, coverage and evidence quality without generating content.
 */
import { readFile, writeFile } from "node:fs/promises";

const DAY = 86_400_000;
const read = async file => JSON.parse(await readFile(file, "utf8"));
const age = iso => {
  const t = Date.parse(iso || "");
  return Number.isFinite(t) ? Math.max(0, (Date.now() - t) / DAY) : 999;
};
const round = n => Math.round(n * 10) / 10;

const rules = [
  { file: "news.json", tab: "데일리 기사", maxAge: 2, min: 20, items: d => d.articles || [] },
  { file: "briefing.json", tab: "모닝 브리핑", maxAge: 2, min: 1, items: d => d.days?.[0]?.items || [] },
  { file: "insights.json", tab: "Executive Summary", maxAge: 2, min: 3, items: d => d.cards || [] },
  { file: "research.json", tab: "증권사 인사이트", maxAge: 7, min: 1, items: d => d.feed || [], soft: true },
  { file: "radar.json", tab: "스타트업 레이더", maxAge: 10, min: 3, items: d => d.picks || [], soft: true },
  { file: "startups.json", tab: "스타트업 분석", maxAge: 10, min: 75, items: d => [...(d.large || []), ...(d.small || []), ...(d.institutional || [])] },
  { file: "a16z-startups.json", tab: "a16z Top 100 원장", maxAge: 10, min: 100, items: d => [...(d.web || []), ...(d.mobile || [])] },
  { file: "strategic-ventures.json", tab: "AI 서비스 JV·DeployCo", maxAge: 5, min: 2, items: d => Object.values(d.companies || {}).flat() },
  { file: "companies.json", tab: "기업 동향", maxAge: 3, min: 8, items: d => Object.keys(d.companies || {}) },
  { file: "company-news.json", tab: "기업 직접 연관 뉴스", maxAge: 3, min: 10, items: d => Object.values(d.companies || {}).filter(rows => rows.length) },
  { file: "market.json", tab: "AI 신사업 정량·소비자 DB", maxAge: 2, min: 18, items: d => d.records || d.items || [], soft: true },
  { file: "infra.json", tab: "인프라·미래기술", maxAge: 5, min: 3, items: d => d.items || [] },
  { file: "bizmodel.json", tab: "수익화 모델", maxAge: 5, min: 3, items: d => d.items || [] },
  { file: "monetization.json", tab: "AI 수익화 플레이북", maxAge: 5, min: 3, items: d => d.companies || [], soft: true },
  { file: "stocks.json", tab: "Stock 분석", maxAge: 4, min: 63, items: d => Object.values(d.stocks || {}) },
  { file: "nvidia-investments.json", tab: "NVIDIA 투자 포트폴리오", maxAge: 5, min: 8, items: d => d.portfolio || [] },
  { file: "history.json", tab: "누적 데이터", maxAge: 2, min: 20, items: d => d.articles || [] },
];

const checks = [];
for (const rule of rules) {
  const row = { file: rule.file, tab: rule.tab, status: "ok", issues: [], ageDays: 999, items: 0 };
  try {
    const data = await read(rule.file);
    row.ageDays = round(age(data.generatedAt));
    row.items = rule.items(data).length;
    if (row.ageDays > rule.maxAge) {
      row.status = rule.soft ? "warn" : "fail";
      row.issues.push(`최신성 기준 초과: ${row.ageDays}일 (기준 ${rule.maxAge}일)`);
    }
    if (row.items < rule.min) {
      row.status = rule.soft || row.status === "warn" ? "warn" : "fail";
      row.issues.push(`커버리지 부족: ${row.items}건 (최소 ${rule.min}건)`);
    }
  } catch (error) {
    row.status = "fail";
    row.issues.push(`파일 읽기 실패: ${error.message}`);
  }
  checks.push(row);
}

try {
  const quality = await read("quality.json");
  for (const check of quality.checks || []) {
    checks.push({
      file: "quality.json",
      tab: check.label,
      status: check.status,
      issues: check.status === "ok" ? [] : [quality.policy],
      ageDays: round(age(quality.generatedAt)),
      items: check.value,
    });
  }
} catch (error) {
  checks.push({ file: "quality.json", tab: "근거 검증", status: "fail", issues: [error.message], ageDays: 999, items: 0 });
}

const fails = checks.filter(c => c.status === "fail").length;
const warns = checks.filter(c => c.status === "warn").length;
const overall = fails ? "fail" : warns ? "warn" : "ok";
const output = {
  generatedAt: new Date().toISOString(),
  overall,
  summary: `${checks.length}개 검사 · 정상 ${checks.length - fails - warns} · 주의 ${warns} · 실패 ${fails}`,
  checks,
};
await writeFile("audit.json", JSON.stringify(output, null, 2) + "\n");
console.log(`[audit] ${output.summary}`);
if (fails) process.exitCode = 1;
