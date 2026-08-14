#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadDash } from "./load-dash.mjs";

const root = process.cwd();
const RETIRED_FOCUS = /(?:SK\s*-?\s*hynix|SK하이닉스|하이닉스|Micron|SanDisk|Western Digital|Kioxia|CXMT|GigaDevice|BIWIN|Montage Technology|메모리|\bmemory\b|\bHBM\d*\b|\bDRAM\b|\bDDR\d*\b|\bNAND\b|\beSSD\b|\bCXL\b|SOCAMM|MRDIMM)/i;
const hasRetiredFocus = value => {
  if (typeof value === "string") return RETIRED_FOCUS.test(value);
  if (Array.isArray(value)) return value.some(hasRetiredFocus);
  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, item]) => RETIRED_FOCUS.test(key) || hasRetiredFocus(item));
  }
  return false;
};

const scrubText = value => {
  const text = String(value || "");
  if (!hasRetiredFocus(text)) return text;
  return text
    .split(/(?:\r?\n)+|(?<=[.!?])\s+/)
    .filter(part => part.trim() && !hasRetiredFocus(part))
    .join(" ")
    .trim();
};

const DROP_FIELDS = ["company", "name", "ticker", "symbol", "title", "titleEn", "titleKo", "headline"];
const shouldDropItem = item => {
  if (typeof item === "string") return hasRetiredFocus(item);
  if (!item || typeof item !== "object") return false;
  return DROP_FIELDS.some(key => typeof item[key] === "string" && hasRetiredFocus(item[key]));
};

const scrub = value => {
  if (Array.isArray(value)) return value
    .filter(item => !shouldDropItem(item))
    .map(scrub);
  if (!value || typeof value !== "object") return value;
  const containedRetiredFocus = hasRetiredFocus(value);
  const cleaned = Object.fromEntries(Object.entries(value)
    .filter(([key]) => !hasRetiredFocus(key))
    .map(([key, item]) => [key, typeof item === "string" ? scrubText(item) : scrub(item)])
    .filter(([, item]) => item !== ""));
  if (containedRetiredFocus && Object.hasOwn(value, "displayEligible")) cleaned.displayEligible = false;
  return cleaned;
};

const files = [
  "news.json",
  "research.json",
  "market.json",
  "infra.json",
  "bizmodel.json",
  "history.json",
  "briefing.json",
  "insights.json",
  "companies.json",
  "company-news.json",
  "business-model-forecasts.json",
  "mobile-ai-business-view.json",
  "strategic-ventures.json",
  "startups.json",
  "a16z-startups.json",
  "monetization.json",
];

let removed = 0;
const updatedFiles = [];
for (const file of files) {
  try {
    const path = resolve(root, file);
    const raw = await readFile(path, "utf8");
    const source = JSON.parse(raw);
    const before = JSON.stringify(source);
    const prepared = file === "briefing.json"
      ? { ...source, days: (source.days || []).map(day => ({
        ...day,
        items: (day.items || []).filter(item => !hasRetiredFocus(item)),
      })) }
      : source;
    const cleaned = scrub(prepared);
    const after = JSON.stringify(cleaned);
    if (before !== after) {
      removed += 1;
      updatedFiles.push(file);
      const indent = /^[[{]\r?\n/.test(raw) ? 2 : 0;
      await writeFile(path, `${JSON.stringify(cleaned, null, indent)}\n`);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const allowedTickers = new Set((loadDash().STOCKS || []).map(item => item.ticker));
for (const [file, key] of [["stocks.json", "stocks"], ["stock-events.json", "events"]]) {
  try {
    const path = resolve(root, file);
    const raw = await readFile(path, "utf8");
    const source = JSON.parse(raw);
    source[key] = Object.fromEntries(Object.entries(source[key] || {})
      .filter(([ticker]) => allowedTickers.has(ticker))
      .map(([ticker, value]) => [ticker, scrub(value)]));
    const indent = /^[[{]\r?\n/.test(raw) ? 2 : 0;
    await writeFile(path, `${JSON.stringify(source, null, indent)}\n`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

console.log(`[prune-retired-focus] ${removed} dataset(s) updated${updatedFiles.length ? ` (${updatedFiles.join(", ")})` : ""} · ${allowedTickers.size} mobile-AI-related stocks retained`);
