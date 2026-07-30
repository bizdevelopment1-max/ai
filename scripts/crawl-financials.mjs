#!/usr/bin/env node
/* ============================================================
   crawl-financials.mjs — 상장 기업 개요·실적 크롤러(키 없음)
   목적: 기업 개요의 변동성 큰 항목을 '실제 최신 정보'로 자동 채움 —
         할루시네이션(하드코딩 추정치) 대신 출처(Yahoo Finance)에서 크롤.
   소스: Yahoo Finance quoteSummary v10 (cookie+crumb 세션 — crawl-stocks와 동일)
     · assetProfile               → 경영진(CEO)·본사(도시/州/국가)·섹터·임직원 수
     · incomeStatementHistoryQuarterly → 최신 분기 매출·순이익·분기말
     · institutionOwnership       → 주요 기관 주주 Top3(지분율)
   병합: 단조 최신화 — 새 크롤 실패 시 직전 값 보존(분기·공시 주기로만 변동).
   출력: financials.json { generatedAt, financials: { [ticker]: {...} } }
   ============================================================ */
import { writeFile, readFile } from "node:fs/promises";
import { isExcludedText } from "./news-policy.mjs";

// 크롤 대상 상장 티커(기업 탭에 매핑되는 상장사) — 조인 키일 뿐 데이터가 아님
const TICKERS = [
  "NVDA", "MSFT", "AMZN", "AAPL", "GOOGL", "META",
  "ORCL", "AMD", "AVGO", "TSM", "MU", "QCOM", "ARM", "INTC",
  "PLTR", "NOW", "CRWV", "APLD",
];
const COMPANY_QUERY = {
  NVDA: "Nvidia", MSFT: "Microsoft", AMZN: "Amazon company", AAPL: "Apple Inc.",
  GOOGL: "Alphabet Inc.", META: "Meta Platforms", ORCL: "Oracle Corporation",
  AMD: "Advanced Micro Devices", AVGO: "Broadcom Inc.", TSM: "TSMC",
  MU: "Micron Technology", QCOM: "Qualcomm", ARM: "Arm Holdings", INTC: "Intel",
  PLTR: "Palantir Technologies", NOW: "ServiceNow", CRWV: "CoreWeave",
  APLD: "Applied Digital",
};

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

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
const clean = (s) => {
  const t = String(s || "").trim();
  return t && !isExcludedText(t) ? t : "";     // 금지어 포함 값은 버림
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
  const modules = "assetProfile,incomeStatementHistoryQuarterly,institutionOwnership";
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

async function wikidataHeadcount(ticker) {
  try {
    const search = new URL("https://www.wikidata.org/w/api.php");
    search.searchParams.set("action", "wbsearchentities");
    search.searchParams.set("search", COMPANY_QUERY[ticker] || ticker);
    search.searchParams.set("language", "en");
    search.searchParams.set("limit", "5");
    search.searchParams.set("format", "json");
    search.searchParams.set("origin", "*");
    const found = await fetch(search, { headers: { "User-Agent": `${UA} AI-Strategy-Research/1.0` }, signal: AbortSignal.timeout(12_000) });
    if (!found.ok) return null;
    const matches = (await found.json()).search || [];
    const entity = matches.find(item => /company|corporation|technology|semiconductor|cloud computing/i.test(item.description || ""))
      || matches[0];
    if (!entity?.id) return null;
    const details = new URL("https://www.wikidata.org/w/api.php");
    details.searchParams.set("action", "wbgetentities");
    details.searchParams.set("ids", entity.id);
    details.searchParams.set("props", "claims");
    details.searchParams.set("format", "json");
    details.searchParams.set("origin", "*");
    const response = await fetch(details, { headers: { "User-Agent": `${UA} AI-Strategy-Research/1.0` }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return null;
    const claims = (await response.json()).entities?.[entity.id]?.claims?.P1128 || [];
    const rows = claims.map(claim => {
      const amount = Number(claim?.mainsnak?.datavalue?.value?.amount);
      const rawTime = claim?.qualifiers?.P585?.[0]?.datavalue?.value?.time || "";
      const asOf = rawTime.replace(/^\+/, "").slice(0, 10).replace(/-00/g, "-01");
      return { amount, asOf, rank: claim.rank || "normal" };
    }).filter(row => Number.isFinite(row.amount) && row.amount > 0);
    rows.sort((a, b) => (b.rank === "preferred") - (a.rank === "preferred")
      || String(b.asOf).localeCompare(String(a.asOf)));
    const latest = rows[0];
    if (!latest) return null;
    return {
      employees: fmtEmp(latest.amount),
      employeesAsOf: latest.asOf,
      employeesSource: `Wikidata ${entity.id}`,
      employeesSourceUrl: `https://www.wikidata.org/wiki/${entity.id}`,
    };
  } catch {
    return null;
  }
}

const COUNTRY_KO = { "United States": "미국", "Taiwan": "대만", "South Korea": "대한민국", "Netherlands": "네덜란드", "United Kingdom": "영국", "China": "중국" };

function extract(ticker, r) {
  if (!r) return null;
  const out = { ticker };
  const ap = r.assetProfile || {};

  // 경영진(CEO) — companyOfficers 중 CEO/대표 직함
  const officers = Array.isArray(ap.companyOfficers) ? ap.companyOfficers : [];
  const ceoOfficer = officers.find((o) => /chief executive|(^|\W)ceo(\W|$)/i.test(String(o.title || "")))
    || officers.find((o) => /chair.*ceo|founder.*ceo/i.test(String(o.title || "")));
  const ceo = clean(ceoOfficer && ceoOfficer.name);
  if (ceo) out.ceo = ceo;

  // 리더십(조직도) — 상위 임원 이름·직함(공개기업은 공시 기반으로 자동 갱신)
  const roster = officers
    .map(o => ({ name: clean(o.name), title: clean(o.title) }))
    .filter(o => o.name && o.title)
    .slice(0, 12);
  if (roster.length) out.officers = roster;

  // 본사(도시 · 州 · 국가)
  const loc = [ap.city, ap.state, COUNTRY_KO[ap.country] || ap.country].map((x) => clean(x)).filter(Boolean);
  if (loc.length) out.hq = loc.join(" · ");

  const sector = clean(ap.sector || ap.industry);
  if (sector) out.sector = sector;

  if (ap.fullTimeEmployees != null) { const e = fmtEmp(ap.fullTimeEmployees); if (e) out.employees = e; }

  // 최신 분기 실적
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

  // 주요 기관 주주 Top3(지분율)
  const own = r.institutionOwnership && r.institutionOwnership.ownershipList;
  if (Array.isArray(own) && own.length) {
    const top = own.slice(0, 3).map((o) => {
      const org = clean(o.organization);
      const pct = o.pctHeld && typeof o.pctHeld.raw === "number" ? `${(o.pctHeld.raw * 100).toFixed(1)}%` : "";
      return org ? `${org} ${pct}`.trim() : "";
    }).filter(Boolean);
    if (top.length) out.topHolders = top.join(" · ");
  }

  const has = out.ceo || out.hq || out.employees || out.revenueQ || out.topHolders || (out.officers && out.officers.length);
  if (!has) return null;
  out.asOf = new Date().toISOString().slice(0, 10);
  return out;
}

async function main() {
  let prev = {};
  try { prev = JSON.parse(await readFile("financials.json", "utf8")).financials || {}; } catch {}

  const sess = await yahooSession();
  const financials = { ...prev };
  let fresh = 0, yahooFresh = 0, wikidataFallback = 0, failed = 0;

  for (const ticker of TICKERS) {
    const r = await fetchQuoteSummary(ticker, sess);
    const yahooRecord = extract(ticker, r);
    let rec = yahooRecord;
    if (!rec?.employees) {
      const fallback = await wikidataHeadcount(ticker);
      if (fallback) {
        rec = { ...(rec || { ticker }), ...fallback, asOf: rec?.asOf || new Date().toISOString().slice(0, 10) };
        wikidataFallback++;
      }
    }
    if (rec) {
      financials[ticker] = { ...prev[ticker], ...rec };
      fresh++;
      if (yahooRecord) yahooFresh++;
    }
    else { failed++; }                       // 실패 시 직전 값 보존(단조 최신화)
    await new Promise((res) => setTimeout(res, 250));
  }

  const out = {
    generatedAt: new Date().toISOString(),
    sourceHealth: {
      targetCount: TICKERS.length,
      freshCount: fresh,
      yahooFreshCount: yahooFresh,
      wikidataHeadcountFallbackCount: wikidataFallback,
      failed,
      sources: ["yahoo-quotesummary", "wikidata-P1128"],
    },
    financials,
  };
  await writeFile("financials.json", JSON.stringify(out) + "\n");
  console.log(`Wrote financials.json — ${Object.keys(financials).length} tickers (${fresh} fresh, ${failed} preserved)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
