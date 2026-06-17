/* ============================================================
   AI Intelligence Dashboard (2026.06.17)
   AI 산업 전반 · 플레인 텍스트 복사 가능 sources 배열
   ============================================================ */
window.DASH = (function () {
  "use strict";

  const CATEGORIES = [
    { id: "native", ko: "AI 네이티브", en: "AI Native", accent: "#7A38D6", accentSoft: "#F0E9FB", desc: "파운데이션 모델·범용 AI 플랫폼 기업" },
    { id: "bigtech", ko: "빅테크 AI", en: "Big Tech AI", accent: "#1428A0", accentSoft: "#E8ECFA", desc: "대형 기술 기업의 AI 사업부·인프라" },
    { id: "startup", ko: "AI 스타트업", en: "AI Startups", accent: "#0E8F6E", accentSoft: "#E2F4EE", desc: "AI 네이티브 버티컬 스타트업" },
  ];

  /* ---- Companies (17개) ---- */
  const COMPANIES = [
    // ── native ──
    { cat: "native", name: "OpenAI", domain: "openai.com", desc: "GPT-4o/o3, ChatGPT, DALL·E, Sora — 세계 최대 범용 AI 플랫폼. 2026년 6월 S-1 비밀 제출, 밸류 $300B+. 주간 활성 사용자 800M+, ChatGPT Plus/Team/Enterprise 구독 모델로 연간 매출 $12.7B ARR 추정(2026 Q1)." },
    { cat: "native", name: "Anthropic", domain: "anthropic.com", desc: "Claude Opus/Sonnet/Haiku, Constitutional AI — 안전성 우선 AI 연구소. Series E $61B(2025.03) 후 2026년 추가 라운드로 $100B+ 밸류 추정. 연간 매출 $4B+ ARR 추정(2026 Q1). 엔터프라이즈 AI 시장 급성장." },
    { cat: "native", name: "Google DeepMind", domain: "deepmind.google", desc: "Gemini 2.5, AlphaFold, Gemma — Google의 AI 연구 조직. Gemini 2.5 Pro/Flash 멀티모달 최고 성능. AlphaFold로 노벨화학상 수상. Gemma 오픈소스 모델로 개발자 생태계 확장." },
    { cat: "native", name: "xAI", domain: "x.ai", desc: "Grok-3, Colossus 슈퍼클러스터 — 일론 머스크가 설립한 AI 기업. Grok-3 최대 규모 모델 학습. $12B Series C(2025.12). Colossus 100K H100 GPU 클러스터 운영. 밸류 $50B+." },
    { cat: "native", name: "Meta AI", domain: "ai.meta.com", desc: "Llama 3.1, 오픈소스 LLM 리더 — 세계 최대 오픈소스 LLM 배포. Llama 3.1 405B 파라미터 모델로 업계 표준 수립. Meta AI 어시스턴트 30억+ 월간 사용자. 연간 AI 인프라 투자 $65B+(2025)." },

    // ── bigtech ──
    { cat: "bigtech", name: "Apple", domain: "apple.com", desc: "Apple Intelligence, 온디바이스 AI, Siri LLM — 온디바이스 AI 처리로 프라이버시 차별화. Apple Intelligence iOS 18+에 통합. Siri에 LLM 기반 대화 능력 추가. 연간 서비스 매출 $100B+ 중 AI 기여 확대." },
    { cat: "bigtech", name: "Microsoft", domain: "microsoft.com", desc: "Copilot, Azure OpenAI, GitHub Copilot — OpenAI $13B+ 투자로 AI 플랫폼 선도. Copilot 제품군 Office/Windows/Security 통합. Azure OpenAI 서비스 연 매출 $13B+(2026E). GitHub Copilot 개발자 200M+ 사용자." },
    { cat: "bigtech", name: "Amazon", domain: "amazon.com", desc: "Bedrock, Alexa+, AWS Trainium 칩 — AWS Bedrock으로 멀티 LLM 호스팅 플랫폼 운영. Alexa+ LLM 기반 대화형 AI 출시. Trainium2 칩으로 NVIDIA 의존도 저감. AWS AI 서비스 $14B+ ARR(2026E)." },
    { cat: "bigtech", name: "NVIDIA", domain: "nvidia.com", desc: "H100/B200 GPU, CUDA, AI 인프라 — AI 학습/추론 GPU 시장 점유율 80%+. H100/B200 데이터센터 GPU 표준. FY2026 매출 $130.5B(+114% YoY). CUDA 생태계 400M+ 개발자. 시총 $3.5T+." },

    // ── startup ──
    { cat: "startup", name: "Cursor", domain: "cursor.com", desc: "AI-first IDE, 코드 생성 — AI 네이티브 코드 편집기. Series B $105M, 밸류 $2.5B(2025.01). ARR $300M+. 개발자 생산성 2배 향상 주장. VS Code 포크로 빠른 전환 유도." },
    { cat: "startup", name: "Perplexity", domain: "perplexity.ai", desc: "AI 검색 엔진, 답변 엔진 — AI 기반 검색 엔진으로 Google 검색 대안 포지셔닝. 밸류 $9B(2025.04). ARR $100M+. MAU 100M+. 출처 명시 답변으로 정보 신뢰도 차별화." },
    { cat: "startup", name: "Mistral AI", domain: "mistral.ai", desc: "Mistral Large/Medium, 유럽 AI — 프랑스 기반 AI 스타트업. 밸류 $6.2B(2025.01). Mistral Large 2 유럽 최고 성능 모델. Le Chat 챗봇 출시. 유럽 AI 주권 수호 기업으로 EU 정부 지원." },
    { cat: "startup", name: "Cohere", domain: "cohere.com", desc: "엔터프라이즈 LLM, RAG 솔루션 — 기업용 AI 특화. Command R+ 모델로 RAG 최적화. 밸류 $5.5B(2025.07). 엔터프라이즈 데이터 보안·커스터마이징 강점. Oracle·Salesforce 파트너십." },
    { cat: "startup", name: "Stability AI", domain: "stability.ai", desc: "Stable Diffusion, 이미지 생성 — 오픈소스 이미지 생성 AI 선구자. Stable Diffusion 3.5 출시. 밸류 $1B(2023 피크). 구조조정 후 새 CEO 영입. 엔터프라이즈 라이선싱으로 수익 모델 전환." },
    { cat: "startup", name: "Databricks", domain: "databricks.com", desc: "Mosaic ML, DBRX, 데이터+AI 플랫폼 — 데이터 레이크하우스 + AI 통합 플랫폼. 밸류 $62B(2024.12). Mosaic ML 인수로 LLM 학습 내재화. DBRX 오픈소스 모델 배포. ARR $2.4B+(2025)." },
    { cat: "startup", name: "Scale AI", domain: "scale.ai", desc: "AI 데이터 라벨링, RLHF 데이터 — AI 학습 데이터 플랫폼. 밸류 $14B(2024.05). 미국 국방부·OpenAI·Meta 등 주요 고객. RLHF·RLAIF 데이터 생산 업계 1위. ARR $1.4B+(2025)." },
    { cat: "startup", name: "Runway", domain: "runwayml.com", desc: "Gen-3 비디오 AI, 크리에이티브 툴 — 비디오 생성 AI 선도 기업. Gen-3 Alpha로 텍스트→비디오 최고 품질. 밸류 $4B(2024.06). 할리우드 영화 제작에 활용. 크리에이티브 산업 AI 통합 가속." },
  ];

  /* ---- Articles (6 recent AI news) ---- */
  const ARTICLES = [
    { date: "2026-06-08", cat: "native", source: "Bloomberg", title: "OpenAI, S-1 비밀 제출 — 밸류 $300B+ IPO 준비", summary: "· 2026.06.08 SEC에 S-1 비밀 제출\n· 밸류 $300B~$340B+ 보도(Bloomberg)\n· 주간 활성 사용자 800M+\n· ARR $12.7B 추정으로 AI 기업 최대 규모 IPO", tag: "IPO", url: "https://www.bloomberg.com/technology" },
    { date: "2026-05-20", cat: "native", source: "TechCrunch", title: "Anthropic, 연간 매출 $4B ARR 돌파 — 엔터프라이즈 AI 급성장", summary: "· Anthropic 연간 매출 런레이트 $4B+ 돌파\n· Claude Enterprise 기업 고객 급증\n· AWS·Google Cloud 파트너십 확대\n· 안전성 우선 AI로 규제 환경에서 선호", tag: "Earnings", url: "https://techcrunch.com/" },
    { date: "2026-05-15", cat: "bigtech", source: "CNBC", title: "NVIDIA FY2026 매출 $130.5B — AI 칩 수요 폭발적 성장", summary: "· FY2026 매출 $130.5B(+114% YoY)\n· 데이터센터 GPU 시장 점유율 80%+\n· B200 Blackwell GPU 출하 본격화\n· 시총 $3.5T+ 세계 최고가치 기업", tag: "Earnings", url: "https://www.cnbc.com/" },
    { date: "2026-04-28", cat: "startup", source: "The Verge", title: "Cursor, ARR $300M 돌파 — AI 코드 편집기 시장 선도", summary: "· Cursor ARR $300M+ 돌파(2026 Q1)\n· AI 코드 에디터 중 최고 성장률\n· 엔터프라이즈 도입 가속\n· GitHub Copilot 대비 전체 컨텍스트 차별화", tag: "Growth", url: "https://www.theverge.com/" },
    { date: "2026-04-10", cat: "startup", source: "Reuters", title: "Databricks, 밸류 $62B으로 업계 최대 AI 스타트업", summary: "· Databricks 밸류 $62B(2024.12 라운드 기준)\n· ARR $2.4B+ 달성\n· Mosaic ML 인수로 LLM 학습 내재화\n· 데이터+AI 통합 플랫폼 표준 수립", tag: "Funding", url: "https://www.reuters.com/" },
    { date: "2026-03-25", cat: "native", source: "Wired", title: "Google DeepMind Gemini 2.5 Pro — 멀티모달 AI 벤치마크 신기록", summary: "· Gemini 2.5 Pro 멀티모달 벤치마크 1위\n· 100만 토큰 컨텍스트 창 지원\n· AlphaFold 3 단백질 구조 예측 정확도 향상\n· Gemma 3 오픈소스 모델 동시 배포", tag: "Product", url: "https://www.wired.com/" },
  ];

  /* ---- Reports (4 industry reports) ---- */
  const REPORTS = [
    { house: "Grand View Research", type: "Market", date: "2026-03-15", title: "글로벌 AI 시장 규모 2025 $279B → 2030E $1,811B, CAGR 45.1%", figure: "$279B → $1,811B", rating: "Report", url: "https://www.grandviewresearch.com/industry-analysis/artificial-intelligence-ai-market",
      bullets: ["2025년 $279B → 2030E $1,811B · CAGR 45.1%", "GenAI 세그먼트 최고 성장률 CAGR 52%", "북미 최대 시장 · 아태 최고 성장률"] },
    { house: "McKinsey", type: "Market", date: "2026-01-20", title: "AI의 경제적 잠재력: 2030년까지 글로벌 GDP $15.7T 기여", figure: "$15.7T GDP 기여", rating: "Report", url: "https://www.mckinsey.com/capabilities/quantumblack/our-insights",
      bullets: ["AI가 2030년까지 글로벌 GDP에 $15.7T 기여 전망", "생성형 AI로 업무 자동화 60~70% 가속", "기업 75%가 2026년 내 AI 도입 계획"] },
    { house: "Goldman Sachs", type: "Securities", date: "2026-02-10", title: "AI 인프라 투자: 2025~2028 글로벌 $1T+ 투자 전망", figure: "$1T+ 인프라 투자", rating: "Overweight", url: "https://www.goldmansachs.com/insights/articles/ai-investment-forecast-2025",
      bullets: ["글로벌 AI 인프라 투자 2025~2028 누적 $1T+", "데이터센터 건설 CAPEX 연 $200B+", "NVIDIA·AMD·커스텀 ASIC 수혜"] },
    { house: "CB Insights", type: "Market", date: "2026-04-15", title: "State of AI Q1 2026 — $18.9B 펀딩, 메가라운드 65%", figure: "Q1 $18.9B", rating: "Report", url: "https://www.cbinsights.com/research/report/ai-trends-q1-2026/",
      bullets: ["Q1 2026 AI 펀딩 $18.9B · 메가라운드 65%", "AI 스타트업 유니콘 15개 신규 탄생", "엔터프라이즈 AI 도입률 72%로 상승"] },
  ];

  /* ---- Market Growth (AI market size $B) ---- */
  const MARKET_GROWTH = [
    { year: "2022", size: 136, growth: 21, src: "Grand View Research '23.01" },
    { year: "2023", size: 197, growth: 45, src: "Grand View Research '24.02" },
    { year: "2024", size: 244, growth: 24, src: "Grand View Research '25.01" },
    { year: "2025", size: 279, growth: 14, src: "Grand View Research '26.01" },
    { year: "2026E", size: 391, growth: 40, src: "Grand View Research '26.01 전망" },
    { year: "2027E", size: 548, growth: 40, src: "Grand View Research '26.01 전망" },
    { year: "2028E", size: 811, growth: 48, src: "Grand View Research '26.01 전망" },
  ];

  /* ---- Funding / Valuation ($B) ---- */
  const FUNDING = [
    { name: "OpenAI", value: 300, cat: "native", src: "Bloomberg '26.6 S-1 밸류 $300B+" },
    { name: "Anthropic", value: 100, cat: "native", src: "Forbes '26 비공식 추정 $100B+" },
    { name: "Databricks", value: 62, cat: "startup", src: "Reuters '24.12 Series I $62B" },
    { name: "xAI", value: 50, cat: "native", src: "WSJ '25.12 Series C $50B" },
    { name: "Scale AI", value: 14, cat: "startup", src: "Forbes '24.05 Series F $14B" },
    { name: "Perplexity", value: 9, cat: "startup", src: "TechCrunch '25.04 $9B" },
    { name: "Mistral AI", value: 6.2, cat: "startup", src: "Reuters '25.01 $6.2B" },
    { name: "Cohere", value: 5.5, cat: "startup", src: "TechCrunch '25.07 $5.5B" },
    { name: "Runway", value: 4, cat: "startup", src: "Bloomberg '24.06 $4B" },
    { name: "Cursor", value: 2.5, cat: "startup", src: "TechCrunch '25.01 Series B $2.5B" },
  ];

  /* ---- Market Share by Segment (%) ---- */
  const SHARE = [
    { cat: "native", label: "LLM/GenAI", value: 35, src: "Grand View Research '26.03" },
    { cat: "bigtech", label: "Cloud AI 서비스", value: 28, src: "Gartner '26.01" },
    { cat: "bigtech", label: "AI 칩/하드웨어", value: 20, src: "IDC '26.02" },
    { cat: "startup", label: "엔터프라이즈 AI", value: 12, src: "CB Insights '26.04" },
    { cat: "startup", label: "기타(로보틱스/자율주행 등)", value: 5, src: "McKinsey '26.01" },
  ];

  /* ---- Top AI Apps by MAU (M) ---- */
  const USERS = [
    { name: "ChatGPT", value: 800, cat: "native", src: "OpenAI 공식 '26.5 주간 활성 사용자" },
    { name: "Meta AI", value: 3000, cat: "native", src: "Meta IR '26.4 (3B+ 월간)" },
    { name: "GitHub Copilot", value: 200, cat: "bigtech", src: "Microsoft Build '26.5" },
    { name: "Google Gemini", value: 350, cat: "native", src: "Google I/O '26.5 추정" },
    { name: "Perplexity", value: 100, cat: "startup", src: "Perplexity 공식 '26.3" },
    { name: "Claude", value: 80, cat: "native", src: "Anthropic 추정 '26.4" },
    { name: "Cursor", value: 5, cat: "startup", src: "Cursor 추정 '26.4 (유료 개발자)" },
    { name: "Midjourney", value: 30, cat: "startup", src: "Midjourney Discord '26.3" },
  ];

  /* ---- AI Service Pricing Tiers ($/월) ---- */
  const BAND_PRICE = [
    { name: "Free (무료 티어)", value: 0, cat: "native", src: "ChatGPT Free / Claude Free / Gemini Free" },
    { name: "Pro (개인 구독)", value: 20, cat: "native", src: "ChatGPT Plus $20/월, Claude Pro $20/월" },
    { name: "Enterprise (기업)", value: 60, cat: "bigtech", src: "ChatGPT Enterprise ~$60/사용자/월" },
    { name: "API (1M 토큰 기준)", value: 15, cat: "native", src: "GPT-4o $2.5~$15/1M토큰, Claude Sonnet $3~$15" },
  ];

  /* ---- Quarterly AI Funding ($B) ---- */
  const FUNDING_TREND = [
    { name: "Q1 2024", value: 8.5, cat: "native", src: "CB Insights State of AI Q1'24" },
    { name: "Q2 2024", value: 10.2, cat: "native", src: "CB Insights State of AI Q2'24" },
    { name: "Q3 2024", value: 11.8, cat: "native", src: "CB Insights State of AI Q3'24" },
    { name: "Q4 2024", value: 14.3, cat: "native", src: "CB Insights State of AI Q4'24" },
    { name: "Q1 2025", value: 15.6, cat: "native", src: "CB Insights State of AI Q1'25" },
    { name: "Q2 2025", value: 16.1, cat: "native", src: "CB Insights State of AI Q2'25" },
    { name: "Q3 2025", value: 17.4, cat: "native", src: "CB Insights State of AI Q3'25" },
    { name: "Q4 2025", value: 18.2, cat: "native", src: "CB Insights State of AI Q4'25" },
    { name: "Q1 2026", value: 18.9, cat: "native", src: "CB Insights State of AI Q1'26" },
  ];

  /* ---- Major AI Deals/Acquisitions ---- */
  const AI_DEALS = [
    { cat: "native", label: "LLM/GenAI 투자", value: 45, src: "CB Insights Q1'26 — GenAI 투자 비중 45%" },
    { cat: "bigtech", label: "AI 인프라/칩", value: 25, src: "CB Insights Q1'26 — 컴퓨트 인프라 25%" },
    { cat: "startup", label: "엔터프라이즈 AI", value: 18, src: "CB Insights Q1'26 — 기업용 AI 18%" },
    { cat: "startup", label: "기타 AI 버티컬", value: 12, src: "CB Insights Q1'26 — 기타 12%" },
  ];

  /* ---- Top AI Companies by Revenue/ARR ($B) ---- */
  const REVENUE = [
    { name: "NVIDIA (FY26)", value: 130.5, cat: "bigtech", src: "NVIDIA IR FY2026 확정" },
    { name: "AWS AI (추정)", value: 14.0, cat: "bigtech", src: "AWS Bedrock + AI 서비스 ARR 추정" },
    { name: "Microsoft AI (추정)", value: 13.0, cat: "bigtech", src: "Azure OpenAI 서비스 연 매출 추정" },
    { name: "OpenAI (ARR)", value: 12.7, cat: "native", src: "The Information '26.3 ARR $12.7B 추정" },
    { name: "Anthropic (ARR)", value: 4.0, cat: "native", src: "TechCrunch '26.5 ARR $4B+ 추정" },
    { name: "Databricks (ARR)", value: 2.4, cat: "startup", src: "Databricks IR '25 ARR $2.4B" },
    { name: "Scale AI (ARR)", value: 1.4, cat: "startup", src: "Forbes '25 ARR $1.4B 추정" },
  ];

  /* ---- AI Business Models ---- */
  const BIZ_MODELS = [
    { name: "API 사용량 과금", cat: "native", model: "API Usage-based", pricing: "토큰당 과금($0.25~$75/1M)", sub: "무료 티어 + 사용량 과금", revenue: "OpenAI $12.7B ARR, Anthropic $4B ARR", margin: "비공개", arpu: "기업당 $10K~$1M+/yr", retention: "높음(기술 의존성)", moat: "모델 성능 + 개발자 생태계 + 안전성 프레임워크", strategy: "모델 성능 경쟁 + 엔터프라이즈 침투 + 구독 모델 병행", src: "OpenAI/Anthropic 공식 가격표" },
    { name: "SaaS 구독", cat: "bigtech", model: "SaaS Subscription", pricing: "$20~$60/사용자/월", sub: "Copilot Pro/Business/Enterprise 티어", revenue: "Microsoft Copilot $13B+ ARR 추정", margin: "높음(80%+ 추정)", arpu: "$240~$720/yr", retention: "매우 높음(Office 번들)", moat: "Office/Windows/Teams 통합 락인 + OpenAI 독점 파트너", strategy: "Copilot 제품군 전 영역 통합 + 기업 워크플로우 AI 표준화", src: "Microsoft IR '26" },
    { name: "오픈소스+엔터프라이즈", cat: "native", model: "Open Source + Enterprise", pricing: "오픈소스 무료 + 엔터프라이즈 유료", sub: "Llama 무료 + Meta Advantage AI 광고", revenue: "Meta AI 광고 매출 기여 $20B+ 추정", margin: "광고 기반 고마진", arpu: "광고주 기반", retention: "개발자 생태계 락인", moat: "30억 월간 사용자 + 가장 넓은 오픈소스 분포", strategy: "오픈소스 Llama로 생태계 확장 + AI 광고 최적화로 수익 균형", src: "Meta IR '26, Llama 배포 통계" },
    { name: "하드웨어+클라우드", cat: "bigtech", model: "Hardware + Cloud", pricing: "H100 $25K~$40K · B200 $30K~$50K · DGX Cloud 시간당 과금", sub: "GPU 판매 + DGX Cloud 구독 + CUDA 무료", revenue: "NVIDIA $130.5B(FY26)", margin: "~78% 데이터센터 마진", arpu: "기업당 수백만~수십억 달러", retention: "CUDA 생태계 400M 개발자 락인", moat: "GPU 시장 80%+ 점유 + CUDA 소프트웨어 생태계 + 기술 리드", strategy: "B200 Blackwell + DGX Cloud 확장 + Omniverse 디지털 트윈", src: "NVIDIA IR FY2026" },
    { name: "라이선싱", cat: "startup", model: "Licensing", pricing: "모델 라이선싱 + API + 커스텀 파인튜닝", sub: "Community 무료 + Enterprise 라이선싱", revenue: "Mistral AI 비공개 / Stability AI 재구조화 중", margin: "비공개", arpu: "라이선싱 계약 기반", retention: "커스텀 모델 의존성", moat: "특화 모델 성능 + 유럽 규제 호환성 + 데이터 보안", strategy: "유럽 AI 주권 포지셔닝 + 엔터프라이즈 커스텀 모델 + API 수익화", src: "Mistral AI / Stability AI 공식" },
  ];

  /* ---- KPI Cards (4) ---- */
  const KPIS = [
    { label: "글로벌 AI 시장 (2025)", value: "$279B", delta: +40, sub: "Grand View Research · 2030E $1,811B · CAGR 45.1%", fill: 0.72, src: "Grand View Research AI Market Report '26.03" },
    { label: "Q1 2026 AI 펀딩", value: "$18.9B", delta: +22, sub: "CB Insights · 메가라운드 65% · 유니콘 15개 신규", fill: 0.65, src: "CB Insights State of AI Q1'26" },
    { label: "NVIDIA FY26 매출", value: "$130.5B", delta: +114, sub: "+114% YoY · 데이터센터 GPU 시장 80%+ · 시총 $3.5T+", fill: 0.88, src: "NVIDIA IR FY2026 확정" },
    { label: "ChatGPT 주간 활성 사용자", value: "800M+", delta: +60, sub: "OpenAI · ARR $12.7B · S-1 비밀 제출", fill: 0.80, src: "OpenAI 공식 '26.5" },
  ];

  /* ---- Insight Cards (4) ---- */
  const INSIGHTS = [
    { title: "GenAI 연간 매출 $50B+ 시대", desc: "OpenAI $12.7B + Anthropic $4B + Google AI + Microsoft Copilot — GenAI 플레이어들의 연간 매출 합계가 $50B을 넘어서며 독립적 산업으로 자리매김", icon: "ai", src: "The Information '26.3, TechCrunch '26.5" },
    { title: "AI 칩 전쟁 — NVIDIA vs 커스텀 실리콘", desc: "NVIDIA H100/B200 GPU가 AI 학습 시장 80%+를 점유하나, Google TPU v5p·Amazon Trainium2·Microsoft Maia 등 커스텀 칩이 추격. 인프라 비용 절감이 AI 보급의 핵심 변수", icon: "chip", src: "Goldman Sachs '26.02, NVIDIA IR FY2026" },
    { title: "AI 에이전트 — 코파일럿에서 자율 에이전트로", desc: "단순 업무 보조(Copilot)에서 자율적 의사결정(Agent)으로 AI 활용 패러다임 전환. Cursor·Devin 등 AI 코딩 에이전트가 개발 워크플로우를 근본적으로 변화", icon: "spark", src: "BCG '26.01, McKinsey '26.01" },
    { title: "오픈소스 vs 클로즈드 — AI 모델 전략 분기", desc: "Meta Llama·Mistral 등 오픈소스 모델이 기업 도입을 가속화하며, OpenAI·Anthropic의 클로즈드 모델과 성능 격차 축소. 유럽 EU AI Act 규제에서 오픈소스 선호도 상승", icon: "chart", src: "Mistral AI, Meta AI 공식, EU AI Act '24" },
  ];

  /* ---- Q&A Pairs (Korean, 10) ---- */
  const QA_PAIRS = [
    { q: "OpenAI의 현재 상황과 IPO 전망은 어떻게 되나요?", a: "OpenAI는 2026년 6월 8일 SEC에 S-1을 비밀 제출하며 IPO를 준비 중입니다. 밸류에이션은 $300B~$340B+로 보도되며, 주간 활성 사용자 800M+, ARR $12.7B 추정으로 AI 기업 중 최대 규모 IPO가 될 전망입니다. GPT-4o/o3 모델, ChatGPT Plus/Team/Enterprise 구독 모델, DALL·E와 Sora 등 멀티모달 AI로 수익을 다각화하고 있습니다.", nav: "native", keywords: ["openai", "ipo", "chatgpt", "시가총액", "밸류", "s-1"] },
    { q: "Anthropic과 OpenAI의 차이점은 무엇인가요?", a: "Anthropic은 Constitutional AI를 통한 안전성 우선 설계가 핵심 차별점입니다. Claude Opus/Sonnet/Haiku 모델로 엔터프라이즈 시장에서 급성장 중이며, ARR $4B+를 달성했습니다. OpenAI가 소비자 시장(ChatGPT 800M+)을 선도하는 반면, Anthropic은 규제 환경이 엄격한 금융·의료·법률 등 엔터프라이즈 영역에서 신뢰를 쌓고 있습니다.", nav: "native", keywords: ["anthropic", "claude", "openai", "차이", "비교", "안전"] },
    { q: "NVIDIA가 AI 시장에서 압도적인 이유는 무엇인가요?", a: "NVIDIA는 AI 학습/추론 GPU 시장 점유율 80%+를 보유하고 있습니다. FY2026 매출 $130.5B(+114% YoY), 시총 $3.5T+로 세계 최고가치 기업입니다. 핵심은 CUDA 소프트웨어 생태계(400M+ 개발자)로, GPU 하드웨어뿐 아니라 소프트웨어 락인 효과가 경쟁사 진입을 어렵게 만듭니다. H100/B200 GPU가 데이터센터 표준이며, DGX Cloud로 클라우드 수익도 확대 중입니다.", nav: "bigtech", keywords: ["nvidia", "엔비디아", "gpu", "h100", "b200", "cuda", "반도체"] },
    { q: "AI 스타트업 중 가장 빠르게 성장하는 기업은 어디인가요?", a: "2026년 기준 가장 빠른 성장세를 보이는 AI 스타트업은 Cursor와 Perplexity입니다. Cursor는 AI-first IDE로 ARR $300M+를 돌파했으며, 밸류 $2.5B으로 개발자 생산성 툴 시장을 선도하고 있습니다. Perplexity는 AI 검색 엔진으로 MAU 100M+, 밸류 $9B을 기록하며 Google 검색의 대안으로 부상 중입니다. Databricks는 ARR $2.4B+로 데이터+AI 통합 플랫폼 시장을 선도합니다.", nav: "startup", keywords: ["스타트업", "성장", "빠른", "cursor", "perplexity", "databricks"] },
    { q: "오픈소스 AI 모델과 클로즈드 모델의 차이는 무엇인가요?", a: "오픈소스 모델(Meta Llama, Mistral, Gemma)은 무료 배포로 기업이 직접 커스터마이징할 수 있어 데이터 보안과 비용 통제가 가능합니다. 클로즈드 모델(GPT-4o, Claude)은 최고 성능을 API로 제공하며 인프라 관리 부담이 없습니다. 2026년 현재 성능 격차가 빠르게 줄어들고 있으며, 유럽 EU AI Act 규제에서는 오픈소스 모델 선호도가 높아지고 있습니다.", nav: "dynamics", keywords: ["오픈소스", "llama", "mistral", "클로즈드", "차이", "비교"] },
    { q: "AI 칩/반도체 시장의 경쟁 구도는 어떻게 되나요?", a: "NVIDIA가 AI GPU 시장 80%+를 점유하며 압도적 1위입니다. 하지만 도전자들이 빠르게 추격 중입니다. Google TPU v5p는 Gemini 학습에 사용되며, Amazon Trainium2는 AWS 내부 워크로드에 투입되고 있습니다. Microsoft Maia 칩도 Azure에 배치 중이며, AMD MI300X가 가격 경쟁력으로 점유율을 확대하고 있습니다. 핵심은 CUDA 생태계 락인을 깨뜨릴 수 있는지 여부입니다.", nav: "bigtech", keywords: ["칩", "반도체", "gpu", "tpu", "trainium", "nvidia", "amd"] },
    { q: "AI 기업의 수익 모델은 어떤 유형이 있나요?", a: "AI 기업의 수익 모델은 5가지로 분류됩니다. 1) API 사용량 과금: OpenAI·Anthropic이 토큰당 과금. 2) SaaS 구독: Microsoft Copilot처럼 월 $20~$60 구독료. 3) 오픈소스+엔터프라이즈: Meta Llama처럼 무료 모델로 생태계 확장 후 광고/엔터프라이즈 수익. 4) 하드웨어+클라우드: NVIDIA처럼 GPU 판매+클라우드 서비스. 5) 라이선싱: Mistral AI처럼 모델 라이선싱+커스텀 파인튜닝.", nav: "bizmodel", keywords: ["수익", "모델", "비즈니스", "api", "구독", "오픈소스", "라이선싱"] },
    { q: "2026년 AI 시장 규모와 성장 전망은 어떻게 되나요?", a: "Grand View Research 기준 2025년 글로벌 AI 시장은 $279B 규모이며, 2030년 $1,811B에 달할 전망입니다(CAGR 45.1%). 2026년 Q1 AI 펀딩은 $18.9B로 메가라운드가 65%를 차지했습니다. AI 칩 인프라에만 2025~2028년 누적 $1T+ 투자가 예상됩니다(Goldman Sachs). McKinsey는 AI가 2030년까지 글로벌 GDP에 $15.7T를 기여할 것으로 전망합니다.", nav: "overview", keywords: ["시장", "규모", "성장", "투자", "전망", "2026"] },
    { q: "Cursor는 어떤 제품이고 GitHub Copilot과 무엇이 다른가요?", a: "Cursor는 AI-first IDE로 VS Code를 포크해 AI 코드 생성을 편집기 핵심에 통합했습니다. GitHub Copilot이 기존 IDE의 플러그인으로 동작하는 반면, Cursor는 전체 코드베이스 컨텍스트를 이해하고 다중 파일 편집을 자율적으로 수행합니다. ARR $300M+로 급성장 중이며, 밸류 $2.5B입니다. 개발자 생산성 2배 향상을 주장하며 엔터프라이즈 도입이 가속되고 있습니다.", nav: "startup", keywords: ["cursor", "copilot", "ide", "코드", "개발자", "차이"] },
    { q: "AI 규제 환경은 어떻게 변화하고 있나요?", a: "유럽 EU AI Act가 2024년 발효되며 세계 최초 포괄적 AI 규제가 시작되었습니다. 고위험 AI 시스템은 투명성·설명가능성·인간 감독을 의무화합니다. 미국은 행정명령 기반 자율 규제 기조를 유지하며, 중국은 GenAI 서비스 허가제를 시행 중입니다. Anthropic의 Constitutional AI처럼 자체 안전성 프레임워크를 갖춘 기업이 규제 환경에서 유리합니다.", nav: "insights", keywords: ["규제", "eu", "ai act", "안전", "투명성", "법률"] },
  ];

  /* ---- Monthly Trend: Top AI Apps (M downloads) ---- */
  const APP_MONTHLY = [
    { month: "2026-01", apps: [
      { name: "ChatGPT", ios: 45, android: 62, src: "SensorTower '26.1" },
      { name: "Google Gemini", ios: 18, android: 35, src: "SensorTower '26.1" },
      { name: "Perplexity", ios: 8, android: 5, src: "SensorTower '26.1" },
      { name: "Claude", ios: 5, android: 3, src: "SensorTower '26.1" },
      { name: "Midjourney", ios: 3, android: 1.5, src: "SensorTower '26.1" },
      { name: "Copilot", ios: 4, android: 6, src: "SensorTower '26.1" },
    ]},
    { month: "2026-02", apps: [
      { name: "ChatGPT", ios: 48, android: 65, src: "SensorTower '26.2" },
      { name: "Google Gemini", ios: 20, android: 38, src: "SensorTower '26.2" },
      { name: "Perplexity", ios: 9, android: 6, src: "SensorTower '26.2" },
      { name: "Claude", ios: 6, android: 3.5, src: "SensorTower '26.2" },
      { name: "Midjourney", ios: 3.2, android: 1.8, src: "SensorTower '26.2" },
      { name: "Copilot", ios: 4.5, android: 6.5, src: "SensorTower '26.2" },
    ]},
    { month: "2026-03", apps: [
      { name: "ChatGPT", ios: 52, android: 70, src: "SensorTower '26.3" },
      { name: "Google Gemini", ios: 22, android: 42, src: "SensorTower '26.3" },
      { name: "Perplexity", ios: 10, android: 7, src: "SensorTower '26.3" },
      { name: "Claude", ios: 7, android: 4, src: "SensorTower '26.3" },
      { name: "Midjourney", ios: 3.5, android: 2, src: "SensorTower '26.3" },
      { name: "Copilot", ios: 5, android: 7, src: "SensorTower '26.3" },
    ]},
    { month: "2026-04", apps: [
      { name: "ChatGPT", ios: 55, android: 73, src: "SensorTower '26.4" },
      { name: "Google Gemini", ios: 24, android: 45, src: "SensorTower '26.4" },
      { name: "Perplexity", ios: 11, android: 8, src: "SensorTower '26.4" },
      { name: "Claude", ios: 8, android: 5, src: "SensorTower '26.4" },
      { name: "Midjourney", ios: 3.8, android: 2.2, src: "SensorTower '26.4" },
      { name: "Copilot", ios: 5.5, android: 7.5, src: "SensorTower '26.4" },
    ]},
    { month: "2026-05", apps: [
      { name: "ChatGPT", ios: 58, android: 76, src: "SensorTower '26.5" },
      { name: "Google Gemini", ios: 26, android: 48, src: "SensorTower '26.5" },
      { name: "Perplexity", ios: 12, android: 9, src: "SensorTower '26.5" },
      { name: "Claude", ios: 9, android: 6, src: "SensorTower '26.5" },
      { name: "Midjourney", ios: 4, android: 2.5, src: "SensorTower '26.5" },
      { name: "Copilot", ios: 6, android: 8, src: "SensorTower '26.5" },
    ]},
  ];

  /* ---- Monthly Revenue Trends ($M) ---- */
  const REVENUE_MONTHLY = [
    { month: "2026-01", data: [
      { name: "NVIDIA", value: 10500, src: "NVIDIA IR FY26 분기 배분" },
      { name: "OpenAI", value: 950, src: "ARR $12.7B 기준 월 배분" },
      { name: "Microsoft AI", value: 1000, src: "Azure OpenAI 추정" },
      { name: "Anthropic", value: 280, src: "ARR $4B 기준 추정" },
      { name: "Databricks", value: 190, src: "ARR $2.4B 기준" },
      { name: "Scale AI", value: 110, src: "ARR $1.4B 기준" },
    ]},
    { month: "2026-02", data: [
      { name: "NVIDIA", value: 10800, src: "NVIDIA IR" },
      { name: "OpenAI", value: 1000, src: "ARR 기준" },
      { name: "Microsoft AI", value: 1050, src: "Azure OpenAI 추정" },
      { name: "Anthropic", value: 300, src: "ARR 기준" },
      { name: "Databricks", value: 195, src: "ARR 기준" },
      { name: "Scale AI", value: 115, src: "ARR 기준" },
    ]},
    { month: "2026-03", data: [
      { name: "NVIDIA", value: 11200, src: "NVIDIA IR" },
      { name: "OpenAI", value: 1060, src: "ARR 기준 성장 반영" },
      { name: "Microsoft AI", value: 1100, src: "Azure OpenAI 추정" },
      { name: "Anthropic", value: 330, src: "ARR 기준 성장" },
      { name: "Databricks", value: 200, src: "ARR 기준" },
      { name: "Scale AI", value: 120, src: "ARR 기준" },
    ]},
    { month: "2026-04", data: [
      { name: "NVIDIA", value: 11500, src: "NVIDIA IR" },
      { name: "OpenAI", value: 1100, src: "ARR 기준" },
      { name: "Microsoft AI", value: 1150, src: "Azure OpenAI 추정" },
      { name: "Anthropic", value: 350, src: "ARR 기준" },
      { name: "Databricks", value: 210, src: "ARR 기준" },
      { name: "Scale AI", value: 125, src: "ARR 기준" },
    ]},
    { month: "2026-05", data: [
      { name: "NVIDIA", value: 11800, src: "NVIDIA IR" },
      { name: "OpenAI", value: 1150, src: "ARR 기준" },
      { name: "Microsoft AI", value: 1200, src: "Azure OpenAI 추정" },
      { name: "Anthropic", value: 370, src: "ARR 기준" },
      { name: "Databricks", value: 215, src: "ARR 기준" },
      { name: "Scale AI", value: 130, src: "ARR 기준" },
    ]},
  ];

  return { CATEGORIES, COMPANIES, ARTICLES, REPORTS, MARKET_GROWTH, FUNDING, SHARE, USERS, BAND_PRICE, FUNDING_TREND, AI_DEALS, REVENUE, BIZ_MODELS, KPIS, INSIGHTS, QA_PAIRS, APP_MONTHLY, REVENUE_MONTHLY };
})();
