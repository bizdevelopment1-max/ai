#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalUrl } from "./market-db.mjs";
import { consolidateMarketRecords } from "./market-consolidation.mjs";
import { isExcludedText } from "./news-policy.mjs";
import { loadSuppressionRegistry } from "./suppression-registry.mjs";

const OUTPUT = "mobile-ai-business-view.json";
const now = new Date().toISOString();
const compact = value => String(value || "").replace(/\s+/g, " ").trim();
const normalized = value => compact(value).toLocaleLowerCase();
const dateValue = value => {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const stableHash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
const readJson = async (file, fallback) => {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; }
};

const MODEL_LABELS = {
  subscription: "구독·멤버십",
  hardware: "기기 판매·가격 프리미엄",
  ads: "광고·커머스·수수료",
  usage: "사용량·크레딧",
  enterprise: "기업 라이선스·관리",
  outcome: "성과 기반 과금",
  vertical: "자체 서비스·수직통합",
};

const COMPETITOR_CANON = {
  "Google DeepMind": "Google AI",
  "Meta AI": "Meta",
  OpenAI: "ChatGPT",
  Anthropic: "Claude",
};

const COMPETITOR_SIGNAL_ALIASES = {
  "Google DeepMind": ["Google", "Gemini"],
  "Meta AI": ["Meta"],
  OpenAI: ["OpenAI", "ChatGPT"],
  Anthropic: ["Anthropic", "Claude"],
  Apple: ["Apple", "iCloud", "Siri"],
  Microsoft: ["Microsoft", "Copilot"],
  Amazon: ["Amazon", "Alexa", "AWS"],
};

const RESEARCH_SOURCE = /counterpoint|sensor tower|appfigures|idc|canalys|omdia|deloitte|pew research|capgemini|gartner|mckinsey/i;
const OFFICIAL_HOST = /(?:^|\.)(?:apple\.com|google\.com|blog\.google|about\.fb\.com|openai\.com|anthropic\.com|microsoft\.com|amazon\.com|aws\.amazon\.com|stripe\.com|salesforce\.com)$/i;

const sourceTier = record => {
  const name = `${record?.sourceName || record?.source || ""}`;
  let host = "";
  try { host = new URL(record?.sourceUrl || record?.url || "").hostname; } catch {}
  if (RESEARCH_SOURCE.test(`${name} ${host}`)) return 3;
  if (OFFICIAL_HOST.test(host)) return 3;
  return 1;
};

const MARKET_TOPICS = [
  {
    id: "device-adoption",
    label: "AI 단말 보급",
    accent: "#2D6BFF",
    include: /(?:genai|generative ai|생성형 ai|ai)[^\n]{0,35}(?:smartphone|phone|mobile device|스마트폰|휴대폰|단말)|(?:smartphone|phone|mobile device|스마트폰|휴대폰|단말)[^\n]{0,35}(?:genai|generative ai|생성형 ai|ai)/i,
  },
  {
    id: "mobile-app-economy",
    label: "모바일 AI 앱 경제",
    accent: "#66558C",
    include: /(?:mobile|app|iap|앱|모바일)[^\n]{0,45}(?:generative ai|genai|ai assistant|ai companion|생성형 ai|ai 비서|ai 컴패니언)/i,
  },
  {
    id: "wearable-ai",
    label: "웨어러블 AI",
    accent: "#A66B3F",
    include: /ai[^\n]{0,30}(?:glasses|wearable|earbuds|hearable|smart ring|안경|웨어러블|이어버드|스마트링)|(?:glasses|wearable|earbuds|hearable|smart ring|안경|웨어러블|이어버드|스마트링)[^\n]{0,30}ai/i,
  },
  {
    id: "agent-commerce",
    label: "에이전트 커머스",
    accent: "#0E8F6E",
    include: /(?:agentic|ai agent|assistant|에이전트|ai 비서)[^\n]{0,40}(?:commerce|shopping|payment|checkout|transaction|커머스|쇼핑|결제|거래)/i,
  },
  {
    id: "health-context",
    label: "건강·개인 컨텍스트",
    accent: "#DB2777",
    include: /(?:ai|인공지능)[^\n]{0,35}(?:health|wellness|medical|mental health|건강|웰니스|의료|멘탈)|(?:health|wellness|medical|건강|웰니스|의료)[^\n]{0,35}(?:ai|인공지능)/i,
  },
  {
    id: "trust-safety",
    label: "신뢰·안전",
    accent: "#287A78",
    include: /(?:ai|인공지능)[^\n]{0,35}(?:privacy|security|scam|deepfake|trust|consent|개인정보|보안|스캠|딥페이크|신뢰|동의)/i,
  },
];

const SEEDED_MARKETS = [
  {
    stableKey: "market:device-adoption",
    topicId: "device-adoption",
    topic: "AI 단말 보급",
    title: "GenAI 지원 스마트폰 출하 비중",
    metrics: [
      { label: "2025 출하 비중", value: "36%" },
      { label: "2026 전망", value: "45%" },
      { label: "2027 전망", value: "52%" },
    ],
    insight: "고가 제품 중심 기능에서 전체 시장의 표준 기능으로 이동 · 교체 유인보다 일상 사용성과 수익모델 증명이 다음 경쟁축",
    sourceName: "Counterpoint Research",
    sourceUrl: "https://counterpointresearch.com/en/insights/genai-smartphone-share-to-rise-to-45-percent-of-global-shipments-in-2026",
    publishedAt: "2026-06-22",
    sourceTier: 3,
    provenance: "source-verified",
  },
  {
    stableKey: "market:mobile-app-economy",
    topicId: "mobile-app-economy",
    topic: "모바일 AI 앱 경제",
    title: "생성형 AI 모바일 앱 인앱결제 시장",
    metrics: [
      { label: "2025 Q2–2026 Q1 IAP", value: "$6.1B" },
      { label: "전년 대비 성장", value: "+232%" },
      { label: "2026 Q1 매출", value: "$1.9B" },
    ],
    insight: "범용 비서 매출은 집중 · 컴패니언·에이전트·이미지·영상 등 버티컬은 성장과 경쟁 분산이 동시에 진행",
    sourceName: "Sensor Tower",
    sourceUrl: "https://sensortower.com/blog/state-of-ai-apps-in-apac-2026-report",
    publishedAt: "2026-06-01",
    sourceTier: 3,
    provenance: "source-verified",
  },
  {
    stableKey: "market:vertical-ai-apps",
    topicId: "mobile-app-economy",
    topic: "버티컬 AI 앱",
    title: "모바일 AI 버티컬의 유료화 깊이",
    metrics: [
      { label: "AI 컴패니언 2026 Q1 매출", value: "$150M" },
      { label: "2023 Q1 대비 성장", value: "12배+" },
      { label: "전문 AI 기기·앱 다운로드당 매출", value: "$47" },
    ],
    insight: "범용 비서와 다른 전문 사용 장면에서 높은 지불의사 확인 · 전용 기기와 앱을 결합한 하이브리드 모델의 수익화 밀도 확대",
    sourceName: "Sensor Tower",
    sourceUrl: "https://sensortower.com/blog/state-of-ai-apps-in-apac-2026-report",
    publishedAt: "2026-06-01",
    sourceTier: 3,
    provenance: "source-verified",
  },
  {
    stableKey: "market:trust-safety",
    topicId: "trust-safety",
    topic: "신뢰·안전",
    title: "일상 AI의 통제권과 신뢰 요구",
    metrics: [
      { label: "AI 확산 우려", value: "50%" },
      { label: "더 많은 통제권 희망", value: "약 60%" },
      { label: "일상 업무 보조 수용", value: "약 75%" },
    ],
    insight: "사용자는 AI 보조 자체보다 데이터 사용과 실행 권한의 통제 가능성을 중시 · 개인 컨텍스트 서비스의 핵심 상품은 모델 성능과 함께 동의·기록·철회 경험",
    sourceName: "Pew Research Center",
    sourceUrl: "https://www.pewresearch.org/science/2025/09/17/how-americans-view-ai-and-its-impact-on-people-and-society/",
    publishedAt: "2025-09-17",
    sourceTier: 3,
    provenance: "source-verified",
  },
];

const SEEDED_COMPETITORS = [
  {
    stableKey: "competitor:google-ai",
    name: "Google AI",
    segment: "AI 비서·생산성 번들",
    businessModel: "구독·멤버십",
    modelId: "subscription",
    metrics: [
      { label: "AI Plus", value: "$9.99/월" },
      { label: "AI Pro", value: "$19.99/월" },
      { label: "AI Ultra", value: "$100/월" },
    ],
    proof: "저장공간·생산성 앱·창작 도구·모델 사용 한도를 하나의 등급제로 결합 · 초과 수요는 크레딧으로 추가 과금",
    sourceName: "Google One · Google Blog",
    sourceUrl: "https://blog.google/products-and-platforms/products/google-one/google-ai-subscriptions/",
    publishedAt: "2026-05-19",
    sourceTier: 3,
    provenance: "source-verified",
  },
  {
    stableKey: "competitor:apple",
    name: "Apple",
    segment: "OS·개인 AI 경험",
    businessModel: "구독 번들·기기 생태계",
    modelId: "subscription",
    metrics: [
      { label: "과금 단위", value: "iCloud+ 등급" },
      { label: "유료 혜택", value: "서버형 AI 사용 한도 확대" },
    ],
    proof: "기본 AI 기능은 지원 기기에 포함 · 서버 연산이 필요한 일부 기능의 확대 사용량을 클라우드 구독과 결합",
    sourceName: "Apple Newsroom",
    sourceUrl: "https://www.apple.com/newsroom/2026/06/apple-intelligence-brings-powerful-ai-capabilities-into-everyday-experiences/",
    publishedAt: "2026-06-08",
    sourceTier: 3,
    provenance: "source-verified",
  },
  {
    stableKey: "competitor:meta",
    name: "Meta",
    segment: "AI 웨어러블",
    businessModel: "기기 판매·가격 프리미엄",
    modelId: "hardware",
    metrics: [
      { label: "AI 안경 시작가", value: "$299" },
      { label: "출시 스타일", value: "26종" },
      { label: "판매 검증", value: "수백만 대" },
    ],
    proof: "패션 파트너의 유통력과 상시형 AI 경험을 결합 · 기기 매출을 먼저 확보하고 개발자 앱 생태계로 확장",
    sourceName: "Meta Newsroom",
    sourceUrl: "https://about.fb.com/news/2026/06/meta-essilorluxottica-partner-launch-meta-glasses/",
    publishedAt: "2026-06-23",
    sourceTier: 3,
    provenance: "source-verified",
  },
  {
    stableKey: "competitor:chatgpt",
    name: "ChatGPT",
    segment: "모바일 AI 비서",
    businessModel: "앱 구독·인앱결제",
    modelId: "subscription",
    metrics: [
      { label: "모바일 누적 소비지출", value: "$5B" },
      { label: "2026년 3월 다운로드당 매출", value: "$6.73" },
    ],
    proof: "대규모 무료 이용자를 반복 구독 매출로 전환 · 모바일 유통이 모델 사용을 소비자 소프트웨어 매출로 연결",
    sourceName: "Appfigures Intelligence",
    sourceUrl: "https://appfigures.com/resources/insights/chatgpt-fastest-app-5b-mobile/amp",
    publishedAt: "2026-06-02",
    sourceTier: 3,
    provenance: "source-verified",
  },
  {
    stableKey: "competitor:claude",
    name: "Claude",
    segment: "모바일 AI 비서",
    businessModel: "앱 구독·인앱결제",
    modelId: "subscription",
    metrics: [
      { label: "모바일 누적 소비지출", value: "$319M" },
      { label: "2026년 5월 매출", value: "$92M" },
    ],
    proof: "고급 모델과 업무 생산성을 유료 구독으로 전환 · 설치 규모보다 고가치 사용자의 지출 확대로 성장",
    sourceName: "Appfigures Intelligence",
    sourceUrl: "https://appfigures.com/resources/insights/chatgpt-fastest-app-5b-mobile/amp",
    publishedAt: "2026-06-02",
    sourceTier: 3,
    provenance: "source-verified",
  },
  {
    stableKey: "competitor:perplexity",
    name: "Perplexity",
    segment: "검색·개인 에이전트",
    businessModel: "앱 구독·인앱결제",
    modelId: "subscription",
    metrics: [
      { label: "모바일 누적 소비지출", value: "$100M+" },
      { label: "2026년 5월 매출", value: "$14M" },
    ],
    proof: "검색과 실행형 에이전트를 고급 구독으로 묶어 반복 매출 확보 · 단말·브라우저 배포로 사용 접점 확장",
    sourceName: "Appfigures Intelligence",
    sourceUrl: "https://appfigures.com/resources/insights/chatgpt-fastest-app-5b-mobile/amp",
    publishedAt: "2026-06-02",
    sourceTier: 3,
    provenance: "source-verified",
  },
];

const OPPORTUNITY_FRAMEWORK = [
  {
    id: "personal-agent-bundle",
    priority: 1,
    title: "개인 에이전트 구독 번들",
    whereToPlay: "통화·메시지·검색·일정·사진을 연결하는 개인 실행 계층",
    valueCapture: "기본 기능 무료 + 고급 모델·클라우드 연산·가족 공유 월 구독",
    evidenceKeys: ["market:mobile-app-economy", "competitor:google-ai", "competitor:apple", "competitor:chatgpt"],
    rationale: "모바일 AI 지출이 빠르게 성장하고 플랫폼 사업자는 저장공간·생산성·모델 한도를 하나의 구독으로 묶는 중",
    nextMetrics: ["주간 활성 이용자", "유료 전환율", "가입자당 추론원가", "번들 ARPU"],
  },
  {
    id: "vertical-ai-store",
    priority: 2,
    title: "버티컬 AI 서비스 스토어",
    whereToPlay: "건강·학습·여행·크리에이티브·업무 앱의 검증·배포·과금",
    valueCapture: "구독 수익배분 + 사용량 수수료 + 추천·프로모션",
    evidenceKeys: ["market:mobile-app-economy", "market:vertical-ai-apps", "competitor:chatgpt", "competitor:claude"],
    rationale: "범용 비서의 매출 집중과 버티컬 시장의 경쟁 분산이 동시에 진행 · 유통·결제·신뢰 계층의 가치 확대",
    nextMetrics: ["활성 AI 서비스 수", "유료 GMV", "서비스별 재구매율", "파트너 정산율"],
  },
  {
    id: "wearable-companion",
    priority: 3,
    title: "웨어러블 AI 컴패니언",
    whereToPlay: "카메라·음성·건강 센서를 이용한 상시형 보조 경험",
    valueCapture: "기기 가격 프리미엄 + 전문 기능 구독 + 파트너 앱 수익배분",
    evidenceKeys: ["competitor:meta", "market:device-adoption"],
    rationale: "AI 기능을 화면 밖으로 확장하는 기기 판매 모델이 검증 단계에 진입 · 접근성·업무·운동 등 명확한 사용 장면 확보",
    nextMetrics: ["일일 착용 시간", "AI 호출 빈도", "기기 총이익", "유료 기능 부착률"],
  },
  {
    id: "private-context-vault",
    priority: 4,
    title: "개인 컨텍스트 금고",
    whereToPlay: "개인 데이터·동의·권한·기기 간 메모리를 관리하는 신뢰 계층",
    valueCapture: "개인 구독 + 기업 관리 라이선스 + 파트너 접근 수수료",
    evidenceKeys: ["competitor:apple", "competitor:google-ai", "market:device-adoption"],
    rationale: "AI 기능의 차별화가 모델 성능에서 개인 데이터 접근과 안전한 실행 권한으로 이동",
    nextMetrics: ["로컬 처리 비중", "동의 유지율", "권한형 도구 수", "보안 사고율"],
  },
];

const marketText = record => [
  record.title,
  record.consolidatedTitle,
  record.topic,
  record.metricLabel,
  record.evidence,
  ...(record.consolidatedInsights || []),
  ...(record.sourceQuantifiedLines || []).map(item => item?.line),
].filter(Boolean).join(" ");

const marketCandidate = record => {
  if (record?.displayEligible !== true || record?.provenance?.status !== "source-backed") return null;
  if (!record.sourceUrl || isExcludedText(JSON.stringify(record))) return null;
  if (!Array.isArray(record.sourceMetricValues) || !record.sourceMetricValues.length) return null;
  const text = marketText(record);
  const topic = MARKET_TOPICS.find(item => item.include.test(text));
  if (!topic || sourceTier(record) < 2) return null;
  const metrics = record.sourceMetricValues.filter(metric => {
    const value = compact(metric?.value);
    const label = compact(metric?.label);
    return label && value
      && !/^0\d{2,}(?:\D|$)/.test(value)
      && !/^20\d{2}$/.test(value)
      && !/비교 기준 연도|원문 수치/.test(label);
  }).slice(0, 4);
  if (metrics.length < 2) return null;
  return {
    stableKey: `market:${topic.id}`,
    topicId: topic.id,
    topic: topic.label,
    title: record.consolidatedTitle || record.localization?.title || record.title,
    metrics: metrics.map(metric => ({ label: metric.label, value: metric.value })),
    insight: (record.consolidatedInsights || record.summaryLinesKo || record.summaryLinesEn || []).slice(0, 2).join(" · "),
    sourceName: record.sourceName,
    sourceUrl: canonicalUrl(record.sourceUrl),
    publishedAt: record.publishedAt,
    sourceTier: sourceTier(record),
    provenance: "source-backed",
    relatedSources: record.relatedSources || [],
  };
};

const latestByStableKey = candidates => {
  const selected = new Map();
  for (const candidate of candidates.filter(Boolean)) {
    if (!candidate.stableKey || !candidate.sourceUrl || isExcludedText(JSON.stringify(candidate))) continue;
    const existing = selected.get(candidate.stableKey);
    const newer = !existing
      || dateValue(candidate.publishedAt) > dateValue(existing.publishedAt)
      || (dateValue(candidate.publishedAt) === dateValue(existing.publishedAt)
        && Number(candidate.sourceTier || 0) > Number(existing.sourceTier || 0));
    if (newer) selected.set(candidate.stableKey, candidate);
  }
  return [...selected.values()].sort((left, right) => dateValue(right.publishedAt) - dateValue(left.publishedAt));
};

const canon = value => canonicalUrl(value) || compact(value).replace(/[?#].*$/, "");
const strictDynamicCompetitors = (monetization, news) => {
  const articleByUrl = new Map((news.articles || []).map(article => [canon(article.url), article]));
  const output = [];
  for (const company of monetization.companies || []) {
    if (!company?.name || isExcludedText(company.name)) continue;
    const displayName = COMPETITOR_CANON[company.name] || company.name;
    const signals = [];
    for (const signal of company.monetize || []) {
      const article = articleByUrl.get(canon(signal.url));
      if (!article || article.displayEligible === false || article.provenance?.status !== "source-backed") continue;
      if (article.summaryMode !== "source-content-extractive" || isExcludedText(JSON.stringify(article))) continue;
      const assigned = normalized(article.co) === normalized(company.name);
      if (!assigned) continue;
      const aliases = COMPETITOR_SIGNAL_ALIASES[company.name] || [company.name];
      if (!aliases.some(alias => normalized(signal.signal).includes(normalized(alias)))) continue;
      const modelId = signal.model;
      const moneyContext = /revenue|sales|subscription|pricing|price|paid|premium|bundle|commission|transaction|usage-based|license|매출|판매|구독|가격|유료|프리미엄|번들|수수료|거래|과금|라이선스/i;
      if (!MODEL_LABELS[modelId] || !moneyContext.test(signal.signal || "")) continue;
      const tier = sourceTier({ sourceName: signal.source, sourceUrl: signal.url });
      if (tier < 3) continue;
      signals.push({
        modelId,
        businessModel: MODEL_LABELS[modelId],
        proof: compact(signal.signal),
        sourceName: signal.source || article.source,
        sourceUrl: canon(signal.url),
        publishedAt: signal.date || article.date,
        sourceTier: tier,
      });
    }
    if (!signals.length) continue;
    const latest = latestByStableKey(signals.map(signal => ({ ...signal, stableKey: `${company.name}:${signal.modelId}` }))).slice(0, 3);
    output.push({
      stableKey: `competitor:${normalized(displayName).replace(/[^a-z0-9가-힣]+/g, "-")}`,
      name: displayName,
      segment: company.vertical || "AI 서비스",
      businessModel: latest.map(signal => signal.businessModel).join(" + "),
      modelId: latest[0].modelId,
      metrics: [],
      proof: latest.map(signal => signal.proof).join(" · "),
      sourceName: latest[0].sourceName,
      sourceUrl: latest[0].sourceUrl,
      publishedAt: latest[0].publishedAt,
      sourceTier: latest[0].sourceTier,
      provenance: "source-backed",
      evidence: latest,
    });
  }
  return output;
};

const previousIdentity = payload => new Map([
  ...(payload?.markets || []),
  ...(payload?.competitors || []),
].map(item => [item.stableKey, `${item.sourceUrl}|${item.publishedAt}|${stableHash(item.metrics || item.proof)}`]));

const main = async () => {
  const [market, monetization, news, previous, suppression] = await Promise.all([
    readJson("market.json", { records: [] }),
    readJson("monetization.json", { companies: [] }),
    readJson("news.json", { articles: [] }),
    readJson(OUTPUT, null),
    loadSuppressionRegistry(),
  ]);

  const rawMarket = (market.records || []).filter(record => !suppression.matches(record, "market"));
  const consolidated = consolidateMarketRecords(rawMarket);
  const markets = latestByStableKey([
    ...SEEDED_MARKETS,
    ...consolidated.map(marketCandidate),
  ]).map(item => ({ ...item, metrics: (item.metrics || []).slice(0, 4) }));

  const dynamicCompetitors = strictDynamicCompetitors(monetization, news);
  const competitors = latestByStableKey([
    ...SEEDED_COMPETITORS,
    ...dynamicCompetitors,
  ]).slice(0, 18);

  const evidence = new Map([...markets, ...competitors].map(item => [item.stableKey, item]));
  const opportunities = OPPORTUNITY_FRAMEWORK.map(item => {
    const support = item.evidenceKeys.map(key => evidence.get(key)).filter(Boolean);
    const freshness = support.reduce((latest, source) => Math.max(latest, dateValue(source.publishedAt)), 0);
    return {
      ...item,
      evidenceCount: new Set(support.map(source => source.sourceUrl)).size,
      latestEvidenceAt: freshness ? new Date(freshness).toISOString().slice(0, 10) : "",
      sources: support.map(source => ({
        title: source.title || source.name,
        sourceName: source.sourceName,
        sourceUrl: source.sourceUrl,
        publishedAt: source.publishedAt,
      })),
    };
  }).filter(item => item.evidenceCount >= 2);

  const previousMap = previousIdentity(previous);
  const currentRows = [...markets, ...competitors];
  const replacementCount = currentRows.filter(item => {
    const before = previousMap.get(item.stableKey);
    const after = `${item.sourceUrl}|${item.publishedAt}|${stableHash(item.metrics || item.proof)}`;
    return before && before !== after;
  }).length;
  const retiredCount = [...previousMap.keys()].filter(key => !currentRows.some(item => item.stableKey === key)).length;
  const snapshotCore = { markets, competitors, opportunities };
  const snapshotVersion = stableHash(snapshotCore);

  const output = {
    generatedAt: now,
    schemaVersion: 2,
    snapshotVersion,
    database: {
      mode: "latest-verified-snapshot",
      replacementPolicy: "stable-key + newest verified source",
      publicRetention: "current-only",
      rawLedger: "audit-only",
      replacementCount,
      retiredCount,
      previousSnapshotVersion: previous?.snapshotVersion || "",
    },
    summary: {
      marketTopics: markets.length,
      competitors: competitors.length,
      businessModels: new Set(competitors.map(item => item.businessModel)).size,
      opportunities: opportunities.length,
      sources: new Set(currentRows.map(item => item.sourceUrl)).size,
    },
    markets,
    competitors,
    opportunities,
  };

  if (isExcludedText(JSON.stringify(output))) throw new Error("public mobile AI business snapshot contains a configured excluded term");
  await writeFile(OUTPUT, `${JSON.stringify(output)}\n`);
  console.log(`[mobile-ai-business] ${markets.length} markets · ${competitors.length} competitors · ${opportunities.length} opportunities · ${replacementCount} replaced · ${snapshotVersion}`);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
