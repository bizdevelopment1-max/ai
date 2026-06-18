#!/usr/bin/env node
/* ============================================================
   Daily stock crawler — REAL daily closes + market cap.
   Sources tried in order (all keyless):
     1) Yahoo Finance v8 chart with cookie+crumb session
     2) Stooq daily CSV
     3) Nasdaq historical API
   Writes stocks.json for the dashboard. No synthetic prices.
   ============================================================ */
import { writeFile, readFile } from "node:fs/promises";

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
const cutoffDate = () => { const d = new Date(); d.setFullYear(d.getFullYear() - YEARS); return d; };

// ---- Yahoo cookie + crumb session (required for datacenter IPs) ----
async function yahooSession() {
  try {
    const r = await fetch("https://fc.yahoo.com/", { headers: { "User-Agent": UA } });
    const setC = (typeof r.headers.getSetCookie === "function" ? r.headers.getSetCookie() : []) || [];
    const cookie = setC.map((c) => c.split(";")[0]).join("; ");
    if (!cookie) return null;
    const cr = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, Cookie: cookie, Accept: "text/plain" },
    });
    const crumb = (await cr.text()).trim();
    if (!crumb || crumb.length > 40 || /<|\{/.test(crumb)) return { cookie, crumb: "" };
    return { cookie, crumb };
  } catch { return null; }
}

async function fromYahoo(c, sess) {
  for (const h of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const q = sess && sess.crumb ? `&crumb=${encodeURIComponent(sess.crumb)}` : "";
      const url = `https://${h}/v8/finance/chart/${c.y}?range=${YEARS}y&interval=1d${q}`;
      const headers = { "User-Agent": UA, Accept: "application/json" };
      if (sess && sess.cookie) headers.Cookie = sess.cookie;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const j = await res.json();
      const r = j && j.chart && j.chart.result && j.chart.result[0];
      if (!r || !r.timestamp) throw new Error("no result");
      const closes = r.indicators.quote[0].close;
      const points = r.timestamp
        .map((t, i) => ({ d: new Date(t * 1000).toISOString().slice(0, 10), p: closes[i] }))
        .filter((p) => typeof p.p === "number" && isFinite(p.p))
        .map((p) => ({ d: p.d, p: round2(p.p) }));
      if (points.length >= 30) return points;
    } catch { /* next host */ }
  }
  return null;
}

async function fromStooq(c) {
  try {
    const res = await fetch(`https://stooq.com/q/d/l/?s=${c.s}&i=d`, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const lines = (await res.text()).trim().split(/\r?\n/);
    if (lines.length < 30 || !/^Date/i.test(lines[0])) throw new Error("bad csv");
    const cut = cutoffDate(), points = [];
    for (let i = 1; i < lines.length; i++) {
      const col = lines[i].split(","), d = col[0], close = parseFloat(col[4]);
      if (!d || isNaN(close) || new Date(d) < cut) continue;
      points.push({ d, p: round2(close) });
    }
    return points.length >= 30 ? points : null;
  } catch { return null; }
}

async function fromNasdaq(c) {
  try {
    const from = cutoffDate().toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    const url = `https://api.nasdaq.com/api/quote/${c.y}/historical?assetclass=stocks&fromdate=${from}&todate=${to}&limit=9999`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json", Origin: "https://www.nasdaq.com", Referer: "https://www.nasdaq.com/" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    const rows = j && j.data && j.data.tradesTable && j.data.tradesTable.rows;
    if (!rows || !rows.length) throw new Error("no rows");
    const points = rows.map((r) => {
      const [m, d, y] = r.date.split("/");
      return { d: `${y}-${m}-${d}`, p: round2(parseFloat(String(r.close).replace(/[$,]/g, ""))) };
    }).filter((p) => isFinite(p.p)).sort((a, b) => (a.d < b.d ? -1 : 1));
    return points.length >= 30 ? points : null;
  } catch { return null; }
}

async function crawlOne(c, sess) {
  let points = await fromYahoo(c, sess);
  let src = "yahoo";
  if (!points) { points = await fromStooq(c); src = "stooq"; }
  if (!points) { points = await fromNasdaq(c); src = "nasdaq"; }
  if (!points) { console.warn(`[stock:${c.t}] no data (all sources failed)`); return null; }
  const last = points[points.length - 1];
  const marketCap = fmtCap(last.p * c.shares);
  console.log(`[stock:${c.t}] ${src}: ${points.length} days, last ${last.d} $${last.p}, cap ${marketCap}`);
  return [c.t, { ticker: c.t, asOf: last.d, currency: "$", lastPrice: last.p, marketCap, source: src, points }];
}

async function main() {
  const sess = await yahooSession();
  console.log(`Yahoo session: ${sess ? (sess.crumb ? "cookie+crumb" : "cookie only") : "none"}`);
  const results = (await Promise.all(TICKERS.map((c) => crawlOne(c, sess)))).filter(Boolean);
  const stocks = Object.fromEntries(results);

  let prev = {};
  try { prev = JSON.parse(await readFile("stocks.json", "utf8")).stocks || {}; } catch {}
  const final = Object.keys(stocks).length ? stocks : prev;

  await writeFile("stocks.json", JSON.stringify({ generatedAt: new Date().toISOString(), stocks: final }) + "\n");
  console.log(`Wrote stocks.json with ${Object.keys(final).length} tickers.`);
}

main().catch((e) => { console.error(e); process.exit(0); });
