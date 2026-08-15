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

assert(dash.MEMORY_STRATEGY, "MEMORY_STRATEGY가 없습니다");
assert(dash.MEMORY_STRATEGY.choices?.length === 4, "핵심 업무는 4개 축으로 구성해야 합니다");
assert(dash.MEMORY_STRATEGY.capabilities?.length === 5, "분석 툴킷은 5개 축이 필요합니다");
assert(dash.MEMORY_STRATEGY.operatingModel?.length === 4, "고객 신호부터 실행까지 4단계 운영 모델이 필요합니다");
assert(dash.MEMORY_STRATEGY.decisionOutputs?.length === 4, "경영진 의사결정 산출물은 4개 축이 필요합니다");
assert(dash.MEMORY_STRATEGY.accountPortfolio?.length >= 5, "계정 포트폴리오는 주요 AI 인프라 계정 5개 이상이어야 합니다");
assert(dash.MEMORY_STRATEGY.accountPortfolio.some(account => account.relation === "DIRECT EVIDENCE"), "직접 공개 근거 계정이 필요합니다");
assert(dash.MEMORY_STRATEGY.accountPortfolio.some(account => account.relation === "NO DIRECT CLAIM"), "공급 관계를 단정하지 않는 아키텍처 기준 계정이 필요합니다");
assert(dash.MEMORY_STRATEGY.accountPortfolio.every(account => /^https:\/\//.test(account.sourceUrl || "")), "모든 계정 카드에 공개 원문 URL이 필요합니다");
assert(dash.MEMORY_STRATEGY.workloadMap?.length >= 5, "워크로드-병목-메모리 맵은 5개 이상이어야 합니다");
assert(dash.MEMORY_STRATEGY.workloadMap.every(row => row.bottleneck && row.memory && row.opportunity && row.proof), "워크로드 맵은 병목·요구·사업기회·검증 KPI를 모두 포함해야 합니다");
assert(dash.MEMORY_STRATEGY.opportunityPortfolio?.length === 4, "신규 메모리 사업 포트폴리오는 4개 MECE 축이어야 합니다");
assert(dash.MEMORY_STRATEGY.expertSignals?.length >= 5, "데이터센터 HW·SW 전문 근거가 5건 이상이어야 합니다");
assert(/Key Account Portfolio/.test(boards) && /Workload → System Bottleneck → Memory/.test(boards), "계정과 워크로드 컨설팅 화면이 필요합니다");
assert(/New Memory Business Portfolio/.test(boards) && /Data Center Workload · HW · SW Evidence/.test(boards), "사업기회와 전문 근거 화면이 필요합니다");

const strategyText = JSON.stringify(dash.MEMORY_STRATEGY);
for (const required of [
  "주요 고객 현황·기술·전략",
  "AI App / HW / SW Opportunity",
  "신규 메모리 Biz. 기회",
  "SK hynix AI Infra 대내·대외",
]) {
  assert(strategyText.includes(required), `부서 업무 문구가 없습니다: ${required}`);
}
assert(/Strategy consulting · pain-point → memory solution → new Biz/.test(boards), "고객-솔루션-사업기회 컨설팅 흐름이 없습니다");
assert(/zone\.question/.test(boards) && /zone\.output/.test(boards) && /zone\.gate/.test(boards), "운영 모델의 질문·산출물·게이트가 표시되지 않습니다");
assert(/msf-flow-arrow/.test(boards), "단계 전환 화살표가 없습니다");
assert(/전략 컨설팅/.test(components) && /신규 메모리 Biz\./.test(components), "좌측 내비게이션이 부서 업무와 일치하지 않습니다");
assert(/AI 메모리 전략 인텔리전스/.test(index), "페이지 메타 정보가 부서 목적과 일치하지 않습니다");
assert(!/MOBILE_STRATEGY|MobileStrategyBoard|Mobile AI Strategy/.test([boards, app, components, index].join("\n")), "이전 모바일 전략 명칭이 남아 있습니다");

const removedSections = [
  "중국 인력 전략",
  "Policy maker direction · China / Korea / United States",
  "정책 방향성",
  "정책·팹 리스크",
  "인재/IP 리스크",
  "Talent and hiring early warning",
  "중국 메모리 인재·채용 레이더",
];
const uiText = [boards, components, app].join("\n");
for (const removed of removedSections) {
  assert(!uiText.includes(removed), `삭제된 섹션이 다시 노출됩니다: ${removed}`);
}

assert(/useInView\(sectionRef, 4200\)/.test(app), "하단 보드 선행 로딩 범위가 적용되지 않았습니다");
assert(/requestIdleCallback/.test(app) && /120 \+ sectionIndex \* 90/.test(app), "빠른 순차 백그라운드 예열이 적용되지 않았습니다");
assert(/scrollRestoration = "manual"/.test(app) && /setActive\("overview"\)/.test(app), "새 방문이 영상 브리핑에서 시작하도록 고정되지 않았습니다");
const videoIndex = app.indexOf('data-screen-label="AI Memory Video Brief"');
const strategyIndex = app.indexOf('<LazySection id="strategy"');
assert(videoIndex >= 0 && strategyIndex > videoIndex && app.slice(strategyIndex, strategyIndex + 160).includes("priority"), "첫 화면 영상 다음에 전략 컨설팅을 우선 렌더링해야 합니다");
assert(components.indexOf('id: "overview"') < components.indexOf('id: "strategy"'), "좌측 탭도 영상 다음 전략 컨설팅 순서여야 합니다");
const registrySource = components.slice(components.indexOf("const SECTION_REGISTRY"), components.indexOf("];", components.indexOf("const SECTION_REGISTRY")) + 2);
const registryIds = [...registrySource.matchAll(/id:\s*"([^"]+)"/g)].map(match => match[1]);
const rightSectionIds = [...app.matchAll(/(?:data-section|<LazySection id)="([^"]+)"/g)].map(match => match[1]);
assert(JSON.stringify(registryIds) === JSON.stringify(rightSectionIds), `좌측 탭과 우측 섹션 순서 불일치: ${registryIds.join(",")} / ${rightSectionIds.join(",")}`);
assert(/Object\.fromEntries\(NAV_SECTION_IDS\.map/.test(app), "좌우 섹션 ref가 단일 레지스트리에서 생성되어야 합니다");
assert(/executive-news-view\.json/.test(app) && /fullNewsLoaded/.test(app), "첫 화면 경량 기사 로딩 후 누적 기사 예열 구조가 필요합니다");
assert(/01 · EXECUTIVE BRIEF/.test(components) && /05 · EVIDENCE GOVERNANCE/.test(components), "좌측 탭에 컨설팅 워크스트림이 없습니다");
assert(/needsCompanyExtras/.test(app), "초기 화면과 상세 데이터 요청이 분리되지 않았습니다");
assert(/fmtNum\(p\.num, p\)/.test(anim), "숫자 첫 화면의 0 플래시 방지가 적용되지 않았습니다");
assert(/Math\.min\(dur \|\| 420, 620\)/.test(anim), "숫자 애니메이션 시간 상한이 적용되지 않았습니다");

for (const asset of ["styles.css", "data.bundle.js", "app.bundle.js"]) {
  const escaped = asset.replace(/\./g, "\\.");
  assert(new RegExp(`${escaped}\\?v=[a-f0-9]{16}`).test(index), `${asset} 캐시 버전이 콘텐츠 해시와 연결되지 않았습니다`);
}

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
