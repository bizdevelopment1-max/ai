#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { loadDash } from "./load-dash.mjs";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [dash, strategy, boards, components, app, anim, index] = await Promise.all([
  loadDash(),
  readFile("strategy-view.json", "utf8").then(JSON.parse),
  readFile("boards.jsx", "utf8"),
  readFile("components.jsx", "utf8"),
  readFile("app.jsx", "utf8"),
  readFile("anim.jsx", "utf8"),
  readFile("index.html", "utf8"),
]);

assert(strategy.sourceMode === "generated-from-verified-ledgers", "전략 화면이 생성 데이터가 아닙니다");
assert(strategy.choices?.length === 4, "핵심 플레이는 4개 축으로 구성해야 합니다");
assert(strategy.capabilities?.length === 5, "분석 툴킷은 5개 축이 필요합니다");
assert(strategy.operatingModel?.length === 4, "사용자 신호부터 실행까지 4단계 운영 모델이 필요합니다");
assert(strategy.decisionOutputs?.length === 4, "경영진 의사결정 산출물은 4개 축이 필요합니다");
assert(strategy.accountPortfolio?.length >= 5, "기업 포트폴리오는 5개 이상이어야 합니다");
assert(strategy.accountPortfolio.every(account => /^https:\/\//.test(account.sourceUrl || "")), "모든 기업 카드에 원문 URL이 필요합니다");
assert(strategy.workloadMap?.length >= 5, "사용자 순간-플랫폼-사업기회 맵은 5개 이상이어야 합니다");
assert(strategy.workloadMap.every(row => row.bottleneck && row.platform && row.opportunity && row.proof), "사용자 순간 맵은 불편·플랫폼·사업기회·검증 KPI를 모두 포함해야 합니다");
assert(strategy.opportunityPortfolio?.length >= 9, "생성 신사업 포트폴리오는 9개 이상이어야 합니다");
for (const id of ["on-device-trust-security", "clinical-health-ai", "companion-distribution"]) {
  assert(strategy.opportunityPortfolio.some(item => item.id === id), `신규 신사업 축이 없습니다: ${id}`);
}
assert(strategy.expertSignals?.length >= 5, "제품·플랫폼 원문 근거가 5건 이상이어야 합니다");
assert(/Competitive Platform Portfolio/.test(boards) && /User Moment → Experience Stack → Revenue/.test(boards), "경쟁 플랫폼과 사용자 순간 컨설팅 화면이 필요합니다");
assert(/Mobile AI New Business Portfolio/.test(boards) && /Mobile AI Product · Platform · Business Evidence/.test(boards), "신사업과 공식 근거 화면이 필요합니다");

assert(strategy.opportunityPortfolio.every(item =>
  item.sourceOpportunityId && item.title && item.thesis && item.gate && item.evidence?.length),
"신사업 포트폴리오가 누적 원장의 출처·판단 근거와 연결되지 않았습니다");
assert(strategy.lineage?.generatedFrom?.includes("mobile-ai-business-view.json"),
"신사업 포트폴리오의 누적 원장 lineage가 없습니다");
assert(/Strategy consulting · user need → mobile experience → revenue → execution/.test(boards), "사용자-경험-수익-실행 컨설팅 흐름이 없습니다");
assert(/AI Stack별 사업 판단 기준/.test(boards) && /<span>사업 Action<\/span>/.test(boards), "AI Stack 판단 기준의 간결한 제목과 실행 헤더가 필요합니다");
assert(/zone\.question/.test(boards) && /zone\.output/.test(boards) && /zone\.gate/.test(boards), "운영 모델의 질문·산출물·게이트가 표시되지 않습니다");
assert(/msf-flow-arrow/.test(boards), "단계 전환 화살표가 없습니다");
assert(/신사업 발굴 프레임/.test(components) && /AI 서비스 신사업/.test(components), "좌측 내비게이션이 모바일 AI 신사업 발굴 업무와 일치하지 않습니다");
assert(/모바일 AI 신사업 발굴 인텔리전스/.test(index), "페이지 메타 정보가 모바일 AI 신사업 발굴 목적과 일치하지 않습니다");
assert(/strategyData/.test(boards) && /strategy-view\.json/.test(app), "전략 화면이 자동 생성 뷰와 연결되지 않았습니다");

const removedSections = [
  "중국 인력 전략",
  "Policy maker direction · China / Korea / United States",
  "정책 방향성",
  "정책·팹 리스크",
  "인재/IP 리스크",
  "Talent and hiring early warning",
  "중국 인재·채용 레이더",
];
const uiText = [boards, components, app].join("\n");
for (const removed of removedSections) {
  assert(!uiText.includes(removed), `삭제된 섹션이 다시 노출됩니다: ${removed}`);
}

assert(/useInView\(sectionRef, 120\)/.test(app), "하단 보드 사전 로딩 범위가 적용되지 않았습니다");
assert(/loadJson\("overview-view\.json", \{ cache: "no-store" \}\)/.test(app), "초기 화면 전용 생성 데이터가 적용되지 않았습니다");
assert(/needsCompanyExtras/.test(app), "초기 화면과 상세 데이터 요청이 분리되지 않았습니다");
assert(/fmtNum\(p\.num, p\)/.test(anim), "숫자 첫 화면의 0 플래시 방지가 적용되지 않았습니다");
assert(/Math\.min\(dur \|\| 420, 620\)/.test(anim), "숫자 애니메이션 시간 상한이 적용되지 않았습니다");

assert((dash.COMPANIES || []).every(company =>
  !["note", "vp", "direction", "valuation", "funding", "metric", "value"].some(key => Object.hasOwn(company, key))),
"기업 레지스트리에 정적 전략·수치가 남아 있습니다");
assert(!Object.hasOwn(dash, "MOBILE_STRATEGY"), "정적 전략 포트폴리오가 런타임 레지스트리에 남아 있습니다");

console.log("department-fit: ok");
