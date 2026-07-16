#!/usr/bin/env node
/* ============================================================
   startup-radar.mjs — 스타트업 레이더·스코어카드·기회 메모 생성기
   입력: news.json (+ 기존 radar.json)  →  출력: radar.json

   - 주간(월요일 또는 7일 경과 시) 글로벌 AI 스타트업 3~5개 큐레이션.
     한국·중국 본사 기업 제외 — 글로벌(미국·유럽·기타) 중심.
   - 4축 자동 스코어(각 1~5): attach(서비스 부착 가능성)·
     enterprise(기업용 확장성)·partner(파트너십 용이성)·
     acquire(인수 용이성). 합계 12점 이상 → '즉시 검토'.
   - 비즈니스 맥락 라벨: [파트너십 기회]/[인수 후보] 자동 부여.
   - 월초(1~2일) 또는 해당 월 메모 부재 시 '월간 기회 메모' 초안 생성.
   - ANTHROPIC_API_KEY 있으면 LLM, 없으면 후보 풀 기반 규칙 폴백.
   - 사명(삼성/MX/Galaxy) 미출력 — '글로벌 단말 제조사' 관점만.
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";

const KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = "claude-opus-4-8";
const BANNED = /삼성|samsung|갤럭시|galaxy|\bMX\b/gi;
const TODAY = new Date().toISOString().slice(0, 10);
const scrub = s => String(s || "").replace(BANNED, "글로벌 제조사").trim();
const clamp15 = n => Math.max(1, Math.min(5, Math.round(Number(n) || 3)));

// 한국·중국 본사 기업(제외 대상) — 큐레이션에서 하드 필터
const EXCLUDED = /deepseek|kling|kuaishou|hailuo|minimax|zhipu|moonshot|01\.?ai|baichuan|stepfun|sensetime|iflytek|baidu|alibaba|tencent|bytedance|naver|kakao|upstage|wrtn|liner|hyperclova/i;

// 글로벌 스타트업 후보 풀(정적 시드) — LLM·규칙 경로 공통의 선별 대상.
// region: HQ 소재. 뉴스에 등장하면 가점.
const POOL = [
  { name: "Perplexity", domain: "perplexity.ai", vertical: "검색·어시스턴트", region: "미국", base: "AI 검색·에이전트 브라우저(Comet) — 단말 기본 어시스턴트 대체 후보" },
  { name: "Mistral AI", domain: "mistral.ai", vertical: "파운데이션 모델", region: "프랑스", base: "유럽 대표 오픈모델 — 온디바이스급 경량 모델(Ministral) 보유" },
  { name: "ElevenLabs", domain: "elevenlabs.io", vertical: "음성 AI", region: "미국", base: "음성 합성·대화 최고 품질 — 단말 음성 UX 핵심 기술" },
  { name: "Runway", domain: "runwayml.com", vertical: "영상 생성", region: "미국", base: "생성 영상 선도 — 카메라·갤러리 편집 기능 접목 여지" },
  { name: "Sierra AI", domain: "sierra.ai", vertical: "고객 응대 에이전트", region: "미국", base: "기업 CS 에이전트 — 디바이스 케어·구독 서비스 접목" },
  { name: "Harvey", domain: "harvey.ai", vertical: "법률 AI", region: "미국", base: "법률 특화 — B2B 확장성 높음, 단말 직접 부착성 낮음" },
  { name: "Glean", domain: "glean.com", vertical: "사내 검색", region: "미국", base: "엔터프라이즈 검색 — B2B 단말 번들 제휴 여지" },
  { name: "Synthesia", domain: "synthesia.io", vertical: "영상 아바타", region: "영국", base: "기업용 아바타 영상 — 커뮤니케이션 앱 접목" },
  { name: "Together AI", domain: "together.ai", vertical: "AI 인프라", region: "미국", base: "오픈모델 서빙 인프라 — 클라우드 추론 원가 절감 파트너" },
  { name: "Writer", domain: "writer.com", vertical: "엔터프라이즈 LLM", region: "미국", base: "기업용 풀스택 LLM — B2B 문서·워크플로 접목" },
  { name: "Abridge", domain: "abridge.com", vertical: "의료 AI", region: "미국", base: "의료 대화 기록 — 헬스 기기·웨어러블 연계 여지" },
  { name: "Cursor (Anysphere)", domain: "cursor.com", vertical: "코딩 에이전트", region: "미국", base: "코딩 에이전트 최대 ARR — 개발자 생태계 자산" },
  { name: "Lovable", domain: "lovable.dev", vertical: "앱 생성", region: "스웨덴", base: "자연어 앱 빌더 — 앱 생태계 롱테일 확장" },
  { name: "Replit", domain: "replit.com", vertical: "코딩 플랫폼", region: "미국", base: "브라우저 개발 환경 — 교육·크리에이터 접점" },
  { name: "Suno", domain: "suno.com", vertical: "음악 생성", region: "미국", base: "음악 생성 대중화 — 미디어·크리에이터 기능 접목" },
  { name: "Hugging Face", domain: "huggingface.co", vertical: "모델 허브", region: "미국", base: "오픈모델 유통 허브 — 온디바이스 모델 소싱 채널" },
  { name: "Groq", domain: "groq.com", vertical: "추론 칩·클라우드", region: "미국", base: "초저지연 추론(LPU) — 클라우드 추론 단가·지연 절감" },
  { name: "Figure AI", domain: "figure.ai", vertical: "휴머노이드", region: "미국", base: "로봇 폼팩터 — 장기 신사업 옵션" },
  { name: "Black Forest Labs", domain: "bfl.ai", vertical: "이미지 생성", region: "독일", base: "FLUX 이미지 모델 — 카메라·편집 파이프라인 접목" },
  { name: "LangChain", domain: "langchain.com", vertical: "에이전트 프레임워크", region: "미국", base: "에이전트 오케스트레이션 표준 — 단말 에이전트 SDK 연계" },
];

const AXES_KO = { attach: "서비스 부착", enterprise: "기업 확장성", partner: "파트너십 용이", acquire: "인수 용이" };

function needWeekly(prev) {
  if (!prev || !prev.weekOf || !(prev.picks || []).length) return true;
  const age = (Date.now() - new Date(prev.weekOf + "T00:00:00Z").getTime()) / 86400000;
  return age >= 6.5 || new Date().getUTCDay() === 1 && age >= 1;
}
const monthOf = () => TODAY.slice(0, 7);
function needMemo(prev) {
  const has = (prev && prev.memos || []).some(m => m.month === monthOf());
  return !has && (new Date().getUTCDate() <= 2 || !(prev && (prev.memos || []).length));
}

function newsFor(articles, name) {
  const key = name.split(" ")[0].toLowerCase();
  return articles.filter(a => `${a.co || ""} ${a.title || ""}`.toLowerCase().includes(key)).slice(0, 2);
}

// ---- LLM 경로 ----------------------------------------------------------
const SYS = "당신은 글로벌 스마트폰·온디바이스 AI 기기 제조사의 신사업·투자 전략 분석가입니다. 특정 기업명(삼성, 갤럭시, MX, 사업부 등)은 절대 언급하지 않습니다. 한국어 개조식으로, 근거 기반으로 평가합니다.";

function radarPrompt(articles) {
  const pool = POOL.map((p, i) => `[${i}] ${p.name} (${p.region}·${p.vertical}) — ${p.base}`).join("\n");
  const news = articles.slice(0, 25).map(a => `- (${a.date}) ${a.co || "-"}: ${a.title}`).join("\n");
  return `글로벌 AI 스타트업 후보 풀과 최근 뉴스입니다. 이번 주 '스타트업 레이더'로 4개를 선정하세요. 한국·중국 기업은 절대 포함하지 마세요.

[후보 풀]
${pool}

[최근 뉴스]
${news}

각 선정 기업(JSON):
- poolIdx: 후보 풀 인덱스
- why: 최근 시장 시그널 기반 선정 이유(1~2문장, 개조식)
- partnership: 단말 제조사 관점 파트너십/인수 실현 가능성 분석(2문장 — 접근 방식, 리스크)
- scores: {attach(서비스 부착 가능성: 단말 기능으로 통합 용이성), enterprise(기업용 확장성), partner(파트너십 용이성: 기존 빅테크 종속·독점 계약 여부 감안), acquire(인수 용이성: 밸류에이션·매각 가능성 감안)} 각 1~5 정수

선정 기준: 최근 뉴스에 신호가 있는 기업 우선, 버티컬 중복 최소화.`;
}

async function llmRadar(articles) {
  if (!KEY) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL, max_tokens: 2500, system: SYS,
        messages: [{ role: "user", content: radarPrompt(articles) }],
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: {
                picks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      poolIdx: { type: "integer" }, why: { type: "string" }, partnership: { type: "string" },
                      scores: {
                        type: "object",
                        properties: { attach: { type: "integer" }, enterprise: { type: "integer" }, partner: { type: "integer" }, acquire: { type: "integer" } },
                        required: ["attach", "enterprise", "partner", "acquire"], additionalProperties: false,
                      },
                    },
                    required: ["poolIdx", "why", "partnership", "scores"], additionalProperties: false,
                  },
                },
              },
              required: ["picks"], additionalProperties: false,
            },
          },
        },
      }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status + " " + (await res.text()).slice(0, 120));
    const j = await res.json();
    if (j.stop_reason === "refusal") throw new Error("refusal");
    const parsed = JSON.parse((j.content || []).find(b => b.type === "text").text);
    const picks = (parsed.picks || []).map(p => finishPick(p, articles)).filter(Boolean).slice(0, 5);
    if (picks.length < 3) throw new Error("too few picks");
    return { engine: "llm", picks };
  } catch (e) {
    console.warn(`[radar:llm] ${e.message} → rules fallback`);
    return null;
  }
}

function finishPick(p, articles) {
  const base = POOL[p.poolIdx];
  if (!base || EXCLUDED.test(base.name)) return null;
  const scores = { attach: clamp15(p.scores.attach), enterprise: clamp15(p.scores.enterprise), partner: clamp15(p.scores.partner), acquire: clamp15(p.scores.acquire) };
  const total = scores.attach + scores.enterprise + scores.partner + scores.acquire;
  const labels = [];
  if (scores.partner >= 4) labels.push("파트너십 기회");
  if (scores.acquire >= 4) labels.push("인수 후보");
  if (!labels.length) labels.push("모니터링");
  return {
    name: base.name, domain: base.domain, vertical: base.vertical, region: base.region,
    why: scrub(p.why), partnership: scrub(p.partnership),
    scores, total, urgent: total >= 12,
    labels,
    evidence: newsFor(articles, base.name).map(a => ({ title: a.title, date: a.date, source: a.source, url: a.url })),
  };
}

// ---- 규칙 폴백: 뉴스 언급 빈도 기반 상위 4곳, 보수적 스코어 -----------------
function ruleRadar(articles) {
  const scored = POOL.map((p, i) => {
    const hits = newsFor(articles, p.name);
    return { i, p, s: hits.length * 2 + (p.region === "미국" ? 0.5 : 0.7) };
  }).sort((a, b) => b.s - a.s).slice(0, 4);
  const DEFAULTS = { "검색·어시스턴트": [5, 3, 2, 2], "파운데이션 모델": [4, 4, 4, 2], "음성 AI": [5, 4, 4, 3], "영상 생성": [4, 3, 3, 3], "고객 응대 에이전트": [2, 5, 3, 2], "모델 허브": [3, 4, 4, 2] };
  return {
    engine: "rules",
    picks: scored.map(({ p }) => {
      const [attach, enterprise, partner, acquire] = DEFAULTS[p.vertical] || [3, 3, 3, 3];
      const scores = { attach, enterprise, partner, acquire };
      const total = attach + enterprise + partner + acquire;
      const labels = [];
      if (partner >= 4) labels.push("파트너십 기회");
      if (acquire >= 4) labels.push("인수 후보");
      if (!labels.length) labels.push("모니터링");
      return {
        name: p.name, domain: p.domain, vertical: p.vertical, region: p.region,
        why: p.base, partnership: "상세 분석은 LLM 갱신 대기 — 최근 보도·자금 조달 흐름 기준 예비 평가",
        scores, total, urgent: total >= 12, labels,
        evidence: newsFor(articles, p.name).map(a => ({ title: a.title, date: a.date, source: a.source, url: a.url })),
      };
    }),
  };
}

// ---- 월간 기회 메모 ------------------------------------------------------
const MEMO_SYS = SYS;
function memoPrompt(picks, articles) {
  const pk = picks.map(p => `- ${p.name}(${p.vertical}, ${p.region}) 총점 ${p.total}/20 [${p.labels.join("·")}] — ${p.why}`).join("\n");
  const news = articles.slice(0, 15).map(a => `- (${a.date}) ${a.title}`).join("\n");
  return `이번 달 스타트업 레이더 결과와 최근 뉴스를 바탕으로 '월간 신사업 기회 메모' 초안 1건을 작성하세요.

[레이더]
${pk}

[최근 뉴스]
${news}

출력(JSON):
- title: 메모 제목(기회 영역 중심, 25자 내외)
- thesis: 핵심 논지 — 왜 지금 이 기회인가(2~3문장, 개조식)
- structure: 제안 사업 구조 — 파트너십/투자/인수 중 권장 경로와 이유(2문장)
- targets: 우선 접촉 대상 기업 1~3곳과 각각의 접근 각도(배열, 각 1문장)
- risks: 핵심 리스크 2가지(배열)
- next: 다음 30일 실행 항목 2가지(배열)`;
}

async function llmMemo(picks, articles) {
  if (!KEY || !picks.length) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL, max_tokens: 1500, system: MEMO_SYS,
        messages: [{ role: "user", content: memoPrompt(picks, articles) }],
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: {
                title: { type: "string" }, thesis: { type: "string" }, structure: { type: "string" },
                targets: { type: "array", items: { type: "string" } },
                risks: { type: "array", items: { type: "string" } },
                next: { type: "array", items: { type: "string" } },
              },
              required: ["title", "thesis", "structure", "targets", "risks", "next"], additionalProperties: false,
            },
          },
        },
      }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    if (j.stop_reason === "refusal") throw new Error("refusal");
    const m = JSON.parse((j.content || []).find(b => b.type === "text").text);
    return {
      month: monthOf(), createdAt: TODAY, engine: "llm",
      title: scrub(m.title), thesis: scrub(m.thesis), structure: scrub(m.structure),
      targets: (m.targets || []).map(scrub).slice(0, 3),
      risks: (m.risks || []).map(scrub).slice(0, 3),
      next: (m.next || []).map(scrub).slice(0, 3),
    };
  } catch (e) {
    console.warn(`[memo:llm] ${e.message} → rules fallback`);
    return null;
  }
}

function ruleMemo(picks) {
  const top = picks.filter(p => p.urgent);
  const names = (top.length ? top : picks).slice(0, 3).map(p => p.name).join(" · ");
  return {
    month: monthOf(), createdAt: TODAY, engine: "rules",
    title: `${monthOf().replace("-", ".")} 기회 메모 — 레이더 상위 후보 검토`,
    thesis: "이번 주기 레이더 상위 기업의 시장 신호가 강함 — 파트너십 우선 검토 후 지분 투자 병행 옵션 유효",
    structure: "1단계 기능 제휴(부착 가능성 검증) → 2단계 전략 투자 — 초기 인수 접근은 밸류에이션 부담으로 비권장",
    targets: [`우선 대상: ${names}`],
    risks: ["빅테크 독점 계약에 따른 제휴 차단 가능성", "밸류에이션 급등으로 인수 창구 축소"],
    next: ["대상 기업 기술·계약 실사 착수", "차기 레이더 갱신 시 스코어 변화 추적"],
  };
}

// ---- main ---------------------------------------------------------------
async function main() {
  let articles = [];
  try { articles = (JSON.parse(await readFile("news.json", "utf8")).articles || []).filter(a => !EXCLUDED.test(`${a.co || ""} ${a.title || ""}`)); } catch {}

  let prev = null;
  try { prev = JSON.parse(await readFile("radar.json", "utf8")); } catch {}

  let picks = prev && prev.picks || [], weekOf = prev && prev.weekOf, engine = prev && prev.engine || "rules";
  if (needWeekly(prev) || engine === "rules") {
    const r = (await llmRadar(articles)) || ruleRadar(articles);
    // LLM 실패 시 기존 LLM 결과가 있으면 유지(품질 후퇴 방지)
    if (r.engine === "llm" || !(picks.length && engine === "llm")) { picks = r.picks; engine = r.engine; weekOf = TODAY; }
  }

  let memos = (prev && prev.memos || []).slice(0, 6);
  if (needMemo(prev)) {
    const m = (await llmMemo(picks, articles)) || ruleMemo(picks);
    memos = [m, ...memos.filter(x => x.month !== m.month)].slice(0, 6);
  }

  const out = { generatedAt: new Date().toISOString(), weekOf, engine, picks, memos };
  await writeFile("radar.json", JSON.stringify(out) + "\n");
  console.log(`Wrote radar.json — ${picks.length} picks (engine: ${engine}, weekOf: ${weekOf}), ${memos.length} memo(s)`);
  picks.forEach(p => console.log(`  ${p.name} ${p.total}/20 [${p.labels.join("·")}]${p.urgent ? " ★즉시검토" : ""}`));
}

main().catch(e => { console.error(e); process.exit(0); });
