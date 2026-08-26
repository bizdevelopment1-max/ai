#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { minifyCss } from "./build-browser-bundle.mjs";

const [styles, styleBundle, app, boards, taxonomy, strategy, overview] = await Promise.all([
  readFile("styles.css", "utf8"),
  readFile("styles.bundle.css", "utf8"),
  readFile("app.jsx", "utf8"),
  readFile("boards.jsx", "utf8"),
  readFile("config/dashboard-taxonomy.json", "utf8").then(JSON.parse),
  readFile("strategy-view.json", "utf8").then(JSON.parse),
  readFile("overview-view.json", "utf8").then(JSON.parse),
]);

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const minifiedDescendantFixture = minifyCss(".card:hover :is(span, em) { color: var(--ink); }");

assert(minifiedDescendantFixture.includes(".card:hover :is(span,em)"), "CSS minification removed a descendant combinator before :is()");
assert(!minifiedDescendantFixture.includes(".card:hover:is(span,em)"), "CSS minification merged child and parent hover selectors");
assert(styleBundle.includes(":focus-within) :is(h2,h3,h4,b,strong,a)"), "production CSS is missing readable descendant headings in interactive cards");
assert(styleBundle.includes(":focus-within) :is(p,span,em,small,dt,dd,li,time)"), "production CSS is missing readable descendant body text in interactive cards");

assert(styles.includes("Readability contract · safe in light/dark and hover/focus modes"), "readability contract is missing");
assert(styles.includes("TYPOGRAPHY + CONSULTING VISUAL CONTRACT V2"), "typography and consulting visual contract is missing");
assert(styles.includes("TYPOGRAPHY + CONTRAST CONTRACT V3"), "competitive-panel contrast contract is missing");
assert(styles.includes("--text-xs: 11.5px") && styles.includes("--text-body: 14px"), "readable type scale is missing");
assert(styles.includes("--mono: var(--f)") && styles.includes("--f-code:"), "semantic font policy is missing");
assert(styles.includes("--muted: #98A7BA") && styles.includes("--ink-2: #C3CDDB"), "dark-mode secondary text contrast is too low");
assert(styles.includes(".msf-layer-evidence em, .msf-layer-evidence b") && styles.includes("font-size: var(--text-xs) !important"), "strategy evidence labels do not have a readable floor");
assert(styles.includes(".main svg text") && styles.includes("font-size: 10.5px !important"), "diagram label readability guard is missing");
assert(styles.includes("central decision marker replace one-sided card accents") && styles.includes("inset 0 -2px var(--consult-teal)"), "balanced consulting frame is missing");
assert(styles.includes(".sp-card::before { display: none !important; }"), "value-chain cards still use a one-sided accent stripe");
assert(styles.includes(".sp-card-foot { grid-template-columns: repeat(auto-fit, minmax(72px, 1fr)); align-items: start; }")
  && styles.includes("grid-column: 1 / -1;")
  && styles.includes("white-space: nowrap;\n  overflow-wrap: normal;\n  word-break: keep-all;"), "value-chain card detail action can collapse into a vertical text column");
assert(styles.includes('[data-theme="dark"] .msf-layer { color: var(--ink); }'), "dark strategy layers can inherit the browser button foreground");
assert(!styles.includes(".msf-opportunity-metrics")
  && styles.includes(".msf-opportunity dt em")
  && boards.includes("<em>01</em>시점"), "opportunity cards must use concise indexed labels without the retired KPI footer");
assert(styles.lastIndexOf("Final interaction contract: never invert an information card") > styles.lastIndexOf("color: #FFFFFF;\n    background:"), "non-inverting hover contract is not the final cascade policy");
assert(!/\.art:hover[\s\S]{0,500}-webkit-text-fill-color:\s*transparent/.test(styles), "article hover can make text transparent");
assert(!/\.rainbow-link:hover[\s\S]{0,400}color:\s*transparent/.test(styles), "link hover can make text transparent");
assert(styles.includes("-webkit-text-fill-color: currentColor"), "solid text-fill fallback is missing");
assert(styles.includes("text-wrap: pretty") && styles.includes("overflow-wrap: anywhere") && styles.includes("word-break: keep-all"), "multiline readability guards are incomplete");
assert(styles.includes(':focus-visible {') && styles.includes("outline: 3px solid"), "keyboard focus contrast is missing");
assert(styles.includes("background: color-mix(in srgb, var(--hover-tone") && styles.includes("var(--panel)) !important"), "theme-aware hover surface is missing");
assert(styles.includes("Non-inverting signal-card interaction contract"), "signal-card hover contract is missing");
assert(styles.includes(".isg-card:hover::after, .isg-card:focus-within::after { opacity: 0; }"), "signal-card dark hover overlay is still enabled");
assert(!/\.isg-card:hover::after\s*\{\s*opacity:\s*1/.test(styles), "signal-card hover restores a dark pseudo-element overlay");
assert(!/\.art-sel\s*\{[^}]*background:\s*linear-gradient\([^}]*#000/s.test(styles), "article selected state still uses a dark inverse gradient");
assert(styles.includes('[data-theme="dark"] .num-hl { color: #8BD2E8;'), "dark-mode numeric highlights lack a readable foreground");
assert(styles.includes("MECE consulting operating model") && styles.includes(".msf-mece-model"), "MECE consulting frame is missing");
assert(styles.includes(".msf-consulting-intro::before { display: none; }"), "strategy header still uses a one-sided accent stripe");
assert(styles.includes('[data-theme="dark"] .msf-mece-stage-metrics b'), "MECE metrics lack an explicit dark-mode contrast rule");
assert(styles.includes(".dyn-company-facts p::before") && styles.includes("font-size: var(--text-xs) !important"), "dark competitive-panel labels can become too small or lose their bullet cue");
assert(styles.includes('.dyn-related-row:is(:hover, :focus-within)') && styles.includes("color: #FFFFFF !important"), "dark relationship hover lacks an explicit readable foreground");
assert(styles.includes(".dyn-video-panel .tl-kw-key") && styles.includes("color: #E9D5FF !important"), "dark media-panel keyword highlight can inherit a low-contrast light-theme color");
assert(styles.includes(".dyn-layer-tabs button:is(:hover, :focus-visible, .on)")
  && styles.includes(".dyn-layer-tabs button.on .dyn-layer-index")
  && styles.includes(".dyn-company-picker button:is(:hover, :focus-visible, .on)")
  && styles.includes(".dyn-axis-list button:is(:hover, :focus-visible, .on)"), "competitive dynamics filters lack readable hover and selected states");
assert(boards.includes("const wrapNodeLabel") && boards.includes("ctx.roundRect(boxCenterX")
  && boards.includes("const graphLayerLabels") && boards.includes("companies.length * 17")
  && boards.includes('ctx.fillStyle = dark ? "#F7FAFF" : "#12243A"')
  && boards.includes('function draw() {\n      const dark = document.documentElement.dataset.theme === "dark";'), "competitive dynamics node labels are clipped or lack live theme-safe contrast");
assert(boards.includes("official asset -> official-domain favicon -> initial")
  && boards.includes("logoCacheRef") && boards.includes("ctx.drawImage(logo.image")
  && boards.includes('className="nvi-node-mark"')
  && !boards.includes('<span className="nvi-node-mark">')
  && styles.includes(".ct-logo-img.is-reversed")
  && styles.includes(".nvi-company-title .nvi-company-logo"), "company logos are not consistently rendered in lists, details and relationship maps");
assert(styles.includes(".kg-hint-compact") && styles.includes(".msf-mname > b"), "remaining dashboard labels lack the 11.5px readability floor");
assert(boards.includes('split(/\\n+|\\s+·\\s+/)') && boards.includes("핵심만 최대 3줄"), "feed summaries are not normalized into concise bullet lines");
assert(boards.includes('<b>상세 <i aria-hidden="true" /></b>')
  && !boards.includes("실적·조직·발언·원문"), "company cards must open the detailed company assessment without operational source copy");
assert(boards.includes('institutional: "a16z"')
  && !boards.includes("a16z 전용"), "a16z labels still expose the retired 전용 qualifier");

assert(taxonomy.publicFacts === "none-generated-views-only", "registry still declares public mutable facts");
assert(!Object.hasOwn(taxonomy, "MOBILE_STRATEGY"), "legacy strategy facts remain in runtime taxonomy");
assert((taxonomy.COMPANIES || []).every(company => !["valuation", "funding", "note", "direction", "vp"].some(key => Object.hasOwn(company, key))), "company registry contains mutable card facts");
assert((taxonomy.STOCKS || []).every(stock => !["price", "marketCap", "reason", "events"].some(key => Object.hasOwn(stock, key))), "stock registry contains mutable market facts");

assert(strategy.sourceMode === "generated-from-verified-ledgers", "strategy view is not generated from verified ledgers");
assert(strategy.consultingModel?.workstreams?.length === 4 && strategy.consultingModel?.coverage?.sections === 9, "generated MECE architecture is incomplete");
assert(strategy.lineage?.generatedFrom?.includes("news.json") && strategy.lineage?.generatedFrom?.includes("mobile-ai-business-view.json"), "strategy lineage is incomplete");
assert(!Object.hasOwn(strategy, "accountPortfolio") && !boards.includes("Competitive Platform Portfolio") && !styles.includes(".msf-account"), "removed competitive company portfolio is still exposed");
assert(!boards.includes("const recentSignalCount = Number(c.live?.mentions30 || 0)")
  && !boards.includes(">최근 30일 신호<"), "company cards still expose retired operational evidence counters");
assert(Array.isArray(strategy.opportunityPortfolio)
  && strategy.opportunityPortfolio.every(item => item.evidence?.length), "generated opportunity portfolio lacks evidence");
assert(Array.isArray(strategy.expertSignals)
  && strategy.expertSignals.every(item => /^https:\/\//.test(item.url || "")), "generated evidence signals are incomplete");
assert(app.includes('loadJson(dataUrl("strategy-view.json"))') && boards.includes("strategyData ||"), "browser strategy section is not connected to generated data");

let legacyExists = true;
try { await access("data.js"); } catch { legacyExists = false; }
assert(!legacyExists, "legacy hardcoded data.js still exists");

console.log(`visual-readability: ok · ${overview.relationshipLandscape?.companyCount || taxonomy.COMPANIES.length} landscape companies · ${strategy.opportunityPortfolio.length} opportunities · ${strategy.expertSignals.length} evidence signals`);
