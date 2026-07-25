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

export const BROWSER_SOURCES = [
  "tweaks-panel.jsx",
  "anim.jsx",
  "charts.jsx",
  "components.jsx",
  "boards.jsx",
  "app.jsx",
];
export const BUNDLE_FILE = "app.bundle.js";
const BABEL_URL = "https://unpkg.com/@babel/standalone@7.29.0/babel.min.js";

export const sourceStamp = sources => createHash("sha256")
  .update(sources.map(({ file, source }) => `${file}\0${source}`).join("\0"))
  .digest("hex");

export async function readBrowserSources() {
  return Promise.all(BROWSER_SOURCES.map(async file => ({ file, source: await readFile(file, "utf8") })));
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
  const sources = await readBrowserSources();
  const stamp = sourceStamp(sources);
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
  await writeFile(BUNDLE_FILE, bundle);
  console.log(`[bundle] wrote ${BUNDLE_FILE} from ${sources.length} source files (${Math.round(bundle.length / 1024)} KB)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildBrowserBundle().catch(error => { console.error(`[bundle] ${error.message}`); process.exit(1); });
}
