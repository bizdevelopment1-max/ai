#!/usr/bin/env node
/**
 * Converts crawled publisher-page evidence into company-level business
 * intelligence. The model is asked to synthesise only the supplied evidence
 * IDs. If model inference is unavailable, the site receives an extractive
 * source-linked summary rather than generic portfolio labels.
 */
import { readFile, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadDash } from "./load-dash.mjs";
import { llmJSON, llmAvailable } from "./llm.mjs";
import { aliasesFor, articleFocusScore, articleFocusedOnCompany, companyRegex, COMPANY_SOURCES } from "./company-sources.mjs";

const readJson = async (file, fallback) => {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; }
};
const clean = value => String(value || "").replace(/\s+/g, " ").trim();
const first = (...values) => values.map(clean).find(Boolean) || "";
const claimKey = value => clean(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const claimTokens = value => new Set(clean(value).toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ").split(" ").filter(token => token.length >= 2));
const claimSimilarity = (left, right) => {
  const a = claimTokens(left);
  const b = claimTokens(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap++;
  return overlap / Math.min(a.size, b.size);
};
const nearDuplicateClaim = (left, right) => {
  const a = claimKey(left);
  const b = claimKey(right);
  if (!a || !b) return false;
  return a === b || (Math.min(a.length, b.length) >= 24 && (a.includes(b) || b.includes(a)))
    || claimSimilarity(left, right) >= 0.82;
};
const clip = (value, size = 280) => {
  const text = clean(value);
  return text.length > size ? `${text.slice(0, size - 1)}…` : text;
};
const canon = value => {
  try {
    const url = new URL(String(value || ""));
    url.hash = "";
    url.search = "";
    return url.href.replace(/\/+$/, "");
  } catch { return String(value || "").replace(/[?#].*$/, "").replace(/\/+$/, ""); }
};
const sourceBacked = article => article?.displayEligible !== false
  && article?.summaryMode === "source-content-extractive"
  && article?.provenance?.status === "source-backed"
  && /^https?:\/\//.test(String(article?.url || ""));
const localizedTitle = article => first(article?.titleKo, article?.localization?.title, article?.titleEn, article?.title);
const localizedLines = article => {
  const lines = article?.summaryLinesKo || article?.localization?.summaryLines || article?.summaryLinesEn || [];
  return Array.isArray(lines) ? lines.map(clean).filter(Boolean) : [];
};
const englishLines = article => {
  const lines = article?.summaryLinesEn || String(article?.summary || "").split("\n");
  return Array.isArray(lines) ? lines.map(clean).filter(Boolean) : [];
};

const quoteCandidates = (article, leaders) => {
  const paragraphs = article?.sourceContent?.paragraphs || [];
  const rows = [];
  for (const paragraph of paragraphs.slice(0, 28)) {
    const hits = [...String(paragraph).matchAll(/[“"]([^"”]{24,420})[”"]/g)];
    for (const hit of hits) {
      const speaker = (leaders || []).find(person => clean(paragraph).toLowerCase().includes(clean(person.name).toLowerCase()));
      if (!speaker) continue;
      rows.push({
        speaker: speaker.name,
        role: speaker.role || "",
        quoteOriginal: clean(hit[1]),
        evidenceUrl: article.url,
        source: article.source || "",
        date: article.date || "",
      });
    }
  }
  return rows.slice(0, 3);
};

const evidenceFor = (name, allArticles, leaders) => {
  const seen = new Set();
  const combined = allArticles
    .filter(article => sourceBacked(article) && articleFocusedOnCompany(name, article))
    .filter(article => {
      const key = canon(article.url);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))
      || articleFocusScore(name, b) - articleFocusScore(name, a))
    .slice(0, 8);
  return combined.map((article, index) => ({
    id: `e${index + 1}`,
    date: article.date || "",
    source: article.source || "",
    url: article.url,
    titleKo: clip(localizedTitle(article), 180),
    titleOriginal: clip(article.titleEn || article.title, 180),
    linesKo: localizedLines(article).slice(0, 3).map(line => clip(line, 260)),
    linesOriginal: englishLines(article).slice(0, 3).map(line => clip(line, 260)),
    quotes: quoteCandidates(article, leaders),
  }));
};
const officialEvidenceFor = rec => (rec.organization?.officialPages || [])
  .filter(page => page.category === "official-update"
    && page.status === "reachable"
    && /^https?:\/\//.test(page.resolvedUrl || page.url)
    && clean(page.pageTitle)
    && !/just a moment|access denied|attention required/i.test(page.pageTitle))
  .map(page => ({
    date: page.date || String(page.checkedAt || "").slice(0, 10),
    source: "Official company update",
    url: page.resolvedUrl || page.url,
    titleKo: clip(page.titleKo || page.pageTitle, 180),
    titleOriginal: clip(page.pageTitle, 180),
    linesKo: [clip(page.summaryKo, 260)].filter(Boolean),
    linesOriginal: [clip(page.description, 260)].filter(Boolean),
    quotes: [],
    sourceTier: "official",
  }));
const mergeEvidence = (...groups) => {
  const seen = new Set();
  return groups.flat()
    .filter(item => {
      const key = canon(item.url);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))
      || (b.sourceTier === "official") - (a.sourceTier === "official"))
    .slice(0, 8)
    .map((item, index) => ({ ...item, id: `e${index + 1}` }));
};

const evidenceRefs = (ids, evidence) => {
  const wanted = new Set(Array.isArray(ids) ? ids.map(String) : []);
  return evidence.filter(item => wanted.has(item.id))
    .map(item => ({ title: item.titleKo || item.titleOriginal, source: item.source, date: item.date, url: item.url }));
};
const allRefs = evidence => evidence.slice(0, 3)
  .map(item => ({ title: item.titleKo || item.titleOriginal, source: item.source, date: item.date, url: item.url }));
const negativeAction = /jailbreak|escaped? (?:its )?training|hack(?:ed|ing)?|attack(?:ed|ing)?|incident|wayward|rogue|compromis|sabotage|backlash|ditching|drops?\b|abandons?|switches? from|replaces?|lawsuit|settlement|sued?\b|security flaw|data breach/i;
const strategicAction = /launch|introduc|expand|partner|acquir|invest|build|deploy|release|open(?:ed|ing)?|available|enter(?:ed|ing)?|announc|develop|fund|raise|appoint|restructur|approval|approved|publish/i;
const isCompanyActionEvidence = item => {
  const text = clean(`${item?.titleOriginal || ""} ${(item?.linesOriginal || []).join(" ")}`);
  return strategicAction.test(text) && !negativeAction.test(text);
};
const isCompanyActionEvidenceFor = (name, item) => {
  if (!isCompanyActionEvidence(item)) return false;
  const title = clean(item?.titleOriginal || item?.titleKo);
  const match = companyRegex(name)?.exec(title);
  if (!match) return false;
  const prefix = title.slice(0, match.index);
  return !(/\b(?:without|competitor|rival|beats?|versus|vs\.?)\b/i.test(prefix)
    || /takes? (?:aim at|on)/i.test(prefix));
};
const officialHostsFor = name => (COMPANY_SOURCES[name]?.official || []).map(url => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}).filter(Boolean);
const officialCompanyUrl = (name, url) => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return officialHostsFor(name).some(official => host === official || host.endsWith(`.${official}`));
  } catch { return false; }
};

const signalFocusedOnCompany = (name, signal, articleByUrl, kind) => {
  const linked = articleByUrl.get(canon(signal?.url));
  const text = clean(signal?.signal);
  const re = companyRegex(name);
  let titleMatched = false;
  if (linked) {
    const title = clean(linked.titleEn || linked.title);
    // Monetization and strategic ledgers require the company in the headline;
    // a comparison in the body is context, not evidence of the company's move.
    titleMatched = !!re?.test(title);
    if (!titleMatched || !articleFocusedOnCompany(name, linked)) return false;
  }
  const match = re?.exec(text);
  if (!match && !titleMatched) return false;
  const prefix = match ? text.slice(0, match.index) : "";
  if (match && (/\b(?:without|competitor|rival|beats?|versus|vs\.?)\b/i.test(prefix)
    || /takes? (?:aim at|on)/i.test(prefix))) return false;
  if (kind === "revenue") {
    if (!officialCompanyUrl(name, signal?.url)) return false;
    if (/settlement|eligible to receive|supported devices?|depend(?:s|ed)? on hardware|compatib/i.test(text)) return false;
    const revenueLanguage = /price|pricing|subscription|paying|revenue|\bARR\b|sales|sold|contract|licen[cs]e|usage (?:fee|credit|limit)|per (?:month|year)|purchase|orders?|shipment|margin|billing|monetiz|\bfee\b|\bseat\b|enterprise (?:plan|contract|license)|cloud (?:contract|revenue)/i;
    if (!revenueLanguage.test(text)) return false;
  } else {
    if (negativeAction.test(text)) return false;
    if (!strategicAction.test(text)) return false;
  }
  return titleMatched || match.index <= 120 || aliasesFor(name).some(alias => text.toLowerCase().startsWith(alias.toLowerCase()));
};

const sanitiseMonetization = (name, monet, articleByUrl) => {
  if (!monet) return null;
  const monetize = (monet.monetize || []).filter(signal => signalFocusedOnCompany(name, signal, articleByUrl, "revenue"));
  const direction = (monet.direction || []).filter(signal => signalFocusedOnCompany(name, signal, articleByUrl, "direction"));
  return { ...monet, monetize, direction };
};

const numericTokens = value => (clean(value).match(/(?:[$€£₩]\s*)?(?:[A-Za-z][A-Za-z.-]*[- ]?)?\d[\d,.]*(?:\s*[%억조만배명건]|[TBMK])?/gi) || [])
  .map(token => token.replace(/\s+/g, "").replace(/,/g, "").toLowerCase());
const speculative = value => /가능성|예상(?:된다|되는|한)|전망(?:된다|되는|한)|할 것으로|적용될 수|추정(?:된다|되는|한)/.test(clean(value));
const evidenceFingerprint = evidence => createHash("sha256")
  .update(evidence.map(item => `${canon(item.url)}|${item.date}`).join("\n"))
  .digest("hex").slice(0, 16);
const analysisCorpus = ({ base, rec, monet, evidence }) => clean(JSON.stringify({
  profile: rec.profile,
  officialPages: rec.organization?.officialPages,
  monetization: monet,
  evidence,
}));
const supportedNumbers = (value, corpus) => numericTokens(value)
  .every(token => corpus.toLowerCase().replace(/,/g, "").includes(token));
const refKey = ref => canon(ref?.url);
const placeholderCopy = value => /(?:수집|확인|분석|업데이트|준비)\s*중|입력되지|신호\s*(?:없음|대기)|근거\s*매칭\s*대기|표시할\s+.+없|정보\s*없음/i.test(clean(value));
const blankSection = () => ({ summary: "", details: [], evidence: [] });
const safeFallback = (fallback, corpus) => {
  const out = { ...fallback };
  for (const key of ["currentBusiness", "revenueModel", "strategyDirection", "investmentDirection"]) {
    const value = fallback[key] || blankSection();
    const body = `${value.summary || ""} ${(value.details || []).join(" ")}`;
    if (!placeholderCopy(body) && supportedNumbers(body, corpus)) continue;
    out[key] = blankSection();
  }
  return out;
};

// Sparse refreshes retain the last pipeline-verified section instead of
// replacing it with operational status copy. Numeric claims must still occur
// in the current source corpus.
const retainLastVerified = (next, previous, corpus) => {
  const out = { ...next };
  for (const key of ["currentBusiness", "revenueModel", "strategyDirection", "investmentDirection"]) {
    if (clean(out[key]?.summary)) continue;
    const prior = previous?.[key];
    const body = `${prior?.summary || ""} ${(prior?.details || []).join(" ")}`;
    const refs = (prior?.evidence || []).filter(ref => /^https?:\/\//.test(String(ref?.url || "")));
    const grounded = /grounded|checked/i.test(String(prior?.groundingStatus || previous?.groundingStatus || ""));
    if (!clean(prior?.summary) || placeholderCopy(body) || !supportedNumbers(body, corpus) || (!grounded && !refs.length)) continue;
    out[key] = { ...prior, evidence: refs, retainedSnapshot: true };
  }
  return out;
};

const finaliseIntelligence = (value, { name, evidence, fallback, corpus }) => {
  const allowedUrls = new Set([
    ...evidence.map(item => canon(item.url)),
    ...["currentBusiness", "revenueModel", "strategyDirection", "investmentDirection"]
      .flatMap(key => (fallback[key]?.evidence || []).map(refKey)),
  ].filter(Boolean));
  const sectionKeys = ["currentBusiness", "revenueModel", "strategyDirection", "investmentDirection"];
  const seenDetails = new Set();
  const seenClaims = [];
  const seenEvidenceUrls = new Set();
  const out = { ...value };
  for (const key of sectionKeys) {
    const fallbackSection = fallback[key] || blankSection();
    const candidate = out[key] || fallbackSection;
    const refs = (candidate.evidence || []).filter(ref => allowedUrls.has(refKey(ref)));
    const body = `${candidate.summary || ""} ${(candidate.details || []).join(" ")}`;
    const unsupported = placeholderCopy(body)
      || !supportedNumbers(body, corpus)
      || ((key === "strategyDirection" || key === "investmentDirection") && speculative(body) && refs.length === 0)
      || (candidate.evidence || []).some(ref => !allowedUrls.has(refKey(ref)));
    let chosen = unsupported ? fallbackSection : { ...candidate, evidence: refs };
    if (seenClaims.some(previous => nearDuplicateClaim(previous, chosen.summary))) {
      const alternative = [fallbackSection.summary, ...(chosen.details || []), ...(fallbackSection.details || [])]
        .map(clean).find(text => text && !seenClaims.some(previous => nearDuplicateClaim(previous, text)));
      chosen = alternative ? { ...chosen, summary: alternative } : blankSection();
    }
    const summary = clean(chosen.summary);
    if (summary) seenClaims.push(summary);
    const details = (chosen.details || []).filter(detail => {
      const fingerprint = clean(detail).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
      if (!fingerprint || seenDetails.has(fingerprint)
        || seenClaims.some(previous => nearDuplicateClaim(previous, detail))) return false;
      seenDetails.add(fingerprint);
      seenClaims.push(detail);
      return true;
    });
    const uniqueEvidence = (chosen.evidence || []).filter(ref => {
      const url = refKey(ref);
      if (!url || seenEvidenceUrls.has(url)) return false;
      seenEvidenceUrls.add(url);
      return true;
    });
    const evidenceCount = uniqueEvidence.length;
    out[key] = {
      ...chosen,
      summary,
      details,
      evidence: uniqueEvidence,
      evidenceCount,
      confidence: evidenceCount >= 2 ? "high" : evidenceCount === 1 ? "medium" : "low",
      groundingStatus: unsupported ? "fallback-after-grounding-check"
        : evidenceCount ? "source-grounded" : "profile-grounded",
    };
  }
  const evidenceByUrl = new Map(evidence.map(item => [canon(item.url), item]));
  const occupied = new Set(sectionKeys.flatMap(key => [
    out[key]?.summary,
    ...(out[key]?.details || []),
  ]).map(value => clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")).filter(Boolean));
  out.corePractices = (out.corePractices || []).filter(item => {
    if (!item.evidence?.url || !allowedUrls.has(refKey(item.evidence))) return false;
    const source = evidenceByUrl.get(refKey(item.evidence));
    const fingerprint = clean(item.title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    return source && isCompanyActionEvidenceFor(name, source) && !occupied.has(fingerprint);
  }).slice(0, 4);
  out.newBusinessModels = (out.newBusinessModels || []).filter(item =>
    item.evidence?.url && allowedUrls.has(refKey(item.evidence))
    && supportedNumbers(`${item.title} ${item.model} ${item.implication}`, corpus)).slice(0, 3);
  out.executiveQuotes = (out.executiveQuotes || []).filter(item =>
    item.evidenceUrl && allowedUrls.has(canon(item.evidenceUrl))).slice(0, 4);
  out.meceFramework = [
    { key: "currentBusiness", label: "사업 범위", question: "무엇을 제공하는가" },
    { key: "revenueModel", label: "수익 엔진", question: "어떻게 돈을 버는가" },
    { key: "strategyDirection", label: "성장 방향", question: "어디로 확장하는가" },
    { key: "investmentDirection", label: "자본 배분", question: "무엇에 투자하는가" },
  ];
  out.evidenceFingerprint = evidenceFingerprint(evidence);
  out.groundingStatus = "numeric-and-source-reference-checked";
  return out;
};

const normaliseAnalysis = (analysis, evidence, fallback, corpus) => {
  const section = (value, base) => {
    const refs = evidenceRefs(value?.evidenceIds, evidence);
    // Model-authored copy is publishable only when it cites supplied evidence.
    // Missing/invalid evidence IDs fall back to the existing source-bound
    // extract rather than borrowing unrelated fallback links.
    const useModel = clean(value?.summary) && refs.length > 0;
    return {
      summary: clip(useModel ? value.summary : base.summary, 360),
      details: (useModel && Array.isArray(value?.details) ? value.details : base.details || [])
        .map(item => clip(item, 220)).filter(Boolean).slice(0, 4),
      evidence: useModel ? refs : base.evidence,
    };
  };
  const quoteIndex = new Map(evidence.flatMap(item => (item.quotes || []).map(quote => [`${item.id}|${quote.speaker}|${quote.quoteOriginal}`, { ...quote, evidenceId: item.id }])));
  const executiveQuotes = (analysis?.executiveQuotes || []).map(item => {
    const match = [...quoteIndex.values()].find(candidate => candidate.evidenceId === item.evidenceId
      && clean(candidate.quoteOriginal) === clean(item.quoteOriginal));
    if (!match || !clean(item.quoteKo)) return null;
    return { ...match, quoteKo: clip(item.quoteKo, 520) };
  }).filter(Boolean).slice(0, 4);
  const corePractices = (analysis?.corePractices || []).map(item => {
    const ref = evidence.find(source => source.id === item.evidenceId);
    if (!ref || !clean(item.title)) return null;
    return {
      title: clip(item.title, 100),
      insight: clip(item.insight, 300),
      evidence: { title: ref.titleKo || ref.titleOriginal, source: ref.source, date: ref.date, url: ref.url },
    };
  }).filter(Boolean).slice(0, 4);
  const newBusinessModels = (analysis?.newBusinessModels || []).map(item => {
    const ref = evidence.find(source => source.id === item.evidenceId);
    if (!ref || !clean(item.title)) return null;
    return {
      title: clip(item.title, 120),
      model: clip(item.model, 300),
      implication: clip(item.implication, 300),
      evidence: { title: ref.titleKo || ref.titleOriginal, source: ref.source, date: ref.date, url: ref.url },
    };
  }).filter(Boolean).slice(0, 3);
  return finaliseIntelligence({
    currentBusiness: section(analysis?.currentBusiness, fallback.currentBusiness),
    revenueModel: section(analysis?.revenueModel, fallback.revenueModel),
    strategyDirection: section(analysis?.strategyDirection, fallback.strategyDirection),
    investmentDirection: section(analysis?.investmentDirection, fallback.investmentDirection),
    corePractices: corePractices.length ? corePractices : fallback.corePractices,
    newBusinessModels: newBusinessModels.length ? newBusinessModels : fallback.newBusinessModels,
    executiveQuotes: executiveQuotes.length ? executiveQuotes : fallback.executiveQuotes,
  }, { name: analysis?.name || "", evidence, fallback, corpus });
};

const fallbackIntelligence = ({ base, rec, monet, evidence, modelLabels, directionLabels }) => {
  const profile = rec.profile || {};
  const revenueSignals = monet?.monetize || [];
  const directionSignals = monet?.direction || [];
  const primaryModel = modelLabels.get(monet?.primaryModel);
  const currentBusiness = (profile.business || []).join(" · ") || base?.unit || localizedTitle(rec.latest);
  const revenueEvidence = first(revenueSignals[0]?.signal);
  const revenueSummary = primaryModel
    ? [primaryModel, revenueEvidence].filter(Boolean).join(" 중심 · ")
    : revenueEvidence;
  const actionEvidence = evidence.find(item => isCompanyActionEvidenceFor(base?.name, item));
  const actionEvidenceRows = evidence.filter(item => isCompanyActionEvidenceFor(base?.name, item));
  const strategySummary = first(directionSignals[0]?.signal, actionEvidence?.titleKo, actionEvidence?.titleOriginal, base?.direction);
  const investSignal = directionSignals.find(signal => ["ma", "invest", "partner"].includes(signal.kind));
  const investmentSummary = investSignal
    ? `${directionLabels.get(investSignal.kind) || "사업 확장"} · ${clip(investSignal.signal, 220)}`
    : "";
  const official = (rec.organization?.officialPages || []).find(page => page.status === "reachable");
  const officialEvidence = official ? [{
    title: "공식 회사·리더십 페이지",
    source: "Official company page",
    date: String(official.checkedAt || "").slice(0, 10),
    url: official.resolvedUrl || official.url,
  }] : [];
  return {
    currentBusiness: { summary: clip(currentBusiness, 360), details: (profile.business || []).slice(0, 4), evidence: officialEvidence },
    revenueModel: {
      summary: clip(revenueSummary, 360),
      details: revenueSignals.slice(0, 3).map(signal => clip(signal.signal, 220)),
      evidence: revenueSignals.slice(0, 3).map(signal => ({ title: signal.signal, source: signal.source, date: signal.date, url: signal.url })),
    },
    strategyDirection: {
      summary: clip(strategySummary, 360),
      details: directionSignals.length
        ? directionSignals.slice(0, 3).map(signal => clip(signal.signal, 220))
        : actionEvidenceRows.slice(0, 3).map(item => item.titleKo || item.titleOriginal),
      evidence: directionSignals.length
        ? directionSignals.slice(0, 3).map(signal => ({ title: signal.signal, source: signal.source, date: signal.date, url: signal.url }))
        : actionEvidenceRows.slice(0, 3).map(item => ({ title: item.titleKo || item.titleOriginal, source: item.source, date: item.date, url: item.url })),
    },
    investmentDirection: {
      summary: clip(investmentSummary, 360),
      details: directionSignals.filter(signal => ["ma", "invest", "partner"].includes(signal.kind)).slice(0, 3).map(signal => clip(signal.signal, 220)),
      evidence: investSignal ? [{ title: investSignal.signal, source: investSignal.source, date: investSignal.date, url: investSignal.url }] : [],
    },
    corePractices: evidence.filter(item => isCompanyActionEvidenceFor(base?.name, item)).slice(0, 8).map(item => ({
      title: item.titleKo || item.titleOriginal,
      insight: item.linesKo[1] || item.linesKo[0] || item.linesOriginal[0] || item.titleKo,
      evidence: { title: item.titleKo || item.titleOriginal, source: item.source, date: item.date, url: item.url },
    })),
    newBusinessModels: revenueSignals.slice(0, 2).map(signal => ({
      title: modelLabels.get(signal.model) || "신규 수익화",
      model: clip(signal.signal, 300),
      implication: "제품·서비스·배포 방식의 변화가 반복 매출과 고객 접점을 확장하는지 추적",
      evidence: { title: signal.signal, source: signal.source, date: signal.date, url: signal.url },
    })),
    executiveQuotes: [],
  };
};

async function synthesizeBatch(inputs) {
  const schema = {
    type: "object",
    properties: {
      companies: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            currentBusiness: { type: "object", properties: { summary: { type: "string" }, details: { type: "array", items: { type: "string" } }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["summary", "details", "evidenceIds"], additionalProperties: false },
            revenueModel: { type: "object", properties: { summary: { type: "string" }, details: { type: "array", items: { type: "string" } }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["summary", "details", "evidenceIds"], additionalProperties: false },
            strategyDirection: { type: "object", properties: { summary: { type: "string" }, details: { type: "array", items: { type: "string" } }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["summary", "details", "evidenceIds"], additionalProperties: false },
            investmentDirection: { type: "object", properties: { summary: { type: "string" }, details: { type: "array", items: { type: "string" } }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["summary", "details", "evidenceIds"], additionalProperties: false },
            corePractices: { type: "array", items: { type: "object", properties: { title: { type: "string" }, insight: { type: "string" }, evidenceId: { type: "string" } }, required: ["title", "insight", "evidenceId"], additionalProperties: false } },
            newBusinessModels: { type: "array", items: { type: "object", properties: { title: { type: "string" }, model: { type: "string" }, implication: { type: "string" }, evidenceId: { type: "string" } }, required: ["title", "model", "implication", "evidenceId"], additionalProperties: false } },
            executiveQuotes: { type: "array", items: { type: "object", properties: { speaker: { type: "string" }, quoteOriginal: { type: "string" }, quoteKo: { type: "string" }, evidenceId: { type: "string" } }, required: ["speaker", "quoteOriginal", "quoteKo", "evidenceId"], additionalProperties: false } },
          },
          required: ["name", "currentBusiness", "revenueModel", "strategyDirection", "investmentDirection", "corePractices", "newBusinessModels", "executiveQuotes"],
          additionalProperties: false,
        },
      },
    },
    required: ["companies"],
    additionalProperties: false,
  };
  return llmJSON({
    system: [
      "당신은 통신·스마트폰 사업자를 위한 기업전략 애널리스트다.",
      "입력된 company profile, monetization signals, publisher evidence만 사용해 회사별 현재 사업, 수익모델, 향후 사업·투자 방향, 핵심 실행, 신규 비즈니스 모델을 한국어로 구체적으로 종합한다.",
      "MECE 원칙을 지킨다. currentBusiness는 제품·고객, revenueModel은 과금·매출원, strategyDirection은 회사가 발표하거나 실행한 확장, investmentDirection은 투자·인수·파트너 자본배분만 다룬다.",
      "같은 문장·사실·근거 ID를 여러 섹션에 반복하지 않는다. 어느 한 섹션에만 배치하고 다른 섹션은 고유 근거가 없으면 비운다.",
      "포트폴리오 옵션, 신호 감시, 우선순위 같은 일반론을 쓰지 않는다.",
      "근거가 없는 수치·인물·인과를 만들지 않는다. 각 판단은 입력 evidence id를 연결한다.",
      "근거가 부족한 선택 항목은 빈 문자열과 빈 배열로 반환한다. '수집 중', '확인 중', '대기', '데이터 없음' 같은 운영 상태 문구를 쓰지 않는다.",
      "executiveQuotes는 candidates에 있는 영문 원문을 단 한 글자도 바꾸지 말고 한국어 번역을 함께 제공한다. candidate가 없으면 빈 배열이다.",
      "문장은 짧은 컨설팅 보고서 문체로 쓴다.",
    ].join(" "),
    user: `다음 기업 묶음을 분석해 JSON으로 반환:\n${JSON.stringify(inputs)}`,
    maxTokens: 3_500,
    schema,
  });
}

async function main() {
  const [companyData, newsData, monetData, ventures] = await Promise.all([
    readJson("companies.json", { companies: {} }),
    readJson("news.json", { articles: [] }),
    readJson("monetization.json", { companies: [], models: [], directions: [] }),
    readJson("strategic-ventures.json", { companies: {} }),
  ]);
  const dash = loadDash();
  const bases = new Map((dash.COMPANIES || []).map(company => [company.name, company]));
  const monetByName = new Map((monetData.companies || []).map(company => [company.name, company]));
  const articleByUrl = new Map((newsData.articles || []).map(article => [canon(article.url), article]));
  const modelLabels = new Map((monetData.models || []).map(model => [model.id, model.ko]));
  const directionLabels = new Map((monetData.directions || []).map(direction => [direction.id, direction.ko]));
  const prepared = [];
  const engine = llmAvailable();
  const persistCompanyData = async () => {
    companyData.schemaVersion = 5;
    companyData.generatedAt = new Date().toISOString();
    companyData.methodology = "normalized-profile+live-financials+official-executive-verification+company-focused-publisher-evidence+grounded-ai-source-synthesis";
    const checkpoint = "companies.json.checkpoint";
    await writeFile(checkpoint, `${JSON.stringify(companyData)}\n`);
    await rename(checkpoint, "companies.json");
  };
  const maxAiAgeDays = Math.max(0.25, Number(process.env.COMPANY_INTELLIGENCE_MAX_AGE_DAYS || 0.8));
  const ageDays = value => {
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 86_400_000) : 999;
  };

  for (const [name, rec] of Object.entries(companyData.companies || {})) {
    const leaders = rec.organization?.leadership || [];
    const evidence = mergeEvidence(officialEvidenceFor(rec), evidenceFor(name, newsData.articles || [], leaders));
    const monet = sanitiseMonetization(name, monetByName.get(name) || null, articleByUrl);
    const fallbackRaw = fallbackIntelligence({
      base: bases.get(name),
      rec,
      monet,
      evidence,
      modelLabels,
      directionLabels,
    });
    const corpus = analysisCorpus({ base: bases.get(name), rec, monet, evidence });
    const fallback = retainLastVerified(
      safeFallback(fallbackRaw, corpus),
      rec.intelligence,
      corpus,
    );
    const groundedFallback = finaliseIntelligence(fallback, { name, evidence, fallback, corpus });
    const priorAiRaw = rec.intelligence?.engine?.startsWith("github-models:") ? rec.intelligence : null;
    const priorAi = priorAiRaw ? finaliseIntelligence(priorAiRaw, { name, evidence, fallback: groundedFallback, corpus }) : null;
    const currentFingerprint = evidenceFingerprint(evidence);
    const priorMatchesEvidence = priorAi?.evidenceFingerprint === currentFingerprint
      && priorAiRaw?.evidenceFingerprint === currentFingerprint;
    const refreshAi = !!engine && (!priorAi || !priorMatchesEvidence || ageDays(priorAi.generatedAt) >= maxAiAgeDays);
    rec.intelligence = priorMatchesEvidence ? priorAi : {
        generatedAt: new Date().toISOString(),
        engine: "source-extractive-synthesis",
        evidenceWindow: "제목·리드문에서 회사가 확인된 최신 원문 8건 + 누적 수익화·사업 방향 원장",
        ...groundedFallback,
      };
    rec.strategicVentures = ventures.companies?.[name] || [];
    if (rec.strategicVentures.length && ventures.comparison) rec.strategicVentureComparison = ventures.comparison;
    if (!refreshAi) continue;
    prepared.push({
      name,
      profile: {
        founded: rec.profile?.founded || "",
        headquarters: rec.profile?.hq || "",
        headcount: rec.profile?.headcount || rec.employees || "",
        business: rec.profile?.business || [],
      },
      leadership: leaders.slice(0, 10).map(person => ({
        name: person.name, role: person.role, education: person.edu || "", career: person.career || person.bg || "",
      })),
      monetization: {
        primaryModel: modelLabels.get(monet?.primaryModel) || "",
        revenueSignals: (monet?.monetize || []).slice(0, 4),
        directionSignals: (monet?.direction || []).slice(0, 4),
      },
      evidence,
      quoteCandidates: evidence.flatMap(item => item.quotes.map(quote => ({ ...quote, evidenceId: item.id }))).slice(0, 6),
      _rec: rec,
      _fallback: fallback,
      _corpus: corpus,
      _priorAi: priorAiRaw,
    });
  }

  if (engine) {
    // GitHub Models gpt-4.1 currently enforces an 8k request-body limit.
    // Evidence-heavy major companies can exceed it even in groups of three.
    // Analyse one company per request so all companies receive equal depth.
    // Bound each workflow run so rate limiting cannot block the full crawl.
    // Firms without a current model result go first, then the oldest result.
    const aiBudget = Math.max(1, Number(process.env.COMPANY_INTELLIGENCE_AI_BUDGET || 10));
    const modelQueue = prepared
      .sort((left, right) => {
        const leftHasPrior = !!left._priorAi;
        const rightHasPrior = !!right._priorAi;
        if (leftHasPrior !== rightHasPrior) return leftHasPrior ? 1 : -1;
        const leftAt = Date.parse(left._priorAi?.generatedAt || "") || 0;
        const rightAt = Date.parse(right._priorAi?.generatedAt || "") || 0;
        return leftAt - rightAt || left.name.localeCompare(right.name);
      })
      .slice(0, aiBudget);
    const batchSize = 1;
    for (let start = 0; start < modelQueue.length; start += batchSize) {
      const batch = modelQueue.slice(start, start + batchSize);
      const publicInput = batch.map(({ _rec, _fallback, _corpus, _priorAi, ...value }) => value);
      const result = await synthesizeBatch(publicInput);
      const byName = new Map((result?.data?.companies || []).map(company => [company.name, company]));
      for (const item of batch) {
        const analysis = byName.get(item.name);
        if (!analysis) continue;
        item._rec.intelligence = {
          generatedAt: new Date().toISOString(),
          engine: result.engine,
          evidenceWindow: "제목·리드문에서 회사가 확인된 최신 원문 8건 + 누적 수익화·사업 방향 원장",
          ...normaliseAnalysis(analysis, item.evidence, item._fallback, item._corpus),
        };
      }
      // The first schema-v5 run can refresh every company. Persist each batch
      // so a runner retry resumes from completed evidence fingerprints.
      await persistCompanyData();
      console.log(`[company-intelligence] batch ${Math.floor(start / batchSize) + 1}/${Math.ceil(modelQueue.length / batchSize)} · ${result ? result.engine : "extractive fallback"}`);
    }
  }

  await persistCompanyData();
  const aiCount = Object.values(companyData.companies || {}).filter(company => company.intelligence?.engine?.startsWith("github-models:")).length;
  const total = Object.keys(companyData.companies || {}).length;
  console.log(`[company-intelligence] wrote ${total} companies · AI ${aiCount} · extractive ${total - aiCount} · eligible ${prepared.length}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
