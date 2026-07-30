#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { BUNDLE_FILE, DATA_BUNDLE_FILE, DATA_SOURCE_FILE, readBrowserSources, sourceStamp } from "./build-browser-bundle.mjs";
import { loadDash } from "./load-dash.mjs";
import { articleFocusedOnCompany, directCompanyNewsMatch } from "./company-sources.mjs";
import { canonicalizeStartupSnapshot, companyRegistryHasDuplicates, sameCompany } from "./company-identity.mjs";
import { textSimilarity } from "./source-content.mjs";
import { bulletizeKorean, hasKoreanProseEnding, hasKoreanSentencePeriod } from "./korean-copy.mjs";

const required = [
  ".github/workflows/daily-news.yml",
  ".github/workflows/daily-news-update.yml",
  "scripts/crawl-news.mjs",
  "scripts/source-content.mjs",
  "scripts/refresh-source-content.mjs",
  "scripts/reframe-source-briefs.mjs",
  "scripts/crawl-stocks.mjs",
  "scripts/build-nvidia-investments.mjs",
  "scripts/crawl-financials.mjs",
  "scripts/company-sources.mjs",
  "scripts/crawl-company-officials.mjs",
  "scripts/crawl-companies.mjs",
  "scripts/company-identity.mjs",
  "scripts/normalize-company-registry.mjs",
  "scripts/crawl-startup-organizations.mjs",
  "scripts/crawl-monetization.mjs",
  "scripts/crawl-a16z-startups.mjs",
  "scripts/crawl-strategic-ventures.mjs",
  "scripts/build-company-intelligence.mjs",
  "scripts/build-company-news.mjs",
  "scripts/crawl-markets.mjs",
  "scripts/market-db.mjs",
  "scripts/refresh-market-source-content.mjs",
  "scripts/global-sources.mjs",
  "scripts/build-browser-bundle.mjs",
  "scripts/translate_summarize.py",
  "scripts/run-with-retry.mjs",
  "scripts/verify-pipeline.mjs",
  "scripts/build-public-data.mjs",
  "scripts/korean-copy.mjs",
  "scripts/audit-agent.mjs",
  "news.json",
  "company-news.json",
  "news-view.json",
  "research-view.json",
  "market-view.json",
  "infra-view.json",
  "bizmodel-view.json",
  "data-version.json",
  "stocks.json",
  "nvidia-investments.json",
  "financials.json",
  "companies.json",
  "startups.json",
  "a16z-startups.json",
  "strategic-ventures.json",
  "monetization.json",
  "quality.json",
  "history.json",
  "llm-health.json",
  "collection-health.json",
  "config/news-policy.json",
  "config/global-source-policy.json",
  "config/company-source-policy.json",
  "index.html",
  "app.bundle.js",
  "data.bundle.js",
  "og-mobile-strategy.png",
  "assets/quant-insight-capital.webp",
  "assets/quant-insight-device.webp",
  "assets/quant-insight-infra.webp",
  "assets/competitive-dynamics.mp4",
];

let failed = false;
console.log("자동화 구성 검사");
for (const file of required) {
  try {
    await access(file);
    if (file.endsWith(".json")) JSON.parse(await readFile(file, "utf8"));
    console.log(`  정상  ${file}`);
  } catch (error) {
    failed = true;
    console.error(`  실패  ${file}: ${error.message}`);
  }
}

try {
  const [index, news, boards, app, charts, crawler, builder, workflow, recoveryWorkflow] = await Promise.all([
    readFile("company-news.json", "utf8").then(JSON.parse),
    readFile("news.json", "utf8").then(JSON.parse),
    readFile("boards.jsx", "utf8"),
    readFile("app.jsx", "utf8"),
    readFile("charts.jsx", "utf8"),
    readFile("scripts/crawl-news.mjs", "utf8"),
    readFile("scripts/build-company-news.mjs", "utf8"),
    readFile(".github/workflows/daily-news.yml", "utf8"),
    readFile(".github/workflows/daily-news-update.yml", "utf8"),
  ]);
  const registry = loadDash().COMPANIES || [];
  const newsByUrl = new Map((news.articles || []).map(article => [article.url, article]));
  const mappedNames = Object.keys(index.companies || {});
  const everyCompanyMapped = mappedNames.length === registry.length
    && registry.every(company => Array.isArray(index.companies?.[company.name]));
  const assignments = registry.flatMap(company =>
    (index.companies?.[company.name] || []).map(article => ({ company, article })));
  const allDirect = assignments.every(({ company, article }) => {
    const original = newsByUrl.get(article.url) || article;
    const match = directCompanyNewsMatch(company.name, original, company.domain);
    return match.matched
      && ["headline-entity", "official-domain"].includes(article.companyMatch?.mode)
      && article.displayEligible !== false
      && article.summaryMode === "source-content-extractive"
      && article.provenance?.status === "source-backed";
  });
  const perCompanyUnique = registry.every(company => {
    const rows = index.companies?.[company.name] || [];
    return rows.length <= 8
      && new Set(rows.map(article => article.url)).size === rows.length
      && new Set(rows.map(article => String(article.titleEn || article.title || "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, ""))).size === rows.length;
  });
  const uiStatusCopy = /수집\s*중|자료\s*없음|정보\s*없음|데이터\s*없음|갱신을 기다|자동 갱신을 기다|관련 기사가 없습니다/i;
  const strictUi = app.includes('fetch(dataUrl("company-news.json")')
    && app.includes("companyNews={companyNews}")
    && boards.includes("Array.isArray(companyNews?.[c.name])")
    && boards.includes("기업 직접 연관 뉴스")
    && !boards.includes(".filter(a => a.cat === c.cat)")
    && !uiStatusCopy.test(`${app}\n${boards}\n${charts}`);
  const automated = crawler.includes("loadDash().COMPANIES")
    && crawler.includes("newsQueryFor(company.name)")
    && crawler.includes("directCompanyNewsMatch")
    && crawler.includes("pool(COMPANIES, 8")
    && builder.includes("headline-entity-or-official-domain")
    && workflow.includes("scripts/build-company-news.mjs")
    && recoveryWorkflow.includes("scripts/build-company-news.mjs")
    && workflow.includes("company-news.json")
    && recoveryWorkflow.includes("company-news.json");
  if (index.schemaVersion !== 1
    || index.methodology !== "source-backed+headline-entity-or-official-domain+canonical-url-dedupe"
    || !everyCompanyMapped || !allDirect || !perCompanyUnique || assignments.length < 10
    || index.coverage?.companiesTracked !== registry.length || !strictUi || !automated) {
    throw new Error("company news must be direct-entity matched, source-backed, deduplicated and generated for the complete registry");
  }
  console.log(`  OK  기업 직접 연관 뉴스 ${assignments.length}건 · ${index.coverage.companiesWithNews}/${registry.length}개사 · 빈 상태 문구 없음`);
} catch (error) {
  failed = true;
  console.error(`  FAIL  company-specific news index: ${error.message}`);
}

try {
  const [sources, bundle, dataSource, dataBundle, index] = await Promise.all([
    readBrowserSources(),
    readFile(BUNDLE_FILE, "utf8"),
    readFile(DATA_SOURCE_FILE, "utf8"),
    readFile(DATA_BUNDLE_FILE, "utf8"),
    readFile("index.html", "utf8"),
  ]);
  const expected = `/* ai-dashboard-bundle:${sourceStamp(sources)} */`;
  const expectedData = `/* ai-dashboard-data:${sourceStamp([{ file: DATA_SOURCE_FILE, source: dataSource }])} */`;
  if (!bundle.startsWith(expected)) throw new Error("bundle is stale; run npm run build:browser before publishing");
  if (!dataBundle.startsWith(expectedData)) throw new Error("data bundle is stale; run npm run build:browser before publishing");
  if (/babel\.min\.js|text\/babel/.test(index)
    || !/defer src="app\.bundle\.js/.test(index)
    || !/defer src="data\.bundle\.js/.test(index)) {
    throw new Error("index must serve the compact browser and data bundles without a runtime compiler");
  }
  console.log("  정상  browser and data bundles are current (no runtime compiler)");
} catch (error) {
  failed = true;
  console.error(`  실패  browser bundle: ${error.message}`);
}

try {
  const [app, components, anim] = await Promise.all([
    readFile("app.jsx", "utf8"),
    readFile("components.jsx", "utf8"),
    readFile("anim.jsx", "utf8"),
  ]);
  const navIds = [...components.matchAll(/\{\s*id:\s*"([^"]+)".*?\}/g)].map(match => match[1]);
  const sectionIds = [...app.matchAll(/(?:<LazySection\s+id=|data-section=)"([^"]+)"/g)].map(match => match[1]);
  const missingOnRight = navIds.filter(id => !sectionIds.includes(id));
  const missingOnLeft = sectionIds.filter(id => !navIds.includes(id));
  if (missingOnRight.length || missingOnLeft.length
    || !/for \(const id of NAV_SECTION_IDS\)/.test(app)
    || /if \(REDUCED\) \{ setInView\(true\)/.test(anim)) {
    throw new Error(`navigation mismatch left-only=${missingOnRight.join(",")} right-only=${missingOnLeft.join(",")}`);
  }
  console.log(`  정상  left navigation maps 1:1 to ${navIds.length} right-side sections`);
} catch (error) {
  failed = true;
  console.error(`  실패  navigation mapping: ${error.message}`);
}

try {
  const boards = await readFile("boards.jsx", "utf8");
  const marketSummaryStart = boards.indexOf('<div className="mkt-db-summary">');
  const marketSummaryEnd = boards.indexOf('<div className="mkt-db-head">', marketSummaryStart);
  const marketSummary = marketSummaryStart >= 0 && marketSummaryEnd > marketSummaryStart
    ? boards.slice(marketSummaryStart, marketSummaryEnd).trimEnd() : "";
  const marketSummaryClosesCleanly = marketSummary.endsWith("</div>") && !/}\s*<\/div>$/.test(marketSummary);
  if (!marketSummaryClosesCleanly) throw new Error("market summary has a stray closing-brace character in rendered markup");
  console.log("  OK  market summary markup has no stray closing-brace character");
} catch (error) {
  failed = true;
  console.error(`  FAIL  rendered board markup: ${error.message}`);
}

try {
  const boards = await readFile("boards.jsx", "utf8");
  const removedBriefUi = [
    'className="ib-meta"',
    'className="ib-summary"',
    'className="ib-bottom"',
    'className="ib-foot"',
    "매일 자동 크롤링 · 한글 제목·원문 기반 3줄 브리핑",
  ];
  if (removedBriefUi.some(text => boards.includes(text))) {
    throw new Error("removed research briefing copy is still rendered");
  }
  console.log("  OK  removed research briefing copy is not rendered");
} catch (error) {
  failed = true;
  console.error(`  FAIL  research briefing cleanup: ${error.message}`);
}

try {
  const styles = await readFile("styles.css", "utf8");
  const compactLeftWideRight = styles.includes("grid-template-columns: minmax(150px, .85fr) minmax(125px, .65fr) minmax(100px, .52fr) minmax(120px, .62fr) minmax(0, 5.7fr);");
  const leftCellsWrap = styles.includes("white-space: normal; overflow-wrap: anywhere; line-height: 1.28;");
  const notesWrap = styles.includes("line-height: 1.55; overflow-wrap: anywhere; text-wrap: pretty;");
  const sentenceLines = styles.includes(".ct-note-line { display: block;");
  if (!compactLeftWideRight || !leftCellsWrap || !notesWrap || !sentenceLines) {
    throw new Error("company table must keep compact left columns, a wide comment column, and separate sentence lines");
  }
  console.log("  OK  company table uses compact left columns, a wide comment column, and separate sentence lines");
} catch (error) {
  failed = true;
  console.error(`  FAIL  company table readability: ${error.message}`);
}

try {
  const [app, boards, components, companies, monetizationCrawler] = await Promise.all([
    readFile("app.jsx", "utf8"),
    readFile("boards.jsx", "utf8"),
    readFile("components.jsx", "utf8"),
    readFile("companies.json", "utf8").then(JSON.parse),
    readFile("scripts/crawl-monetization.mjs", "utf8"),
  ]);
  const dash = loadDash();
  const layerIds = (dash.VALUE_CHAIN || []).map(layer => layer.id);
  const expectedLayers = ["app", "agent", "service", "trust", "model", "data", "infra"];
  const normalized = (dash.COMPANIES || []).map(company => companies.companies?.[company.name]).filter(Boolean);
  const completeCoverage = normalized.every(company => company.profile && company.organization
    && Number.isFinite(company.coverage?.profile?.score)
    && Number.isFinite(company.coverage?.organization?.score)
    && Array.isArray(company.organization?.executiveTeam)
    && Number.isFinite(company.coverage?.organization?.executiveCount)
    && company.updatedAt);
  const linkedinProfiles = Object.values(dash.LINKEDIN_PROFILES || {});
  const linkedinReady = linkedinProfiles.length >= 10
    && linkedinProfiles.every(url => /^https:\/\/(?:(?:www|[a-z]{2})\.)?linkedin\.com\/in\/[^/?#]+\/?$/.test(url))
    && !boards.includes("linkedin.com/search/results/people")
    && !boards.includes("linkedin.com/search/results/companies");
  const strategyReady = dash.MOBILE_STRATEGY?.choices?.length === 4
    && dash.MOBILE_STRATEGY?.horizons?.length === 3
    && boards.includes("function MobileStrategyBoard")
    && boards.includes("function StrategyPortfolioCard")
    && boards.includes("function ConsultingDecisionRail")
    && boards.includes("Where to Play / How to Win")
    && boards.includes("Business · Economics · Direction · Capital")
    && boards.includes('className="msf-strategy-house"')
    && boards.includes('className="msf-control-logic"')
    && boards.includes('className="msf-layer-evidence"')
    && !boards.includes("msf-layer-meter")
    && boards.includes('className="vc-logic-map"')
    && boards.includes('className="consult-decision-rail"')
    && boards.includes('className="cd-sf-link"')
    && boards.includes('className="cd-mece-route"')
    && boards.includes('className="cd-org-tier-groups"')
    && ["현재 사업", "Biz Model", "사업 방향", "최근 실행"].every(label => boards.includes(`>${label}<`))
    && boards.includes('className="vc-portfolio-grid"')
    && boards.includes('className="startup-portfolio-grid"')
    && boards.includes("const rows = (companies || []).filter(c => c.layer === layerId)")
    && boards.includes("claimUniqueCompanies")
    && !boards.includes("PORTFOLIO DECISION")
    && !boards.includes("STRATEGIC MOVE")
    && !boards.includes("옵션 확보 · 신호 감시")
    && !boards.includes("<h4>밸류 프로포지션")
    && !boards.includes("<h4>방향성 · 추구 가치")
    && app.includes('id="strategy"')
    && expectedLayers.every(id => components.includes(`id: "${id}"`))
    && monetizationCrawler.includes("loadDash().COMPANY_LAYER");
  if (JSON.stringify(layerIds) !== JSON.stringify(expectedLayers)
    || normalized.length !== (dash.COMPANIES || []).length
    || companies.schemaVersion !== 5 || !completeCoverage || !strategyReady || !linkedinReady) {
    const causes = [
      JSON.stringify(layerIds) !== JSON.stringify(expectedLayers) && "layer-order",
      normalized.length !== (dash.COMPANIES || []).length && `normalized-${normalized.length}/${(dash.COMPANIES || []).length}`,
      companies.schemaVersion !== 5 && `schema-${companies.schemaVersion}`,
      !completeCoverage && "profile-coverage",
      !strategyReady && "strategy-ui",
      !linkedinReady && `linkedin-${linkedinProfiles.length}`,
    ].filter(Boolean).join(", ");
    throw new Error(`seven-layer strategy, MECE portfolio UI, normalized profiles, or verified LinkedIn links are incomplete (${causes})`);
  }
  console.log(`  OK  단말 AI 7계층 전략 프레임 · 기업 ${normalized.length}개 MECE 개요/조직 · LinkedIn 직접 연결`);
} catch (error) {
  failed = true;
  console.error(`  FAIL  mobile strategy and company normalization: ${error.message}`);
}

try {
  const [boards, companies, startups, companyCrawler, startupCrawler] = await Promise.all([
    readFile("boards.jsx", "utf8"),
    readFile("companies.json", "utf8").then(JSON.parse),
    readFile("startups.json", "utf8").then(JSON.parse),
    readFile("scripts/crawl-companies.mjs", "utf8"),
    readFile("scripts/crawl-startup-organizations.mjs", "utf8"),
  ]);
  const companyRows = Object.values(companies.companies || {});
  const startupRows = [...(startups.large || []), ...(startups.small || []), ...(startups.institutional || [])];
  const organizationRows = [...companyRows, ...startupRows].map(row => row.organization).filter(Boolean);
  const people = organizationRows.flatMap(organization => organization.executiveTeam || []);
  const depthReady = organizationRows.every(organization =>
    Array.isArray(organization.executiveTeam) && organization.executiveTeam.length <= 12);
  const directProfilesVerified = people.filter(person => person.li).every(person =>
    /^https:\/\/(?:(?:www|[a-z]{2,3})\.)?linkedin\.com\/in\/[A-Za-z0-9._%-]+\/?$/i.test(person.li)
    && /^(curated-direct-profile|official-jsonld-direct-profile|wikidata-property-direct-profile)$/.test(person.linkedinVerification || ""));
  const nodeDetailReady = boards.includes(">학교·전공<")
    && boards.includes(">빅테크·주요 경력<")
    && boards.includes("Business Unit Leadership")
    && boards.includes(".slice(0, 11)")
    && !boards.includes('className="cd-org-note"');
  const refreshReady = companyCrawler.includes("const MAX_EXECUTIVES = 12")
    && startupCrawler.includes("const MAX_EXECUTIVES = 12")
    && companyCrawler.includes("roleSourceType")
    && companyCrawler.includes("linkedinVerification")
    && startupCrawler.includes("linkedinVerification");
  if (!depthReady || !directProfilesVerified || !nodeDetailReady || !refreshReady) {
    throw new Error("12-person leadership merge, in-node background detail, direct-profile verification, or recurring normalization is incomplete");
  }
  console.log(`  OK  전체 기업 조직도 ${organizationRows.length}개 · 최대 12명 · 학교·전공·경력 노드 통합 · LinkedIn 직접 프로필 검증`);
} catch (error) {
  failed = true;
  console.error(`  FAIL  organization depth and direct LinkedIn integrity: ${error.message}`);
}

try {
  const [boards, styles] = await Promise.all([readFile("boards.jsx", "utf8"), readFile("styles.css", "utf8")]);
  const consultingInteraction = boards.includes("function ConsultingDecisionRail")
    && boards.includes('aria-label="스타트업 전략 분석 프레임"')
    && ["FACT BASE", "REVENUE ENGINE", "STRATEGY VECTOR", "EXECUTIVE MAP"].every(label => boards.includes(label))
    && styles.includes("CONSULTING INTERACTION SYSTEM")
    && styles.includes("transform-style: preserve-3d")
    && styles.includes("perspective(900px)")
    && styles.includes("@keyframes msfArrowDrive")
    && styles.includes(".msf-mrow:not(.msf-mhead):is(:hover, :focus-visible)")
    && styles.includes("@media (hover: hover) and (pointer: fine)")
    && styles.includes(".consult-decision-rail > i")
    && styles.includes("border-left: 11px solid var(--consult-gold)")
    && styles.includes("Full-surface palette reversal")
    && styles.includes("@media (prefers-reduced-motion: reduce)")
    && !styles.includes("filter: invert(");
  if (!consultingInteraction) {
    throw new Error("consulting flow, triangular arrows, full-palette reversal, and reduced-motion-safe 3D interaction are required");
  }
  console.log("  OK  컨설팅 의사결정 도식 · 삼각형 화살표 · 전체 색상 반전 · 3D 호버");
} catch (error) {
  failed = true;
  console.error(`  FAIL  consulting 3D interaction system: ${error.message}`);
}

try {
  const [index, boards, styles, data, sourceContent, monetizationCrawler] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("boards.jsx", "utf8"),
    readFile("styles.css", "utf8"),
    readFile("data.js", "utf8"),
    readFile("scripts/source-content.mjs", "utf8"),
    readFile("scripts/crawl-monetization.mjs", "utf8"),
  ]);
  const uiWithoutEncodingGuard = boards.replace(/const MALFORMED_DISPLAY_ENCODING = .*?;\r?\n/, "");
  const visibleSource = `${uiWithoutEncodingGuard}\n${data}\n${index}\n${styles}`;
  const brokenText = /\uFFFD|(?:Ã.|Â.|â[€™“”¦])|(?:ðŸ)|(?:\?[가-힣]){2,}/.test(visibleSource);
  const utf8Ready = /<meta charset="UTF-8"/.test(index)
    && /charset=UTF-8/.test(index)
    && /pretendard\.min\.css/.test(index)
    && boards.includes("function safeDisplayString")
    && sourceContent.includes("malformed-source-encoding");
  const professionalSystem = boards.includes('className="mplay-framework"')
    && boards.includes("STRATEGY EVIDENCE ARCHITECTURE")
    && ["FACT BASE", "REVENUE ENGINE", "EXECUTION VECTOR", "COMPANY VIEW"].every(label => boards.includes(label))
    && styles.includes(".mplay-framework-flow")
    && styles.includes("@keyframes mplayEvidenceSweep")
    && styles.includes("grid-template-columns: repeat(auto-fit, minmax(min(100%, 350px), 1fr))")
    && styles.includes(".mplay-card:is(:hover, :focus-within)")
    && styles.includes("border-top: 4px solid var(--accent)")
    && !/\.mplay-card\s*\{[^}]*border-left:/s.test(styles)
    && ["#66558C", "#397A68", "#3E648D", "#A56A35", "#6E607D", "#8B5366", "#287A78"]
      .every(color => monetizationCrawler.includes(color));
  if (brokenText || !utf8Ready || !professionalSystem) {
    const causes = [
      brokenText && "visible-mojibake",
      !utf8Ready && "utf8-guard",
      !professionalSystem && "visual-system",
    ].filter(Boolean).join(", ");
    throw new Error(`UTF-8 guard, restrained consulting palette, evidence infographic, responsive fill, or motion-safe card interaction is incomplete (${causes})`);
  }
  console.log("  OK  UTF-8 표시 방어 · 전문 컨설팅 팔레트 · 근거→수익→실행→전략 인포그래픽");
} catch (error) {
  failed = true;
  console.error(`  FAIL  professional visual and encoding system: ${error.message}`);
}

try {
  const [startups, workflow, startupOrgCrawler, boards] = await Promise.all([
    readFile("startups.json", "utf8").then(JSON.parse),
    readFile(".github/workflows/daily-news.yml", "utf8"),
    readFile("scripts/crawl-startup-organizations.mjs", "utf8"),
    readFile("boards.jsx", "utf8"),
  ]);
  const rows = [...(startups.large || []), ...(startups.small || []), ...(startups.institutional || [])];
  const schemaParity = rows.length >= 100 && rows.every(row =>
    row.profile && Array.isArray(row.profile.business)
    && row.organization && Array.isArray(row.organization.executiveTeam)
    && Array.isArray(row.organization.officialPages)
    && Number.isFinite(row.coverage?.profile?.score)
    && Number.isFinite(row.coverage?.organization?.score)
    && Number.isFinite(row.coverage?.organization?.executiveCount));
  const supportedPeople = rows.flatMap(row => row.organization.executiveTeam || []).every(person =>
    person.name && person.role
    && /^(?:official-role-match|knowledge-graph-domain-match|official-page-name-match)$/.test(person.verification || "")
    && /^https?:\/\//i.test(person.verificationUrl || ""));
  const directProfiles = rows.flatMap(row => row.organization.executiveTeam || [])
    .map(person => person.li).filter(Boolean);
  const directLinkedInOnly = directProfiles.every(url =>
    /^https:\/\/(?:(?:www|[a-z]{2})\.)?linkedin\.com\/in\/[A-Za-z0-9._%-]+\/?$/i.test(url));
  const badExtractedNames = rows.flatMap(row => row.organization.executiveTeam || []).some(person =>
    /(?:cookie preferences|director manager|individual admin|\b(?:CEO|CTO|CFO|COO)\b.*\b(?:CEO|CTO|CFO|COO)\b|\b(?:investors?|advisory|engineering|product|customer|company|pitch|hiring)\b)/i.test(person.name || "")
    || /[{};]|\/\*|\*\//.test(person.role || ""));
  const automationReady = /crawl-startup-organizations\.mjs/.test(workflow)
    && /STARTUP_ORG_REFRESH_BUDGET:\s*36/.test(workflow)
    && startupOrgCrawler.includes("P856")
    && startupOrgCrawler.includes("retained-verified-snapshot")
    && startupOrgCrawler.includes("official-role-match")
    && startupOrgCrawler.includes("trustedLeadershipPath")
    && startupOrgCrawler.includes("reliableExtractedPerson")
    && !startupOrgCrawler.includes("linkedin.com/search/results")
    && boards.includes("s.organization")
    && boards.includes("s.profile");
  if (!schemaParity || !supportedPeople || !directLinkedInOnly || badExtractedNames || !automationReady) {
    throw new Error("startup profile, founder/executive organization, evidence, or recurring refresh parity is incomplete");
  }
  console.log(`  OK  스타트업 ${rows.length}개 기업 개요·창업자·임원 조직도 동일 스키마 · 근거 URL·직접 LinkedIn 검증`);
} catch (error) {
  failed = true;
  console.error(`  FAIL  startup company-depth parity: ${error.message}`);
}

try {
  const [startups, boards, startupCrawler, companyCrawler] = await Promise.all([
    readFile("startups.json", "utf8").then(JSON.parse),
    readFile("boards.jsx", "utf8"),
    readFile("scripts/crawl-startups.mjs", "utf8"),
    readFile("scripts/crawl-companies.mjs", "utf8"),
  ]);
  const registry = startups.companyRegistry || {};
  const visibleRows = [...(startups.large || []), ...(startups.small || []), ...(startups.institutional || [])];
  const ids = visibleRows.map(row => row.canonicalId).filter(Boolean);
  const canonicalRegistryReady = startups.schemaVersion === 3
    && registry.method === "official-domain+operator-legal-name+canonical-display-priority"
    && registry.uniqueDisplayedCompanies === visibleRows.length
    && registry.duplicateRecordsMerged > 0
    && Array.isArray(registry.trackedReferences)
    && !companyRegistryHasDuplicates(startups, loadDash().COMPANIES || [])
    && JSON.stringify(canonicalizeStartupSnapshot(startups, loadDash().COMPANIES || [])) === JSON.stringify(startups)
    && !sameCompany({ name: "Scale AI", domain: "scale.com" }, { name: "Nova", publisher: "SCALEUP YAZILIM HIZMETLERI" })
    && !sameCompany({ name: "Meitu" }, { name: "Meituan" })
    && ids.length === visibleRows.length
    && new Set(ids).size === ids.length
    && startupCrawler.includes("canonicalizeStartupSnapshot")
    && companyCrawler.includes("allowedCompanyNames")
    && boards.includes("claimUniqueCompanies")
    && boards.includes("const trackedA16z =")
    && boards.includes('const extensions = ["cloud", "deepmind"')
    && boards.includes("a16z 선정 운영사")
    && boards.includes("대표 계층")
    && !boards.includes("Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x))")
    && !boards.includes("c.layer === layerId || (c.adjacentLayers || []).includes(layerId)");
  if (!canonicalRegistryReady) {
    throw new Error("company aliases and cross-portfolio records must resolve to one canonical display owner");
  }
  console.log(`  OK  canonical company registry · ${registry.rawStartupRecords}개 입력 → ${visibleRows.length}개 단일 배치 · ${registry.duplicateRecordsMerged}개 중복 통합`);
} catch (error) {
  failed = true;
  console.error(`  FAIL  canonical company de-duplication: ${error.message}`);
}

try {
  const [companies, officials, startups, a16z, ventures, news, workflow, intelligenceBuilder, companyCrawler, llmClient] = await Promise.all([
    readFile("companies.json", "utf8").then(JSON.parse),
    readFile("company-officials.json", "utf8").then(JSON.parse),
    readFile("startups.json", "utf8").then(JSON.parse),
    readFile("a16z-startups.json", "utf8").then(JSON.parse),
    readFile("strategic-ventures.json", "utf8").then(JSON.parse),
    readFile("news.json", "utf8").then(JSON.parse),
    readFile(".github/workflows/daily-news.yml", "utf8"),
    readFile("scripts/build-company-intelligence.mjs", "utf8"),
    readFile("scripts/crawl-companies.mjs", "utf8"),
    readFile("scripts/llm.mjs", "utf8"),
  ]);
  const statusCopy = /(?:수집|확인|분석|업데이트|준비)\s*중|입력되지|신호\s*(?:없음|대기)|데이터\s*없음|표시할\s+.+없/i;
  const portfolioNames = new Set((loadDash().COMPANIES || []).map(company => company.name));
  const intelligenceReady = Object.entries(companies.companies || {}).every(([name, company]) => {
    const value = company.intelligence || {};
    const sections = ["currentBusiness", "revenueModel", "strategyDirection", "investmentDirection"];
    // Accuracy takes precedence over artificial completeness: the company
    // scope must be present, while revenue/strategy/capital sections may stay
    // blank until a source-backed or profile-grounded claim exists.
    const portfolioCoverage = !portfolioNames.has(name) || value.currentBusiness?.summary;
    const noOperationalCopy = sections.every(key =>
      !statusCopy.test(`${value[key]?.summary || ""} ${(value[key]?.details || []).join(" ")}`));
    const groundedOrBlank = sections.every(key =>
      !value[key]?.summary
      || (value[key]?.evidence || []).some(ref => /^https?:\/\//.test(String(ref?.url || "")))
      || value[key]?.groundingStatus === "profile-grounded");
    return portfolioCoverage && noOperationalCopy
      && groundedOrBlank
      && Array.isArray(value.corePractices) && Array.isArray(value.newBusinessModels)
      && Array.isArray(value.executiveQuotes)
      && value.evidenceFingerprint
      && value.groundingStatus === "numeric-and-source-reference-checked"
      && sections.every(key => value[key]?.confidence && value[key]?.groundingStatus);
  });
  const companyRows = Object.values(companies.companies || {});
  const aiCompanies = companyRows.filter(company => company.intelligence?.engine?.startsWith("github-models:")).length;
  const configuredAiBudget = Number(workflow.match(/COMPANY_INTELLIGENCE_AI_BUDGET:\s*(\d+)/)?.[1] || 0);
  const a16zReady = a16z.web?.length === 50 && a16z.mobile?.length === 50
    && startups.institutionalSource?.webCount === 50
    && startups.institutionalSource?.mobileCount === 50
    && startups.companyRegistry?.a16zUniqueCompanies >= 70
    && startups.institutionalSource?.uniqueCount === startups.companyRegistry?.a16zUniqueCompanies
    && startups.institutionalSource?.url === "https://a16z.com/100-gen-ai-apps-6/";
  const ventureCases = Object.values(ventures.companies || {}).flat();
  const ventureReady = ventureCases.some(item => item.id === "openai-deployco")
    && ventureCases.some(item => item.id === "anthropic-enterprise-ai-services")
    && ventures.comparison?.operatorMove
    && ventures.comparison?.market?.source?.url;
  const workflowReady = /models:\s*read/.test(workflow)
    && /crawl-company-officials\.mjs/.test(workflow)
    && /crawl-a16z-startups\.mjs/.test(workflow)
    && /crawl-strategic-ventures\.mjs/.test(workflow)
    && /build-company-intelligence\.mjs/.test(workflow)
    && /PIPELINE_TIMEOUT_MS:\s*1200000/.test(workflow)
    && /GITHUB_MODELS_MAX_RETRY_WAIT_MS:\s*20000/.test(workflow)
    && configuredAiBudget === 6;
  const grounded = intelligenceBuilder.includes("evidenceIds")
    && intelligenceBuilder.includes("publisher evidence")
    && intelligenceBuilder.includes("quoteOriginal")
    && intelligenceBuilder.includes("articleFocusedOnCompany")
    && intelligenceBuilder.includes("numericTokens")
    && intelligenceBuilder.includes("nearDuplicateClaim")
    && intelligenceBuilder.includes("const useModel = clean(value?.summary) && refs.length > 0")
    && intelligenceBuilder.includes("companies.json.checkpoint")
    && intelligenceBuilder.includes("persistCompanyData")
    && intelligenceBuilder.includes("COMPANY_INTELLIGENCE_AI_BUDGET")
    && intelligenceBuilder.includes("modelQueue")
    && companyCrawler.includes("articleFocusedOnCompany")
    && llmClient.includes("GITHUB_MODELS_MAX_RETRY_WAIT_MS")
    && llmClient.includes("advertisedWait > 300");
  const officialReady = officials.schemaVersion === 1
    && officials.methodology === "official-page-recrawl+exact-executive-name-and-role-context-match"
    && Object.keys(officials.companies || {}).length >= 30;
  const newsByUrl = new Map((news.articles || []).map(article => [article.url, article]));
  const companyEvidenceFocused = Object.entries(companies.companies || {}).every(([name, company]) =>
    ["currentBusiness", "revenueModel", "strategyDirection", "investmentDirection"].every(key =>
      (company.intelligence?.[key]?.evidence || []).every(ref => {
        const article = newsByUrl.get(ref.url);
        return !article || articleFocusedOnCompany(name, article);
      })));
  if (!intelligenceReady
    || !a16zReady || !ventureReady || !workflowReady || !grounded || !officialReady || !companyEvidenceFocused) {
    throw new Error("company intelligence must remain source-grounded or blank, with a16z 50+50 and strategic-venture automation intact");
  }
  console.log(`  OK  기업 인텔리전스 ${companyRows.length}개 · AI ${aiCompanies}개 · a16z Web 50/Mobile 50 · DeployCo/JV 근거 자동화`);
} catch (error) {
  failed = true;
  console.error(`  FAIL  deep company intelligence automation: ${error.message}`);
}

try {
  const [data, financialCrawler] = await Promise.all([
    readFile("data.js", "utf8"),
    readFile("scripts/crawl-financials.mjs", "utf8"),
  ]);
  if (data.includes("승계 예정") || data.includes("2026.09.01 사임")
    || /headcount:\s*"약 [^"]+보도 추정/.test(data)
    || !financialCrawler.includes("HEADCOUNT_MAX_AGE_MONTHS")
    || !financialCrawler.includes("employeesStale")) {
    throw new Error("unverified succession or stale headcount can still be presented as current");
  }
  console.log("  OK  비공식 승계설 제거 · 오래된 인력 수 현행값 차단");
} catch (error) {
  failed = true;
  console.error(`  FAIL  volatile fact freshness: ${error.message}`);
}

try {
  const styles = await readFile("styles.css", "utf8");
  const forbiddenRoundedSideAccents = [
    /\.msf-layer\s*\{[^}]*border-top:/s,
    /\.cd-strategy-frame\s*\{[^}]*border-top:/s,
    /\.cd-sf-card\.action\s*\{[^}]*border-left:/s,
    /\.cd-sf-card\.risk\s*\{[^}]*border-left:/s,
    /\.tl-card\s*\{[^}]*border-left:/s,
    /\.nbz-deal\s*\{[^}]*border-top:/s,
    /\.acb-camp\s*\{[^}]*border-top:/s,
  ];
  if (forbiddenRoundedSideAccents.some(pattern => pattern.test(styles))
    || !styles.includes(".sp-card")
    || !styles.includes("border: 1px solid color-mix(in srgb, var(--accent) 34%, var(--line));")) {
    throw new Error("rounded strategy cards must use full-card border/background emphasis");
  }
  console.log("  OK  둥근 카드 단측 강조 제거 · 전체 테두리/배경 강조 적용");
} catch (error) {
  failed = true;
  console.error(`  FAIL  rounded-card emphasis rule: ${error.message}`);
}

try {
  const policy = JSON.parse(await readFile("config/global-source-policy.json", "utf8"));
  if (!Array.isArray(policy.locales) || policy.locales.length < 5 || !policy.locales.every(locale => locale.id && locale.region && locale.language && locale.hl && locale.gl && locale.ceid)) {
    throw new Error("global source policy needs at least five complete regional locale definitions");
  }
  console.log(`  정상  글로벌 비기사 수집 범위 ${policy.locales.length}개 지역·언어 로캘`);
} catch (error) {
  failed = true;
  console.error(`  실패  global source policy: ${error.message}`);
}

try {
  const [companyPolicy, crawler, data, boards] = await Promise.all([
    readFile("config/company-source-policy.json", "utf8").then(JSON.parse),
    readFile("scripts/crawl-news.mjs", "utf8"),
    readFile("data.js", "utf8"),
    readFile("boards.jsx", "utf8"),
  ]);
  const block = name => {
    const start = data.indexOf(`name: "${name}"`);
    const end = data.indexOf("\n    },", start);
    return start >= 0 && end > start ? data.slice(start, end) : "";
  };
  const openai = block("OpenAI");
  const anthropic = block("Anthropic");
  const amazon = block("Amazon");
  const meta = block("Meta AI");
  const databricks = block("Databricks");
  const requiredDomains = ["openai.com", "anthropic.com", "nvidianews.nvidia.com", "investors.cerebras.ai"];
  if (companyPolicy.cardRules?.requireIndividualSourceUrl !== true
    || companyPolicy.cardRules?.separateOfficialFromEstimate !== true
    || !requiredDomains.every(domain => companyPolicy.publisherDomains?.includes(domain))
    || !Array.isArray(companyPolicy.priorityStreams) || companyPolicy.priorityStreams.length < 4
    || !/PRIORITY_STREAMS/.test(crawler) || !/companySourcePolicy\.publisherDomains/.test(crawler)
    || !openai.includes("공모 시점 미정") || openai.includes("2026.09 상장")
    || !anthropic.includes("3자 추정 $69B") || !anthropic.includes('tier: "official"')
    || amazon.includes("AWS AI ARR") || amazon.includes("$14B+")
    || meta.includes("QoQ -5% 역대 첫 감소") || !databricks.includes('valuation: "$188B"')
    || !/source\.tier === "official"/.test(boards) || !/source\.url/.test(boards)) {
    throw new Error("company facts need dated individual sources, estimate labels, and corrected priority-card claims");
  }
  console.log("  OK  company fact policy, priority source streams, and corrected dated card claims");
} catch (error) {
  failed = true;
  console.error(`  FAIL  company fact governance: ${error.message}`);
}

try {
  const [newsCrawler, newsBundle] = await Promise.all([
    readFile("scripts/crawl-news.mjs", "utf8"),
    readFile("news.json", "utf8").then(JSON.parse),
  ]);
  const rows = newsBundle.articles || [];
  const nearDuplicatePairs = rows.flatMap((article, index) => rows.slice(index + 1)
    .filter(other => {
      const articleDate = Date.parse(article.date || "") || 0;
      const otherDate = Date.parse(other.date || "") || 0;
      const withinThreeDays = articleDate && otherDate
        ? Math.abs(articleDate - otherDate) <= 3 * 86_400_000
        : true;
      const sameSubject = article.co && other.co
        ? article.co === other.co
        : article.cat && article.cat === other.cat;
      return withinThreeDays && sameSubject
        && textSimilarity(article.titleEn || article.title, other.titleEn || other.title) >= 0.84;
    }));
  if (!/hl=en-US&gl=US&ceid=US:en/.test(newsCrawler)
    || /global-sources\.mjs/.test(newsCrawler)
    || !/dedupeLatestBriefings/.test(newsCrawler)
    || !/textSimilarity/.test(newsCrawler)
    || !/displayEligible: isContentBacked\(s\)/.test(newsCrawler)
    || !/localeCompare\(String\(left\.date/.test(newsCrawler)
    || nearDuplicatePairs.length) {
    throw new Error("daily article feed must remain English-authoritative, latest-first, and event-deduplicated");
  }
  console.log("  정상  기사 피드는 영문 권위 소스 · 최신 우선 · 동일 사건 근사 중복 제거");
} catch (error) {
  failed = true;
  console.error(`  실패  article source boundary: ${error.message}`);
}

try {
  const [boards, styles] = await Promise.all([readFile("boards.jsx", "utf8"), readFile("styles.css", "utf8")]);
  const sliderImages = ["capital", "device", "infra"].every(name => boards.includes(`assets/quant-insight-${name}.webp`));
  const sliderUi = boards.includes("function QuantInsightSlider") && boards.includes("setInterval") && styles.includes(".quant-insight-card");
  if (!sliderImages || !sliderUi) throw new Error("quantitative overview needs three optimized insight slides with automatic rotation");
  console.log("  OK  quantitative overview uses three optimized rotating insight slides");
} catch (error) {
  failed = true;
  console.error(`  FAIL  quantitative insight slides: ${error.message}`);
}

try {
  const [boards, styles, app] = await Promise.all([
    readFile("boards.jsx", "utf8"),
    readFile("styles.css", "utf8"),
    readFile("app.jsx", "utf8"),
  ]);
  const videoPanel = boards.includes('src="assets/competitive-dynamics.mp4"')
    && boards.includes("const DYNAMICS_AXES")
    && boards.includes("deriveCompanyRelationshipEdges")
    && boards.includes('article?.provenance?.status === "source-backed"')
    && boards.includes("relationEdges={dynamicEdges}")
    && boards.includes("SOURCE-BACKED · DAILY")
    && !boards.includes("const COMPETE_EDGES")
    && boards.includes("onNodeSelect={setActiveCompany}")
    && boards.includes("relationshipGroups.length > 0")
    && !boards.includes("false && relationshipGroups.length > 0")
    && boards.includes("video.playbackRate = 0.55")
    && boards.includes("compact")
    && app.includes('companyInView || active === "overview"');
  const interactiveLayout = styles.includes(".es-dynamics-grid")
    && styles.includes(".dyn-video-panel")
    && styles.includes(".dyn-relationship")
    && styles.includes(".dyn-relationship > div > a")
    && styles.includes("grid-template-columns: minmax(460px, 1.25fr) minmax(340px, .85fr)")
    && styles.includes("brightness(.66)");
  if (!videoPanel || !interactiveLayout) {
    throw new Error("competitive dynamics needs a left interactive circle map and a right combined-video insight panel");
  }
  console.log("  OK  competitive dynamics links each selected circle to the right-side video insight panel");
} catch (error) {
  failed = true;
  console.error(`  FAIL  competitive dynamics video panel: ${error.message}`);
}

try {
  const [boards, styles] = await Promise.all([readFile("boards.jsx", "utf8"), readFile("styles.css", "utf8")]);
  const removedPriorityStrip = !boards.includes('className="es-priority-map"') && !styles.includes(".es-priority-map");
  const consultingFramework = boards.includes("STRATEGIC DECISION BRIEF")
    && boards.includes("FACT <em>원문 근거</em>")
    && boards.includes("IMPLICATION <em>사업 의미</em>")
    && boards.includes("DECISION <em>권고 실행</em>")
    && !boards.includes('className="es-arr" aria-hidden="true">→</span>')
    && styles.includes(".es-brief-head")
    && styles.includes(".es-framework-key")
    && styles.includes(".es-row:hover { background: #102a43; }")
    && styles.includes(".es-cell .tl-hl, .es-cell .tl-kw")
    && styles.includes('content: "▶";')
    && styles.includes("font-size: 21px")
    && styles.includes("color: #7de3ff; background: transparent;")
    && styles.includes(".es-score-tip");
  if (!removedPriorityStrip || !consultingFramework) {
    throw new Error("executive summary must use the evidence → implication → decision consulting framework without a priority-strip graphic");
  }
  console.log("  OK  executive summary uses an evidence → implication → decision consulting framework");
} catch (error) {
  failed = true;
  console.error(`  FAIL  executive summary card tone: ${error.message}`);
}

try {
  const [boards, styles] = await Promise.all([readFile("boards.jsx", "utf8"), readFile("styles.css", "utf8")]);
  const conciseBriefing = boards.includes("Source 기반 규칙 해석 · 신사업 기회 스코어(1~5)")
    && boards.includes("function fmtMonthDay")
    && boards.includes("{fmtMonthDay(d.date)}")
    && !boards.includes("brief-headline")
    && !boards.includes("{day.headline}")
    && !boards.includes("AI 추론(검증 불가)");
  const transparentPriority = boards.includes("const priorityMeta =")
    && boards.includes("${meta.label} = ${meta.meaning} (${meta.range}점)")
    && boards.includes("점수 = 최신성 × 출처 신뢰도 × 주제 적합도")
    && boards.includes("당일 최고 카드 = 100으로 정규화")
    && styles.includes(".es-score:hover .es-score-tip");
  if (!conciseBriefing || !transparentPriority) {
    throw new Error("briefing dates and priority-score reasoning must remain concise and inspectable");
  }
  console.log("  OK  briefing uses simple dates and priority scores expose their source-based rule");
} catch (error) {
  failed = true;
  console.error(`  FAIL  briefing clarity and score transparency: ${error.message}`);
}

try {
  const [boards, styles] = await Promise.all([readFile("boards.jsx", "utf8"), readFile("styles.css", "utf8")]);
  const readableSignals = boards.includes("signal-quant-layout")
    && boards.includes("DECISION LENS")
    && boards.includes("검토 항목")
    && styles.includes(".signal-reading")
    && styles.includes(".isg-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));")
    && styles.includes(".isg-card:hover {")
    && styles.includes(".isg-card:hover::after { opacity: 1; }")
    && styles.includes("@media (prefers-reduced-motion: reduce)")
    && !styles.includes(".isg-summary li { position: relative; min-width: 0; padding-left: 10px; font-size: 11px; font-weight: 600; line-height: 1.45; color: var(--muted); word-break: keep-all; display: -webkit-box;");
  if (!readableSignals) {
    throw new Error("infra charts need a compact chart layout, source-derived decision lenses, and unclipped readable signal cards");
  }
  console.log("  OK  infrastructure charts include compact visuals and readable source-derived insights");
} catch (error) {
  failed = true;
  console.error(`  FAIL  infrastructure chart readability: ${error.message}`);
}

try {
  const [{ selectInsightLines }, workflow, reframe, boards, styles] = await Promise.all([
    import("./source-content.mjs"),
    readFile(".github/workflows/daily-news.yml", "utf8"),
    readFile("scripts/reframe-source-briefs.mjs", "utf8"),
    readFile("boards.jsx", "utf8"),
    readFile("styles.css", "utf8"),
  ]);
  const selected = selectInsightLines([
    "Every vendor claims to be AI-powered, but few will show how their systems work.",
    "Worldwide spending is projected to reach $64 billion in 2026, up 63.4 percent from 2025.",
    "ARM-based rack-scale servers overtook x86 as the leading accelerated computing platform.",
    "This means buyers need to compare cost, performance, and operating efficiency before committing capacity.",
  ].join(" "));
  const lines = selected.map(item => item.line);
  const roles = selected.map(item => item.role);
  if (selected.length !== 3 || lines.some(line => /Every vendor claims/i.test(line))
    || !roles.includes("fact") || !roles.includes("change") || !roles.includes("implication")
    || !/reframe-source-briefs\.mjs/.test(workflow) || !/selectionVersion/.test(reframe)
    || !/summaryRoles/.test(boards) || !/art-insight-role/.test(styles)) {
    throw new Error("visible source briefs need non-redundant fact, change, and implication lines with a retained-source reframe path");
  }
  console.log("  OK  source briefs select fact, change and implication without publisher boilerplate");
} catch (error) {
  failed = true;
  console.error(`  FAIL  source brief framing: ${error.message}`);
}

try {
  const [app, news] = await Promise.all([
    readFile("app.jsx", "utf8"),
    readFile("news.json", "utf8").then(JSON.parse),
  ]);
  const visibleNews = (news.articles || []).filter(article => article.displayEligible !== false
    && article.summaryMode === "source-content-extractive" && article.provenance?.status === "source-backed");
  if (!/a\.summaryMode === "source-content-extractive"/.test(app) || /a\.summaryMode === "source-excerpt"/.test(app) || visibleNews.length < 10) {
    throw new Error("the article UI must display cumulative source-content-extractive records");
  }
  console.log(`  정상  기사 UI 누적 원문 피드 ${visibleNews.length}건 표시 규칙 검증`);
} catch (error) {
  failed = true;
  console.error(`  실패  기사 UI 누적 표시: ${error.message}`);
}

try {
  const [app, components] = await Promise.all([
    readFile("app.jsx", "utf8"),
    readFile("components.jsx", "utf8"),
  ]);
  if (/\{\s*id:\s*["']bizmodel["']/.test(components)
    || /<LazySection\s+id=["']bizmodel["']/.test(app)
    || /bizmodel:\s*uR\(null\)/.test(app)) {
    throw new Error("the removed AI business-model menu or board is still rendered");
  }
  const aliasMatch = app.match(/bizmodel:\s*["'](\w+)["']/);
  const aliasTarget = aliasMatch && aliasMatch[1];
  const targetAvailable = aliasTarget
    && new RegExp(`\\{\\s*id:\\s*["']${aliasTarget}["']`).test(components)
    && new RegExp(`<LazySection\\s+id=["']${aliasTarget}["']`).test(app);
  if (!targetAvailable) {
    throw new Error("legacy business-model links must redirect to an available section");
  }
  console.log(`  OK  removed AI business-model board; legacy links redirect to '${aliasTarget}'`);
} catch (error) {
  failed = true;
  console.error(`  FAIL  AI business-model removal: ${error.message}`);
}

try {
  const [charts, boards, styles, app] = await Promise.all([
    readFile("charts.jsx", "utf8"),
    readFile("boards.jsx", "utf8"),
    readFile("styles.css", "utf8"),
    readFile("app.jsx", "utf8"),
  ]);
  const hasInstanceScopedLine = /const chartId = React\.useId\(\)\.replace\(\/:\/g, ""\);/.test(charts)
    && /const clipId = `mg-clip-\$\{chartId\}`;/.test(charts)
    && /clipPath=\{`url\(#\$\{clipId\}\)`\}/.test(charts)
    && /stroke=\{`url\(#\$\{lineId\}\)`\}/.test(charts);
  const hasDerivedCagr = charts.includes("showCagr = false")
    && charts.includes("const cagr =")
    && charts.includes('className="mg-cagr"')
    && charts.includes("iw * 0.68")
    && charts.includes("ih * 0.76")
    && charts.includes('r="25"')
    && boards.includes("compact showCagr");
  const hasCompactChartsAndDeferredPaint = charts.includes("compact = false")
    && charts.includes('className={"hbar-chart" + (compact ? " hbar-compact" : "")}')
    && styles.includes(".hbar-chart.hbar-compact")
    && styles.includes("content-visibility: auto")
    && app.includes('className="board-gate is-ready"')
    && !app.includes("board-gate-placeholder");
  const hasFundingReadout = boards.includes("function FundingTrendInsight")
    && boards.includes("<FundingTrendInsight data={data.FUNDING_TREND} />")
    && boards.includes('valuePrefix="$" compact />')
    && styles.includes(".funding-trend-insight")
    && styles.includes(".funding-trend-card .hbar-chart.hbar-compact");
  if (!hasInstanceScopedLine || !hasDerivedCagr || !hasCompactChartsAndDeferredPaint || !hasFundingReadout) {
    throw new Error("market charts need a clear CAGR badge, compact funding chart with source-series readout, and deferred below-fold paint");
  }
  console.log("  OK  market charts use clear CAGR badges, compact funding readouts and deferred paint");
} catch (error) {
  failed = true;
  console.error(`  FAIL  market-chart readability and performance: ${error.message}`);
}

try {
  const [boards, styles] = await Promise.all([
    readFile("boards.jsx", "utf8"),
    readFile("styles.css", "utf8"),
  ]);
  const quantifiedInsightCards = (boards.match(/className="chart-card has-chart-insight"/g) || []).length === 5
    && boards.includes("function QuantChartInsight")
    && boards.includes("fundingPairTotal")
    && boards.includes("swTopThreeTotal")
    && boards.includes("직접 합산 제외")
    && styles.includes(".quant-chart-insight ul")
    && styles.includes(".quant-chart-insight mark");
  if (!quantifiedInsightCards) {
    throw new Error("every funding, user, price and revenue chart needs source-series bullet insights with visible key-number emphasis");
  }
  console.log("  OK  five quant charts include source-series bullet insights");
} catch (error) {
  failed = true;
  console.error(`  FAIL  quant-chart insight coverage: ${error.message}`);
}

try {
  const boards = await readFile("boards.jsx", "utf8");
  const removedSignalIntros = [
    "매일 크롤된 기사에서 '돈 버는 방식'을 구독·사용량(API)",
    "매일 크롤된 기사에서 컴퓨트·메모리·광통신·전력·차세대 아키텍처 신호를 MECE 5축으로",
  ];
  if (removedSignalIntros.some(text => boards.includes(text)) || !/\{sub && <p>\{sub\}<\/p>\}/.test(boards)) {
    throw new Error("removed signal-board guidance must not leave empty explanatory copy");
  }
  console.log("  OK  removed monetization and infrastructure signal-board guidance copy");
} catch (error) {
  failed = true;
  console.error(`  FAIL  signal-board guidance cleanup: ${error.message}`);
}

try {
  const [market, boards] = await Promise.all([
    readFile("market.json", "utf8").then(JSON.parse),
    readFile("boards.jsx", "utf8"),
  ]);
  const records = market.records || [];
  const ids = new Set(records.map(record => record.id));
  const linked = records.filter(record => /^https?:\/\//.test(record.sourceUrl || ""));
  const displayable = records.filter(record => record.provenance?.status === "source-backed"
    && record.displayEligible === true
    && record.sourceContent?.status === "content-extracted"
    && Array.isArray(record.sourceQuantifiedLines) && record.sourceQuantifiedLines.length
    && Array.isArray(record.sourceQuantities) && record.sourceQuantities.length);
  const sourceBoundCards = displayable.every(record => {
    const normalize = value => String(value || "").replace(/\s+/g, " ").trim();
    const sourceText = normalize(`${record.sourceContent?.headline || ""}\n${record.sourceContent?.text || ""}`);
    return (record.summaryLinesEn || []).length >= 2
      && (record.summaryLinesEn || []).every(line => sourceText.includes(normalize(line)))
      && record.sourceQuantifiedLines.every(item => item?.line && sourceText.includes(normalize(item.line))
        && (item.values || []).every(value => String(item.line).includes(value)));
  });
  const userResearchIds = [
    "survey:flipkart-counterpoint-india-ai-phone-2026",
    "survey:emarketer-cnet-us-ai-wtp-2025",
    "survey:capgemini-genai-shopping-control-2026",
    "shipment:counterpoint-foldable-2026-book-type",
    "survey:omdia-foldable-consumer-interest-2025",
    "shipment:counterpoint-satellite-smartphone-2030",
    "market:trendforce-direct-to-cell-2026",
    "market:omdia-smartphone-d2d-2030",
  ];
  const hasUserResearch = userResearchIds.every(id => records.some(record => record.id === id
    && /^https?:\/\//.test(record.sourceUrl || "") && Array.isArray(record.values) && record.values.length));
  const hasNewVerticals = ["core-41", "wearxr-42"].every(id => (market.items || []).some(item => item.id === id && /^https?:\/\//.test(item.url || "")));
  const boardContract = /record\.provenance\?\.status === "source-backed"/.test(boards)
    && /sourceQuantifiedLines/.test(boards)
    && /검색 제목·스니펫은 화면에서 제외/.test(boards);
  const noForecastPlaceholder = /const hasForecast = numericValue\(it\.forecast\)/.test(boards)
    && /hasCurrent && hasForecast && <span className="mkt-arr" aria-hidden="true" \/>/.test(boards)
    && /hasForecast && <span className="mkt-num fut">/.test(boards);
  if (market.database?.mode !== "append-only" || records.length < 3 || ids.size !== records.length || linked.length !== records.length
    || !hasUserResearch || !hasNewVerticals || !sourceBoundCards || !boardContract || !noForecastPlaceholder) {
    throw new Error("append-only market database requires publisher-page-backed display records and retained source links");
  }
  console.log(`  정상  market.json 누적 정량 DB ${records.length}건`);
} catch (error) {
  failed = true;
  console.error(`  실패  market.json 누적 정량 DB: ${error.message}`);
}

try {
  const [startups, boards] = await Promise.all([
    readFile("startups.json", "utf8").then(JSON.parse),
    readFile("boards.jsx", "utf8"),
  ]);
  const rows = [...(startups.large || []), ...(startups.small || [])];
  const visible = rows.filter(row => row.provenance?.status === "source-linked");
  const historyRows = rows.filter(row => Array.isArray(row.history) && row.history.some(entry => /^https?:\/\//.test(entry?.url || "")));
  const smallRows = (startups.small || []).filter(row => row.provenance?.status === "source-linked");
  const localizedHeadlines = rows.flatMap(row => [row.latest, ...(row.history || [])]).filter(entry => entry?.localization?.status === "accepted");
  if (rows.length < 8 || visible.length < 8 || smallRows.length < 10 || historyRows.length < 8 || localizedHeadlines.length < 8
    || !/const SourceHistory\s*=/.test(boards) || !/const hasLinkedEvidence\s*=/.test(boards)
    || !/status === "source-backed" \|\| status === "source-linked"/.test(boards)
    || !/React\.useState\("all"\)/.test(boards) || !/fmtMonthDay\(entry\.date\)/.test(boards)
    || /\? "최신" : "과거"/.test(boards) || !/\[it\.latest, \.\.\.\(it\.history \|\| \[\]\)\]/.test(boards)) {
    throw new Error("startup analysis requires visible small-company coverage, Korean source headlines and de-duplicated cumulative links");
  }
  console.log(`  OK  startup analysis ${visible.length} source-linked rows · ${smallRows.length} small rows · ${localizedHeadlines.length} Korean source headlines`);
} catch (error) {
  failed = true;
  console.error(`  FAIL  startup cumulative analysis: ${error.message}`);
}

try {
  const research = JSON.parse(await readFile("research.json", "utf8"));
  const pinned = (research.pinned || []).filter(brief => brief.provenance?.status === "user-provided-source");
  if (!pinned.length || !pinned.every(brief => Array.isArray(brief.summaryLines) && brief.summaryLines.length === 3 && brief.sourceLine && brief.sourcePages?.length)) {
    throw new Error("curated research briefs require a source reference, source pages, and exactly three Korean key lines");
  }
  console.log(`  정상  증권사·기관 리서치 한국어 3줄 핵심 ${pinned.length}건`);
} catch (error) {
  failed = true;
  console.error(`  실패  증권사·기관 리서치 3줄 핵심: ${error.message}`);
}

try {
  const news = JSON.parse(await readFile("news.json", "utf8"));
  const research = JSON.parse(await readFile("research.json", "utf8"));
  const records = [...(news.articles || []), ...(research.feed || [])];
  const visible = records.filter(record => record.displayEligible !== false);
  const valid = record => {
    const loc = record.localization || {};
    const lines = Array.isArray(loc.summaryLines) ? loc.summaryLines : [];
    return ["accepted", "fallback-english"].includes(loc.status)
      && ["ko", "en"].includes(loc.displayLanguage)
      && typeof loc.title === "string" && loc.title.trim().length > 1
      && Array.isArray(loc.sourceLines) && loc.sourceLines.length >= 1 && loc.sourceLines.length <= 3
      && lines.length >= 1 && lines.length <= 3
      && new Set(lines.map(line => String(line).replace(/\s+/g, "").toLowerCase())).size === lines.length
      && record.summaryMode === "source-content-extractive"
      && record.sourceContent?.status === "content-extracted"
      && /^[a-f0-9]{64}$/i.test(loc.sourceHash || "");
  };
  const invalidVisible = visible.filter(record => !valid(record));
  if (visible.length < 10 || invalidVisible.length) {
    throw new Error(`every visible feed row needs source-page text, one-to-three distinct source-hashed Korean or English lines, and no repeated filler (${invalidVisible.slice(0, 3).map(record => record.titleEn || record.title || record.url).join(" | ")})`);
  }
  const translated = visible.filter(record => record.localization.status === "accepted").length;
  console.log(`  정상  본문 기반 피드 ${visible.length}건 · 한국어 ${translated}건 · 영문 폴백 ${visible.length - translated}건`);

  const visibleResearch = (research.feed || []).filter(record => record.displayEligible !== false);
  const researchValid = record => {
    const loc = record.localization || {};
    return loc.status === "accepted" && loc.displayLanguage === "ko"
      && Array.isArray(loc.summaryLines) && loc.summaryLines.length === 3
      && loc.summaryLines.every(line => /[가-힣]/.test(String(line || "")));
  };
  if (!visibleResearch.length || !visibleResearch.every(researchValid)) {
    throw new Error("every visible research row must have a Korean title and exactly three source-bound Korean bullet lines");
  }
  console.log(`  정상  노출 리서치 ${visibleResearch.length}건 · 한글 제목·3줄 개조식 검증`);

  const boards = await readFile("boards.jsx", "utf8");
  const displayTexts = visible.flatMap(record => {
    const loc = record.localization || {};
    return [loc.title, ...(loc.summaryLines || [])].filter(Boolean);
  });
  const terminalProse = /(?:다|[。])(?:["”’']?\s*)$/;
  const sentencePeriod = /(^|[^0-9])\.(?=\s|["”’']?$)/;
  const malformedDisplay = displayTexts.filter(text => terminalProse.test(text) || sentencePeriod.test(text));
  const bulletFunctionPresent = /function bulletText\(/.test(boards);
  const thesisUsesBulletText = /bulletText\(op\.thesis\)/.test(boards);
  const removedCopyRendered = /bulletText\(op\.(?:conclusion|watch)\)/.test(boards);
  if (!bulletFunctionPresent || !thesisUsesBulletText || removedCopyRendered || malformedDisplay.length) {
    const causes = [
      !bulletFunctionPresent && "bulletText-missing",
      !thesisUsesBulletText && "thesis-not-bulletized",
      removedCopyRendered && "removed-copy-rendered",
      malformedDisplay.length && `bad-display:${malformedDisplay.slice(0, 2).join(" | ")}`,
    ].filter(Boolean).join(", ");
    throw new Error(`display copy must use compact bullet phrasing without sentence-final dots or -다 endings (${causes})`);
  }
  console.log(`  정상  노출 원문 번역 ${displayTexts.length}줄 · 개조식·마침표·다체 종결 검증`);
} catch (error) {
  failed = true;
  console.error(`  실패  전체 피드 번역·폴백: ${error.message}`);
}

try {
  const [boardsSource, stylesSource] = await Promise.all([
    readFile("boards.jsx", "utf8"),
    readFile("styles.css", "utf8"),
  ]);
  const keywordDeclaration = boardsSource.match(/const BRIEF_KEYWORDS = (\/.+\/gi);/);
  if (!keywordDeclaration) throw new Error("BRIEF_KEYWORDS declaration missing");
  const keywords = Function(`return ${keywordDeclaration[1]}`)();
  const matches = (text) => [...text.matchAll(keywords)].map((match) => match[0]);
  const falsePositive = ["pair", "training"].some((word) => matches(word).length > 0);
  const expectedTerms = matches("OpenAI와 AI 서버");
  const termRule = stylesSource.match(/\.term-hl\s*\{[\s\S]*?\n\}/)?.[0] || "";
  if (falsePositive || !expectedTerms.includes("OpenAI") || !expectedTerms.includes("AI 서버")
    || !/rgba\(255,212,0/.test(termRule) || /background:\s*color-mix/.test(termRule)) {
    throw new Error("keyword emphasis must use complete terms with a yellow underline only");
  }
  console.log("  OK  complete-term matching, AI substring exclusion, yellow underline emphasis");
} catch (error) {
  failed = true;
  console.error(`  FAIL  keyword emphasis: ${error.message}`);
}

try {
  const [appSource, boardsSource, news, infra, bizmodel] = await Promise.all([
    readFile("app.jsx", "utf8"),
    readFile("boards.jsx", "utf8"),
    readFile("news.json", "utf8").then(JSON.parse),
    readFile("infra.json", "utf8").then(JSON.parse),
    readFile("bizmodel.json", "utf8").then(JSON.parse),
  ]);
  const sourceKey = (value) => {
    try {
      const url = new URL(String(value || ""));
      url.hash = "";
      url.search = "";
      return url.href.replace(/\/$/, "");
    } catch {
      return String(value || "").replace(/[?#].*$/, "").replace(/\/$/, "");
    }
  };
  const articlesByUrl = new Map((news.articles || []).map(article => [sourceKey(article.url), article]));
  const canShowAsKoreanBrief = (item) => {
    const article = articlesByUrl.get(sourceKey(item.url));
    const loc = article?.localization || {};
    return loc.status === "accepted" && loc.displayLanguage === "ko"
      && /[가-힣]/.test(loc.title || "")
      && Array.isArray(loc.summaryLines) && loc.summaryLines.length === 3
      && loc.summaryLines.every(line => /[가-힣]/.test(String(line || "")));
  };
  const linked = [...(infra.items || []), ...(bizmodel.items || [])]
    .filter(item => item.provenance?.status === "evidence-linked");
  const visibleBriefs = linked.filter(canShowAsKoreanBrief);
  if (!/articles=\{articles\}/.test(appSource)
    || !/function SignalInfographic\(\{ file, delKey, title, sub, articles, dataVersion \}\)/.test(boardsSource)
    || !/className="isg-summary"/.test(boardsSource)
    || !/hlBrief\(it\.display\.title/.test(boardsSource)
    || !visibleBriefs.length || !visibleBriefs.every(canShowAsKoreanBrief)) {
    throw new Error("signal cards must use linked Korean titles and exactly three source-derived lines");
  }
  console.log(`  OK  Korean signal-card briefs ${visibleBriefs.length}/${linked.length} source-linked rows`);
} catch (error) {
  failed = true;
  console.error(`  FAIL  Korean signal cards: ${error.message}`);
}

try {
  const [appSource, boardsSource, animSource, workflowSource, version, publicNews, publicResearch, publicMarket] = await Promise.all([
    readFile("app.jsx", "utf8"), readFile("boards.jsx", "utf8"), readFile("anim.jsx", "utf8"),
    readFile(".github/workflows/daily-news.yml", "utf8"), readFile("data-version.json", "utf8").then(JSON.parse),
    readFile("news-view.json", "utf8").then(JSON.parse), readFile("research-view.json", "utf8").then(JSON.parse),
    readFile("market-view.json", "utf8").then(JSON.parse),
  ]);
  const safe = list => list.every(item => item.displayEligible !== false && item.provenance?.status === "source-backed");
  if (!version.version || !/data-version\.json/.test(appSource)
    || !/news-view\.json/.test(appSource) || !/research-view\.json/.test(appSource)
    || !/market-view\.json/.test(boardsSource) || /Math\.floor\(Date\.now\s*\/\s*60000\)/.test(`${appSource}\n${boardsSource}`)
    || /setInterval\(_queueScan,\s*600\)/.test(animSource)
    || !/build-public-data\.mjs/.test(workflowSource)
    || !safe(publicNews.articles || []) || !safe(publicResearch.feed || []) || !safe(publicMarket.records || [])) {
    throw new Error("public views must be versioned, source-backed, and free of minute cache busting");
  }
  console.log(`  OK  versioned source-only public views ${publicNews.count}/${publicResearch.count}/${publicMarket.records.length}`);
} catch (error) {
  failed = true;
  console.error(`  FAIL  source-only public views: ${error.message}`);
}

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  failed = true;
  console.error(`  실패  Node.js ${process.version} (20 이상 필요)`);
} else {
  console.log(`  정상  Node.js ${process.version}`);
}

console.log("  정보  기사 사실: 원문 발췌 · 기업 전략: GitHub Models 근거 제한 종합");
console.log("  정보  기본 파이프라인: 매일 06:30 · 12:30 · 19:30 · 00:30 KST");
console.log("  정보  보조 업데이트: 수동 복구 전용(동시 쓰기 방지)");

const pipelineScripts = [
  "scripts/crawl-news.mjs", "scripts/crawl-stocks.mjs", "scripts/crawl-research.mjs",
  "scripts/crawl-startups.mjs", "scripts/crawl-startup-organizations.mjs", "scripts/crawl-markets.mjs", "scripts/crawl-infra.mjs",
  "scripts/crawl-bizmodel.mjs", "scripts/generate-briefing.mjs", "scripts/startup-radar.mjs",
  "scripts/build-insights.mjs", "scripts/crawl-companies.mjs", "scripts/crawl-monetization.mjs",
  "scripts/crawl-a16z-startups.mjs", "scripts/crawl-strategic-ventures.mjs",
  "scripts/build-company-intelligence.mjs",
];
for (const file of pipelineScripts) {
  const source = await readFile(file, "utf8");
  if (/process\.exit\(0\)/.test(source)) {
    failed = true;
    console.error(`  실패  ${file}: 오류를 성공으로 종료하는 코드가 남아 있음`);
  }
}

try {
  const policy = JSON.parse(await readFile("config/news-policy.json", "utf8"));
  const health = JSON.parse(await readFile("llm-health.json", "utf8"));
  if (policy.summaryMode !== "source-content-extractive"
    || health.companySynthesis?.policy !== "publisher-evidence-id-grounded") {
    throw new Error("source-extractive article policy or grounded company-synthesis declaration is invalid");
  }
  const sources = await Promise.all(pipelineScripts.concat(["scripts/llm.mjs", "scripts/translate_summarize.py"]).map(file => readFile(file, "utf8")));
  if (sources.some(source => /api\.anthropic\.com|@anthropic-ai\/sdk/.test(source))
    || !sources.some(source => /models\.github\.ai/.test(source))) {
    throw new Error("company synthesis must use the approved GitHub Models endpoint only");
  }
  console.log("  정상  기사 원문 사실 + source-bound 번역 + publisher-evidence 기반 기업전략 종합");
} catch (error) {
  failed = true;
  console.error(`  실패  source-grounded synthesis policy: ${error.message}`);
}

try {
  const [boards, data, charts, crawler, styles, investmentData, investmentBuilder, appSource, workflowSource] = await Promise.all([
    readFile("boards.jsx", "utf8"),
    readFile("data.js", "utf8"),
    readFile("charts.jsx", "utf8"),
    readFile("scripts/crawl-stocks.mjs", "utf8"),
    readFile("styles.css", "utf8"),
    readFile("nvidia-investments.json", "utf8").then(JSON.parse),
    readFile("scripts/build-nvidia-investments.mjs", "utf8"),
    readFile("app.jsx", "utf8"),
    readFile(".github/workflows/daily-news.yml", "utf8"),
  ]);
  const dash = loadDash();
  const chinaGroups = [
    "china-memory",
    "china-foundry",
    "china-equipment",
    "china-packaging",
    "china-design",
    "china-materials",
  ];
  // 주가 보드는 수집 중인 63개 상장사 전체를 사이트 공통 7계층으로 재분류한다.
  const completeBoard = boards.includes("function StockRegionPanel")
    && boards.includes("function NvidiaInvestmentMap")
    && boards.includes("전체 상장사 밸류체인 분석")
    && boards.includes("window.DASH.STOCK_LAYER")
    && boards.includes("window.DASH.STOCK_GROUP_LAYER")
    && !boards.includes(".filter(s => STOCK_LAYER[s.ticker])")
    && boards.includes("밸류체인 그룹 트렌드")
    && boards.includes("개별 종목");
  const completeMetadata = data.includes('ticker: "000660.KS"')
    && data.includes('ticker: "688825.SS"')
    && chinaGroups.every(group => data.includes(`id: "${group}"`))
    && dash.STOCKS.length === 63
    && dash.STOCKS.every(stock => dash.STOCK_LAYER[stock.ticker] || dash.STOCK_GROUP_LAYER[stock.group]);
  const sourceBackedInvestments = investmentData.portfolio?.length === 8
    && new Set(investmentData.portfolio.map(item => item.name)).size === investmentData.portfolio.length
    && investmentData.portfolio.every(item => item.why && item.strategicFit
      && /^https?:\/\//.test(item.source?.url || "") && item.source?.date && item.layer);
  const dynamicInvestmentPipeline = investmentBuilder.includes('readFile("news.json"')
    && investmentBuilder.includes('summaryMode === "source-content-extractive"')
    && investmentBuilder.includes('provenance?.status === "source-backed"')
    && workflowSource.includes("scripts/build-nvidia-investments.mjs")
    && appSource.includes('dataUrl("nvidia-investments.json")');
  const liveHistory = crawler.includes('const YEARS = 5')
    && crawler.includes("indicators.adjclose")
    && crawler.includes("const batchSize = 6")
    && crawler.includes("new Set(TICKERS.map(c => c.t))")
    && !crawler.includes("function scenarioSeries");
  const currencyAware = charts.includes('currency = "$"')
    && charts.includes("{currency}{t}")
    && boards.includes('currency={real.currency || "$"}');
  const responsiveUi = styles.includes(".stock-region-stack")
    && styles.includes(".stock-region-head")
    && styles.includes(".stock-toolbar")
    && styles.includes(".nvi-stage")
    && styles.includes(".nvi-node:hover")
    && styles.includes("grid-template-columns: minmax(0, 1fr) auto");
  if (!completeBoard || !completeMetadata || !sourceBackedInvestments || !dynamicInvestmentPipeline
    || !liveHistory || !currencyAware || !responsiveUi) {
    throw new Error("all-company stock board, NVIDIA source pipeline, five-year adjusted-close history, currencies, or responsive UI are incomplete");
  }
  console.log("  OK  63개 상장사 Stock 분석 + NVIDIA 원문근거 투자맵 + 5년 실데이터·변곡점 자동 설명");
} catch (error) {
  failed = true;
  console.error(`  FAIL  stock value-chain board: ${error.message}`);
}

try {
  const [components, boards, companyBuilder, startupCrawler, translator, ...views] = await Promise.all([
    readFile("components.jsx", "utf8"),
    readFile("boards.jsx", "utf8"),
    readFile("scripts/build-company-intelligence.mjs", "utf8"),
    readFile("scripts/crawl-startups.mjs", "utf8"),
    readFile("scripts/translate_summarize.py", "utf8"),
    ...["news-view.json", "research-view.json", "market-view.json", "infra-view.json", "bizmodel-view.json"]
      .map(file => readFile(file, "utf8").then(JSON.parse)),
  ]);
  const cases = new Map([
    ["전략을 확대합니다. 수익화를 강화한다.", "전략을 확대함 · 수익화를 강화함"],
    ["2026.07.30 기준 매출 10.5% 증가했습니다.", "2026-07-30 기준 매출 10.5% 증가함"],
    ["현재 사업의 핵심입니다. 중요한 과제다.", "현재 사업의 핵심임 · 중요한 과제"],
    ['연구 결과는 "대안이 없습니다."라고 밝힘', '연구 결과는 "대안이 없음" · 라고 밝힘'],
    ["일자리를 늘리는 것이다: Gartner", "일자리를 늘리는 것임 · Gartner"],
  ]);
  for (const [input, expected] of cases) {
    const actual = bulletizeKorean(input);
    if (actual !== expected || hasKoreanProseEnding(actual) || hasKoreanSentencePeriod(actual)) {
      throw new Error(`unexpected copy normalization: ${input} -> ${actual}`);
    }
  }
  const publicCopy = views.flatMap(view => {
    const records = view.articles || view.feed || view.records || view.items || [];
    return records.flatMap(item => [
      item.title, item.titleKo, item.desc, item.signal, item.quant, item.summary,
      ...(item.summaryLinesKo || []),
      item.localization?.title,
      ...(item.localization?.summaryLines || []),
    ]).filter(value => typeof value === "string" && /[가-힣]/.test(value));
  });
  if (publicCopy.some(value => bulletizeKorean(value) !== value
      || hasKoreanProseEnding(value) || hasKoreanSentencePeriod(value))) {
    throw new Error("public view still contains Korean sentence copy");
  }
  const runtimeGate = components.includes("function consultingBulletText")
    && components.includes("React.createElement =")
    && components.includes("CONSULTING_COPY_CACHE")
    && boards.includes("window.consultingBulletText");
  const generationGate = companyBuilder.includes("명사형 개조식")
    && companyBuilder.includes("bulletizeKorean")
    && startupCrawler.includes("명사형 개조식")
    && startupCrawler.includes("bulletizeKorean")
    && translator.includes('previous.get("version") == 14')
    && translator.includes("bullet_style_valid");
  if (!runtimeGate || !generationGate) {
    throw new Error("browser or crawler copy-style gate is incomplete");
  }
  console.log(`  OK  한국어 표시 문구 ${publicCopy.length}개 · 마침표와 문장형 종결 없음 · 생성 단계 개조식 고정`);
} catch (error) {
  failed = true;
  console.error(`  FAIL  Korean consulting-copy style: ${error.message}`);
}

if (failed) process.exit(1);
console.log("자동화 구성 정상");
