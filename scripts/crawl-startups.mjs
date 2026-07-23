#!/usr/bin/env node
/* ============================================================
   crawl-startups.mjs — 스타트업 2계층 전략 분석(대: 파트너십 / 소: 인수·투자)
   출력: startups.json { generatedAt, weekOf, engine, large[], small[] }

   MECE 2계층(한국·중국 본사 기업 제외 — 글로벌 중심):
   - large  (밸류 ≥ $10B): 비즈니스 모델·수익 구조·파트너십 관점
            {name, domain, vertical, val, businessModel, revenue, partnership, label, latest}
   - small  (초기·중소): 업체 개요·정량 지표(펀딩/밸류)·인수/투자 관점
            {name, domain, vertical, stage, funding, overview, acqAngle, label, latest}

   대상 풀: data.js cat:"startup" + 글로벌 얼리스테이지 시드 풀.
   각 사 Google News 최신 기사 크롤 + LLM 관점 분석(주 1회).
   LLM 실패 시 시드 베이스라인 유지 — 죽은 데이터 방지.
   사이트에는 사명(삼성/MX/갤럭시) 미표기 — '단말 제조사' 관점만.
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";
import { llmJSON } from "./llm.mjs";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TODAY = new Date().toISOString().slice(0, 10);
const BANNED = /삼성|samsung|갤럭시|galaxy|\bMX\b/gi;
const scrub = s => String(s || "").replace(BANNED, "글로벌 제조사").trim();
const EXCLUDED = /deepseek|kling|kuaishou|hailuo|minimax|zhipu|moonshot|01\.?ai|baichuan|stepfun|sensetime|iflytek|baidu|alibaba|tencent|bytedance|naver|kakao|upstage|wrtn|hyperclova/i;
const LABELS_L = ["파트너십 기회", "전략 제휴", "탑재 후보", "모니터링"];
const LABELS_S = ["인수 후보", "투자 검토", "기술 감시", "모니터링"];

// ── 대형(밸류 ≥ $10B) — 비즈니스 모델·수익구조 시드(플레인) ──
const LARGE = [
  { name: "Databricks", domain: "databricks.com", vertical: "데이터·AI 플랫폼", val: "$134B", bm: "데이터 레이크하우스 SaaS — 컴퓨트 소비량(DBU)·플랫폼 구독으로 과금", rev: "ARR $30억+ 추정, 엔터프라이즈 데이터·AI 워크로드 확대", part: "온디바이스 개인화 데이터 파이프라인·MLOps 백엔드 제휴 각도" },
  { name: "Cursor", domain: "cursor.com", vertical: "코딩 에이전트", val: "$60B", bm: "AI 코딩 IDE 구독($20/월)+사용량, 개발자 시트 기반 수익", rev: "코딩 에이전트 최대 ARR($4B 추정), 개발 생태계 장악", part: "단말 SDK·개발자 도구 제휴 — 인수는 밸류 부담 과다" },
  { name: "Perplexity", domain: "perplexity.ai", vertical: "검색·어시스턴트", val: "$20B", bm: "광고 없는 구독(Free/Pro $20·Max $200/월)+에이전트 사용량 크레딧 과금", rev: "ARR ~$4.5~5억(전년比 335%↑), MAU 1억+", part: "단말 기본 어시스턴트 탑재 최우선 제휴 후보 — 검색 대체 UX" },
  { name: "Mistral AI", domain: "mistral.ai", vertical: "파운데이션 모델", val: "$20B", bm: "오픈 가중치 무료+엔터프라이즈 라이선스·API 사용량 과금", rev: "유럽 대표 오픈모델, Ministral 온디바이스급 경량 모델", part: "온디바이스 탑재 모델 멀티소싱 후보 — 개방성·주권 강점" },
  { name: "Sierra AI", domain: "sierra.ai", vertical: "고객 응대 에이전트", val: "$15B+", bm: "기업 CS 에이전트 — 해결 건당 성과 기반 과금(outcome pricing)", rev: "엔터프라이즈 CS 자동화 급성장", part: "단말 케어·구독 CS 자동화 제휴 — 성과형 과금 모델 참고" },
  { name: "Scale AI", domain: "scale.com", vertical: "데이터 라벨링·평가", val: "$14B", bm: "AI 학습 데이터 라벨링·모델 평가 서비스 — 프로젝트·시트 과금", rev: "빅테크·정부 데이터 파이프라인 핵심 공급", part: "온디바이스 모델 평가·데이터 품질 백엔드 제휴" },
  { name: "ElevenLabs", domain: "elevenlabs.io", vertical: "음성 AI", val: "$11B", bm: "음성 합성 구독+API 문자당 과금, 크리에이터·기업 이중 채널", rev: "음성 생성 품질 선두, API 매출 급성장", part: "단말 음성 UX(TTS·더빙·통역) 핵심 기술 제휴/인수 후보" },
  { name: "Harvey", domain: "harvey.ai", vertical: "법률 AI", val: "$11B", bm: "로펌·기업 법무 특화 SaaS — 좌석당 구독", rev: "법률 버티컬 선두, B2B 확장성 높음", part: "단말 직접 부착성 낮음 — 서비스 제휴 위주" },
];

// ── 소형/초기(< $10B or 얼리스테이지) — 개요·정량·인수/투자 관점 시드 ──
const SMALL = [
  // data.js 소형
  { name: "Replit", domain: "replit.com", vertical: "코딩 플랫폼", stage: "$9B", funding: "밸류 $9B", ov: "브라우저 개발환경+AI 에이전트, 교육·크리에이터 접점", acq: "개발자 온보딩·교육 생태계 확보 관점 투자 검토" },
  { name: "Glean", domain: "glean.com", vertical: "사내 검색", stage: "$7.2B", funding: "밸류 $7.2B", ov: "엔터프라이즈 검색·어시스턴트, B2B 지식 접근", acq: "B2B 단말 번들 제휴·전략 투자 각도" },
  { name: "Lovable", domain: "lovable.dev", vertical: "앱 생성", stage: "$6.6B", funding: "밸류 $6.6B", ov: "자연어 앱 빌더(스웨덴), 앱 생태계 롱테일 확장", acq: "스토어 생태계 활성화 관점 투자 검토" },
  { name: "Cohere", domain: "cohere.com", vertical: "엔터프라이즈 LLM", stage: "$5.5B", funding: "밸류 $5.5B·ARR ~$2.4억", ov: "소버린·기업용 LLM(캐나다), 온프레미스 배포 강점", acq: "온디바이스 경량 모델·보안 배포 기술 감시" },
  { name: "Suno", domain: "suno.com", vertical: "음악 생성", stage: "$5.4B", funding: "밸류 $5.4B", ov: "음악 생성 대중화, 미디어·크리에이터 기능", acq: "카메라·미디어 생성 기능 접목 관점 기술 감시" },
  { name: "Hugging Face", domain: "huggingface.co", vertical: "모델 허브", stage: "$4.5B", funding: "밸류 $4.5B", ov: "오픈모델 유통 허브, 온디바이스 모델 소싱 채널", acq: "온디바이스 모델 소싱·개발자 채널 전략 투자" },
  { name: "Runway", domain: "runwayml.com", vertical: "영상 생성", stage: "$4B", funding: "밸류 $4B", ov: "생성 영상 선도, 카메라·갤러리 편집 접목 여지", acq: "카메라 생성편집 기술 인수/제휴 후보" },
  { name: "Together AI", domain: "together.ai", vertical: "AI 인프라", stage: "$3.3B", funding: "밸류 $3.3B", ov: "오픈모델 서빙 인프라, 추론 원가 절감", acq: "클라우드 추론 원가 파트너·전략 투자" },
  { name: "Abridge", domain: "abridge.com", vertical: "의료 AI", stage: "$2.75B", funding: "밸류 $2.75B", ov: "의료 대화 기록·요약, 헬스 기기 연계 여지", acq: "웨어러블 헬스 서비스 접목 관점 투자 검토" },
  { name: "Synthesia", domain: "synthesia.io", vertical: "영상 아바타", stage: "$2.1B", funding: "밸류 $2.1B", ov: "기업용 아바타 영상(영국), 커뮤니케이션 앱 접목", acq: "커뮤니케이션 기능 접목 기술 감시" },
  { name: "Writer", domain: "writer.com", vertical: "엔터프라이즈 LLM", stage: "$1.9B", funding: "밸류 $1.9B", ov: "기업용 풀스택 LLM, 문서·워크플로 접목", acq: "B2B 문서 워크플로 제휴 관점" },
  { name: "Stability AI", domain: "stability.ai", vertical: "이미지 생성", stage: "$1B", funding: "밸류 $1B", ov: "오픈 이미지 생성 모델, 온디바이스 경량화 여지", acq: "온디바이스 이미지 생성 기술 감시" },
  // 글로벌 얼리스테이지 풀(비상장·시드~시리즈)
  { name: "MultiOn", domain: "multion.ai", vertical: "AI 에이전트", stage: "시드", funding: "시드 $5M (2024.1)", ov: "웹에서 사용자 대신 실제 행동 수행하는 AI 에이전트(미국)", acq: "온디바이스 에이전트 실행엔진 초기 인수/투자 후보" },
  { name: "Leonardo.Ai", domain: "leonardo.ai", vertical: "이미지·영상 생성", stage: "시리즈A", funding: "Series A $31M (2023.12)", ov: "이미지·비디오 생성 크리에이티브 스위트(호주)", acq: "카메라·갤러리 생성편집 기술 인수 후보" },
  { name: "Music AI (Moises)", domain: "music.ai", vertical: "오디오 AI", stage: "시리즈A", funding: "Series A $40M (2025.1)", ov: "5,000만+ 크리에이터 윤리적 AI 오디오 플랫폼·API(미국)", acq: "음성·오디오 편집 기능 접목 투자 검토" },
  { name: "Parasail", domain: "parasail.io", vertical: "AI 추론 클라우드", stage: "시리즈A", funding: "Series A $32M (2026.4)", ov: "토큰당 과금 추론 '슈퍼클라우드', 개발자 자원 제어(미국)", acq: "클라우드 추론 원가 절감 전략 투자" },
  { name: "Mirai", domain: "getmirai.co", vertical: "온디바이스 추론", stage: "시드", funding: "시드 $10M (2026.2)", ov: "모든 아키텍처 모델을 기기에 직접 배포·구동하는 온디바이스 추론 엔진(미국)", acq: "온디바이스 AI 전략 직결 — 최우선 인수/투자 후보" },
  { name: "Reality Defender", domain: "realitydefender.com", vertical: "딥페이크 탐지", stage: "전략투자", funding: "전략 라운드 (2025.4)", ov: "실시간 멀티모달 딥페이크·AI 생성물 탐지 플랫폼(미국)", acq: "생성 AI 확대에 따른 방어형 탐지 기술 인수 후보" },
  { name: "AI21 Labs", domain: "ai21.com", vertical: "엔터프라이즈 LLM", stage: "시리즈C", funding: "Series C $208M (2023.11)", ov: "기업용 고급 언어 AI 모델(이스라엘)", acq: "온디바이스 경량 LLM·추론 최적화 기술 감시" },
  { name: "1X Technologies", domain: "1x.tech", vertical: "휴머노이드 로봇", stage: "시리즈B", funding: "Series B $100M (2024.1)", ov: "가정용 휴머노이드 로봇 개발(노르웨이)", acq: "신규 폼팩터(로봇) 장기 옵션 — 기술 감시" },
  { name: "Dyna Robotics", domain: "dyna.co", vertical: "로봇 파운데이션", stage: "시리즈A", funding: "Series A $120M (2025.9)", ov: "상용급 범용 로봇용 로보틱 파운데이션 모델(미국)", acq: "피지컬 AI 신폼팩터 관점 투자 검토" },
  { name: "OpusClip", domain: "opus.pro", vertical: "영상 편집", stage: "시리즈A", funding: "Series A $30M", ov: "긴 영상을 AI로 짧은 바이럴 클립 변환(미국)", acq: "카메라·미디어 자동편집 기능 접목 기술 감시" },
  { name: "Unbabel", domain: "unbabel.com", vertical: "AI 번역", stage: "시리즈B+", funding: "Series B $23M", ov: "기업용 신뢰 가능 AI 번역 서비스(포르투갈)", acq: "통역·번역 UX 기술 감시" },
];

const decode = s => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tagOf = (xml, n) => { const m = xml.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`, "i")); return m ? m[1] : ""; };

async function latest(name) {
  try {
    const q = `"${name.replace(/\s*\(.*\)/, "")}" AI when:21d`;
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const xml = await res.text();
    const m = /<item>([\s\S]*?)<\/item>/.exec(xml);
    if (!m) return null;
    const it = m[1];
    const d = new Date(tagOf(it, "pubDate"));
    return { title: decode(tagOf(it, "title")).replace(/ - [^-]*$/, "").trim(), url: decode(tagOf(it, "link")), source: decode(tagOf(it, "source")) || "Google News", date: isNaN(d) ? TODAY : d.toISOString().slice(0, 10) };
  } catch { return null; }
}

async function enrichLarge(rows) {
  const list = rows.map((s, i) => `[${i}] ${s.name} (${s.vertical}, ${s.val}) — BM: ${s.bm}${s.latest ? ` / 최신: ${s.latest.title}` : ""}`).join("\n");
  const r = await llmJSON({
    system: "당신은 글로벌 스마트폰 제조사 무선사업부의 신사업 전략 분석가입니다. 대형 AI 업체를 '비즈니스 모델·수익 구조·파트너십' 관점에서 평가합니다. 특정 기업명(삼성·갤럭시·MX)은 출력 금지. 한국어 개조식. JSON.",
    user: `다음 대형 AI 업체를 단말 제조사 파트너십 관점에서 평가해 rows로 출력:\n${list}\n\n각 {idx, revenue(수익 구조·규모 1문장), partnership(파트너십 각도 1~2문장 — 탑재/제휴/공동개발 중 권장), label(${JSON.stringify(LABELS_L)} 중 1개)}. 근거 없는 수치 생성 금지.`,
    maxTokens: 2600,
    schema: { type: "object", properties: { rows: { type: "array", items: { type: "object", properties: { idx: { type: "integer" }, revenue: { type: "string" }, partnership: { type: "string" }, label: { type: "string" } }, required: ["idx", "revenue", "partnership", "label"], additionalProperties: false } } }, required: ["rows"], additionalProperties: false },
  });
  if (!r) return null;
  for (const row of r.data.rows || []) { const s = rows[row.idx]; if (s) { s.revenue = scrub(row.revenue); s.partnership = scrub(row.partnership); s.label = LABELS_L.includes(row.label) ? row.label : "모니터링"; } }
  return r.engine;
}

async function enrichSmall(rows) {
  const list = rows.map((s, i) => `[${i}] ${s.name} (${s.vertical}, ${s.funding}) — ${s.ov}${s.latest ? ` / 최신: ${s.latest.title}` : ""}`).join("\n");
  const r = await llmJSON({
    system: "당신은 글로벌 스마트폰 제조사 무선사업부의 신사업·투자 전략 분석가입니다. 초기·중소 AI 업체를 '인수·투자' 관점에서 평가합니다. 특정 기업명(삼성·갤럭시·MX)은 출력 금지. 한국어 개조식. JSON.",
    user: `다음 초기·중소 AI 업체를 단말 제조사 인수/투자 관점에서 평가해 rows로 출력:\n${list}\n\n각 {idx, acqAngle(인수/투자 각도 1~2문장 — 온디바이스·단말서비스·신폼팩터 접목 각도와 권장 경로), label(${JSON.stringify(LABELS_S)} 중 1개)}. 근거 없는 수치 생성 금지.`,
    maxTokens: 2600,
    schema: { type: "object", properties: { rows: { type: "array", items: { type: "object", properties: { idx: { type: "integer" }, acqAngle: { type: "string" }, label: { type: "string" } }, required: ["idx", "acqAngle", "label"], additionalProperties: false } } }, required: ["rows"], additionalProperties: false },
  });
  if (!r) return null;
  for (const row of r.data.rows || []) { const s = rows[row.idx]; if (s) { s.acqAngle = scrub(row.acqAngle); s.label = LABELS_S.includes(row.label) ? row.label : "모니터링"; } }
  return r.engine;
}

async function main() {
  const large = LARGE.filter(s => !EXCLUDED.test(s.name)).map(s => ({ name: s.name, domain: s.domain, vertical: s.vertical, val: s.val, businessModel: s.bm, revenue: s.rev, partnership: s.part, label: "모니터링" }));
  const small = SMALL.filter(s => !EXCLUDED.test(s.name)).map(s => ({ name: s.name, domain: s.domain, vertical: s.vertical, stage: s.stage, funding: s.funding, overview: s.ov, acqAngle: s.acq, label: "모니터링" }));

  let prev = null;
  try { prev = JSON.parse(await readFile("startups.json", "utf8")); } catch {}
  const age = prev && prev.weekOf ? (Date.now() - new Date(prev.weekOf + "T00:00:00Z").getTime()) / 86400000 : 99;
  const staleShape = !prev || !Array.isArray(prev.large);   // 구 스키마면 강제 갱신
  if (age < 6.5 && !staleShape && prev.engine !== "rules") { console.log(`[startups] fresh (${prev.weekOf}, ${prev.engine}) — skip`); return; }

  for (const s of [...large, ...small]) { const n = await latest(s.name); if (n) s.latest = n; }
  console.log(`[startups] large ${large.length} · small ${small.length}, latest news attached`);

  const e1 = await enrichLarge(large);
  const e2 = await enrichSmall(small);
  const engine = e1 || e2 || "rules";

  const out = { generatedAt: new Date().toISOString(), weekOf: TODAY, engine, large, small };
  await writeFile("startups.json", JSON.stringify(out) + "\n");
  console.log(`Wrote startups.json — large ${large.length} · small ${small.length} (engine: ${engine})`);
}

main().catch(e => { console.error(e); process.exit(0); });
