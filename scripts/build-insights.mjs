#!/usr/bin/env node
/* ============================================================
   build-insights.mjs — 규칙 기반 '오늘의 톱라인' 생성기 (결정론적)
   입력: news.json  →  출력: insights.json
   - 4개 고정 축에 기사를 매핑·점수화(최근성×출처신뢰도×키워드매치)하고
     축마다 top 1건을 골라 headline(기사) + soWhat(축 시사점) + 근거 기사로 카드 생성.
   - 매칭 기사가 없으면 정적 폴백 문구 사용 → 항상 4장 보장(MECE).
   - 외부 호출/ API 키 없음. GitHub Action(클라우드)에서 매일 실행.
   - 사명(삼성/MX/Galaxy) 미출력 — '단말 사업/온디바이스' 관점만.
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";

const AXES = [
  {
    axis: "assistant_layer", label: "어시스턴트 레이어", tone: "warn", nav: "bigtech",
    kw: ["assistant", "비서", "siri", "gemini", "copilot", "comet", "perplexity", "챗봇", "검색", "어시스턴트"],
    soWhat: "폰의 '기본 비서' 자리가 단말 차별화의 핵심 전장 — 기본 어시스턴트 노선(파트너 심화 vs 자체 vs 멀티)을 지금 확정해야 함",
    fallback: "Gemini 앱 MAU 900M+ · Apple, Siri를 'Siri AI'로 재설계 · Perplexity Comet 전면 무료 전환",
  },
  {
    axis: "ondevice_spec", label: "온디바이스 스펙", tone: "signal", nav: "bigtech",
    kw: ["온디바이스", "on-device", "npu", "메모리", "memory", "soc", "칩", "chip", "ai pc", "노트북", "스마트폰", "폰", "snapdragon", "tops", "엣지", "edge", "blackwell"],
    soWhat: "AI 기능 = 하드웨어 스펙 = 프리미엄 전환·교체수요 동력 — 메모리·NPU 사양 로드맵에 직결('AI 탑재=판매 증가' 단정은 금물)",
    fallback: "구형 단말은 메모리 한계로 온디바이스 AI 구동 곤란(고급 비서엔 12GB) · 생성형 AI 폰 2028년 70%(IDC)",
  },
  {
    axis: "monetization", label: "수익화", tone: "revenue", nav: "bizmodel",
    kw: ["구독", "arr", "매출", "가격", "단가", "무료", "수익", "마진", "토큰", "pricing", "valuation", "밸류", "ipo", "$", "billion", "투자", "funding"],
    soWhat: "온디바이스 AI 기능의 과금 노선(구독 유료화 vs 단말 가격 프리미엄 vs 커머스 수수료) 결정에 직접 영향 — API 단가 하락은 클라우드 기능 원가에 직결",
    fallback: "Perplexity 구독→광고·커머스 전환 · OpenAI Q1 마진 -122% · 버티컬 ARR 배수 67배 · API 단가 급락 지속",
  },
  {
    axis: "agent_reliability", label: "에이전트 신뢰성", tone: "compete", nav: "signals",
    kw: ["에이전트", "agent", "osworld", "신뢰성", "자율", "할루시", "hallucinat", "computer use", "벤치마크", "benchmark", "agentic"],
    soWhat: "온디바이스 에이전트는 완전 자동화가 아니라 승인형·작업 로그·취소/복구 설계가 정답 — 자사 에이전트 UX 원칙으로 못박을 것",
    fallback: "Computer Use·Deep Research·Comet이 구매 대행까지 자동화 · 그러나 자율 성공률 OSWorld 66%서 정체·구조화 과제 1/3 실패",
  },
];

const AUTHORITATIVE = ["reuters", "bloomberg", "cnbc", "the information", "wsj", "ft", "financial times", "techcrunch", "the verge", "nvidia", "anthropic", "openai", "morgan stanley", "idc", "gartner", "stanford"];

const daysAgo = (d) => {
  const t = new Date(d + "T00:00:00Z").getTime();
  if (isNaN(t)) return 99;
  return Math.max(0, (Date.now() - t) / 86400000);
};
const recency = (d) => Math.exp(-daysAgo(d) / 14);                 // 2주 반감기
const sourceWeight = (s) => (AUTHORITATIVE.some(a => String(s || "").toLowerCase().includes(a)) ? 1.25 : 1.0);
const matchCount = (text, kw) => { const t = String(text).toLowerCase(); return kw.filter(k => t.includes(k.toLowerCase())).length; };

// 개조식 변환: 마침표 제거(여러 문장은 ' · '로 연결) + 정중어/서술 어미 제거 → 명사형 종결
const GAEJO_ENDINGS = [
  [/했습니다$/, ""], [/하였습니다$/, ""], [/하였다$/, ""], [/했다$/, ""],
  [/됐습니다$/, "됨"], [/되었습니다$/, "됨"], [/됩니다$/, ""], [/되었다$/, "됨"], [/됐다$/, "됨"],
  [/입니다$/, ""], [/합니다$/, ""], [/습니다$/, ""], [/한다$/, ""], [/된다$/, "됨"], [/이다$/, ""],
];
function gaejosik(s) {
  if (!s) return s;
  const parts = String(s).replace(/\s+/g, " ").trim()
    .split(/\.(?:\s+|$)/).map(x => x.trim()).filter(Boolean);
  const strip = (c) => {
    let x = c.trim();
    for (const [re, rep] of GAEJO_ENDINGS) { if (re.test(x)) { x = x.replace(re, rep); break; } }
    return x.replace(/[ ·\-—:,]+$/, "").trim();
  };
  return parts.map(strip).filter(Boolean).join(" · ");
}

async function main() {
  let articles = [];
  try { articles = (JSON.parse(await readFile("news.json", "utf8")).articles || []); } catch { articles = []; }

  // 각 (기사,축) 점수 계산
  const scored = [];
  for (const a of articles) {
    const text = `${a.title || ""} ${a.summary || ""} ${a.tag || ""} ${a.co || ""}`;
    for (const ax of AXES) {
      const mc = matchCount(text, ax.kw);
      if (mc <= 0) continue;
      const score = recency(a.date) * sourceWeight(a.source) * mc;
      scored.push({ axis: ax.axis, score, a });
    }
  }
  // 전역 최고점부터 그리디 배정 — 기사·축 중복 금지(MECE)
  scored.sort((x, y) => y.score - x.score);
  const usedUrl = new Set(), pickByAxis = {};
  for (const s of scored) {
    if (pickByAxis[s.axis]) continue;
    if (usedUrl.has(s.a.url)) continue;
    pickByAxis[s.axis] = s; usedUrl.add(s.a.url);
  }
  const maxScore = scored.length ? scored[0].score : 1;

  const cards = AXES.map(ax => {
    const p = pickByAxis[ax.axis];
    if (p) {
      const a = p.a;
      return {
        axis: ax.axis, axisLabel: ax.label, tone: ax.tone, nav: ax.nav,
        headline: gaejosik(a.title),
        soWhat: ax.soWhat,
        evidence: [{ title: a.title, date: a.date, source: a.source, url: a.url }],
        score: Math.round(Math.min(p.score / maxScore, 1) * 100),
        live: true,
        updatedAt: a.date,
      };
    }
    // 폴백(매칭 기사 없음)
    return {
      axis: ax.axis, axisLabel: ax.label, tone: ax.tone, nav: ax.nav,
      headline: gaejosik(ax.fallback), soWhat: ax.soWhat, evidence: [], score: 40, live: false,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
  });

  const out = { generatedAt: new Date().toISOString(), engine: "rules", cards };
  await writeFile("insights.json", JSON.stringify(out) + "\n");
  console.log(`Wrote insights.json — ${cards.filter(c => c.live).length}/4 live cards (engine: rules)`);
  cards.forEach(c => console.log(`  [${c.axisLabel}] score ${c.score}${c.live ? "" : " (fallback)"}: ${c.headline.slice(0, 50)}`));
}

main().catch(e => { console.error(e); process.exit(0); });
