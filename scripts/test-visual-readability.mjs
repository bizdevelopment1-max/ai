#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";

const [styles, app, boards, taxonomy, strategy] = await Promise.all([
  readFile("styles.css", "utf8"),
  readFile("app.jsx", "utf8"),
  readFile("boards.jsx", "utf8"),
  readFile("config/dashboard-taxonomy.json", "utf8").then(JSON.parse),
  readFile("strategy-view.json", "utf8").then(JSON.parse),
]);

const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(styles.includes("Readability contract · safe in light/dark and hover/focus modes"), "readability contract is missing");
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

assert(taxonomy.publicFacts === "none-generated-views-only", "registry still declares public mutable facts");
assert(!Object.hasOwn(taxonomy, "MOBILE_STRATEGY"), "legacy strategy facts remain in runtime taxonomy");
assert((taxonomy.COMPANIES || []).every(company => !["valuation", "funding", "note", "direction", "vp"].some(key => Object.hasOwn(company, key))), "company registry contains mutable card facts");
assert((taxonomy.STOCKS || []).every(stock => !["price", "marketCap", "reason", "events"].some(key => Object.hasOwn(stock, key))), "stock registry contains mutable market facts");

assert(strategy.sourceMode === "generated-from-verified-ledgers", "strategy view is not generated from verified ledgers");
assert(strategy.lineage?.generatedFrom?.includes("companies.json") && strategy.lineage?.generatedFrom?.includes("mobile-ai-business-view.json"), "strategy lineage is incomplete");
assert(strategy.accountPortfolio?.length >= 5 && strategy.accountPortfolio.every(item => /^https:\/\//.test(item.sourceUrl || "")), "generated company portfolio lacks source URLs");
assert(strategy.opportunityPortfolio?.length >= 9 && strategy.opportunityPortfolio.every(item => item.evidence?.length), "generated opportunity portfolio lacks evidence");
assert(strategy.expertSignals?.length >= 5 && strategy.expertSignals.every(item => /^https:\/\//.test(item.url || "")), "generated evidence signals are incomplete");
assert(app.includes('loadJson(dataUrl("strategy-view.json"))') && boards.includes("strategyData ||"), "browser strategy section is not connected to generated data");

let legacyExists = true;
try { await access("data.js"); } catch { legacyExists = false; }
assert(!legacyExists, "legacy hardcoded data.js still exists");

console.log(`visual-readability: ok · ${strategy.accountPortfolio.length} companies · ${strategy.opportunityPortfolio.length} opportunities · ${strategy.expertSignals.length} evidence signals`);
