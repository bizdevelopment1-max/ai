#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { loadDash } from "./load-dash.mjs";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [dash, architecture, strategy, opportunityDb, strategyBuilder, boards, components, app, anim, index] = await Promise.all([
  loadDash(),
  readFile("config/consulting-architecture.json", "utf8").then(JSON.parse),
  readFile("strategy-view.json", "utf8").then(JSON.parse),
  readFile("mobile-ai-business-view.json", "utf8").then(JSON.parse),
  readFile("scripts/strategy-view.mjs", "utf8"),
  readFile("boards.jsx", "utf8"),
  readFile("components.jsx", "utf8"),
  readFile("app.jsx", "utf8"),
  readFile("anim.jsx", "utf8"),
  readFile("index.html", "utf8"),
]);

assert(strategy.sourceMode === "generated-from-verified-ledgers", "전략 화면이 생성 데이터가 아닙니다");
assert(!Object.hasOwn(strategy, "choices"), "삭제된 우선 플레이 데이터가 전략 뷰에 남아 있습니다");
assert(!Object.hasOwn(strategy, "capabilities"), "삭제된 정적 분석 툴킷이 전략 뷰에 남아 있습니다");
assert(!Object.hasOwn(strategy, "operatingModel"), "삭제된 4단계 운영 모델이 전략 뷰에 남아 있습니다");
assert(!Object.hasOwn(strategy, "decisionOutputs"), "삭제된 정적 의사결정 산출물이 전략 뷰에 남아 있습니다");
assert(!Object.hasOwn(strategy, "accountPortfolio"), "삭제된 경쟁 기업 포트폴리오가 전략 뷰에 남아 있습니다");
assert(!Object.hasOwn(strategy, "workloadMap"), "삭제된 사용자 순간 운영 맵이 전략 뷰에 남아 있습니다");
const architectureSectionIds = architecture.workstreams.flatMap(workstream => workstream.sections.map(section => section.id));
assert(strategy.consultingModel?.workstreams?.length === 4, "MECE 전략 구조는 4개 독립 워크스트림이어야 합니다");
assert(new Set(architectureSectionIds).size === 9 && strategy.consultingModel.coverage?.sections === 9,
  "전체 9개 화면이 MECE 구조에 한 번씩 포함되어야 합니다");
assert(JSON.stringify(strategy.consultingModel.navigation.map(item => item.id)) === JSON.stringify(architectureSectionIds),
  "생성 메뉴와 MECE 화면 순서가 일치하지 않습니다");
assert(strategy.opportunityPortfolio?.length >= 9, "생성 신사업 포트폴리오는 9개 이상이어야 합니다");
const confidenceRank = value => ({ high: 3, medium: 2, low: 1 }[String(value || "").toLowerCase()] || 0);
const eligible = (opportunityDb.generatedOpportunities || [])
  .filter(item => item?.decisionEligible !== false
    && ["verified", "reviewed", "published"].includes(item?.workflow?.stage || item?.status)
    && item?.evidenceConfidence !== "low"
    && (item.evidence || []).some(evidence => /^https?:\/\//i.test(String(evidence?.url || ""))))
  .sort((left, right) => Number(right.opportunityScore || right.signalScore || 0) - Number(left.opportunityScore || left.signalScore || 0)
    || confidenceRank(right.evidenceConfidence) - confidenceRank(left.evidenceConfidence)
    || Number(right.signalScore || 0) - Number(left.signalScore || 0)
    || Number(right.independentSources || 0) - Number(left.independentSources || 0)
    || Number(right.evidenceCount || 0) - Number(left.evidenceCount || 0)
    || String(left.title || "").localeCompare(String(right.title || "")));
const expectedPriorityIds = eligible.slice(0, 4).map(item => item.id);
assert(strategy.priorityFramework?.items?.length === 4, "데이터 기반 상위 우선순위 4개가 필요합니다");
assert(JSON.stringify(strategy.priorityFramework.items.map(item => item.sourceOpportunityId)) === JSON.stringify(expectedPriorityIds),
  "전략 하우스 우선순위가 최신 기회 점수 순위와 일치하지 않습니다");
assert(strategy.priorityFramework.criteria?.length === 8
  && strategy.priorityFramework.items.every(item => item.drivers?.length && item.evidenceCount >= 2 && item.independentSources >= 2),
"우선순위 프레임의 점수 기준 또는 근거 Gate가 불완전합니다");
assert(!strategyBuilder.includes("PORTFOLIO_COVERAGE"), "특정 사업 축을 강제 배치하는 하드코딩이 남아 있습니다");
assert(strategy.expertSignals?.length >= 5, "제품·플랫폼 원문 근거가 5건 이상이어야 합니다");
assert(!/Competitive Platform Portfolio|User Moment → Experience Stack → Revenue/.test(boards), "삭제된 경쟁·사용자 순간 프레임이 남아 있습니다");
assert(!/Where to Play · How to Win/.test(boards) && !/msf-choices|msf-choice|msf-house-pillars/.test(boards), "삭제된 우선 플레이 UI가 남아 있습니다");
assert(/priorityFramework\.items/.test(boards) && /className="msf-priority-grid"/.test(boards), "전략 하우스가 생성 우선순위 데이터와 연결되지 않았습니다");
assert(/const recentSignalCount = Number\(c\.live\?\.mentions30 \|\| 0\)/.test(boards) && />최근 30일 신호</.test(boards), "기업 최근 신호는 AI 밸류체인 카드에만 유지해야 합니다");
assert(/Evidence-weighted Opportunity Portfolio/.test(boards) && /Product · Platform · Business Evidence/.test(boards), "신사업과 공식 근거 화면이 필요합니다");

assert(strategy.opportunityPortfolio.every(item =>
  item.sourceOpportunityId && item.title && item.thesis && item.gate && item.evidence?.length),
"신사업 포트폴리오가 누적 원장의 출처·판단 근거와 연결되지 않았습니다");
assert(strategy.lineage?.generatedFrom?.includes("mobile-ai-business-view.json"),
"신사업 포트폴리오의 누적 원장 lineage가 없습니다");
assert(/consultingModel\.methodology/.test(boards) && /msf-mece-model/.test(boards), "생성형 MECE 컨설팅 구조가 화면에 연결되지 않았습니다");
assert(/AI Stack별 사업 판단 기준/.test(boards) && /<span>사업 Action<\/span>/.test(boards), "AI Stack 판단 기준의 간결한 제목과 실행 헤더가 필요합니다");
assert(!/zone\.question|zone\.output|zone\.gate|controlZones/.test(boards), "삭제된 운영 모델 렌더링이 남아 있습니다");
assert(/msf-mece-stage-head/.test(boards), "MECE 단계 전환 구조가 없습니다");
assert(/전략 우선순위/.test(components) && /서비스·수익 모델/.test(components), "좌측 내비게이션이 MECE 전략 구조와 일치하지 않습니다");
assert(/모바일 AI 신사업 발굴 인텔리전스/.test(index), "페이지 메타 정보가 모바일 AI 신사업 발굴 목적과 일치하지 않습니다");
assert(/strategyData/.test(boards) && /strategy-view\.json/.test(app), "전략 화면이 자동 생성 뷰와 연결되지 않았습니다");
assert(/navigation=\{navigation\}/.test(app) && /navigation\.map\(item =>/.test(app), "좌측 메뉴와 본문이 하나의 생성 순서를 사용하지 않습니다");

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
