#!/usr/bin/env node
/**
 * Produces the browser-ready dashboard bundle once at build time.
 *
 * GitHub Pages serves static files, so compiling JSX in every visitor's
 * browser was unnecessary CPU, bandwidth, and parser work. This script is a
 * maintainer build step only; the committed bundle has no runtime compiler
 * dependency. The source stamp lets CI reject a stale bundle cheaply.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import { loadDash } from "./load-dash.mjs";

export const BROWSER_SOURCES = [
  "tweaks-panel.jsx",
  "anim.jsx",
  "charts.jsx",
  "components.jsx",
  "boards.jsx",
  "app.jsx",
];
export const BUNDLE_FILE = "app.bundle.js";
export const DATA_SOURCE_FILE = "config/dashboard-taxonomy.json";
export const DATA_BUNDLE_FILE = "data.bundle.js";
export const INDEX_FILE = "index.html";
export const STYLES_FILE = "styles.css";
const BABEL_URL = "https://unpkg.com/@babel/standalone@7.29.0/babel.min.js";
const RUNTIME_DATA_KEYS = [
  "BIGTECH_GROUPS", "CATEGORIES", "COMPANY_LAYER", "COMPANY_ORDER",
  "DECISION_FRAMEWORK", "STARTUP_TAXONOMY", "STARTUP_VERTICALS", "STOCK_GROUPS",
  "STOCK_GROUP_LAYER", "STOCK_LAYER", "STOCK_VALUE_CHAIN", "VALUE_CHAIN",
];

export function buildRuntimeDash(dash = loadDash()) {
  const runtime = Object.fromEntries(RUNTIME_DATA_KEYS
    .filter(key => dash[key] !== undefined)
    .map(key => [key, dash[key]]));
  // Mutable facts live in generated JSON. The runtime registry keeps only
  // identity/taxonomy fields needed before those views arrive.
  runtime.COMPANIES = (dash.COMPANIES || []).map(company => ({
    cat: company.cat,
    name: company.name,
    group: company.group,
    domain: company.domain,
    unit: company.unit,
    url: company.url,
  }));
  runtime.STOCKS = (dash.STOCKS || []).map(stock => ({
    ticker: stock.ticker,
    name: stock.name,
    group: stock.group,
    domain: stock.domain,
    cat: stock.cat,
    exchange: stock.exchange,
  }));
  return runtime;
}

export const runtimeDataSource = (dash = loadDash()) => `window.DASH=${JSON.stringify(buildRuntimeDash(dash))};`;

export const sourceStamp = sources => createHash("sha256")
  // Git checks out LF on Actions and CRLF locally on this workspace. The
  // stamp represents source content, not platform-specific line endings.
  .update(sources.map(({ file, source }) => `${file}\0${source.replace(/\r\n/g, "\n")}`).join("\0"))
  .digest("hex");

export async function readBrowserSources() {
  return Promise.all(BROWSER_SOURCES.map(async file => ({ file, source: await readFile(file, "utf8") })));
}

export const assetVersion = (file, source) => sourceStamp([{ file, source }]).slice(0, 16);

export function versionAsset(indexSource, assetName, version) {
  const escapedName = assetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`(${escapedName})(?:\\?v=[^"']*)?`, "g");
  const updated = indexSource.replace(matcher, `$1?v=${version}`);
  if (updated === indexSource && !indexSource.includes(`${assetName}?v=${version}`)) {
    throw new Error(`${assetName} is missing from ${INDEX_FILE}`);
  }
  return updated;
}

async function loadBabel() {
  const response = await fetch(BABEL_URL);
  if (!response.ok) throw new Error(`Could not download browser compiler (${response.status})`);
  const context = { console };
  vm.createContext(context);
  vm.runInContext(await response.text(), context, { filename: "babel-standalone.js" });
  if (!context.Babel) throw new Error("Browser compiler did not initialize");
  return context.Babel;
}

export async function buildBrowserBundle() {
  const [sources, taxonomySource, stylesSource, indexSource] = await Promise.all([
    readBrowserSources(),
    readFile(DATA_SOURCE_FILE, "utf8"),
    readFile(STYLES_FILE, "utf8"),
    readFile(INDEX_FILE, "utf8"),
  ]);
  const stamp = sourceStamp(sources);
  const compactData = runtimeDataSource();
  // Hash the emitted runtime payload, not only its source ledger. Changes to
  // pruning/normalization logic must produce a new URL or an old CDN response
  // can survive a deployment.
  const dataStamp = sourceStamp([
    { file: DATA_SOURCE_FILE, source: taxonomySource },
    { file: "runtime-data.js", source: compactData },
  ]);
  const styleStamp = assetVersion(STYLES_FILE, stylesSource);
  const Babel = await loadBabel();
  const compiled = sources.map(({ file, source }) => Babel.transform(source, {
    filename: file,
    presets: [["react", { runtime: "classic" }]],
    babelrc: false,
    configFile: false,
    comments: false,
    compact: true,
  }).code);
  const bundle = `/* ai-dashboard-bundle:${stamp} */\n${compiled.join("\n")}\n`;
  const dataBundle = `/* ai-dashboard-data:${dataStamp} */\n${compactData}\n`;
  const versionedIndex = [
    [STYLES_FILE, styleStamp],
    [DATA_BUNDLE_FILE, dataStamp.slice(0, 16)],
    [BUNDLE_FILE, stamp.slice(0, 16)],
  ].reduce((html, [assetName, version]) => versionAsset(html, assetName, version), indexSource);
  await Promise.all([
    writeFile(BUNDLE_FILE, bundle),
    writeFile(DATA_BUNDLE_FILE, dataBundle),
    writeFile(INDEX_FILE, versionedIndex),
  ]);
  console.log(`[bundle] wrote ${BUNDLE_FILE} from ${sources.length} source files (${Math.round(bundle.length / 1024)} KB)`);
  console.log(`[bundle] wrote ${DATA_BUNDLE_FILE} (${Math.round(dataBundle.length / 1024)} KB)`);
  console.log(`[bundle] versioned browser assets in ${INDEX_FILE}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildBrowserBundle().catch(error => { console.error(`[bundle] ${error.message}`); process.exit(1); });
}
