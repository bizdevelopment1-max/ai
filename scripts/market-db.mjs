import { createHash } from "node:crypto";

const isoNow = () => new Date().toISOString();

export const canonicalUrl = raw => {
  try {
    const url = new URL(raw);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach(key => url.searchParams.delete(key));
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};

const hash = text => createHash("sha256").update(text).digest("hex").slice(0, 20);
const hasSource = record => Boolean(canonicalUrl(record?.sourceUrl));
const identity = record => `${record.type || "metric"}|${canonicalUrl(record.sourceUrl)}|${String(record.title || "").trim()}|${String(record.publishedAt || "")}`;
const SURVEY_EVIDENCE = /\b(?:survey|respondents?|poll|questionnaire|interviews?|sample(?:\s+size|\s+of)?|adults?\s+surveyed|sondage|enquête|encuesta|entrevista|pesquisa|entrevista|befragung|umfrage|teilnehmer)\b|설문|조사(?:대상|응답자|표본)?|응답자|표본|アンケート|調査対象|回答者|調査|调查|受访者|样本/i;

// "consumer" and "adoption" alone are not survey evidence. Keeping this
// predicate shared prevents a market headline from being presented as a
// consumer-study result.
export const hasSurveyEvidence = record => SURVEY_EVIDENCE.test([
  record?.title,
  record?.evidence,
  record?.scope,
  record?.metricLabel,
].filter(Boolean).join(" "));

const baselineRecord = (item, collectedAt) => ({
  id: `baseline:${item.id}`,
  type: "market-estimate",
  group: item.group,
  verticalId: item.id,
  title: item.name,
  metricLabel: "시장 규모·전망·CAGR 기준선",
  values: [
    { label: "현재", value: item.size },
    { label: "예측", value: item.forecast },
    ...(item.cagr && item.cagr !== "—" ? [{ label: "CAGR", value: item.cagr }] : []),
  ].filter(row => row.value && row.value !== "—"),
  sourceName: item.source || "공개 시장조사",
  sourceUrl: canonicalUrl(item.url),
  publishedAt: item.date || "",
  collectedAt,
  evidence: [item.def, ...(item.extra || []).map(extra => extra.t)].filter(Boolean).join(" · "),
  origin: "baseline-migration",
  provenance: { status: "source-linked", evidenceCount: 1, checkedAt: collectedAt },
});

// The first three survey rows are source-linked reference records. They are
// intentionally retained forever; later crawler observations are appended.
const CURATED_SURVEYS = [
  {
    id: "survey:counterpoint-genai-smartphone-2025",
    type: "consumer-survey",
    group: "core",
    verticalId: "core-0",
    title: "GenAI 스마트폰 구매의향·인지도 조사",
    metricLabel: "구매의향 및 스마트폰 기반 GenAI 접근",
    values: [
      { label: "1년 내 구매 의향", value: "59%" },
      { label: "상세 조사 표본", value: "3,535명" },
      { label: "스마트폰으로 GenAI 접근", value: "약 75%" },
    ],
    scope: "2024년 9월 · 미국·캐나다·영국·프랑스·독일·폴란드·일본",
    sourceName: "Counterpoint Research",
    sourceUrl: "https://counterpointresearch.com/en/reports/genai-consumer-awareness-survey-59-open-to-buying-genai-smartphones-within-a-year",
    publishedAt: "2025-01-20",
    evidence: "25,000명 이상 접촉 후 3,535명을 대상으로 한 조사. GenAI 인지도·스마트폰 접근·구매결정 영향을 공개 요약에서 확인.",
    origin: "curated-source-record",
  },
  {
    id: "survey:deloitte-connected-consumer-2025",
    type: "consumer-survey",
    group: "assistant",
    verticalId: "assistant-0",
    title: "미국 소비자의 GenAI 사용·모바일 접근 조사",
    metricLabel: "GenAI 채택과 스마트폰 사용 경로",
    values: [
      { label: "GenAI 사용 또는 실험", value: "53%" },
      { label: "조사 표본", value: "3,524명" },
      { label: "사용자 중 스마트폰 독립 앱 접근", value: "65%" },
    ],
    scope: "미국 소비자 · 2025년 2분기",
    sourceName: "Deloitte Connected Consumer",
    sourceUrl: "https://www.deloitte.com/us/en/insights/industry/telecommunications/connectivity-mobile-trends-survey.html",
    publishedAt: "2025-09-25",
    evidence: "Deloitte가 2025년 2분기 미국 소비자 3,524명을 조사한 공개 결과. 비율은 해당 표본에 한정됨.",
    origin: "curated-source-record",
  },
  {
    id: "survey:pew-ai-attitudes-2025",
    type: "consumer-survey",
    group: "trust",
    verticalId: "trust-0",
    title: "AI 일상 사용에 대한 소비자 우려·통제감 조사",
    metricLabel: "AI 도입 수용성과 신뢰 요인",
    values: [
      { label: "조사 표본", value: "5,023명" },
      { label: "관계 형성 능력 악화 예상", value: "50%" },
      { label: "관계 형성 능력 개선 예상", value: "5%" },
    ],
    scope: "미국 성인 · 2025년 6월 9~15일",
    sourceName: "Pew Research Center",
    sourceUrl: "https://www.pewresearch.org/science/2025/09/17/how-americans-view-ai-and-its-impact-on-people-and-society/",
    publishedAt: "2025-09-17",
    evidence: "무작위 표집 기반 American Trends Panel의 공개 조사. 제품 수요가 아닌 소비자 신뢰·수용성 지표임.",
    origin: "curated-source-record",
  },
];

export function appendRecords(data, candidates = [], collectedAt = isoNow()) {
  data.records = Array.isArray(data.records) ? data.records : [];
  const seen = new Set(data.records.map(identity));
  let added = 0;
  for (const candidate of candidates) {
    const sourceUrl = canonicalUrl(candidate.sourceUrl);
    if (!sourceUrl || !candidate.title || !Array.isArray(candidate.values) || !candidate.values.length) continue;
    const record = {
      ...candidate,
      id: candidate.id || `crawl:${hash(`${candidate.type}|${sourceUrl}|${candidate.title}|${candidate.publishedAt || ""}`)}`,
      sourceUrl,
      collectedAt: candidate.collectedAt || collectedAt,
      provenance: candidate.provenance || { status: "source-linked", evidenceCount: 1, checkedAt: collectedAt },
    };
    const key = identity(record);
    if (seen.has(key) || data.records.some(existing => existing.id === record.id)) continue;
    data.records.push(record);
    seen.add(key);
    added++;
  }
  return added;
}

export function ensureMarketDatabase(data, collectedAt = isoNow()) {
  let changed = false;
  data.schemaVersion = Math.max(Number(data.schemaVersion || 1), 2);
  data.database = {
    ...(data.database || {}),
    mode: "append-only",
    recordSchemaVersion: 1,
    sourcePolicy: "Every published quantitative record requires a clickable public source URL.",
    migratedAt: data.database?.migratedAt || collectedAt,
  };
  data.records = Array.isArray(data.records) ? data.records : [];

  // Correct an older crawler classification without removing or replacing any
  // record. Its source, values, and provenance remain append-only history.
  for (const record of data.records) {
    if (record.origin === "rss-quantitative-crawl" && record.type === "consumer-survey" && !hasSurveyEvidence(record)) {
      record.type = "market-observation";
      changed = true;
    }
  }

  const existingBaseline = new Set(data.records.map(record => record.id));
  for (const item of data.items || []) {
    const record = baselineRecord(item, collectedAt);
    if (!record.sourceUrl || existingBaseline.has(record.id)) continue;
    data.records.push(record);
    existingBaseline.add(record.id);
    changed = true;
  }
  const addedSurveys = appendRecords(data, CURATED_SURVEYS, collectedAt);
  if (addedSurveys) changed = true;
  data.database.recordCount = data.records.length;
  data.database.lastValidatedAt = collectedAt;
  return { changed, addedSurveys };
}

export const sourceLinked = record => hasSource(record) && record.provenance?.status !== "reference-only";
