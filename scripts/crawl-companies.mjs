#!/usr/bin/env node
/* ============================================================
   crawl-companies.mjs — 기업 탭 라이브 데이터 생성기
   입력: news.json + stocks.json  →  출력: companies.json

   기업(뉴스 co 필드 기준)별로:
   - mentions7 / mentions30: 최근 7·30일 언급 기사 수(주목도)
   - latest: 최신 기사 {title, url, date, source}
   - cap / capAsof: 상장사는 stocks.json 실시세 시총 연동
   하드코딩 없음 — 전부 크롤 산출물에서 유도. 매일 실행.

   스타트업 분석(startups.json)의 업체도 같은 깊이(mentions·핵심활동·경영진 발언)로
   자동 편입 — 밸류체인 기업과 스타트업의 표시 레벨을 통일. co 필드 태깅 없이도
   기사 제목·요약 전문에서 업체명을 단어경계로 스캔(전문 매칭)해 라이브 레코드 생성.

   경영진 발언(execMentions) 대상 인물은 data.js COMPANY_ORG에서 자동 파생 —
   별도 하드코딩 목록을 유지하지 않는다. org 큐레이션에 인물을 추가하면 다음
   실행부터 자동으로 경영진 발언 스캔 대상이 된다(단일 소스 원칙).
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";
import { loadDash } from "./load-dash.mjs";
import { articleFocusedOnCompany, executiveTier } from "./company-sources.mjs";
import { loadSuppressionRegistry } from "./suppression-registry.mjs";
import { bulletizeKorean } from "./korean-copy.mjs";

const MAX_EXECUTIVES = 12;

// 기업명 → 상장 티커(시총 연동용 매핑 — 데이터가 아니라 조인 키)
const TICKER_OF = {
  "NVIDIA": "NVDA", "Microsoft": "MSFT", "Amazon": "AMZN", "Apple": "AAPL",
  "Google DeepMind": "GOOGL", "Meta AI": "META", "SpaceX (xAI, Cursor)": "SPCX",
  "SK hynix": "SKHY", "Oracle": "ORCL", "AMD": "AMD", "Broadcom": "AVGO",
  "TSMC": "TSM", "Micron": "MU", "CoreWeave": "CRWV", "Applied Digital": "APLD",
};

const days = d => { const t = new Date(String(d) + "T00:00:00Z").getTime(); return isNaN(t) ? 999 : (Date.now() - t) / 86400000; };

// Core Practices — 기업이 '무엇에 집중하는가'를 크롤 기사에서 규칙 기반으로 분류(뉴스 누적으로 자동 갱신).
const PRACTICE = [
  { id: "model", ko: "모델·연구", re: /\bmodel\b|research|reasoning|추론|벤치마크|benchmark|frontier|foundation|파운데이션|GPT|Claude|Gemini|Llama|Grok|multimodal|멀티모달|학습|training/i },
  { id: "product", ko: "제품·서비스 출시", re: /launch|release|출시|unveil|공개|feature|기능|preview|\bapp\b|앱|product|GA\b|rollout|업데이트|update/i },
  { id: "partner", ko: "파트너십·생태계", re: /partner|협력|integration|통합|생태계|ecosystem|deal|계약|adopt|채택|customer|고객|enterprise|기업 고객/i },
  { id: "infra", ko: "인프라·컴퓨트", re: /data ?center|데이터센터|\bGPU\b|\bchip\b|칩|compute|컴퓨트|cloud|클라우드|capex|infrastructure|인프라|서버|server|electricity|전력/i },
  { id: "capital", ko: "자본·M&A", re: /funding|raise|조달|invest|투자|acqui|인수|valuation|밸류|IPO|상장|revenue|매출|financ|equity|지분/i },
  { id: "safety", ko: "안전·규제", re: /safety|안전|regulat|규제|policy|정책|govern|거버넌스|lawsuit|소송|copyright|저작권|privacy|프라이버시|보안|security/i },
  { id: "talent", ko: "인재·조직", re: /\bhire\b|채용|talent|인재|\bCEO\b|executive|경영진|leadership|리더십|founder|창업|layoff|감원|조직/i },
];
// 단어경계 정규식(오탐 방지) — alias가 알파벳으로 시작/끝나면 \b 부착.
const boundWord = s => {
  const esc = String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const l = /^[A-Za-z0-9]/.test(s) ? "\\b" : "";
  const r = /[A-Za-z0-9]$/.test(s) ? "\\b" : "";
  return `${l}${esc}${r}`;
};
// 경영진 발언 스캔 대상 인물을 COMPANY_ORG에서 자동 파생 — 성만 단독 매칭은 같은
// 성이 다른 회사에도 있으면(예: 흔한 성) 오탐 위험이 있어, 전 회사 통틀어 유일한
// 성일 때만 보조 별칭으로 추가. 결합 표기("A · B")는 개별 인물로 분리.
function deriveLeaders(org) {
  const people = [];
  for (const [co, o] of Object.entries(org || {})) {
    const roster = Array.isArray(o.executiveTeam) && o.executiveTeam.length ? o.executiveTeam : o.leadership || [];
    for (const entry of roster) {
      for (const full of String(entry.name || "").split("·").map(s => s.trim()).filter(Boolean)) {
        const tokens = full.split(/\s+/).filter(Boolean);
        const last = tokens.length > 1 ? tokens[tokens.length - 1] : "";
        people.push({ co, full, last, role: entry.role || entry.title || "" });
      }
    }
  }
  const lastFreq = new Map();
  for (const p of people) if (p.last) lastFreq.set(p.last, (lastFreq.get(p.last) || 0) + 1);
  const byCo = {};
  for (const p of people) {
    const aliases = [p.full];
    if (p.last && p.last.length >= 4 && lastFreq.get(p.last) === 1) aliases.push(p.last);
    const re = new RegExp(aliases.map(boundWord).join("|"), "i");
    (byCo[p.co] = byCo[p.co] || []).push({ full: p.full, role: p.role, re });
  }
  return byCo;
}
const sourceBackedArticle = article => article?.displayEligible !== false
  && article?.summaryMode === "source-content-extractive"
  && article?.provenance?.status === "source-backed"
  && /^https?:\/\//.test(String(article?.url || ""));
const canonicalUrl = value => {
  try {
    const url = new URL(String(value || ""));
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(key => url.searchParams.delete(key));
    return url.href.replace(/[?&]$/, "").replace(/\/+$/, "");
  } catch {
    return String(value || "").replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
};
const normalizedQuote = value => String(value || "").normalize("NFKC").toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, "");
const localizedTitle = article => article?.titleKo || article?.localization?.title || "";
const alignedQuoteTranslation = (article, quote) => {
  const en = article?.summaryLinesEn || article?.localization?.sourceLines || [];
  const ko = article?.summaryLinesKo || article?.localization?.summaryLines || [];
  if (!Array.isArray(en) || !Array.isArray(ko) || !ko.length) return "";
  const target = normalizedQuote(quote);
  const index = en.findIndex(line => {
    const candidate = normalizedQuote(line);
    return target.length >= 24 && candidate.length >= 24
      && (candidate.includes(target) || target.includes(candidate));
  });
  return index >= 0 && ko[index] ? bulletizeKorean(ko[index]) : "";
};
const peopleFromTeam = team => (team || []).map(person => {
  const full = String(person?.name || "").trim();
  return full ? {
    full,
    role: person.role || person.title || "",
    re: new RegExp(boundWord(full), "i"),
  } : null;
}).filter(Boolean);
const execMentions = (co, arts, leaders) => {
  const people = Array.isArray(leaders) ? leaders : leaders[co];
  if (!people || !people.length) return [];
  const seen = new Set();
  const rows = [];
  for (const a of arts) {
    if (!a.title || !a.url || seen.has(a.url) || !sourceBackedArticle(a)) continue;
    // A leader name alone is not company evidence. Require the company in the
    // title/lede as well, preventing cross-company executive false positives.
    if (!articleFocusedOnCompany(co, a)) continue;
    const hay = `${a.title} ${a.descEn || ""} ${a.summary || ""}`;
    const hit = people.find(p => p.re.test(hay));
    if (!hit) continue;
    seen.add(a.url);
    const ko = a.titleKo || (a.localization && (a.localization.title
      || (Array.isArray(a.localization.summaryLines) && a.localization.summaryLines[0]))) || "";
    rows.push({
      who: hit.full,
      role: hit.role || "",
      titleEn: a.titleEn || a.title,
      titleKo: ko,
      date: a.date,
      url: a.url,
      source: a.source || "",
      evidenceType: "publisher-page-extractive",
    });
  }
  return rows.sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 6);
};
const executiveQuotes = (co, arts, people) => {
  if (!people?.length) return [];
  const rows = [];
  const seen = new Set();
  for (const article of arts) {
    if (!sourceBackedArticle(article) || !articleFocusedOnCompany(co, article)) continue;
    const paragraphs = Array.isArray(article?.sourceContent?.paragraphs) ? article.sourceContent.paragraphs.slice(0, 36) : [];
    for (const rawParagraph of paragraphs) {
      const paragraph = String(rawParagraph || "");
      const quotes = [...paragraph.matchAll(/[“"]([^"”]{24,420})[”"]/g)];
      const speakerHits = people.map(person => {
        const match = paragraph.match(person.re);
        return match ? { person, index: match.index, length: match[0].length } : null;
      }).filter(Boolean);
      if (!quotes.length || !speakerHits.length) continue;
      for (const speakerHit of speakerHits) {
        const nearest = quotes.map(match => {
          const start = match.index;
          const end = start + match[0].length;
          const speakerStart = speakerHit.index;
          const speakerEnd = speakerStart + speakerHit.length;
          const distance = speakerEnd < start ? start - speakerEnd : end < speakerStart ? speakerStart - end : 0;
          return { match, distance };
        }).sort((left, right) => left.distance - right.distance)[0];
        if (!nearest || nearest.distance > 220) continue;
        const speaker = speakerHit.person;
        const quoteOriginal = String(nearest.match[1] || "").trim();
        const key = `${speaker.full}|${normalizedQuote(quoteOriginal)}`;
        if (!quoteOriginal || seen.has(key)) continue;
        const quoteKo = alignedQuoteTranslation(article, quoteOriginal);
        if (!quoteKo) continue;
        seen.add(key);
        rows.push({
          speaker: speaker.full,
          role: speaker.role || "",
          quoteOriginal,
          quoteKo,
          evidenceUrl: article.url,
          source: article.source || "",
          date: article.date || "",
          evidenceType: "direct-quote+aligned-korean-source-summary",
        });
      }
    }
  }
  return rows.sort((left, right) => String(right.date || "").localeCompare(String(left.date || ""))).slice(0, 6);
};
const mergeVerifiedRows = (current, previous, keyOf, limit = 6) => {
  const seen = new Set();
  return [...(current || []), ...(previous || [])].filter(item => {
    if (!/^https?:\/\//.test(String(item?.url || item?.evidenceUrl || ""))) return false;
    const key = keyOf(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => String(right.date || "").localeCompare(String(left.date || ""))).slice(0, limit);
};
const buildExecutiveFeed = (co, arts, executiveTeam, organization, previous, checkedAt) => {
  const people = peopleFromTeam(executiveTeam);
  const retained = previous?.schemaVersion === 2 ? previous : null;
  const mentions = mergeVerifiedRows(
    execMentions(co, arts, people),
    retained?.mentions,
    item => `${canonicalUrl(item.url)}|${item.who}`,
  );
  const quotes = mergeVerifiedRows(
    executiveQuotes(co, arts, people),
    retained?.quotes,
    item => `${item.speaker}|${normalizedQuote(item.quoteOriginal)}`,
  ).filter(item => item.quoteKo && item.quoteOriginal);
  const sourceUrls = [...new Set((organization?.officialPages || [])
    .filter(page => page.status === "reachable")
    .map(page => page.resolvedUrl || page.url)
    .filter(url => /^https?:\/\//.test(String(url || ""))))].slice(0, 6);
  return {
    schemaVersion: 2,
    methodology: "executive-name+company-focus+nearest-speaker-direct-quote+korean-source-alignment",
    checkedAt,
    leadersTracked: people.length,
    sourceUrls,
    quotes,
    mentions,
  };
};
const classifyPractices = (arts) => {
  const recent = arts.filter(a => days(a.date) <= 60);
  const src = recent.length >= 3 ? recent : arts.slice(0, 12);   // 최근 60일 우선, 부족하면 최신 12건
  const buckets = PRACTICE.map(p => {
    const hits = src.filter(a => p.re.test(`${a.title || ""} ${a.descEn || ""} ${a.summary || ""} ${a.tag || ""}`));
    if (!hits.length) return null;
    hits.sort((x, y) => (x.date < y.date ? 1 : -1));
    const l = hits[0];
    return { id: p.id, ko: p.ko, count: hits.length, latest: { title: l.title, url: l.url, date: l.date } };
  }).filter(Boolean).sort((a, b) => b.count - a.count);
  return buckets;
};

async function main() {
  const suppression = await loadSuppressionRegistry();
  let articles = [], stocks = {}, financials = {}, previousCompanies = {}, officialCompanies = {}, startupRows = [];
  let startupRegistry = { trackedReferences: [] };
  try {
    articles = (JSON.parse(await readFile("news.json", "utf8")).articles || [])
      .filter(article => !suppression.matches(article, "article"));
  } catch {}
  try { stocks = JSON.parse(await readFile("stocks.json", "utf8")).stocks || {}; } catch {}
  try { financials = JSON.parse(await readFile("financials.json", "utf8")).financials || {}; } catch {}
  try { previousCompanies = JSON.parse(await readFile("companies.json", "utf8")).companies || {}; } catch {}
  try { officialCompanies = JSON.parse(await readFile("company-officials.json", "utf8")).companies || {}; } catch {}
  try {
    const startups = JSON.parse(await readFile("startups.json", "utf8"));
    startupRows = [...(startups.large || []), ...(startups.small || []), ...(startups.institutional || [])]
      .filter(startup => !suppression.hasCompany(startup.name));
    startupRegistry = startups.companyRegistry || startupRegistry;
  } catch {}
  const dash = loadDash();
  const orgSource = { ...(dash.COMPANY_ORG || {}) };
  for (const startup of startupRows) {
    if (!startup?.name || !startup.organization) continue;
    const curated = orgSource[startup.name] || {};
    orgSource[startup.name] = {
      ...startup.organization,
      ...curated,
      leadership: curated.leadership || startup.organization.executiveTeam || startup.organization.leadership || [],
    };
  }
  const linkedinSource = dash.LINKEDIN_PROFILES || {};
  const profileSource = dash.COMPANY_PROFILES || {};
  const trackedCompanies = (dash.COMPANIES || []).filter(company => !suppression.hasCompany(company.name));
  const leaders = deriveLeaders(orgSource);
  // 기업 개요의 변동 항목을 크롤 값으로 붙임(crawl-financials.mjs — 공시·분기 주기로 자동 최신화)
  const joinFin = (rec, tk) => {
    const f = tk && financials[tk];
    if (!f) return;
    if (f.ceo) rec.ceo = f.ceo;
    if (f.hq) rec.hq = f.hq;
    if (f.sector) rec.sector = f.sector;
    if (f.topHolders) rec.topHolders = f.topHolders;
    if (Array.isArray(f.officers) && f.officers.length) rec.officers = f.officers;
    if (f.revenueQ) { rec.revenueQ = f.revenueQ; rec.quarterEnd = f.quarterEnd || ""; }
    if (f.netIncomeQ) rec.netIncomeQ = f.netIncomeQ;
    if (f.employees) {
      rec.employees = f.employees;
      rec.employeesAsof = f.employeesAsOf || f.asOf || "";
      rec.employeesSource = f.employeesSource || "Yahoo Finance";
      rec.employeesSourceUrl = f.employeesSourceUrl || "";
      rec.employeesStale = false;
    } else if (f.employeesStale) {
      delete rec.employees;
      rec.employeesLastReported = f.employeesLastReported || "";
      rec.employeesAsof = f.employeesAsOf || "";
      rec.employeesSource = f.employeesSource || "";
      rec.employeesSourceUrl = f.employeesSourceUrl || "";
      rec.employeesStale = true;
    }
  };

  const byCo = {};
  for (const a of articles) {
    const co = (a.co || "").trim();
    if (!co || !articleFocusedOnCompany(co, a)) continue;
    (byCo[co] = byCo[co] || []).push(a);
  }

  const companies = {};
  for (const [co, arts] of Object.entries(byCo)) {
    arts.sort((x, y) => (x.date < y.date ? 1 : -1));
    const latest = arts[0];
    companies[co] = {
      mentions7: arts.filter(a => days(a.date) <= 7).length,
      mentions30: arts.filter(a => days(a.date) <= 30).length,
      latest: { title: latest.title, url: latest.url, date: latest.date, source: latest.source },
      practices: classifyPractices(arts),
      execNews: execMentions(co, articles, leaders),
    };
    const tk = TICKER_OF[co];
    if (tk && stocks[tk] && stocks[tk].marketCap) {
      companies[co].cap = stocks[tk].marketCap;
      companies[co].capAsof = stocks[tk].asOf;
      companies[co].ticker = tk;
    }
    joinFin(companies[co], tk);
  }
  // 뉴스 co에 없는 상장사도 시총·실적은 제공(티커 역방향)
  for (const [co, tk] of Object.entries(TICKER_OF)) {
    if (!companies[co] && stocks[tk] && stocks[tk].marketCap) {
      companies[co] = { mentions7: 0, mentions30: 0, latest: null, cap: stocks[tk].marketCap, capAsof: stocks[tk].asOf, ticker: tk };
      joinFin(companies[co], tk);
    }
  }

  // 스타트업(startups.json)도 같은 라이브 깊이로 편입 — co 태깅 없이 기사 전문에서
  // 업체명을 단어경계 스캔. 밸류체인 기업과 표시 레벨을 통일하는 핵심 로직.
  const startupNames = [...new Set(startupRows.map(s => s.name).filter(Boolean))];
  for (const name of startupNames) {
    if (companies[name]) continue;             // 이미 co 태깅으로 커버된 업체는 유지
    const rx = new RegExp(boundWord(name), "i");
    const arts = articles.filter(a => a.url && a.title
      && rx.test(`${a.title} ${a.descEn || ""} ${a.summary || ""}`)
      && articleFocusedOnCompany(name, a));
    arts.sort((x, y) => (x.date < y.date ? 1 : -1));
    const latest = arts[0];
    companies[name] = {
      mentions7: arts.filter(a => days(a.date) <= 7).length,
      mentions30: arts.filter(a => days(a.date) <= 30).length,
      latest: latest ? { title: latest.title, url: latest.url, date: latest.date, source: latest.source } : null,
      practices: classifyPractices(arts),
      execNews: execMentions(name, articles, leaders),
    };
  }

  // 모든 추적 기업을 동일 스키마로 정규화한다. 뉴스가 없는 기업도 개요·조직·
  // 데이터 커버리지 상태가 companies.json에 남아 화면 깊이가 들쭉날쭉해지지 않는다.
  // 상장사는 Yahoo Finance 변동 항목이 우선이고, 비상장사는 정적 기준정보 +
  // 매일 누적되는 뉴스·경영진 발언으로 변화 신호를 보완한다.
  const nowIso = new Date().toISOString();
  const pct = (present, total) => Math.round((present / Math.max(total, 1)) * 100);
  const personKey = name => String(name || "").split("(")[0].split("·")[0]
    .replace(/[^\p{L}\p{N}\s.'-]/gu, "").trim();
  const directLinkedIn = value => /^https:\/\/(?:(?:www|[a-z]{2,3})\.)?linkedin\.com\/in\/[A-Za-z0-9._%-]+\/?$/i.test(String(value || ""))
    ? String(value) : "";
  const withDirectLinkedIn = person => {
    if (!person) return person;
    const mapped = directLinkedIn(linkedinSource[person.name] || linkedinSource[personKey(person.name)]);
    const sourceVerified = /^(official-role-match|official-page-name-match|knowledge-graph-domain-match)$/.test(person.verification || "");
    const embedded = sourceVerified ? directLinkedIn(person.li) : "";
    const li = mapped || embedded;
    const normalized = { ...person };
    if (!li) {
      delete normalized.li;
      delete normalized.linkedinVerification;
      return normalized;
    }
    normalized.li = li;
    normalized.linkedinVerification = mapped
      ? "curated-direct-profile"
      : person.linkedinVerification || (person.verification === "knowledge-graph-domain-match"
        ? "wikidata-property-direct-profile" : "official-jsonld-direct-profile");
    return normalized;
  };
  const companyBaseByName = new Map(trackedCompanies.map(base => [base.name, base]));
  const startupReferenceByName = new Map((startupRegistry.trackedReferences || [])
    .map(reference => [reference.name, reference]));
  for (const startup of startupRows) {
    if (!startup?.name) continue;
    const tracked = companyBaseByName.get(startup.name);
    companyBaseByName.set(startup.name, tracked ? { ...startup, ...tracked } : startup);
  }
  for (const base of companyBaseByName.values()) {
    const name = base.name;
    let rec = companies[name];
    if (!rec) {
      const simple = String(name).replace(/\s*\(.*\)\s*$/, "").trim();
      const rx = simple ? new RegExp(boundWord(simple), "i") : null;
      const arts = rx ? articles.filter(a => a.url && a.title
        && rx.test(`${a.title} ${a.descEn || ""} ${a.summary || ""}`)
        && articleFocusedOnCompany(name, a)) : [];
      arts.sort((x, y) => (x.date < y.date ? 1 : -1));
      const latest = arts[0];
      rec = companies[name] = {
        mentions7: arts.filter(a => days(a.date) <= 7).length,
        mentions30: arts.filter(a => days(a.date) <= 30).length,
        latest: latest ? { title: latest.title, url: latest.url, date: latest.date, source: latest.source } : null,
        practices: classifyPractices(arts),
        execNews: execMentions(name, articles, leaders),
      };
      const tk = TICKER_OF[name];
      if (tk && stocks[tk] && stocks[tk].marketCap) {
        rec.cap = stocks[tk].marketCap;
        rec.capAsof = stocks[tk].asOf;
        rec.ticker = tk;
      }
      joinFin(rec, tk);
    }

    const p = { ...(base.profile || {}), ...(profileSource[name] || {}) };
    const o = orgSource[name] || {};
    const normalizedProfile = {
      ...p,
      ceo: rec.ceo || p.ceo || "",
      hq: rec.hq || p.hq || "",
      headcount: rec.employeesStale ? "" : (rec.employees || p.headcount || ""),
      business: Array.isArray(p.business) && p.business.length ? p.business
        : [base.currentBusiness, base.businessModel, base.overview, base.description, base.unit].filter(Boolean).slice(0, 5),
    };
    const official = officialCompanies[name] || {};
    const verificationByName = new Map((official.verifiedExecutives || []).map(person => [personKey(person.name).toLowerCase(), person]));
    const sourceLeadership = Array.isArray(o.executiveTeam) && o.executiveTeam.length ? o.executiveTeam : o.leadership;
    const curatedLeadership = Array.isArray(sourceLeadership) ? sourceLeadership.slice(0, MAX_EXECUTIVES).map(withDirectLinkedIn) : [];
    const liveOfficers = Array.isArray(rec.officers) ? rec.officers.slice(0, MAX_EXECUTIVES).map(withDirectLinkedIn) : [];
    const curatedByName = new Map(curatedLeadership.map(person => [personKey(person.name).toLowerCase(), person]));
    const executiveSeen = new Set();
    const executiveTeam = [];
    for (const person of [...liveOfficers, ...curatedLeadership]) {
      const key = personKey(person.name).toLowerCase();
      if (!key || executiveSeen.has(key)) continue;
      executiveSeen.add(key);
      const curated = curatedByName.get(key) || {};
      const verification = verificationByName.get(key) || {};
      const role = person.role || person.title || curated.role || "Executive";
      executiveTeam.push({
        ...curated,
        ...person,
        role,
        tier: executiveTier(role),
        sourceType: liveOfficers.some(item => personKey(item.name).toLowerCase() === key)
          ? "market-filing" : person.sourceType || curated.sourceType || "curated-leadership",
        roleSourceType: liveOfficers.some(item => personKey(item.name).toLowerCase() === key)
          ? "market-filing" : person.roleSourceType || curated.roleSourceType || "",
        verification: verification.status || person.verification || curated.verification || "unverified",
        verificationUrl: verification.sourceUrl || person.verificationUrl || curated.verificationUrl || "",
        verifiedAt: verification.checkedAt || person.verifiedAt || curated.verifiedAt || "",
      });
    }
    const executivePriority = person => ({
      "founder-board": 0,
      ceo: 1,
      "product-technology": 2,
      "corporate-functions": 3,
      "executive-team": 4,
    }[executiveTier(person.role)] ?? 9);
    executiveTeam.sort((left, right) => executivePriority(left) - executivePriority(right));
    executiveTeam.splice(MAX_EXECUTIVES);
    const normalizedOrg = {
      ...o,
      leadership: curatedLeadership,
      officers: liveOfficers,
      executiveTeam,
      officialPages: (official.officialPages || []).length ? official.officialPages : o.officialPages || [],
      sourceMode: liveOfficers.length ? "live-officers+curated-background+official-verification"
        : o.sourceMode || "curated+official-verification+news-monitoring",
    };
    const feedTeam = executiveTeam.length ? executiveTeam
      : normalizedProfile.ceo ? [{ name: normalizedProfile.ceo, role: "CEO" }] : [];
    const executiveFeed = buildExecutiveFeed(
      name,
      articles,
      feedTeam,
      normalizedOrg,
      previousCompanies[name]?.executiveFeed,
      nowIso,
    );
    rec.execNews = executiveFeed.mentions;
    rec.executiveFeed = executiveFeed;
    const profileChecks = [
      normalizedProfile.legalName || normalizedProfile.operator || name,
      normalizedProfile.founded, normalizedProfile.ceo, normalizedProfile.hq,
      normalizedProfile.headcount, normalizedProfile.business.length, normalizedProfile.officialWebsite,
      normalizedProfile.shareholders || rec.topHolders,
    ];
    const verifiedCount = executiveTeam.filter(person =>
      person.verification === "official-role-match"
      || person.verification === "knowledge-graph-domain-match"
      || person.sourceType === "market-filing").length;
    const orgChecks = [
      normalizedOrg.mission,
      executiveTeam.length >= 3,
      verifiedCount >= 1,
      executiveFeed.mentions.length || executiveFeed.quotes.length || executiveFeed.sourceUrls.length,
    ];
    const profilePresent = profileChecks.filter(Boolean).length;
    const orgPresent = orgChecks.filter(Boolean).length;
    rec.profile = normalizedProfile;
    rec.organization = normalizedOrg;
    rec.coverage = {
      profile: { present: profilePresent, total: profileChecks.length, score: pct(profilePresent, profileChecks.length) },
      organization: {
        present: orgPresent,
        total: orgChecks.length,
        score: pct(orgPresent, orgChecks.length),
        executiveCount: executiveTeam.length,
        verifiedExecutiveCount: verifiedCount,
        directLinkedInCount: executiveTeam.filter(person => directLinkedIn(person.li) && person.linkedinVerification).length,
        officialSourceStatus: official.sourceStatus || base.coverage?.organization?.officialSourceStatus || "not-configured",
      },
      sourceMode: rec.ticker ? "market-filing+curated+news"
        : base.coverage?.sourceMode || "official-domain+structured-knowledge-graph+news",
      checkedAt: base.coverage?.checkedAt || nowIso,
    };
    const portfolioReference = startupReferenceByName.get(name);
    if (portfolioReference) rec.portfolioReference = portfolioReference;
    rec.updatedAt = nowIso;
  }

  // Only canonical tracked and startup-universe names survive the company
  // ledger.  News aliases may create temporary buckets, but never a second
  // company record or a second card.
  const allowedCompanyNames = new Set(companyBaseByName.keys());
  for (const name of Object.keys(companies)) {
    if (!allowedCompanyNames.has(name)) delete companies[name];
  }

  // 기업전략 종합은 별도 단계(build-company-intelligence.mjs)에서 생성한다.
  // 하루 여러 차례 회사·실적 원장을 갱신해도 마지막 근거 기반 AI 분석을 먼저
  // 보존해 불필요한 모델 호출과 일시적인 분석 품질 하락을 막는다.
  for (const [name, rec] of Object.entries(companies)) {
    const previous = previousCompanies[name];
    if (previous?.intelligence) rec.intelligence = previous.intelligence;
    if (Array.isArray(previous?.strategicVentures)) rec.strategicVentures = previous.strategicVentures;
    if (previous?.strategicVentureComparison) rec.strategicVentureComparison = previous.strategicVentureComparison;
  }

  const out = {
    generatedAt: nowIso,
    schemaVersion: 5,
    methodology: "canonical-company-registry+normalized-profile+live-financials+official-executive-verification+focused-news-evidence+company-intelligence-ready",
    companyRegistry: {
      method: startupRegistry.method || "official-domain+operator-legal-name",
      uniqueCompanies: Object.keys(companies).length,
      trackedCompanies: trackedCompanies.length,
      startupCompanies: startupRows.length,
      aliasesDiscarded: Object.keys(previousCompanies).length > Object.keys(companies).length
        ? Object.keys(previousCompanies).length - Object.keys(companies).length : 0,
    },
    companies,
  };
  await writeFile("companies.json", JSON.stringify(out) + "\n");
  console.log(`Wrote companies.json — ${Object.keys(companies).length} companies (live mentions + market caps)`);
}

main().catch(e => { console.error(e); process.exit(1); });
