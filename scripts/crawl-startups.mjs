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
import { llmJSON, llmAvailable } from "./llm.mjs";
import { rotatingLocales, googleNewsUrl } from "./global-sources.mjs";
import { isExcludedText } from "./news-policy.mjs";
import { enrichSourceBatch, isContentBacked } from "./source-content.mjs";
import { loadDash } from "./load-dash.mjs";
import { canonicalizeStartupSnapshot } from "./company-identity.mjs";
import { bulletizeKorean } from "./korean-copy.mjs";
import { loadSuppressionRegistry } from "./suppression-registry.mjs";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TODAY = new Date().toISOString().slice(0, 10);
const FORCE_REFRESH = /^(1|true|yes)$/i.test(String(process.env.STARTUP_REFRESH_FORCE || ""));
const operationalCopy = /(?:수집|확인|분석|업데이트|준비)\s*중|신호\s*(?:없음|대기)|데이터\s*없음/i;
const scrub = s => {
  const input = String(s || "").trim();
  if (operationalCopy.test(input)) return "";
  return bulletizeKorean(input
  .replace(/기술 감시/g, "기술 적용성 검토")
  .replace(/기능 감시/g, "기능 적용성 검토")
  .replace(/제휴 감시/g, "제휴 타당성 검토")
  .replace(/모니터링/g, "사업 모델 검토")
  .trim());
};
const EXCLUDED = /deepseek|kling|kuaishou|hailuo|minimax|zhipu|moonshot|01\.?ai|baichuan|stepfun|sensetime|iflytek|baidu|alibaba|tencent|bytedance|naver|kakao|upstage|wrtn|hyperclova/i;
const LABELS_L = ["파트너십 기회", "전략 제휴", "탑재 후보", "사업 모델 검토"];
const LABELS_S = ["인수 후보", "투자 검토", "기술 적용", "사업 모델 검토"];

// ── 대형(밸류 ≥ $10B) — 비즈니스 모델·수익구조 시드(플레인) ──
// cat = STARTUP_TAXONOMY(data.js) 카테고리 id — 단말 신사업 관점 분류
const LARGE = [
  { name: "Databricks", domain: "databricks.com", vertical: "데이터·AI 플랫폼", cat: "data", val: "$134B", bm: "데이터 레이크하우스 SaaS — 컴퓨트 소비량(DBU)·플랫폼 구독으로 과금", rev: "ARR $30억+ 추정, 엔터프라이즈 데이터·AI 워크로드 확대", part: "온디바이스 개인화 데이터 파이프라인·MLOps 백엔드 제휴 각도" },
  // (Cursor 제외 — 이미 인수 완료된 업체 · Perplexity 제외 — 사용자 요청)
  { name: "Mistral AI", domain: "mistral.ai", vertical: "파운데이션 모델", cat: "foundation", val: "$20B", bm: "오픈 가중치 무료+엔터프라이즈 라이선스·API 사용량 과금", rev: "유럽 대표 오픈모델, Ministral 온디바이스급 경량 모델", part: "온디바이스 탑재 모델 멀티소싱 후보 — 개방성·주권 강점" },
  { name: "Safe Superintelligence", domain: "ssi.inc", vertical: "파운데이션 모델", cat: "foundation", val: "$32B", bm: "안전 최우선 프런티어 연구소 — 상용 제품 이전 단계", rev: "Ilya Sutskever 창업, 단일 목표(안전한 초지능) 연구", part: "차세대 프런티어 모델 소싱·안전성 기술 장기 감시" },
  { name: "Thinking Machines Lab", domain: "thinkingmachines.ai", vertical: "파운데이션 모델", cat: "foundation", val: "$12B", bm: "Mira Murati(前 OpenAI CTO) 창업 — 멀티모달·맞춤형 모델", rev: "초기 스텔스, 최상위 연구인력 결집", part: "맞춤형·온디바이스 모델 파트너십 후보 감시" },
  { name: "Sierra AI", domain: "sierra.ai", vertical: "고객 응대 에이전트", cat: "vertical", val: "$15B+", bm: "기업 CS 에이전트 — 해결 건당 성과 기반 과금(outcome pricing)", rev: "엔터프라이즈 CS 자동화 급성장", part: "단말 케어·구독 CS 자동화 제휴 — 성과형 과금 모델 참고" },
  { name: "Scale AI", domain: "scale.com", vertical: "데이터 라벨링·평가", cat: "data", val: "$14B", bm: "AI 학습 데이터 라벨링·모델 평가 서비스 — 프로젝트·시트 과금", rev: "빅테크·정부 데이터 파이프라인 핵심 공급", part: "온디바이스 모델 평가·데이터 품질 백엔드 제휴" },
  { name: "ElevenLabs", domain: "elevenlabs.io", vertical: "음성 AI", cat: "voice", val: "$11B", bm: "음성 합성 구독+API 문자당 과금, 크리에이터·기업 이중 채널", rev: "음성 생성 품질 선두, API 매출 급성장", part: "단말 음성 UX(TTS·더빙·통역) 핵심 기술 제휴/인수 후보" },
  { name: "Harvey", domain: "harvey.ai", vertical: "법률 AI", cat: "vertical", val: "$11B", bm: "로펌·기업 법무 특화 SaaS — 좌석당 구독", rev: "법률 버티컬 선두, B2B 확장성 높음", part: "단말 직접 부착성 낮음 — 서비스 제휴 위주" },
  { name: "Figure AI", domain: "figure.ai", vertical: "휴머노이드 로봇", cat: "robotics", val: "$39B", bm: "범용 휴머노이드 로봇 — 온디바이스 AI(Helix) 탑재", rev: "물류·가정용 로봇 상용화 추진, 대형 라운드 조달", part: "폰 이후 신규 폼팩터·피지컬 AI 장기 옵션 감시" },
];

// ── 소형/초기(< $10B or 얼리스테이지) — 개요·정량·인수/투자 관점 시드 ──
const SMALL = [
  // data.js 소형
  { name: "Replit", domain: "replit.com", vertical: "코딩 플랫폼", cat: "coding", stage: "$9B", funding: "밸류 $9B", ov: "브라우저 개발환경+AI 에이전트, 교육·크리에이터 접점", acq: "개발자 온보딩·교육 생태계 확보 관점 투자 검토" },
  { name: "Glean", domain: "glean.com", vertical: "사내 검색", cat: "productivity", stage: "$7.2B", funding: "밸류 $7.2B", ov: "엔터프라이즈 검색·어시스턴트, B2B 지식 접근", acq: "B2B 단말 번들 제휴·전략 투자 각도" },
  { name: "Lovable", domain: "lovable.dev", vertical: "앱 생성", cat: "coding", stage: "$6.6B", funding: "밸류 $6.6B", ov: "자연어 앱 빌더(스웨덴), 앱 생태계 롱테일 확장", acq: "스토어 생태계 활성화 관점 투자 검토" },
  { name: "Cohere", domain: "cohere.com", vertical: "엔터프라이즈 LLM", cat: "foundation", stage: "$5.5B", funding: "밸류 $5.5B·ARR ~$2.4억", ov: "소버린·기업용 LLM(캐나다), 온프레미스 배포 강점", acq: "온디바이스 경량 모델·보안 배포 기술 감시" },
  { name: "Suno", domain: "suno.com", vertical: "음악 생성", cat: "music", stage: "$5.4B", funding: "밸류 $5.4B", ov: "음악 생성 대중화, 미디어·크리에이터 기능", acq: "카메라·미디어 생성 기능 접목 관점 기술 감시" },
  { name: "Hugging Face", domain: "huggingface.co", vertical: "모델 허브", cat: "foundation", stage: "$4.5B", funding: "밸류 $4.5B", ov: "오픈모델 유통 허브, 온디바이스 모델 소싱 채널", acq: "온디바이스 모델 소싱·개발자 채널 전략 투자" },
  { name: "Runway", domain: "runwayml.com", vertical: "영상 생성", cat: "video", stage: "$4B", funding: "밸류 $4B", ov: "생성 영상 선도, 카메라·갤러리 편집 접목 여지", acq: "카메라 생성편집 기술 인수/제휴 후보" },
  { name: "Together AI", domain: "together.ai", vertical: "AI 추론 클라우드", cat: "infra", stage: "$3.3B", funding: "밸류 $3.3B", ov: "오픈모델 서빙 인프라, 추론 원가 절감", acq: "클라우드 추론 원가 파트너·전략 투자" },
  { name: "Abridge", domain: "abridge.com", vertical: "의료 AI", cat: "vertical", stage: "$2.75B", funding: "밸류 $2.75B", ov: "의료 대화 기록·요약, 헬스 기기 연계 여지", acq: "웨어러블 헬스 서비스 접목 관점 투자 검토" },
  { name: "Synthesia", domain: "synthesia.io", vertical: "영상 아바타", cat: "video", stage: "$2.1B", funding: "밸류 $2.1B", ov: "기업용 아바타 영상(영국), 커뮤니케이션 앱 접목", acq: "커뮤니케이션 기능 접목 기술 감시" },
  { name: "Writer", domain: "writer.com", vertical: "엔터프라이즈 생산성", cat: "productivity", stage: "$1.9B", funding: "밸류 $1.9B", ov: "기업용 풀스택 LLM, 문서·워크플로 접목", acq: "B2B 문서 워크플로 제휴 관점" },
  { name: "Stability AI", domain: "stability.ai", vertical: "이미지 생성", cat: "camera", stage: "$1B", funding: "밸류 $1B", ov: "오픈 이미지 생성 모델, 온디바이스 경량화 여지", acq: "온디바이스 이미지 생성 기술 감시" },
  // ── 음성·오디오·통역(voice) — 단말 음성 UX 직결 ──
  { name: "Cartesia", domain: "cartesia.ai", vertical: "온디바이스 음성", cat: "voice", stage: "시리즈A", funding: "Series A $27M (2025)", ov: "실시간·온디바이스 구동을 노린 초저지연 음성 모델(SSM 기반, 미국)", acq: "온디바이스 음성 UX 직결 — 최우선 인수/투자 후보" },
  { name: "Deepgram", domain: "deepgram.com", vertical: "음성 인식", cat: "voice", stage: "시리즈B", funding: "Series B $72M", ov: "엔터프라이즈 음성 인식·STT API, 통화·자막 백엔드(미국)", acq: "통화 자막·받아쓰기 단말 기능 제휴/투자" },
  { name: "Sesame", domain: "sesame.com", vertical: "음성 비서", cat: "voice", stage: "시드", funding: "초기 라운드", ov: "자연스러운 대화형 음성 컴패니언·AI 안경 지향(미국)", acq: "단말 대화형 음성 비서 기술 감시" },
  { name: "Wispr Flow", domain: "wisprflow.ai", vertical: "음성 입력", cat: "voice", stage: "시리즈A", funding: "Series A $30M (2026)", ov: "말로 입력하는 AI 받아쓰기 키보드(미국)", acq: "단말 음성 입력 UX 직결 — 인수/제휴 후보" },
  // ── 카메라·이미지(camera) — 카메라·갤러리 직결 ──
  { name: "Black Forest Labs", domain: "bfl.ai", vertical: "이미지 생성", cat: "camera", stage: "시리즈B", funding: "밸류 ~$4B 협의(2025)", ov: "FLUX 오픈 이미지 생성 모델(독일), 편집·복원 강점", acq: "카메라·갤러리 생성편집 엔진 인수/제휴 후보" },
  { name: "Ideogram", domain: "ideogram.ai", vertical: "이미지 생성", cat: "camera", stage: "시리즈A", funding: "Series A $80M (2024)", ov: "텍스트 렌더링 강한 이미지 생성(미국/캐나다)", acq: "카메라·크리에이티브 기능 접목 기술 감시" },
  { name: "Photoroom", domain: "photoroom.com", vertical: "이미지 편집", cat: "camera", stage: "시리즈B", funding: "Series B $43M (2024)", ov: "온디바이스 지향 사진 배경 제거·편집 앱(프랑스)", acq: "갤러리·카메라 온디바이스 편집 직결 후보" },
  // ── 영상(video) ──
  { name: "Pika", domain: "pika.art", vertical: "영상 생성", cat: "video", stage: "시리즈B", funding: "Series B $80M (2024)", ov: "소비자 친화 영상 생성 앱(미국)", acq: "숏폼·미디어 생성 기능 접목 기술 감시" },
  { name: "Luma AI", domain: "lumalabs.ai", vertical: "영상·3D 생성", cat: "video", stage: "시리즈B", funding: "Series B $43M (2024)", ov: "Dream Machine 영상 생성·3D 캡처(미국)", acq: "카메라 3D·영상 생성 기술 인수/제휴 후보" },
  { name: "HeyGen", domain: "heygen.com", vertical: "영상 아바타", cat: "video", stage: "시리즈A", funding: "밸류 $500M (2024)", ov: "AI 아바타·립싱크 영상 생성(미국)", acq: "커뮤니케이션·아바타 기능 접목 기술 감시" },
  { name: "Captions", domain: "captions.ai", vertical: "영상 편집", cat: "video", stage: "시리즈C", funding: "Series C $60M (2024)", ov: "촬영·편집을 자동화하는 AI 영상 앱(미국)", acq: "카메라·숏폼 자동편집 온디바이스 접목 후보" },
  { name: "Udio", domain: "udio.com", vertical: "음악 생성", cat: "music", stage: "시리즈A", funding: "Series A $10M (2024)", ov: "고품질 음악 생성 서비스(미국)", acq: "미디어·크리에이터 음악 생성 기능 기술 감시" },
  // ── 코딩·앱(coding) ──
  { name: "Cognition", domain: "cognition.ai", vertical: "코딩 에이전트", cat: "coding", stage: "시리즈", funding: "밸류 ~$10B(2025)", ov: "자율 SW 엔지니어 'Devin'·Windsurf 인수(미국)", acq: "개발 생태계·에이전트 실행 기술 전략 투자" },
  { name: "Poolside", domain: "poolside.ai", vertical: "코딩 모델", cat: "coding", stage: "시리즈B", funding: "Series B $500M (2025)", ov: "코드 특화 파운데이션 모델·엔터프라이즈 배포(미국)", acq: "온프레미스 코딩 모델·개발자 채널 기술 감시" },
  { name: "Windsurf", domain: "windsurf.com", vertical: "코딩 플랫폼", cat: "coding", stage: "시리즈", funding: "비상장", ov: "AI 코드 에디터(前 Codeium)(미국)", acq: "개발자 온보딩·앱 생태계 관점 기술 감시" },
  // ── 온디바이스·파운데이션(ondevice / foundation) ──
  { name: "Liquid AI", domain: "liquid.ai", vertical: "온디바이스 추론", cat: "ondevice", stage: "시리즈A", funding: "Series A $250M (2024)", ov: "MIT 스핀오프 — 경량·효율 LFM 모델로 온디바이스 구동(미국)", acq: "온디바이스 AI 직결 — 최우선 인수/투자 후보" },
  { name: "Mirai", domain: "getmirai.co", vertical: "온디바이스 추론", cat: "ondevice", stage: "시드", funding: "시드 $10M (2026.2)", ov: "모든 아키텍처 모델을 기기에 직접 배포·구동하는 온디바이스 추론 엔진(미국)", acq: "온디바이스 AI 전략 직결 — 최우선 인수/투자 후보" },
  { name: "World Labs", domain: "worldlabs.ai", vertical: "공간 지능 모델", cat: "foundation", stage: "시리즈", funding: "밸류 $1B+ (2024)", ov: "Fei-Fei Li 창업 — 공간(3D) 지능 대규모 세계 모델(미국)", acq: "카메라·AR 공간 이해 기술 장기 감시" },
  { name: "Reka AI", domain: "reka.ai", vertical: "멀티모달 모델", cat: "foundation", stage: "시리즈", funding: "$110M 라운드", ov: "효율적 멀티모달 파운데이션 모델(미국)", acq: "온디바이스 멀티모달 모델 소싱 후보" },
  { name: "AI21 Labs", domain: "ai21.com", vertical: "엔터프라이즈 LLM", cat: "foundation", stage: "시리즈C", funding: "Series C $208M (2023.11)", ov: "기업용 고급 언어 AI 모델(이스라엘)", acq: "온디바이스 경량 LLM·추론 최적화 기술 감시" },
  // ── 엔터프라이즈·생산성(productivity) ──
  { name: "Hebbia", domain: "hebbia.ai", vertical: "사내 검색", cat: "productivity", stage: "시리즈B", funding: "Series B $130M (2024)", ov: "금융·전문가용 문서 검색·분석 에이전트(미국)", acq: "B2B 지식·문서 서비스 제휴 각도" },
  { name: "Dust", domain: "dust.tt", vertical: "업무 에이전트", cat: "productivity", stage: "시리즈A", funding: "Series A $16M (2024)", ov: "사내 데이터 연결 업무 에이전트 플랫폼(프랑스)", acq: "B2B 업무 자동화 제휴 관점" },
  // ── 버티컬 도메인(vertical) ──
  { name: "Decagon", domain: "decagon.ai", vertical: "고객 응대 에이전트", cat: "vertical", stage: "시리즈C", funding: "밸류 $1.5B (2025)", ov: "기업 CS AI 에이전트 — 성과형 과금(미국)", acq: "단말 케어·CS 자동화 서비스 제휴" },
  { name: "OpenEvidence", domain: "openevidence.com", vertical: "의료 AI", cat: "vertical", stage: "시리즈", funding: "밸류 $6B (2025)", ov: "의료진용 근거 기반 임상 답변 엔진(미국)", acq: "헬스·케어 서비스 제휴 각도" },
  { name: "Hippocratic AI", domain: "hippocraticai.com", vertical: "헬스케어 음성", cat: "vertical", stage: "시리즈B", funding: "밸류 $1.6B (2025)", ov: "비진단 환자 응대 음성 AI 에이전트(미국)", acq: "웨어러블·케어 음성 서비스 접목 투자 검토" },
  { name: "Robin AI", domain: "robinai.com", vertical: "법률 AI", cat: "vertical", stage: "시리즈B", funding: "Series C $25M (2025)", ov: "계약 검토·법무 어시스턴트(영국)", acq: "B2B 법무 서비스 제휴 관점" },
  // ── 추론 클라우드·서빙(infra) ──
  { name: "Fireworks AI", domain: "fireworks.ai", vertical: "AI 추론 클라우드", cat: "infra", stage: "시리즈B", funding: "밸류 $4B (2025)", ov: "빠른 오픈모델 추론·서빙 플랫폼(미국)", acq: "클라우드 추론 원가·속도 파트너 전략 투자" },
  { name: "Baseten", domain: "baseten.co", vertical: "모델 서빙", cat: "infra", stage: "시리즈C", funding: "밸류 $2.1B (2025)", ov: "ML 모델 배포·서빙 인프라(미국)", acq: "모델 배포 백엔드 제휴 관점" },
  { name: "Groq", domain: "groq.com", vertical: "추론 가속", cat: "infra", stage: "시리즈", funding: "밸류 $6.9B (2025)", ov: "LPU 기반 초고속 추론 칩·클라우드(미국)", acq: "저지연 추론 인프라 전략 감시" },
  { name: "Parasail", domain: "parasail.io", vertical: "AI 추론 클라우드", cat: "infra", stage: "시리즈A", funding: "Series A $32M (2026.4)", ov: "토큰당 과금 추론 '슈퍼클라우드', 개발자 자원 제어(미국)", acq: "클라우드 추론 원가 절감 전략 투자" },
  // ── 검색·에이전트(search / agent) ──
  { name: "You.com", domain: "you.com", vertical: "AI 검색", cat: "search", stage: "시리즈B", funding: "밸류 $1.5B (2024)", ov: "에이전트형 AI 검색·답변 엔진(미국)", acq: "단말 검색·어시스턴트 접점 기술 감시" },
  { name: "Genspark", domain: "genspark.ai", vertical: "AI 검색 에이전트", cat: "search", stage: "시리즈", funding: "$100M 라운드(2025)", ov: "자율 리서치·검색 에이전트(미국)", acq: "단말 검색 에이전트 UX 기술 감시" },
  { name: "MultiOn", domain: "multion.ai", vertical: "AI 에이전트", cat: "agent", stage: "시드", funding: "시드 $5M (2024.1)", ov: "웹에서 사용자 대신 실제 행동 수행하는 AI 에이전트(미국)", acq: "온디바이스 에이전트 실행엔진 초기 인수/투자 후보" },
  // ── 신뢰·보안(trust) ──
  { name: "Reality Defender", domain: "realitydefender.com", vertical: "딥페이크 탐지", cat: "trust", stage: "전략투자", funding: "전략 라운드 (2025.4)", ov: "실시간 멀티모달 딥페이크·AI 생성물 탐지 플랫폼(미국)", acq: "생성 AI 확대에 따른 방어형 탐지 기술 인수 후보" },
  { name: "Patronus AI", domain: "patronus.ai", vertical: "모델 안전·평가", cat: "trust", stage: "시리즈A", funding: "Series A $17M (2024)", ov: "LLM 오류·안전성 자동 평가·가드레일(미국)", acq: "온디바이스 모델 안전성 평가 백엔드 감시" },
  { name: "Pindrop", domain: "pindrop.com", vertical: "음성 보안", cat: "trust", stage: "성장", funding: "성장 라운드", ov: "음성 사기·딥페이크 음성 탐지(미국)", acq: "통화 보안·음성 위변조 방어 기술 감시" },
  // ── 신폼팩터·로보틱스(robotics) ──
  { name: "Physical Intelligence", domain: "physicalintelligence.company", vertical: "로봇 파운데이션", cat: "robotics", stage: "시리즈", funding: "밸류 $5.6B (2025)", ov: "범용 로봇용 파운데이션 모델(π 시리즈, 미국)", acq: "피지컬 AI 신폼팩터 관점 장기 감시" },
  { name: "1X Technologies", domain: "1x.tech", vertical: "휴머노이드 로봇", cat: "robotics", stage: "시리즈B", funding: "Series B $100M (2024.1)", ov: "가정용 휴머노이드 로봇 개발(노르웨이)", acq: "신규 폼팩터(로봇) 장기 옵션 — 기술 감시" },
  { name: "Limitless AI", domain: "limitless.ai", vertical: "AI 웨어러블", cat: "robotics", stage: "시리즈", funding: "$33M 라운드", ov: "대화 기록·요약 AI 펜던트 웨어러블(미국)", acq: "폰 이후 AI 웨어러블 폼팩터 기술 감시" },
  // ── a16z Top 100 Gen AI Consumer Apps 수록(한국·중국 제외) ──
  { name: "Character.AI", domain: "character.ai", vertical: "AI 캐릭터·컴패니언", cat: "agent", stage: "라이선스", funding: "Google 라이선스(2024)", ov: "개인화 AI 캐릭터 대화 — 소비자 컴패니언(미국)", acq: "단말 대화형 캐릭터·컴패니언 UX 기술 감시" },
  { name: "Poe", domain: "poe.com", vertical: "AI 모델 통합 챗", cat: "agent", stage: "Quora 산하", funding: "비상장(Quora)", ov: "여러 AI 모델을 한곳에서 쓰는 챗 앱(미국)", acq: "멀티모델 통합 어시스턴트 UX 감시" },
  { name: "QuillBot", domain: "quillbot.com", vertical: "쓰기·패러프레이즈", cat: "productivity", stage: "인수", funding: "Learneo 산하", ov: "패러프레이즈·문법·요약 쓰기 도구(미국)", acq: "단말 쓰기 보조 서비스 제휴" },
  { name: "Gamma", domain: "gamma.app", vertical: "프레젠테이션 생성", cat: "productivity", stage: "시리즈", funding: "밸류 $2.1B(2025)", ov: "AI 프레젠테이션·문서·웹 생성(미국)", acq: "업무 생산성 서비스 제휴" },
  { name: "Civitai", domain: "civitai.com", vertical: "이미지 모델 커뮤니티", cat: "camera", stage: "시드", funding: "시드 $5.1M", ov: "오픈 이미지 모델·LoRA 공유 커뮤니티(미국)", acq: "온디바이스 이미지 모델 소싱 채널 감시" },
  { name: "Leonardo.Ai", domain: "leonardo.ai", vertical: "이미지·영상 생성", cat: "camera", stage: "인수", funding: "Canva 인수(2024)", ov: "게임·크리에이터 이미지·영상 생성 스위트(호주)", acq: "카메라·갤러리 생성편집 기술 감시" },
  { name: "Krea", domain: "krea.ai", vertical: "실시간 이미지 생성", cat: "camera", stage: "시리즈B", funding: "Series B $83M(2025)", ov: "실시간 이미지·영상 생성·편집(미국)", acq: "온디바이스 실시간 생성 UX 기술 감시" },
  { name: "NightCafe", domain: "nightcafe.studio", vertical: "이미지 생성", cat: "camera", stage: "부트스트랩", funding: "비상장", ov: "AI 아트 이미지 생성 커뮤니티(호주)", acq: "크리에이티브 이미지 생성 기능 감시" },
  { name: "Veed", domain: "veed.io", vertical: "영상 편집", cat: "video", stage: "시리즈A", funding: "Series A $35M", ov: "브라우저 기반 AI 영상 편집(영국)", acq: "숏폼·영상 자동편집 기능 감시" },
  { name: "Descript", domain: "descript.com", vertical: "오디오·영상 편집", cat: "video", stage: "시리즈C", funding: "Series C · OpenAI 투자", ov: "문서 편집식 오디오·영상 편집(미국)", acq: "미디어 자동편집·음성 편집 기술 감시" },
  { name: "invideo", domain: "invideo.io", vertical: "영상 생성", cat: "video", stage: "시리즈A", funding: "Series A $15M", ov: "텍스트로 영상 생성·편집(인도)", acq: "영상 자동생성 기능 접목 감시" },
  { name: "Merlin", domain: "getmerlin.in", vertical: "AI 어시스턴트", cat: "agent", stage: "부트스트랩", funding: "비상장", ov: "브라우저 전역 AI 어시스턴트(미국/인도)", acq: "단말 전역 어시스턴트 UX 감시" },
  { name: "iAsk", domain: "iask.ai", vertical: "AI 검색", cat: "search", stage: "부트스트랩", funding: "비상장", ov: "AI 검색·답변 엔진(미국)", acq: "단말 검색·답변 접점 기술 감시" },
  { name: "Photomath", domain: "photomath.com", vertical: "교육(수학)", cat: "vertical", stage: "인수", funding: "Google 인수(2022)", ov: "카메라로 수학 문제 풀이 교육 앱(크로아티아)", acq: "카메라 기반 교육 서비스 제휴 감시" },
  { name: "Grammarly", domain: "grammarly.com", vertical: "쓰기 어시스턴트", cat: "productivity", stage: "성장", funding: "밸류 $13B(2021)", ov: "AI 쓰기·커뮤니케이션 어시스턴트(미국)", acq: "단말 키보드·쓰기 보조 서비스 제휴" },
  { name: "Canva", domain: "canva.com", vertical: "디자인 플랫폼", cat: "camera", stage: "성장", funding: "밸류 $42B(2025)", ov: "AI 통합 디자인·이미지 생성 플랫폼(호주)", acq: "크리에이티브·디자인 생성 기능 제휴" },
  { name: "Notion", domain: "notion.so", vertical: "생산성 워크스페이스", cat: "productivity", stage: "성장", funding: "밸류 $10B(2021)", ov: "AI 통합 올인원 워크스페이스(미국)", acq: "업무 생산성 서비스 번들 제휴" },
  { name: "Picsart", domain: "picsart.com", vertical: "이미지 편집", cat: "camera", stage: "성장", funding: "밸류 $1.5B(2021)", ov: "AI 사진·이미지 편집 앱(미국)", acq: "갤러리·카메라 편집 기능 제휴 감시" },
  { name: "Freepik", domain: "freepik.com", vertical: "이미지·리소스 생성", cat: "camera", stage: "성장", funding: "EQT 투자", ov: "AI 이미지·리소스 생성 플랫폼(스페인)", acq: "크리에이티브 리소스 생성 기술 감시" },
  { name: "Remini", domain: "remini.ai", vertical: "사진 화질 복원", cat: "camera", stage: "인수", funding: "Bending Spoons 산하", ov: "AI 사진 화질 복원·향상 앱(이탈리아)", acq: "카메라·갤러리 복원 기능 직결 감시" },
  { name: "Fliki", domain: "fliki.ai", vertical: "영상·음성 생성", cat: "video", stage: "부트스트랩", funding: "비상장", ov: "텍스트→영상·음성 생성(미국/인도)", acq: "미디어 생성 기능 접목 감시" },
  // ── a16z Top 100 추가 확장(2차) — 단말(통화·회의·번역·브라우저) 관점 강화 ──
  { name: "DeepL", domain: "deepl.com", vertical: "AI 번역", cat: "voice", stage: "성장", funding: "비상장 성장기업(독일)", ov: "고품질 신경망 기계번역 서비스 — 웹·모바일·API", acq: "실시간 통역·번역 UX 기능 접목 감시" },
  { name: "Speechify", domain: "speechify.com", vertical: "텍스트 음성 변환", cat: "voice", stage: "성장", funding: "비상장 성장기업(미국)", ov: "텍스트를 음성으로 읽어주는 리딩·접근성 앱", acq: "단말 접근성·오디오북 리딩 UX 기능 감시" },
  { name: "Otter.ai", domain: "otter.ai", vertical: "회의 전사·요약", cat: "voice", stage: "성장", funding: "ARR $100M+ 돌파(2025.3 보도)", ov: "실시간 회의 전사·요약·AI 에이전트(미국)", acq: "통화·회의 녹취 UX 기능 접목 감시" },
  { name: "Fireflies.ai", domain: "fireflies.ai", vertical: "회의 노트 AI", cat: "productivity", stage: "성장", funding: "비상장 성장기업(미국)", ov: "회의 녹음·전사·요약 자동화", acq: "업무 생산성 서비스 제휴 감시" },
  { name: "Granola", domain: "granola.ai", vertical: "AI 회의 노트", cat: "productivity", stage: "시리즈B", funding: "성장 라운드(영국)", ov: "평소처럼 메모하면 AI가 회의록으로 정리", acq: "생산성 앱 번들 제휴 감시" },
  { name: "Read AI", domain: "read.ai", vertical: "회의·메일 AI 어시스턴트", cat: "productivity", stage: "성장", funding: "비상장 성장기업(미국)", ov: "회의·이메일·메시지 요약 AI 어시스턴트", acq: "업무 통합 어시스턴트 제휴 감시" },
  { name: "ElsaSpeak", domain: "elsaspeak.com", vertical: "AI 발음 코칭", cat: "voice", stage: "성장", funding: "비상장 성장기업(미국/베트남)", ov: "AI 기반 영어 발음·회화 코칭 앱", acq: "언어학습 음성 UX 기능 접목 감시" },
  { name: "Speak", domain: "speak.com", vertical: "AI 언어 학습", cat: "voice", stage: "성장", funding: "성장 라운드(미국)", ov: "AI 대화형 언어 학습 튜터 앱", acq: "언어학습·음성대화 UX 기능 감시" },
  { name: "Cleo", domain: "meetcleo.com", vertical: "AI 금융 챗봇", cat: "vertical", stage: "성장", funding: "비상장 성장기업(영국)", ov: "개인 재무관리 AI 챗봇 앱", acq: "금융 서비스 챗봇 제휴 감시" },
  { name: "Tavus", domain: "tavus.io", vertical: "AI 비디오 아바타", cat: "video", stage: "시리즈A", funding: "성장 라운드(미국)", ov: "실시간 AI 비디오 아바타·대화 API", acq: "영상 아바타 API 기술 감시" },
  { name: "Arcads", domain: "arcads.ai", vertical: "AI UGC 광고 영상", cat: "video", stage: "시드", funding: "초기 라운드(프랑스)", ov: "AI 아바타 기반 UGC 스타일 광고 영상 생성", acq: "광고·마케팅 영상 생성 기술 감시" },
  { name: "Play.ht", domain: "play.ht", vertical: "AI 음성 합성 API", cat: "voice", stage: "성장", funding: "비상장 성장기업(미국)", ov: "AI 음성 합성·클로닝 API 플랫폼", acq: "단말 음성 합성 기술 인수 후보" },
  { name: "Resemble AI", domain: "resemble.ai", vertical: "음성 클로닝", cat: "voice", stage: "성장", funding: "비상장 성장기업(캐나다)", ov: "AI 음성 클로닝·합성 플랫폼", acq: "단말 음성 클로닝 기술 감시" },
  { name: "Murf AI", domain: "murf.ai", vertical: "AI 보이스오버", cat: "voice", stage: "성장", funding: "비상장 성장기업(미국)", ov: "AI 내레이션·보이스오버 생성 플랫폼", acq: "콘텐츠 내레이션 기능 접목 감시" },
  { name: "Dia (The Browser Company)", domain: "diabrowser.com", vertical: "AI 브라우저", cat: "search", stage: "성장", funding: "성장 라운드(미국)", ov: "AI 네이티브 브라우저(前 Arc)", acq: "단말 브라우저·검색 어시스턴트 UX 감시" },
  { name: "Krisp", domain: "krisp.ai", vertical: "AI 노이즈 캔슬링", cat: "voice", stage: "성장", funding: "비상장 성장기업(아르메니아/미국)", ov: "통화·회의 배경소음 제거 AI", acq: "통화 품질·회의 오디오 기능 접목 감시" },
  { name: "D-ID", domain: "d-id.com", vertical: "AI 아바타 영상", cat: "video", stage: "성장", funding: "비상장 성장기업(이스라엘)", ov: "텍스트로 말하는 AI 아바타 영상 생성", acq: "커뮤니케이션 아바타 기능 접목 감시" },
];

const decode = s => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tagOf = (xml, n) => { const m = xml.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`, "i")); return m ? m[1] : ""; };

const validHttp = value => /^https?:\/\//i.test(String(value || ""));
const sourceSnapshot = record => {
  if (!record || !validHttp(record.url)) return null;
  const content = record.sourceContent || {};
  return {
    title: String(record.title || "").trim(),
    url: record.url,
    ...(record.rssUrl ? { rssUrl: record.rssUrl } : {}),
    source: String(record.source || "Google News").trim(),
    date: String(record.date || TODAY).slice(0, 10),
    ...(record.sourceLanguage ? { sourceLanguage: record.sourceLanguage } : {}),
    ...(record.sourceRegion ? { sourceRegion: record.sourceRegion } : {}),
    ...(record.sourceLocale ? { sourceLocale: record.sourceLocale } : {}),
    ...(isContentBacked(record) ? {
      sourceSummaryMode: record.summaryMode,
      sourceLinesEn: (record.summaryLinesEn || []).slice(0, 3),
      sourceContent: {
        status: "content-extracted",
        canonicalUrl: content.canonicalUrl || record.url,
        contentHash: content.contentHash || "",
        retrievedAt: content.retrievedAt || new Date().toISOString(),
      },
    } : {}),
  };
};

async function enrichLatestSources(rows) {
  const targets = rows.filter(row => validHttp(row?.latest?.url)).map(row => ({
    url: row.latest.url, title: row.latest.title, source: row.latest.source, date: row.latest.date,
  }));
  if (!targets.length) return;
  const enriched = await enrichSourceBatch(targets, 3);
  let index = 0;
  for (const row of rows) {
    if (!validHttp(row?.latest?.url)) continue;
    const snapshot = sourceSnapshot(enriched[index++]);
    if (snapshot) row.latest = { ...row.latest, ...snapshot };
  }
}

function retainSourceHistory(rows, previousRows) {
  const previousByName = new Map((previousRows || []).map(row => [row.name, row]));
  for (const row of rows) {
    const prior = previousByName.get(row.name);
    const candidates = [sourceSnapshot(row.latest), ...(prior?.history || []), sourceSnapshot(prior?.latest)].filter(Boolean);
    const seen = new Set();
    row.history = candidates
      .filter(item => {
        const key = String(item.url || `${item.title}|${item.date}`).replace(/[#?].*$/, "");
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 12);
  }
}

function normalizeSourceProvenance(rows, checkedAt = new Date().toISOString()) {
  let changed = false;
  for (const row of rows || []) {
    const latestUrl = validHttp(row?.latest?.url) ? row.latest.url : "";
    const historyUrls = (row?.history || [])
      .map(item => item?.url)
      .filter(validHttp);
    const evidenceUrls = [...new Set([latestUrl, ...historyUrls].filter(Boolean))];
    const next = {
      status: evidenceUrls.length ? "source-linked" : "pending-source",
      evidenceCount: evidenceUrls.length,
      evidenceType: latestUrl
        ? "publisher-link-latest"
        : evidenceUrls.length
          ? "historical-publisher-links"
          : "catalog-profile",
      historyCount: historyUrls.length,
    };
    const current = row.provenance || {};
    const currentComparable = Object.fromEntries(Object.keys(next).map(key => [key, current[key]]));
    if (JSON.stringify(currentComparable) !== JSON.stringify(next) || !current.checkedAt) {
      row.provenance = { ...next, checkedAt };
      changed = true;
    }
  }
  return changed;
}

const startupRecordKey = record => {
  try {
    const value = String(record?.domain || record?.profile?.officialWebsite || "");
    if (value) return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {}
  return String(record?.name || "").trim().toLowerCase();
};

function retainVerifiedCompanyDepth(rows, previousRows) {
  const previousByKey = new Map();
  for (const prior of previousRows || []) {
    const keys = [startupRecordKey(prior), `name:${String(prior?.name || "").trim().toLowerCase()}`].filter(Boolean);
    const depth = Number(prior?.coverage?.organization?.executiveCount || prior?.organization?.executiveTeam?.length || 0);
    for (const key of keys) {
      const current = previousByKey.get(key);
      const currentDepth = Number(current?.coverage?.organization?.executiveCount || current?.organization?.executiveTeam?.length || 0);
      if (!current || depth >= currentDepth) previousByKey.set(key, prior);
    }
  }
  for (const row of rows || []) {
    const prior = previousByKey.get(startupRecordKey(row))
      || previousByKey.get(`name:${String(row?.name || "").trim().toLowerCase()}`);
    if (!prior) continue;
    if (prior.profile) row.profile = prior.profile;
    if (prior.organization) row.organization = prior.organization;
    if (prior.coverage) row.coverage = prior.coverage;
  }
}

async function latest(name, locale) {
  try {
    const q = `"${name.replace(/\s*\(.*\)/, "")}" AI when:21d`;
    const res = await fetch(googleNewsUrl(q, locale, 21), { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const xml = await res.text();
    const m = /<item>([\s\S]*?)<\/item>/.exec(xml);
    if (!m) return null;
    const it = m[1];
    const d = new Date(tagOf(it, "pubDate"));
    return {
      title: decode(tagOf(it, "title")).replace(/ - [^-]*$/, "").trim(),
      url: decode(tagOf(it, "link")), source: decode(tagOf(it, "source")) || "Google News",
      date: isNaN(d) ? TODAY : d.toISOString().slice(0, 10),
      sourceScope: "global-localized-rss", sourceRegion: locale.region, sourceLanguage: locale.language, sourceLocale: locale.id,
    };
  } catch { return null; }
}

async function enrichLarge(rows) {
  const list = rows.map((s, i) => `[${i}] ${s.name} (${s.vertical}, ${s.val}) — BM: ${s.bm}${s.latest ? ` / 최신: ${s.latest.title}` : ""}`).join("\n");
  const r = await llmJSON({
    system: "당신은 글로벌 스마트폰 제조사 무선사업부의 신사업 전략 분석가입니다. 대형 AI 업체를 '비즈니스 모델·수익 구조·파트너십' 관점에서 평가합니다. 특정 기업명(삼성·갤럭시·MX)은 출력 금지. 반드시 한국어 개조식(명사형 종결)으로만 작성하고 영어 문장·마침표를 쓰지 마세요. JSON.",
    user: `다음 대형 AI 업체를 단말 제조사 파트너십 관점에서 평가해 rows로 출력:\n${list}\n\n각 {idx, revenue(수익 구조·규모 — 한국어 개조식 1구, 마침표 금지), partnership(파트너십 각도 — 한국어 개조식 1~2구, 탑재/제휴/공동개발 중 권장, 마침표 금지), label(${JSON.stringify(LABELS_L)} 중 1개)}. 근거 없는 수치 생성 금지.`,
    maxTokens: 2600,
    schema: { type: "object", properties: { rows: { type: "array", items: { type: "object", properties: { idx: { type: "integer" }, revenue: { type: "string" }, partnership: { type: "string" }, label: { type: "string" } }, required: ["idx", "revenue", "partnership", "label"], additionalProperties: false } } }, required: ["rows"], additionalProperties: false },
  });
  if (!r) return null;
  for (const row of r.data.rows || []) { const s = rows[row.idx]; if (s) { s.revenue = scrub(row.revenue); s.partnership = scrub(row.partnership); s.label = LABELS_L.includes(row.label) ? row.label : "사업 모델 검토"; } }
  return r.engine;
}

async function enrichSmall(rows) {
  const list = rows.map((s, i) => `[${i}] ${s.name} (${s.vertical}, ${s.funding}) — ${s.ov}${s.latest ? ` / 최신: ${s.latest.title}` : ""}`).join("\n");
  const r = await llmJSON({
    system: "당신은 글로벌 스마트폰 제조사 무선사업부의 신사업·투자 전략 분석가입니다. 초기·중소 AI 업체를 '인수·투자' 관점에서 평가합니다. 특정 기업명(삼성·갤럭시·MX)은 출력 금지. 반드시 한국어 개조식(명사형 종결)으로만 작성하고 영어 문장·마침표를 쓰지 마세요. JSON.",
    user: `다음 초기·중소 AI 업체를 단말 제조사 인수/투자 관점에서 평가해 rows로 출력:\n${list}\n\n각 {idx, acqAngle(인수/투자 각도 — 한국어 개조식 1~2구, 온디바이스·단말서비스·신폼팩터 접목 각도와 권장 경로, 마침표 금지), label(${JSON.stringify(LABELS_S)} 중 1개)}. 근거 없는 수치 생성 금지.`,
    maxTokens: 2600,
    schema: { type: "object", properties: { rows: { type: "array", items: { type: "object", properties: { idx: { type: "integer" }, acqAngle: { type: "string" }, label: { type: "string" } }, required: ["idx", "acqAngle", "label"], additionalProperties: false } } }, required: ["rows"], additionalProperties: false },
  });
  if (!r) return null;
  for (const row of r.data.rows || []) { const s = rows[row.idx]; if (s) { s.acqAngle = scrub(row.acqAngle); s.label = LABELS_S.includes(row.label) ? row.label : "사업 모델 검토"; } }
  return r.engine;
}

const startupCat = text => {
  const value = String(text || "").toLowerCase();
  if (/photo|image|video|design|camera|avatar|creative|edit|art/.test(value)) return "camera";
  if (/voice|audio|speech|music|translate|language/.test(value)) return "voice";
  if (/code|developer|app builder|website|programming/.test(value)) return "coding";
  if (/search|browser|answer|knowledge/.test(value)) return "search";
  if (/work|document|writing|meeting|productivity|office/.test(value)) return "productivity";
  if (/health|education|math|finance|learning/.test(value)) return "vertical";
  return "agent";
};

const buildInstitutional = (a16z, large, small) => {
  const known = new Map([...large, ...small].map(row => [row.name.toLowerCase(), row]));
  const merged = new Map();
  for (const item of [...(a16z.web || []), ...(a16z.mobile || [])]) {
    const key = String(item.name || "").toLowerCase();
    if (!key) continue;
    const current = merged.get(key) || {
      name: item.name,
      domain: item.domain || "",
      publisher: item.publisher || "",
      pageTitle: item.pageTitle || "",
      description: item.description || "",
      cohorts: [],
      sourceLinks: [],
    };
    if (!current.cohorts.includes(item.cohort)) current.cohorts.push(item.cohort);
    current.domain ||= item.domain || "";
    current.publisher ||= item.publisher || "";
    current.pageTitle ||= item.pageTitle || "";
    current.description ||= item.description || "";
    current.sourceLinks.push({
      label: `${item.cohort === "web" ? "Web" : "Mobile"} list`,
      listOrder: item.listOrder,
      url: item.productUrl,
    });
    merged.set(key, current);
  }
  return [...merged.values()].map(item => {
    const match = known.get(item.name.toLowerCase());
    const currentBusiness = match?.businessModel || match?.overview || item.description || item.pageTitle
      || `${item.name} 소비자 AI 제품`;
    const revenueModel = match?.revenue || "";
    const strategyDirection = match?.partnership || match?.acqAngle || "";
    return {
      ...item,
      vertical: match?.vertical || (item.cohorts.includes("mobile") ? "소비자 AI 모바일 앱" : "소비자 AI 웹 서비스"),
      cat: match?.cat || startupCat(`${currentBusiness} ${item.description}`),
      currentBusiness: scrub(currentBusiness),
      revenueModel: scrub(revenueModel),
      strategyDirection: scrub(strategyDirection),
      institution: {
        name: a16z.source || "Andreessen Horowitz (a16z)",
        title: a16z.sourceTitle || "The Top 100 Gen AI Consumer Apps — 6th Edition",
        url: a16z.sourceUrl,
        publishedAt: a16z.publishedAt || "2026-03-09",
      },
      provenance: {
        status: "source-backed",
        evidenceType: item.description ? "institution-list+publisher-metadata" : "institution-list",
        sourceUrl: a16z.sourceUrl,
      },
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
};

const normalizeStoredSnapshot = snapshot => {
  if (!snapshot) return false;
  const before = JSON.stringify(snapshot);
  for (const row of snapshot.large || []) {
    row.businessModel = scrub(row.businessModel);
    row.revenue = scrub(row.revenue);
    row.partnership = scrub(row.partnership);
    row.label = scrub(row.label) || "사업 모델 검토";
  }
  for (const row of snapshot.small || []) {
    row.overview = scrub(row.overview);
    row.acqAngle = scrub(row.acqAngle);
    row.label = scrub(row.label) || "사업 모델 검토";
  }
  for (const row of snapshot.institutional || []) {
    row.currentBusiness = scrub(row.currentBusiness);
    row.revenueModel = scrub(row.revenueModel);
    row.strategyDirection = scrub(row.strategyDirection);
  }
  return before !== JSON.stringify(snapshot);
};

async function enrichInstitutional(rows) {
  if (!llmAvailable() || !rows.length) return "";
  const schema = {
    type: "object",
    properties: {
      rows: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            currentBusiness: { type: "string" },
            revenueModel: { type: "string" },
            strategyDirection: { type: "string" },
          },
          required: ["name", "currentBusiness", "revenueModel", "strategyDirection"],
          additionalProperties: false,
        },
      },
    },
    required: ["rows"],
    additionalProperties: false,
  };
  let engine = "";
  for (let start = 0; start < rows.length; start += 12) {
    const batch = rows.slice(start, start + 12);
    const input = batch.map(row => ({
      name: row.name,
      cohorts: row.cohorts,
      publisher: row.publisher,
      pageTitle: row.pageTitle,
      publisherDescription: row.description,
      existingBusiness: row.currentBusiness,
      existingRevenue: row.revenueModel,
      existingDirection: row.strategyDirection,
    }));
    const result = await llmJSON({
      system: "스마트폰 사업자 관점의 소비자 AI 신사업 분석 역할 입력된 a16z 선정 정보와 제품 공식 페이지 메타데이터만 사용 각 제품의 현재 사업, 돈 버는 방식, 향후 사업 방향을 한국어로 구체화 모든 출력은 명사형 개조식으로 작성 마침표와 '~다'·'~습니다' 종결 금지 근거가 부족한 선택 항목은 빈 문자열로 반환 수치·가격·투자 사실 생성 금지 '수집 중', '확인 중', '대기', '데이터 없음', '옵션 확보', '신호 감시', '모니터링' 같은 운영 상태·일반론 금지",
      user: `다음 제품을 분석해 rows JSON으로 반환:\n${JSON.stringify(input)}`,
      maxTokens: 5_500,
      schema,
    });
    const mapped = new Map((result?.data?.rows || []).map(item => [item.name, item]));
    for (const row of batch) {
      const analysis = mapped.get(row.name);
      if (!analysis) continue;
      row.currentBusiness = scrub(analysis.currentBusiness) || row.currentBusiness;
      row.revenueModel = scrub(analysis.revenueModel) || row.revenueModel;
      row.strategyDirection = scrub(analysis.strategyDirection) || row.strategyDirection;
      row.intelligenceEngine = result.engine;
    }
    if (result?.engine) engine = result.engine;
  }
  return engine;
}

async function main() {
  const suppression = await loadSuppressionRegistry();
  const large = LARGE.filter(s => !EXCLUDED.test(s.name) && !suppression.hasCompany(s.name)).map(s => ({ name: s.name, domain: s.domain, vertical: s.vertical, cat: s.cat || "", val: s.val, businessModel: scrub(s.bm), revenue: scrub(s.rev), partnership: scrub(s.part), label: "사업 모델 검토" }));
  const small = SMALL.filter(s => !EXCLUDED.test(s.name) && !suppression.hasCompany(s.name)).map(s => ({ name: s.name, domain: s.domain, vertical: s.vertical, cat: s.cat || "", stage: s.stage, funding: s.funding, overview: scrub(s.ov), acqAngle: scrub(s.acq), label: "사업 모델 검토" }));

  let prev = null;
  try { prev = JSON.parse(await readFile("startups.json", "utf8")); } catch {}
  if (prev) {
    prev.large = (prev.large || []).filter(row => !suppression.hasCompany(row.name));
    prev.small = (prev.small || []).filter(row => !suppression.hasCompany(row.name));
    prev.institutional = (prev.institutional || []).filter(row => !suppression.hasCompany(row.name));
  }
  let normalizedStoredSnapshot = normalizeStoredSnapshot(prev);
  if (prev) {
    const canonical = canonicalizeStartupSnapshot(prev, loadDash().COMPANIES || []);
    if (JSON.stringify(canonical) !== JSON.stringify(prev)) {
      prev = canonical;
      normalizedStoredSnapshot = true;
    }
  }
  const age = prev && prev.weekOf ? (Date.now() - new Date(prev.weekOf + "T00:00:00Z").getTime()) / 86400000 : 99;
  const staleShape = !prev || prev.schemaVersion !== 3 || !Array.isArray(prev.large)
    || !Array.isArray(prev.institutional) || !prev.companyRegistry;   // 구 스키마면 강제 갱신
  // 영어 문장(연속 알파벳 15자+ 포함)이 남아 있으면 강제 재생성 — 한글 개조식으로 교체
  const hasEnglish = prev && [...(prev.large || []), ...(prev.small || [])].some(x =>
    /[A-Za-z]{4,}\s+[A-Za-z]{4,}\s+[A-Za-z]{4,}/.test(`${x.partnership || ""} ${x.acqAngle || ""} ${x.revenue || ""} ${x.overview || ""}`));
  const needsAiUpgrade = !!llmAvailable() && !String(prev?.engine || "").startsWith("github-models:");
  if (!FORCE_REFRESH && age < 6.5 && !staleShape && prev.engine !== "rules" && !hasEnglish && !needsAiUpgrade) {
    const provenanceNormalized = normalizeSourceProvenance(
      [...(prev.large || []), ...(prev.small || [])],
      new Date().toISOString(),
    );
    if (normalizedStoredSnapshot || provenanceNormalized) {
      prev.generatedAt = new Date().toISOString();
      await writeFile("startups.json", JSON.stringify(prev) + "\n");
    }
    console.log(`[startups] fresh (${prev.weekOf}, ${prev.engine}) — skip`);
    return;
  }

  const locales = rotatingLocales();
  for (const [index, s] of [...large, ...small].entries()) {
    const n = await latest(s.name, locales[index % locales.length]);
    if (n && !isExcludedText(`${n.title} ${n.source}`)) s.latest = n;
  }
  console.log(`[startups] large ${large.length} · small ${small.length}, globally localized latest signals attached`);
  await enrichLatestSources([...large, ...small]);

  const a16z = await readFile("a16z-startups.json", "utf8").then(JSON.parse).catch(() => ({
    source: "Andreessen Horowitz (a16z)", sourceTitle: "The Top 100 Gen AI Consumer Apps — 6th Edition",
    sourceUrl: "https://a16z.com/100-gen-ai-apps-6/", web: [], mobile: [],
  }));
  const institutional = buildInstitutional(a16z, large, small)
    .filter(row => !suppression.hasCompany(row.name));

  const e1 = await enrichLarge(large);
  const e2 = await enrichSmall(small);
  const e3 = await enrichInstitutional(institutional);
  const engine = e3 || e1 || e2 || "source-extractive";

  retainSourceHistory(large, prev?.large);
  retainSourceHistory(small, prev?.small);
  retainSourceHistory(institutional, prev?.institutional);
  normalizeSourceProvenance([...large, ...small]);
  const previousCompanyRows = [...(prev?.large || []), ...(prev?.small || []), ...(prev?.institutional || [])];
  retainVerifiedCompanyDepth(large, previousCompanyRows);
  retainVerifiedCompanyDepth(small, previousCompanyRows);
  retainVerifiedCompanyDepth(institutional, previousCompanyRows);

  const out = canonicalizeStartupSnapshot({
    generatedAt: new Date().toISOString(),
    weekOf: TODAY,
    engine,
    methodology: "weekly-news+publisher-pages+a16z-complete-lists+source-grounded-ai-synthesis+canonical-company-registry",
    organizationMethodology: prev?.organizationMethodology || "official-domain-jsonld-and-team-pages+wikidata-P856-domain-match+retained-verified-snapshot",
    organizationRefresh: prev?.organizationRefresh || null,
    institutionalSource: {
      name: a16z.source,
      title: a16z.sourceTitle,
      url: a16z.sourceUrl,
      publishedAt: a16z.publishedAt,
      webCount: (a16z.web || []).length,
      mobileCount: (a16z.mobile || []).length,
      uniqueCount: institutional.length,
    },
    large,
    small,
    institutional,
  }, loadDash().COMPANIES || []);
  await writeFile("startups.json", JSON.stringify(out) + "\n");
  console.log(`Wrote startups.json — large ${large.length} · small ${small.length} · a16z unique ${institutional.length} (engine: ${engine})`);
}

main().catch(e => { console.error(e); process.exit(1); });
