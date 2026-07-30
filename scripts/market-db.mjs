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
