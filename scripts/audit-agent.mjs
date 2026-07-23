#!/usr/bin/env node
/* ============================================================
   audit-agent.mjs — 데이터 파이프라인 감사 에이전트
   모든 크롤 산출물을 검사해 audit.json 생성. 파이프라인 마지막에 실행.

   탭별 검사: 존재/파싱 · 신선도(탭별 허용 연령) · 항목 수(커버리지) ·
   엔진(llm/rules/seed) · 중복 URL · 금지어(삼성/MX/갤럭시 — 관점 노출 방지,
   증권사 리서치 원문 인용(research.json)은 예외) · generatedAt 정합성.
   결과: 탭별 status(ok|warn|fail) + 이슈 목록 + 종합 등급.
   UI 푸터의 '데이터 상태' 패널이 이 파일을 표시. exit code는 항상 0
   (사이트 갱신을 막지 않음) — 심각 이슈는 로그 + audit.json으로 보고.
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";

const BANNED = /삼성|samsung|갤럭시|galaxy|\bMX\b/i;

// 탭별 감사 규칙: file, tab(표시명), maxAgeDays(신선도), minItems(커버리지), items(추출자), engine(추출자), banned(금지어 검사 여부)
const RULES = [
  { file: "news.json", tab: "데일리 기사", maxAge: 1.5, minItems: 10, items: d => d.articles, urls: d => d.articles.map(a => a.url), banned: true },
  { file: "briefing.json", tab: "모닝 브리핑", maxAge: 1.5, minItems: 4, items: d => (d.days[0] || {}).items, engine: d => (d.days[0] || {}).engine, banned: true },
  { file: "insights.json", tab: "Executive Summary", maxAge: 1.5, minItems: 4, items: d => d.cards, engine: d => d.engine, banned: true },
  { file: "research.json", tab: "증권사 인사이트", maxAge: 2.5, minItems: 5, items: d => d.feed, engine: d => (d.onepager || {}).engine, banned: false, extra: d => (!d.onepager ? ["1페이저 없음"] : []) },
  { file: "radar.json", tab: "스타트업 레이더", maxAge: 8.5, minItems: 3, items: d => d.picks, engine: d => d.engine, banned: true, extra: d => (!(d.memos || []).length ? ["기회 메모 없음"] : []) },
  { file: "startups.json", tab: "스타트업 분석", maxAge: 8.5, minItems: 10, items: d => [...(d.large || []), ...(d.small || [])], engine: d => d.engine, banned: true },
  { file: "companies.json", tab: "기업 동향", maxAge: 1.5, minItems: 10, items: d => Object.keys(d.companies || {}), banned: false },
  { file: "market.json", tab: "AI 신사업 시장", maxAge: 30, minItems: 15, items: d => d.items, banned: false },
  { file: "stocks.json", tab: "주가 차트", maxAge: 4, minItems: 10, items: d => Object.keys(d.stocks || {}), banned: false,
    extra: d => Object.entries(d.stocks || {}).filter(([, v]) => !v.points || v.points.length < 2).map(([t]) => `${t}: 시세 데이터 없음/부족`) },
];

const ageDays = iso => { const t = new Date(iso).getTime(); return isNaN(t) ? 999 : (Date.now() - t) / 86400000; };
const r1 = n => Math.round(n * 10) / 10;

async function auditOne(rule) {
  const res = { file: rule.file, tab: rule.tab, status: "ok", issues: [], ageDays: null, items: 0, engine: undefined };
  let d;
  try { d = JSON.parse(await readFile(rule.file, "utf8")); }
  catch (e) { res.status = "fail"; res.issues.push(`파일 없음/파싱 실패: ${e.message.slice(0, 60)}`); return res; }

  res.ageDays = r1(ageDays(d.generatedAt));
  if (!d.generatedAt || res.ageDays > 30) { res.status = "fail"; res.issues.push(`갱신 시각 없음/비정상(${res.ageDays}일)`); }
  else if (res.ageDays > rule.maxAge) { res.status = "warn"; res.issues.push(`신선도 초과: ${res.ageDays}일 경과(허용 ${rule.maxAge}일) — 크롤 중단 의심`); }

  let items = [];
  try { items = rule.items(d) || []; } catch { items = []; }
  res.items = items.length;
  if (items.length < rule.minItems) { res.status = res.status === "fail" ? "fail" : "warn"; res.issues.push(`커버리지 부족: ${items.length}건(최소 ${rule.minItems})`); }

  if (rule.engine) {
    try { res.engine = rule.engine(d); } catch {}
    if (res.engine === "rules") res.issues.push("규칙 폴백으로 생성됨(LLM 미사용 — GitHub Models 권한/쿼터 또는 ANTHROPIC_API_KEY 확인)");
    if (res.engine === "seed") res.issues.push("시드 데이터 표시 중(첫 LLM 갱신 대기)");
  }

  if (rule.urls) {
    try {
      const urls = rule.urls(d), set = new Set();
      const dup = urls.filter(u => u && (set.has(u) ? true : (set.add(u), false)));
      if (dup.length) { res.status = res.status === "fail" ? "fail" : "warn"; res.issues.push(`중복 URL ${dup.length}건`); }
    } catch {}
  }

  if (rule.banned) {
    const text = JSON.stringify(items).slice(0, 200000);
    if (BANNED.test(text)) { res.status = "fail"; res.issues.push("금지어 노출(삼성/MX/갤럭시) — 즉시 수정 필요"); }
  }
  if (rule.extra) { try { for (const iss of rule.extra(d)) { res.issues.push(iss); if (res.status === "ok") res.status = "warn"; } } catch {} }
  return res;
}

async function main() {
  const checks = [];
  for (const rule of RULES) checks.push(await auditOne(rule));

  const fails = checks.filter(c => c.status === "fail").length;
  const warns = checks.filter(c => c.status === "warn").length;
  const overall = fails ? "fail" : warns ? "warn" : "ok";
  const out = {
    generatedAt: new Date().toISOString(), overall,
    summary: `${checks.length}개 탭 감사 — 정상 ${checks.length - fails - warns} · 주의 ${warns} · 실패 ${fails}`,
    checks,
  };
  await writeFile("audit.json", JSON.stringify(out) + "\n");
  console.log(`Wrote audit.json — overall: ${overall.toUpperCase()} (${out.summary})`);
  for (const c of checks) {
    console.log(`  [${c.status.toUpperCase()}] ${c.tab} (${c.file}) — ${c.items}건, ${c.ageDays}일${c.engine ? ", engine:" + c.engine : ""}`);
    c.issues.forEach(i => console.log(`      · ${i}`));
  }
}

main().catch(e => { console.error(e); process.exit(0); });
