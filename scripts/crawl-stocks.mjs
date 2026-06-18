#!/usr/bin/env node
/* ============================================================
   Daily stock crawler — REAL daily closes from Stooq (free, no key)
   + market cap (close × shares outstanding). Writes stocks.json,
   which the dashboard renders. Runs daily in GitHub Actions.
   No synthetic/estimated prices — only crawled values.
   ============================================================ */
import { writeFile, readFile } from "node:fs/promises";

// ticker -> { stooq symbol, shares outstanding (billions) for market cap }
const TICKERS = [
  { t: "NVDA", s: "nvda.us", shares: 24.4 },
  { t: "MSFT", s: "msft.us", shares: 7.43 },
  { t: "AMZN", s: "amzn.us", shares: 10.6 },
  { t: "AAPL", s: "aapl.us", shares: 14.8 },
  { t: "GOOGL", s: "googl.us", shares: 12.2 },
  { t: "META", s: "meta.us", shares: 2.53 },
];

const YEARS = 5;
const fmtCap = (capB) => (capB >= 1000 ? `$${(capB / 1000).toFixed(2)}T` : `$${Math.round(capB)}B`);

async function fetchCsv(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (AI-Dashboard StockBot)" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.text();
}

async function crawlOne(c) {
  // Stooq daily history CSV: Date,Open,High,Low,Close,Volume
  const url = `https://stooq.com/q/d/l/?s=${c.s}&i=d`;
  try {
    const csv = await fetchCsv(url);
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 3 || !/^Date/i.test(lines[0])) throw new Error("bad csv: " + lines[0]?.slice(0, 40));
    const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - YEARS);
    const points = [];
    for (let i = 1; i < lines.length; i++) {
      const col = lines[i].split(",");
      const d = col[0], close = parseFloat(col[4]);
      if (!d || isNaN(close)) continue;
      if (new Date(d) < cutoff) continue;
      points.push({ d, p: Math.round(close * 100) / 100 });
    }
    if (points.length < 2) throw new Error("no rows");
    const last = points[points.length - 1];
    const marketCap = fmtCap(last.p * c.shares);
    console.log(`[stock:${c.t}] ${points.length} days, last ${last.d} $${last.p}, cap ${marketCap}`);
    return [c.t, { ticker: c.t, asOf: last.d, currency: "$", lastPrice: last.p, marketCap, points }];
  } catch (e) {
    console.warn(`[stock:${c.t}] failed: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log(`Crawling ${TICKERS.length} tickers from Stooq…`);
  const results = (await Promise.all(TICKERS.map(crawlOne))).filter(Boolean);
  const stocks = Object.fromEntries(results);

  // if all failed (e.g. network), keep the previous file
  let prev = {};
  try { prev = JSON.parse(await readFile("stocks.json", "utf8")).stocks || {}; } catch {}
  const final = Object.keys(stocks).length ? stocks : prev;

  const payload = { generatedAt: new Date().toISOString(), stocks: final };
  await writeFile("stocks.json", JSON.stringify(payload) + "\n");
  console.log(`Wrote stocks.json with ${Object.keys(final).length} tickers.`);
}

main().catch((e) => { console.error(e); process.exit(0); });
