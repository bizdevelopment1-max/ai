#!/usr/bin/env node
/* ============================================================
   generate-briefing.mjs — AI Morning Briefing 생성기
   입력: news.json (+ 기존 briefing.json 아카이브)
   출력: briefing.json  { generatedAt, days: [{date, headline, items}] }

   - 매일 최신 기사에서 상위 신호를 골라 Signal → Insight → Action
     카드로 변환. 비즈니스 맥락 라벨([파트너십 기회]/[인수 후보]/
     [경쟁 위협]/[시장 신호]/[공급망]/[규제])과 4축 기회 스코어
     (전략 정합성·시장 성장성·실행 가능성·경쟁 우위, 각 1~5)를 부여.
   - 합계 12점 이상이면 urgent(즉시 검토) 플래그.
   - ANTHROPIC_API_KEY 있으면 LLM(engine:"llm"), 없으면 규칙 기반
     폴백(engine:"rules")으로 항상 결과 보장.
   - 최근 14일치 브리핑을 days 배열로 아카이브(재탐색성).
   - 사명(삼성/MX/Galaxy) 미출력 — '글로벌 단말 제조사' 관점만.
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";
import { llmJSON } from "./llm.mjs";

const KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = "claude-opus-4-8";
const BANNED = /삼성|samsung|갤럭시|galaxy|\bMX\b/gi;
const TODAY = new Date().toISOString().slice(0, 10);
const MAX_DAYS = 60;          // 아카이브 보존 일수(누적)
const MAX_ITEMS = 6;          // 하루 브리핑 카드 수

const LABELS = ["파트너십 기회", "인수 후보", "경쟁 위협", "시장 신호", "공급망", "규제"];

const daysAgo = d => { const t = new Date(d + "T00:00:00Z").getTime(); return isNaN(t) ? 99 : Math.max(0, (Date.now() - t) / 86400000); };
const recency = d => Math.exp(-daysAgo(d) / 7);
const AUTHORITATIVE = ["reuters", "bloomberg", "cnbc", "the information", "wsj", "ft", "techcrunch", "the verge", "anthropic", "openai", "nvidia", "goldman", "morgan stanley", "trendforce", "idc", "gartner"];
const sourceWeight = s => (AUTHORITATIVE.some(a => String(s || "").toLowerCase().includes(a)) ? 1.25 : 1.0);
const scrub = s => String(s || "").replace(BANNED, "글로벌 제조사").trim().replace(/[.。]+$/, "");
const clamp15 = n => Math.max(1, Math.min(5, Math.round(Number(n) || 3)));

// ---- 후보 기사 선정: 최근성×출처 가중, 이전 브리핑에서 이미 쓴 URL은 감점(중복 제거) ----
function pickCandidates(articles, usedUrls) {
  return articles
    .filter(a => a && a.title && a.url && !BANNED.test(`${a.title} ${a.summary || ""}`))
    .map(a => ({ a, s: recency(a.date) * sourceWeight(a.source) * (usedUrls.has(a.url) ? 0.25 : 1) }))
    .sort((x, y) => y.s - x.s)
    .slice(0, 14)
    .map(x => x.a);
}

// ---- LLM 경로 ----------------------------------------------------------
const SYS = "당신은 글로벌 스마트폰·온디바이스 AI 기기 제조사의 신사업 전략 분석가입니다. 특정 기업명(삼성, 갤럭시, MX, 사업부 등)은 절대 언급하지 않습니다. 한국어 개조식(명사형 종결)으로, 과장 없이 사실에 근거해 작성합니다.";

function briefPrompt(cands) {
  const list = cands.map((a, i) => `[${i}] (${a.date} · ${a.source}) ${a.title}\n${(a.summary || "").split("\n").slice(0, 2).join(" ")}`).join("\n\n");
  return `아래는 최근 1주간 수집된 AI 산업 기사입니다. 개별 기사 요약이 아니라 여러 기사를 관통하는 흐름을 종합해 서로 다른 테마 ${MAX_ITEMS}개의 '주간 종합 브리핑' 카드를 작성하세요(단말 사업 관점).

${list}

각 카드(JSON):
- signal: 1주간 관측된 흐름 종합(1문장 — 반드시 정량 수치 포함, 마침표 금지·명사형 종결)
- insight: 왜 중요한가 — 단말(스마트폰·노트북·웨어러블) 사업 관점의 해석(1~2문장)
- action: 다음 액션(1문장, 마침표 금지·명사형 종결)
- labels: ${JSON.stringify(LABELS)} 중 1~2개
- scores: {fit(전략 정합성), growth(시장 성장성), exec(실행 가능성), edge(경쟁 우위)} 각 1~5 정수
- evidenceIdx: 근거 기사 인덱스 배열(위 [n] 번호, 1~2개)

headline: 이번 주 흐름을 관통하는 한 줄(25자 내외, 마침표 금지)\nstats: 이번 주 핵심 정량 지표 4개 {k:수치, t:설명 10자 내외} — 기사에 있는 수치만
금지: 특정 회사명(삼성 등)을 어떤 필드에도 쓰지 마세요. 기사에 없는 사실을 만들지 마세요.`;
}

async function llmBriefing(cands) {
  if (!cands.length) return null;
  const r = await llmJSON({
    system: SYS, user: briefPrompt(cands), maxTokens: 3000,
    schema: {
      type: "object",
      properties: {
        headline: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              signal: { type: "string" }, insight: { type: "string" }, action: { type: "string" },
              labels: { type: "array", items: { type: "string" } },
              scores: { type: "object", properties: { fit: { type: "integer" }, growth: { type: "integer" }, exec: { type: "integer" }, edge: { type: "integer" } }, required: ["fit", "growth", "exec", "edge"], additionalProperties: false },
              evidenceIdx: { type: "array", items: { type: "integer" } },
            },
            required: ["signal", "insight", "action", "labels", "scores", "evidenceIdx"],
            additionalProperties: false,
          },
        },
        stats: { type: "array", items: { type: "object", properties: { k: { type: "string" }, t: { type: "string" } }, required: ["k", "t"], additionalProperties: false } },
      },
      required: ["headline", "items", "stats"], additionalProperties: false,
    },
  });
  if (!r || !r.data.items || !r.data.items.length) { console.warn("[briefing:llm] unavailable → rules fallback"); return null; }
  return { engine: r.engine, headline: scrub(r.data.headline), stats: (r.data.stats || []).slice(0, 4).map(s => ({ k: scrub(s.k), t: scrub(s.t) })), items: r.data.items.slice(0, MAX_ITEMS).map(it => finishItem(it, cands)) };
}

function finishItem(it, cands) {
  const scores = { fit: clamp15(it.scores.fit), growth: clamp15(it.scores.growth), exec: clamp15(it.scores.exec), edge: clamp15(it.scores.edge) };
  const total = scores.fit + scores.growth + scores.exec + scores.edge;
  const evidence = (it.evidenceIdx || []).map(i => cands[i]).filter(Boolean).slice(0, 2)
    .map(a => ({ title: a.title, date: a.date, source: a.source, url: a.url, cat: a.cat }));
  return {
    signal: scrub(it.signal), insight: scrub(it.insight), action: scrub(it.action),
    labels: (it.labels || []).filter(l => LABELS.includes(l)).slice(0, 2),
    scores, total, urgent: total >= 12 && scores.fit >= 4,
    evidence,
  };
}

// ---- 규칙 기반 폴백 -----------------------------------------------------
const RULE_AXES = [
  { kw: ["파트너십", "제휴", "탑재", "partnership", "협력", "임대 계약"], labels: ["파트너십 기회"], action: "해당 업체와의 협업 가능성·기존 파트너 계약과의 충돌 여부 검토" },
  { kw: ["인수", "합병", "m&a", "acquisition", "acqui"], labels: ["인수 후보"], action: "대상 기업 밸류에이션·기술 자산·인재 규모 초기 평가" },
  { kw: ["메모리", "hbm", "공급 부족", "shortage", "칩", "파운드리", "tsmc"], labels: ["공급망"], action: "부품 조달 로드맵·장기 공급 계약 조건 재점검" },
  { kw: ["규제", "수출", "통제", "규정", "법", "export", "승인"], labels: ["규제"], action: "규제 변화가 모델 탑재·해외 출시 일정에 미치는 영향 점검" },
  { kw: ["에이전트", "어시스턴트", "assistant", "agent", "온디바이스", "on-device"], labels: ["경쟁 위협"], action: "자사 단말 AI 로드맵 대비 기능 격차 분석" },
];

function ruleBriefing(cands) {
  const items = cands.slice(0, MAX_ITEMS).map(a => {
    const text = `${a.title} ${a.summary || ""}`.toLowerCase();
    const ax = RULE_AXES.find(x => x.kw.some(k => text.includes(k))) || { labels: ["시장 신호"], action: "동향 추적 지속 — 후속 보도·공식 발표 확인" };
    const firstLine = (a.summary || "").split("\n")[0].replace(/^·\s*/, "");
    const strategic = (a.summary || "").split("\n").find(l => l.includes("단말 관점")) || "";
    const scores = { fit: 3, growth: 3, exec: 3, edge: 3 };
    return {
      signal: scrub(firstLine || a.title),
      insight: scrub(strategic.replace(/^·\s*단말 관점\s*[:：]\s*/, "") || "단말 사업 관점의 파급 효과 추가 분석 필요"),
      action: ax.action,
      labels: ax.labels, scores, total: 12, urgent: false,
      evidence: [{ title: a.title, date: a.date, source: a.source, url: a.url, cat: a.cat }],
    };
  });
  return { engine: "rules", headline: "이번 주 AI 산업 핵심 신호", stats: [], items };
}

// ---- main ---------------------------------------------------------------
async function main() {
  let articles = [];
  try { articles = JSON.parse(await readFile("news.json", "utf8")).articles || []; } catch {}

  let prev = { days: [] };
  try { prev = JSON.parse(await readFile("briefing.json", "utf8")); } catch {}
  const prevDays = (prev.days || []).filter(d => d.date !== TODAY);

  const usedUrls = new Set(prevDays.flatMap(d => (d.items || []).flatMap(it => (it.evidence || []).map(e => e.url))));
  const cands = pickCandidates(articles, usedUrls);
  if (!cands.length) { console.log("[briefing] no candidate articles — keeping previous file"); return; }

  const brief = (await llmBriefing(cands)) || ruleBriefing(cands);
  const today = { date: TODAY, headline: brief.headline, engine: brief.engine, stats: brief.stats || [], items: brief.items };

  const out = { generatedAt: new Date().toISOString(), days: [today, ...prevDays].slice(0, MAX_DAYS) };
  await writeFile("briefing.json", JSON.stringify(out) + "\n");
  console.log(`Wrote briefing.json — ${today.items.length} cards (engine: ${brief.engine}), archive ${out.days.length} day(s)`);
  today.items.forEach(it => console.log(`  [${it.labels.join("·") || "시장 신호"}] ${it.total}/20${it.urgent ? " ★즉시검토" : ""}: ${it.signal.slice(0, 60)}`));
}

main().catch(e => { console.error(e); process.exit(0); });
