#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { BUNDLE_FILE, DATA_BUNDLE_FILE, DATA_SOURCE_FILE, buildRuntimeDash, readBrowserSources, runtimeDataSource, sourceStamp } from "./build-browser-bundle.mjs";
import { loadDash } from "./load-dash.mjs";
import { articleFocusedOnCompany, directCompanyNewsMatch } from "./company-sources.mjs";
import { canonicalizeStartupSnapshot, companyRegistryHasDuplicates, sameCompany } from "./company-identity.mjs";
import { textSimilarity } from "./source-content.mjs";
import { bulletizeKorean, hasKoreanProseEnding, hasKoreanSentencePeriod } from "./korean-copy.mjs";
import { canonicalSuppressionUrl, createSuppressionRegistry } from "./suppression-registry.mjs";
import { appendRecords, ensureMarketDatabase, hasConsumerSurveyEvidence, sourceMetricValues } from "./market-db.mjs";
import { consolidateMarketRecords, sameMarketStory } from "./market-consolidation.mjs";

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
  "scripts/market-consolidation.mjs",
  "scripts/refresh-market-source-content.mjs",
  "scripts/global-sources.mjs",
  "scripts/build-browser-bundle.mjs",
  "scripts/validate-delivery-performance.mjs",
  "scripts/translate_summarize.py",
  "scripts/run-with-retry.mjs",
  "scripts/verify-pipeline.mjs",
  "scripts/build-public-data.mjs",
  "scripts/update-site.mjs",
  "scripts/validate-site-content.mjs",
  "scripts/build-mobile-ai-business-db.mjs",
  "scripts/public-copy.mjs",
  "scripts/suppression-registry.mjs",
  "scripts/korean-copy.mjs",
  "scripts/audit-agent.mjs",
  "news.json",
  "company-news.json",
  "overview-view.json",
  "news-view.json",
  "research-view.json",
  "market-view.json",
  "mobile-ai-business-view.json",
  "infra-view.json",
  "bizmodel-view.json",
  "data-version.json",
  "site-content-manifest.json",
  "stocks.json",
  "nvidia-investments.json",
  "financials.json",
  "companies.json",
  "startups.json",
  "a16z-startups.json",
  "strategic-ventures.json",
  "business-model-forecasts.json",
  "monetization.json",
  "monetization-review-queue.json",
  "quality.json",
  "history.json",
  "llm-health.json",
  "deleted.json",
  "collection-health.json",
  "config/news-policy.json",
  "config/site-content-registry.json",
  "config/opportunity-generation.json",
  "config/quality-thresholds.json",
  "config/global-source-policy.json",
  "config/company-source-policy.json",
  "_config.yml",
  "index.html",
  "app.bundle.js",
  "data.bundle.js",
  "styles.bundle.css",
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
  const strictUi = app.includes('loadJson(dataUrl("company-news.json")')
    && app.includes("companyNews={companyNews}")
    && boards.includes("Array.isArray(companyNews?.[c.name])")
    && boards.includes("기업 직접 연관 뉴스")
    && !boards.includes(".filter(a => a.cat === c.cat)")
    && !uiStatusCopy.test(`${app}\n${boards}\n${charts}`);
  const automated = crawler.includes("loadDash().COMPANIES")
    && crawler.includes("newsQueryFor(company.name)")
    && crawler.includes("directCompanyNewsMatch")
    && (crawler.includes("pool(COMPANIES, 8") || crawler.includes("pool(activeCompanies, 8"))
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
  const expectedData = `/* ai-dashboard-data:${sourceStamp([
    { file: DATA_SOURCE_FILE, source: dataSource },
    { file: "runtime-data.js", source: runtimeDataSource() },
  ])} */`;
  const forbiddenHandsetWord = "\uD734\uB300\uD3F0";
  const publicRuntimeCopy = [...sources.map(({ source }) => source), bundle, dataSource, dataBundle, index].join("\n");
  if (!bundle.startsWith(expected)) throw new Error("bundle is stale; run npm run build:browser before publishing");
  if (!dataBundle.startsWith(expectedData)) throw new Error("data bundle is stale; run npm run build:browser before publishing");
  const runtimeDash = buildRuntimeDash();
  if (dataBundle.length > 100_000 || (runtimeDash.COMPANIES || []).some(company =>
    ["note", "vp", "direction", "valuation", "funding", "metric", "value"].some(key => Object.hasOwn(company, key)))) {
    throw new Error("runtime data bundle must contain taxonomy only; mutable company facts belong in generated JSON");
  }
  if (publicRuntimeCopy.includes(forbiddenHandsetWord)) throw new Error("deprecated handset wording must not appear in public runtime copy");
  if (/babel\.min\.js|text\/babel/.test(index)
    || !/defer src="app\.bundle\.js/.test(index)
    || !/defer src="data\.bundle\.js/.test(index)
    || !/styles\.bundle\.css\?v=/.test(index)) {
    throw new Error("index must serve the compact browser and data bundles without a runtime compiler");
  }
  console.log("  정상  browser and data bundles are current · deprecated handset wording removed");
} catch (error) {
  failed = true;
  console.error(`  실패  browser bundle: ${error.message}`);
}

try {
  const [components, styles, workflow, validator, packageSource] = await Promise.all([
    readFile("components.jsx", "utf8"),
    readFile("styles.css", "utf8"),
    readFile(".github/workflows/site-codex.yml", "utf8"),
    readFile("scripts/validate-site-codex-patch.mjs", "utf8"),
    readFile("package.json", "utf8"),
  ]);
  const dropdownRemoved = !components.includes('className="chatbot-drop"')
    && !components.includes("QA_CATS.map")
    && !components.includes('title="질문 선택"')
    && !styles.includes(".chatbot-drop");
  const commands = ["/help", "/guide", "/examples", "/search", "/company", "/market", "/cloud", "/ask", "/edit", "/issue", "/env", "/tasks", "/status", "/sync", "/open", "/connect", "/doctor", "/repo", "/issues", "/prs", "/actions", "/export", "/clear"];
  const cliReady = components.includes('className="site-cli-terminal"')
    && components.includes("buildSiteCliIndex")
    && components.includes("searchSiteCli")
    && components.includes("siteCodexIssueUrl")
    && components.includes("siteCodexTerminalCommand")
    && components.includes("startCodexCloudTask")
    && components.includes("checkLatestDelivery")
    && components.includes("fetchGithubRequest")
    && components.includes("pollGithubRequest")
    && components.includes("SITE REQUEST")
    && components.includes("CODEX CLOUD")
    && components.includes("BRANCH + PR")
    && components.includes("SITE_CODEX_GUIDE_STEPS")
    && components.includes("SITE_CODEX_EXAMPLES")
    && components.includes("completeSiteCliCommand")
    && components.includes("window.open(SITE_CODEX_CLOUD")
    && components.includes("codex cloud exec --env")
    && components.includes("codex cloud list --env")
    && components.includes("CLI 명령 복사")
    && components.includes('className="site-cli-shortcuts"')
    && components.includes("ReactDOM.createPortal")
    && commands.every(command => components.includes(`\"${command}`))
    && styles.includes(".site-cli-overlay")
    && styles.includes(".site-cli-command-grid")
    && styles.includes(".site-cli-steps")
    && styles.includes(".site-cli-examples")
    && styles.includes(".site-cli-shortcuts")
    && styles.includes(".site-cli-triangle")
    && styles.includes(".site-cli-github-links");
  const proCodexCloud = workflow.includes("name: Site Codex Cloud Delivery")
    && workflow.includes("STATUS: cloud-ready")
    && workflow.includes("https://chatgpt.com/codex/cloud")
    && workflow.includes("github.event_name == 'issues'")
    && workflow.includes("github.event_name == 'pull_request'")
    && workflow.includes("author_association == 'OWNER'")
    && workflow.includes("persist-credentials: false")
    && workflow.includes("npm run build:browser")
    && workflow.includes("npm run test:automation")
    && workflow.includes("npm run test:department")
    && !workflow.includes("CODEX_ACCESS_TOKEN")
    && !workflow.includes("OPENAI_API_KEY")
    && !workflow.includes("codex login")
    && !workflow.includes("codex exec")
    && !workflow.includes("secrets.")
    && components.includes('const SITE_CODEX_CLOUD = "https://chatgpt.com/codex/cloud"')
    && components.includes("SITE_CODEX_ENVIRONMENTS")
    && components.includes("siteCodexCloudPrompt")
    && components.includes("CODEX CLOUD TASK")
    && !components.includes("admin/access-tokens")
    && validator.includes("protected path cannot be changed by Site Codex")
    && !packageSource.includes("@openai/codex")
    && !packageSource.includes("codex:start");
  const noBrowserSecret = !components.includes("SESSION TOKEN")
    && !components.includes("api.openai.com/v1/responses")
    && !components.includes("OPENAI_API_KEY")
    && !/localStorage[^\n]{0,160}token|sessionStorage\.setItem\([^\n]{0,120}token/i.test(components);
  const confirmedWrite = components.includes("window.confirm")
    && components.includes('CONFIRMED: ${mode === "edit" ? "yes" : "not-required"}')
    && !components.includes("127.0.0.1")
    && !components.includes("LOCAL BRIDGE")
    && !components.includes("Start-Site-Codex");
  if (!dropdownRemoved || !cliReady || !proCodexCloud || !noBrowserSecret || !confirmedWrite) {
    throw new Error("site CLI must open Codex Cloud directly, provide supported terminal commands, and verify Pull Request delivery without browser or Actions secrets");
  }
  console.log("  OK  질문 드롭다운 제거 · Codex Cloud 직접 실행 준비 · 공식 CLI 명령 · Pull Request 검증");
} catch (error) {
  failed = true;
  console.error(`  FAIL  site CLI workspace: ${error.message}`);
}

try {
  const [components, styles] = await Promise.all([
    readFile("components.jsx", "utf8"),
    readFile("styles.css", "utf8"),
  ]);
  const howLinkReady = components.includes('href="https://bizdevelopment1-max.github.io/ai/How/"')
    && components.includes('className="tb-how-link"')
    && components.includes('title="How 작성 방법 열기"')
    && components.includes('className="tb-resource-actions"')
    && components.includes('className="tb-cli-guide"')
    && components.includes("siteCliGuidePayload")
    && components.includes("guideSignal={cliGuideSignal}")
    && components.includes('target="_blank"')
    && components.includes('rel="noreferrer"')
    && styles.includes(".tb-title-meta")
    && styles.includes(".tb-resource-actions")
    && styles.includes(".tb-how-link:hover, .tb-how-link:focus-visible, .tb-cli-guide:hover, .tb-cli-guide:focus-visible");
  if (!howLinkReady) throw new Error("top bar must expose the published How guide as an accessible external link");
  console.log("  OK  top bar How 작성 방법 link");
} catch (error) {
  failed = true;
  console.error(`  FAIL  top bar How link: ${error.message}`);
}

try {
  const [how, backgroundBuilder] = await Promise.all([
    readFile("How/index.html", "utf8"),
    readFile("scripts/build-how-context-backgrounds.mjs", "utf8"),
  ]);
  const slides = [...how.matchAll(/<section class="slide(?:\s|\")/g)].length;
  const videos = new Set([...how.matchAll(/data-src="([^"]+\.mp4)"/g)].map(match => match[1]));
  const backgroundCarousels = [...how.matchAll(/class="bg-carousel"/g)].length;
  const contextBackgrounds = [...how.matchAll(/assets\/context-bg\/([0-9]{2}-[a-z-]+-[abc]\.svg)/g)].map(match => match[1]);
  const carouselScenes = contextBackgrounds.length;
  const carouselBlocks = [...how.matchAll(/<div class="bg-carousel" data-theme="[^"]+" data-scenes="([^"]+)" aria-hidden="true">([\s\S]*?)<\/div>/g)];
  const tripleContextBackgrounds = carouselBlocks.length === 13
    && carouselBlocks.every(([, scenes, content]) => scenes.split("|").length === 3
      && [...content.matchAll(/<span style="background-image:url\('assets\/context-bg\/[0-9]{2}-[a-z-]+-[abc]\.svg'\)"><\/span>/g)].length === 3)
    && new Set(contextBackgrounds).size === 39
    && backgroundBuilder.includes("contexts.length * variants.length")
    && backgroundBuilder.includes('width="1600" height="900"')
    && how.includes(".bg-carousel span:nth-child(3)")
    && how.includes("@keyframes bgSceneC")
    && how.includes(".bg-carousel span:nth-child(n+2) { display: none; }");
  const accentColors = new Set([...how.matchAll(/data-accent="([^"]+)"/g)].map(match => match[1]));
  const secondaryAccentColors = new Set([...how.matchAll(/data-accent2="([^"]+)"/g)].map(match => match[1]));
  const tertiaryAccentColors = new Set([...how.matchAll(/data-accent3="([^"]+)"/g)].map(match => match[1]));
  const samsungOne = how.includes('font-family: "SamsungOne700C"')
    && how.includes('font-family: "SamsungOne500C"')
    && how.includes('--title-font: "SamsungOne700C"')
    && how.includes('--body-font: "SamsungOne500C"');
  const largerType = how.includes('h1 { max-width: 1160px; font-size: clamp(50px')
    && how.includes('h2 { max-width: 1260px; font-size: clamp(36px')
    && how.includes('.slide-title p { font-size: clamp(15px')
    && how.includes('.branch li, .clean-list li { font-size: clamp(13px');
  const responsiveFit = how.includes('class="cover-title-line"')
    && how.includes('--fit-scale')
    && how.includes('const fitSlides = () =>')
    && how.includes("document.fonts?.ready.then(scheduleFit)")
    && how.includes('word-break: keep-all')
    && how.includes('overflow-y: auto');
  const consultingMotion = !how.includes("const consultingLogic = {")
    && !how.includes("className = 'consulting-ribbon'")
    && !how.includes("className = 'logic-arrow'")
    && how.includes("track.classList.add('diagram-track')")
    && how.includes('--tone-gradient: linear-gradient')
    && how.includes('--blue-gradient: var(--tone-gradient)')
    && how.includes('@keyframes arrowTravel')
    && how.includes("@keyframes diagramRise");
  const bcgArrowSystem = how.includes(".tri-arrow {")
    && how.includes("--consult-arrow: polygon(0 50%, 18% 5%, 18% 40%, 82% 40%, 82% 5%, 100% 50%, 82% 95%, 82% 60%, 18% 60%, 18% 95%)")
    && how.includes("clip-path: var(--consult-arrow)")
    && how.includes("width: clamp(82px, 7.4vw, 148px)")
    && how.includes("@keyframes arrowFloat");
  const vibeCodingCover = how.includes("VIBE CODING · REAL BUILD STORY")
    && how.includes("바이브 코딩으로 만든 AI 신사업 인텔리전스")
    && how.includes("첫 입력부터 데이터 자동화·전략 화면·운영까지")
    && !how.includes("Codex로 만드는 AI 전략 사이트")
    && how.includes("HOW · AI 신사업 인텔리전스 바이브 코딩 구축기");
  const beginnerSiteBuildStory = how.includes("SITE BUILD AT A GLANCE")
    && how.includes("THE FIRST BUSINESS REQUEST")
    && how.includes("SITE QUALITY")
    && how.includes("INFORMATION ARCHITECTURE")
    && how.includes("DATA PIPELINE")
    && how.includes("COMPANY DATA CONTRACT")
    && how.includes("AUTOMATED UPDATE ENGINE")
    && how.includes("CONSULTING DECISION SYSTEM")
    && how.includes("BUILD FLOW FOR BEGINNERS")
    && how.includes("DOUBLE DIAMOND OPERATING LOOP")
    && how.includes("복사해서 시작")
    && how.includes("실제 사용한 첫 입력")
    && how.includes("실제로 사용한 데이터 요청")
    && how.includes("기업 상세를 만든 입력")
    && how.includes("초보자 입력");
  const crossVerifiedCaseStudy = how.includes("REAL INPUT TO VERIFIED OUTPUT")
    && how.includes("Claude Code 독립 검토")
    && how.includes("Perplexity + 공식 원문")
    && how.includes("Codex 구현 → Claude Code 반대 관점 검토")
    && [...how.matchAll(/class="source-link"/g)].length >= 3
    && how.includes("최종 판정 원칙")
    && how.includes("node scripts/test-automation.mjs")
    && how.includes("LONG-RUN CASES")
    && how.includes("CASE 01 · DUPLICATION")
    && how.includes("CASE 02 · ORGANIZATION")
    && how.includes("CASE 03 · LOAD SPEED");
  const noLinesInsideBoxes = !how.includes(".consulting-ribbon")
    && !how.includes(".logic-arrow")
    && how.includes(".diagram-track::before, .diagram-track::after { content: none !important; display: none !important; }")
    && /\.diagram-item::after\s*\{[\s\S]{0,100}content:\s*none;[\s\S]{0,50}display:\s*none;/.test(how);
  const removedLegacyCopy = !how.includes("ARROW KEYS TO NAVIGATE")
    && !how.includes("12 SLIDES")
    && !how.includes("10–15 MIN")
    && !how.includes("BEGINNER FRIENDLY")
    && !how.includes("브라우저에서 CLI 직접 실행 불가")
    && !how.includes("현재 구조를 읽고 How만 수정")
    && !how.includes("How는 15장 HTML 프레젠테이션")
    && !how.includes("개발 경험이 없어도")
    && !/\bJSON\b/i.test(how);
  const analogousGradientSystem = accentColors.size >= 6
    && secondaryAccentColors.size >= 6
    && tertiaryAccentColors.size >= 5
    && how.includes("--accent-2")
    && how.includes("--accent-rgb-2")
    && how.includes("--accent-3")
    && how.includes("--accent-rgb-3")
    && how.includes("--tone-gradient: linear-gradient(118deg, color-mix(in srgb, var(--accent) 78%, white)")
    && how.includes("--tone-panel: linear-gradient(140deg, color-mix(in srgb, var(--accent) 24%, #06152d)")
    && how.includes("background: linear-gradient(142deg, rgba(var(--item-rgb), .30), rgba(var(--item-rgb), .16)")
    && how.includes("background: linear-gradient(145deg, rgba(var(--cell-rgb),.32), rgba(var(--cell-rgb),.16)")
    && !how.includes("linear-gradient(118deg, #00b3e3 0%, var(--accent)")
    && how.includes("--signature-blue: linear-gradient(135deg, #00b3e3 0%, #0072ce 52%, #1428a0 100%)")
    && how.includes(".diagram-track > .diagram-item:nth-of-type(4n+4)")
    && how.includes(".north-star")
    && how.includes(".evidence-matrix")
    && how.includes(".double-diamond")
    && how.includes(".slide-inner::after")
    && how.includes("@keyframes blueSignature");
  const introVideoExperience = how.includes('class="slide active intro-video cover-slide"')
    && how.includes('class="slide intro-video summary-slide"')
    && how.includes("slides[0].classList.add('scroll-lift')")
    && how.includes("video.defaultMuted = true")
    && how.includes("video.volume = 0")
    && how.includes(".summary-slide .flow")
    && how.includes(".summary-slide .takeaway");
  const consultingScreenRefresh = !how.includes('class="cover-rule')
    && how.includes('class="flow sequential-flow reveal"')
    && how.includes("@keyframes sequentialGlow")
    && how.includes("@keyframes sequentialSheen")
    && how.includes("sequentialGlow 10.5s ease-in-out calc(1s + var(--sequence) * 1.2s)")
    && how.includes(".summary-slide .flow > .tri-arrow { width: 38px; height: 12px; }")
    && how.includes("grid-template-columns: repeat(5, minmax(0, 1fr) 34px) minmax(0, 1fr)")
    && how.includes(".pipeline > .tri-arrow { width: 32px; height: 10px; }")
    && how.includes('class="consulting-brief-tree mbb-issue-tree reveal"')
    && how.includes('class="brief-mandate"')
    && how.includes('class="brief-pillars"')
    && how.includes('class="mece-role-map reveal"')
    && how.includes('class="mece-bridge"')
    && how.includes('class="decision-rule reveal"')
    && how.includes(".deck :where(p, li, dd, dt, span, small, code, kbd, a, button)")
    && how.includes(".deck :where(h1, h2, h3, h4, strong, b, em");
  const frameworkLabels = [...how.matchAll(/data-framework="[^"]+"/g)].length;
  const mbbQualitySystem = frameworkLabels === 14
    && how.includes("사이트 Quality는 정보량이 아니라")
    && !how.includes("사이트의 북극성은")
    && how.includes("02-quality-a.svg")
    && !how.includes("02-north-star-a.svg")
    && how.includes("McKinsey · 7S")
    && how.includes("McKinsey · Three Horizons")
    && how.includes("BCG · Strategy Palette")
    && how.includes("Bain · RAPID")
    && how.includes("Bain · Results Delivery")
    && how.includes('class="vertical-arrow"')
    && how.includes("--consult-arrow-vertical")
    && how.includes("--type-slide-title")
    && how.includes("--type-card-body")
    && how.includes("chip.className = 'framework-chip'");
  if (slides !== 15 || videos.size !== 2 || backgroundCarousels !== 13 || carouselScenes !== 39 || !tripleContextBackgrounds || !samsungOne || !largerType || !responsiveFit || !consultingMotion || !bcgArrowSystem || !vibeCodingCover || !beginnerSiteBuildStory || !crossVerifiedCaseStudy || !noLinesInsideBoxes || !removedLegacyCopy || !analogousGradientSystem || !introVideoExperience || !consultingScreenRefresh || !mbbQualitySystem) {
    throw new Error("How deck must keep 15 slides, 2 muted intro videos, 13 triple-image backgrounds, compact diagram connectors, slow sequential sheen, beginner prompts, data automation, consulting frameworks and operating cases");
  }
  console.log("  OK  How Quality 기준 · MBB 프레임워크 · 세로형 커넥터 · 일관된 장표 타이포 · 문맥별 배경 39장");
} catch (error) {
  failed = true;
  console.error(`  FAIL  How consulting deck: ${error.message}`);
}

try {
  const [app, components, anim, boards, styles, consultingArchitecture] = await Promise.all([
    readFile("app.jsx", "utf8"),
    readFile("components.jsx", "utf8"),
    readFile("anim.jsx", "utf8"),
    readFile("boards.jsx", "utf8"),
    readFile("styles.css", "utf8"),
    readFile("config/consulting-architecture.json", "utf8").then(JSON.parse),
  ]);
  const navSource = components.slice(components.indexOf("const NAV = ["), components.indexOf("const NAV_SECTION_IDS"));
  const navIds = [...navSource.matchAll(/\{\s*id:\s*"([^"]+)"/g)].map(match => match[1]);
  const sectionIds = [...app.matchAll(/(?:<LazySection\s+id=|data-section=)"([^"]+)"/g)].map(match => match[1]);
  const expectedOrder = ["overview", "strategy", "opportunity", "newbiz", "valuechain", "signals", "sanalysis", "evidence", "validation"];
  const missingOnRight = navIds.filter(id => !sectionIds.includes(id));
  const missingOnLeft = sectionIds.filter(id => !navIds.includes(id));
  const sameMeceOrder = JSON.stringify(navIds) === JSON.stringify(expectedOrder)
    && JSON.stringify(sectionIds) === JSON.stringify(expectedOrder);
  const overviewHeaderRemoved = !app.includes('className="ov-head"')
    && !app.includes('className="ov-title"');
  const sidebarBrandSource = components.match(/<span className="sb-logo-txt">[\s\S]*?<\/span>\s*<\/span>/)?.[0] || "";
  const hierarchyReady = (navSource.match(/children:\s*\[/g) || []).length === expectedOrder.length
    && components.includes('className={"sb-category"')
    && components.includes('className="sb-company-list"')
    && components.includes("sectionCategories[item.id]")
    && app.includes("const sectionCategories = useMemo")
    && app.includes('activeCategory={navCategory.section === active ? navCategory.id : ""}')
    && app.includes('activeCategory={navCategory.section === "sanalysis" ? navCategory.id : ""}')
    && app.includes('.filter(layer => navCategory.section !== "valuechain" || !navCategory.id || layer.id === navCategory.id)');
  const sidebarCopyClean = !/(?:mobile|모바일)/i.test(`${navSource}\n${sidebarBrandSource}`)
    && navSource.includes('ko: "산업·경쟁 브리핑"')
    && navSource.includes('ko: "신사업 기회 DB"')
    && !navSource.includes('id: "audit"')
    && !navSource.includes("데이터 신뢰센터")
    && sidebarBrandSource.includes("<b>AI</b>");
  const removedSidebarKeys = new Set([
    "executive-brief", "execution-plan", "build-buy-partner",
    "execution-hypothesis", "action-implication",
  ]);
  const architectureChildren = (consultingArchitecture.workstreams || [])
    .flatMap(workstream => workstream.sections || [])
    .flatMap(section => section.children || []);
  const removedSidebarCopy = architectureChildren.some(child => removedSidebarKeys.has(child.key))
    || [...removedSidebarKeys].some(key => navSource.includes(`key: "${key}"`));
  const subsectionScrollReady = app.includes('const navTarget = (sectionId, childId = "")')
    && app.includes("navTo(section, categoryId)")
    && app.includes('window.__DASH_NAV_ANCHOR = childId')
    && components.includes("HIDDEN_SIDEBAR_CHILD_KEYS")
    && components.includes("HIDDEN_SIDEBAR_CHILD_LABELS")
    && boards.includes('data-nav-anchor="decision-criteria"')
    && boards.includes("data-nav-anchor={layerId}")
    && styles.includes("[data-nav-anchor]")
    && styles.includes("scroll-margin-top: 14px");
  if (missingOnRight.length || missingOnLeft.length
    || !sameMeceOrder
    || !overviewHeaderRemoved
    || app.includes("function AuditPanel")
    || app.includes('id="audit"')
    || !/for \(const id of NAV_SECTION_IDS\)/.test(app)
    || /if \(REDUCED\) \{ setInView\(true\)/.test(anim)
    || !hierarchyReady
    || !sidebarCopyClean
    || removedSidebarCopy
    || !subsectionScrollReady) {
    throw new Error(`navigation mismatch left-only=${missingOnRight.join(",")} right-only=${missingOnLeft.join(",")}`);
  }
  console.log(`  정상  MECE navigation maps 1:1 in order to ${navIds.length} right-side sections · 첫 화면 중복 제목 제거`);
} catch (error) {
  failed = true;
  console.error(`  실패  navigation mapping: ${error.message}`);
}

try {
  const [app, components, boards, styles] = await Promise.all([
    readFile("app.jsx", "utf8"),
    readFile("components.jsx", "utf8"),
    readFile("boards.jsx", "utf8"),
    readFile("styles.css", "utf8"),
  ]);
  const removedThemeArtifacts = [
    'id: "themes"',
    'id="themes"',
    "MXThemeBoard",
    "Priority Business Themes",
    "BUSINESS PORTFOLIO",
    ".mxt",
  ];
  const remaining = removedThemeArtifacts.filter(token => `${app}\n${components}\n${boards}\n${styles}`.includes(token));
  if (remaining.length) throw new Error(`removed theme artifacts remain: ${remaining.join(", ")}`);
  console.log("  OK  핵심 사업 테마 navigation, section, renderer, and styles are fully removed");
} catch (error) {
  failed = true;
  console.error(`  FAIL  business theme removal: ${error.message}`);
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
  const [app, boards, components, styles, companies, strategyView, strategyBuilder, consultingArchitecture, monetizationCrawler] = await Promise.all([
    readFile("app.jsx", "utf8"),
    readFile("boards.jsx", "utf8"),
    readFile("components.jsx", "utf8"),
    readFile("styles.css", "utf8"),
    readFile("companies.json", "utf8").then(JSON.parse),
    readFile("strategy-view.json", "utf8").then(JSON.parse),
    readFile("scripts/strategy-view.mjs", "utf8"),
    readFile("config/consulting-architecture.json", "utf8").then(JSON.parse),
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
  const linkedinProfiles = normalized.flatMap(company => (company.organization?.executiveTeam || [])
    .map(person => person.li).filter(Boolean));
  const linkedinReady = linkedinProfiles.length >= 10
    && linkedinProfiles.every(url => /^https:\/\/(?:(?:www|[a-z]{2})\.)?linkedin\.com\/in\/[^/?#]+\/?$/.test(url))
    && !boards.includes("linkedin.com/search/results/people")
    && !boards.includes("linkedin.com/search/results/companies");
  const strategyReady = strategyView?.sourceMode === "generated-from-verified-ledgers"
    && !Object.hasOwn(strategyView, "choices")
    && !Object.hasOwn(strategyView, "capabilities")
    && !Object.hasOwn(strategyView, "decisionOutputs")
    && !Object.hasOwn(strategyView, "workloadMap")
    && consultingArchitecture?.workstreams?.length === 4
    && strategyView?.consultingModel?.workstreams?.length === 4
    && strategyView?.consultingModel?.coverage?.sections === 9
    && new Set(strategyView.consultingModel.navigation.map(item => item.id)).size === 9
    && strategyView?.priorityFramework?.items?.length === 4
    && strategyView?.priorityFramework?.criteria?.length === 8
    && strategyView.priorityFramework.items.every(item => item.sourceOpportunityId && Number.isFinite(item.score) && item.drivers?.length)
    && !Object.hasOwn(strategyView, "horizons")
    && strategyView?.opportunityPortfolio?.length >= 9
    && !Object.hasOwn(strategyView, "accountPortfolio")
    && boards.includes("function MobileStrategyBoard")
    && !boards.includes("Competitive Platform Portfolio")
    && !strategyBuilder.includes("PORTFOLIO_COVERAGE")
    && ![
      "OS·앱·계정·결제·개인 컨텍스트를 연결해 새로운 AI 서비스 매출 설계",
      "공개 원문 근거로 우선순위 갱신",
      "각 산출물에 근거일·책임자·다음 의사결정·완료 기준",
      "사용자 Pain point를 모바일 경험",
      "모바일의 반복 사용 순간을 플랫폼 요구",
      "핵심 경험·크리에이터 도구·컨텍스트 통제",
      "공식 제품 근거를 고객 접점",
      "90-Day Execution Roadmap",
      "Discover · Design · Decide",
      "수요·통제점 정의",
      "사용자 과업·지불 의향·경쟁 경험 근거 수집",
      "OS·앱·계정·결제·데이터 통제점 분리",
      "상위 3개 사용 사례와 정보 공백 명시",
      "경험·사업 설계",
      "온디바이스·클라우드·멀티모델 조합 비교",
      "구독·번들·거래·B2B 수익모델 산정",
      "자체 개발·제휴·투자와 출시 KPI 설정",
      "90일 실험 실행",
      "Scale·Iterate·Stop 안건 상정",
      "제품·서비스·파트너 책임자와 일정 지정",
      "완료율·유지율·ARPU·원가·신뢰 KPI 추적",
      "매일 확인한 원문 근거(복수 출처·반복 신호·추출 수치)",
      "Evidence-led",
      "상대 중요도 기준",
      "단말 · OS · 통신사 · NPU · 파트너 · 규제",
      "Where to Play · How to Win",
      "개인 컨텍스트·멀티모델 에이전트·서비스 유통·버티컬 포트폴리오의 4개 우선 플레이",
    ].some(copy => boards.includes(copy))
    && !/msf-choices|msf-choice|msf-house-pillars/.test(boards)
    && boards.includes('className="msf-priority-grid"')
    && styles.includes(".msf-priority-card:is(:hover, :focus-visible)")
    && boards.includes("consultingModel.methodology")
    && boards.includes('className="msf-mece-model"')
    && !boards.includes("분석 툴킷")
    && boards.includes("function StrategyPortfolioCard")
    && boards.includes("function ConsultingDecisionRail")
    && boards.includes("Need → Offer → Economics → Evidence")
    && boards.includes("Strategy &amp;")
    && boards.includes('className="msf-strategy-house"')
    && !boards.includes('className="msf-control-logic"')
    && !boards.includes('className="msf-workload-name"')
    && styles.includes(".msf-mece-stage")
    && styles.includes("word-break: keep-all; overflow-wrap: break-word; text-wrap: pretty;")
    && boards.includes('className="msf-layer-evidence"')
    && !boards.includes("msf-layer-meter")
    && boards.includes('className="vc-logic-map"')
    && boards.includes('className="consult-decision-rail"')
    && boards.includes('className="cd-outline-group"')
    && boards.includes("1. 사업 현황")
    && boards.includes("2. 사업 전략 방향 및 주요 역량")
    && boards.includes("3. 시사점")
    && boards.includes('className="cd-org-tier-groups"')
    && ["현재 사업", "Biz Model", "사업 방향", "최근 실행"].every(label => boards.includes(`>${label}<`))
    && boards.includes('className="vc-portfolio-grid"')
    && boards.includes("const recentSignalCount = Number(c.live?.mentions30 || 0)")
    && boards.includes(">최근 30일 신호<")
    && boards.includes('className="startup-portfolio-grid"')
    && boards.includes("const rows = (companies || []).filter(c => c.layer === layerId)")
    && boards.includes("claimUniqueCompanies")
    && !boards.includes("PORTFOLIO DECISION")
    && !boards.includes("STRATEGIC MOVE")
    && !boards.includes("옵션 확보 · 신호 감시")
    && !boards.includes("<h4>밸류 프로포지션")
    && !boards.includes("<h4>방향성 · 추구 가치")
    && app.includes('id="strategy"')
    && app.includes("navigation={navigation}")
    && app.includes("navigation.map(item =>")
    && components.includes('id: "valuechain"')
    && (expectedLayers.every(id => app.includes(`layerId="${id}"`))
      || (app.includes("(D.VALUE_CHAIN || [])") && app.includes("layerId={layer.id}")))
    && monetizationCrawler.includes("loadDash().COMPANY_LAYER");
  if (JSON.stringify(layerIds) !== JSON.stringify(expectedLayers)
    || normalized.length !== (dash.COMPANIES || []).length
    || companies.schemaVersion !== 6 || !completeCoverage || !strategyReady || !linkedinReady) {
    const causes = [
      JSON.stringify(layerIds) !== JSON.stringify(expectedLayers) && "layer-order",
      normalized.length !== (dash.COMPANIES || []).length && `normalized-${normalized.length}/${(dash.COMPANIES || []).length}`,
      companies.schemaVersion !== 6 && `schema-${companies.schemaVersion}`,
      !completeCoverage && "profile-coverage",
      !strategyReady && "strategy-ui",
      !linkedinReady && `linkedin-${linkedinProfiles.length}`,
    ].filter(Boolean).join(", ");
    throw new Error(`seven-layer strategy, MECE portfolio UI, normalized profiles, or verified LinkedIn links are incomplete (${causes})`);
  }
  console.log(`  OK  모바일 AI 7계층 전략 프레임 · 기업 ${normalized.length}개 MECE 개요/조직 · LinkedIn 직접 연결`);
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
  const executiveFeedsReady = companyRows.every(company => {
    const feed = company.executiveFeed || {};
    return feed.schemaVersion === 2
      && feed.methodology === "executive-name+company-focus+nearest-speaker-direct-quote+korean-source-alignment"
      && Number.isInteger(feed.leadersTracked)
      && Array.isArray(feed.sourceUrls)
      && Array.isArray(feed.quotes)
      && Array.isArray(feed.mentions)
      && feed.quotes.every(item =>
        item.speaker && item.quoteOriginal && item.quoteKo
        && /^https?:\/\//.test(String(item.evidenceUrl || ""))
        && /^direct-quote\+(?:aligned-korean-source-summary|machine-translated)$/.test(item.evidenceType || ""))
      && feed.mentions.every(item =>
        item.who && item.titleEn
        && /^https?:\/\//.test(String(item.url || ""))
        && item.evidenceType === "publisher-page-extractive");
  });
  const executiveUiReady = boards.includes("경영진 발언·활동 <em>Executive Voice</em>")
    && boards.includes("원문 검증 · 기업 직접 연관 · 자동 갱신")
    && boards.includes("직접 인용 {quoteCount}건 · 기사 언급 {mentionCount}건")
    && !boards.includes('className="cd-exec-flow"')
    && !boards.includes("interviewRows.length > 0 && (")
    && !boards.includes("c.live && Array.isArray(c.live.execNews)");
  const startupRows = [...(startups.large || []), ...(startups.small || []), ...(startups.institutional || [])];
  const organizationRows = [...companyRows, ...startupRows].map(row => row.organization).filter(Boolean);
  const people = organizationRows.flatMap(organization => organization.executiveTeam || []);
  const depthReady = organizationRows.every(organization =>
    Array.isArray(organization.executiveTeam) && organization.executiveTeam.length <= 12);
  const organizationPublicationReady = companyRows.every(company => {
    const publication = company.organization?.publication || {};
    return publication.schemaVersion === 1
      && publication.policy === "verified-people-only+official-source-preferred+no-role-inference"
      && Number.isInteger(publication.rosterCount)
      && Number.isInteger(publication.verifiedRoleCount)
      && Number.isInteger(publication.sourceCount)
      && ["verified-roster", "curated-roster", "no-public-roster"].includes(publication.status)
      && publication.checkedAt;
  });
  const directProfilesVerified = people.filter(person => person.li).every(person =>
    /^https:\/\/(?:(?:www|[a-z]{2,3})\.)?linkedin\.com\/in\/[A-Za-z0-9._%-]+\/?$/i.test(person.li)
    && /^(curated-direct-profile|official-jsonld-direct-profile|wikidata-property-direct-profile)$/.test(person.linkedinVerification || ""));
  const nodeDetailReady = boards.includes(">학교·전공<")
    && boards.includes(">빅테크·주요 경력<")
    && boards.includes("Business Unit Leadership")
    && boards.includes(".slice(0, 11)")
    && !boards.includes('className="cd-org-note"');
  const inlineExecutiveTitlesReady = boards.includes("function executiveRoleLabel(value, primaryOnly = false)")
    && boards.includes("function executiveDisplayName(person, primaryOnly = false)")
    && boards.includes("executiveDisplayName(person)).filter(Boolean).join")
    && boards.includes('["경영진", executive]')
    && boards.includes("<b>{executiveDisplayName(lead)}</b>")
    && boards.includes("<b>{executiveDisplayName(p)}</b>")
    && boards.includes("executiveDisplayName({ name: row.who, role: row.role })")
    && !boards.includes('className="cd-org-role"')
    && !boards.includes('className="cd-itv-role"');
  const refreshReady = companyCrawler.includes("const MAX_EXECUTIVES = 12")
    && startupCrawler.includes("const MAX_EXECUTIVES = 12")
    && companyCrawler.includes("roleSourceType")
    && companyCrawler.includes("linkedinVerification")
    && startupCrawler.includes("linkedinVerification");
  if (!depthReady || !organizationPublicationReady || !directProfilesVerified || !nodeDetailReady || !inlineExecutiveTitlesReady
    || !executiveFeedsReady || !executiveUiReady || !refreshReady) {
    throw new Error("12-person leadership merge, inline executive titles, universal executive feeds, in-node background detail, direct-profile verification, or recurring normalization is incomplete");
  }
  console.log(`  OK  전체 기업 조직도 ${organizationRows.length}개 · 전 기업 Executive Quotes/Mentions 스키마 · 최대 12명 · LinkedIn 직접 프로필 검증`);
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
    && styles.includes(".msf-workload-name small { grid-column: 2;")
    && styles.includes("@media (hover: hover) and (pointer: fine)")
    && styles.includes(".consult-decision-rail > i")
    && styles.includes("border-left: 11px solid var(--consult-gold)")
    && styles.includes("Readability contract · safe in light/dark and hover/focus modes")
    && styles.includes("subtle surface tint instead of full-card colour")
    && styles.includes("-webkit-text-fill-color: currentColor")
    && !/\.rainbow-link:hover[\s\S]{0,400}color:\s*transparent/.test(styles)
    && styles.includes("@media (prefers-reduced-motion: reduce)")
    && !styles.includes("filter: invert(");
  if (!consultingInteraction) {
    throw new Error("consulting flow, triangular arrows, theme-safe hover contrast, and reduced-motion interaction are required");
  }
  console.log("  OK  컨설팅 의사결정 도식 · 삼각형 화살표 · 테마 안전 호버 · 가독성 계약");
} catch (error) {
  failed = true;
  console.error(`  FAIL  consulting 3D interaction system: ${error.message}`);
}

try {
  const styles = await readFile("styles.css", "utf8");
  const hoverContrastReady = styles.includes("Readability contract · safe in light/dark and hover/focus modes")
    && styles.includes("background: color-mix(in srgb, var(--hover-tone")
    && styles.includes("-webkit-text-fill-color: currentColor !important")
    && styles.includes("outline: 3px solid")
    && styles.includes("text-wrap: pretty")
    && styles.includes("overflow-wrap: anywhere")
    && styles.includes("word-break: keep-all")
    && !/\.art:hover[\s\S]{0,500}-webkit-text-fill-color:\s*transparent/.test(styles);
  if (!hoverContrastReady) {
    throw new Error("hover labels and bright nested surfaces must stay readable without edge or text clipping");
  }
  console.log("  OK  hover/focus contrast and value-chain edge/text clipping guards");
} catch (error) {
  failed = true;
  console.error(`  FAIL  nested hover contrast: ${error.message}`);
}

try {
  const [index, boards, styles, data, sourceContent, monetizationCrawler] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("boards.jsx", "utf8"),
    readFile("styles.css", "utf8"),
    readFile("config/dashboard-taxonomy.json", "utf8"),
    readFile("scripts/source-content.mjs", "utf8"),
    readFile("scripts/crawl-monetization.mjs", "utf8"),
  ]);
  const uiWithoutEncodingGuard = boards.replace(/const MALFORMED_DISPLAY_ENCODING = .*?;\r?\n/, "");
  const visibleSource = `${uiWithoutEncodingGuard}\n${data}\n${index}\n${styles}`;
  const brokenText = /\uFFFD|(?:Ã.|Â.|â[€™“”¦])|(?:ðŸ)|(?:\?[가-힣]){2,}/.test(visibleSource);
  const utf8Ready = /<meta charset="UTF-8"/.test(index)
    && /charset=UTF-8/.test(index)
    && !/pretendard\.min\.css/.test(index)
    && styles.includes("--f: system-ui")
    && boards.includes("function safeDisplayString")
    && sourceContent.includes("malformed-source-encoding");
  const professionalSystem = boards.includes('className="mplay-framework"')
    && boards.includes("STRATEGY EVIDENCE ARCHITECTURE")
    && !boards.includes("크롤 신호")
    && !boards.includes("수익모델·사업 방향 신호는 매일 크롤 기사에서 자동 분류·누적")
    && ["FACT BASE", "REVENUE ENGINE", "EXECUTION VECTOR", "COMPANY VIEW"].every(label => boards.includes(label))
    && styles.includes(".mplay-framework-flow")
    && styles.includes("@keyframes mplayEvidenceSweep")
    && styles.includes("grid-template-columns: repeat(auto-fit, minmax(min(100%, 350px), 1fr))")
    && styles.includes("grid-template-columns: minmax(118px, 126px) minmax(0, 1fr)")
    && styles.includes("white-space: normal; overflow-wrap: anywhere; word-break: keep-all")
    && styles.includes(".mplay-tag { grid-row: auto; width: auto; max-width: 100%; justify-self: start; }")
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
  const [companies, officials, startups, a16z, ventures, forecasts, news, workflow, intelligenceBuilder, companyCrawler, llmClient, boards] = await Promise.all([
    readFile("companies.json", "utf8").then(JSON.parse),
    readFile("company-officials.json", "utf8").then(JSON.parse),
    readFile("startups.json", "utf8").then(JSON.parse),
    readFile("a16z-startups.json", "utf8").then(JSON.parse),
    readFile("strategic-ventures.json", "utf8").then(JSON.parse),
    readFile("business-model-forecasts.json", "utf8").then(JSON.parse),
    readFile("news.json", "utf8").then(JSON.parse),
    readFile(".github/workflows/daily-news.yml", "utf8"),
    readFile("scripts/build-company-intelligence.mjs", "utf8"),
    readFile("scripts/crawl-companies.mjs", "utf8"),
    readFile("scripts/llm.mjs", "utf8"),
    readFile("boards.jsx", "utf8"),
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
      && value.capabilityProfile?.schemaVersion === 1
      && value.capabilityProfile?.dimensions?.length >= 2
      && value.capabilityProfile.dimensions.every(item => item.id && item.label && item.value)
      && Array.isArray(value.strategicImplications) && value.strategicImplications.length >= 1
      && value.strategicImplications.every(item => item.assessment && item.rationale
        && item.groundingStatus === "analyst-inference-separated-from-company-fact")
      && value.evidenceFingerprint
      && value.groundingStatus === "numeric-and-source-reference-checked"
      && sections.every(key => value[key]?.confidence && value[key]?.groundingStatus);
  });
  const companyRows = Object.values(companies.companies || {});
  const strategyProfilesReady = companyRows.every(company => {
    const profile = company.strategyProfile || {};
    return profile.schemaVersion === 1
      && profile.currentBusiness
      && profile.classification && typeof profile.classification === "object"
      && Array.isArray(profile.sourceUrls)
      && profile.sourceUrls.some(url => /^https?:\/\//.test(String(url || "")))
      && profile.checkedAt;
  });
  const publishedStartupNames = new Set([
    ...(startups.large || []),
    ...(startups.small || []),
    ...(startups.institutional || []),
  ].map(startup => startup.name).filter(Boolean));
  const startupProfilesComplete = [...publishedStartupNames].every(name => {
    const company = companies.companies?.[name];
    return company?.intelligence?.publication?.coreComplete
      && company.intelligence.publication.visibleSections?.includes("product")
      && company.intelligence.currentBusiness?.summary
      && (company.intelligence.currentBusiness?.evidence || []).some(source => /^https?:\/\//.test(String(source?.url || "")));
  });
  const publicationPolicyReady = companyRows.every(company => {
    const value = company.intelligence || {};
    const publication = value.publication || {};
    const visible = new Set(publication.visibleSections || []);
    const practices = value.corePractices || [];
    return publication.schemaVersion === 2
      && publication.policy === "business+capability+implication-required+source-backed-optional-sections"
      && publication.coreComplete === true
      && visible.has("product")
      && /^\d{4}-\d{2}-\d{2}$/.test(publication.lastVerifiedAt || "")
      && ["fresh", "aging", "stale"].includes(publication.freshness)
      && Number.isInteger(publication.ageDays)
      && publication.latestEvidence?.url
      && (!visible.has("technology") || practices.some(item => item.sectionId === "technology"))
      && (!visible.has("infrastructure") || practices.some(item => item.sectionId === "infrastructure"))
      && (!visible.has("goToMarket") || value.revenueModel?.summary)
      && (!visible.has("partnerships") || practices.some(item => item.sectionId === "partnerships") || company.strategicVentures?.length)
      && (!visible.has("investment") || value.investmentDirection?.summary);
  }) && companies.schemaVersion === 6
    && companies.methodology?.includes("source-backed-section-publication+freshness");
  const blankSectionUiRemoved = !boards.includes('className="cd-outline-empty"')
    && !boards.includes("const Empty =")
    && boards.includes("const capabilitySectionIds =")
    && boards.includes('hasGoToMarket && <div className="cd-section cd-outline-sub">')
    && boards.includes('infrastructurePractice && <div className="cd-section cd-outline-sub">')
    && boards.includes('className="cd-capability-grid"')
    && boards.includes('className="cd-implication-grid"')
    && boards.includes('핵심 역량 <em>Core Capabilities</em>')
    && boards.includes('전략 방향 <em>Strategy Direction</em>');
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
  const forecastIds = (forecasts.models || []).map(item => item.id);
  const forecastsReady = forecasts.schemaVersion === 1
    && forecasts.methodology === "official-source-recrawl+observed-move-to-business-model-inference"
    && forecasts.factForecastBoundary
    && forecastIds.length === 7
    && new Set(forecastIds).size === forecastIds.length
    && forecasts.models.every(item =>
      item.forecast
      && item.revenueModel
      && item.operatorMove
      && item.evidenceStatus === "source-verified"
      && item.observedMoves?.length >= 2
      && item.useCases?.length >= 3
      && item.bestPractices?.length >= 4
      && item.watchMetrics?.length >= 4
      && item.evidence?.some(source => /^https:\/\/(www\.)?[^/]+/.test(String(source.url || "")))
      && !hasKoreanSentencePeriod([
        item.forecast,
        item.revenueModel,
        item.operatorMove,
        ...item.observedMoves,
        ...item.useCases,
        ...item.bestPractices,
        ...item.watchMetrics,
      ].join(" "))
      && !hasKoreanProseEnding([
        item.forecast,
        item.revenueModel,
        item.operatorMove,
        ...item.observedMoves,
        ...item.useCases,
        ...item.bestPractices,
        ...item.watchMetrics,
      ].join(" "))
    )
    && boards.includes("function BusinessModelForecasts({ dataVersion })")
    && boards.includes("business-model-forecasts.json")
    && workflow.includes("business-model-forecasts.json");
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
    && intelligenceBuilder.includes("rec.executiveFeed?.quotes")
    && intelligenceBuilder.includes("nearest.distance > 220")
    && companyCrawler.includes("articleFocusedOnCompany")
    && companyCrawler.includes("function deriveLeaders(org)")
    && companyCrawler.includes("const buildExecutiveFeed =")
    && companyCrawler.includes("nearest.distance > 220")
    && companyCrawler.includes('"direct-quote+aligned-korean-source-summary"')
    && companyCrawler.includes('"direct-quote+machine-translated"')
    && companyCrawler.includes("translateQuoteToKorean")
    && companyCrawler.includes("QUOTE_TRANSLATION_BUDGET")
    && companyCrawler.includes("rec.executiveFeed = executiveFeed")
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
  if (!intelligenceReady || !strategyProfilesReady
    || !startupProfilesComplete || !publicationPolicyReady || !blankSectionUiRemoved
    || !a16zReady || !ventureReady || !forecastsReady || !workflowReady || !grounded || !officialReady || !companyEvidenceFocused) {
    const causes = [
      !intelligenceReady && "intelligence",
      !strategyProfilesReady && "strategy-profiles",
      !startupProfilesComplete && "startup-profiles",
      !publicationPolicyReady && "publication-policy",
      !blankSectionUiRemoved && "detail-ui",
      !a16zReady && "a16z",
      !ventureReady && "ventures",
      !forecastsReady && "forecasts",
      !workflowReady && "workflow",
      !grounded && "grounding-guards",
      !officialReady && "official-sources",
      !companyEvidenceFocused && "company-focus",
    ].filter(Boolean).join(", ");
    throw new Error(`company intelligence must keep complete business, capability, implication and verified-organization baselines while optional claims remain source-grounded or blank (${causes})`);
  }
  console.log(`  OK  기업 인텔리전스 ${companyRows.length}개 · 스타트업 ${publishedStartupNames.size}개 공통 프로필 · 빈 섹션 자동 제외 · AI ${aiCompanies}개 · a16z Web 50/Mobile 50 · DeployCo/JV · 신사업 예측 7개 근거 자동화`);
} catch (error) {
  failed = true;
  console.error(`  FAIL  deep company intelligence automation: ${error.message}`);
}

try {
  const [taxonomy, financialCrawler] = await Promise.all([
    readFile("config/dashboard-taxonomy.json", "utf8").then(JSON.parse),
    readFile("scripts/crawl-financials.mjs", "utf8"),
  ]);
  if ((taxonomy.COMPANIES || []).some(company => ["valuation", "funding", "headcount", "note", "direction"].some(key => Object.hasOwn(company, key)))
    || !financialCrawler.includes("HEADCOUNT_MAX_AGE_MONTHS")
    || !financialCrawler.includes("employeesStale")) {
    throw new Error("mutable company facts or stale headcount can still be presented from registry configuration");
  }
  console.log("  OK  레지스트리 변동 사실 제거 · 오래된 인력 수 현행값 차단");
} catch (error) {
  failed = true;
  console.error(`  FAIL  volatile fact freshness: ${error.message}`);
}

try {
  const [styles, boards] = await Promise.all([
    readFile("styles.css", "utf8"),
    readFile("boards.jsx", "utf8"),
  ]);
  const forbiddenRoundedSideAccents = [
    /\.msf-layer\s*\{[^}]*border-top:/s,
    /\.cd-strategy-frame\s*\{[^}]*border-top:/s,
    /\.cd-sf-card\.action\s*\{[^}]*border-left:/s,
    /\.cd-sf-card\.risk\s*\{[^}]*border-left:/s,
    /\.tl-card\s*\{[^}]*border-left:/s,
    /\.nbz-deal\s*\{[^}]*border-top:/s,
    /\.acb-camp\s*\{[^}]*border-top:/s,
  ];
  const commandCenterRemoved = ["MobileAIBusinessBoard", "AI 신사업 Command Center", "Decision Radar", "mxc-"].every(marker => !boards.includes(marker))
    && !/\.mxc(?:[-\s.{:#>])/.test(styles);
  const consultingFrameReady = styles.includes("Consulting frame policy")
    && [".site-cli-command-grid button", ".section-stack-head", ".cd-prof-fin", ".source-pipeline>div"].every(selector => styles.includes(selector))
    && styles.includes(":is(.kpi,.ct-row,.report,.insight-card,.vp-card)::before{display:none!important}");
  if (forbiddenRoundedSideAccents.some(pattern => pattern.test(styles))
    || !consultingFrameReady
    || !commandCenterRemoved
    || !styles.includes(".sp-card")
    || !styles.includes("border: 1px solid color-mix(in srgb, var(--accent) 34%, var(--line));")) {
    throw new Error("rounded strategy cards must use full-card border/background emphasis");
  }
  console.log("  OK  단측 강조 제거 · 전체 프레임·입력→기준 게이트→의사결정 도식 적용");
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
  const [companyPolicy, crawler, companies, boards] = await Promise.all([
    readFile("config/company-source-policy.json", "utf8").then(JSON.parse),
    readFile("scripts/crawl-news.mjs", "utf8"),
    readFile("companies.json", "utf8").then(JSON.parse),
    readFile("boards.jsx", "utf8"),
  ]);
  const publishedSections = Object.values(companies.companies || {}).flatMap(company =>
    Object.values(company.intelligence || {}).filter(section => section?.groundingStatus === "source-grounded"));
  const groundedSections = publishedSections.every(section => (section.evidence || []).some(item => /^https?:\/\//.test(item?.url || "")));
  const requiredDomains = ["openai.com", "anthropic.com", "nvidianews.nvidia.com", "investors.cerebras.ai"];
  if (companyPolicy.cardRules?.requireIndividualSourceUrl !== true
    || companyPolicy.cardRules?.separateOfficialFromEstimate !== true
    || !requiredDomains.every(domain => companyPolicy.publisherDomains?.includes(domain))
    || !Array.isArray(companyPolicy.priorityStreams) || companyPolicy.priorityStreams.length < 4
    || !/PRIORITY_STREAMS/.test(crawler) || !/companySourcePolicy\.publisherDomains/.test(crawler)
    || !publishedSections.length || !groundedSections
    || !/source\.tier === "official"/.test(boards) || !/source\.url/.test(boards)) {
    throw new Error("company facts need dated individual sources and source-grounded publication gates");
  }
  console.log(`  OK  company fact policy · priority source streams · source-grounded sections ${publishedSections.length}`);
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
  const requiredLocales = ['hl: "zh-TW"', 'hl: "ja"', 'hl: "en-IN"', 'hl: "ko"'];
  if (!/locale = \{ hl: "en-US", gl: "US", ceid: "US:en" \}/.test(newsCrawler)
    || !/mxSourcePolicy/.test(newsCrawler)
    || !/REGIONAL_TOPICS/.test(newsCrawler)
    || !/PRIMARY_SOURCE_TOPICS/.test(newsCrawler)
    || !requiredLocales.every(locale => newsCrawler.includes(locale))
    || !/dedupeLatestBriefings/.test(newsCrawler)
    || !/textSimilarity/.test(newsCrawler)
    || !/displayEligible: isContentBacked\(s\)/.test(newsCrawler)
    || !/localeCompare\(String\(left\.date/.test(newsCrawler)
    || nearDuplicatePairs.length) {
    throw new Error("daily article feed must retain original-language regional coverage, latest-first ordering, and event deduplication");
  }
  console.log("  OK  article feed uses original-language regional sources, latest-first ordering, and event deduplication");
} catch (error) {
  failed = true;
  console.error(`  FAIL  article source boundary: ${error.message}`);
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
  const videoPanel = boards.includes('assets/competitive-dynamics.mp4?v=')
    && boards.includes("const DYNAMICS_AXES")
    && boards.includes("deriveCompanyRelationshipEdges")
    && boards.includes('article?.provenance?.status === "source-backed"')
    && boards.includes("relationEdges={dynamicEdges}")
    && boards.includes("SOURCE-BACKED · DAILY")
    && !boards.includes("const COMPETE_EDGES")
    && boards.includes("onNodeSelect={setActiveCompany}")
    && app.includes("onSelectCompany={setSelected}")
    && boards.includes('aria-label={`${selectedCompany.name} 상세 개요 열기`}')
    && boards.includes('className="dyn-company-facts"')
    && boards.includes('className="dyn-proof-strip"')
    && boards.includes('className="dyn-related-row"')
    && boards.includes("openCompany(item.company)")
    && boards.includes("relationshipGroups.length > 0")
    && !boards.includes("false && relationshipGroups.length > 0")
    && boards.includes("video.playbackRate = 0.38")
    && boards.includes('className="dyn-video" muted loop playsInline preload="none"')
    && boards.includes("mediaReady && <source")
    && boards.includes("requestIdleCallback")
    && boards.includes('prefers-reduced-motion: reduce')
    && boards.includes("const fittedHeight = container.offsetHeight")
    && boards.includes("compact")
    && app.includes('loadJson("overview-view.json", { cache: "no-store" })')
    && app.includes("needsFullCompanyData")
    && !app.includes('active === "overview" || !!selected');
  const interactiveLayout = styles.includes(".es-dynamics-grid")
    && styles.includes(".dyn-video-panel")
    && styles.includes(".dyn-relationship")
    && styles.includes(".dyn-company-open")
    && styles.includes(".dyn-company-facts")
    && styles.includes(".dyn-proof-strip")
    && styles.includes(".dyn-related-row")
    && styles.includes(".dyn-detail-action")
    && styles.includes("grid-template-columns: minmax(460px, 1.25fr) minmax(340px, .85fr)")
    && styles.includes("brightness(.7)")
    && styles.includes("height: calc(100% - 10px)")
    && styles.includes("animation: dynVideoDrift 34s")
    && styles.includes(".first-video-screen .es-dynamics-map,");
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
  const readableSignals = boards.includes("function SignalBoard")
    && boards.includes("Mobile AI 기술 변화")
    && boards.includes("Experience · Agent · Model · Context · Developer Tool · Edge Runtime")
    && boards.includes('SignalInfographic file="infra-view.json"')
    && styles.includes(".isg-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));")
    && styles.includes(".isg-card:hover, .isg-card:focus-within {")
    && styles.includes(".isg-card:hover::after, .isg-card:focus-within::after { opacity: 0; }")
    && styles.includes("Non-inverting signal-card interaction contract")
    && styles.includes("@media (prefers-reduced-motion: reduce)")
    && !styles.includes(".isg-summary li { position: relative; min-width: 0; padding-left: 10px; font-size: 11px; font-weight: 600; line-height: 1.45; color: var(--muted); word-break: keep-all; display: -webkit-box;");
  if (!readableSignals) {
    throw new Error("mobile technology signals need a source-derived infographic and unclipped readable cards");
  }
  console.log("  OK  mobile technology signals include readable source-derived infographics");
} catch (error) {
  failed = true;
  console.error(`  FAIL  mobile technology signal readability: ${error.message}`);
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
    && app.includes("useInView(sectionRef, 120)")
    && app.includes("board-gate-placeholder")
    && styles.includes(".board-gate.is-pending");
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
    "매일 크롤된 기사에서 컴퓨트·광통신·전력·차세대 아키텍처 신호를 MECE 5축으로",
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
  const boards = await readFile("boards.jsx", "utf8");
  const removedOperationalLabels = [
    "(크롤)",
    "LIVE · 크롤",
    "최신 크롤 근거",
    "크롤 인사이트 종합",
    "매일 크롤한 원문 근거",
    "크롤로 계속 누적",
    "크롤 기사로 정리",
    "크롤링 기반 업데이트 구조",
  ];
  if (removedOperationalLabels.some(text => boards.includes(text))) {
    throw new Error("operational collection wording is still rendered");
  }
  console.log("  OK  user-facing collection labels replaced by source-evidence copy");
} catch (error) {
  failed = true;
  console.error(`  FAIL  user-facing collection wording cleanup: ${error.message}`);
}

try {
  const [market, boards, marketCrawler, marketRefresh] = await Promise.all([
    readFile("market.json", "utf8").then(JSON.parse),
    readFile("boards.jsx", "utf8"),
    readFile("scripts/crawl-markets.mjs", "utf8"),
    readFile("scripts/refresh-market-source-content.mjs", "utf8"),
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
        && (item.values || []).every(value => String(item.line).includes(value)))
      && Array.isArray(record.sourceMetricValues)
      && record.sourceMetricValues.length === record.sourceQuantities.length
      && record.sourceMetricValues.every(metric => metric?.label && metric?.value
        && metric?.sourceLine && normalize(metric.sourceLine).toLocaleLowerCase().includes(normalize(metric.value).toLocaleLowerCase())
        && !/원문 수치/.test(metric.label));
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
    && /sourceMetricValues/.test(boards)
    && !/원문 수치|원문 정량 근거/.test(boards)
    && /aiDashDeletedMarketRecords/.test(boards)
    && /rememberSuppression\(\{[\s\S]{0,180}scope: "market"/.test(boards)
    && /const boardRef = sectionRef \|\| localSectionRef/.test(boards)
    && /날짜가 다른 검증값은 모두 누적/.test(boards)
    && /className="mkt-record-section"/.test(boards)
    && /className="mkt-board-toggle"/.test(boards);
  const noForecastPlaceholder = /const hasForecast = numericValue\(it\.forecast\)/.test(boards)
    && /hasCurrent && hasForecast && <span className="mkt-arr" aria-hidden="true" \/>/.test(boards)
    && /hasForecast && <span className="mkt-num fut">/.test(boards);
  const separateCollectionTracks = /const EXPANSION_QUERIES = \[/.test(marketCrawler)
    && /track: "consumer-survey"/.test(marketCrawler)
    && /track: "ai-market"/.test(marketCrawler)
    && /querySetVersion: QUERY_SET_VERSION/.test(marketCrawler);
  const resilientDailyMarketCollection = /const rotatingQueries =/.test(marketCrawler)
    && /AbortSignal\.timeout\(MARKET_FETCH_TIMEOUT_MS\)/.test(marketCrawler)
    && /MARKET_FAILURE_LIMIT/.test(marketCrawler)
    && /MARKET_WALL_CLOCK_MS/.test(marketCrawler)
    && /stopReason = "wall-clock-budget"/.test(marketCrawler)
    && /status: "degraded-preserved"/.test(marketCrawler)
    && /preserved .*append-only records for the next retry/.test(marketCrawler)
    && !/throw new Error\("All global market-data sources failed/.test(marketCrawler);
  const suppressionPreservesLedger = /const records = Array\.isArray\(data\.records\) \? data\.records : \[\];/.test(marketRefresh)
    && /if \(suppression\.matches\(record, "market"\)\) return record;/.test(marketRefresh)
    && /userSuppressedPreserved: suppressedRecords\.length/.test(marketRefresh);
  const marketChecks = {
    appendOnly: market.database?.mode === "append-only",
    recordCount: records.length >= 3,
    uniqueIds: ids.size === records.length,
    linked: linked.length === records.length,
    userResearch: hasUserResearch,
    verticals: hasNewVerticals,
    sourceBoundCards,
    boardContract,
    forecastDisplay: noForecastPlaceholder,
    separateCollectionTracks,
    resilientDailyMarketCollection,
    suppressionPreservesLedger,
  };
  const failedMarketChecks = Object.entries(marketChecks).filter(([, value]) => !value).map(([key]) => key);
  if (failedMarketChecks.length) {
    throw new Error(`audit ledger requires publisher-page-backed records and retained source links: ${failedMarketChecks.join(", ")}`);
  }
  console.log(`  정상  market.json 비공개 감사 원장 ${records.length}건 · 공개 뷰 검증 이력 누적`);
} catch (error) {
  failed = true;
  console.error(`  실패  market.json 비공개 감사 원장: ${error.message}`);
}

try {
  const line = "The global AI note taking market size was calculated at USD 623.50 million in 2025 and is predicted to increase from USD 740.41 million in 2026 to approximately USD 3476.74 million by 2035, expanding at a CAGR of 18.75% from 2026 to 2035.";
  const values = ["USD 623.50 million", "USD 740.41 million", "USD 3476.74 million", "18.75%", "2025", "2026", "2035"];
  const metrics = sourceMetricValues([{ line, values }], values);
  const byValue = value => metrics.find(metric => metric.value === value)?.label || "";
  if (!/시장 규모.*2025/.test(byValue("USD 623.50 million"))
    || !/시장 규모.*2026/.test(byValue("USD 740.41 million"))
    || !/시장 규모.*2035/.test(byValue("USD 3476.74 million"))
    || !/연평균 성장률.*2026–2035/.test(byValue("18.75%"))
    || byValue("2025") !== "기준 연도"
    || byValue("2035") !== "전망 연도") {
    throw new Error(`source quantities lack contextual labels: ${JSON.stringify(metrics)}`);
  }
  console.log("  OK  정량 지표 의미·기준연도·전망연도 자동 명명");
} catch (error) {
  failed = true;
  console.error(`  FAIL  정량 지표 자동 명명: ${error.message}`);
}

try {
  const base = {
    id: "market:original",
    type: "market-observation",
    title: "Google's $205 Billion AI Bet Terrified Investors",
    titleEn: "Google's $205 Billion AI Bet Terrified Investors",
    sourceName: "Original Publisher",
    sourceUrl: "https://example.com/original",
    publishedAt: "2026-07-26",
    sourceMetricValues: [
      { label: "설비투자", value: "$205 billion", sourceLine: "Capital expenditure reached $205 billion" },
      { label: "수주잔고", value: "$514 billion", sourceLine: "Cloud backlog reached $514 billion" },
    ],
    sourceQuantities: ["$205 billion", "$514 billion"],
    sourceQuantifiedLines: [
      { line: "Capital expenditure reached $205 billion", values: ["$205 billion"] },
      { line: "Cloud backlog reached $514 billion", values: ["$514 billion"] },
    ],
    summaryLinesEn: ["Cloud revenue accelerated", "Capital expenditure expanded", "Backlog pre-sold future capacity"],
    localization: {
      status: "accepted",
      title: "Google AI 투자 확대",
      summaryLines: ["클라우드 매출 가속", "설비투자 확대", "수주잔고 기반 선판매"],
    },
  };
  const syndicated = {
    ...base,
    id: "market:syndicated",
    title: "Google’s $205 Billion AI Bet Terrified Investors - AOL",
    titleEn: "Google’s $205 Billion AI Bet Terrified Investors - AOL",
    sourceName: "AOL",
    sourceUrl: "https://aol.example.com/syndicated",
  };
  const distinct = {
    ...base,
    id: "market:distinct",
    title: "AI gaming market reaches $205 billion",
    titleEn: "AI gaming market reaches $205 billion",
    sourceName: "Research House",
    sourceUrl: "https://research.example.com/gaming",
    sourceMetricValues: [{ label: "시장 규모", value: "$205 billion", sourceLine: "AI gaming market reaches $205 billion" }],
    sourceQuantities: ["$205 billion"],
    sourceQuantifiedLines: [{ line: "AI gaming market reaches $205 billion", values: ["$205 billion"] }],
  };
  const consolidated = consolidateMarketRecords([base, syndicated, distinct]);
  const merged = consolidated.find(record => record.mergedRecordCount === 2);
  if (!sameMarketStory(base, syndicated) || sameMarketStory(base, distinct)
    || consolidated.length !== 2 || !merged
    || merged.relatedSources.length !== 2
    || merged.sourceMetricValues.length !== 2
    || merged.consolidatedInsights.length !== 3) {
    throw new Error("same-story sources were not consolidated into one MECE insight");
  }
  console.log("  OK  동일 기사·재배포 통합 · 수치·근거 중복 제거 · 3줄 인사이트");
} catch (error) {
  failed = true;
  console.error(`  FAIL  시장 인사이트 중복 통합: ${error.message}`);
}

try {
  const collectedAt = "2026-07-31T00:00:00.000Z";
  const existing = {
    id: "market:test-existing",
    type: "market-estimate",
    title: "AI app market reaches $10 billion",
    sourceUrl: "https://example.com/ai-market",
    publishedAt: "2026-07-30",
    values: [{ label: "시장 규모", value: "$10 billion" }],
  };
  const database = { records: [existing], items: [], groups: [] };
  const duplicateAcrossTrack = {
    ...existing,
    id: "survey:test-duplicate",
    type: "consumer-survey",
    collectionTrack: "consumer-survey",
  };
  const freshSurvey = {
    id: "survey:test-new",
    type: "consumer-survey",
    collectionTrack: "consumer-survey",
    title: "Survey of 1,000 consumers on AI phone adoption",
    sourceUrl: "https://example.com/ai-phone-survey",
    publishedAt: "2026-07-31",
    evidence: "Survey respondents included 1,000 consumers",
    values: [{ label: "응답자", value: "1,000 consumers" }],
  };
  const pendingSurveyWithoutHeadlineNumber = {
    id: "survey:test-pending-no-number",
    type: "consumer-survey",
    collectionTrack: "consumer-survey",
    title: "Consumer survey on AI assistant trust",
    sourceUrl: "https://example.com/ai-assistant-trust-survey",
    publishedAt: "2026-07-31",
    evidence: "Survey of consumers on trust and privacy",
    values: [],
    provenance: { status: "pending-source-page" },
  };
  const added = appendRecords(database, [duplicateAcrossTrack, freshSurvey, pendingSurveyWithoutHeadlineNumber], collectedAt);
  const beforeMigration = database.records.length;
  ensureMarketDatabase(database, collectedAt);
  if (added !== 2 || beforeMigration !== 3 || !database.records.some(record => record.id === existing.id)
    || !database.records.some(record => record.id === freshSurvey.id)
    || !database.records.some(record => record.id === pendingSurveyWithoutHeadlineNumber.id)
    || database.database?.mode !== "append-only"
    || database.database?.recordSchemaVersion !== 3
    || !hasConsumerSurveyEvidence(freshSurvey)
    || hasConsumerSurveyEvidence({ title: "Enterprise AI adoption survey", evidence: "Survey of 500 organizations" })) {
    throw new Error("market append-only merge or consumer-survey classification is not stable");
  }
  console.log("  OK  소비자 조사·AI 시장 별도 분류 · 중복 방지 · 기존 레코드 보존");
} catch (error) {
  failed = true;
  console.error(`  FAIL  market append-only collection contract: ${error.message}`);
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
  const mobileBriefs = (research.feed || []).filter(brief =>
    /(?:smartphone|mobile|phone|consumer|assistant|agent|wearable|camera|voice)/i.test(JSON.stringify(brief)));
  if (!mobileBriefs.length
    || pinned.some(brief => !Array.isArray(brief.summaryLines) || brief.summaryLines.length !== 3 || !brief.sourceLine || !brief.sourcePages?.length)) {
    throw new Error("research briefs must remain source-backed and mobile-AI-relevant");
  }
  console.log(`  정상  모바일 AI 리서치 ${mobileBriefs.length}건 · 사용자 제공 브리프 ${pinned.length}건`);
} catch (error) {
  failed = true;
  console.error(`  실패  모바일 AI 리서치: ${error.message}`);
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
  const expectedTerms = matches("OpenAI와 AI 서비스");
  const termRule = stylesSource.match(/\.term-hl\s*\{[\s\S]*?\n\}/)?.[0] || "";
  if (falsePositive || !expectedTerms.includes("OpenAI") || !expectedTerms.includes("AI 서비스")
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
  const [appSource, boardsSource, animSource, workflowSource, version, overview, publicNews, publicResearch, publicMarket] = await Promise.all([
    readFile("app.jsx", "utf8"), readFile("boards.jsx", "utf8"), readFile("anim.jsx", "utf8"),
    readFile(".github/workflows/daily-news.yml", "utf8"), readFile("data-version.json", "utf8").then(JSON.parse),
    readFile("overview-view.json", "utf8").then(JSON.parse),
    readFile("news-view.json", "utf8").then(JSON.parse), readFile("research-view.json", "utf8").then(JSON.parse),
    readFile("market-view.json", "utf8").then(JSON.parse),
  ]);
  const safe = list => list.every(item => item.displayEligible !== false && item.provenance?.status === "source-backed");
  const marketRecords = publicMarket.records || [];
  const remainingMarketDuplicates = marketRecords.some((record, index) =>
    marketRecords.slice(index + 1).some(other => sameMarketStory(record, other)));
  const mergedMarketRecordsValid = marketRecords.every(record =>
    Number(record.mergedRecordCount || 1) >= 1
    && Number(record.duplicateRecordCount || 0) === Number(record.mergedRecordCount || 1) - 1
    && Array.isArray(record.relatedSources) && record.relatedSources.length >= 1
    && Array.isArray(record.consolidatedInsights) && record.consolidatedInsights.length >= 1
    && record.consolidatedInsights.length <= 3);
  const latestPerTopic = new Map();
  marketRecords.forEach(record => {
    if (record.isLatestForTopic) latestPerTopic.set(record.stableKey, Number(latestPerTopic.get(record.stableKey) || 0) + 1);
  });
  const cumulativeMarketValid = marketRecords.every(record => record.stableKey && typeof record.isLatestForTopic === "boolean")
    && [...latestPerTopic.values()].every(count => count === 1)
    && latestPerTopic.size === Number(publicMarket.latestTopicCount || 0)
    && Number(publicMarket.historicalRecordCount || 0) === marketRecords.length - latestPerTopic.size;
  if (!version.version || !/data-version\.json/.test(appSource)
    || !/overview-view\.json/.test(appSource) || !/news-view\.json/.test(appSource) || !/research-view\.json/.test(appSource)
    || !/market-view\.json/.test(boardsSource) || /Math\.floor\(Date\.now\s*\/\s*60000\)/.test(`${appSource}\n${boardsSource}`)
    || /setInterval\(_queueScan,\s*600\)/.test(animSource)
    || !/build-public-data\.mjs/.test(workflowSource)
    || overview.sourceMode !== "generated-source-backed" || overview.companyCount !== Object.keys(overview.companies || {}).length
    || !safe(overview.articles || []) || !safe(publicNews.articles || []) || !safe(publicResearch.feed || []) || !safe(marketRecords)
    || !(version.assets || []).includes("overview-view.json")
    || remainingMarketDuplicates || !mergedMarketRecordsValid
    || publicMarket.database?.mode !== "append-only-verified-view"
    || publicMarket.database?.publicRetention !== "all-verified-history"
    || !cumulativeMarketValid
    || !Array.isArray(publicMarket.items)
    || Number(publicMarket.sourceRecordCount || 0) - marketRecords.length
      !== Number(publicMarket.consolidatedDuplicateCount || 0)) {
    throw new Error("public views must be versioned, source-backed, and free of minute cache busting");
  }
  console.log(`  OK  versioned source-only public views ${publicNews.count}/${publicResearch.count}/${marketRecords.length} · 시장 중복 ${publicMarket.consolidatedDuplicateCount || 0}건 통합`);
} catch (error) {
  failed = true;
  console.error(`  FAIL  source-only public views: ${error.message}`);
}

try {
  const [database, boardsSource, componentsSource, workflowSource, recoverySource, builderSource, verifySource, version, metricGovernance, volatileMetrics, metricAudit, weeklyMetricWorkflow, officialSources, qualityThresholds, monetization, monetizationReviewQueue, sourceCollector, sourceReport, sourceSnapshot, sourceManifest, jekyllConfig] = await Promise.all([
    readFile("mobile-ai-business-view.json", "utf8").then(JSON.parse),
    readFile("boards.jsx", "utf8"),
    readFile("components.jsx", "utf8"),
    readFile(".github/workflows/daily-news.yml", "utf8"),
    readFile(".github/workflows/daily-news-update.yml", "utf8"),
    readFile("scripts/build-mobile-ai-business-db.mjs", "utf8"),
    readFile("scripts/verify-pipeline.mjs", "utf8"),
    readFile("data-version.json", "utf8").then(JSON.parse),
    readFile("config/metric-governance.json", "utf8").then(JSON.parse),
    readFile("config/volatile-metrics.json", "utf8").then(JSON.parse),
    readFile("volatile-metrics-audit.json", "utf8").then(JSON.parse),
    readFile(".github/workflows/weekly-metric-reverification.yml", "utf8"),
    readFile("config/official-source-registry.json", "utf8").then(JSON.parse),
    readFile("config/quality-thresholds.json", "utf8").then(JSON.parse),
    readFile("monetization.json", "utf8").then(JSON.parse),
    readFile("monetization-review-queue.json", "utf8").then(JSON.parse),
    readFile("scripts/collect-source-registry.mjs", "utf8"),
    readFile("source-collection-report.json", "utf8").then(JSON.parse),
    readFile("source-snapshot.json", "utf8").then(JSON.parse),
    readFile("source-ledger/manifest.json", "utf8").then(JSON.parse),
    readFile("_config.yml", "utf8"),
  ]);
  const ids = (database.signals || []).map(item => item.id);
  const validSignals = (database.signals || []).every(item => item.fact && item.implication && item.decision
    && item.actionOption && item.ownerOrg && item.mxMapping?.galaxyDifferentiation
    && item.mxMapping?.bomImpact && item.mxMapping?.partnershipHistory
    && item.mxMapping?.patentLitigationRisk && item.mxMapping?.svicPortfolio
    && item.validation?.evidenceSpanCount >= 3 && item.validation?.status === "passed");
  const requiredNewBusinessIds = [
    "trusted-ai-control-center",
    "ai-credit-subscription-hub",
    "verified-answer-provenance",
    "agentic-purchase-guardrails",
  ];
  const opportunityIds = new Set((database.generatedOpportunities || []).map(item => item.id));
  const opportunitiesReady = (database.generatedOpportunities || []).length >= Number(qualityThresholds.minimumGeneratedOpportunities || 10)
    && (database.generatedOpportunities || []).length <= Number(qualityThresholds.maximumGeneratedOpportunities || 25)
    && requiredNewBusinessIds.every(id => opportunityIds.has(id))
    && (database.experimentShortlist || []).length <= 3
    && (database.assetOpportunityMatrix || []).length >= 8
    && (database.generatedOpportunities || []).every(item => Number.isFinite(item.signalScore)
      && Number.isFinite(item.opportunityScore) && Number.isFinite(item.ownAssetFit)
      && item.rubricVersion && item.scoredAt && item.scoredBy?.id
      && item.claimIds?.length && item.evidenceIds?.length && item.scorecard?.length === 8
      && item.scorecard.every(row => row.evidenceIds?.length)
      && item.experimentPlan?.nextDecisionAt
      && (item.status !== "published" || (item.evidenceCount >= 2 && item.independentSources >= 2)));
  const monetizationGateReady = monetization.schemaVersion >= 3
    && (monetization.companies || []).flatMap(company => company.monetize || []).every(row => row.classificationGate?.status === "passed")
    && (monetizationReviewQueue.rows || []).length === monetizationReviewQueue.total;
  if (database.schemaVersion < 9
    || database.database?.mode !== "mx-decision-intelligence"
    || database.database?.publicRetention !== "active-plus-master-data"
    || ids.length !== new Set(ids).size
    || !validSignals || (database.deviceMatrix || []).length < 7 || (database.regulations || []).length < 4
    || (database.taxonomyAxes?.axes || []).length < 16 || !(database.claims || []).length
    || !(database.evidenceSpans || []).length || database.claimSummary?.citationCompleteness !== 1
    || database.publicationControl?.publishedInvariantSatisfied !== true
    || (database.sidebarCategories || []).length !== 3 || (database.monetizationModels || []).length !== 7
    || (database.osAgentStack || []).length < 7 || (database.partnershipNetwork?.edges || []).length < 8
    || (database.formFactors || []).length < 7 || database.consumerPainPointTrack?.status !== "connector-required"
    || (database.marketSignals || []).length < 4 || (database.metricHistory || []).length < 2
    || (database.opportunityPartnerLinks || []).length < 10 || !opportunitiesReady || !monetizationGateReady
    || database.opportunityPartnerLinks.filter(item => item.partnerMatches?.length).length < 4
    || (database.securityBusinessCases?.offers || []).length < 3
    || (database.healthMonetizationLadder || []).length !== 3
    || (database.companionEconomics?.headlineMetrics || []).length < 5
    || database.comparisonAudit?.invalid !== 0 || database.comparisonAudit?.blocked < 2
    || database.dataQualityTargets?.directMarketEvidence?.targetRate !== Number(qualityThresholds.directMarketEvidenceRate || 0.9)
    || database.selfBenchmarkPolicy?.enabled !== true
    || database.marketReverificationQueue?.targetDirectEvidenceRate !== Number(qualityThresholds.directMarketEvidenceRate || 0.9)
    || database.priceChangeFlags?.summary?.pendingVerification === undefined
    || metricGovernance.requiredTemporalFields?.length !== 4
    || (volatileMetrics.metrics || []).length < 5 || metricAudit.summary?.invalid !== 0
    || !weeklyMetricWorkflow.includes("reverify-volatile-metrics.mjs --fetch --write")
    || !weeklyMetricWorkflow.includes("No auto-merge")
    || Number(officialSources.version || 0) < 4
    || (officialSources.sitemaps || []).length < 15
    || (officialSources.officialFeeds || []).length < 12
    || !(officialSources.htmlIndexes || []).some(source => source.source === "MiniMax News" && source.status === "active")
    || (officialSources.apiConnectors || []).length < 9
    || !["xiaomi-global-discovery", "coinbase-agentkit-releases", "sec-edgar-company-submissions", "uspto-open-data", "sensor-tower-store-intelligence", "appfigures-app-intelligence"]
      .every(id => (officialSources.apiConnectors || []).some(connector => connector.id === id))
    || (sourceReport.streamHealth || []).length < Number(qualityThresholds.minimumDirectSourceStreams || 25)
    || (sourceReport.connectorStatus || []).filter(row => row.status === "executed").length < Number(qualityThresholds.minimumExecutablePublicConnectors || 4)
    || (sourceReport.categoryCoverage || []).filter(row => Number(row.itemCount || 0) > 0).length < Number(qualityThresholds.minimumSourceCategories || 8)
    || sourceSnapshot.itemCount !== (sourceSnapshot.items || []).length
    || sourceManifest.cumulativeEvents < sourceSnapshot.itemCount
    || !sourceCollector.includes("append-only-monthly-jsonl")
    || !sourceCollector.includes("collectWithFallbacks")
    || !sourceCollector.includes("credential-gated")
    || !sourceCollector.includes("headersFromEnv")
    || !workflowSource.includes("scripts/collect-source-registry.mjs")
    || !workflowSource.includes("automation/data-staging")
    || !workflowSource.includes("source-ledger/")
    || !workflowSource.includes("USPTO_API_KEY")
    || !workflowSource.includes("SENSOR_TOWER_TOKEN")
    || !workflowSource.includes("APPFIGURES_ACCESS_TOKEN")
    || !recoverySource.includes("scripts/collect-source-registry.mjs")
    || !recoverySource.includes("SEC_USER_AGENT")
    || (version.assets || []).some(file => /source-(snapshot|collection-report)|source-ledger/.test(file))
    || !["source-snapshot.json", "source-collection-report.json", "source-ledger"].every(file => jekyllConfig.includes(`- ${file}`))
    || qualityThresholds.maximumFailedStreamsBeforeBlock !== 3
    || !verifySource.includes("persistentFailureStreams > failedStreamBlockThreshold")
    || !verifySource.includes("[verify:${check.status}]")
    || !database.snapshotVersion || !database.summary?.sourceUrls
    || boardsSource.includes("MobileAIBusinessBoard")
    || boardsSource.includes("AI 신사업 Command Center")
    || boardsSource.includes('className="mxc')
    || !componentsSource.includes('id: "opportunity"')
    || !componentsSource.includes("neutralizeDisplayText")
    || !workflowSource.includes("scripts/build-mobile-ai-business-db.mjs")
    || !recoverySource.includes("scripts/build-mobile-ai-business-db.mjs")
    || !builderSource.includes("validateSignal")
    || !builderSource.includes("embeddingVector")
    || !builderSource.includes("generateOpportunities")
    || !builderSource.includes("sanitizePublicCopy")
    || !(version.assets || []).includes("mobile-ai-business-view.json")
    || !(version.assets || []).includes("metric-history.json")
    || !(version.assets || []).includes("market-reverification-queue.json")
    || !(version.assets || []).includes("price-change-flags.json")
    || !(version.assets || []).includes("monetization-review-queue.json")) {
    throw new Error("MX decision database must publish validated device, carrier, partner and compliance records");
  }
  console.log(`  OK  모바일 의사결정 DB ${database.signals.length}개 신호 · ${database.generatedOpportunities.length}개 기회 후보 · ${database.summary.sourceUrls}개 원문`);
} catch (error) {
  failed = true;
  console.error(`  FAIL  mobile AI business database: ${error.message}`);
}

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  failed = true;
  console.error(`  실패  Node.js ${process.version} (20 이상 필요)`);
} else {
  console.log(`  정상  Node.js ${process.version}`);
}

console.log("  정보  기사 사실: 원문 발췌 · 기업 전략: GitHub Models 근거 제한 종합");
console.log("  정보  기본 파이프라인: 매일 06:30 · 12:30 · 18:30 · 00:30 KST");
console.log("  정보  보조 업데이트: 수동 복구 전용(동시 쓰기 방지)");

const pipelineScripts = [
  "scripts/crawl-news.mjs", "scripts/crawl-stocks.mjs", "scripts/crawl-research.mjs",
  "scripts/crawl-startups.mjs", "scripts/crawl-startup-organizations.mjs", "scripts/crawl-markets.mjs", "scripts/crawl-infra.mjs",
  "scripts/crawl-bizmodel.mjs", "scripts/generate-briefing.mjs", "scripts/startup-radar.mjs",
  "scripts/build-insights.mjs", "scripts/crawl-companies.mjs", "scripts/crawl-monetization.mjs",
  "scripts/crawl-a16z-startups.mjs", "scripts/crawl-strategic-ventures.mjs",
  "scripts/build-company-intelligence.mjs",
  "scripts/build-mobile-ai-business-db.mjs",
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
  const [boards, taxonomy, charts, crawler, styles, investmentData, investmentBuilder, appSource, workflowSource] = await Promise.all([
    readFile("boards.jsx", "utf8"),
    readFile("config/dashboard-taxonomy.json", "utf8").then(JSON.parse),
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
    "china-foundry",
    "china-equipment",
    "china-packaging",
    "china-design",
    "china-materials",
  ];
  // 주가 보드는 모바일 AI 신사업과 직접 연결되는 54개 상장사를 공통 7계층으로 재분류한다.
  const completeBoard = boards.includes("function StockRegionPanel")
    && boards.includes("function NvidiaInvestmentMap")
    && boards.includes("전체 상장사 밸류체인 분석")
    && boards.includes("window.DASH.STOCK_LAYER")
    && boards.includes("window.DASH.STOCK_GROUP_LAYER")
    && !boards.includes(".filter(s => STOCK_LAYER[s.ticker])")
    && boards.includes("밸류체인 그룹 트렌드")
    && boards.includes("개별 종목");
  const taxonomyText = JSON.stringify(taxonomy);
  const completeMetadata = !taxonomyText.includes('000660.KS')
    && !taxonomyText.includes('688825.SS')
    && !(taxonomy.STOCKS || []).some(stock => ["memory", "china-memory"].includes(stock.group))
    && chinaGroups.every(group => (taxonomy.STOCK_GROUPS || []).some(item => item.id === group))
    && dash.STOCKS.length === 54
    && dash.STOCK_VALUE_CHAIN.length === 7
    && dash.STOCKS.every(stock => dash.STOCK_VALUE_CHAIN.some(layer =>
      layer.id === (dash.STOCK_LAYER[stock.ticker] || dash.STOCK_GROUP_LAYER[stock.group])))
    && dash.STOCK_VALUE_CHAIN.every(layer => dash.STOCKS.some(stock =>
      layer.id === (dash.STOCK_LAYER[stock.ticker] || dash.STOCK_GROUP_LAYER[stock.group])));
  const sourceBackedInvestments = investmentData.portfolio?.length >= 8
    && new Set(investmentData.portfolio.map(item => item.name)).size === investmentData.portfolio.length
    && investmentData.portfolio.every(item => item.why && item.strategicFit
      && /^https?:\/\//.test(item.source?.url || "") && item.source?.date && item.layer);
  const dynamicInvestmentPipeline = investmentBuilder.includes('readFile("news.json"')
    && investmentBuilder.includes('summaryMode === "source-content-extractive"')
    && investmentBuilder.includes('provenance?.status === "source-backed"')
    && workflowSource.includes("scripts/build-nvidia-investments.mjs")
    && appSource.includes('dataUrl("nvidia-investments.json")');
  const liveHistory = crawler.includes('const YEARS = 5')
    && crawler.includes("indicators?.adjclose")
    && crawler.includes("function normalizePoints")
    && crawler.includes("fromYahooSpark")
    && crawler.includes('c.market === "TSE"')
    && crawler.includes('"yahoo-spark"')
    && crawler.includes("retryTargets")
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
  const compactInteractiveInvestmentMap = boards.includes("onPointerEnter={() => setSelectedId(node.id)}")
    && boards.includes("onKeyDown={event =>")
    && boards.includes('data-nvi-id={node.id}')
    && boards.includes('aria-live="polite"')
    && styles.includes("width: 66px")
    && styles.includes("min-height: 356px")
    && styles.includes("@keyframes nvi-edge-flow")
    && styles.includes("@keyframes nvi-detail-in")
    && styles.includes(".nvi-stage:hover .nvi-node:not(:hover):not(.is-selected)");
  const stockComparisonCopyRemoved = !boards.includes("<p>{description}</p>")
    && !boards.includes('description="63개 상장사를')
    && !boards.includes("대시보드 기업 리스트에 있는 상장사를 인프라·컴퓨트 / 파운데이션 모델 / 애플리케이션 등 밸류체인 계층으로 묶어 실제 일별 시세로 비교");
  const initialSevenCategoryView = taxonomy.STOCK_VALUE_CHAIN?.length === 7
    && boards.includes("window.DASH.STOCK_VALUE_CHAIN")
    && boards.includes('aria-label="상장사 밸류체인 카테고리"')
    && boards.includes("groups={visibleGroups} stocks={visibleStocks}");
  if (!completeBoard || !completeMetadata || !sourceBackedInvestments || !dynamicInvestmentPipeline
    || !liveHistory || !currencyAware || !responsiveUi || !compactInteractiveInvestmentMap || !stockComparisonCopyRemoved || !initialSevenCategoryView) {
    throw new Error("all-company stock board, NVIDIA source pipeline, five-year adjusted-close history, currencies, or responsive UI are incomplete");
  }
  console.log("  OK  모바일 AI 신사업 관련 54개 상장사 Stock 분석 + NVIDIA 소형 인터랙티브 원문근거 투자맵 + 5년 실데이터·변곡점 자동 설명");
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
    && components.includes("nominalizeStatementEnding")
    && boards.includes("return consultingBulletText(value)");
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

try {
  const registry = createSuppressionRegistry({
    schemaVersion: 2,
    ids: ["signal-42"],
    urls: ["https://example.com/story?utm_source=feed"],
    companies: ["Deleted Startup"],
    records: [
      { scope: "insight-axis", key: "수익 모델" },
      { scope: "article", key: "story-1", name: "NVIDIA" },
    ],
  });
  if (!registry.hasId("SIGNAL-42")
    || !registry.hasUrl("https://example.com/story?utm_campaign=daily")
    || !registry.hasCompany("deleted startup")
    || registry.hasCompany("NVIDIA")
    || !registry.hasCompanyMention("Deleted Startup launches a product")
    || !registry.hasKey("insight-axis", "수익 모델")
    || !registry.matches({ relatedSources: [{ sourceUrl: "https://example.com/story?utm_medium=syndication" }] }, "market")
    || canonicalSuppressionUrl("https://example.com/story?utm_source=x") !== "https://example.com/story") {
    throw new Error("suppression registry identity matching is incomplete");
  }

  const [boards, publicBuilder, ...crawlerSources] = await Promise.all([
    readFile("boards.jsx", "utf8"),
    readFile("scripts/build-public-data.mjs", "utf8"),
    ...[
      "scripts/crawl-news.mjs",
      "scripts/crawl-research.mjs",
      "scripts/crawl-startups.mjs",
      "scripts/crawl-startup-organizations.mjs",
      "scripts/crawl-companies.mjs",
      "scripts/crawl-infra.mjs",
      "scripts/crawl-bizmodel.mjs",
      "scripts/crawl-monetization.mjs",
      "scripts/refresh-source-content.mjs",
      "scripts/refresh-market-source-content.mjs",
    ].map(file => readFile(file, "utf8")),
  ]);
  const scopes = ["article", "startup", "infra-signal", "bizmodel-signal", "research", "insight-axis"];
  const browserGate = boards.includes("aiDashSuppressionRegistryV2")
    && boards.includes("rememberSuppression")
    && scopes.every(scope => boards.includes(`scope: "${scope}"`) || boards.includes(`"${scope}"`))
    && !boards.includes("const resetAll = () => { setDel({})")
    && !boards.includes("const reset = () => { setDel({})");
  const pipelineGate = publicBuilder.includes("loadSuppressionRegistry")
    && crawlerSources.every(source => source.includes("loadSuppressionRegistry"));
  if (!browserGate || !pipelineGate) {
    throw new Error("X deletion is not connected to every browser and crawler publication gate");
  }
  console.log("  OK  X 삭제 영구 제외 레지스트리 · 크롤러 재유입 차단 · MX 공급망 신호 허용");
} catch (error) {
  failed = true;
  console.error(`  FAIL  suppression registry: ${error.message}`);
}

try {
  const stockReasonSources = await Promise.all([
    "config/dashboard-taxonomy.json",
    "stock-events.json",
    "scripts/crawl-stock-events.mjs",
  ].map(file => readFile(file, "utf8")));
  if (stockReasonSources.some(source => /왜 (?:올랐나|빠졌나)\s*:/.test(source))) {
    throw new Error("stock event reason labels remain in source data or the crawler");
  }
  console.log("  OK  stock event reason labels removed");
} catch (error) {
  failed = true;
  console.error(`  FAIL  stock event reason copy: ${error.message}`);
}

try {
  const { newsPolicy } = await import("./news-policy.mjs");
  const terms = [...(newsPolicy.excludedTerms || []), "\uD734\uB300\uD3F0"];
  if (!terms.length) throw new Error("config/news-policy.json has no excludedTerms configured");
  const escape = term => String(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patternFor = term => {
    const escaped = escape(term);
    return /^[A-Za-z0-9]+$/.test(String(term)) ? `\\b${escaped}\\b` : escaped;
  };
  // Parse JSON first and scan real string values. Scanning serialized JSON can
  // turn a newline escape followed by "And" into "nAnd", a false NAND hit.
  const dataRes = terms.map(term => new RegExp(patternFor(term), "i"));
  // Source files: same, except "MX" is matched case-sensitively (no "i") in
  // a separate pass. Lowercase "mx"/"my" is an extremely common mouse-x/
  // mouse-y coordinate variable name in this codebase's canvas/graph code —
  // a real identifier, never literal user-facing text — so a case-
  // insensitive scan there is pure noise, not a genuine leak (identifiers
  // never render as text).
  const otherTerms = terms.filter(t => t !== "MX");
  const sourceRes = [
    ...(otherTerms.length ? [new RegExp(otherTerms.map(patternFor).join("|"), "gi")] : []),
    ...(terms.includes("MX") ? [new RegExp("\\bMX\\b", "g")] : []),
  ];
  // Only the JSON the browser actually fetches (dataUrl(...)/fetch(...) call
  // sites in app.jsx/boards.jsx), plus the JS/JSX the browser ships. Raw
  // append-only ledgers (market.json, news.json, research.json, ...) are
  // intentionally excluded: per config/news-policy.json's own documented
  // design, the exclusion rule applies at collection time going forward and
  // existing raw-ledger history is retained, never re-scrubbed — those
  // records never reach a "-view.json" or a directly-fetched file, which are
  // the only surfaces a user can actually see.
  const jsonFiles = [
    "audit.json", "collection-health.json", "companies.json", "company-news.json", "insights.json", "overview-view.json",
    "llm-health.json", "monetization.json", "monetization-review-queue.json", "mobile-ai-business-view.json", "news-view.json", "nvidia-investments.json", "quality.json",
    "research-view.json", "startups.json", "stocks.json", "business-model-forecasts.json",
    "market-view.json", "stock-events.json",
  ];
  // Static replacement patterns intentionally contain the blocked tokens;
  // browser-visible JSON and a rendered-DOM test cover the actual surface.
  const sourceFiles = ["app.jsx", "charts.jsx", "anim.jsx", "tweaks-panel.jsx"];
  const hits = [];
  // A URL (base64-encoded Google News redirect links especially) is not
  // display text a user reads — it is a link target — and a long opaque
  // base64 run has a real chance of containing any given short substring
  // purely by coincidence. Blank URLs out before matching so only text a
  // user could actually see (titles, summaries, labels, ...) is scanned.
  const stripUrls = text => text.replace(/https?:\/\/[^\s"'<>]+/g, "");
  const scan = async (file, re, transform = t => t) => {
    let text;
    try { text = transform(await readFile(file, "utf8")); } catch { return; }
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(text)) && hits.length < 20) {
      hits.push(`${file}: "${text.slice(Math.max(0, match.index - 40), match.index + match[0].length + 40).replace(/\s+/g, " ")}"`);
    }
  };
  const scanJsonValue = (file, value, path = "$") => {
    if (hits.length >= 20) return;
    if (typeof value === "string") {
      // Collection diagnostics retain the exact configured stream identifier.
      // Samsung self-benchmark sources are intentionally allowed only in the
      // scoped MX surface and in non-editorial collector metadata; they must
      // not make generic feed copy eligible for display.
      const collectorMetadata = ["collection-health.json", "quality.json"].includes(file)
        && /\.streamHealth\[\d+\]\.stream$/.test(path);
      if (collectorMetadata) return;
      const visible = stripUrls(value);
      const matched = dataRes.find(re => re.test(visible));
      if (matched) hits.push(`${file}:${path}: "${visible.slice(0, 120).replace(/\s+/g, " ")}"`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => scanJsonValue(file, item, `${path}[${index}]`));
      return;
    }
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, item]) => {
        const machineKey = new Set(["id", "signalId", "eventClusterId", "stableKey", "mode", "from", "to", "with", "url", "sourceUrl", "evidenceUrl", "corroboratingUrl", "verificationUrl", "resolvedUrl"]).has(key);
        if (machineKey) return;
        if (dataRes.some(re => re.test(key))) hits.push(`${file}:${path}.${key}: banned key`);
        else scanJsonValue(file, item, `${path}.${key}`);
      });
    }
  };
  for (const file of jsonFiles) {
    if (hits.length >= 20) break;
    try { scanJsonValue(file, JSON.parse(await readFile(file, "utf8"))); } catch {}
  }
  for (const file of sourceFiles) {
    for (const re of sourceRes) {
      if (hits.length >= 20) break;
      await scan(file, re);
    }
  }
  if (hits.length) throw new Error(`banned term(s) found —\n    ${hits.join("\n    ")}`);
  console.log(`  OK  금지어(${terms.join("/")}) 전 공개 데이터·소스 스캔 — 검출 없음`);
} catch (error) {
  failed = true;
  console.error(`  FAIL  banned-term sweep: ${error.message}`);
}

if (failed) process.exit(1);
console.log("자동화 구성 정상");
