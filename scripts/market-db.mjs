import { createHash } from "node:crypto";

const isoNow = () => new Date().toISOString();
const compactText = value => String(value || "").replace(/\s+/g, " ").trim();
const escapeRegExp = value => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const metricYears = line => [...String(line || "").matchAll(/\b20(?:1\d|2\d|3\d)\b/g)]
  .map(match => ({ value: match[0], index: match.index || 0 }));

const metricYearContext = (line, value, metric) => {
  const years = metricYears(line);
  if (!years.length) return "";
  if (metric === "연평균 성장률" || metric === "시장 증가액") {
    const metricIndex = String(line || "").toLocaleLowerCase().indexOf(String(value || "").toLocaleLowerCase());
    const trailing = String(line || "").slice(Math.max(0, metricIndex));
    const statedRange = trailing.match(/\bfrom\s+(20(?:1\d|2\d|3\d))\s+to\s+(20(?:1\d|2\d|3\d))\b/i)
      || trailing.match(/\b(20(?:1\d|2\d|3\d))\s*(?:-|–|to)\s*(20(?:1\d|2\d|3\d))\b/i);
    if (statedRange) return `${statedRange[1]}–${statedRange[2]}`;
    const unique = [...new Set(years.map(year => year.value))].sort();
    if (unique.length > 1) return `${unique[0]}–${unique.at(-1)}`;
  }
  const source = String(line || "");
  const index = source.toLocaleLowerCase().indexOf(String(value || "").toLocaleLowerCase());
  const tokenEnd = index + String(value || "").length;
  const directlyQualified = years.find(year => year.index >= tokenEnd
    && /^[^,.;]{0,28}\b(?:in|by|for|during|as of|through)\s*$/i.test(source.slice(tokenEnd, year.index)));
  if (directlyQualified) return directlyQualified.value;
  return years.slice().sort((a, b) => Math.abs(a.index - index) - Math.abs(b.index - index))[0]?.value || "";
};

const isForecastYear = (line, year) => {
  const years = metricYears(line).map(item => item.value);
  const value = String(line || "").toLocaleLowerCase();
  const direct = new RegExp(`(?:by|through|until)\\s+\\b${escapeRegExp(year)}\\b`, "i");
  const forecastDescriptor = new RegExp(`\\b${escapeRegExp(year)}\\b[^.]{0,40}\\bforecast\\b|\\b(?:forecast|projected)\\b[^.]{0,40}\\b${escapeRegExp(year)}\\b`, "i");
  return direct.test(value) || forecastDescriptor.test(value)
    || (years.length > 1 && year === years.slice().sort().at(-1)
      && /forecast|project|expected|anticipat|will reach|to grow|increase from/i.test(value));
};

const nearestRuleMetric = (line, value, rules) => {
  const text = String(line || "");
  const tokenIndex = text.toLocaleLowerCase().indexOf(String(value || "").toLocaleLowerCase());
  const tokenEnd = tokenIndex + String(value || "").length;
  let selected = null;
  rules.forEach(([pattern, label], priority) => {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    for (const match of text.matchAll(new RegExp(pattern.source, flags))) {
      const start = match.index || 0;
      const end = start + match[0].length;
      const distance = end <= tokenIndex ? tokenIndex - end : start >= tokenEnd ? start - tokenEnd : 0;
      if (!selected || distance < selected.distance || (distance === selected.distance && priority < selected.priority)) {
        selected = { label, distance, priority };
      }
    }
  });
  return selected?.label || "";
};

const contextualMetric = (line, value) => {
  const text = compactText(line);
  const lower = text.toLocaleLowerCase();
  const token = compactText(value);

  if (/^20(?:1\d|2\d|3\d)$/.test(token)) {
    const comparisonYear = new RegExp(`\\b(?:from|compared with)\\s+[^.]{0,40}\\b${escapeRegExp(token)}\\b`, "i");
    if (comparisonYear.test(lower)
      && !isForecastYear(lower, token)) return "비교 기준 연도";
    return isForecastYear(lower, token) ? "전망 연도" : "기준 연도";
  }
  if (/\b(?:years?|months?|days?|hours?)\b/i.test(token)) {
    if (/\b(?:past|experience|career|writing|worked|served)\b/i.test(lower)) return "경력 기간";
    return "기간";
  }
  if (/\brespondents?\b/i.test(token) || /\bsurvey of\b[^.]{0,40}\brespondents?\b/i.test(lower)) return "응답자 수";
  if (/\b(?:users?|consumers?|people|adults?)\b/i.test(token)) {
    if (/\bmonthly active\b/i.test(lower)) return "월간 활성 이용자";
    if (/\bpaid subscribers?\b/i.test(lower)) return "유료 가입자";
    if (/\bsurvey|respondents?|poll\b/i.test(lower)) return "조사 인원";
    return "이용자 수";
  }
  if (/\b(?:shipments?|units?|devices?)\b/i.test(token)) return "출하량";
  if (/\btons?\b/i.test(lower) && !/%/.test(token)) return "시장 물량";
  if (/^4k$/i.test(token)) return "영상 해상도";

  const isMoney = /(?:US\$|USD|\$|€|£|¥|₩|₹|R\$)/i.test(token);
  if (isMoney) {
    return nearestRuleMetric(text, token, [
      [/\bnegative free cash flow\b/i, "잉여현금흐름 적자"],
      [/\bfree cash flow\b/i, "잉여현금흐름"],
      [/\b(?:capital expenditures?|capex)\b/i, "설비투자"],
      [/\bbacklog\b/i, "수주잔고"],
      [/\brevenue\b[^.]{0,30}\b(?:every|per)\s+(?:single\s+)?day\b|\bdaily revenue\b/i, "일일 매출"],
      [/\brevenues? guidance\b/i, "매출 가이던스"],
      [/\brevenues?\b/i, "매출"],
      [/\bvaluation\b/i, "기업가치"],
      [/\b(?:funding|raised|raise)\b/i, "조달액"],
      [/\binvestment|invested|allocated|earmarks?\b/i, "투자액"],
      [/\bpayout|paid out|prize|reward\b/i, "지급액"],
      [/\b(?:cost|price|income|yield)\b/i, "비용·소득 영향액"],
      [/\b(?:spend|spending|purchases?)\b/i, "지출·거래액"],
      [/\b(?:increase|grow|growth)\s+by\b/i, "시장 증가액"],
      [/\bsegment\b/i, "세그먼트 규모"],
      [/\bmarket(?:\s+size)?\b|\bworth\b|\bvalued\b|\bforecast\b|\bproject/i, "시장 규모"],
    ]) || "금액";
  }

  const isPercent = /%|\bpercent\b|\bper cent\b|\bbasis points?\b|\bbps\b/i.test(token);
  if (isPercent) {
    const specialized = nearestRuleMetric(text, token, [
      [/\b(?:cagr|compound annual growth rate)\b/i, "연평균 성장률"],
      [/\boperating margins?\b/i, "영업이익률"],
      [/\bmargins?\b/i, "이익률"],
      [/\breturn rates?\b/i, "반품률"],
      [/\blower returns?\b/i, "반품 감소율"],
      [/\bpurchase probability|purchase intent|willing(?:ness)? to pay\b/i, "구매·지불의향"],
      [/\btried cloud gaming\b/i, "클라우드 게이밍 경험률"],
      [/\bpositive experience\b/i, "긍정 경험 비중"],
      [/\bregular or heavy users?\b/i, "정기·고빈도 이용자 비중"],
      [/\bcreated content\b/i, "콘텐츠 제작자 비중"],
      [/\bplaying time\b/i, "플레이 시간 증가 응답"],
      [/\bconsuming more\b/i, "이용 증가 응답"],
      [/\bnon-compliance risks?|barriers? to adoption\b/i, "도입 장벽 응답"],
      [/\badoption|adopted\b/i, "도입률"],
      [/\bpenetration\b/i, "침투율"],
      [/\brevenue (?:share|mix)|share of (?:global )?revenue\b/i, "매출 비중"],
      [/\bmarket share|\bshare of (?:the )?(?:global )?market\b|\baccount(?:ed|ing) for\b|\brepresenting\b/i, "시장 점유율"],
      [/\brevenues? (?:surge|growth|jump)|revenues?[^.]{0,30}\bup\b/i, "매출 성장률"],
      [/\b(?:growth|grow|increase|higher|lift)\b/i, "성장·증가율"],
      [/\bclientele|customers?\b/i, "고객 범위"],
    ]);
    if (specialized) return specialized;
    if (/\bsurvey|respondents?|gamers?|consumers?\b/i.test(lower)) return "응답 비중";
    return "비율";
  }

  if (/\b(?:million|billion|trillion|thousand|trn|bn|mn|k)\b/i.test(token)) {
    if (/\bmonthly active users?\b/i.test(lower)) return "월간 활성 이용자";
    if (/\busers?\b/i.test(lower)) return "이용자 수";
    if (/\bapps?\b/i.test(lower)) return "앱 수";
    if (/\bproduct trials?\b/i.test(lower)) return "제품 체험 수";
    if (/\b(?:shipments?|units?|devices?)\b/i.test(lower)) return "출하량";
    return "정량 지표";
  }
  return "정량 지표";
};

/**
 * Bind every displayed number to a short, source-derived business label
 * instead of exposing an unlabeled extraction token.
 */
export const sourceMetricValues = (lines = [], quantities = []) => {
  const sourceLines = Array.isArray(lines) ? lines : [];
  return (quantities || []).map(value => {
    const candidates = sourceLines.filter(item => compactText(item?.line).toLocaleLowerCase()
      .includes(compactText(value).toLocaleLowerCase()));
    const businessContext = /\b(?:market size|market worth|cagr|forecast|project|growth|revenues?|sales|spend|spending|share|respondents?|survey|users?|shipments?|units?|adoption|investment|funding|valuation|backlog|capital expenditures?|capex|cash flow|margin|cost|income|payout|purchase|price)\b/i;
    const contextual = candidates.filter(item => businessContext.test(compactText(item?.line)));
    const source = (contextual.length ? contextual : candidates).slice()
      .sort((a, b) => compactText(a?.line).length - compactText(b?.line).length)[0];
    const sourceLine = compactText(source?.line);
    const metric = contextualMetric(sourceLine, value);
    const year = /^20(?:1\d|2\d|3\d)$/.test(compactText(value)) ? "" : metricYearContext(sourceLine, value, metric);
    return {
      label: `${metric}${year ? ` · ${year}` : ""}`,
      value,
      sourceLine,
    };
  });
};

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
// A publisher page must enter the append-only ledger once even when several
// collection tracks discover it. Classification can be refined after source
// extraction without creating a second historical record.
const identity = record => `${canonicalUrl(record.sourceUrl)}|${String(record.title || "").trim()}|${String(record.publishedAt || "")}`;
const SURVEY_EVIDENCE = /\b(?:survey|respondents?|poll|questionnaire|interviews?|sample(?:\s+size|\s+of)?|adults?\s+surveyed|sondage|enquête|encuesta|entrevista|pesquisa|entrevista|befragung|umfrage|teilnehmer)\b|설문|조사(?:대상|응답자|표본)?|응답자|표본|アンケート|調査対象|回答者|調査|调查|受访者|样本/i;
const CONSUMER_POPULATION = /\b(?:consumer|respondents?|people|person|adults?|users?|households?|shoppers?|buyers?|owners?|patients?|students?|workers?|employees?|travelers?|creators?|parents?|teens?|americans?|britons?|koreans?|japanese|participants?)\b|소비자|응답자|이용자|사용자|구매자|일반인|성인|청소년|학생|직장인|환자|가구|쇼핑객|여행객|참여자|生活者|消費者|回答者|利用者|用户|消费者|受访者/i;

// "consumer" and "adoption" alone are not survey evidence. Keeping this
// predicate shared prevents a market headline from being presented as a
// consumer-study result.
export const hasSurveyEvidence = record => SURVEY_EVIDENCE.test([
  record?.title,
  record?.evidence,
  record?.scope,
  record?.metricLabel,
].filter(Boolean).join(" "));

export const hasConsumerSurveyEvidence = record => {
  const fields = [
    record?.title,
    record?.evidence,
    record?.scope,
    record?.metricLabel,
  ].filter(Boolean);
  if (!hasSurveyEvidence(record)) return false;
  const windows = fields.flatMap(field => String(field).split(/(?<=[.!?。！？])\s+|\n+/).filter(Boolean));
  return windows.some(window => SURVEY_EVIDENCE.test(window) && CONSUMER_POPULATION.test(window));
};

const baselineRecord = (item, collectedAt) => ({
  id: `baseline:${item.id}`,
  type: "market-estimate",
  collectionTrack: "ai-market",
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

// User-provided research is added only after a public source URL and the
// metric definition are checked. These rows are append-only reference records;
// later crawler observations are appended without replacing them.
const VERIFIED_CURATED_AT = "2026-08-16T00:00:00.000Z";
const sourceBackedCuratedRecord = record => {
  const sourceQuantifiedLines = Array.isArray(record.sourceQuantifiedLines)
    ? record.sourceQuantifiedLines.filter(item => item?.line && Array.isArray(item.values) && item.values.length)
    : [];
  const sourceQuantities = [...new Set(sourceQuantifiedLines.flatMap(item => item.values))];
  const sourceText = [...(record.summaryLinesEn || []), ...sourceQuantifiedLines.map(item => item.line)]
    .filter(Boolean).join("\n");
  return {
    ...record,
    collectionTrack: record.collectionTrack || (record.type === "consumer-survey" ? "consumer-survey" : "ai-market"),
    origin: record.origin || "curated-official-source",
    summaryMode: "source-content-extractive",
    displayEligible: true,
    sourceQuantifiedLines,
    sourceQuantities,
    sourceMetricValues: sourceQuantities.map(value => {
      const sourceLine = sourceQuantifiedLines.find(item => item.values.includes(value))?.line || "";
      const configured = (record.values || []).find(item => item.value === value);
      return { label: configured?.label || "공개 지표", value, sourceLine };
    }),
    sourceContent: {
      status: "content-extracted",
      canonicalUrl: record.sourceUrl,
      headline: record.sourceHeadline || record.title,
      text: sourceText,
      fetchedAt: VERIFIED_CURATED_AT,
    },
    provenance: {
      status: "source-backed",
      evidenceCount: sourceQuantifiedLines.length,
      evidenceType: "publisher-page-text-with-quantities",
      checkedAt: VERIFIED_CURATED_AT,
    },
  };
};

const CURATED_SOURCE_RECORDS = [
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
  {
    id: "survey:flipkart-counterpoint-india-ai-phone-2026",
    type: "consumer-survey",
    group: "core",
    verticalId: "core-0",
    title: "인도 스마트폰 구매자의 AI 기능 구매 영향 조사",
    metricLabel: "AI 기능의 구매결정 영향과 생성형 AI 기기 채택",
    values: [
      { label: "AI 기능이 구매결정에 영향", value: "89%" },
      { label: "생성형 AI 기기 채택", value: "30%" },
      { label: "관측 가격대", value: "₹15,000~₹20,000" },
    ],
    scope: "인도 스마트폰 구매자 · 표본 수 미공개 · 국가 한정 조사",
    sourceName: "Flipkart × Counterpoint Research",
    sourceUrl: "https://stories.flipkart.com/announcement/ai-performance-and-affordability-emerge-as-key-drivers-of-smartphone-buying-in-india-counterpoint-research-x-flipkart-report",
    publishedAt: "2026-04-29",
    evidence: "Smartphone Insights Report 2026의 인도 조사 결과. 신흥시장 지표이므로 글로벌 구매의사로 일반화하지 않음.",
    origin: "curated-user-research-primary",
    sourceRegion: "India",
    sourceLanguage: "English",
  },
  {
    id: "survey:emarketer-cnet-us-ai-wtp-2025",
    type: "consumer-survey",
    group: "core",
    verticalId: "core-0",
    title: "미국 스마트폰 사용자의 AI 기능 추가 지불의사 조사",
    metricLabel: "스마트폰 AI 기능 추가 요금 비의향",
    values: [
      { label: "추가 요금 비의향", value: "50%" },
      { label: "2024년 9월 비의향", value: "45%" },
    ],
    scope: "미국 스마트폰 사용자 · CNET 2025년 5월 조사 · 표본·방법론 미공개",
    sourceName: "eMarketer (CNET 조사 재인용)",
    sourceUrl: "https://www.emarketer.com/content/consumers-unwilling-pay-ai-features-1",
    publishedAt: "2025-07-29",
    evidence: "eMarketer의 2차 인용 수치. 원 설문의 표본과 방법론이 공개되지 않아 지불의사 방향성 지표로만 사용.",
    origin: "curated-user-research-secondary",
    sourceRegion: "United States",
    sourceLanguage: "English",
  },
  {
    id: "survey:capgemini-genai-shopping-control-2026",
    type: "consumer-survey",
    group: "assistant",
    verticalId: "assistant-8",
    title: "생성형 AI 쇼핑 도구 활용·통제 요구 조사",
    metricLabel: "쇼핑 AI 사용과 행동·데이터 통제 조건",
    values: [
      { label: "2025년 GenAI 쇼핑 도구 사용", value: "25%" },
      { label: "AI 비서 행동 규칙 요구", value: "76%" },
      { label: "GenAI 데이터 활용 우려", value: "71%" },
    ],
    scope: "글로벌 소비자 12,000명 · 2025년 10월 조사",
    sourceName: "Capgemini Research Institute",
    sourceUrl: "https://www.capgemini.com/insights/research-library/what-matters-to-todays-consumer-2026/",
    publishedAt: "2026-01",
    evidence: "AI 쇼핑 도구의 채택보다 행동 범위·개인정보 통제가 수용성 조건이라는 공개 조사 결과.",
    origin: "curated-user-research-primary",
    sourceRegion: "Global",
    sourceLanguage: "English",
  },
  {
    id: "shipment:counterpoint-foldable-2026-book-type",
    type: "shipment",
    group: "core",
    verticalId: "core-5",
    title: "폴더블 스마트폰 출하·북타입 비중 전망",
    metricLabel: "2026년 글로벌 폴더블 출하 성장과 폼팩터 믹스",
    values: [
      { label: "2026년 출하 성장", value: "+20% YoY" },
      { label: "북타입 비중 (2026)", value: "65%" },
      { label: "북타입 비중 (2025)", value: "52%" },
    ],
    scope: "글로벌 폴더블 스마트폰 출하 · Counterpoint Forecast",
    sourceName: "Counterpoint Research",
    sourceUrl: "https://counterpointresearch.com/en/insights/Book-Type-Devices-to-Reach-of-Global-Foldable-Smartphone-Shipments-in-2026",
    publishedAt: "2026-03-18",
    evidence: "북타입 비중은 2025년 52%에서 2026년 65%로 확대 전망. 출하 성장률은 시장 전망치임.",
    origin: "curated-user-research-primary",
    sourceRegion: "Global",
    sourceLanguage: "English",
  },
  {
    id: "survey:omdia-foldable-consumer-interest-2025",
    type: "consumer-survey",
    group: "core",
    verticalId: "core-5",
    title: "폴더블 스마트폰 인지도·관심 제약 조사",
    metricLabel: "폴더블 인지도와 예산·니즈 적합성",
    values: [
      { label: "폴더블 인지도", value: "96%" },
      { label: "관심 없음", value: "약 40%" },
      { label: "관심 있으나 예산·니즈 불일치", value: "3분의 1 초과" },
    ],
    scope: "5개 글로벌 시장 소비자 5,000명 · 첨단 스마트폰 기술 조사",
    sourceName: "Omdia",
    sourceUrl: "https://omdia.tech.informa.com/blogs/2025/sep/foldable-smartphones-are-moving-into-a-pivotal-2026",
    publishedAt: "2025-09",
    evidence: "인지도는 높지만 관심·가격 적합성은 별개라는 소비자 조사. 출하량이나 구매의향으로 해석하지 않음.",
    origin: "curated-user-research-primary",
    sourceRegion: "Global",
    sourceLanguage: "English",
  },
  {
    id: "shipment:counterpoint-satellite-smartphone-2030",
    type: "shipment",
    group: "core",
    verticalId: "core-41",
    title: "위성 연결 스마트폰 출하·브랜드 비중 전망",
    metricLabel: "위성 연결 스마트폰의 2025년 브랜드 비중과 2030년 침투율",
    values: [
      { label: "Apple 출하 비중 (2025)", value: "71.6%" },
      { label: "Samsung 출하 비중 (2025)", value: "15.9%" },
      { label: "글로벌 출하 침투율 (2030F)", value: "46%" },
    ],
    scope: "글로벌 위성 연결 지원 스마트폰 출하 · 2025년 실적 및 2030년 전망",
    sourceName: "Counterpoint Research",
    sourceUrl: "https://counterpointresearch.com/en/insights/Smartphones-With-Satellite-Connectivity-to-Reach-46-Percent-of-Global-Shipments-by-2030",
    publishedAt: "2026-04-28",
    evidence: "브랜드 비중은 위성 연결 지원 스마트폰 출하에 한정. 46%는 2030년 전체 스마트폰 출하 대비 전망치.",
    origin: "curated-user-research-primary",
    sourceRegion: "Global",
    sourceLanguage: "English",
  },
  {
    id: "market:trendforce-direct-to-cell-2026",
    type: "market-estimate",
    group: "core",
    verticalId: "core-41",
    title: "Direct-to-Cell 위성 연결 시장 규모 전망",
    metricLabel: "스마트폰 직접 위성 연결 시장 규모와 성장률",
    values: [
      { label: "시장 규모 (2026F)", value: "76억 달러" },
      { label: "전년 대비 성장률", value: "약 49%" },
    ],
    scope: "글로벌 Direct-to-Cell 시장 · 스마트폰·통신사업자·공급망 포함",
    sourceName: "TrendForce",
    sourceUrl: "https://www.trendforce.com/presscenter/news/20260427-13020.html",
    publishedAt: "2026-04-27",
    evidence: "3GPP Release 17·18 기반 직접 위성 연결 시장 전망. D2D 서비스 매출과 동일 정의가 아님.",
    origin: "curated-user-research-primary",
    sourceRegion: "Global",
    sourceLanguage: "English",
  },
  {
    id: "market:omdia-smartphone-d2d-2030",
    type: "market-estimate",
    group: "core",
    verticalId: "core-41",
    title: "스마트폰 위성 D2D 서비스 매출·이용자 전망",
    metricLabel: "위성 Direct-to-Device 서비스의 2030년 매출과 월간 활성 이용자",
    values: [
      { label: "서비스 매출 (2030F)", value: "119.9억 달러" },
      { label: "월간 활성 이용자 (2030F)", value: "4억 1,100만 명" },
      { label: "매출 연평균 성장률", value: "49.4%" },
    ],
    scope: "글로벌 스마트폰 위성 D2D 서비스 · 서비스 매출 기준",
    sourceName: "Omdia",
    sourceUrl: "https://omdia.tech.informa.com/pr/2026/mar/smartphone-satellite-direct-to-device-service-revenue-to-approach12-billion-dollars-by-2030",
    publishedAt: "2026-03-02",
    evidence: "서비스 매출·이용자 전망으로, 하드웨어와 서비스를 포함한 D2D 시장 규모와 직접 비교하지 않음.",
    origin: "curated-user-research-primary",
    sourceRegion: "Global",
    sourceLanguage: "English",
  },
  sourceBackedCuratedRecord({
    id: "survey:pew-americans-ai-use-2026",
    discoveryQueryId: "curated-pew-americans-ai-use-2026",
    type: "consumer-survey",
    group: "assistant",
    verticalId: "assistant-0",
    title: "미국 성인의 AI 챗봇 이용·빈도·주요 유즈케이스",
    consolidatedTitle: "AI 이용은 절반 수준, 일상 반복 사용은 4분의 1",
    metricLabel: "AI 챗봇 도달률·일간 사용률·주요 이용 목적",
    values: [
      { label: "조사 표본", value: "5,119 U.S. adults" },
      { label: "AI 챗봇 이용", value: "49%" },
      { label: "일간 이용", value: "24%" },
      { label: "정보 검색", value: "42%" },
      { label: "정서 지원", value: "10%" },
      { label: "컴패니언 이용", value: "4%" },
    ],
    scope: "미국 성인, 2026년 2월 17~23일 조사",
    sourceName: "Pew Research Center",
    sourceUrl: "https://www.pewresearch.org/internet/2026/06/17/americans-and-ai-2026-chatbots-smart-devices-and-views-on-impact/",
    publishedAt: "2026-06-17",
    evidence: "표본·조사 기간·이용률·빈도·용도별 응답을 동일 공식 보고서에서 확인.",
    summaryLinesEn: [
      "We surveyed 5,119 U.S. adults from Feb. 17 to 23, 2026.",
      "About half of U.S. adults now use AI chatbots, up from a third in 2024.",
      "About a quarter of Americans report using chatbots daily.",
    ],
    sourceQuantifiedLines: [
      { line: "We surveyed 5,119 U.S. adults from Feb. 17 to 23, 2026.", values: ["5,119 U.S. adults"] },
      { line: "In 2026, 49% of U.S. adults use AI chatbots.", values: ["49%"] },
      { line: "A net 24% of U.S. adults use AI chatbots daily.", values: ["24%"] },
      { line: "42% use chatbots to search for information.", values: ["42%"] },
      { line: "10% use chatbots for emotional support or advice, while 4% use them for companionship.", values: ["10%", "4%"] },
    ],
    consolidatedInsights: [
      "도달률 49%에 비해 일간 이용은 24%로, 설치보다 반복 사용을 만드는 생활형 기능이 핵심이다.",
      "검색 42%는 강하지만 정서 지원 10%, 컴패니언 4%는 아직 선택적 수요다.",
      "신사업 평가는 전체 AI 관심도보다 과업별 반복 빈도와 결제 전환을 분리해 추적해야 한다.",
    ],
  }),
  sourceBackedCuratedRecord({
    id: "survey:gartner-ai-shopping-control-2026",
    discoveryQueryId: "curated-gartner-ai-shopping-control-2026",
    type: "consumer-survey",
    group: "service",
    verticalId: "service-0",
    title: "AI 쇼핑 지원 수요와 자동 구매 위임 한계",
    consolidatedTitle: "소비자는 AI의 비교·추천은 원하지만 최종 구매 통제권은 유지",
    metricLabel: "상품 선택 지원·구매 결정 위임·정확성 검증 부담",
    values: [
      { label: "자동 구매 결정 허용", value: "11%" },
      { label: "선택지 축소 허용·생활용품", value: "31%" },
      { label: "선택지 축소 허용·전자제품", value: "28%" },
      { label: "모든 정보 재확인", value: "54%" },
      { label: "정보가 시간 낭비", value: "62%" },
    ],
    scope: "미국 소비자 322명(2026년 1월) 및 AI 쇼핑 이용자 조사 846명(2025년 11~12월)",
    sourceName: "Gartner",
    sourceUrl: "https://www.gartner.com/en/newsroom/press-releases/2026-05-27-gartner-survey-finds-consumers-want-ai-shopping-help-but-not-ai-purchase-decisions",
    publishedAt: "2026-05-27",
    evidence: "추천·비교 수용도와 자동 구매 거부, 정확성 재검증 부담을 공식 보도자료에서 분리 확인.",
    summaryLinesEn: [
      "Consumer willingness to let AI make purchase decisions topped out at 11% across lower-stakes categories.",
      "A Gartner survey of 322 U.S. consumers in January 2026 found greater openness to AI tools that help narrow product choices.",
      "Trust and accuracy remain barriers to broader adoption.",
    ],
    sourceQuantifiedLines: [
      { line: "Only 11% of U.S. consumers were willing to let AI make purchase decisions.", values: ["11%"] },
      { line: "31% would allow AI to narrow choices for household supplies and 28% for personal electronics.", values: ["31%", "28%"] },
      { line: "Among recent AI shopping users, 54% double-checked all information and 62% said the information wasted their time.", values: ["54%", "62%"] },
    ],
    consolidatedInsights: [
      "완전 자동 구매보다 비교·필터·딜 탐색을 제공하고 사용자가 승인하는 보조형 경험이 우선이다.",
      "정확성 재확인 54%는 출처·가격 시점·반품 조건을 거래 직전에 검증하는 신뢰 계층의 필요성을 보여준다.",
      "초기 수익모델은 자율 구매 수수료보다 검증된 리드·전환·제휴 수익이 현실적이다.",
    ],
  }),
  sourceBackedCuratedRecord({
    id: "survey:nri-ai-assist-vs-autonomy-2026",
    discoveryQueryId: "curated-nri-ai-assist-vs-autonomy-2026",
    type: "consumer-survey",
    group: "trust",
    verticalId: "trust-0",
    title: "AI 보조 기능과 완전 자율 기능의 소비자 수용 격차",
    consolidatedTitle: "안전·예측 보조는 수용하지만 완전 자율 결정은 저항",
    metricLabel: "예측 정비·안전 기능·완전 자율주행 긍정 인식",
    values: [
      { label: "조사 표본", value: "2,500 consumers" },
      { label: "예측 정비 긍정·뉴욕", value: "64%" },
      { label: "예측 정비 긍정·로스앤젤레스", value: "66%" },
      { label: "완전 자율 긍정·뉴욕", value: "39%" },
      { label: "완전 자율 긍정·로스앤젤레스", value: "47%" },
    ],
    scope: "미국 5대 도시권 소비자, 2025년 3월 조사·2026년 1월 공개",
    sourceName: "Nomura Research Institute",
    sourceUrl: "https://www.nri.com/en/knowledge/report/20260108_1.html",
    publishedAt: "2026-01-08",
    evidence: "공식 보고서의 조사 개요와 도시별 기능 수용률을 직접 확인.",
    summaryLinesEn: [
      "NRI conducted a survey of 2,500 consumers across five major U.S. cities.",
      "AI is widely welcomed when it supports drivers rather than takes control.",
      "Americans are open to AI when it enhances human decisions, but hesitant when AI replaces them entirely.",
    ],
    sourceQuantifiedLines: [
      { line: "NRI conducted a survey of 2,500 consumers across five major U.S. cities.", values: ["2,500 consumers"] },
      { line: "64% of New York and 66% of Los Angeles respondents viewed AI-powered predictive maintenance positively.", values: ["64%", "66%"] },
      { line: "Only 39% of New York and 47% of Los Angeles respondents felt positive about fully autonomous driving.", values: ["39%", "47%"] },
    ],
    consolidatedInsights: [
      "자율성은 한 번에 확대하기보다 알림→추천→승인형 실행→제한적 자동화 순서로 단계화해야 한다.",
      "안전성과 예측 유지관리처럼 결과를 검증하기 쉬운 기능이 초기 유료화 후보에 적합하다.",
      "사용자 통제권·취소·감사 기록을 상품 요건으로 포함해야 수용 격차를 줄일 수 있다.",
    ],
  }),
  sourceBackedCuratedRecord({
    id: "market:sensortower-state-of-ai-h1-2026",
    discoveryQueryId: "curated-sensortower-state-of-ai-h1-2026",
    type: "market-estimate",
    group: "assistant",
    verticalId: "assistant-0",
    title: "생성형 AI 앱 이용시간·인앱결제·다운로드",
    consolidatedTitle: "AI 앱은 이용시간과 결제가 동시에 확대되는 소비자 시장",
    metricLabel: "이용시간·인앱결제 매출·AI 표기 앱 다운로드",
    values: [
      { label: "이용시간·2026년 상반기", value: "36 billion hours" },
      { label: "이용시간·2025년 상반기", value: "17.2 billion hours" },
      { label: "인앱결제 매출·2026년 상반기", value: "$4 billion" },
      { label: "반기 성장", value: "36%" },
      { label: "AI 표기 앱 다운로드", value: "10 billion downloads" },
    ],
    scope: "글로벌 모바일 앱 및 웹, 2026년 상반기 전망",
    sourceName: "Sensor Tower",
    sourceUrl: "https://sensortower.com/press/sensor-tower-state-of-ai-2026-report-global-time-spent-on-generative-ai-apps-projected-to-more-than-double-year-over-year",
    publishedAt: "2026-06-16",
    evidence: "공식 State of AI 2026 공개 요약의 이용시간·매출·다운로드 수치를 분리 저장.",
    summaryLinesEn: [
      "Global time spent on Generative AI apps is projected to climb from 17.2 billion hours in H1 2025 to 36 billion hours in H1 2026.",
      "Global in-app purchase revenue from AI apps is expected to surpass $4 billion in H1 2026.",
      "Apps featuring AI in their descriptions are on track to reach 10 billion global downloads in H1 2026 alone.",
    ],
    sourceQuantifiedLines: [
      { line: "Global time spent on Generative AI apps is projected to climb from 17.2 billion hours in H1 2025 to 36 billion hours in H1 2026.", values: ["17.2 billion hours", "36 billion hours"] },
      { line: "Global in-app purchase revenue from AI apps is expected to surpass $4 billion in H1 2026, an increase of 36% over the second half of 2025.", values: ["$4 billion", "36%"] },
      { line: "Apps featuring AI in their descriptions are on track to reach 10 billion downloads in H1 2026.", values: ["10 billion downloads"] },
    ],
    consolidatedInsights: [
      "이용시간 증가와 결제 증가가 동시에 나타나 무료 트래픽만 큰 시장이 아니라는 점이 확인된다.",
      "단일 서비스 개발 외에도 구독 묶음·크레딧 지갑·발견 채널·결제 수수료가 독립 사업모델이 될 수 있다.",
      "다운로드보다 유료 전환·ARPU·반복 사용시간을 후보 평가의 핵심 KPI로 둬야 한다.",
    ],
  }),
  sourceBackedCuratedRecord({
    id: "market:counterpoint-genai-smartphone-share-2026",
    discoveryQueryId: "curated-counterpoint-genai-smartphone-share-2026",
    type: "shipment",
    group: "core",
    verticalId: "core-0",
    title: "GenAI 스마트폰 출하 비중과 전체 시장 위축",
    consolidatedTitle: "AI 탑재 비중은 늘지만 전체 출하량은 감소",
    metricLabel: "GenAI 탑재 출하 비중·전체 출하량·시장 감소율",
    values: [
      { label: "GenAI 탑재 비중·2026년", value: "45%" },
      { label: "GenAI 탑재 비중·2027년", value: "52%" },
      { label: "전체 시장 감소율·2026년", value: "13.9%" },
      { label: "전체 출하량·2026년", value: "1.08 billion units" },
    ],
    scope: "글로벌 스마트폰 출하 전망, 2026년 6월 업데이트",
    sourceName: "Counterpoint Research",
    sourceUrl: "https://counterpointresearch.com/en/insights/genai-smartphone-share-to-rise-to-45-percent-of-global-shipments-in-2026",
    publishedAt: "2026-06-22",
    evidence: "AI 탑재 비중 확대와 메모리 공급 제약에 따른 전체 시장 감소를 동일 전망에서 함께 확인.",
    summaryLinesEn: [
      "GenAI-capable smartphones are forecast to reach 45% of global shipments in 2026 and 52% in 2027.",
      "The ongoing memory supply crisis is expected to reduce total global smartphone shipments by 13.9% YoY to 1.08 billion units in 2026.",
      "Memory will remain a key factor determining how quickly GenAI expands beyond the high-end segment.",
    ],
    sourceQuantifiedLines: [
      { line: "GenAI-capable smartphones are forecast to reach 45% of global shipments in 2026 and 52% in 2027.", values: ["45%", "52%"] },
      { line: "The memory supply crisis is expected to reduce total global smartphone shipments by 13.9% YoY to 1.08 billion units in 2026.", values: ["13.9%", "1.08 billion units"] },
    ],
    consolidatedInsights: [
      "AI 탑재율 상승만 보면 성장 시장처럼 보이지만, 전체 출하 감소를 함께 보면 설치 기반 확대 속도에는 제약이 있다.",
      "메모리 사용량을 낮춘 경량 모델과 기능별 선택 다운로드가 중가 라인 확산의 핵심 조건이다.",
      "사업성 검토는 탑재 비중과 함께 원가·ASP·교체주기·유료 서비스 ARPU를 연결해야 한다.",
    ],
  }),
  sourceBackedCuratedRecord({
    id: "market:omdia-smartphone-asp-2026",
    discoveryQueryId: "curated-omdia-smartphone-asp-2026",
    type: "market-estimate",
    group: "core",
    verticalId: "core-0",
    title: "글로벌 스마트폰 ASP·출하량·시장가치 전망",
    consolidatedTitle: "출하량 감소 속 ASP와 시장가치는 상승",
    metricLabel: "평균판매가격·출하량·시장가치 변화",
    values: [
      { label: "ASP·2025년", value: "$467" },
      { label: "ASP·2026년", value: "$565" },
      { label: "ASP 증가율", value: "21%" },
      { label: "출하량·2026년", value: "1,093 million units" },
      { label: "출하 감소율", value: "12.2%" },
      { label: "시장가치 증가율", value: "6.1%" },
    ],
    scope: "글로벌 스마트폰 시장, 2026년 전망",
    sourceName: "Omdia",
    sourceUrl: "https://omdia.tech.informa.com/pr/2026/june/global-smartphone-average-selling-price-to-reach-565-dollars-in-2026-as-vendors-prioritize-value-over-volume",
    publishedAt: "2026-06-23",
    evidence: "공식 전망에서 출하량·시장가치·ASP·메모리 원가를 함께 확인.",
    summaryLinesEn: [
      "Total global smartphone shipments are forecast to contract by 12.2% year-on-year in 2026, dropping to 1,093 million units.",
      "Despite this shipment contraction, total market value is projected to grow by 6.1% year-on-year over the same period.",
      "The global smartphone average selling price is forecast to increase from $467 in 2025 to $565 in 2026.",
    ],
    sourceQuantifiedLines: [
      { line: "Total global smartphone shipments are forecast to contract by 12.2% year-on-year in 2026, dropping to 1,093 million units.", values: ["12.2%", "1,093 million units"] },
      { line: "Despite the shipment contraction, total market value is projected to grow by 6.1% year-on-year.", values: ["6.1%"] },
      { line: "The global smartphone average selling price is forecast to increase from $467 in 2025 to $565 in 2026, a 21% increase.", values: ["$467", "$565", "21%"] },
    ],
    consolidatedInsights: [
      "시장 축소 국면에서도 고가화와 서비스 상향판매로 사용자당 가치가 커질 수 있다.",
      "AI 기능은 기기 가격 인상만으로 회수하기보다 구독·보증·클라우드 크레딧과 결합해 생애가치를 높여야 한다.",
      "출하량·시장가치·ASP를 한 화면에서 함께 보여야 성장과 원가 압력을 균형 있게 판단할 수 있다.",
    ],
  }),
  sourceBackedCuratedRecord({
    id: "market:gartner-worldwide-ai-spending-2026",
    discoveryQueryId: "curated-gartner-worldwide-ai-spending-2026",
    type: "market-estimate",
    group: "service",
    verticalId: "service-0",
    title: "세계 AI 지출과 서비스·소프트웨어·인프라 구성",
    consolidatedTitle: "2026년 AI 지출은 인프라 중심, 서비스·소프트웨어도 대형 시장",
    metricLabel: "전체 AI 지출·서비스·소프트웨어·인프라 지출",
    values: [
      { label: "전체 AI 지출·2026년", value: "2,595,667 million USD" },
      { label: "전년 대비 성장", value: "47%" },
      { label: "AI 서비스", value: "585,527 million USD" },
      { label: "AI 소프트웨어", value: "453,209 million USD" },
      { label: "AI 인프라", value: "1,431,509 million USD" },
    ],
    scope: "세계 AI 지출, Gartner 2026년 5월 전망",
    sourceName: "Gartner",
    sourceUrl: "https://www.gartner.com/en/newsroom/press-releases/2026-05-19-gartner-forecasts-worldwide-ai-spending-to-grow-47-percent-in-2026",
    publishedAt: "2026-05-19",
    evidence: "전체 지출과 세부 시장을 동일 통화·동일 연도로 분리 저장.",
    summaryLinesEn: [
      "Worldwide spending on AI is forecast to total $2.59 trillion in 2026, a 47% increase year-over-year.",
      "AI infrastructure is the largest segment of the market and accounts for over 45% of spending.",
      "Enterprises will expand their use of embedded GenAI models and new AI agents within multiple workflows.",
    ],
    sourceQuantifiedLines: [
      { line: "Total AI spending in 2026 is 2,595,667 million USD, up 47% year-over-year.", values: ["2,595,667 million USD", "47%"] },
      { line: "AI services spending in 2026 is 585,527 million USD and AI software spending is 453,209 million USD.", values: ["585,527 million USD", "453,209 million USD"] },
      { line: "AI infrastructure spending in 2026 is 1,431,509 million USD.", values: ["1,431,509 million USD"] },
    ],
    consolidatedInsights: [
      "총액은 데이터센터·반도체·클라우드가 큰 비중을 차지하므로 소비자 서비스 시장과 혼동하면 안 된다.",
      "서비스와 소프트웨어만으로도 큰 지출 풀이 형성돼 보안형 업무 에이전트·관리도구·개발 런타임이 유효한 B2B 후보다.",
      "시장규모 카드는 지출액·사업자 매출·거래액을 반드시 별도 정의로 비교해야 한다.",
    ],
  }),
  sourceBackedCuratedRecord({
    id: "market:juniper-agentic-commerce-2031",
    discoveryQueryId: "curated-juniper-agentic-commerce-2031",
    type: "market-estimate",
    group: "service",
    verticalId: "service-0",
    title: "에이전틱 커머스 거래액 전망",
    consolidatedTitle: "에이전틱 커머스는 초기 거래액이 작지만 급격한 확산이 예상되는 시장",
    metricLabel: "에이전틱 커머스 거래액·전망 기간·증가율",
    values: [
      { label: "거래액·2026년", value: "$8bn" },
      { label: "거래액·2031년", value: "$3.5tn" },
      { label: "거래액 증가", value: "43,240%" },
      { label: "전망 기간", value: "2026-2031" },
    ],
    scope: "글로벌 B2C·B2B 에이전틱 커머스 거래액, 61개 지역 분석",
    sourceName: "Juniper Research",
    sourceUrl: "https://www.juniperresearch.com/research/iot-emerging-technology/ai/agentic-commerce/",
    publishedAt: "2026-04-07",
    evidence: "거래액 전망이며 사업자 매출이나 시장 매출과 동일하지 않음을 별도 정의로 저장.",
    summaryLinesEn: [
      "Total agentic commerce transaction value is forecast at $8bn in 2026.",
      "Total agentic commerce transaction value is forecast at $3.5tn in 2031.",
      "The forecast covers B2C and B2B markets across 61 geographies.",
    ],
    sourceQuantifiedLines: [
      { line: "Total agentic commerce transaction value is $8bn in 2026 and $3.5tn in 2031.", values: ["$8bn", "$3.5tn"] },
      { line: "The 2026-2031 forecast period represents 43,240% value growth.", values: ["2026-2031", "43,240%"] },
    ],
    consolidatedInsights: [
      "거래액은 결제 흐름의 총액이므로 플랫폼 매출과 직접 비교하지 않고 수수료율·승인율·분쟁률을 별도 모델링해야 한다.",
      "초기에는 완전 자율 구매보다 사용자 승인형 결제·가격 검증·구매 한도 기능이 현실적인 진입점이다.",
      "지갑·계정·앱 유통을 연결한 안전한 에이전트 결제 계층이 독립 신사업 후보가 된다.",
    ],
  }),
];

const CURATED_VERTICALS = [
  {
    id: "core-41",
    group: "core",
    name: "스마트폰 위성 연결(D2D)",
    def: "스마트폰이 지상망이 닿지 않는 곳에서도 위성과 직접 연결되는 통신·서비스 레이어",
    size: "50.3억 달러 (2026, D2D 연결 전체)",
    forecast: "138.0억 달러 (2031)",
    cagr: "22.37%",
    source: "Mordor Intelligence",
    date: "2026-03-18",
    url: "https://www.mordorintelligence.com/industry-reports/direct-to-device-satellite-connectivity-market",
    extra: [
      { t: "D2D 서비스 매출은 Omdia 기준 2030년 119.9억 달러 전망 — 정의 차이로 직접 비교 금지", url: "https://omdia.tech.informa.com/pr/2026/mar/smartphone-satellite-direct-to-device-service-revenue-to-approach12-billion-dollars-by-2030" },
    ],
  },
  {
    id: "wearxr-42",
    group: "wearxr",
    name: "AI 스마트링",
    def: "수면·활동·건강 데이터를 상시 분석하는 링형 웨어러블 AI 폼팩터",
    size: "15.8억 달러 (2026)",
    forecast: "36.0억 달러 (2030)",
    cagr: "22.9%",
    source: "Research and Markets",
    date: "2026",
    url: "https://www.researchandmarkets.com/reports/6226716/ai-ring-global-market-report",
    extra: [
      { t: "시장 정의·추정치는 AI 링 세그먼트에 한정 — 전체 웨어러블 시장과 직접 합산 금지", url: "https://www.thebusinessresearchcompany.com/report/artificial-intelligence-ai-ring-market-report" },
    ],
  },
];

export function appendRecords(data, candidates = [], collectedAt = isoNow()) {
  data.records = Array.isArray(data.records) ? data.records : [];
  const seen = new Set(data.records.map(identity));
  let added = 0;
  for (const candidate of candidates) {
    const sourceUrl = canonicalUrl(candidate.sourceUrl);
    const values = Array.isArray(candidate.values) ? candidate.values : [];
    const pendingSourcePage = candidate.provenance?.status === "pending-source-page";
    if (!sourceUrl || !candidate.title || (!values.length && !pendingSourcePage)) continue;
    const record = {
      ...candidate,
      collectionTrack: candidate.collectionTrack || (candidate.type === "consumer-survey" ? "consumer-survey" : "ai-market"),
      id: candidate.id || `crawl:${hash(`${candidate.type}|${sourceUrl}|${candidate.title}|${candidate.publishedAt || ""}`)}`,
      sourceUrl,
      collectedAt: candidate.collectedAt || collectedAt,
      // New crawler candidates are retained immediately, but are not a
      // published fact until their linked publisher page has been extracted.
      provenance: candidate.provenance || {
        status: "pending-source-page",
        evidenceCount: 0,
        evidenceType: "discovery-only",
        checkedAt: collectedAt,
        issues: ["publisher-page-extraction-required"],
      },
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
  data.schemaVersion = Math.max(Number(data.schemaVersion || 1), 4);
  data.database = {
    ...(data.database || {}),
    mode: "append-only",
    recordSchemaVersion: 3,
    retentionPolicy: "Canonical records are never removed by automation. User suppression hides matching records from public views and future collection while preserving the historical ledger.",
    collectionTracks: ["consumer-survey", "ai-market"],
    sourcePolicy: "Every visible quantitative record requires a resolved publisher page, extracted source text, and source-bound quantities. RSS discovery rows remain append-only but hidden until verified.",
    migratedAt: data.database?.migratedAt || collectedAt,
  };
  data.records = Array.isArray(data.records) ? data.records : [];
  data.items = Array.isArray(data.items) ? data.items : [];

  const existingVerticals = new Set(data.items.map(item => item.id));
  for (const vertical of CURATED_VERTICALS) {
    if (existingVerticals.has(vertical.id)) continue;
    data.items.push(vertical);
    existingVerticals.add(vertical.id);
    changed = true;
  }

  // Correct an older crawler classification without removing or replacing any
  // record. Its source, values, and provenance remain append-only history.
  for (const record of data.records) {
    if (record.origin === "rss-quantitative-crawl" && record.type === "consumer-survey" && !hasConsumerSurveyEvidence(record)) {
      record.type = "market-observation";
      record.collectionTrack = "ai-market";
      changed = true;
    }
    const expectedTrack = record.type === "consumer-survey" ? "consumer-survey" : "ai-market";
    if (record.collectionTrack !== expectedTrack) {
      record.collectionTrack = expectedTrack;
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
  const addedCuratedRecords = appendRecords(data, CURATED_SOURCE_RECORDS, collectedAt);
  if (addedCuratedRecords) changed = true;
  data.database.recordCount = data.records.length;
  data.database.lastValidatedAt = collectedAt;
  return { changed, addedCuratedRecords };
}

export const sourceLinked = record => hasSource(record) && record.provenance?.status !== "reference-only";
