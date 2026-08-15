#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { loadDash } from "./load-dash.mjs";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [dash, boards, components, app, anim, index] = await Promise.all([
  loadDash(),
  readFile("boards.jsx", "utf8"),
  readFile("components.jsx", "utf8"),
  readFile("app.jsx", "utf8"),
  readFile("anim.jsx", "utf8"),
  readFile("index.html", "utf8"),
]);

assert(dash.MOBILE_STRATEGY, "MOBILE_STRATEGY가 없습니다");
assert(dash.MOBILE_STRATEGY.choices?.length === 4, "핵심 플레이는 4개 축으로 구성해야 합니다");
assert(dash.MOBILE_STRATEGY.capabilities?.length === 5, "분석 툴킷은 5개 축이 필요합니다");
assert(dash.MOBILE_STRATEGY.operatingModel?.length === 4, "사용자 신호부터 실행까지 4단계 운영 모델이 필요합니다");
assert(dash.MOBILE_STRATEGY.decisionOutputs?.length === 4, "경영진 의사결정 산출물은 4개 축이 필요합니다");
assert(dash.MOBILE_STRATEGY.accountPortfolio?.length >= 5, "경쟁 플랫폼 포트폴리오는 5개 이상이어야 합니다");
assert(dash.MOBILE_STRATEGY.accountPortfolio.every(account => account.relation === "OFFICIAL PRODUCT"), "경쟁 플랫폼은 공식 제품 근거만 사용해야 합니다");
assert(dash.MOBILE_STRATEGY.accountPortfolio.every(account => /^https:\/\//.test(account.sourceUrl || "")), "모든 경쟁 플랫폼 카드에 공식 원문 URL이 필요합니다");
assert(dash.MOBILE_STRATEGY.workloadMap?.length >= 5, "사용자 순간-플랫폼-사업기회 맵은 5개 이상이어야 합니다");
assert(dash.MOBILE_STRATEGY.workloadMap.every(row => row.bottleneck && row.platform && row.opportunity && row.proof), "사용자 순간 맵은 불편·플랫폼·사업기회·검증 KPI를 모두 포함해야 합니다");
assert(dash.MOBILE_STRATEGY.opportunityPortfolio?.length >= 9, "모바일 AI 신사업 포트폴리오는 보안·헬스·컴패니언·폴더블·위성 AI를 포함한 9개 이상이어야 합니다");
for (const id of ["on-device-trust-security", "clinical-health-ai", "companion-distribution"]) {
  assert(dash.MOBILE_STRATEGY.opportunityPortfolio.some(item => item.id === id), `신규 신사업 축이 없습니다: ${id}`);
}
assert(dash.MOBILE_STRATEGY.expertSignals?.length >= 5, "모바일 제품·플랫폼 공식 근거가 5건 이상이어야 합니다");
assert(/Competitive Platform Portfolio/.test(boards) && /User Moment → Experience Stack → Revenue/.test(boards), "경쟁 플랫폼과 사용자 순간 컨설팅 화면이 필요합니다");
assert(/Mobile AI New Business Portfolio/.test(boards) && /Mobile AI Product · Platform · Business Evidence/.test(boards), "신사업과 공식 근거 화면이 필요합니다");

const strategyText = JSON.stringify(dash.MOBILE_STRATEGY);
for (const required of [
  "개인 컨텍스트",
  "Multi-model Agent",
  "서비스 플랫폼·수익화",
  "AI 경험·버티컬 서비스",
]) {
  assert(strategyText.includes(required), `부서 업무 문구가 없습니다: ${required}`);
}
assert(/Strategy consulting · user need → mobile experience → revenue → execution/.test(boards), "사용자-경험-수익-실행 컨설팅 흐름이 없습니다");
assert(/AI Stack별 사업 판단 기준/.test(boards) && /<span>사업 Action<\/span>/.test(boards), "AI Stack 판단 기준의 간결한 제목과 실행 헤더가 필요합니다");
assert(/zone\.question/.test(boards) && /zone\.output/.test(boards) && /zone\.gate/.test(boards), "운영 모델의 질문·산출물·게이트가 표시되지 않습니다");
assert(/msf-flow-arrow/.test(boards), "단계 전환 화살표가 없습니다");
assert(/신사업 발굴 프레임/.test(components) && /AI 서비스 신사업/.test(components), "좌측 내비게이션이 모바일 AI 신사업 발굴 업무와 일치하지 않습니다");
assert(/모바일 AI 신사업 발굴 인텔리전스/.test(index), "페이지 메타 정보가 모바일 AI 신사업 발굴 목적과 일치하지 않습니다");
assert(/MX AI DECISION INTELLIGENCE/.test(boards) && /단말·기능 Matrix/.test(boards) && /Partner Score/.test(boards), "MX 의사결정 DB 화면이 필요합니다");
assert(/예상 BOM 영향/.test(boards) && /특허·소송 리스크/.test(boards) && /SVIC 포트폴리오/.test(boards), "MX 매핑 필드가 필요합니다");

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

assert(/useInView\(sectionRef, 3000\)/.test(app), "하단 보드 사전 로딩 범위가 적용되지 않았습니다");
assert(/needsCompanyExtras/.test(app), "초기 화면과 상세 데이터 요청이 분리되지 않았습니다");
assert(/fmtNum\(p\.num, p\)/.test(anim), "숫자 첫 화면의 0 플래시 방지가 적용되지 않았습니다");
assert(/Math\.min\(dur \|\| 420, 620\)/.test(anim), "숫자 애니메이션 시간 상한이 적용되지 않았습니다");

const sourceGated = new Set(["DeepSeek", "Kling AI", "Hailuo (MiniMax)"]);
for (const company of dash.COMPANIES || []) {
  if (!sourceGated.has(company.name)) continue;
  assert(!company.note && !company.vp && !company.direction, `${company.name} 정적 전략 서술이 남아 있습니다`);
  assert(!company.valuation && !company.funding, `${company.name} 정적 수치가 남아 있습니다`);
}
assert(!(dash.ARTICLES || []).some(article => sourceGated.has(article.co)), "소스 게이트 기업의 정적 기사가 남아 있습니다");
assert(!Object.keys(dash.COMPANY_PROFILES || {}).some(name => sourceGated.has(name)), "소스 게이트 기업의 정적 프로필이 남아 있습니다");
assert(!Object.keys(dash.COMPANY_ORG || {}).some(name => sourceGated.has(name)), "소스 게이트 기업의 정적 조직 가정이 남아 있습니다");

console.log("department-fit: ok");
