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
  // SpaceX — fetch the listed SPCX ticker directly (no proxy). shares unknown → no market cap.
  { t: "SPCX", y: "SPCX", s: "spcx.us", shares: 0 },
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
      if (points.length >= 5) return points;
    } catch { /* next host */ }
  }
  return null;
}

// Yahoo Finance WEB pages (exact URLs: finance.yahoo.com/quote/<T>/history & /quote/<T>).
// Some symbols resolve on the web property even when the datacenter API path is blocked.
async function fromYahooWeb(c, sess) {
  const headers = { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" };
  if (sess && sess.cookie) headers.Cookie = sess.cookie;
  try {
    const res = await fetch(`https://finance.yahoo.com/quote/${c.y}/history`, { headers });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const html = await res.text();
    let points = [];
    // (a) embedded HistoricalPriceStore JSON (classic)
    const m = html.match(/"prices":\[(\{"date".*?\})\]/s);
    if (m) {
      try {
        const arr = JSON.parse("[" + m[1] + "]");
        points = arr.filter(p => p && p.date && (p.close != null || p.adjclose != null))
          .map(p => ({ d: new Date(p.date * 1000).toISOString().slice(0, 10), p: round2(p.close != null ? p.close : p.adjclose) }))
          .filter(p => isFinite(p.p)).sort((a, b) => (a.d < b.d ? -1 : 1));
      } catch {}
    }
    // (b) HTML history table rows: <td>Mon DD, YYYY</td> ... close in 5th numeric cell
    if (points.length < 2) {
      const rows = [...html.matchAll(/<tr[^>]*class="[^"]*yf-[^"]*"[^>]*>([\s\S]*?)<\/tr>/g)];
      for (const [, row] of rows) {
        const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => x[1].replace(/<[^>]+>/g, "").trim());
        if (cells.length >= 6) {
          const d = new Date(cells[0]);
          const close = parseFloat(cells[4].replace(/,/g, ""));
          if (!isNaN(d) && isFinite(close)) points.push({ d: d.toISOString().slice(0, 10), p: round2(close) });
        }
      }
      points.sort((a, b) => (a.d < b.d ? -1 : 1));
    }
    return points.length >= 2 ? points : null;
  } catch { return null; }
}

// Market cap from Yahoo quote summary page (regex on embedded JSON / data cell)
async function yahooMarketCap(c, sess) {
  const headers = { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" };
  if (sess && sess.cookie) headers.Cookie = sess.cookie;
  try {
    const res = await fetch(`https://finance.yahoo.com/quote/${c.y}`, { headers });
    if (!res.ok) return "";
    const html = await res.text();
    const m = html.match(/"marketCap":\{"raw":([0-9.eE+]+)/) || html.match(/data-field="marketCap"[^>]*>([\d.,]+[TBMK]?)/);
    if (!m) return "";
    if (/^[0-9.eE+]+$/.test(m[1])) { const capB = parseFloat(m[1]) / 1e9; return fmtCap(capB); }
    return m[1];
  } catch { return ""; }
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
    return points.length >= 5 ? points : null;
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
    return points.length >= 5 ? points : null;
  } catch { return null; }
}

// StockAnalysis.com daily history (keyless JSON) — robust fallback, esp. for newer/odd tickers
async function fromStockAnalysis(c) {
  try {
    const url = `https://stockanalysis.com/api/symbol/s/${c.y.toLowerCase()}/history?range=5Y&period=Daily`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json", Referer: "https://stockanalysis.com/" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    const rows = (j && (Array.isArray(j.data) ? j.data : (j.data && j.data.data))) || [];
    const cut = cutoffDate();
    const points = rows.map((r) => {
      const d = r.t || r.date || r[0];
      const close = r.c != null ? r.c : (r.close != null ? r.close : r[4]);
      const dd = typeof d === "number" ? new Date(d * 1000).toISOString().slice(0, 10) : String(d).slice(0, 10);
      return { d: dd, p: round2(parseFloat(close)) };
    }).filter((p) => p.d && isFinite(p.p) && new Date(p.d) >= cut).sort((a, b) => (a.d < b.d ? -1 : 1));
    return points.length >= 5 ? points : null;
  } catch { return null; }
}

// TradingView quote (keyless) — last price only; used to confirm a ticker trades when history APIs miss it
async function tvLastPrice(c) {
  try {
    const res = await fetch("https://scanner.tradingview.com/symbol", {
      method: "POST", headers: { "User-Agent": UA, "content-type": "application/json" },
      body: JSON.stringify({ symbols: { tickers: [`NASDAQ:${c.y}`, `NYSE:${c.y}`, `AMEX:${c.y}`] }, columns: ["close", "update_mode"] }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    const row = (j.data || []).find(r => r.d && isFinite(r.d[0]));
    return row ? round2(row.d[0]) : null;
  } catch { return null; }
}

async function crawlOne(c, sess) {
  // Source order: Yahoo API → Yahoo web pages → Stooq → Nasdaq → StockAnalysis → TradingView(last price)
  const sources = [
    ["yahoo-api", () => fromYahoo(c, sess)],
    ["yahoo-web", () => fromYahooWeb(c, sess)],
    ["stooq", () => fromStooq(c)],
    ["nasdaq", () => fromNasdaq(c)],
    ["stockanalysis", () => fromStockAnalysis(c)],
    ["tradingview", async () => { const tv = await tvLastPrice(c); return tv ? [{ d: new Date().toISOString().slice(0, 10), p: tv }] : null; }],
  ];
  let points = null, src = "";
  const tried = [];
  for (const [name, fn] of sources) {
    let got = null;
    try { got = await fn(); } catch { got = null; }
    tried.push(`${name}:${got ? got.length : 0}`);
    if (got && got.length) { points = got; src = name; break; }
  }
  if (!points) { console.warn(`[stock:${c.t}] no data — tried ${tried.join(" ")}`); return null; }
  const last = points[points.length - 1];
  let marketCap = c.shares ? fmtCap(last.p * c.shares) : "";
  if (!marketCap) { marketCap = await yahooMarketCap(c, sess); }   // shares 미상(SPCX 등) → Yahoo 요약에서 시총 파싱
  console.log(`[stock:${c.t}] ${src}: ${points.length} days, last ${last.d} $${last.p}${marketCap ? ", cap " + marketCap : ""} (${tried.join(" ")})`);
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
