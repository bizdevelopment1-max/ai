#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";

const budgets = {
  "app.bundle.js": 330_000,
  "styles.bundle.css": 320_000,
  "data.bundle.js": 45_000,
  "overview-view.json": 120_000,
};

const sizes = Object.fromEntries(await Promise.all(Object.keys(budgets).map(async file => [file, (await stat(file)).size])));
const failures = Object.entries(budgets)
  .filter(([file, limit]) => sizes[file] > limit)
  .map(([file, limit]) => `${file} ${sizes[file]}B > ${limit}B`);

const initialBytes = Object.values(sizes).reduce((sum, size) => sum + size, 0);
if (initialBytes > 800_000) failures.push(`first-party initial payload ${initialBytes}B > 800000B`);

const [overview, index, appSource, boardSource, appBundle] = await Promise.all([
  readFile("overview-view.json", "utf8").then(JSON.parse),
  readFile("index.html", "utf8"),
  readFile("app.jsx", "utf8"),
  readFile("boards.jsx", "utf8"),
  readFile("app.bundle.js", "utf8"),
]);

if (overview.sourceMode !== "generated-source-backed") failures.push("overview is not generated from source-backed ledgers");
const landscape = overview.relationshipLandscape || {};
if (landscape.sourceMode !== "source-grounded-balanced-layer-selection"
  || Number(landscape.companyCount || 0) !== (landscape.companies || []).length
  || Object.values(landscape.layerCounts || {}).some(count => Number(count) < 5)) {
  failures.push("relationship landscape is not balanced across all seven source-grounded layers");
}
if ((landscape.companies || []).length > 64) failures.push(`relationship landscape carries ${landscape.companies.length} companies; maximum is 64`);
if (!Array.isArray(overview.sourceSummary) || !overview.sourceSummary.length) failures.push("overview source summary is missing");
if ((overview.articles || []).length > 64) failures.push(`overview carries ${(overview.articles || []).length} articles; maximum is 64`);
if ((overview.articles || []).some(article => Object.hasOwn(article, "summary") || Object.hasOwn(article, "summaryLinesKo"))) {
  failures.push("overview carries full article summaries instead of relationship headlines");
}
if ((overview.articles || []).some(article => article.payloadMode !== "relationship-headline")) {
  failures.push("overview articles are not explicitly marked as relationship headlines");
}
if (!/styles\.bundle\.css\?v=/.test(index) || /href="styles\.css/.test(index)) failures.push("index does not use the production CSS bundle");
if (appBundle.includes("onPointerEnter") && boardSource.includes('onPointerEnter={() => setMediaReady(true)}')) {
  failures.push("competitive video may still enter the initial request path on pointer hover");
}
if ((await readFile("styles.bundle.css", "utf8")).includes("@keyframes mplayEvidenceSweep")) {
  failures.push("retired business-model CSS is still shipped to every visitor");
}
if (/Bloomberg · TechCrunch · The Information/.test(appSource)) failures.push("footer contains a fixed publisher list");
if (/STRUCTURAL_COMPETE_EDGES/.test(boardSource)) failures.push("competitive map contains hard-coded relationship edges");
if (/AI 런레이트 \$37B|투자 \$13B|GPU·랙 판매\(\$1\.8억/.test(appBundle)) {
  failures.push("production bundle retained legacy hard-coded market facts");
}
if (!/const needsFullNews = \["evidence", "signals", "newbiz"\]\.includes\(active\)/.test(appSource)) {
  failures.push("large evidence ledger is not gated by the active section");
}

if (failures.length) {
  failures.forEach(failure => console.error(`[delivery] ${failure}`));
  process.exit(1);
}

console.log(`[delivery] initial first-party assets ${Math.round(initialBytes / 1024)} KB`);
Object.entries(sizes).forEach(([file, size]) => console.log(`[delivery] ${file} ${Math.round(size / 1024)} KB`));
console.log(`[delivery] overview ${overview.articleCount} relationship headlines · ${overview.companyCount} detailed companies · ${landscape.companyCount || 0} landscape companies`);
