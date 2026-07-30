const cleanText = value => String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
const normalizedText = value => cleanText(value).toLocaleLowerCase()
  .replace(/[’‘`´]/g, "'")
  .replace(/&(?:nbsp|amp);/g, " ")
  .replace(/[^a-z0-9가-힣%$€£¥₩₹]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const PUBLISHER_SUFFIX = /\s+(?:-|–|—|\|)\s+(?:aol(?:\.com)?|yahoo(?:\s+finance)?|msn|marketwatch|nasdaq|barchart|benzinga|theglobeandmail|investing\.com)\s*$/i;
const stripPublisherSuffix = value => cleanText(value).replace(PUBLISHER_SUFFIX, "").trim();
const storyTitle = record => normalizedText(stripPublisherSuffix(record?.titleEn || record?.title || ""));
const textTokens = value => new Set(normalizedText(value).split(" ").filter(token => token.length > 2));
const intersectionSize = (left, right) => [...left].filter(value => right.has(value)).length;
const setSimilarity = (left, right) => {
  if (!left.size || !right.size) return 0;
  return intersectionSize(left, right) / new Set([...left, ...right]).size;
};

const metricSet = record => new Set((record?.sourceMetricValues || record?.values || record?.sourceQuantities || [])
  .map(metric => normalizedText(typeof metric === "string" ? metric : metric?.value))
  .filter(Boolean));
const evidenceSet = record => new Set((record?.sourceQuantifiedLines || [])
  .map(item => normalizedText(item?.line))
  .filter(line => line.length >= 28));

const dateDistance = (left, right) => {
  const a = Date.parse(left?.publishedAt || left?.collectedAt || "");
  const b = Date.parse(right?.publishedAt || right?.collectedAt || "");
  return Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) / 86400000 : 0;
};

export const sameMarketStory = (left, right) => {
  const leftUrl = cleanText(left?.sourceUrl).replace(/[?#].*$/, "").replace(/\/+$/, "");
  const rightUrl = cleanText(right?.sourceUrl).replace(/[?#].*$/, "").replace(/\/+$/, "");
  if (leftUrl && rightUrl && leftUrl === rightUrl) return true;
  const leftHash = cleanText(left?.sourceContent?.contentHash);
  const rightHash = cleanText(right?.sourceContent?.contentHash);
  if (leftHash && rightHash && leftHash === rightHash) return true;

  const leftTitle = storyTitle(left);
  const rightTitle = storyTitle(right);
  const daysApart = dateDistance(left, right);
  if (leftTitle.length >= 28 && leftTitle === rightTitle && daysApart <= 10) return true;
  if (daysApart > 10) return false;

  const titleSimilarity = setSimilarity(textTokens(leftTitle), textTokens(rightTitle));
  const metrics = setSimilarity(metricSet(left), metricSet(right));
  if (titleSimilarity >= 0.84 && metrics >= 0.5) return true;

  const leftEvidence = evidenceSet(left);
  const rightEvidence = evidenceSet(right);
  const sharedEvidence = intersectionSize(leftEvidence, rightEvidence);
  return sharedEvidence >= 2
    && sharedEvidence / Math.min(leftEvidence.size || 1, rightEvidence.size || 1) >= 0.6
    && metrics >= 0.45;
};

const AGGREGATOR = /\b(?:aol|yahoo|msn|barchart|benzinga|streetinsider|marketscreener|investing\.com)\b/i;
const representativeScore = record => {
  const source = `${record?.sourceName || ""} ${record?.sourceUrl || ""}`;
  const title = stripPublisherSuffix(record?.titleEn || record?.title || "");
  return (AGGREGATOR.test(source) ? -80 : 0)
    + Math.min((record?.sourceQuantifiedLines || []).length, 20) * 3
    + Math.min((record?.sourceMetricValues || []).length, 20) * 2
    + Math.min((record?.localization?.summaryLines || record?.summaryLinesEn || []).length, 3) * 10
    - Math.max(0, title.length - 160) / 10;
};

const uniqueBy = (items, keyOf) => {
  const seen = new Set();
  return items.filter(item => {
    const key = keyOf(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const insightDimension = value => {
  const text = normalizedText(value);
  if (/cash flow|revenue|sales|margin|profit|earnings|매출|수익|마진|현금 흐름|영업이익/.test(text)) return "financial";
  if (/capex|capital expenditure|investment|spending|투자|자본 지출|설비투자/.test(text)) return "investment";
  if (/backlog|contract|pre sold|pipeline|백로그|수주|계약|사전 판매/.test(text)) return "contracted-demand";
  if (/consumer|respondent|user|adoption|usage|소비자|응답|이용|도입/.test(text)) return "adoption";
  if (/market|cagr|forecast|growth|시장|성장|전망/.test(text)) return "market";
  if (/risk|regulation|privacy|security|위험|규제|보안|개인정보/.test(text)) return "risk";
  return "other";
};

const selectInsights = values => {
  const candidates = uniqueBy(values.map(cleanText).filter(Boolean), normalizedText);
  const chosen = [];
  const usedDimensions = new Set();
  for (const value of candidates) {
    const dimension = insightDimension(value);
    if (usedDimensions.has(dimension)) continue;
    chosen.push(value);
    usedDimensions.add(dimension);
    if (chosen.length === 3) return chosen;
  }
  for (const value of candidates) {
    if (chosen.includes(value)) continue;
    chosen.push(value);
    if (chosen.length === 3) break;
  }
  return chosen;
};

const mergeMetrics = records => {
  const byValue = new Map();
  for (const metric of records.flatMap(record => record.sourceMetricValues || record.values || [])) {
    const normalizedValue = normalizedText(metric?.value);
    if (!normalizedValue) continue;
    const previous = byValue.get(normalizedValue);
    const previousLabel = cleanText(previous?.label);
    const label = cleanText(metric?.label);
    const generic = /^(?:금액|비율|정량 지표)(?: ·|$)/;
    if (!previous || (generic.test(previousLabel) && !generic.test(label)) || label.length > previousLabel.length + 8) {
      byValue.set(normalizedValue, { ...metric, label, value: cleanText(metric?.value) });
    }
  }
  return [...byValue.values()];
};

const mergeGroup = group => {
  const ranked = group.slice().sort((a, b) => representativeScore(b) - representativeScore(a));
  const representative = ranked[0];
  const metrics = mergeMetrics(ranked);
  const quantifiedLines = uniqueBy(
    ranked.flatMap(record => record.sourceQuantifiedLines || []),
    item => normalizedText(stripPublisherSuffix(item?.line)),
  );
  const relatedSources = uniqueBy(ranked.map(record => ({
    id: record.id,
    sourceName: cleanText(record.sourceName) || "발행사",
    sourceUrl: record.sourceUrl,
    publishedAt: record.publishedAt || "",
  })), item => normalizedText(item.sourceUrl));
  const localizedInsights = selectInsights(ranked.flatMap(record => record.localization?.summaryLines || []));
  const englishInsights = selectInsights(ranked.flatMap(record => record.summaryLinesEn || []));
  const representativeLocalizedTitle = representative.localization?.title || "";
  const consolidatedTitle = stripPublisherSuffix(representativeLocalizedTitle || representative.titleEn || representative.title);

  return {
    ...representative,
    consolidatedTitle,
    sourceMetricValues: metrics,
    values: metrics,
    sourceQuantities: metrics.map(metric => metric.value),
    sourceQuantifiedLines: quantifiedLines,
    summaryLinesEn: englishInsights,
    localization: representative.localization ? {
      ...representative.localization,
      title: consolidatedTitle,
      summaryLines: localizedInsights.length ? localizedInsights : representative.localization.summaryLines,
    } : representative.localization,
    consolidatedInsights: localizedInsights.length ? localizedInsights : englishInsights,
    relatedSources,
    mergedRecordIds: ranked.map(record => record.id),
    mergedRecordCount: ranked.length,
    duplicateRecordCount: Math.max(0, ranked.length - 1),
    consolidation: {
      mode: "same-story-source-evidence",
      evidencePolicy: "title, quantitative overlap and source-line agreement",
    },
  };
};

export const consolidateMarketRecords = (records = []) => {
  const groups = [];
  for (const record of records) {
    const group = groups.find(candidate => candidate.some(existing => sameMarketStory(existing, record)));
    if (group) group.push(record);
    else groups.push([record]);
  }
  return groups.map(mergeGroup);
};
