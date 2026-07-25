import { readFile } from "node:fs/promises";

const fallback = {
  version: 1,
  marketLocalesPerRun: 5,
  locales: [{ id: "us-en", region: "North America", language: "English", hl: "en-US", gl: "US", ceid: "US:en" }],
};

let policy = fallback;
try {
  policy = { ...fallback, ...JSON.parse(await readFile("config/global-source-policy.json", "utf8")) };
} catch (error) {
  console.warn(`[global-sources] policy unavailable; using one global locale: ${error.message}`);
}

export const globalSourcePolicy = Object.freeze(policy);
export const globalLocales = Object.freeze((policy.locales || []).filter(locale => locale?.id && locale?.hl && locale?.gl && locale?.ceid));

export const googleNewsUrl = (query, locale, days = 14) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:${days}d`)}&hl=${encodeURIComponent(locale.hl)}&gl=${encodeURIComponent(locale.gl)}&ceid=${encodeURIComponent(locale.ceid)}`;

// Keep North America in every run, then rotate the remaining regions. This
// spreads coverage across global markets without turning a daily refresh into
// dozens of duplicate requests for the same query.
export const rotatingLocales = (count = Number(policy.marketLocalesPerRun) || 5, date = new Date()) => {
  const anchor = globalLocales.find(locale => locale.id === "us-en") || globalLocales[0];
  const rest = globalLocales.filter(locale => locale !== anchor);
  if (!anchor) return [];
  const take = Math.max(0, Math.min(rest.length, count - 1));
  const day = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
  const start = rest.length ? day % rest.length : 0;
  const rotated = Array.from({ length: take }, (_, index) => rest[(start + index) % rest.length]);
  return [anchor, ...rotated];
};
