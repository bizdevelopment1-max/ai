#!/usr/bin/env node
/* ============================================================
   Daily stock crawler — REAL daily closes + market cap.
   Primary source: Yahoo Finance chart API (JSON, no key, works
   from cloud runners). Fallback: Stooq CSV. Writes stocks.json,
   which the dashboard renders. No synthetic prices.
   ============================================================ */
import { writeFile, readFile } from "node:fs/promises";

// ticker -> { yahoo symbol, stooq symbol, shares outstanding (billions) }
const TICKERS = [
  { t: "NVDA", y: "NVDA", s: "nvda.us", shares: 24.4 },
  { t: "MSFT", y: "MSFT", s: "msft.us", shares: 7.43 },
  { t: "AMZN", y: "AMZN", s: "amzn.us", shares: 10.6 },
  { t: "AAPL", y: "AAPL", s: "aapl.us", shares: 14.8 },
  { t: "GOOGL", y: "GOOGL", s: "googl.us", shares: 12.2 },
  { t: "META", y: "META", s: "meta.us", shares: 2.53 },
];

const YEARS = 5;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const fmtCap = (capB) => (capB >= 1000 ? `$${(capB / 1000).toFixed(2)}T` : `$${Math.round(capB)}B`);
const round2 = (n) => Math.round(n * 100) / 100;

async function fromYahoo(c) {
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  for (const h of hosts) {
    try {
      const url = `https://${h}/v8/finance/chart/${c.y}?range=${YEARS}y&interval=1d`;
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const j = await res.json();
      const r = j && j.chart && j.chart.result && j.chart.result[0];
      if (!r || !r.timestamp) throw new Error("no result");
      const closes = r.indicators.quote[0].close;
      const points = r.timestamp
        .map((t, i) => ({ d: new Date(t * 1000).toISOString().slice(0, 10), p: closes[i] }))
        .filter((p) => typeof p.p === "number" && isFinite(p.p))
        .map((p) => ({ d: p.d, p: round2(p.p) }));
      if (points.length < 30) throw new Error("too few points");
      return points;
    } catch (e) { /* try next host */ }
  }
  return null;
}

async function fromStooq(c) {
  try {
    const res = await fetch(`https://stooq.com/q/d/l/?s=${c.s}&i=d`, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const csv = await res.text();
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 30 || !/^Date/i.test(lines[0])) throw new Error("bad csv");
    const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - YEARS);
    const points = [];
    for (let i = 1; i < lines.length; i++) {
      const col = lines[i].split(",");
      const d = col[0], close = parseFloat(col[4]);
      if (!d || isNaN(close) || new Date(d) < cutoff) continue;
      points.push({ d, p: round2(close) });
    }
    return points.length >= 30 ? points : null;
  } catch { return null; }
}

async function crawlOne(c) {
  const points = (await fromYahoo(c)) || (await fromStooq(c));
  if (!points) { console.warn(`[stock:${c.t}] no data (Yahoo+Stooq failed)`); return null; }
  const last = points[points.length - 1];
  const marketCap = fmtCap(last.p * c.shares);
  console.log(`[stock:${c.t}] ${points.length} days, last ${last.d} $${last.p}, cap ${marketCap}`);
  return [c.t, { ticker: c.t, asOf: last.d, currency: "$", lastPrice: last.p, marketCap, points }];
}

async function main() {
  console.log(`Crawling ${TICKERS.length} tickers (Yahoo primary, Stooq fallback)…`);
  const results = (await Promise.all(TICKERS.map(crawlOne))).filter(Boolean);
  const stocks = Object.fromEntries(results);

  let prev = {};
  try { prev = JSON.parse(await readFile("stocks.json", "utf8")).stocks || {}; } catch {}
  const final = Object.keys(stocks).length ? stocks : prev;

  await writeFile("stocks.json", JSON.stringify({ generatedAt: new Date().toISOString(), stocks: final }) + "\n");
  console.log(`Wrote stocks.json with ${Object.keys(final).length} tickers.`);
}

main().catch((e) => { console.error(e); process.exit(0); });
