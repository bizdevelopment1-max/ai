#!/usr/bin/env node
/**
 * Build the source-driven Tech & Market Insights snapshot.
 *
 * Mutable facts never live in JSX or the taxonomy. Every visible signal keeps
 * its source URL, date and extract. The compact public snapshot is rebuilt on
 * every update, while newly observed source records are appended to a monthly
 * JSONL ledger for longitudinal analysis.
 */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { sanitizePublicCopy } from "./public-copy.mjs";
import { loadSuppressionRegistry } from "./suppression-registry.mjs";

const root = process.cwd();
const generatedAt = new Date().toISOString();
const month = generatedAt.slice(0, 7);
const readJson = async (file, fallback = {}) => {
  try { return JSON.parse(await readFile(resolve(root, file), "utf8")); }
  catch { return fallback; }
};
const clean = value => String(value ?? "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
const clip = (value, limit = 360) => clean(value).slice(0, limit);
const sha = value => createHash("sha256").update(String(value ?? "")).digest("hex");
const canonicalUrl = value => {
  try {
    const url = new URL(String(value || ""));
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) url.searchParams.delete(key);
    return url.toString().replace(/\/$/, "");
  } catch { return ""; }
};
const dateOf = article => clean(article?.pub || article?.publishedAt || article?.date || article?.collectedAt).slice(0, 10);
const textOf = article => clean([article?.title, article?.titleEn, article?.summary, article?.tag, article?.co, article?.source].filter(Boolean).join(" "));
const norm = value => clean(value).normalize("NFKC").toLocaleLowerCase();
const escapeRe = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const includesTerm = (text, term, complete = false) => {
  const normalizedTerm = norm(term);
  if (!normalizedTerm) return false;
  if (!complete) return norm(text).includes(normalizedTerm);
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(normalizedTerm)}(?=$|[^\\p{L}\\p{N}])`, "iu").test(norm(text));
};
const termHits = (text, terms = []) => terms.filter(term => includesTerm(text, term));
const firstExcerpt = article => {
  const lines = String(article?.summary || article?.sourceText || "").split(/\n+/).map(clean).filter(Boolean);
  return clip(lines[0] || article?.title || "", 360);
};
const evidenceSentences = article => [article?.title, ...String(article?.summary || "").split(/\n+|(?<=[.!?])\s+/)]
  .map(clean).filter(Boolean);
const sourceBacked = article => article?.displayEligible !== false
  && canonicalUrl(article?.url)
  && (article?.provenance?.status === "source-backed"
    || article?.sourceSummaryMode === "source-content-extractive"
    || article?.summaryMode === "source-content-extractive"
    || article?.evidenceTier === "official");
const signalKey = signal => canonicalUrl(signal?.url) || clean(signal?.id || signal?.title);
const compactSignal = (article, trackId = "") => sanitizePublicCopy({
  id: article.id || `tm_${sha(`${trackId}\0${canonicalUrl(article.url)}\0${article.title}`).slice(0, 16)}`,
  trackId,
  title: clip(article.titleEn || article.title, 240),
  excerpt: firstExcerpt(article),
  metricValues: [],
  company: clean(article.co),
  source: clean(article.source),
  sourceTier: clean(article.evidenceTier || (article.sourceType?.startsWith("official") ? "official" : "reported")),
  date: dateOf(article),
  url: canonicalUrl(article.url),
});
const newest = rows => [...rows].sort((left, right) => String(right.date || "").localeCompare(String(left.date || ""))
  || String(left.title || "").localeCompare(String(right.title || "")));
const uniqueBy = (rows, keyFn) => {
  const seen = new Set();
  return rows.filter(row => { const key = keyFn(row); if (!key || seen.has(key)) return false; seen.add(key); return true; });
};

const [taxonomy, news, companies, market, prior, suppression] = await Promise.all([
  readJson("config/tech-market-taxonomy.json"),
  readJson("news.json", { articles: [] }),
  readJson("companies.json", { companies: {} }),
  readJson("market.json", { records: [] }),
  readJson("tech-market-intelligence.json", {}),
  loadSuppressionRegistry(root),
]);

const limits = taxonomy.publicSnapshotLimits || {};
const articles = uniqueBy((news.articles || [])
  .filter(sourceBacked)
  .filter(article => !suppression.matches(article, "article"))
  .map(article => ({ ...article, _text: textOf(article) })), article => canonicalUrl(article.url));

const trackDefs = taxonomy.technologyTracks || [];
const trackMatches = new Map(trackDefs.map(track => [track.id, []]));
for (const article of articles) {
  for (const track of trackDefs) {
    const hits = termHits(article._text, track.terms);
    if (!hits.length) continue;
    const signal = compactSignal(article, track.id);
    signal.matchTerms = hits.slice(0, 4);
    trackMatches.get(track.id).push(signal);
  }
}

const technologyTracks = trackDefs.map(track => {
  const signals = uniqueBy(newest(trackMatches.get(track.id) || []), signalKey)
    .slice(0, Number(limits.signalsPerTrack || 24));
  return sanitizePublicCopy({
    id: track.id,
    label: track.label,
    description: track.description,
    accent: track.accent,
    signalCount: signals.length,
    latestDate: signals[0]?.date || null,
    signals,
  });
});

const moneyRe = new RegExp(taxonomy.metricRules?.moneyPattern || "(?:US\\$|\\$)\\s?\\d[\\d,.]*(?:\\s?(?:trillion|billion|million|T|B|M))?", "gi");
const investmentTerms = taxonomy.metricRules?.investmentTerms || [];
const workloadDefs = taxonomy.workloadTypes || [];
const allInfrastructureAliases = (taxonomy.infrastructureEntities || []).flatMap(entity => entity.aliases || []);
const valuationContext = sentence => /\b(?:valuation|valued?\s+(?:it|the\s+company)?\s*at|market\s+cap|enterprise\s+value|worth)\b|기업\s*가치/i.test(sentence);
const investmentPriority = signal => signal.sourceTier === "official" ? 0 : signal.sourceTier === "reported" ? 1 : 2;
const metricEventKey = signal => `${String(signal.date || "").slice(0, 7)}|${(signal.metricValues || []).map(value => norm(value)).sort().join("|")}`;
const entityProfiles = (taxonomy.infrastructureEntities || []).map(entity => {
  const related = articles.filter(article => entity.aliases.some(alias => norm(article.co) === norm(alias)
    || includesTerm(`${article.title || ""} ${article.summary || ""}`, alias, true)));
  const infraRelated = related.filter(article => termHits(article._text, [
    ...investmentTerms,
    ...trackDefs.find(track => track.id === "data-center-system")?.terms || [],
    ...trackDefs.find(track => track.id === "inference-serving")?.terms || [],
  ]).length);
  const workloadCounts = workloadDefs.map(workload => ({
    id: workload.id,
    label: workload.label,
    count: related.filter(article => termHits(article._text, workload.terms).length).length,
  })).filter(workload => workload.count > 0).sort((left, right) => right.count - left.count);
  const investmentCandidates = infraRelated.map(article => {
    const titleBound = entity.aliases.some(alias => includesTerm(article.title || "", alias, true))
      || entity.aliases.some(alias => norm(article.co) === norm(alias));
    const contexts = evidenceSentences(article).filter(sentence => sentence.length <= 420
      && termHits(sentence, investmentTerms).length
      && [...sentence.matchAll(moneyRe)].length
      && !valuationContext(sentence));
    let binding = "";
    let context = "";
    let values = [];
    for (const sentence of contexts) {
      const clauses = sentence.split(/[,;]|\s+(?:and|while|whereas|및|그리고)\s+/i).map(clean).filter(Boolean);
      const boundClause = clauses.find(clause => entity.aliases.some(alias => includesTerm(clause, alias, true))
        && [...clause.matchAll(moneyRe)].length
        && termHits(clause, investmentTerms).length);
      if (boundClause) {
        context = sentence;
        const rangeContext = /\b(?:between|from)\b/i.test(sentence) ? sentence : boundClause;
        values = [...rangeContext.matchAll(moneyRe)].map(match => clean(match[0])).filter(Boolean).slice(0, 4);
        binding = "entity+metric+investment-same-clause";
        break;
      }
      const competingEntity = allInfrastructureAliases.some(alias => !entity.aliases.includes(alias) && includesTerm(sentence, alias, true));
      if (titleBound && !competingEntity) {
        context = sentence;
        values = [...sentence.matchAll(moneyRe)].map(match => clean(match[0])).filter(Boolean).slice(0, 4);
        binding = "entity-in-title-or-company+metric-investment-sentence";
        break;
      }
    }
    if (!context) return null;
    if (!values.length) return null;
    return {
      ...compactSignal(article, "infrastructure-investment"),
      excerpt: clip(context, 360),
      metricValues: values,
      entityBinding: binding,
    };
  }).filter(Boolean);
  const investments = newest(uniqueBy([...investmentCandidates].sort((left, right) => investmentPriority(left) - investmentPriority(right)
    || String(right.date || "").localeCompare(String(left.date || ""))
    || String(left.title || "").localeCompare(String(right.title || ""))), metricEventKey)).slice(0, 6);
  const signals = uniqueBy(newest(infraRelated.map(article => compactSignal(article, "infrastructure-strategy"))), signalKey)
    .slice(0, Number(limits.signalsPerEntity || 10));
  if (!signals.length && !investments.length) return null;
  const company = companies.companies?.[entity.name] || {};
  const currentBusiness = company.intelligence?.currentBusiness;
  const businessSource = (currentBusiness?.evidence || []).find(item => canonicalUrl(item?.url));
  return sanitizePublicCopy({
    name: entity.name,
    type: entity.type,
    workloadMix: workloadCounts,
    currentBusiness: currentBusiness?.groundingStatus === "source-grounded" ? clip(currentBusiness.summary, 360) : "",
    businessSource: businessSource ? { label: businessSource.source || "Official company source", date: businessSource.date || "", url: canonicalUrl(businessSource.url) } : null,
    investmentMetrics: investments,
    strategySignals: signals,
    latestDate: newest([...investments, ...signals])[0]?.date || null,
  });
}).filter(Boolean);

const verticalWorkloads = (taxonomy.verticalWorkloads || []).map(vertical => {
  const matched = articles.filter(article => termHits(article._text, vertical.terms).length
    && trackDefs.some(track => termHits(article._text, track.terms).length));
  const signals = uniqueBy(newest(matched.map(article => {
    const track = trackDefs.map(def => ({ def, hits: termHits(article._text, def.terms).length }))
      .sort((left, right) => right.hits - left.hits)[0]?.def;
    return compactSignal(article, track?.id || "ai-applications");
  })), signalKey).slice(0, Number(limits.signalsPerVertical || 8));
  const workloads = workloadDefs.map(workload => ({
    id: workload.id,
    label: workload.label,
    count: matched.filter(article => termHits(article._text, workload.terms).length).length,
  })).filter(item => item.count > 0).sort((left, right) => right.count - left.count);
  return sanitizePublicCopy({
    id: vertical.id,
    label: vertical.label,
    signalCount: signals.length,
    workloadMix: workloads,
    companies: [...new Set(matched.map(article => clean(article.co)).filter(Boolean))].slice(0, 12),
    latestDate: signals[0]?.date || null,
    signals,
  });
}).filter(vertical => vertical.signalCount > 0);

const inferenceSignals = technologyTracks.find(track => track.id === "inference-serving")?.signals || [];
const marketInference = (market.records || []).filter(record => /inference|추론/i.test(clean([record.title, record.metricLabel, record.evidence].join(" "))))
  .filter(record => canonicalUrl(record.sourceUrl))
  .map(record => sanitizePublicCopy({
    id: record.id || record.stableKey,
    title: clip(record.title || record.metricLabel, 240),
    excerpt: clip(record.evidence, 360),
    metricValues: (record.values || []).slice(0, 6).map(value => ({ label: clip(value.label, 80), value: clip(value.value, 120) })),
    source: clean(record.sourceName),
    sourceTier: record.evidenceTier || "reported",
    date: clean(record.publishedAt || record.eventAt || record.collectedAt).slice(0, 10),
    url: canonicalUrl(record.sourceUrl),
  }));

const relevantPartnerTracks = new Set(["rag-retrieval", "vector-data", "inference-serving", "ai-applications", "data-center-system"]);
const sourceSignals = technologyTracks.flatMap(track => track.signals.map(signal => ({ ...signal, trackId: track.id, trackLabel: track.label })));
const partnerCandidates = Object.entries(companies.companies || {}).map(([name, company]) => {
  const related = sourceSignals.filter(signal => relevantPartnerTracks.has(signal.trackId)
    && (norm(signal.company) === norm(name) || includesTerm(`${signal.title} ${signal.excerpt}`, name)));
  if (!related.length) return null;
  const tracks = [...new Set(related.map(signal => signal.trackId))];
  const officialCount = related.filter(signal => signal.sourceTier === "official").length;
  const score = Math.min(100, related.length * 8 + tracks.length * 11 + officialCount * 5);
  const profile = company.strategyProfile?.classification || {};
  return sanitizePublicCopy({
    name,
    score,
    category: clean(profile.vertical || profile.category || company.profile?.industry),
    valueChainLayer: clean(profile.valueChainLayer),
    technologyTracks: tracks,
    sourceCount: new Set(related.map(signal => signal.url)).size,
    latestDate: newest(related)[0]?.date || null,
    actions: tracks.some(id => ["rag-retrieval", "vector-data", "inference-serving"].includes(id)) ? ["Partner", "License", "Watch"] : ["Partner", "Watch"],
    signals: uniqueBy(newest(related), signalKey).slice(0, 4),
  });
}).filter(Boolean).sort((left, right) => right.score - left.score || String(right.latestDate).localeCompare(String(left.latestDate)))
  .slice(0, Number(limits.partnerCandidates || 24));

const snapshot = sanitizePublicCopy({
  schemaVersion: 1,
  generatedAt,
  sourceMode: "generated-from-source-linked-ledgers",
  methodology: {
    factRule: "Every mutable claim and metric remains attached to its source URL and date.",
    classificationRule: "Stable multi-label taxonomy; one source may support several technology and workload tracks.",
    accumulationRule: "Latest public snapshot plus append-only monthly source ledger.",
    investmentRule: "Investment scale is shown only when the named entity, currency value and investment or infrastructure term are bound in the same source sentence or clause; valuation-only figures are excluded and duplicate metric events are consolidated.",
  },
  summary: {
    technologyTracks: technologyTracks.length,
    technologySignals: technologyTracks.reduce((sum, track) => sum + track.signalCount, 0),
    infrastructureEntities: entityProfiles.length,
    investmentMetrics: entityProfiles.reduce((sum, entity) => sum + entity.investmentMetrics.length, 0),
    verticalWorkloads: verticalWorkloads.length,
    inferenceSignals: inferenceSignals.length + marketInference.length,
    partnerCandidates: partnerCandidates.length,
  },
  technologyTracks,
  infrastructureLandscape: {
    entities: entityProfiles,
    verticalWorkloads,
  },
  inferenceMarket: {
    signals: uniqueBy(newest([...inferenceSignals, ...marketInference]), signalKey).slice(0, 36),
    partnerCandidates,
  },
  lineage: {
    generatedFrom: ["news.json", "companies.json", "market.json", "config/tech-market-taxonomy.json"],
    ledgerPartition: `intelligence-ledger/tech-market-${month}.jsonl`,
  },
});

const ledgerPath = resolve(root, "intelligence-ledger", `tech-market-${month}.jsonl`);
const ledgerRecordKey = signal => `${signal.trackId || ""}|${signalKey(signal)}`;
const priorKeys = new Set((prior.technologyTracks || []).flatMap(track => (track.signals || []).map(signal => ledgerRecordKey({ ...signal, trackId: track.id }))));
const existingLedgerKeys = new Set((await readFile(ledgerPath, "utf8").catch(() => ""))
  .split(/\r?\n/).filter(Boolean).map(line => {
    try { return ledgerRecordKey(JSON.parse(line)); } catch { return ""; }
  }).filter(Boolean));
const ledgerRows = uniqueBy(technologyTracks.flatMap(track => track.signals.map(signal => ({
  schemaVersion: 1,
  recordType: "technology-signal",
  trackId: track.id,
  observedAt: generatedAt,
  ...signal,
}))).filter(signal => !priorKeys.has(ledgerRecordKey(signal)) && !existingLedgerKeys.has(ledgerRecordKey(signal))), ledgerRecordKey);
await mkdir(resolve(root, "intelligence-ledger"), { recursive: true });
if (ledgerRows.length) await appendFile(ledgerPath, `${ledgerRows.map(row => JSON.stringify(row)).join("\n")}\n`, "utf8");
await writeFile(resolve(root, "tech-market-intelligence.json"), `${JSON.stringify(snapshot)}\n`, "utf8");
console.log(`[tech-market] ${snapshot.summary.technologySignals} technology signals · ${snapshot.summary.infrastructureEntities} infrastructure entities · ${snapshot.summary.verticalWorkloads} vertical workloads · ${snapshot.summary.partnerCandidates} partner candidates · ${ledgerRows.length} new ledger rows`);
