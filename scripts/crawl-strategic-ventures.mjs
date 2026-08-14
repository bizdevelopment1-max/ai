#!/usr/bin/env node
/**
 * Source-backed tracker for the new "deployment company" business model.
 * Facts remain attached to the exact publisher page that supports them and
 * every run re-checks source availability and key phrases.
 */
import { writeFile } from "node:fs/promises";

const UA = "Mozilla/5.0 (compatible; AI-Strategy-Research/1.0; +https://bizdevelopment1-max.github.io/ai/)";
const SOURCES = [
  {
    id: "openai-official",
    publisher: "OpenAI",
    date: "2026-05-11",
    url: "https://openai.com/index/openai-launches-the-deployment-company/",
    required: ["Deployment Company", "majority-owned", "$4 billion", "Forward Deployed Engineers", "Tomoro"],
  },
  {
    id: "openai-axios",
    publisher: "Axios",
    date: "2026-05-11",
    url: "https://www.axios.com/2026/05/11/openai-deployco-private-equity",
    required: ["17.5%", "$10 billion", "majority control"],
  },
  {
    id: "anthropic-official",
    publisher: "Anthropic",
    date: "2026-05-04",
    url: "https://www.anthropic.com/news/enterprise-ai-services-company",
    required: ["Blackstone", "Hellman & Friedman", "Goldman Sachs", "mid-sized", "Applied AI"],
  },
  {
    id: "anthropic-capital",
    publisher: "Fortune",
    date: "2026-05-04",
    url: "https://fortune.com/2026/05/04/anthropic-claude-consulting-industry-joint-venture-blackstone-goldman-sachs/",
    required: ["$1.5 billion"],
  },
  {
    id: "market",
    publisher: "The Business Research Company",
    date: "2026-07",
    url: "https://www.thebusinessresearchcompany.com/report/artificial-intelligence-ai-consulting-market-report",
    required: ["$19.47 billion", "21.4%"],
  },
  {
    id: "apple-foundation-models",
    publisher: "Apple Machine Learning Research",
    date: "2026-06-08",
    url: "https://machinelearning.apple.com/research/introducing-third-generation-of-apple-foundation-models",
    required: ["third generation", "on-device", "Private Cloud Compute", "AFM 3 Core"],
  },
  {
    id: "intercom-outcomes",
    publisher: "Intercom",
    date: "2026-06-26",
    url: "https://www.intercom.com/help/en/articles/8205718-fin-ai-agent-outcomes",
    required: ["Outcome pricing", "$0.99", "$9.99", "unsuccessful"],
  },
  {
    id: "servicenow-ai-agents",
    publisher: "ServiceNow",
    date: "2025-03-12",
    url: "https://newsroom.servicenow.com/press-releases/details/2025/ServiceNows-latest-platform-release-adds-to-thousands-of-AI-agents-across-CRM-HR-IT-and-more-for-faster-smarter-workflows-and-maximum-business-impact-03-12-2025-traffic/default.aspx",
    required: ["AI Agent Orchestrator", "AI Agent Studio", "lifecycle", "ROI"],
  },
  {
    id: "salesforce-agentexchange",
    publisher: "Salesforce",
    date: "2025-03-04",
    url: "https://www.salesforce.com/news/press-releases/2025/03/04/agentexchange-announcement/",
    required: ["AgentExchange", "200", "actions", "templates"],
  },
  {
    id: "microsoft-agent-store",
    publisher: "Microsoft Learn",
    date: "2026-04-20",
    url: "https://learn.microsoft.com/en-us/microsoft-365/copilot/copilot-agent-store",
    required: ["Agent Store", "central hub", "trusted partners", "external platforms"],
  },
  {
    id: "aws-agent-marketplace",
    publisher: "AWS",
    date: "2025-10-08",
    url: "https://aws.amazon.com/about-aws/whats-new/2025/10/aws-marketplace-pricing-ai-agents-tools/",
    required: ["usage-based", "contract-based", "AgentCore", "MCP"],
  },
  {
    id: "stripe-agentic-commerce",
    publisher: "Stripe",
    date: "2025-09-29",
    url: "https://stripe.com/gb/newsroom/news/stripe-openai-instant-checkout",
    required: ["Instant Checkout", "Agentic Commerce Protocol", "OpenAI", "Etsy"],
  },
  {
    id: "openai-instacart",
    publisher: "OpenAI",
    date: "2025-12-08",
    url: "https://openai.com/index/instacart-partnership/",
    required: ["Instacart", "Instant Checkout", "Agentic Commerce Protocol", "grocery"],
  },
  {
    id: "cloudflare-pay-per-crawl",
    publisher: "Cloudflare",
    date: "2025-07-01",
    url: "https://blog.cloudflare.com/introducing-pay-per-crawl/",
    required: ["pay per crawl", "402", "Merchant of Record", "Charge"],
  },
  {
    id: "nvidia-telco-ai-grid",
    publisher: "NVIDIA",
    date: "2026-07",
    url: "https://www.nvidia.com/en-us/industries/telecommunications/",
    required: ["AI grid", "GPU-as-a-service", "AI-as-a-service", "AI-RAN"],
  },
];

const strip = html => String(html || "")
  .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&#0*39;|&apos;/gi, "'")
  .replace(/&quot;/gi, "\"")
  .replace(/\s+/g, " ")
  .trim();

async function checkSource(source) {
  try {
    const response = await fetch(source.url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    const text = response.ok ? strip(await response.text()) : "";
    const matched = source.required.filter(term => text.toLowerCase().includes(term.toLowerCase()));
    return {
      ...source,
      resolvedUrl: response.url || source.url,
      status: response.ok && matched.length >= Math.ceil(source.required.length / 2) ? "verified" : "reachable-partial",
      matchedTerms: matched,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return { ...source, status: "temporarily-unavailable", matchedTerms: [], checkedAt: new Date().toISOString(), error: error.message };
  }
}

const sourceRef = (sources, id) => {
  const source = sources.find(item => item.id === id);
  return source ? {
    id: source.id,
    publisher: source.publisher,
    date: source.date,
    url: source.resolvedUrl || source.url,
    status: source.status,
    matchedTerms: source.matchedTerms,
  } : null;
};

const buildForecastModels = ref => [
  {
    id: "private-device-ai-bundle",
    layer: "L1 · 디바이스 경험",
    title: "프라이빗 온디바이스 AI 번들",
    en: "Private On-device AI Bundle",
    horizon: "2026–2028",
    confidence: "높음",
    forecast: "기본 온디바이스 추론은 무료 제공 · 고급 개인 컨텍스트·클라우드 추론·전문 도구는 구독 번들로 전환",
    observedMoves: [
      "Apple AFM 3 Core·Core Advanced와 Private Cloud Compute 모델 공개",
      "온디바이스 모델과 서버 모델을 같은 앱 경험 안에서 선택하는 하이브리드 구조 강화",
    ],
    revenueModel: "단말 교체 수요 + 프리미엄 AI 구독 + 앱 번들 수익배분",
    useCases: ["통화·메시지 요약과 다음 행동 추천", "로컬 사진·문서 검색과 개인 컨텍스트 연결", "오프라인 여행·학습·접근성 보조"],
    bestPractices: ["민감 데이터 로컬 우선 처리", "클라우드 전환 시 명시적 동의와 최소 전송", "모델 버전별 품질·배터리 회귀 테스트", "무료 기본 기능과 유료 고급 기능의 경계 명확화"],
    watchMetrics: ["AI 기능 주간 활성률", "클라우드 추론 전환율", "프리미엄 번들 ARPU", "로컬 처리 비중"],
    operatorMove: "통신·결제·멤버십 컨텍스트를 단말 내 권한형 도구로 연결 · 고급 에이전트 번들 과금",
    evidence: [ref("apple-foundation-models")].filter(Boolean),
  },
  {
    id: "outcome-priced-digital-labor",
    layer: "L2 · 디지털 노동",
    title: "결과 기반 디지털 노동",
    en: "Outcome-priced Digital Labor",
    horizon: "2026–2028",
    confidence: "높음",
    forecast: "좌석·토큰보다 해결·완료·전환처럼 검증 가능한 업무 결과 단위 과금이 엔터프라이즈 에이전트의 주류 가격 체계로 확장",
    observedMoves: [
      "Intercom Fin이 해결·절차 이관·리드 자격 판정별 결과 가격 공개",
      "ServiceNow가 에이전트 오케스트레이션과 KPI·ROI 관리 기능을 플랫폼에 통합",
    ],
    revenueModel: "성공 결과당 수수료 + SLA 등급 + 사람 이관 옵션",
    useCases: ["고객 문의 해결과 환불 처리", "리드 자격 판정과 영업 이관", "IT 장애 조치와 계정 복구", "보험·통신 업무 절차 완료"],
    bestPractices: ["과금 결과의 객관적 정의", "실패 시 무과금 원칙", "결과별 감사 로그와 재현 경로", "월 한도·분쟁·사람 이관 정책 사전 합의"],
    watchMetrics: ["자동 해결률", "결과당 원가", "재문의율", "사람 이관 후 완료율"],
    operatorMove: "고객센터 자동화 계약을 좌석 절감이 아닌 해결 건당 가격으로 전환 · 청구·해지·장애 조치별 성과 기준 분리",
    evidence: [ref("intercom-outcomes"), ref("servicenow-ai-agents")].filter(Boolean),
  },
  {
    id: "agent-marketplace-take-rate",
    layer: "L3 · 에이전트 유통",
    title: "에이전트 마켓플레이스 수수료",
    en: "Agent Marketplace Take Rate",
    horizon: "2026–2029",
    confidence: "높음",
    forecast: "에이전트·액션·MCP 도구의 검색·검증·구매·배포를 한곳에 묶는 유통 계층이 앱스토어형 수수료와 사용량 과금을 결합",
    observedMoves: [
      "Salesforce AgentExchange가 파트너 에이전트·액션·템플릿의 탐색과 구매 구조 공개",
      "Microsoft Agent Store가 사내·파트너·외부 플랫폼 에이전트의 중앙 유통 허브 제공",
      "AWS Marketplace가 AgentCore와 원격 MCP 도구에 계약형·사용량형 가격 지원",
    ],
    revenueModel: "거래 수수료 + 사용량 과금 + 비공개 오퍼 + 검증·운영 구독",
    useCases: ["산업별 업무 에이전트 카탈로그", "통신사 API·결제·인증 MCP 유통", "기업 전용 비공개 에이전트 스토어", "파트너 정산과 라이선스 관리"],
    bestPractices: ["보안 심사와 권한 범위 표준화", "에이전트별 비용·품질·실패율 공개", "자동 프로비저닝과 정산", "조직별 허용 목록과 버전 통제"],
    watchMetrics: ["활성 에이전트 수", "도구 호출 GMV", "유료 전환율", "검증 통과율"],
    operatorMove: "통신 API·본인확인·결제·위치·메시징 도구를 검증된 에이전트 카탈로그로 묶고 호출량 기반 수익배분",
    evidence: [ref("salesforce-agentexchange"), ref("microsoft-agent-store"), ref("aws-agent-marketplace")].filter(Boolean),
  },
  {
    id: "agentic-commerce-take-rate",
    layer: "L4 · AI 커머스",
    title: "대화형 커머스 거래 수수료",
    en: "Agentic Commerce Take Rate",
    horizon: "2026–2029",
    confidence: "높음",
    forecast: "검색·추천·장바구니·결제가 대화 안에서 연결되며 에이전트 플랫폼이 완료 거래 수수료와 결제·사기방지 서비스를 수익화",
    observedMoves: [
      "OpenAI와 Stripe가 Agentic Commerce Protocol과 ChatGPT Instant Checkout 공개",
      "Instacart가 ChatGPT 안에서 식료품 탐색부터 결제까지 완결되는 통합 경험 발표",
    ],
    revenueModel: "완료 거래 수수료 + 결제 처리 + 광고·추천 + 판매자 도구 구독",
    useCases: ["여행·티켓 비교와 결제", "식료품 재주문과 즉시 결제", "단말 요금제·보험·액세서리 번들 판매", "지역 상점 재고 기반 구매"],
    bestPractices: ["판매자를 Merchant of Record로 유지", "최소 주문 데이터만 전달", "추천과 광고의 명확한 구분", "가격·재고·배송 상태의 실시간 검증"],
    watchMetrics: ["대화 대비 구매 전환율", "거래당 수수료", "환불·차지백률", "판매자 재사용률"],
    operatorMove: "요금제·단말·보험·콘텐츠·로컬 커머스를 에이전트 결제 흐름에 연결 · 통신 인증과 결제 신뢰를 거래 인프라로 수익화",
    evidence: [ref("stripe-agentic-commerce"), ref("openai-instacart")].filter(Boolean),
  },
  {
    id: "forward-deployed-ai-annuity",
    layer: "L5 · 배포·AI서비스",
    title: "Forward-Deployed AI 연금형 수익",
    en: "Forward-Deployed AI Annuity",
    horizon: "2026–2028",
    confidence: "높음",
    forecast: "초기 구축 프로젝트가 모델 사용량·운영·거버넌스 계약으로 이어지며 배포 서비스가 반복 매출과 고객 락인의 핵심 계층으로 전환",
    observedMoves: [
      "OpenAI가 과반 지배 Deployment Company와 40억달러+ 초기 투자를 발표",
      "Anthropic이 PE 파트너와 중견기업 대상 엔터프라이즈 AI 서비스 회사를 설립",
    ],
    revenueModel: "초기 구축비 + 모델 사용량 + 관리형 운영료 + 성과 보너스",
    useCases: ["제조 계획·품질 워크플로 재설계", "금융 심사·리스크 운영 자동화", "헬스케어 문서·청구 운영", "물류 배차·재고 의사결정"],
    bestPractices: ["고객 현장 FDE와 제품팀의 단일 백로그", "PoC보다 운영 KPI를 계약 기준으로 설정", "모델 멀티소싱과 데이터 이동성 확보", "구축 산출물을 재사용 가능한 산업 모듈로 전환"],
    watchMetrics: ["배포 후 모델 소비 증가율", "구축에서 운영 계약 전환율", "FDE당 반복 매출", "고객별 재사용 모듈 비중"],
    operatorMove: "기업 고객망·보안·엣지 운영 경험을 FDE 조직과 결합 · 모델은 멀티소싱하고 배포·운영 마진을 직접 확보",
    evidence: [ref("openai-official"), ref("anthropic-official")].filter(Boolean),
  },
  {
    id: "machine-readable-data-toll",
    layer: "L6 · 데이터 권리",
    title: "기계 접근 데이터 통행료",
    en: "Machine-readable Data Toll",
    horizon: "2026–2029",
    confidence: "중상",
    forecast: "웹·콘텐츠·실시간 데이터 소유자가 AI 크롤러와 에이전트의 접근을 허용·차단·과금하며 신선도와 사용 권리에 가격을 부여",
    observedMoves: [
      "Cloudflare가 AI 크롤러별 허용·과금·차단과 HTTP 402 기반 Pay per Crawl 공개",
      "Cloudflare가 결제와 정산을 중개하는 Merchant of Record 역할 제시",
    ],
    revenueModel: "요청당 과금 + 신선도·SLA 프리미엄 + 학습·추론 라이선스 + 데이터 묶음 구독",
    useCases: ["뉴스·리서치의 에이전트 조회 과금", "상품 재고·가격 API 판매", "통신 위치·네트워크 품질 데이터 상품", "전문 데이터셋의 학습·추론 권리 분리"],
    bestPractices: ["인간 방문과 봇 접근 정책 분리", "학습·검색·추론 사용 권리 구분", "콘텐츠 출처와 정산 로그 제공", "차단보다 가격 발견을 위한 단계형 요금"],
    watchMetrics: ["유료 크롤 요청 수", "데이터 요청당 매출", "허용 대비 차단 비율", "출처 귀속률"],
    operatorMove: "위치·이동·네트워크 상태처럼 차별화된 데이터를 동의·비식별·목적 제한 기반 상품으로 설계 · 조회량과 신선도별 과금",
    evidence: [ref("cloudflare-pay-per-crawl")].filter(Boolean),
  },
  {
    id: "telco-ai-grid",
    layer: "L7 · 분산 AI 인프라",
    title: "통신사 AI 그리드 서비스",
    en: "Telco AI Grid as a Service",
    horizon: "2026–2030",
    confidence: "중상",
    forecast: "통신사의 중앙·지역·엣지 컴퓨트를 하나의 AI 그리드로 묶고 GPUaaS·AIaaS·지연시간 등급·주권형 AI 운영을 판매",
    observedMoves: [
      "NVIDIA가 통신 네트워크를 데이터센터·지역 허브·엣지에 걸친 AI grid로 제시",
      "AI-RAN으로 5G와 AI 추론이 같은 가속 인프라를 공유하는 운영 모델 확대",
    ],
    revenueModel: "GPU 시간 + 추론 사용량 + 지연시간·가용성 SLA + 주권형 관리 서비스",
    useCases: ["공장·리테일 실시간 비전 추론", "지역 규제에 맞춘 주권형 AI", "로봇·차량의 저지연 추론", "기업 전용 엣지 에이전트 런타임"],
    bestPractices: ["중앙·지역·엣지의 워크로드 오케스트레이션", "5G와 AI 자원 활용률 통합 관리", "모델·GPU 공급자 멀티벤더 지원", "데이터 지역성과 지연시간 SLA 계량"],
    watchMetrics: ["가속기 활용률", "추론당 네트워크 원가", "엣지 배치 워크로드 수", "AI 서비스 ARPU"],
    operatorMove: "기지국·국사·엣지 자산을 독립 AI 상품으로 분리하지 않고 연결·추론·보안·운영을 하나의 기업 SLA로 판매",
    evidence: [ref("nvidia-telco-ai-grid")].filter(Boolean),
  },
].map(model => ({
  ...model,
  evidenceStatus: model.evidence.some(source => source.status === "verified") ? "source-verified" : "source-partial",
}));

async function main() {
  const sources = await Promise.all(SOURCES.map(checkSource));
  const ref = id => sourceRef(sources, id);
  const companies = {
    OpenAI: [{
      id: "openai-deployco",
      title: "OpenAI Deployment Company (DeployCo)",
      announcedAt: "2026-05-11",
      structure: "OpenAI가 과반 소유·지배하는 독립 엔터프라이즈 배포 회사",
      capital: "초기 투자 40억달러+ · 100억달러 pre-money 가치",
      ownership: "OpenAI 과반 지배 · PE 투자자 수익은 5년간 최소 17.5% 조건 보도",
      partners: ["TPG", "Advent", "Bain Capital", "Brookfield", "Goldman Sachs", "SoftBank", "McKinsey", "Bain & Company", "Capgemini"],
      operatingModel: "Forward Deployed Engineers가 고객사 내부에서 데이터·도구·통제·업무 프로세스를 모델에 연결해 운영 시스템을 직접 구축",
      expansion: "Tomoro 인수 합의로 FDE·Deployment Specialist 약 150명 합류 예정 · 추가 배포 역량 인수 재원 확보",
      targetCustomers: "복잡한 운영 환경의 기업 · 투자·컨설팅 파트너가 후원하는 2,000개+ 기업을 초기 유통망으로 활용",
      handsetImplication: "모델 자체보다 배포 격차를 수익화하는 구조. 단말 사업자는 기기·OS·결제·개인 컨텍스트 접점을 활용해 FDE형 서비스 조직을 제품화할 수 있음",
      sources: [ref("openai-official"), ref("openai-axios")].filter(Boolean),
    }],
    Anthropic: [{
      id: "anthropic-enterprise-ai-services",
      title: "Anthropic 엔터프라이즈 AI 서비스 회사",
      announcedAt: "2026-05-04",
      structure: "Blackstone·Hellman & Friedman·Goldman Sachs와 설립한 AI-native 엔터프라이즈 서비스 회사",
      capital: "약 15억달러 committed capital 보도",
      ownership: "Anthropic 모델·Applied AI 인력을 제공하고 금융 파트너의 포트폴리오 유통망을 결합",
      partners: ["Blackstone", "Hellman & Friedman", "Goldman Sachs", "General Atlantic", "Leonard Green", "Apollo", "GIC", "Sequoia"],
      operatingModel: "회사 엔지니어와 Anthropic Applied AI 인력이 중견기업 현업에 들어가 Claude 기반 맞춤 시스템과 워크플로를 공동 구축",
      expansion: "Claude Partner Network에 편입해 기존 Accenture·Deloitte·PwC 등 대형 SI 채널과 중견기업 전담 채널을 병행",
      targetCustomers: "커뮤니티 은행·중견 제조·지역 헬스케어 등 자체 AI 구축 역량이 부족한 중견기업",
      handsetImplication: "지분 부담을 낮춘 합작 구조로 모델사·금융 파트너·현장 엔지니어링을 결합. 특정 모델 종속을 줄이면서 배포 서비스를 확장하는 대안",
      sources: [ref("anthropic-official"), ref("anthropic-capital")].filter(Boolean),
    }],
  };
  const comparison = {
    title: "모델 판매에서 배포·운영 수익으로 이동",
    insight: "두 회사 모두 엔지니어 상주형 배포와 PE 포트폴리오 기업을 유통망으로 결합했지만, OpenAI는 과반 지배·대규모 자본의 직접 소유형이고 Anthropic은 파트너 생태계 확장형에 가까움",
    operatorMove: "단말 제조사는 모델을 직접 보유하기보다 기기·OS·결제·개인 컨텍스트에 연결하는 배포 회사를 자회사 또는 JV로 만들고 모델은 멀티소싱하는 구조를 검토",
    market: {
      value2025: "73.9억달러",
      forecast2030: "194.7억달러",
      cagr: "21.4%",
      definition: "AI 전략·구현·통합·운영·거버넌스 컨설팅 시장",
      source: ref("market"),
    },
  };
  const out = {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    methodology: "publisher-page-recrawl+fact-to-source-mapping",
    companies,
    comparison,
    sources,
  };
  const forecastModels = buildForecastModels(ref);
  const forecastOut = {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    methodology: "official-source-recrawl+observed-move-to-business-model-inference",
    factForecastBoundary: "관측된 움직임은 공식 원문 근거 · 비즈니스 모델 예측은 관측 사실에서 도출한 전략적 추론",
    models: forecastModels,
    sources: sources.filter(source => forecastModels.some(model => model.evidence.some(item => item.id === source.id))),
  };
  const ventureSourceIds = new Set(["openai-official", "openai-axios", "anthropic-official", "anthropic-capital", "market"]);
  out.sources = sources.filter(source => ventureSourceIds.has(source.id));
  await writeFile("strategic-ventures.json", `${JSON.stringify(out)}\n`);
  await writeFile("business-model-forecasts.json", `${JSON.stringify(forecastOut)}\n`);
  console.log(`[ventures] ${sources.filter(item => item.status === "verified").length}/${sources.length} sources verified`);
  console.log(`[business-model-forecasts] ${forecastModels.filter(item => item.evidenceStatus === "source-verified").length}/${forecastModels.length} models source verified`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
