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
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const TICKERS = [
  // ── 하이퍼스케일러 ──
  { t: "MSFT", y: "MSFT", s: "msft.us", shares: 7.43 },
  { t: "AMZN", y: "AMZN", s: "amzn.us", shares: 10.6 },
  { t: "GOOGL", y: "GOOGL", s: "googl.us", shares: 12.2 },
  { t: "META", y: "META", s: "meta.us", shares: 2.53 },
  { t: "ORCL", y: "ORCL", s: "orcl.us" },
  // ── AI 칩 ──
  { t: "NVDA", y: "NVDA", s: "nvda.us", shares: 24.4 },
  { t: "AMD", y: "AMD", s: "amd.us" },
  { t: "AVGO", y: "AVGO", s: "avgo.us" },
  { t: "TSM", y: "TSM", s: "tsm.us" },
  { t: "QCOM", y: "QCOM", s: "qcom.us" },
  { t: "ARM", y: "ARM", s: "arm.us" },
  { t: "MRVL", y: "MRVL", s: "mrvl.us" },
  { t: "INTC", y: "INTC", s: "intc.us" },
  // ── 메모리 ──
  { t: "MU", y: "MU", s: "mu.us" },
  { t: "000660.KS", y: "000660.KS", currency: "₩", market: "KRX" },
  { t: "SNDK", y: "SNDK", s: "sndk.us" },
  { t: "WDC", y: "WDC", s: "wdc.us" },
  { t: "285A.T", y: "285A.T", currency: "¥", market: "TSE" },
  // ── 파운드리 ──
  { t: "UMC", y: "UMC", s: "umc.us" },
  { t: "GFS", y: "GFS", s: "gfs.us" },
  // ── 반도체 장비 ──
  { t: "ASML", y: "ASML", s: "asml.us" },
  { t: "AMAT", y: "AMAT", s: "amat.us" },
  { t: "LRCX", y: "LRCX", s: "lrcx.us" },
  { t: "KLAC", y: "KLAC", s: "klac.us" },
  { t: "8035.T", y: "8035.T", currency: "¥", market: "TSE" },
  // ── 패키징·테스트 ──
  { t: "ASX", y: "ASX", s: "asx.us" },
  { t: "AMKR", y: "AMKR", s: "amkr.us" },
  // ── 네트워킹·광통신 ──
  { t: "ANET", y: "ANET", s: "anet.us" },
  { t: "CIEN", y: "CIEN", s: "cien.us" },
  // ── 데이터센터·뉴클라우드 ──
  { t: "CRWV", y: "CRWV", s: "crwv.us" },
  { t: "APLD", y: "APLD", s: "apld.us" },
  { t: "VRT", y: "VRT", s: "vrt.us" },
  { t: "NBIS", y: "NBIS", s: "nbis.us" },
  // ── AI 소프트웨어·플랫폼 ──
  { t: "PLTR", y: "PLTR", s: "pltr.us" },
  { t: "NOW", y: "NOW", s: "now.us" },
  // ── 온디바이스 ──
  { t: "AAPL", y: "AAPL", s: "aapl.us", shares: 14.8 },
  // ── AI 네이티브 ──
  // 공개 시세가 확인되는 경우에만 표시하며 임의 시나리오 가격은 만들지 않음
  { t: "SPCX", y: "SPCX", s: "spcx.us" },

  // ── 중국 A주 · 메모리 ──
  { t: "688825.SS", y: "688825.SS", currency: "CN¥", market: "SSE STAR", listedAt: "2026-07-27" },
  { t: "603986.SS", y: "603986.SS", currency: "CN¥", market: "SSE" },
  { t: "688525.SS", y: "688525.SS", currency: "CN¥", market: "SSE STAR" },
  // ── 중국 A주 · 파운드리 ──
  { t: "688981.SS", y: "688981.SS", currency: "CN¥", market: "SSE STAR" },
  { t: "688347.SS", y: "688347.SS", currency: "CN¥", market: "SSE STAR" },
  // ── 중국 A주 · 장비 ──
  { t: "002371.SZ", y: "002371.SZ", currency: "CN¥", market: "SZSE" },
  { t: "688012.SS", y: "688012.SS", currency: "CN¥", market: "SSE STAR" },
  { t: "688082.SS", y: "688082.SS", currency: "CN¥", market: "SSE STAR" },
  { t: "688072.SS", y: "688072.SS", currency: "CN¥", market: "SSE STAR" },
  { t: "688037.SS", y: "688037.SS", currency: "CN¥", market: "SSE STAR" },
  { t: "688120.SS", y: "688120.SS", currency: "CN¥", market: "SSE STAR" },
  // ── 중국 A주 · 패키징·테스트 ──
  { t: "600584.SS", y: "600584.SS", currency: "CN¥", market: "SSE" },
  { t: "002156.SZ", y: "002156.SZ", currency: "CN¥", market: "SZSE" },
  { t: "002185.SZ", y: "002185.SZ", currency: "CN¥", market: "SZSE" },
  // ── 중국 A주 · 팹리스·IP·EDA ──
  { t: "688008.SS", y: "688008.SS", currency: "CN¥", market: "SSE STAR" },
  { t: "688521.SS", y: "688521.SS", currency: "CN¥", market: "SSE STAR" },
  { t: "301269.SZ", y: "301269.SZ", currency: "CN¥", market: "SZSE" },
  { t: "688206.SS", y: "688206.SS", currency: "CN¥", market: "SSE STAR" },
  { t: "603501.SS", y: "603501.SS", currency: "CN¥", market: "SSE" },
  { t: "603893.SS", y: "603893.SS", currency: "CN¥", market: "SSE" },
  { t: "688047.SS", y: "688047.SS", currency: "CN¥", market: "SSE STAR" },
  { t: "688256.SS", y: "688256.SS", currency: "CN¥", market: "SSE STAR" },
  // ── 중국 A주 · 소재·기판 ──
  { t: "688019.SS", y: "688019.SS", currency: "CN¥", market: "SSE STAR" },
  { t: "688126.SS", y: "688126.SS", currency: "CN¥", market: "SSE STAR" },
  { t: "300666.SZ", y: "300666.SZ", currency: "CN¥", market: "SZSE" },
  { t: "002916.SZ", y: "002916.SZ", currency: "CN¥", market: "SZSE" },
];

const YEARS = 5;
// Yahoo intermittently rate-limits the old Linux crawler signature even when the
// same public endpoint is healthy. Keep a current desktop signature so scheduled
// runs follow the normal web-client path instead of retaining stale closes.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const fmtCap = (capB) => (capB >= 1000 ? `$${(capB / 1000).toFixed(2)}T` : `$${Math.round(capB)}B`);
const round2 = (n) => Math.round(n * 100) / 100;
const cutoffDate = () => { const d = new Date(); d.setFullYear(d.getFullYear() - YEARS); return d; };
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// 공급자마다 정렬 순서·중복 행·휴장일 응답 방식이 다르므로 모든 시계열을
// 동일한 규칙으로 정규화한 뒤 마지막 유효 거래일을 선택한다.
function normalizePoints(rows) {
  const today = new Date().toISOString().slice(0, 10);
  const byDate = new Map();
  for (const row of rows || []) {
    const d = String(row?.d || "").slice(0, 10);
    const p = Number(row?.p);
    if (!ISO_DAY.test(d) || d > today || !Number.isFinite(p) || p <= 0) continue;
    byDate.set(d, round2(p));
  }
  return [...byDate.entries()]
    .map(([d, p]) => ({ d, p }))
    .sort((a, b) => a.d.localeCompare(b.d));
}

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
  // Yahoo의 cookie+crumb 경로가 지역·IP별로 401이 될 수 있어 같은 요청을
  // 무세션으로도 재시도함
  const sessions = sess ? [sess, null] : [null];
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const activeSession of sessions) {
      for (const h of hosts) {
        try {
          const crumb = activeSession?.crumb ? `&crumb=${encodeURIComponent(activeSession.crumb)}` : "";
          const cacheBust = `&_=${Date.now()}-${attempt}`;
          const url = `https://${h}/v8/finance/chart/${encodeURIComponent(c.y)}?range=${YEARS}y&interval=1d&events=history${crumb}${cacheBust}`;
          const headers = { "User-Agent": UA, Accept: "application/json", "Cache-Control": "no-cache" };
          if (activeSession?.cookie) headers.Cookie = activeSession.cookie;
          const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
          if (!res.ok) throw new Error("HTTP " + res.status);
          const j = await res.json();
          const r = j?.chart?.result?.[0];
          if (!r?.timestamp) throw new Error("no result");
          const closes = r.indicators?.quote?.[0]?.close || [];
          const adjusted = r.indicators?.adjclose?.[0]?.adjclose || [];
          const points = normalizePoints(r.timestamp.map((t, i) => ({
            d: new Date(t * 1000).toISOString().slice(0, 10),
            p: typeof adjusted[i] === "number" ? adjusted[i] : closes[i],
          })));
          if (points.length >= 2) return points;
        } catch { /* 다음 호스트·세션·백오프 재시도 */ }
      }
    }
    if (attempt < 3) await sleep(800 * (2 ** attempt));
  }
  return null;
}

// Chart v8의 IP별 순간 제한과 별도로 동작하는 Yahoo Spark 공개 경로
// 일본 종목처럼 Yahoo 의존도가 높은 시장의 최신 거래일 복구에 사용한다.
async function fromYahooSpark(c) {
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
      try {
        const url = `https://${host}/v7/finance/spark?symbols=${encodeURIComponent(c.y)}&range=${YEARS}y&interval=1d&_=${Date.now()}-${attempt}`;
        const res = await fetch(url, {
          headers: { "User-Agent": UA, Accept: "application/json", "Cache-Control": "no-cache" },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const response = (await res.json())?.spark?.result?.[0]?.response?.[0];
        if (!response?.timestamp) throw new Error("no result");
        const closes = response.indicators?.quote?.[0]?.close || [];
        const adjusted = response.indicators?.adjclose?.[0]?.adjclose || [];
        const points = normalizePoints(response.timestamp.map((t, i) => ({
          d: new Date(t * 1000).toISOString().slice(0, 10),
          p: typeof adjusted[i] === "number" ? adjusted[i] : closes[i],
        })));
        if (points.length >= 2) return points;
      } catch { /* 다음 호스트·재시도 */ }
    }
    if (attempt < 2) await sleep(900 * (2 ** attempt));
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

async function fromNaverKorea(c) {
  if (c.market !== "KRX") return null;
  const symbol = String(c.y || c.t).split(".")[0];
  try {
    const res = await fetch(`https://fchart.stock.naver.com/sise.nhn?symbol=${symbol}&timeframe=day&count=2000&requestType=0`, {
      headers: { "User-Agent": UA, Accept: "application/xml,text/xml,*/*", Referer: "https://finance.naver.com/" },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const xml = await res.text();
    const cut = cutoffDate();
    const points = [...xml.matchAll(/<item\s+data="([^"]+)"/g)].map(match => {
      const cols = match[1].split("|");
      const ymd = cols[0] || "";
      const d = ymd.length === 8 ? `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}` : "";
      return { d, p: round2(Number(cols[4])) };
    }).filter(point => point.d && isFinite(point.p) && new Date(point.d) >= cut)
      .sort((a, b) => (a.d < b.d ? -1 : 1));
    return points.length >= 2 ? points : null;
  } catch {
    return null;
  }
}

const isChinaTicker = (c) => c.market === "SSE" || c.market === "SSE STAR" || c.market === "SZSE";
const chinaSymbol = (c) => String(c.y || c.t).split(".")[0];

// Eastmoney 전·후방 수정주가 일봉 — 상하이(1)·선전(0) 전용 5년 이력
async function fromEastMoney(c) {
  if (!isChinaTicker(c)) return null;
  const marketId = c.market === "SZSE" ? "0" : "1";
  const secid = `${marketId}.${chinaSymbol(c)}`;
  const params = new URLSearchParams({
    secid,
    klt: "101",
    fqt: "1",
    lmt: "2000",
    end: "20500101",
    fields1: "f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13",
    fields2: "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`https://push2his.eastmoney.com/api/qt/stock/kline/get?${params}`, {
        headers: { "User-Agent": UA, Accept: "application/json", Referer: "https://quote.eastmoney.com/" },
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const rows = (await res.json())?.data?.klines || [];
      const cut = cutoffDate();
      const points = rows.map(row => {
        const cols = String(row).split(",");
        return { d: cols[0], p: round2(Number(cols[2])) };
      }).filter(point => point.d && isFinite(point.p) && new Date(point.d) >= cut);
      if (points.length >= 2) return points;
    } catch {
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 650));
    }
  }
  return null;
}

// Sina 일봉은 Eastmoney가 일시 차단될 때 사용하는 중국 A주 보조 피드
async function fromSinaChina(c) {
  if (!isChinaTicker(c)) return null;
  const prefix = c.market === "SZSE" ? "sz" : "sh";
  const url = `https://quotes.sina.cn/cn/api/jsonp_v2.php/var%20stockHistory=/CN_MarketDataService.getKLineData?symbol=${prefix}${chinaSymbol(c)}&scale=240&ma=no&datalen=1600`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/javascript,*/*", Referer: "https://finance.sina.com.cn/" },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const body = await res.text();
    const start = body.indexOf("([");
    const end = body.lastIndexOf("])");
    if (start < 0 || end <= start) return null;
    const rows = JSON.parse(body.slice(start + 1, end + 1));
    const cut = cutoffDate();
    const points = rows.map(row => ({ d: row.day, p: round2(Number(row.close)) }))
      .filter(point => point.d && isFinite(point.p) && new Date(point.d) >= cut)
      .sort((a, b) => (a.d < b.d ? -1 : 1));
    return points.length >= 2 ? points : null;
  } catch {
    return null;
  }
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
  // 지역별 전용 피드를 먼저 사용해 한 공급자의 속도 제한이 전체를 막지 않게 함
  const yahooSources = c.market === "TSE"
    ? [
        ["yahoo-spark", () => fromYahooSpark(c)],
        ["yahoo-api", () => fromYahoo(c, sess)],
        ["yahoo-web", () => fromYahooWeb(c, sess)],
      ]
    : [
        ["yahoo-api", () => fromYahoo(c, sess)],
        ["yahoo-spark", () => fromYahooSpark(c)],
        ["yahoo-web", () => fromYahooWeb(c, sess)],
      ];
  const usSources = [
    ["nasdaq", () => fromNasdaq(c)],
    ...yahooSources,
    ["stooq", () => c.s ? fromStooq(c) : null],
    ["stockanalysis", () => fromStockAnalysis(c)],
    ["tradingview", async () => { const tv = await tvLastPrice(c); return tv ? [{ d: new Date().toISOString().slice(0, 10), p: tv }] : null; }],
  ];
  const sources = isChinaTicker(c)
    ? [
        ["eastmoney", () => fromEastMoney(c)],
        ["sina", () => fromSinaChina(c)],
        ...yahooSources,
      ]
    : c.market === "KRX"
      ? [["naver", () => fromNaverKorea(c)], ...yahooSources]
      : c.market
        ? yahooSources
        : usSources;
  let points = null, src = "";
  const tried = [];
  for (const [name, fn] of sources) {
    let got = null;
    try { got = normalizePoints(await fn()); } catch { got = null; }
    tried.push(`${name}:${got ? got.length : 0}`);
    if (got && got.length) { points = got; src = name; break; }
  }
  if (!points) { console.warn(`[stock:${c.t}] no data — tried ${tried.join(" ")}`); return null; }
  const last = points.at(-1);
  let marketCap = c.shares ? fmtCap(last.p * c.shares) : "";
  if (!marketCap && !c.market) { marketCap = await yahooMarketCap(c, sess); }   // 미국 종목의 shares 미상 → Yahoo 요약에서 시총 파싱
  console.log(`[stock:${c.t}] ${src}: ${points.length} days, last ${last.d} ${c.currency || "$"}${last.p}${marketCap ? ", cap " + marketCap : ""} (${tried.join(" ")})`);
  return [c.t, {
    ticker: c.t,
    asOf: last.d,
    currency: c.currency || "$",
    exchange: c.market || "",
    listedAt: c.listedAt || undefined,
    lastPrice: last.p,
    marketCap,
    source: src,
    points,
  }];
}

// 신규 크롤과 기존 데이터를 '날짜 합집합'으로 병합 — 데이터가 절대 과거로 후퇴하지 않게(단조 최신화).
// 같은 날짜는 신규 크롤 값을 우선. 마지막 포인트로 lastPrice/asOf/시총 재계산.
function mergeSeries(t, prevObj, freshObj) {
  const sharesOf = () => { const c = TICKERS.find(x => x.t === t); return c ? (c.shares || 0) : 0; };
  if (prevObj && freshObj) {
    const byDate = {};
    for (const p of (prevObj.points || [])) byDate[p.d] = p.p;
    for (const p of (freshObj.points || [])) byDate[p.d] = p.p;
    const cut = cutoffDate();
    const points = normalizePoints(Object.entries(byDate).map(([d, p]) => ({ d, p })))
      .filter(p => new Date(p.d) >= cut);              // 5년 범위로 제한(무한 증가 방지)
    const last = points[points.length - 1];
    const sh = sharesOf();
    const cap = sh ? fmtCap(last.p * sh) : (freshObj.marketCap || prevObj.marketCap || "");
    return { ...freshObj, points, asOf: last.d, lastPrice: last.p, marketCap: cap };
  }
  return freshObj || prevObj;
}

async function main() {
  const sess = await yahooSession();
  console.log(`Yahoo session: ${sess ? (sess.crumb ? "cookie+crumb" : "cookie only") : "none"}`);
  const results = [];
  const batchSize = 6;
  // Yahoo에만 의존하는 일본 종목을 먼저 수집한다. 미국 종목의 시가총액 보조
  // 요청이 누적된 뒤 호출하면 무료 엔드포인트의 순간 레이트리밋에 걸릴 수 있다.
  const crawlQueue = [...TICKERS].sort((a, b) => Number(b.market === "TSE") - Number(a.market === "TSE"));
  for (let i = 0; i < crawlQueue.length;) {
    // Eastmoney는 동시 다중 요청을 차단하므로 중국 A주는 순차 수집
    const activeBatchSize = crawlQueue[i].market ? 1 : batchSize;
    const batch = await Promise.all(crawlQueue.slice(i, i + activeBatchSize).map((c) => crawlOne(c, sess)));
    results.push(...batch.filter(Boolean));
    i += activeBatchSize;
    if (i < crawlQueue.length) await sleep(activeBatchSize === 1 ? 450 : 300);
  }
  // 첫 패스의 순간 제한은 새 세션 없이 한 번 더 복구한다. 기존 데이터로 조용히
  // 후퇴하기 전에 실제 최신 거래일을 다시 확인하기 위한 마지막 안전망이다.
  const collected = new Set(results.map(([ticker]) => ticker));
  const retryTargets = TICKERS.filter(c => !collected.has(c.t));
  if (retryTargets.length) {
    await sleep(2500);
    for (const c of retryTargets) {
      const recovered = await crawlOne(c, null);
      if (recovered) results.push(recovered);
      await sleep(900);
    }
  }
  const fresh = Object.fromEntries(results);
  if (!results.length) throw new Error("All stock data providers failed; keeping the previous bundle unchanged.");

  let prev = {};
  try { prev = JSON.parse(await readFile("stocks.json", "utf8")).stocks || {}; } catch {}

  // 현재 설정된 종목만 보존해 삭제된 테스트·시나리오 종목이 DB에 잔존하지 않게 함
  const tickers = new Set(TICKERS.map(c => c.t));
  const final = {};
  for (const t of tickers) {
    const merged = mergeSeries(t, prev[t], fresh[t]);
    if (merged) final[t] = merged;
  }

  const sourceHealth = {
    targetCount: TICKERS.length,
    freshCount: results.length,
    failedTickers: TICKERS.map(c => c.t).filter(t => !fresh[t]),
    sources: Object.values(fresh).reduce((acc, row) => {
      acc[row.source || "unknown"] = (acc[row.source || "unknown"] || 0) + 1;
      return acc;
    }, {}),
  };
  await writeFile("stocks.json", JSON.stringify({ generatedAt: new Date().toISOString(), sourceHealth, stocks: final }) + "\n");
  const dates = Object.entries(final).map(([t, v]) => `${t}:${v.asOf}`).join(" ");
  console.log(`Wrote stocks.json (${Object.keys(final).length} tickers, merged·monotonic) — ${dates}`);
}

export { fromYahoo, fromYahooSpark, normalizePoints };

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
