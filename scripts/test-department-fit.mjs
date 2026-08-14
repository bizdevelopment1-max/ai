#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { loadDash } from "./load-dash.mjs";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [dash, boards, components, app, index] = await Promise.all([
  loadDash(),
  readFile("boards.jsx", "utf8"),
  readFile("components.jsx", "utf8"),
  readFile("app.jsx", "utf8"),
  readFile("index.html", "utf8"),
]);

assert(dash.MEMORY_STRATEGY, "MEMORY_STRATEGY가 없습니다");
assert(dash.MEMORY_STRATEGY.choices?.length === 4, "부서 핵심 업무 4개 축이 필요합니다");
assert(dash.MEMORY_STRATEGY.capabilities?.length === 5, "분석 툴킷 5개 축이 필요합니다");
assert(/Customer Pain Point → Memory Solution → Executive Decision/.test(boards), "고객-솔루션-의사결정 흐름이 없습니다");
assert(/AI 메모리 전략/.test(components) && /신규 메모리 Biz\./.test(components), "좌측 내비게이션이 부서 업무와 일치하지 않습니다");
assert(/AI 메모리 전략 인텔리전스/.test(index), "페이지 메타 정보가 부서 목적과 일치하지 않습니다");
assert(!/MOBILE_STRATEGY|MobileStrategyBoard|Mobile AI Strategy/.test([boards, app, components, index].join("\n")), "이전 모바일 전략 명칭이 남아 있습니다");

const sourceGated = new Set(["DeepSeek", "Kling AI", "Hailuo (MiniMax)"]);
for (const company of dash.COMPANIES || []) {
  if (!sourceGated.has(company.name)) continue;
  assert(!company.note && !company.vp && !company.direction, `${company.name} 정적 전략 서술이 남아 있습니다`);
  assert(!company.valuation && !company.funding, `${company.name} 정적 수치가 남아 있습니다`);
}
assert(!(dash.ARTICLES || []).some(article => sourceGated.has(article.co)), "지역 기업의 정적 기사 스냅샷이 남아 있습니다");
assert(!Object.keys(dash.COMPANY_PROFILES || {}).some(name => sourceGated.has(name)), "지역 기업의 정적 프로필이 남아 있습니다");
assert(!Object.keys(dash.COMPANY_ORG || {}).some(name => sourceGated.has(name)), "지역 기업의 정적 조직 가정이 남아 있습니다");

console.log("department-fit: ok");
