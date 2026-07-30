#!/usr/bin/env node
/* ============================================================
   build-insights.mjs — 크롤 인사이트 종합 '오늘의 톱라인' 생성기 (결정론적)
   입력: news.json  →  출력: insights.json
   - 6개 전략 축에 크롤 기사를 매핑·점수화(최근성×출처신뢰도×주제적합도)하고,
     축마다 다수의 근거 기사를 모아 크롤 신호를 '종합'한다:
       · FACT      = 대표 기사 헤드라인(원문 링크)
       · signalDigest = 근거 건수 + 반복 신호 키워드 + 원문에서 추출한 핵심 수치
                        (매일 크롤 결과가 바뀌면 함께 갱신 — 고정 문구 아님)
       · IMPLICATION = 데이터에서 정리한 신호 + 이를 읽는 전략 렌즈
       · DECISION   = 권고 실행
   - 시사점 텍스트를 매일 동일하게 박아 넣던 '규칙 기반'에서, 실제 크롤 근거
     (반복 키워드·추출 수치·복수 출처)를 집계해 갱신되는 '크롤 종합'으로 전환.
   - 근거 기사가 없으면 큐레이션 기준선으로 폴백 → 항상 6장 보장(MECE).
   - 외부 호출/ API 키 없음. 모든 수치·키워드는 원문 발췌(무-할루시네이션).
   - 사명(삼성/MX/Galaxy) 미출력 — '단말 사업/온디바이스' 관점만.
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";
import { isExcludedText } from "./news-policy.mjs";

// 각 축: strong = 그 주제를 명확히 규정하는 핵심 키워드(1개만 맞아도 주제 성립),
//        weak   = 보조 키워드(단독으로는 우연의 일치일 수 있어 2개 이상 필요).
// 근거 기사↔시사점 불일치(예: 사무실 문화 기사 → AI 비서 결론) 방지를 위해
// "strong 1개 이상 OR (strong+weak) 2개 이상"을 만족해야만 카드의 근거로 채택.
const AXES = [
  {
    axis: "assistant_layer", label: "어시스턴트 레이어", tone: "warn", nav: "bigtech",
    strong: ["assistant", "어시스턴트", "ai 비서", "siri", "gemini", "copilot", "comet", "perplexity", "chatbot", "챗봇"],
    weak: ["비서", "검색"],
    rootCause: "AI 비서가 단말의 입력·앱 트래픽·데이터를 좌우하는 'OS 위의 새 관문'이 됨 → 비서를 쥔 쪽이 단말 경험·수익 동선을 통제",
    soWhat: "폰의 '기본 비서' 자리가 단말 차별화의 핵심 전장 — 기본 어시스턴트 노선(파트너 심화 vs 자체 vs 멀티)을 지금 확정해야 함",
    action: "기본 어시스턴트 노선(파트너 심화 vs 자체 vs 멀티) 의사결정 안건화 — 후보 업체 제휴 조건 비교표 작성",
    fallback: "Gemini 앱 MAU 900M+ · Apple, Siri를 'Siri AI'로 재설계 · Perplexity Comet 전면 무료 전환",
  },
  {
    axis: "ondevice_spec", label: "온디바이스 스펙", tone: "signal", nav: "bigtech",
    strong: ["온디바이스", "on-device", "npu", "ai pc", "snapdragon", "tops", "blackwell", "엣지 ai", "edge ai"],
    weak: ["메모리", "memory", "soc", "칩", "chip", "노트북", "스마트폰", "폰"],
    rootCause: "고급 AI 추론에 메모리·NPU가 필수 → AI 성능이 하드웨어 사양에 직접 종속되고 구형 단말은 구조적으로 배제됨",
    soWhat: "AI 기능 = 하드웨어 스펙 = 프리미엄 전환·교체수요 동력 — 메모리·NPU 사양 로드맵에 직결('AI 탑재=판매 증가' 단정은 금물)",
    action: "차기 플래그십 메모리·NPU 스펙을 AI 로드맵 역산으로 확정 — 부품 장기 공급 계약 조기 협상",
    fallback: "구형 단말은 메모리 한계로 온디바이스 AI 구동 곤란(고급 비서엔 12GB) · 생성형 AI 폰 2028년 70%(IDC)",
  },
  {
    axis: "monetization", label: "수익화", tone: "revenue", nav: "bizmodel",
    strong: ["구독", "arr", "단가", "무료화", "마진", "pricing", "valuation", "밸류에이션", "ipo", "monetiz", "수익화", "과금"],
    weak: ["매출", "가격", "토큰", "무료", "수익", "투자", "funding", "billion"],
    rootCause: "추론 단가가 3년 150배 급락 → 'AI 기능=무료' 압력이 커지며 '어디서 돈을 받는가'의 과금 모델 자체가 흔들림",
    soWhat: "온디바이스 AI 기능의 과금 노선(구독 유료화 vs 단말 가격 프리미엄 vs 커머스 수수료) 결정에 직접 영향 — API 단가 하락은 클라우드 기능 원가에 직결",
    action: "AI 기능 과금 노선(구독 vs 단말 프리미엄 vs 커머스) 시나리오별 손익 시뮬레이션 착수",
    fallback: "Perplexity 구독→광고·커머스 전환 · OpenAI Q1 마진 -122% · 버티컬 ARR 배수 67배 · API 단가 급락 지속",
  },
  {
    axis: "agent_reliability", label: "에이전트 신뢰성", tone: "compete", nav: "signals",
    strong: ["에이전트", "agent", "agentic", "osworld", "computer use", "할루시", "hallucinat", "자율 성공률"],
    weak: ["신뢰성", "자율", "벤치마크", "benchmark"],
    rootCause: "성능(capability)은 빠르게 오르지만 자율 신뢰성(reliability)이 못 따라감 → 완전 자동화 시 오작동·책임·복구 비용이 폭증",
    soWhat: "온디바이스 에이전트는 완전 자동화가 아니라 승인형·작업 로그·취소/복구 설계가 정답 — 자사 에이전트 UX 원칙으로 못박을 것",
    action: "자사 에이전트 UX 원칙(승인형·작업 로그·취소/복구) 설계 가이드로 문서화·전파",
    fallback: "Computer Use·Deep Research·Comet이 구매 대행까지 자동화 · 그러나 자율 성공률 OSWorld 66%서 정체·구조화 과제 1/3 실패",
  },
  {
    axis: "rival_devices", label: "경쟁 단말 동향", tone: "compete", nav: "bigtech",
    strong: ["iphone", "아이폰", "apple intelligence", "pixel", "픽셀", "hyperos", "xiaomi", "honor", "oppo", "vivo", "dimensity", "ray-ban", "quest", "vision pro", "스마트글라스", "smart glasses"],
    weak: ["siri", "snapdragon", "웨어러블", "wearable", "glasses"],
    rootCause: "경쟁 진영이 자체 모델·파트너십·전용 실리콘으로 단말 AI 경험을 선점 → 기본 비서·킬러 UX 표준을 먼저 굳히는 쪽이 교체수요를 흡수",
    soWhat: "경쟁 단말의 모델 탑재·비서 개편·실리콘 로드맵을 분기 단위로 추적 — 차별화 포인트(에이전트·카메라·기기 연속성)를 상대 로드맵 대비로 검증",
    action: "경쟁 단말 AI 기능 격차 분기 리포트 체계화 — 차별화 포인트 상대 로드맵 대비 검증",
    fallback: "Apple, Siri를 외부 모델로 재설계(Gemini 탑재) · 중국 제조사 온디바이스 AI 고속 추격 · 스마트글라스 등 신규 폼팩터 확전",
  },
  {
    axis: "model_partnership", label: "모델 파트너십·수직통합", tone: "signal", nav: "overview",
    strong: ["파트너십", "partnership", "제휴", "bedrock", "azure", "독점 계약", "수직통합", "자체 칩", "asic", "인수", "m&a", "acquisition", "합병"],
    weak: ["탑재", "커스텀", "계약", "공급", "독점"],
    rootCause: "모델–클라우드–칩–단말이 지분·독점 계약으로 수직 결합 → 특정 모델 의존은 공급·가격·규제 리스크로 직결",
    soWhat: "단말 탑재 모델은 멀티소싱(2개사+)과 교체 가능한 추상화 레이어가 안전 — 특정 모델사 독점 종속 계약은 회피",
    action: "모델 멀티소싱(2개사+) 계약 구조와 교체 가능한 추상화 레이어 요구사항 확정",
    fallback: "Qualcomm, Modular 인수로 소프트웨어 스택 확보 · Apple 멀티 AI Extensions로 모델 선택 개방 · 모델–칩 수직통합 가속",
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
const hitList = (text, kw) => { const t = String(text).toLowerCase(); return (kw || []).filter(k => t.includes(k.toLowerCase())); };

// 개조식 변환: 마침표 제거(여러 문장은 ' · '로 연결) + 정중어/서술 어미 제거 → 명사형 종결
// 긴 패턴 우선(진행형 '~하고 있습니다' 등을 먼저 잡아야 함)
const GAEJO_ENDINGS = [
  [/하고 있습니다$/, ""], [/하고 있다$/, ""], [/고 있습니다$/, ""], [/고 있다$/, ""],
  [/되고 있습니다$/, "됨"], [/되고 있다$/, "됨"],
  [/하였습니다$/, ""], [/했습니다$/, ""], [/하였다$/, ""], [/했다$/, ""],
  [/되었습니다$/, "됨"], [/됐습니다$/, "됨"], [/됩니다$/, ""], [/되었다$/, "됨"], [/됐다$/, "됨"],
  [/입니다$/, ""], [/합니다$/, ""], [/습니다$/, ""], [/한다$/, ""], [/된다$/, "됨"], [/이다$/, ""],
];
function gaejosik(s) {
  if (!s) return s;
  let main = String(s).replace(/\s+/g, " ").trim();
  // 끝의 출처 표기(": WSJ", " - TechCrunch", "| Reuters")를 분리 후 · 로 재부착
  let src = "";
  const m = main.match(/\s*[:\-–—|]\s*([A-Za-z][\w .&'/-]{0,24})$/);
  if (m) { src = m[1].trim(); main = main.slice(0, m.index).trim(); }
  const strip = (c) => {
    let x = c.trim();
    for (const [re, rep] of GAEJO_ENDINGS) { if (re.test(x)) { x = x.replace(re, rep); break; } }
    return x.replace(/[ ·\-—:,]+$/, "").trim();
  };
  const parts = main.split(/\.(?:\s+|$)/).map(x => x.trim()).filter(Boolean).map(strip).filter(Boolean);
  let out = parts.join(" · ");
  if (src) out += (out ? " · " : "") + src;
  return out;
}

// ── 크롤 근거에서 정량 신호를 추출(무-할루시네이션: 원문 텍스트에 있는 토큰만) ──
// 예: "$3.66B", "11%", "900M MAU", "12GB", "150배", "2028년 70%"
const QUANT_RE = /(?:\$\s?\d[\d,.]*\s?(?:억|조|천만|만|billion|million|trillion|bn|B|M|K)?|\d[\d,.]*\s?(?:%|배|억|조|억원|조원|GB|TB|TOPS|MAU|DAU|bp|bps|억\s?달러|조\s?달러|billion|million|trillion|퍼센트)|\d{4}\s?년)/gi;
function extractQuantities(text) {
  const seen = new Set(), out = [];
  for (const m of String(text || "").matchAll(QUANT_RE)) {
    const raw = m[0].replace(/\s+/g, "").trim();
    // 연도 단독(2019~2035)만 있는 토큰은 노이즈 → 제외
    if (/^\d{4}년$/.test(raw)) continue;
    const key = raw.toLowerCase();
    if (raw.length < 2 || seen.has(key)) continue;
    seen.add(key); out.push(raw);
    if (out.length >= 4) break;
  }
  return out;
}

// 축에 매칭된 기사들에서 실제로 반복 등장한 키워드를 빈도순으로 — 그날의 '신호 집중' 신호.
function themeKeywords(entries, axis) {
  const freq = new Map();
  for (const e of entries) for (const k of e.matched) {
    const key = k.toLowerCase();
    freq.set(key, (freq.get(key) || 0) + 1);
  }
  return [...freq.entries()]
    // strong 키워드를 살짝 우대(주제 규정력이 큼)
    .map(([k, n]) => [k, n + (axis.strong.some(s => s.toLowerCase() === k) ? 0.5 : 0)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k]) => k);
}

async function main() {
  let articles = [];
  try { articles = (JSON.parse(await readFile("news.json", "utf8")).articles || []); } catch { articles = []; }
  articles = articles.filter(a => a.displayEligible !== false && a.summaryMode === "source-content-extractive" && !isExcludedText(`${a.title || ""} ${a.summary || ""}`));

  // 각 (기사,축) 점수 계산 — 근거 기사↔축 주제 정합성 게이트 적용
  const scored = [];
  for (const a of articles) {
    const text = `${a.title || ""} ${a.summary || ""} ${a.tag || ""} ${a.co || ""}`;
    for (const ax of AXES) {
      const strongHits = hitList(text, ax.strong);
      const weakHits = hitList(text, ax.weak);
      const total = strongHits.length + weakHits.length;
      // 정합성 게이트: strong 1개 이상 OR (strong+weak) 2개 이상이어야 근거로 채택
      // → 우연히 걸린 단일 보조 키워드로 무관한 시사점이 붙는 것을 차단
      if (!(strongHits.length >= 1 || total >= 2)) continue;
      // strong은 가중치 2배 — 주제 적합도를 점수에 반영
      const relevance = strongHits.length * 2 + weakHits.length;
      const score = recency(a.date) * sourceWeight(a.source) * relevance;
      scored.push({ axis: ax.axis, score, relevance, matched: [...strongHits, ...weakHits], a });
    }
  }
  // 축별로 매칭 기사를 점수순으로 그룹화 — 대표 기사(FACT)는 MECE로 유일 배정하되,
  // 신호 종합(digest)·복수 근거는 그 축에 매칭된 기사 전체에서 집계한다.
  scored.sort((x, y) => y.score - x.score);
  const byAxis = {};
  for (const s of scored) (byAxis[s.axis] = byAxis[s.axis] || []).push(s);
  // 대표 기사 MECE 배정: 전역 최고점부터 그리디, 기사 URL 중복 금지
  const usedUrl = new Set(), leadByAxis = {};
  for (const s of scored) {
    if (leadByAxis[s.axis]) continue;
    if (usedUrl.has(s.a.url)) continue;
    leadByAxis[s.axis] = s; usedUrl.add(s.a.url);
  }
  const maxScore = scored.length ? scored[0].score : 1;

  const cards = AXES.map(ax => {
    const lead = leadByAxis[ax.axis];
    const group = (byAxis[ax.axis] || []).slice(0, 6);     // 이 축의 상위 근거군(신호 종합용)
    if (lead) {
      const a = lead.a;
      // 복수 근거: 대표 기사 + 같은 축 상위 기사(URL 중복 제거) 최대 3건 → 근거의 폭을 보여줌
      const evRows = [];
      const evSeen = new Set();
      for (const s of [lead, ...group]) {
        const u = s.a.url;
        if (!u || evSeen.has(u)) continue;
        evSeen.add(u);
        evRows.push({ title: s.a.title, date: s.a.date, source: s.a.source, url: u });
        if (evRows.length >= 3) break;
      }
      // 크롤 종합 신호: 반복 키워드 + 원문에서 추출한 수치(둘 다 그날 크롤 결과에서 계산 → 갱신됨)
      const keywords = themeKeywords(group, ax);
      const quantSource = group.map(s => `${s.a.title || ""} ${s.a.summary || ""}`).join(" · ");
      const quantities = extractQuantities(quantSource);
      const digestParts = [`근거 ${evRows.length}건`];
      if (keywords.length) digestParts.push(`반복 신호: ${keywords.join(", ")}`);
      if (quantities.length) digestParts.push(`핵심 수치: ${quantities.join(", ")}`);
      const signalDigest = digestParts.join(" · ");
      // 신호 종합 근거(대표 외 보조 기사) — 원문 발췌 헤드라인으로 요약
      const signals = evRows.slice(1).map(e => ({ fact: gaejosik(e.title), source: e.source, date: e.date, url: e.url }));
      return {
        axis: ax.axis, axisLabel: ax.label, tone: ax.tone, nav: ax.nav,
        headline: gaejosik(a.title),
        signalDigest,                       // ← 크롤 근거에서 정리한 신호(매일 갱신)
        themeKeywords: keywords,
        quantities,
        signals,                            // ← 보조 근거(복수 출처)
        rootCause: ax.rootCause,
        soWhat: ax.soWhat,                  // ← 신호를 읽는 전략 렌즈
        action: ax.action,
        evidence: evRows,                   // ← 복수 근거(검증은 verify-pipeline이 수행)
        score: Math.round(Math.min(lead.score / maxScore, 1) * 100),
        scoreBasis: "상대 중요도 0~100(최신성×출처신뢰도×주제적합도, 당일 최고 카드=100)",
        matched: lead.matched,
        live: true,
        updatedAt: a.date,
      };
    }
    // 폴백(정합성 게이트를 통과한 근거 기사 없음) — 큐레이션된 자기완결 기준선
    return {
      axis: ax.axis, axisLabel: ax.label, tone: ax.tone, nav: ax.nav,
      headline: gaejosik(ax.fallback), signalDigest: "근거 매칭 대기 — 큐레이션 기준선",
      themeKeywords: [], quantities: [], signals: [],
      rootCause: ax.rootCause, soWhat: ax.soWhat, action: ax.action,
      evidence: [], score: null, scoreBasis: "근거 기사 매칭 대기(큐레이션 기준선 표시 중)", matched: [], live: false,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
  });

  const out = { generatedAt: new Date().toISOString(), engine: "crawl-synthesis", cards };
  await writeFile("insights.json", JSON.stringify(out) + "\n");
  console.log(`Wrote insights.json — ${cards.filter(c => c.live).length}/${AXES.length} live cards (engine: crawl-synthesis)`);
  cards.forEach(c => console.log(`  [${c.axisLabel}] score ${c.score}${c.live ? "" : " (fallback)"} · ${c.signalDigest} · ${c.headline.slice(0, 40)}`));
}

main().catch(e => { console.error(e); process.exit(1); });
