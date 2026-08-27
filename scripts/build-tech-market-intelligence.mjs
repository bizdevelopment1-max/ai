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
import { loadDash } from "./load-dash.mjs";

const root = process.cwd();
const generatedAt = new Date().toISOString();
const month = generatedAt.slice(0, 7);
const readJson = async (file, fallback = {}) => {
  try { return JSON.parse(await readFile(resolve(root, file), "utf8")); }
  catch { return fallback; }
};
const clean = value => String(value ?? "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
const clip = (value, limit = 360) => clean(value).slice(0, limit);
const hasKorean = value => /[가-힣]/.test(String(value || ""));
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
const evidenceSentences = article => [article?.title, ...String(article?.summary || "").split(/\n+|(?<=[.!?])\s+/)]
  .map(clean).filter(Boolean);
const localizedLines = article => article?.localization?.status === "accepted"
  && article?.localization?.displayLanguage === "ko"
  && (article.localization.summaryLines || []).length
  ? article.localization.summaryLines.map(clean).filter(hasKorean).slice(0, 3)
  : [];
const sourceBacked = article => article?.displayEligible !== false
  && canonicalUrl(article?.url)
  && (article?.provenance?.status === "source-backed"
    || article?.sourceSummaryMode === "source-content-extractive"
    || article?.summaryMode === "source-content-extractive"
    || article?.evidenceTier === "official");
const signalKey = signal => canonicalUrl(signal?.url) || clean(signal?.id || signal?.title);
const bulletRoles = [
  { role: "fact", label: "사실" },
  { role: "change", label: "변화" },
  { role: "implication", label: "시사점" },
];
const makeBullets = ({ article, label, matchTerms = [], implication = "후속 원문에서 제품·투자·수요 변화를 재검증", useLocalization = true, actor: contextActor = "" }) => {
  const localized = useLocalization ? localizedLines(article) : [];
  const actor = clean(contextActor || article?.co || article?.source || "시장");
  const sourceTier = article?.evidenceTier === "official" || article?.sourceType?.startsWith("official") ? "공식" : "보도";
  const fallbacks = [
    `${actor}의 ${label} 관련 ${sourceTier} 원문 신호 확인`,
    `${matchTerms.slice(0, 3).join(" · ") || label} 기준으로 분류`,
    implication,
  ];
  const used = new Set();
  return bulletRoles.map((meta, index) => {
    const candidate = localized[index] || fallbacks[index];
    const text = clip(candidate, 210);
    const uniqueText = used.has(text) ? clip(fallbacks[index], 210) : text;
    used.add(uniqueText);
    return { ...meta, text: uniqueText };
  });
};
const compactSignal = (article, trackId = "", context = {}) => {
  const matchTerms = context.matchTerms || [];
  const label = context.label || "AI 기술";
  const actor = clean(context.actor || article.co || article.source || "시장");
  const localizedTitle = context.useLocalization !== false && article?.localization?.status === "accepted"
    && article?.localization?.displayLanguage === "ko" && hasKorean(article.localization.title)
    ? article.localization.title : "";
  return sanitizePublicCopy({
    id: article.id || `tm_${sha(`${trackId}\0${canonicalUrl(article.url)}\0${article.title}`).slice(0, 16)}`,
    trackId,
    title: clip(localizedTitle || `${actor} · ${label} 변화 신호`, 240),
    originalTitle: clip(article.titleEn || article.title, 280),
    evidenceExcerpt: clip(evidenceSentences(article)[0] || article.title || "", 420),
    bullets: makeBullets({ article, label, matchTerms, implication: context.implication, useLocalization: context.useLocalization !== false, actor }),
    metricValues: [],
    matchTerms: matchTerms.slice(0, 4),
    classificationTerms: context.classificationTerms || matchTerms.slice(0, 4),
    bindingRule: context.bindingRule || "source-record",
    company: clean(article.co),
    source: clean(article.source),
    sourceTier: clean(article.evidenceTier || (article.sourceType?.startsWith("official") ? "official" : "reported")),
    date: dateOf(article),
    url: canonicalUrl(article.url),
  });
};
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
const dash = loadDash();

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
    const signal = compactSignal(article, track.id, {
      label: track.label,
      matchTerms: hits,
      implication: `해당 변화가 제품·원가·파트너 구조에 미치는 영향을 후속 원문으로 검증`,
    });
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
const segmentDefs = taxonomy.futureInfrastructureSegments || [];
const segmentById = new Map(segmentDefs.map(segment => [segment.id, segment]));
const segmentForGroup = group => segmentDefs.find(segment => (segment.groups || []).includes(group));
const manualEntities = taxonomy.infrastructureEntities || [];
const representedRegistryNames = new Set(manualEntities.map(entity => norm(entity.registryName)).filter(Boolean));
const generatedEntities = (dash.STOCKS || []).map(stock => {
  const segment = segmentForGroup(stock.group);
  if (!segment || representedRegistryNames.has(norm(stock.name))) return null;
  const aliases = uniqueBy([
    stock.name,
    stock.ticker,
    ...(taxonomy.companyAliasOverrides?.[stock.name] || []),
  ].map(clean).filter(Boolean), norm);
  return {
    name: stock.name,
    registryName: stock.name,
    segmentId: segment.id,
    type: segment.label,
    futureRole: segment.futureRole,
    aliases,
    domain: stock.domain || "",
    ticker: stock.ticker || "",
    registrySource: "dashboard-taxonomy.STOCKS",
  };
}).filter(Boolean);
const entityDefinitions = uniqueBy([...manualEntities, ...generatedEntities].map(entity => {
  const segment = segmentById.get(entity.segmentId) || {};
  return {
    ...entity,
    aliases: uniqueBy([entity.name, ...(entity.aliases || []), ...(taxonomy.companyAliasOverrides?.[entity.registryName || entity.name] || [])]
      .map(clean).filter(Boolean), norm),
    type: entity.type || segment.label || "AI 인프라",
    futureRole: entity.futureRole || segment.futureRole || "AI 가치사슬의 공급·운영 역할",
  };
}), entity => norm(entity.name));
const allInfrastructureAliases = entityDefinitions.flatMap(entity => entity.aliases || []);
const infraTerms = uniqueBy([
  ...investmentTerms,
  ...(trackDefs.find(track => track.id === "data-center-system")?.terms || []),
  ...(trackDefs.find(track => track.id === "inference-serving")?.terms || []),
  ...(trackDefs.find(track => track.id === "accelerator-semiconductor")?.terms || []),
  "server", "rack", "ethernet", "optical", "foundry", "packaging", "cooling", "xpu",
], norm);
const entityNameBound = (article, entity) => entity.aliases.some(alias => norm(article.co) === norm(alias)
  || includesTerm(article.title || "", alias, true));
const entityEvidenceBlocks = (article, entity) => evidenceSentences(article).filter(sentence =>
  entity.aliases.some(alias => includesTerm(sentence, alias, true)) && termHits(sentence, infraTerms).length);
const valuationContext = sentence => /\b(?:valuation|valued?\s+(?:it|the\s+company)?\s*at|market\s+cap|enterprise\s+value|worth)\b|기업\s*가치/i.test(sentence);
const investmentPriority = signal => signal.sourceTier === "official" ? 0 : signal.sourceTier === "reported" ? 1 : 2;
const metricEventKey = signal => `${String(signal.date || "").slice(0, 7)}|${(signal.metricValues || []).map(value => norm(value)).sort().join("|")}`;
const entityProfiles = entityDefinitions.map(entity => {
  const related = articles.filter(article => entityNameBound(article, entity)
    || evidenceSentences(article).some(sentence => entity.aliases.some(alias => includesTerm(sentence, alias, true))));
  const infraRelated = related.filter(article => entityNameBound(article, entity)
    ? evidenceSentences(article).some(sentence => termHits(sentence, infraTerms).length)
    : entityEvidenceBlocks(article, entity).length);
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
    const boundTerms = termHits(context, investmentTerms);
    return {
      ...compactSignal(article, "infrastructure-investment", {
        label: "투자·설비",
        matchTerms: boundTerms,
        classificationTerms: [...boundTerms, ...values],
        bindingRule: binding,
        implication: `${entity.futureRole} 관점에서 투자 규모·시점·공급 능력을 다음 공시와 대조`,
        useLocalization: false,
        actor: entity.name,
      }),
      evidenceExcerpt: clip(context, 420),
      metricValues: values,
      entityBinding: binding,
    };
  }).filter(Boolean);
  const investments = newest(uniqueBy([...investmentCandidates].sort((left, right) => investmentPriority(left) - investmentPriority(right)
    || String(right.date || "").localeCompare(String(left.date || ""))
    || String(left.title || "").localeCompare(String(right.title || ""))), metricEventKey)).slice(0, 6);
  const signals = uniqueBy(newest(infraRelated.map(article => {
    const boundBlock = entityEvidenceBlocks(article, entity)[0]
      || evidenceSentences(article).find(sentence => termHits(sentence, infraTerms).length) || article.title;
    const hits = termHits(boundBlock, infraTerms);
    return compactSignal(article, "infrastructure-strategy", {
      label: "인프라 전략",
      matchTerms: hits,
      classificationTerms: hits,
      bindingRule: entityNameBound(article, entity) ? "entity-title-or-company+infrastructure-source" : "entity+infrastructure-same-evidence-block",
      implication: entity.futureRole,
      useLocalization: false,
      actor: entity.name,
    });
  })), signalKey)
    .slice(0, Number(limits.signalsPerEntity || 10));
  if (!signals.length && !investments.length) return null;
  const companyKey = [entity.name, entity.registryName, ...entity.aliases]
    .find(name => companies.companies?.[name]);
  const company = companies.companies?.[companyKey] || {};
  const currentBusiness = company.intelligence?.currentBusiness;
  const businessSource = (currentBusiness?.evidence || []).find(item => canonicalUrl(item?.url));
  const allSignals = uniqueBy(newest([...investments, ...signals]), signalKey);
  const sourceCount = new Set(allSignals.map(signal => signal.url)).size;
  const officialCount = allSignals.filter(signal => signal.sourceTier === "official").length;
  const topWorkloads = workloadCounts.slice(0, 3).map(item => `${item.label} ${item.count}건`).join(" · ") || "분류 가능한 워크로드 추가 확인 필요";
  const currentBusinessSummary = currentBusiness?.groundingStatus === "source-grounded" && hasKorean(currentBusiness.summary)
    ? clip(currentBusiness.summary, 260) : "";
  return sanitizePublicCopy({
    name: entity.name,
    type: entity.type,
    segmentId: entity.segmentId,
    segmentLabel: segmentById.get(entity.segmentId)?.label || entity.type,
    futureRole: entity.futureRole,
    registrySource: entity.registrySource || "tech-market-taxonomy",
    workloadMix: workloadCounts,
    currentBusiness: currentBusinessSummary,
    businessSource: businessSource ? { label: businessSource.source || "Official company source", date: businessSource.date || "", url: canonicalUrl(businessSource.url) } : null,
    sourceCount,
    officialCount,
    summaryBullets: [
      { label: "역할", text: currentBusinessSummary || entity.futureRole },
      { label: "수요", text: topWorkloads },
      { label: "근거", text: `원문 ${sourceCount}건 · 공식 ${officialCount}건 · 수치 ${investments.length}건` },
    ],
    investmentMetrics: investments,
    strategySignals: signals,
    latestDate: allSignals[0]?.date || null,
  });
}).filter(Boolean);

const verticalWorkloads = (taxonomy.verticalWorkloads || []).map(vertical => {
  const matchedRows = articles.map(article => {
    const boundBlocks = evidenceSentences(article).map(sentence => {
      const verticalHits = termHits(sentence, vertical.terms);
      const trackScores = trackDefs.map(def => ({ def, hits: termHits(sentence, def.terms) }))
        .filter(item => item.hits.length).sort((left, right) => right.hits.length - left.hits.length);
      if (!verticalHits.length || !trackScores.length) return null;
      return { sentence, verticalHits, track: trackScores[0].def, trackHits: trackScores[0].hits };
    }).filter(Boolean);
    if (!boundBlocks.length) return null;
    return { article, bound: boundBlocks[0] };
  }).filter(Boolean);
  const matched = matchedRows.map(row => row.article);
  const signals = uniqueBy(newest(matchedRows.map(({ article, bound }) => compactSignal(article, bound.track?.id || "ai-applications", {
    label: `${vertical.label} · ${bound.track?.label || "AI Application"}`,
    matchTerms: [...bound.verticalHits, ...bound.trackHits],
    classificationTerms: [...bound.verticalHits, ...bound.trackHits].slice(0, 6),
    bindingRule: "same-evidence-block",
    implication: `${vertical.label}에서 ${bound.track?.description || "AI 활용"} 수요와 사업 적용 조건을 후속 원문으로 검증`,
    useLocalization: false,
  }))), signalKey).slice(0, Number(limits.signalsPerVertical || 8));
  const workloads = workloadDefs.map(workload => ({
    id: workload.id,
    label: workload.label,
    count: matched.filter(article => termHits(article._text, workload.terms).length).length,
  })).filter(item => item.count > 0).sort((left, right) => right.count - left.count);
  const matchedCompanies = uniqueBy(matchedRows.map(({ article, bound }) => clean(article.co)
    || entityDefinitions.find(entity => entity.aliases.some(alias => includesTerm(bound.sentence, alias, true)))?.name || "").filter(Boolean), norm).slice(0, 12);
  const officialCount = signals.filter(signal => signal.sourceTier === "official").length;
  const topDemand = workloads.slice(0, 3).map(item => `${item.label} ${item.count}건`).join(" · ") || "워크로드 분류 추가 확인 필요";
  return sanitizePublicCopy({
    id: vertical.id,
    label: vertical.label,
    signalCount: signals.length,
    workloadMix: workloads,
    companies: matchedCompanies,
    officialCount,
    summaryBullets: [
      { label: "수요", text: topDemand },
      { label: "업체", text: matchedCompanies.length ? `관련 업체 · ${matchedCompanies.slice(0, 5).join(" · ")}` : "원문 내 업체명 추가 확인 필요" },
      { label: "근거", text: `동일 문장 결합 원문 ${signals.length}건 · 공식 ${officialCount}건` },
    ],
    latestDate: signals[0]?.date || null,
    signals,
  });
}).filter(vertical => vertical.signalCount > 0);

const inferenceSignals = technologyTracks.find(track => track.id === "inference-serving")?.signals || [];
const marketInference = (market.records || []).filter(record => /inference|추론/i.test(clean([record.title, record.metricLabel, record.evidence].join(" "))))
  .filter(record => canonicalUrl(record.sourceUrl))
  .map(record => {
    const values = (record.values || []).slice(0, 6).map(value => ({ label: clip(value.label, 80), value: clip(value.value, 120) }));
    const valueSummary = values.length
      ? `정량 지표 · ${values.slice(0, 3).map(value => `${value.label || "지표"} ${value.value}`).join(" · ")}`
      : "정량 지표는 연결 원문에서 확인";
    return sanitizePublicCopy({
      id: record.id || record.stableKey,
      trackId: "inference-serving",
      title: hasKorean(record.title || record.metricLabel) ? clip(record.title || record.metricLabel, 240) : "추론 시장 · 정량 지표 변화 신호",
      originalTitle: clip(record.title || record.metricLabel, 280),
      evidenceExcerpt: clip(record.evidence, 420),
      bullets: [
        { role: "fact", label: "사실", text: valueSummary },
        { role: "change", label: "변화", text: `${clean(record.sourceName || "시장 원문")}에서 추론 시장 수치 변화 확인` },
        { role: "implication", label: "시사점", text: "추론 단가·처리량·전력 효율을 동일 기준으로 재검증" },
      ],
      metricValues: values,
      classificationTerms: ["추론", "시장 지표"],
      bindingRule: "market-record+source-url",
      source: clean(record.sourceName),
      sourceTier: record.evidenceTier || "reported",
      date: clean(record.publishedAt || record.eventAt || record.collectedAt).slice(0, 10),
      url: canonicalUrl(record.sourceUrl),
    });
  });

const relevantPartnerTracks = new Set(["rag-retrieval", "vector-data", "inference-serving", "ai-applications", "data-center-system"]);
const sourceSignals = technologyTracks.flatMap(track => track.signals.map(signal => ({ ...signal, trackId: track.id, trackLabel: track.label })));
const partnerCandidates = Object.entries(companies.companies || {}).map(([name, company]) => {
  const related = sourceSignals.filter(signal => relevantPartnerTracks.has(signal.trackId)
    && (norm(signal.company) === norm(name) || includesTerm(`${signal.originalTitle} ${signal.evidenceExcerpt}`, name)));
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

const infrastructureSegments = segmentDefs.map(segment => {
  const visible = entityProfiles.filter(entity => entity.segmentId === segment.id);
  const tracked = entityDefinitions.filter(entity => entity.segmentId === segment.id);
  return sanitizePublicCopy({
    id: segment.id,
    label: segment.label,
    futureRole: segment.futureRole,
    trackedCount: tracked.length,
    entityCount: visible.length,
    sourceCount: visible.reduce((sum, entity) => sum + Number(entity.sourceCount || 0), 0),
  });
});

const snapshot = sanitizePublicCopy({
  schemaVersion: 2,
  generatedAt,
  sourceMode: "generated-from-source-linked-ledgers",
  methodology: {
    factRule: "Every mutable claim and metric remains attached to its source URL and date.",
    classificationRule: "Stable multi-label taxonomy; one source may support several technology and workload tracks.",
    accumulationRule: "Latest public snapshot plus append-only monthly source ledger.",
    investmentRule: "Investment scale is shown only when the named entity, currency value and investment or infrastructure term are bound in the same source sentence or clause; valuation-only figures are excluded and duplicate metric events are consolidated.",
    entityRule: taxonomy.classificationBinding?.entity,
    verticalRule: taxonomy.classificationBinding?.vertical,
    summaryRule: taxonomy.classificationBinding?.publicSummary,
  },
  summary: {
    technologyTracks: technologyTracks.length,
    technologySignals: technologyTracks.reduce((sum, track) => sum + track.signalCount, 0),
    infrastructureEntities: entityProfiles.length,
    trackedEntityUniverse: entityDefinitions.length,
    infrastructureSegments: infrastructureSegments.length,
    investmentMetrics: entityProfiles.reduce((sum, entity) => sum + entity.investmentMetrics.length, 0),
    verticalWorkloads: verticalWorkloads.length,
    inferenceSignals: inferenceSignals.length + marketInference.length,
    partnerCandidates: partnerCandidates.length,
  },
  technologyTracks,
  infrastructureLandscape: {
    segments: infrastructureSegments,
    entities: entityProfiles,
    verticalWorkloads,
  },
  inferenceMarket: {
    signals: uniqueBy(newest([...inferenceSignals, ...marketInference]), signalKey).slice(0, 36),
    partnerCandidates,
  },
  lineage: {
    generatedFrom: ["news.json", "companies.json", "market.json", "config/tech-market-taxonomy.json", "config/dashboard-taxonomy.json"],
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
  schemaVersion: 2,
  recordType: "technology-signal",
  trackId: track.id,
  observedAt: generatedAt,
  ...signal,
}))).filter(signal => !priorKeys.has(ledgerRecordKey(signal)) && !existingLedgerKeys.has(ledgerRecordKey(signal))), ledgerRecordKey);
await mkdir(resolve(root, "intelligence-ledger"), { recursive: true });
if (ledgerRows.length) await appendFile(ledgerPath, `${ledgerRows.map(row => JSON.stringify(row)).join("\n")}\n`, "utf8");
await writeFile(resolve(root, "tech-market-intelligence.json"), `${JSON.stringify(snapshot)}\n`, "utf8");
console.log(`[tech-market] ${snapshot.summary.technologySignals} technology signals · ${snapshot.summary.infrastructureEntities} infrastructure entities · ${snapshot.summary.verticalWorkloads} vertical workloads · ${snapshot.summary.partnerCandidates} partner candidates · ${ledgerRows.length} new ledger rows`);
