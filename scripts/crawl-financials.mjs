#!/usr/bin/env node
/* ============================================================
   crawl-financials.mjs — 상장 기업 최신 실적·인력 크롤러(키 없음)
   목적: 기업 개요의 '경영 실적(분기 매출·순이익)'과 '인력(임직원 수)'을
         실적 발표 주기에 맞춰 자동 최신화. 시가총액은 crawl-stocks.mjs 담당.
   소스: Yahoo Finance quoteSummary v10 (cookie+crumb 세션 — crawl-stocks와 동일 방식)
     · incomeStatementHistoryQuarterly → 최신 분기 매출·순이익·분기말
     · assetProfile → 임직원 수(fullTimeEmployees)
   병합: 단조 최신화 — 새 크롤이 실패하면 직전 값 보존(실적은 분기마다만 바뀜).
   출력: financials.json { generatedAt, financials: { [ticker]: {...} } }
   ============================================================ */
import { writeFile, readFile } from "node:fs/promises";

// 크롤 대상 상장 티커(기업 탭에 매핑되는 상장사) — 조인 키일 뿐 데이터가 아님
const TICKERS = [
  "NVDA", "MSFT", "AMZN", "AAPL", "GOOGL", "META",
  "ORCL", "AMD", "AVGO", "TSM", "MU", "QCOM", "ARM", "INTC",
  "PLTR", "NOW", "CRWV", "APLD",
];

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// $ 금액 포맷(달러 원값 → $X.XXT / $XXX.XB / $XXXM)
const fmtUsd = (raw) => {
  const n = Number(raw);
  if (!isFinite(n) || n === 0) return "";
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${Math.round(n / 1e6)}M`;
  return `$${Math.round(n)}`;
};
const fmtEmp = (n) => {
  const v = Number(n);
  if (!isFinite(v) || v <= 0) return "";
  if (v >= 10000) return `${(v / 10000).toFixed(1)}만명`;
  return `${v.toLocaleString("en-US")}명`;
};

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

async function fetchQuoteSummary(ticker, sess) {
  const modules = "incomeStatementHistoryQuarterly,assetProfile";
  for (const h of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const q = sess && sess.crumb ? `&crumb=${encodeURIComponent(sess.crumb)}` : "";
      const url = `https://${h}/v10/finance/quoteSummary/${ticker}?modules=${modules}${q}`;
      const headers = { "User-Agent": UA, Accept: "application/json" };
      if (sess && sess.cookie) headers.Cookie = sess.cookie;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const j = await res.json();
      const r = j && j.quoteSummary && j.quoteSummary.result && j.quoteSummary.result[0];
      if (!r) throw new Error("no result");
      return r;
    } catch { /* next host */ }
  }
  return null;
}

function extract(ticker, r) {
  if (!r) return null;
  const out = { ticker };
  const q = r.incomeStatementHistoryQuarterly && r.incomeStatementHistoryQuarterly.incomeStatementHistory;
  const latest = Array.isArray(q) ? q[0] : null;
  if (latest) {
    const rev = latest.totalRevenue && (latest.totalRevenue.raw ?? null);
    const ni = latest.netIncome && (latest.netIncome.raw ?? null);
    const end = latest.endDate && (latest.endDate.fmt || null);
    if (rev != null) out.revenueQ = fmtUsd(rev);
    if (ni != null) out.netIncomeQ = fmtUsd(ni);
    if (end) out.quarterEnd = end;
  }
  const emp = r.assetProfile && r.assetProfile.fullTimeEmployees;
  if (emp != null) out.employees = fmtEmp(emp);
  // 매출/인력 어느 것도 못 얻으면 무의미
  if (!out.revenueQ && !out.employees) return null;
  out.asOf = new Date().toISOString().slice(0, 10);
  return out;
}

async function main() {
  let prev = {};
  try { prev = JSON.parse(await readFile("financials.json", "utf8")).financials || {}; } catch {}

  const sess = await yahooSession();
  const financials = { ...prev };
  let fresh = 0, failed = 0;

  for (const ticker of TICKERS) {
    const r = await fetchQuoteSummary(ticker, sess);
    const rec = extract(ticker, r);
    if (rec) { financials[ticker] = { ...prev[ticker], ...rec }; fresh++; }
    else { failed++; }                       // 실패 시 직전 값 보존(단조 최신화)
    await new Promise((res) => setTimeout(res, 250));   // 레이트리밋 배려
  }

  const out = {
    generatedAt: new Date().toISOString(),
    sourceHealth: { targetCount: TICKERS.length, freshCount: fresh, failed },
    financials,
  };
  await writeFile("financials.json", JSON.stringify(out) + "\n");
  console.log(`Wrote financials.json — ${Object.keys(financials).length} tickers (${fresh} fresh, ${failed} preserved)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
