/* ============================================================
   AI Intelligence Dashboard (2026.06.17)
   AI 산업 전반 · 플레인 텍스트 복사 가능 sources 배열
   ============================================================ */
window.DASH = (function () {
  "use strict";

  const CATEGORIES = [
    { id: "native", ko: "AI 네이티브", en: "AI Native", accent: "#7A38D6", accentSoft: "#F0E9FB", desc: "파운데이션 모델·범용 AI 플랫폼 기업" },
    { id: "bigtech", ko: "빅테크 AI", en: "Big Tech AI", accent: "#1428A0", accentSoft: "#E8ECFA", desc: "대형 기술 기업의 AI 사업부·인프라" },
    { id: "startup", ko: "AI 스타트업", en: "AI Startups", accent: "#0E8F6E", accentSoft: "#E2F4EE", desc: "버티컬·응용 AI 스타트업" },
  ];

  /* ---- Companies (full schema: 카드·상세·VP·그래프 공용) ---- */
  const COMPANIES = [
    // ── native ──
    {
      cat: "native", name: "OpenAI", domain: "openai.com", unit: "파운데이션 모델",
      valuation: "$852B", valAsof: "26.03", metric: "ARR", value: "$35B", metricAsof: "26.05",
      funding: "S-1 제출(IPO 준비)", trend: 175, trendBasis: "ARR $6B→$35B (2024말→2026.05)",
      note: "GPT-4o·o3, ChatGPT, Sora — 세계 최대 범용 AI 플랫폼. 2026.03 라운드로 밸류 $852B(사모 사상 최고), 2026.06.08 SEC에 S-1 비밀 제출. 주간 활성 사용자 800M+. ARR 궤적: $6B(2024말)→$20B(2025말, CFO 확인)→$25B(2026.02)→~$35B(2026.05).",
      vp: "최고 성능 멀티모달 모델과 8억 사용자 규모의 소비자 접점을 동시에 보유한 유일한 사업자. API·구독·엔터프라이즈로 매출 다각화.",
      direction: "범용 인공지능(AGI) 지향 + IPO를 통한 대규모 컴퓨트 자금 조달. 추론 모델(o-시리즈)과 에이전트로 확장.",
      sources: ["밸류 $852B — 2026.03 라운드 완료 (CNBC '26.3)", "S-1 비밀 제출 2026.06.08 (Bloomberg)", "ARR $25B 돌파 2026.02 (The Information / Reuters)", "ARR ~$35B 추정 2026.05 (Gerstner 인용)", "주간 활성 사용자 800M+ (OpenAI 공식 '26.5)"],
      url: "https://openai.com",
    },
    {
      cat: "native", name: "Anthropic", domain: "anthropic.com", unit: "파운데이션 모델·안전성",
      valuation: "$380B", valAsof: "26.04", metric: "ARR", value: "$9B+", metricAsof: "26.05",
      funding: "Amazon 누적 $33B", trend: 120, trendBasis: "ARR 2026초 $4B → 급성장",
      note: "Claude Opus/Sonnet/Haiku, Constitutional AI — 안전성 우선 AI 연구소. 2026.04.20 Amazon 추가 $25B 투자($5B 즉시+조건부 $20B)로 밸류 $380B 공식 확인, Amazon 누적 투자 $33B. AWS 10년 $100B+ 약정. ARR은 2026초 $4B에서 급성장(일부 추정 ~$45B, 검증 진행 중).",
      vp: "Constitutional AI 기반의 신뢰·안전성으로 금융·의료·법률 등 규제 산업 엔터프라이즈에서 선호. 코딩 에이전트 성능 최상위.",
      direction: "안전성 연구와 상업화의 균형. Amazon·Google 클라우드 파트너십으로 컴퓨트 확보, 엔터프라이즈 침투 가속.",
      sources: ["밸류 $380B — Amazon 투자 당시 공식 (CNBC '26.4.20)", "Amazon 추가 $25B, 누적 $33B (NYT '26.4.20)", "AWS 10년 $100B+ 약정 (GeekWire '26)", "ARR ~$45B 추정 (FT·SemiAnalysis '26.5, 검증 필요)"],
      url: "https://anthropic.com",
    },
    {
      cat: "bigtech", name: "Google DeepMind", domain: "deepmind.google", unit: "파운데이션 모델(Alphabet)",
      valuation: "—", valAsof: "—", metric: "Gemini MAU", value: "6.5억", metricAsof: "26.05",
      funding: "Alphabet 산하", trend: 30, trendBasis: "Gemini 사용자·점유율 확대",
      note: "Gemini 3.x, AlphaFold, Gemma — Alphabet의 AI 연구 조직. Gemini 3 멀티모달 최고 성능권, 100만 토큰 컨텍스트. AlphaFold로 노벨화학상 수상. Gemma 오픈 모델로 개발자 생태계 확장. 검색·워크스페이스·안드로이드에 Gemini 전면 통합.",
      vp: "검색·유튜브·안드로이드·클라우드 등 수십억 사용자 유통망에 모델을 직접 배포. TPU 자체 칩으로 컴퓨트 수직계열화.",
      direction: "프런티어 모델 연구 + Alphabet 제품 전면 통합. 온디바이스(Gemini Nano)부터 데이터센터까지 풀스택.",
      sources: ["Gemini 3 출시 (Google I/O '26.5)", "AlphaFold 노벨화학상 2024", "Gemini MAU ~6.5억 추정 (Google I/O '26.5)"],
      url: "https://deepmind.google",
    },
    {
      cat: "native", name: "xAI", domain: "x.ai", unit: "파운데이션 모델",
      valuation: "$230B+", valAsof: "26.01", metric: "Grok MAU", value: "6억", metricAsof: "26.01",
      funding: "Series E $20B", trend: 60, trendBasis: "누적 조달 $42B+",
      note: "Grok, Colossus 슈퍼클러스터 — 일론 머스크 설립. 2026.01.06 Series E $20B 완료(NVIDIA·Cisco·카타르 국부펀드 참여), 누적 조달 $42B+(PitchBook). Grok 월간 활성 사용자 6억(X 포함). Grok 5 2026 상반기 예고. 단, 딥페이크 CSAM 생성 논란으로 다수 정부 조사 개시.",
      vp: "X 플랫폼의 실시간 데이터와 6억 사용자 접점, 그리고 머스크 생태계(Tesla·SpaceX)와의 연계.",
      direction: "최대 규모 컴퓨트(Colossus) 확장 + X 통합. SpaceX의 Cursor 인수로 코딩 에이전트 역량 보강.",
      sources: ["Series E $20B 완료 (TechCrunch '26.1.6)", "누적 조달 $42B+ (PitchBook / NYT '26.1)", "Grok MAU 6억 (TechCrunch '26.1)", "딥페이크 논란·정부 조사 (The Guardian '26.1)"],
      url: "https://x.ai",
    },
    {
      cat: "native", name: "DeepSeek", domain: "deepseek.com", unit: "오픈 파운데이션 모델(중국)",
      valuation: "$52B~59B", valAsof: "26.06", metric: "추론 비용", value: "GPT-4급 1/10", metricAsof: "26.05",
      funding: "첫 외부 라운드", trend: 50, trendBasis: "효율 혁신·첫 외부 투자",
      note: "DeepSeek-V3, R1 — 중국 최대 AI 연구소. 2026년 첫 외부 투자 라운드 개시(목표 밸류 $52B~$59B, 중국 국유 빅펀드 주도). R1·V3가 GPT-4급 성능을 약 1/10 비용으로 구현해 'AI 비용 혁명(Sputnik Moment)' 촉발. 단, 국유 펀드 투자로 지정학적 리스크 존재.",
      vp: "압도적 비용 효율과 오픈 가중치 배포로 빠른 채택. AI 인프라 비용 패러다임 전환의 상징.",
      direction: "효율 중심 모델 + 오픈 생태계. 다만 수출 규제·지정학 변수에 노출.",
      sources: ["첫 외부 라운드 밸류 $45B~$59B (Reuters / TechNode '26.5)", "R1·V3 1/10 비용 GPT-4급 성능", "중국 국유 빅펀드 주도 (FT '26.6)"],
      url: "https://www.deepseek.com",
    },

    // ── bigtech ──
    {
      cat: "bigtech", name: "Apple", domain: "apple.com", unit: "온디바이스 AI",
      valuation: "$3.3T", valAsof: "26.06", metric: "처리 방식", value: "기기 내 추론", metricAsof: "—",
      funding: "상장 (AAPL)", trend: 5, trendBasis: "온디바이스 AI 통합 범위",
      note: "Apple Intelligence — 온디바이스 LLM로 기기 내에서 추론을 수행하고, 민감 작업은 Private Cloud Compute로 처리해 프라이버시를 보호. 본 대시보드에서는 Apple을 외부 개발자용 AI 플랫폼(클라우드 모델 API) 사업자가 아닌, '소비자 기기 내 온디바이스 AI 통합' 관점으로만 다룸.",
      vp: "데이터를 기기 밖으로 내보내지 않는 온디바이스·프라이빗 추론. 하드웨어(Neural Engine)와 OS 수직 통합.",
      direction: "온디바이스 모델 고도화와 앱 연동 확대. 클라우드 파운데이션 모델 경쟁이 아닌 단말 경험 차별화에 집중.",
      sources: ["Apple Intelligence 온디바이스 + Private Cloud Compute (WWDC '24~'26)", "외부 개발자용 클라우드 모델 API 미제공 — 온디바이스 통합에 한정"],
      url: "https://www.apple.com/apple-intelligence/",
    },
    {
      cat: "bigtech", name: "Microsoft", domain: "microsoft.com", unit: "Copilot·Azure AI",
      valuation: "$3.5T", valAsof: "26.06", metric: "AI 런레이트", value: "$37B", metricAsof: "26.Q3",
      funding: "상장 (MSFT)", trend: 123, trendBasis: "AI 부문 +123% YoY",
      note: "Copilot, Azure OpenAI, GitHub Copilot — OpenAI 최대 파트너. Q3 FY2026 실적에서 Satya Nadella가 AI 부문 연 매출 런레이트 $37B(+123% YoY) 공식 확인. M365 Copilot 유료 좌석 2,000만 돌파(+250% YoY), Azure 35% 재가속. Accenture 74만 좌석 최대 고객.",
      vp: "Office·Windows·Teams 번들 락인 + OpenAI 독점 파트너십. 기업 워크플로우에 AI를 기본 탑재.",
      direction: "Copilot 전 제품 통합 + Azure AI 인프라 확장. 자체 모델(MAI)과 OpenAI 병행으로 의존도 관리.",
      sources: ["AI 런레이트 $37B (+123%) — Q3 FY26 (Microsoft IR '26.4.29)", "Copilot 유료 좌석 2,000만 (+250% YoY)", "Azure 성장 35% 재가속", "Accenture 74만 좌석 최대 고객 (UC Today '26)"],
      url: "https://www.microsoft.com/ai",
    },
    {
      cat: "bigtech", name: "Amazon", domain: "amazon.com", unit: "AWS Bedrock·Trainium",
      valuation: "$2.4T", valAsof: "26.06", metric: "AWS AI ARR", value: "$14B+", metricAsof: "26E",
      funding: "상장 (AMZN)", trend: 40, trendBasis: "Bedrock·자체 칩 성장",
      note: "Bedrock, Alexa+, Trainium 칩 — AWS Bedrock 멀티모델 호스팅. 2026.02 OpenAI $50B 투자+$100B 클라우드 약정, 2026.04.20 Anthropic 추가 $25B(누적 $33B)+AWS $100B 약정으로 '양쪽 베팅(two-horse)' 전략. Trainium2로 NVIDIA 의존도 저감.",
      vp: "어느 AI가 이기든 인프라 공급자로서 수익을 확보하는 중립적 클라우드 포지션 + 자체 가속기.",
      direction: "OpenAI·Anthropic 양쪽 투자 + Bedrock 멀티모델 + Trainium 수직계열화로 Azure 대항.",
      sources: ["Anthropic 추가 $25B, 누적 $33B (CNBC '26.4.20)", "OpenAI $50B 투자+$100B AWS 약정 (2026.02)", "AWS AI 서비스 $14B+ ARR 추정 (2026E)"],
      url: "https://aws.amazon.com/ai/",
    },
    {
      cat: "bigtech", name: "NVIDIA", domain: "nvidia.com", unit: "AI GPU·CUDA",
      valuation: "$3.5T+", valAsof: "26.06", metric: "분기 매출", value: "$57B", metricAsof: "26.Q3",
      funding: "상장 (NVDA)", trend: 66, trendBasis: "데이터센터 +66% YoY",
      note: "H100/B200 GPU, CUDA — AI 학습/추론 GPU 시장 80%+ 점유. Q3 FY2026 분기 매출 $57B, 데이터센터 $51.2B(+66% YoY). FY2026 연매출 $130.5B(+114%). B200 Blackwell 연 150~200만 대 출하 전망(GPU 단독 매출 $50B+). CUDA 생태계 400M+ 개발자.",
      vp: "GPU 하드웨어 80%+ 점유에 CUDA 소프트웨어 락인을 더한 이중 해자. 풀스택(칩·네트워킹·소프트웨어).",
      direction: "Blackwell(B200)·차세대 아키텍처 램프 + DGX Cloud + Omniverse. 전력·공급망이 핵심 변수.",
      sources: ["Q3 FY26 분기 매출 $57B, 데이터센터 $51.2B (+66%) (2026.01)", "FY2026 연매출 $130.5B (+114%)", "B200 연 150~200만 대 출하 전망"],
      url: "https://www.nvidia.com",
    },
    {
      cat: "bigtech", name: "Meta AI", domain: "ai.meta.com", unit: "오픈소스 LLM",
      valuation: "$1.7T", valAsof: "26.06", metric: "월간 사용자", value: "30억+", metricAsof: "26.04",
      funding: "상장 (META)", trend: 35, trendBasis: "Llama 채택·AI 광고",
      note: "Llama 4, 오픈소스 LLM 리더 — 세계 최대 오픈 가중치 모델 배포. Meta AI 어시스턴트가 페이스북·인스타·왓츠앱에 통합되어 앱 월간 사용자 30억+에 노출(전체 앱 사용자이며 AI 활성 사용자와는 구분). 연간 AI 인프라 투자 $65B+. (본 대시보드에서 빅테크 AI로 분류)",
      vp: "가장 넓은 오픈소스 분포 + 30억 규모 유통망. 무료 모델로 생태계를 키우고 AI 광고로 수익화.",
      direction: "오픈 가중치 Llama로 표준 장악 + 광고 최적화 수익. 슈퍼인텔리전스 랩으로 프런티어 투자.",
      sources: ["Llama 4 오픈 가중치 배포", "Meta 앱 월간 사용자 30억+ (Meta IR '26.4)", "연간 AI 인프라 투자 $65B+ (2025~)"],
      url: "https://ai.meta.com",
    },

    // ── startup ──
    {
      cat: "startup", name: "Perplexity", domain: "perplexity.ai", unit: "AI 검색·에이전트 브라우저",
      valuation: "$18B", valAsof: "26", metric: "ARR", value: "$450M+", metricAsof: "26.03",
      funding: "Series", trend: 50, trendBasis: "ARR 1개월 +50%",
      note: "AI 검색·답변 엔진 + Comet AI 브라우저. ARR $450M+(2026.03, 1개월 만에 +50%), 연 $656M 목표. 2026.06 Comet 전 세계 무료 공개로 크롬(점유율 65%)과 정면 충돌. 출처 명시 답변으로 신뢰도 차별화.",
      vp: "출처를 명시하는 답변 엔진 + 자율 에이전트 브라우저(Comet)로 탐색·구매까지 대행.",
      direction: "검색을 넘어 에이전틱 브라우징·커머스로 확장. 광고/구독 하이브리드 수익화.",
      sources: ["ARR $450M+ (1개월 +50%) (NewClawTimes '26.3)", "Comet 전 세계 무료 공개 (Perplexity '26.6)", "연 $656M ARR 목표"],
      url: "https://www.perplexity.ai",
    },
    {
      cat: "startup", name: "Mistral AI", domain: "mistral.ai", unit: "유럽 파운데이션 모델",
      valuation: "$23B", valAsof: "26.06", metric: "라운드", value: "€3B 협의", metricAsof: "26.06",
      funding: "€20B 밸류", trend: 100, trendBasis: "밸류 €11.7B→€20B (2배)",
      note: "프랑스 기반 AI 스타트업. 2026.06 밸류 €20B($23B) 신규 €3B 라운드 협의(직전 €11.7B 대비 2배). 파리 데이터센터(13,800 NVIDIA 칩)·스웨덴 시설 건설. Le Chat·Mistral Large. 유럽 AI 주권의 상징.",
      vp: "유럽 규제 호환성·데이터 주권 + 효율적 오픈 모델. EU 공공·산업 고객 접근성.",
      direction: "유럽 주권 AI 포지셔닝 + 자체 컴퓨트 확보 + 엔터프라이즈 커스텀 모델.",
      sources: ["€20B($23B) 밸류 €3B 라운드 협의 (Bloomberg '26.6)", "직전 €11.7B (ASML 주도 '25.9)", "파리 데이터센터 13,800 NVIDIA 칩"],
      url: "https://mistral.ai",
    },
    {
      cat: "startup", name: "Cohere", domain: "cohere.com", unit: "엔터프라이즈·소버린 LLM",
      valuation: "$5.5B", valAsof: "25.07", metric: "ARR", value: "$240M", metricAsof: "25",
      funding: "Series D · IPO 준비", trend: 50, trendBasis: "전 분기 QoQ 50%+",
      note: "기업용·소버린 AI 특화. 2025년 ARR $240M(목표 $200M 초과, 전 분기 QoQ 50%+). 2026.05 Command A+ 오픈소스·North Mini Code 출시. 밸류 $5.5B(2025.07). Oracle·Salesforce·SAP 파트너십, IPO 준비.",
      vp: "엔터프라이즈 데이터 보안·소버린(주권) 배포와 RAG 최적화 모델.",
      direction: "규제·보안 민감 산업 + 국가 소버린 AI 타깃, IPO 추진.",
      sources: ["ARR $240M (CNBC '26.2)", "Command A+ 오픈소스 (2026.5)", "Oracle·Salesforce·SAP 파트너십"],
      url: "https://cohere.com",
    },
    {
      cat: "startup", name: "Databricks", domain: "databricks.com", unit: "데이터+AI 플랫폼",
      valuation: "$134B", valAsof: "26.02", metric: "ARR", value: "$5.4B", metricAsof: "26.06",
      funding: "Series L · $175B 협의", trend: 116, trendBasis: "밸류 $62B→$134B",
      note: "데이터 레이크하우스 + AI 통합 플랫폼. 2026.02 Series L $5B로 밸류 $134B 확정(JPMorgan·Goldman·카타르). ARR 런레이트 $5.4B 돌파, 밸류 $175B 라운드 협의. CEO Ghodsi 'IPO는 2027년 목표'. 최고가치 미상장 소프트웨어 기업.",
      vp: "기업 데이터가 모여 있는 레이크하우스 위에서 바로 AI를 학습·배포. 데이터-모델 통합 가치사슬.",
      direction: "데이터+AI 통합 플랫폼 확장 + 에이전트·거버넌스. 2027년 IPO 목표.",
      sources: ["Series L $5B, 밸류 $134B (2026.02)", "ARR 런레이트 $5.4B (2026.06)", "밸류 $175B 라운드 협의"],
      url: "https://databricks.com",
    },
    {
      cat: "startup", name: "Scale AI", domain: "scale.com", unit: "AI 데이터·평가·국방",
      valuation: "$14B", valAsof: "24.05", metric: "국방 계약", value: "$500M", metricAsof: "26.05",
      funding: "Series F", trend: 30, trendBasis: "국방 계약 5배 확대",
      note: "AI 학습 데이터·RLHF·모델 평가 플랫폼. 2026.05 미 국방부 $500M OTA 계약(8개월 만에 $100M→$500M, 5배). 컴퓨터 비전·GenAI 의사결정 지원·군사 계획 도구. 데이터 품질·평가가 모델 경쟁의 핵심 변수.",
      vp: "프런티어 모델 학습용 고품질 라벨·평가 데이터 + 정부(국방) 의사결정 레이어.",
      direction: "RLHF·평가·국방 AI로 확장. 데이터 신뢰성·평가 표준화.",
      sources: ["국방부 $500M 계약 (Bloomberg '26.5)", "밸류 $14B (Forbes '24.5)", "ARR $1.4B+ 추정"],
      url: "https://scale.com",
    },
    {
      cat: "startup", name: "Runway", domain: "runwayml.com", unit: "비디오 생성 AI",
      valuation: "$4B", valAsof: "24.06", metric: "제품", value: "Gen-4", metricAsof: "26.05",
      funding: "Series D", trend: 25, trendBasis: "영상 생성 채택",
      note: "비디오 생성 AI 선도. 2026.05 Gen-4 출시 — 네이티브 오디오 생성·리얼리스틱 물리 엔진. Adobe Firefly에 Gen-4.5 최우선 배포 멀티이어 파트너십. 할리우드 제작 현장 도입 가속. 밸류 $4B(2024.06).",
      vp: "전문가급 영상+오디오 생성 품질과 크리에이티브 워크플로우 도구.",
      direction: "영상·오디오 통합 생성 고도화 + Adobe 파트너십으로 제작 시장 침투.",
      sources: ["Gen-4 출시 (2026.05)", "Adobe Firefly 멀티이어 파트너십", "밸류 $4B (Bloomberg '24.6)"],
      url: "https://runwayml.com",
    },
    {
      cat: "startup", name: "Stability AI", domain: "stability.ai", unit: "생성 미디어(재건)",
      valuation: "$1B", valAsof: "23 피크", metric: "매출(추정)", value: "$190M", metricAsof: "26",
      funding: "구조조정·재건", trend: -10, trendBasis: "턴어라운드 케이스",
      note: "Stable Diffusion으로 이미지 생성을 대중화했으나 재정난·구조조정을 겪은 재건 케이스. 2026.05 Stable Audio 3.0(오픈웨이트)·Brand Studio 출시. 신임 CEO Prem Akkaraju(전 Weta)+Sean Parker·Eric Schmidt 이사회. 2026 추정 매출 $190M — 이미지에서 오디오·엔터프라이즈로 전환.",
      vp: "오픈 가중치 생성 모델 자산 + 엔터프라이즈 라이선싱·커스텀 트레이닝으로 수익 재편.",
      direction: "이미지→오디오·영상·엔터프라이즈 크리에이티브 툴로 포트폴리오 확장(턴어라운드 진행).",
      sources: ["Stable Audio 3.0·Brand Studio (2026.5)", "신임 CEO·이사회 재건 (CIO)", "2026 추정 매출 $190M"],
      url: "https://stability.ai",
    },
    {
      cat: "startup", name: "ElevenLabs", domain: "elevenlabs.io", unit: "AI 음성 합성",
      valuation: "$11B", valAsof: "26.02", metric: "ARR", value: "$330M+", metricAsof: "26.01",
      funding: "Series D $500M", trend: 233, trendBasis: "밸류 $3.3B→$11B (3배+)",
      note: "AI 음성 생성·TTS 시장 선도. 2026.02 Series D $500M로 밸류 $11B(1년 전 $3.3B 대비 3배+), Sequoia 주도·NVIDIA 백업. ARR $330M+(2026.01). 팟캐스트·게임·영상 제작의 표준 음성 API.",
      vp: "자연스러운 다국어 음성 합성 품질과 개발자 친화 API. 콘텐츠 제작 파이프라인 표준화.",
      direction: "음성 에이전트·더빙·실시간 대화로 확장. IPO 옵션 검토.",
      sources: ["Series D $500M, 밸류 $11B (CNBC / Reuters '26.2.4)", "ARR $330M+ (2026.01)", "Sequoia 주도·NVIDIA 투자"],
      url: "https://elevenlabs.io",
    },
    {
      cat: "startup", name: "Harvey", domain: "harvey.ai", unit: "법률 버티컬 AI",
      valuation: "$11B", valAsof: "26.03", metric: "ARR", value: "$190M", metricAsof: "26.01",
      funding: "Series C $200M", trend: 90, trendBasis: "ARR 5개월 $100M→$190M",
      note: "법률 전문 AI 에이전트 — 버티컬 AI 리더. 2026.03 Series C $200M로 밸류 $11B(Sequoia·GIC 주도). ARR $190M(5개월 만에 $100M→$190M, +90%). 전 세계 1,300개+ 법률 조직, 변호사 10만 명+ 사용. AmLaw 100 과반수 고객.",
      vp: "법률 워크플로우에 특화된 도메인 데이터·에이전트로 대형 로펌의 신뢰 확보.",
      direction: "법률 외 전문서비스(세무·컴플라이언스)로 확장. 버티컬 에이전트 섹터 지표 기업.",
      sources: ["Series C $200M, 밸류 $11B (2026.03)", "ARR $190M (AgentMarketCap '26.4)", "변호사 10만 명+ 사용"],
      url: "https://www.harvey.ai",
    },
    {
      cat: "startup", name: "Glean", domain: "glean.com", unit: "엔터프라이즈 AI 검색",
      valuation: "$7.2B", valAsof: "26.02", metric: "ARR", value: "$200M+", metricAsof: "26.01",
      funding: "Series F", trend: 80, trendBasis: "엔터프라이즈 표준화",
      note: "기업 내부 데이터 연결 AI 검색·지식 에이전트. 밸류 $7.2B, ARR $200M+. 대형 기업 IT·운영 부서의 AI 표준 도구로 부상. 'The Agentic List 2026' 선정.",
      vp: "사내 SaaS·문서를 권한 기반으로 통합 검색하는 엔터프라이즈 지식 그래프 + 에이전트.",
      direction: "검색에서 업무 자동화 에이전트로 확장. 대기업 표준 플랫폼 지향.",
      sources: ["밸류 $7.2B, ARR $200M+ (2026)", "The Agentic List 2026 선정 (IBL News)"],
      url: "https://www.glean.com",
    },
    {
      cat: "startup", name: "Sierra AI", domain: "sierra.ai", unit: "고객 서비스 AI 에이전트",
      valuation: "$10B", valAsof: "26.03", metric: "ARR", value: "$150M", metricAsof: "26.01",
      funding: "Sequoia 주도", trend: 100, trendBasis: "Revenue Multiple 67x",
      note: "고객 대면 AI 에이전트 플랫폼 — 기업 고객 서비스 전문. 밸류 $10B, ARR $150M. Revenue Multiple 67x로 AI 에이전트 섹터 최고 수준. (공동창업: Bret Taylor) Sequoia 투자.",
      vp: "기업 브랜드 맞춤형 고객 응대 에이전트로 콜센터·CS 비용 구조 재편.",
      direction: "산업별 CS 에이전트 템플릿 확장. 성과 기반 과금 실험.",
      sources: ["밸류 $10B, ARR $150M (ValueAdd VC '26)", "Revenue Multiple 67x"],
      url: "https://sierra.ai",
    },
  ];

  /* ---- Articles (per-company, newest first) — co: 기업명(필터용) ---- */
  const ARTICLES = [
    // ── AI Native ──
    { date: "2026-06-08", co: "OpenAI", cat: "native", source: "Al Jazeera / Reuters", title: "OpenAI, 미국 증시 S-1 공식 제출 — IPO 역사상 최대 규모 예고", summary: "· 2026.06.08 SEC S-1 비밀 제출 확인, 공모가 기준 밸류 $852B(2026.03 라운드)\n· 이르면 2026.09 상장 목표(Reuters)\n· 2026 Q1 운영 손실 $3.7B — 매출 폭증에도 컴퓨트·인건비가 더 빠르게 증가\n· ARR $6B(2024말)→$20B(2025말)→$25B(2026.02)→~$35B(2026.05)", tag: "IPO", url: "https://www.aljazeera.com/economy/2026/6/8/tech-giant-openai-files-for-us-initial-public-offering" },
    { date: "2026-06-09", co: "Anthropic", cat: "native", source: "Anthropic", title: "Anthropic, Claude Fable 5 출시 — 자율 코딩 에이전트 SWE-bench 신기록", summary: "· 최신 플래그십 Claude Fable 5 출시(2026.06.09) — 코딩 에이전트 역대 최고 성능\n· SWE-bench Verified 최상위권, 1M 토큰 컨텍스트·128K 출력\n· Claude Opus 4.6(2026.02)→4.7(2026.04 GA)→Fable 5 빠른 사이클\n· Amazon 추가 $25B 투자 후 AWS Bedrock 최우선 배포", tag: "Product", url: "https://www.anthropic.com/news" },
    { date: "2026-04-21", co: "Google DeepMind", cat: "native", source: "Google", title: "Google, Gemini 3.1 Pro + Deep Research Max — ARC-AGI-2 77.1%", summary: "· Gemini 3.1 Pro ARC-AGI-2 77.1%, SWE-Bench Verified 80.6%\n· Deep Research Max — 자율 리서치 에이전트, MCP 지원\n· 100만 토큰 컨텍스트, 검색·워크스페이스 전면 통합\n· Google AI Ultra 구독자 우선 배포", tag: "Product", url: "https://blog.google/technology/ai/" },
    { date: "2026-01-06", co: "xAI", cat: "native", source: "TechCrunch / NYT / The Guardian", title: "xAI, Series E $20B 완료 — 밸류 $230B+, Grok 딥페이크 논란 동시 직면", summary: "· Series E $20B 완료(NVIDIA·Cisco·카타르 국부펀드·Fidelity)\n· 누적 총 조달액 $42B+(PitchBook) · 밸류 $230B+ 추정\n· Grok 월간 활성 사용자 6억(X 포함)\n· Grok 미성년 딥페이크 자동 생성 논란 → 다수 정부 조사 개시", tag: "Funding", url: "https://www.theguardian.com/technology/2026/jan/06/elon-musk-xai-investment-grok-backlash" },
    { date: "2026-06-03", co: "DeepSeek", cat: "native", source: "Reuters / FT", title: "DeepSeek, 첫 외부 펀딩 — 밸류 최대 $59B, AI 비용 혁명 선도", summary: "· 중국 DeepSeek 첫 외부 펀딩, 국유 빅펀드 주도\n· 목표 밸류 $52B~$59B\n· R1·V3로 GPT-4급 성능을 1/10 비용 구현\n· 'Sputnik Moment' — AI 인프라 비용 혁신의 상징", tag: "Funding", url: "https://technode.com/2026/05/07/deepseek-reportedly-seeks-first-funding-round-at-45-billion-valuation/" },

    // ── Big Tech AI ──
    { date: "2026-06-08", co: "Apple", cat: "bigtech", source: "MacRumors / Apple", title: "Apple WWDC 2026 — Siri AI 재설계, 온디바이스 + Private Cloud Compute 강화", summary: "· Siri를 'Siri AI'로 재설계 — 온디바이스 Foundation Models 중심\n· Private Cloud Compute: 클라우드 처리 시 무기명(Anonymous) 보장\n· 시스템 전역 컨텍스트 이해·Visual Intelligence 확장\n· Foundation Models 프레임워크 외부 개발자 공개 · iOS 27 가을 출시", tag: "Product", url: "https://www.apple.com/apple-intelligence/" },
    { date: "2026-04-29", co: "Microsoft", cat: "bigtech", source: "Microsoft IR / UC Today", title: "Microsoft Q3 FY2026 — AI 연 매출 $37B 런레이트, Azure 35% 재가속", summary: "· Nadella 확인: AI 사업 연 매출 런레이트 $37B(+123% YoY)\n· M365 Copilot 유료 좌석 2,000만 돌파(+250% YoY)\n· 전체 매출 $82.9B(+18%) · Azure 35% 재가속\n· Accenture 74만 좌석 최대 고객", tag: "Earnings", url: "https://www.uctoday.com/unified-communications/microsoft-earnings-2026-ai-copilot-enterprise/" },
    { date: "2026-04-20", co: "Amazon", cat: "bigtech", source: "CNBC / NYT / GeekWire", title: "Amazon, Anthropic에 추가 $25B 투자 — AWS $100B+ 약정, 누적 $33B", summary: "· Anthropic 추가 $25B($5B 즉시+조건부 $20B), 누적 $33B\n· Anthropic의 AWS 10년 클라우드 약정 $100B+\n· 2개월 전 OpenAI $50B+$100B 딜과 동시 진행 '양쪽 베팅'\n· Bedrock ~100개 파운데이션 모델 지원, Guardrails 80% 인하", tag: "Funding", url: "https://www.cnbc.com/2026/04/20/amazon-invest-up-to-25-billion-in-anthropic-part-of-ai-infrastructure.html" },
    { date: "2026-01-29", co: "NVIDIA", cat: "bigtech", source: "NVIDIA IR / The Verge", title: "NVIDIA Q4 FY2026 분기 매출 $57B — Blackwell 역사상 가장 빠른 램프업", summary: "· 분기 매출 $57B(신기록), 데이터센터 $51.2B(+66%)\n· FY2026 연 $130.5B(+114%) 최종 확정\n· B200 추론 성능 H100 대비 30배, 연 150~200만 대 출하 전망\n· 하이퍼스케일러 자체 칩 190만 가속기 배포로 '분리' 가속", tag: "Earnings", url: "https://www.nvidia.com/en-us/investor-relations/" },
    { date: "2025-04-05", co: "Meta AI", cat: "bigtech", source: "Meta / NDTV", title: "Meta, Llama 4 발표 — Scout·Maverick 오픈소스, Behemoth 2T MoE 예고", summary: "· Llama 4 Scout·Maverick 오픈소스 즉시 공개\n· Behemoth: 2T 총 파라미터, 288B 활성 MoE — 업계 최대 규모\n· Meta AI 어시스턴트 WhatsApp·Instagram·Messenger 통합, 월 30억+\n· Llama Guard 4 등 오픈소스 보안 툴 동시 공개", tag: "Product", url: "https://www.ndtv.com/world-news/meta-launches-llama-4-all-about-the-latest-open-source-ai-model-8100928" },

    // ── AI Startup ──
    { date: "2026-06-16", co: "SpaceX (xAI, Cursor)", cat: "native", source: "CNBC / Bloomberg / Forbes", title: "SpaceX, Cursor $60B 인수 합의 — IPO 직후 AI 코딩 에이전트 M&A 시대", summary: "· SpaceX(xAI 생태계)가 IPO 직후 Cursor(Anysphere) $60B 주식 인수 합의\n· ARR $2B+, 기업 고객 60%(Stripe·Adobe·NVIDIA)\n· 밸류 $2.5B→$29.3B→$50B 협상→$60B 최종\n· Jensen Huang '최애 엔터프라이즈 AI 서비스'로 지목, 2026 Q3 완료", tag: "M&A", url: "https://www.cnbc.com/2026/06/16/spacex-spcx-cursor-acquisition-ipo.html" },
    { date: "2026-06-04", co: "Perplexity", cat: "startup", source: "Perplexity / CNET", title: "Perplexity Comet 브라우저 전 세계 무료 공개 — ARR $450M, 크롬과 충돌", summary: "· Comet AI 브라우저 전 세계 무료 공개(기존 $200/월 전용→무료)\n· 무료화 후 1개월 만에 월 수익 50% 급등 → ARR $450M+\n· AI 에이전트가 탭 관리·이메일 요약·자동 구매 자율 수행\n· 보안 취약점 노출 후 6월 재출시 · Comet Plus 퍼블리셔 프로그램", tag: "Product", url: "https://www.perplexity.ai/hub/blog/comet-is-now-available-to-everyone-worldwide" },
    { date: "2026-06-11", co: "Mistral AI", cat: "startup", source: "Bloomberg / TechCrunch", title: "Mistral AI, €3B 라운드 협의 — 밸류 €20B($23B), 직전 대비 2배", summary: "· 밸류 €20B($23B) 신규 €3B 라운드 협의 개시\n· 직전 €11.7B($14B, 2025.09 ASML 주도) 대비 약 2배\n· 파리 데이터센터(13,800 NVIDIA 칩)·스웨덴 시설 건설\n· EU AI 자주권 기업으로 정부·기업 수요 지속 증가", tag: "Funding", url: "https://www.cnbc.com/2026/03/30/mistral-ai-paris-data-center-cluster-debt-financing.html" },
    { date: "2026-05-20", co: "Cohere", cat: "startup", source: "CNBC / Cohere", title: "Cohere, ARR $240M 돌파 + Command A+ 오픈소스 — IPO 준비 본격화", summary: "· 2025년 ARR $240M 달성(목표 $200M 초과), 전 분기 QoQ 50%+\n· Command A+ 오픈소스 출시 — 소버린 엔터프라이즈 AI 모델\n· North Mini Code 개발자용 에이전트 코딩 모델 공개\n· Oracle·Salesforce·SAP 파트너십, CEO IPO '곧' 재확인", tag: "Earnings", url: "https://www.cnbc.com/2026/02/13/ai-startup-cohere-revenue-ipo.html" },
    { date: "2026-05-20", co: "Stability AI", cat: "startup", source: "Stability AI / CIO", title: "Stability AI, Stable Audio 3.0 + Brand Studio — 엔터프라이즈 전환 가속", summary: "· Stable Audio 3.0 오픈웨이트 공개 — 최대 6분 음악·효과음 생성\n· Brand Studio 런칭 — 마케팅·광고팀 엔드투엔드 제작 플랫폼\n· 신임 CEO Prem Akkaraju(전 Weta) + Sean Parker·Eric Schmidt 이사회\n· 2026 추정 매출 $190M — 이미지→오디오·엔터프라이즈로 확장", tag: "Product", url: "https://www.cio.com/article/2505518/stability-ai-gets-new-ceo-and-investment-dream-team-to-start-rescue-mission.html" },
    { date: "2026-06-08", co: "Databricks", cat: "startup", source: "CNBC / TechFundingNews", title: "Databricks, ARR 런레이트 $5.4B 돌파 — 밸류 $175B 라운드 협의", summary: "· ARR $5.4B 달성(이전 $4.8B에서 급증)\n· 밸류 $165B~$175B 신규 라운드 협의 — 7월 완료 전망\n· 직전 2026.02 Series L $5B에서 밸류 $134B 확정\n· CEO Ghodsi: '2027년 IPO 목표' · 최고가치 미상장 소프트웨어 기업", tag: "Funding", url: "https://www.cnbc.com/" },
    { date: "2026-05-06", co: "Scale AI", cat: "startup", source: "Bloomberg / Washington Technology", title: "Scale AI, 국방부 계약 $500M — 8개월 만에 5배 확대", summary: "· 미 국방부 $500M OTA 계약(8개월 만에 $100M→$500M)\n· 컴퓨터 비전 ML 운영·GenAI 의사결정 지원·군사 계획 도구\n· CDAO 주관, DoD 전 부서 사용 가능\n· '데이터 라벨링·의사결정 지원 레이어'로 하이퍼스케일러와 차별화", tag: "Defense", url: "https://www.bloomberg.com/news/articles/2026-05-06/meta-backed-scale-ai-wins-500-million-defense-department-deal" },
    { date: "2026-05-03", co: "Runway", cat: "startup", source: "Gadgets360 / Heise", title: "Runway Gen-4 출시 — 네이티브 오디오 생성, Adobe Firefly 독점 파트너십", summary: "· Gen-4 출시 — 텍스트·이미지→영상 차세대 모델\n· 네이티브 오디오 트랙 자동 생성·리얼리스틱 물리 엔진\n· TikTok/Reels용 수직형 출력 템플릿·하이브리드 파이프라인 API\n· Adobe Firefly에 Gen-4.5 최우선 배포 멀티이어 파트너십", tag: "Product", url: "https://www.vo3ai.com/blog/runway-gen-4-just-dropped-5-surprising-upgrades-ai-video-makers-need-to-know-2026-05-03" },
    { date: "2026-02-04", co: "ElevenLabs", cat: "startup", source: "CNBC / Reuters", title: "ElevenLabs, 밸류 $11B — AI 음성 생성 시장 1위 굳히기", summary: "· Series D $500M 완료, 밸류 $11B(전년比 3배+)\n· ARR $330M+ · Sequoia 주도, NVIDIA 백업\n· 텍스트→음성 API로 콘텐츠 제작 표준 도구\n· IPO 옵션 검토 중", tag: "Funding", url: "https://www.cnbc.com/2026/02/04/nvidia-backed-ai-startup-elevenlabs-11-billion-valuation.html" },
    { date: "2026-03-25", co: "Harvey", cat: "startup", source: "CNBC / Bloomberg", title: "Harvey AI, $200M 라운드 — 법률 버티컬 AI $11B 밸류 달성", summary: "· Harvey $200M Series C, 밸류 $11B(Sequoia·GIC)\n· ARR $190M(5개월 만에 $100M→$190M, +90%)\n· 변호사 10만 명+, AmLaw 100 과반수 고객\n· 버티컬 AI 에이전트 섹터 지표 기업으로 부상", tag: "Funding", url: "https://agentmarketcap.ai/blog/2026/04/06/harvey-200m-11b-valuation-legal-ai-vertical-agent-template" },
    { date: "2026-03-12", co: "Glean", cat: "startup", source: "Forbes / IBL News", title: "Glean, 엔터프라이즈 AI 검색 ARR $200M+ — 'The Agentic List 2026' 선정", summary: "· 밸류 $7.2B · ARR $200M+\n· 사내 SaaS·문서 권한 기반 통합 검색 + 업무 에이전트\n· 대형 기업 IT·운영의 AI 표준 도구로 부상\n· 검색에서 업무 자동화 에이전트로 확장", tag: "Funding", url: "https://www.glean.com" },
    { date: "2026-02-18", co: "Sierra AI", cat: "startup", source: "ValueAdd VC / The Information", title: "Sierra AI, 밸류 $10B — 고객 서비스 에이전트 ARR 배수 67x 최고치", summary: "· 밸류 $10B · ARR $150M\n· Revenue Multiple 67x — AI 에이전트 섹터 최고 수준\n· 기업 브랜드 맞춤형 고객 응대 에이전트로 CS 비용 재편\n· Bret Taylor 공동창업, Sequoia 투자", tag: "Funding", url: "https://sierra.ai" },
  ];

  /* ---- Reports (industry reports) ---- */
  const REPORTS = [
    { house: "Grand View Research", type: "Market", date: "2026-03-15", title: "글로벌 AI 시장 2024 $279B → 2030E $1,812B, CAGR 35.9%", figure: "$279B → $1,812B", rating: "Report", url: "https://www.grandviewresearch.com/industry-analysis/artificial-intelligence-ai-market",
      bullets: ["2024년 $279.22B(실측) → 2030E $1,811.75B · CAGR 35.9%", "GenAI 세그먼트 최고 성장률 · BFSI·헬스케어 채택 선도", "북미 최대 시장 · 아태 최고 성장률"] },
    { house: "KPMG Venture Pulse", type: "Market", date: "2026-04-15", title: "Q1 2026 글로벌 VC $330.9B 신기록 — AI가 미국 VC의 73% 차지", figure: "Q1 $330.9B", rating: "Report", url: "https://kpmg.com/xx/en/media/press-releases/2026/04/global-vc-investment-surges-to-record-330-9-billion-dollar-in-q1-26.html",
      bullets: ["Q1 2026 글로벌 VC $330.9B — 분기 신기록", "미국 $267.2B · OpenAI·Anthropic·xAI 메가딜 주도", "AI가 글로벌 VC의 61%, 미국 VC의 73% 차지", "신규 유니콘 중 26%가 AI 기업"] },
    { house: "Gartner", type: "Market", date: "2026-03-10", title: "AI 에이전트 소프트웨어 시장 2027E $47B — 기업 앱 80%에 에이전트 내장", figure: "$47B 에이전트 시장", rating: "Report", url: "https://www.gartner.com/en/newsroom",
      bullets: ["Q1 2026 기업 앱 80%에 AI 에이전트 내장(2024년 33%)", "실 프로덕션 배포는 31%로 격차 존재", "2027년까지 40%+ 에이전트 프로젝트 취소 경고(ROI 불명확)", "에이전트 거버넌스 임명 기업 56%"] },
    { house: "Goldman Sachs", type: "Securities", date: "2026-02-10", title: "AI 인프라 투자: 2025~2028 글로벌 $1T+ 전망, 전력이 핵심 병목", figure: "$1T+ 인프라 투자", rating: "Overweight", url: "https://www.goldmansachs.com/insights/articles/ai-investment-forecast-2025",
      bullets: ["글로벌 AI 인프라 투자 2025~2028 누적 $1T+", "데이터센터 건설 CAPEX 연 $200B+", "전력 확충이 반도체보다 핵심 병목으로 부상"] },
    { house: "Goldman Sachs Research", type: "Securities", date: "2026-01-15", title: "AI 자동화 2026 — 전 세계 3억 명 일자리 노출, '고용 없는 성장' 경고", figure: "3억 명 노출", rating: "Report", url: "https://www.goldmansachs.com/insights/",
      bullets: ["전 세계 3억 명 풀타임 등가 일자리 AI 노출", "선진국 60% 직종이 자동화에 일부 노출", "2026년 2,500만 → 2030년 2.7억 대체 추정", "AI 신규 직종으로 순 고용 효과는 중립~플러스"] },
    { house: "CB Insights", type: "Market", date: "2026-04-15", title: "State of AI Q1 2026 — 펀딩 메가라운드 집중·유니콘 신규 탄생", figure: "Q1 메가라운드 65%", rating: "Report", url: "https://www.cbinsights.com/research/report/ai-trends-q1-2026/",
      bullets: ["Q1 2026 AI 펀딩 메가라운드 비중 65%", "AI 스타트업 유니콘 다수 신규 탄생", "엔터프라이즈 AI 도입률 상승세 지속"] },
  ];

  /* ---- Market Growth (global AI market size $B) — Grand View Research ----
     2024 $279.22B (actual) → 2030 $1,811.75B, CAGR ~35.9%. YoY ~36%. ---- */
  const MARKET_GROWTH = [
    { year: "2023", size: 196, growth: 40, src: "Grand View Research '24 (2023 $196B)" },
    { year: "2024", size: 279, growth: 42, src: "Grand View Research '25 (2024 $279.22B 실측)" },
    { year: "2025E", size: 379, growth: 36, src: "Grand View Research '26 전망 (CAGR 35.9%)" },
    { year: "2026E", size: 515, growth: 36, src: "Grand View Research '26 전망" },
    { year: "2027E", size: 700, growth: 36, src: "Grand View Research '26 전망" },
    { year: "2028E", size: 951, growth: 36, src: "Grand View Research '26 전망" },
    { year: "2029E", size: 1292, growth: 36, src: "Grand View Research '26 전망" },
    { year: "2030E", size: 1812, growth: 40, src: "Grand View Research '26 전망 ($1,811.75B)" },
  ];

  /* ---- AI Market by Vertical / Industry (share %, 2025) ---- */
  const MARKET_VERTICAL = [
    { cat: "bigtech", label: "BFSI(금융)", value: 18, src: "Grand View Research / Statista '26 — 산업별 AI 채택" },
    { cat: "native", label: "헬스케어·제약", value: 16, src: "Precedence Research '26 — 헬스케어 AI" },
    { cat: "startup", label: "리테일·이커머스", value: 14, src: "IDC '26 — 리테일 AI" },
    { cat: "bigtech", label: "IT·통신", value: 13, src: "IDC '26 — IT/Telecom AI" },
    { cat: "native", label: "제조·산업", value: 12, src: "McKinsey '26 — 제조 AI" },
    { cat: "startup", label: "자동차·모빌리티", value: 10, src: "Statista '26 — 오토모티브 AI" },
    { cat: "bigtech", label: "미디어·광고", value: 8, src: "Grand View Research '26" },
    { cat: "startup", label: "기타(법률·보안 등)", value: 9, src: "CB Insights '26" },
  ];

  /* ---- Funding / Valuation ($B) ---- */
  const FUNDING = [
    { name: "OpenAI", value: 852, cat: "native", src: "CNBC '26.3 라운드 밸류 $852B" },
    { name: "Anthropic", value: 380, cat: "native", src: "CNBC '26.4 Amazon 투자 시 $380B" },
    { name: "xAI", value: 230, cat: "native", src: "Series E '26.1, 밸류 $230B+, 누적 조달 $42B+" },
    { name: "Databricks", value: 134, cat: "startup", src: "Series L '26.2 $134B ($175B 협의)" },
    { name: "SpaceX (xAI, Cursor)", value: 60, cat: "native", src: "CNBC '26.6 Cursor 인수가 $60B (SpaceX·xAI)" },
    { name: "DeepSeek", value: 55, cat: "native", src: "Reuters '26.5 $52B~59B" },
    { name: "Mistral AI", value: 23, cat: "startup", src: "Bloomberg '26.6 €20B($23B) 협의" },
    { name: "Perplexity", value: 18, cat: "startup", src: "'26 추정 $18B" },
    { name: "Scale AI", value: 14, cat: "startup", src: "Forbes '24.05 $14B" },
    { name: "ElevenLabs", value: 11, cat: "startup", src: "CNBC '26.2 Series D $11B" },
    { name: "Harvey", value: 11, cat: "startup", src: "'26.3 Series C $11B" },
    { name: "Sierra AI", value: 10, cat: "startup", src: "ValueAdd VC '26 $10B" },
    { name: "Glean", value: 7.2, cat: "startup", src: "'26 $7.2B" },
  ];

  /* ---- Market Share by Segment (%) ---- */
  const SHARE = [
    { cat: "native", label: "LLM/GenAI", value: 32, src: "Grand View Research '26.03 (버티컬 성장으로 소폭 감소)" },
    { cat: "bigtech", label: "Cloud AI 서비스", value: 27, src: "Gartner '26.01" },
    { cat: "bigtech", label: "AI 칩/하드웨어", value: 22, src: "IDC '26.02 (B200 출하 본격화)" },
    { cat: "startup", label: "엔터프라이즈 AI", value: 13, src: "CB Insights '26.04 (에이전트 급성장)" },
    { cat: "startup", label: "버티컬/Physical AI", value: 6, src: "McKinsey '26.01 (Waymo·Harvey·ElevenLabs 등)" },
  ];

  /* ---- Top AI Apps by MAU (M) ---- */
  const USERS = [
    { name: "Meta AI(앱 노출)", value: 3000, cat: "bigtech", src: "Meta IR '26.4 (전체 앱 사용자, AI 활성과 구분)" },
    { name: "ChatGPT", value: 800, cat: "native", src: "OpenAI 공식 '26.5 주간 활성 사용자" },
    { name: "Grok", value: 600, cat: "native", src: "xAI '26.1 (X 포함 MAU)" },
    { name: "Google Gemini", value: 650, cat: "native", src: "Google I/O '26.5 추정" },
    { name: "GitHub Copilot", value: 200, cat: "bigtech", src: "Microsoft '26.4 (Copilot 좌석 2,000만 별도)" },
    { name: "DeepSeek", value: 150, cat: "native", src: "추정 '26.4" },
    { name: "Perplexity", value: 100, cat: "startup", src: "Perplexity 공식 '26.3" },
    { name: "Claude", value: 90, cat: "native", src: "Anthropic 추정 '26.5" },
  ];

  /* ---- AI Service Pricing Tiers ($/월) ---- */
  const BAND_PRICE = [
    { name: "Free (무료 티어)", value: 0, cat: "native", src: "ChatGPT Free / Claude Free / Gemini Free" },
    { name: "Pro (개인 구독)", value: 20, cat: "native", src: "ChatGPT Plus $20/월, Claude Pro $20/월" },
    { name: "Enterprise (기업)", value: 60, cat: "bigtech", src: "ChatGPT Enterprise ~$60/사용자/월" },
    { name: "API (1M 토큰 기준)", value: 15, cat: "native", src: "GPT-4o $2.5~$15/1M토큰, Claude $3~$15" },
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
    { name: "Q1 2026", value: 18.9, cat: "native", src: "CB Insights '26 (KPMG 기준 총 VC는 $330.9B)" },
  ];

  /* ---- Major AI Deals/Acquisitions (share %) ---- */
  const AI_DEALS = [
    { cat: "native", label: "LLM/GenAI 투자", value: 45, src: "CB Insights Q1'26 — GenAI 투자 비중 45%" },
    { cat: "bigtech", label: "AI 인프라/칩", value: 25, src: "CB Insights Q1'26 — 컴퓨트 인프라 25%" },
    { cat: "startup", label: "엔터프라이즈 AI", value: 18, src: "CB Insights Q1'26 — 기업용 AI 18%" },
    { cat: "startup", label: "기타 AI 버티컬", value: 12, src: "CB Insights Q1'26 — 기타 12%" },
  ];

  /* ---- Top AI Companies by Revenue/ARR ($B) ---- */
  const REVENUE = [
    { name: "NVIDIA (FY26)", value: 130.5, cat: "bigtech", src: "NVIDIA IR FY2026 확정" },
    { name: "Microsoft AI (런레이트)", value: 37.0, cat: "bigtech", src: "Microsoft IR FY26 Q3 — $37B(+123%)" },
    { name: "OpenAI (ARR)", value: 35.0, cat: "native", src: "Gerstner 인용 '26.5 ~$35B" },
    { name: "AWS AI (추정)", value: 14.0, cat: "bigtech", src: "AWS Bedrock + AI 서비스 ARR 추정" },
    { name: "Anthropic (ARR)", value: 9.0, cat: "native", src: "2026초 $4B→급성장, 보수적 추정" },
    { name: "Databricks (ARR)", value: 2.4, cat: "startup", src: "Databricks IR '25 ARR $2.4B" },
    { name: "Cursor(SpaceX) ARR", value: 2.0, cat: "native", src: "Longbridge '26.6 ARR $2B+" },
    { name: "Scale AI (ARR)", value: 1.4, cat: "startup", src: "Forbes '25 ARR $1.4B 추정" },
  ];

  /* ---- AI Business Models ---- */
  const BIZ_MODELS = [
    { name: "API 사용량 과금", cat: "native", model: "API Usage-based", pricing: "토큰당 과금($0.25~$75/1M)", sub: "무료 티어 + 사용량 과금", revenue: "OpenAI ~$35B ARR, Anthropic $9B+ ARR", margin: "비공개", arpu: "기업당 $10K~$10M+/yr", retention: "높음(기술 의존성)", moat: "모델 성능 + 개발자 생태계 + 안전성 프레임워크", strategy: "모델 성능 경쟁 + 엔터프라이즈 침투 + 구독 병행", src: "OpenAI/Anthropic 공식 가격표" },
    { name: "SaaS 구독", cat: "bigtech", model: "SaaS Subscription", pricing: "$20~$60/사용자/월", sub: "Copilot Pro/Business/Enterprise", revenue: "Microsoft AI $37B 런레이트, Copilot 2,000만 좌석", margin: "높음(80%+ 추정)", arpu: "$240~$720/yr", retention: "매우 높음(Office 번들)", moat: "Office/Windows/Teams 락인 + OpenAI 파트너", strategy: "Copilot 전 영역 통합 + 워크플로우 AI 표준화", src: "Microsoft IR FY26 Q3" },
    { name: "오픈소스+엔터프라이즈", cat: "bigtech", model: "Open Source + Enterprise", pricing: "오픈 가중치 무료 + 광고/엔터프라이즈", sub: "Llama 무료 + Meta AI 광고", revenue: "Meta AI 광고 기여 $20B+ 추정", margin: "광고 기반 고마진", arpu: "광고주 기반", retention: "개발자 생태계 락인", moat: "30억 앱 사용자 + 가장 넓은 오픈소스 분포", strategy: "오픈 Llama로 생태계 확장 + AI 광고 최적화", src: "Meta IR '26, Llama 배포 통계" },
    { name: "하드웨어+클라우드", cat: "bigtech", model: "Hardware + Cloud", pricing: "B200 $30K~$50K · DGX Cloud 시간당 과금", sub: "GPU 판매 + DGX Cloud + CUDA 무료", revenue: "NVIDIA $130.5B(FY26), 분기 $57B", margin: "~78% 데이터센터 마진", arpu: "기업당 수백만~수십억 달러", retention: "CUDA 400M 개발자 락인", moat: "GPU 80%+ 점유 + CUDA 생태계 + 풀스택", strategy: "B200 램프 + DGX Cloud + Omniverse", src: "NVIDIA IR FY2026" },
    { name: "버티컬 AI 에이전트", cat: "startup", model: "Vertical AI Agent", pricing: "시트/사용량 구독 + 성과 기반", sub: "산업별 전문 에이전트 구독", revenue: "Harvey $190M, Sierra $150M, Glean $200M+ ARR", margin: "SaaS형 고마진 지향", arpu: "기업당 수만~수백만 달러", retention: "워크플로우 내재화로 높음", moat: "도메인 데이터 + 업무 통합 + 규제 신뢰", strategy: "특정 산업 전문화로 수평 LLM과 차별화(ARR 배수 최대 67x)", src: "AgentMarketCap '26, 각사 공식" },
  ];

  /* ---- KPI Cards (6) ---- */
  const KPIS = [
    { label: "글로벌 AI 시장 (2024)", value: "$279B", delta: +42, sub: "Grand View Research · 2030E $1,812B · CAGR 35.9%", fill: 0.72, src: "Grand View Research AI Market Report '26" },
    { label: "OpenAI 밸류 (2026.03)", value: "$852B", delta: +184, sub: "사모 사상 최고 · ARR ~$35B · S-1 비밀 제출", fill: 0.95, src: "CNBC '26.3 / Bloomberg S-1" },
    { label: "NVIDIA 분기 매출 (FY26 Q3)", value: "$57B", delta: +66, sub: "데이터센터 $51.2B(+66%) · FY26 연 $130.5B · 시총 $3.5T+", fill: 0.90, src: "NVIDIA IR FY26 Q3" },
    { label: "Microsoft AI 런레이트", value: "$37B", delta: +123, sub: "Copilot 2,000만 좌석 · Azure 35% 재가속", fill: 0.78, src: "Microsoft IR FY26 Q3" },
    { label: "Q1 2026 글로벌 VC", value: "$330.9B", delta: +28, sub: "KPMG · 미국 $267.2B · AI가 미국 VC의 73%", fill: 0.88, src: "KPMG Venture Pulse Q1'26" },
    { label: "ChatGPT 주간 활성 사용자", value: "800M+", delta: +60, sub: "OpenAI · ARR ~$35B · IPO 준비", fill: 0.80, src: "OpenAI 공식 '26.5" },
  ];

  /* ---- Insight Cards (9) ---- */
  const INSIGHTS = [
    { title: "GenAI 연간 매출 $100B+ 시대", desc: "OpenAI ~$35B + Microsoft AI $37B + Anthropic $9B+ + Google/AWS — GenAI 플레이어들의 연간 매출 런레이트 합계가 $100B을 넘어서며 독립 산업으로 자리매김", icon: "ai", src: "Microsoft IR '26.Q3, Reuters '26.5" },
    { title: "AI 칩 전쟁 — NVIDIA vs 커스텀 실리콘", desc: "NVIDIA B200이 AI 학습 시장 80%+를 점유하나, Google TPU·Amazon Trainium·Microsoft Maia 등 커스텀 칩이 추격. DeepSeek의 1/10 비용 모델로 효율이 핵심 변수로 부상", icon: "chip", src: "Goldman Sachs '26.02, NVIDIA IR FY26" },
    { title: "AI 에이전트 — 파일럿에서 프로덕션으로", desc: "Gartner: Q1 2026 기업 앱 80%에 AI 에이전트 내장(2024년 33%)하나 실 프로덕션은 31%. McKinsey: 기업 88%가 1개+ 기능에 AI 사용. 에이전트 시장 2027E $47B", icon: "spark", src: "Gartner Q1'26, McKinsey '26, Deloitte '26" },
    { title: "버티컬 AI — 모든 산업에 $1B+ 유니콘", desc: "법률(Harvey $11B), 음성(ElevenLabs $11B), 기업검색(Glean $7.2B), 고객서비스(Sierra $10B) — 수평 LLM 경쟁에서 산업 전문화 AI로 투자 이동. ARR 배수 최대 67x", icon: "chart", src: "AgentMarketCap '26.04, 각사 공식" },
    { title: "오픈소스 vs 클로즈드 — 전략 분기", desc: "Meta Llama·Mistral·DeepSeek 등 오픈 가중치 모델이 도입을 가속하며 클로즈드 모델과 성능 격차 축소. EU AI Act 규제 환경에서 오픈소스 선호도 상승", icon: "chart", src: "Mistral·Meta·DeepSeek 공식, EU AI Act" },
    { title: "Physical AI — AI가 현실 세계로", desc: "Tesla Optimus Gen 3 제한 생산(2026 여름), Figure AI 공장 배포(정밀도 99.8%), Waymo 밸류 $126B. 골드만삭스: 2026년 인간형 로봇 5~10만 대 출하. 물리적 AI 시장 2035E $1.15T(CAGR 33.5%)", icon: "chip", src: "Goldman Sachs '26, Pomegra '26" },
    { title: "AI 전력 수요 쇼크 — 데이터센터가 전력망을 흔들다", desc: "IEA: 데이터센터 전력 소비 2024년 460 TWh → 2026년 650~1,050 TWh(2배+). 미국 비중 2023년 4.4% → 2028년 6.7~12%(EIA). 전력 확충이 반도체보다 핵심 병목으로 부상", icon: "spark", src: "IEA '26, EIA '26, Goldman Sachs" },
    { title: "GenAI ROI — $1 투자 → $3.70 회수", desc: "성숙 AI 기업 평균 ROI $4.60/$1(Accenture), 파일럿 단계 $1.20/$1. 개발자 생산성 +26~40%. 회수기간: 고객서비스 4.1개월·마케팅 6.7개월·엔지니어링 9.3개월. 단 전사 ROI 체감은 29%에 그침", icon: "chart", src: "Accenture '26, McKinsey '26, Futurum '26" },
    { title: "AI 고용 충격 — 3억 명 노출, '고용 없는 성장'", desc: "Goldman Sachs: 전 세계 3억 명 일자리가 AI에 노출, 2026년 2,500만 대체 → 2030년 2.7억. 행정(26%)·고객서비스(20%)가 취약. 다만 신직종 창출로 순 고용 효과는 중립~플러스 전망", icon: "pulse", src: "Goldman Sachs Research '26.01" },
    { title: "NVIDIA, AI PC용 Arm CPU 진입 — 노트북 시장 공략", desc: "NVIDIA가 MediaTek와 공동 개발한 Arm 기반 PC SoC 'N1·N1X'(Blackwell GPU 통합)로 AI PC 노트북·데스크톱에 진입(2026 예상). Apple M·Qualcomm Snapdragon X와 경쟁. AI PC는 2026년 신규 PC 출하의 40%+(Canalys), 2027년 과반 전망. CES 2025 GB10 데스크톱(Project DIGITS)도 공개", icon: "chip", src: "Canalys '26, NVIDIA CES 2025, 업계 보도" },
  ];

  /* ---- Q&A Pairs (Korean) ---- */
  const QA_PAIRS = [
    { q: "OpenAI의 현재 밸류와 IPO 전망은?", a: "OpenAI는 2026.03 라운드로 밸류 $852B(사모 사상 최고)를 기록했고, 2026.06.08 SEC에 S-1을 비밀 제출(이르면 2026.09 상장 목표)했습니다. 주간 활성 사용자 800M+, ARR 궤적은 $6B(2024말)→$20B(2025말)→$25B(2026.02)→~$35B(2026.05)입니다. 다만 함정도 있습니다: 2026 Q1에만 $3.7B를 소각해 연 $15B+ 운영 적자 수준입니다. $852B 밸류는 현재 수익성이 아니라 'AI가 OS가 되는 미래'에 베팅한 가격입니다. 모델은 GPT-5(2025.08)→GPT-5.4→GPT-5.5(2026.04)로 빠르게 갱신됩니다.", nav: "native", keywords: ["openai", "ipo", "밸류", "852", "s-1", "상장", "적자", "gpt-5"] },
    { q: "OpenAI의 실제 매출은? $12.7B가 맞나요?", a: "$12.7B은 오래된 수치입니다. ARR 궤적은 $6B(2024말) → $20B(2025말, CFO 확인) → $25B(2026.02, The Information/Reuters) → ~$35B(2026.05) 입니다. 매월 수십억 달러씩 ARR이 추가되는 속도이며, 이는 S-1 제출 시 밸류 $852B의 근거가 됩니다.", nav: "native", keywords: ["openai", "arr", "매출", "수익", "재무", "35"] },
    { q: "Anthropic과 OpenAI의 차이는?", a: "Anthropic은 Constitutional AI 기반 안전성 우선 설계가 핵심입니다. 2026.04 Amazon 추가 $25B 투자(누적 $33B)로 밸류 $380B를 공식 확인했고, 코딩 에이전트 성능이 최상위권입니다. OpenAI가 소비자 시장(ChatGPT 800M+)을 선도하는 반면, Anthropic은 규제 산업 엔터프라이즈에서 신뢰를 쌓고 있습니다.", nav: "native", keywords: ["anthropic", "claude", "openai", "차이", "380", "amazon"] },
    { q: "Amazon은 왜 OpenAI·Anthropic 양쪽에 투자하나요?", a: "AWS의 '양쪽 베팅(two-horse)' 전략입니다. 2026.02 OpenAI에 $50B 투자+$100B AWS 약정, 2개월 뒤 2026.04.20 Anthropic에 추가 $25B(누적 $33B)+$100B AWS 약정을 체결했습니다. 어느 AI가 이기든 인프라 공급자로서 수익을 확보하고, Azure-OpenAI 독점 구도를 견제하려는 포석입니다.", nav: "bigtech", keywords: ["amazon", "aws", "anthropic", "openai", "투자", "전략", "베팅"] },
    { q: "Cursor가 SpaceX에 인수된다는데 코딩 AI 시장은?", a: "SpaceX(xAI 생태계)가 2026.06.16 Cursor(Anysphere)를 $60B 주식 인수에 합의했습니다(2026 Q3 완료 예정). Cursor ARR은 $2B+, 기업 고객 60%이며 Stripe·Adobe·NVIDIA가 고객입니다. 밸류는 $29.3B→$50B→$60B로 뛰었습니다. 본 대시보드는 'SpaceX (xAI, Cursor)'로 통일 표기합니다. 이는 GitHub Copilot·OpenAI Codex·Claude Code와의 경쟁 격화 신호입니다.", nav: "native", keywords: ["cursor", "spacex", "xai", "인수", "코딩", "에이전트", "60"] },
    { q: "Microsoft의 AI 매출은 얼마나 되나요?", a: "Satya Nadella가 Q3 FY2026 실적에서 AI 부문 연 매출 런레이트 $37B(+123% YoY)를 공식 확인했습니다. M365 Copilot 유료 좌석은 2,000만(+250%)을 돌파했고 Azure는 35% 재가속했습니다. Accenture가 74만 좌석으로 최대 고객입니다.", nav: "bigtech", keywords: ["microsoft", "copilot", "azure", "매출", "37", "런레이트"] },
    { q: "NVIDIA가 압도적인 이유는?", a: "AI GPU 시장 80%+ 점유에 CUDA 소프트웨어 락인(400M+ 개발자, 10년 축적)이 더해진 이중 해자입니다. Q3 FY2026 분기 매출 $57B·데이터센터 $51.2B(+66%), FY26 연 $130.5B를 기록했습니다. B200은 H100 대비 추론 30배, 연 150~200만 대 출하 전망입니다. 다만 위협도 큽니다: 하이퍼스케일러 4곳(Google TPU v7·Amazon Trainium 3·MS Maia 2·Meta MTIA 2)의 자체 칩 합산 배포가 190만 가속기에 달해 '분리'가 시작됐습니다. 그래도 CUDA 대체에는 5~7년이 걸린다는 평가이며 FY27 데이터센터 전망은 오히려 $105~120B로 상향됐습니다.", nav: "bigtech", keywords: ["nvidia", "엔비디아", "gpu", "b200", "cuda", "57", "tpu", "trainium"] },
    { q: "DeepSeek가 왜 중요한가요?", a: "중국 DeepSeek의 R1·V3 모델은 GPT-4급 성능을 약 1/10 비용으로 구현해 'AI 비용 혁명(Sputnik Moment)'을 촉발했습니다. 2026년 첫 외부 라운드에서 목표 밸류 $52B~$59B(중국 국유 빅펀드 주도)입니다. 효율 패러다임 전환의 상징이지만, 국유 자본·수출규제 등 지정학 리스크가 있습니다.", nav: "native", keywords: ["deepseek", "딥시크", "중국", "비용", "효율", "r1"] },
    { q: "AI 에이전트란 무엇이며 도입 현황은?", a: "AI 에이전트는 단순 챗봇을 넘어 스스로 계획을 세우고 작업을 실행하는 자율 시스템입니다. Gartner에 따르면 2026 Q1 기업 앱의 80%에 에이전트가 내장됐지만 실 프로덕션 배포는 31%에 그칩니다. Harvey(법률)·Sierra(고객서비스)·Glean(기업검색) 등 버티컬 에이전트가 고성장 중이며, 시장은 2027E $47B로 전망됩니다.", nav: "dynamics", keywords: ["에이전트", "agentic", "자율", "엔터프라이즈", "도입", "47"] },
    { q: "가장 빠르게 성장하는 AI 스타트업은?", a: "ElevenLabs($11B·음성), Harvey($11B·법률), Sierra($10B·고객서비스), Glean($7.2B·기업검색), Databricks($134B·데이터+AI), Mistral($23B·유럽) 등입니다. 수평 LLM에서 산업 전문 '버티컬 AI'로 투자가 이동 중이며, ARR 배수가 최대 67x(Sierra)에 이릅니다. (Cursor는 SpaceX에 $60B로 인수돼 'SpaceX (xAI, Cursor)'로 편입됐습니다.)", nav: "startup", keywords: ["스타트업", "성장", "빠른", "버티컬", "elevenlabs", "harvey"] },
    { q: "상장 AI 기업 주가는 어디서 보나요?", a: "본 대시보드 하단 '주가 차트' 섹션에서 NVIDIA·Microsoft·Amazon·Apple·Alphabet(Google)·Meta의 일별 주가와 시가총액을 1년/5년으로 볼 수 있습니다. 주가는 매일 자동 크롤링된 실제 종가(Stooq)이며, 차트에 마우스를 올리면 해당일 종가가, 주요 변곡점에는 상승/하락 사유가 표시됩니다. SpaceX(xAI, Cursor)는 비상장이라 사모 밸류에이션 추정치만 표시됩니다.", nav: "stocks", keywords: ["주가", "주식", "차트", "상장", "stock", "시총", "변곡점"] },
    { q: "Physical AI(물리적 AI)란?", a: "소프트웨어를 넘어 로봇·자율주행 등 현실 세계로 들어간 AI입니다. Waymo 로보택시(밸류 $126B), Tesla Optimus, Figure AI 공장 배포 등이 대표 사례입니다. 골드만삭스는 2026년 인간형 로봇 5~10만 대 출하를 전망하며, 물리적 AI 시장은 2035E $1.15T(CAGR 33.5%)로 추정됩니다.", nav: "insights", keywords: ["physical", "물리적", "로봇", "자율주행", "waymo", "optimus"] },
    { q: "AI가 정말 일자리를 빼앗나요?", a: "Goldman Sachs(2026.01)는 전 세계 3억 명의 일자리가 AI에 노출되며, 2026년 2,500만 대체 → 2030년 2.7억으로 확대될 것으로 추정합니다. 행정(26%)·고객서비스(20%)가 취약합니다. 다만 AI 신규 직종 창출로 순 고용 효과는 중립~플러스 전망이며, GenAI 사용자는 비사용자 대비 직업 안정성이 더 높다는 데이터도 있습니다.", nav: "insights", keywords: ["일자리", "고용", "자동화", "실직", "goldman", "직업"] },
    { q: "오픈소스와 클로즈드 모델의 차이는?", a: "오픈 가중치 모델(Llama·Mistral·DeepSeek)은 무료 배포로 커스터마이징·데이터 보안·비용 통제가 가능합니다. 클로즈드 모델(GPT·Claude)은 최고 성능을 API로 제공하며 인프라 부담이 없습니다. 2026년 성능 격차가 빠르게 줄고 있으며, EU AI Act 환경에서는 오픈소스 선호가 높습니다.", nav: "dynamics", keywords: ["오픈소스", "llama", "deepseek", "클로즈드", "차이"] },
    { q: "2026년 AI 시장 규모와 투자 전망은?", a: "Grand View Research 기준 2024년 글로벌 AI 시장은 $279.22B(실측)이며, 2030년 $1,811.75B 전망(CAGR 35.9%)입니다. 산업별로는 BFSI(금융)·헬스케어·리테일·IT통신 순으로 채택이 빠릅니다. KPMG에 따르면 Q1 2026 글로벌 VC는 $330.9B 신기록이며 AI가 미국 VC의 73%를 차지했습니다. AI 인프라에 2025~2028 누적 $1T+ 투자가 예상됩니다.", nav: "overview", keywords: ["시장", "규모", "투자", "전망", "버티컬", "산업", "330", "vc"] },
    { q: "ChatGPT가 Google 검색을 죽이나요? 실제 숫자는?", a: "'Google이 망한다'는 말은 2023년부터 나왔지만 실제는 더 복잡합니다. Google은 여전히 글로벌 검색 74~80%를 점유합니다. ChatGPT Search는 글로벌 쿼리 17~18%로 급성장했고, Gemini는 LLM 트래픽의 20%를 차지합니다. 더 의미있는 지표는 세션 깊이로, Perplexity 사용자의 세션당 쿼리는 Google의 4.5배입니다. 역설은 OpenAI가 2025.09 EU에 'Google·Apple·MS의 데이터 독점이 경쟁을 막는다'고 신고한 점 — AI 검색의 진짜 해자는 아직 모델이 아니라 데이터입니다.", nav: "dynamics", keywords: ["구글", "검색", "chatgpt", "시장점유율", "gemini", "perplexity", "검색전쟁"] },
    { q: "AI 추론 비용은 얼마나 빠르게 떨어지나요?", a: "AI 추론 비용은 2021년 대비 약 280배 하락했습니다. GPT-4급 API가 2023.03 $60/100만 토큰에서 2026년 초 $0.40 이하로 폭락(연 10배), Blackwell은 H100 대비 추론 비용을 10~15배 추가 절감했습니다. 그러나 역설이 있습니다: 단가가 90% 하락하는 동안 기업 총 AI 인프라 지출은 오히려 320% 증가했고(쌀수록 더 많이 씀), 최고 성능 프런티어 모델은 여전히 $15~$75/100만 토큰 프리미엄을 유지합니다. 평범한 인텔리전스는 공짜로 수렴하되 최첨단 추론의 프리미엄은 벌어집니다.", nav: "dynamics", keywords: ["추론", "비용", "inference", "토큰", "가격", "commoditization"] },
    { q: "AI 할루시네이션은 얼마나 심각한가요?", a: "할루시네이션이 2024년 한 해 전 세계 기업에 약 $67.4B 손실을 일으켰다는 추정이 있습니다. 모델별 실측(요약 작업): Gemini 2.0 Flash 0.7%, GPT-4o 1.5%, Claude 4.6 4%, 평균 프로덕션 ~9.2%, 법률 분야는 17~34%까지 치솟습니다(Stanford HAI). 역설은 가장 비싼 추론 모델이 오히려 근거 기반 작업에서 확신에 차 더 높은 할루시네이션을 보일 수 있다는 점입니다. IT 전문가 68%가 프로덕션에서 직접 목격했고, 엔터프라이즈 사용자 47%가 할루시네이션 정보로 실제 의사결정을 내린 적이 있다고 답했습니다.", nav: "dynamics", keywords: ["할루시네이션", "hallucination", "거짓", "신뢰", "오류", "위험"] },
    { q: "AI 투자 붐인데 왜 스타트업이 망하나요?", a: "2024년 창업한 14,000개+ AI 스타트업 중 2025년에만 3,800개가 폐업(1년 실패율 27%), 2026년 초 추가 1,800개가 닫아 누적 생존율 60%입니다. 3가지 사망 패턴: (1) '래퍼 신드롬' — OpenAI API를 얇게 감싸 팔다 본사가 같은 기능을 내면 우위 상실, (2) '파일럿 지옥' — MIT 기준 AI 파일럿의 95%가 측정 가능한 ROI 실패, (3) '비용 역진' — API 단가 급락으로 저가 차별화 소멸. 생존한 40%의 공통점은 독점 데이터(Scale), 규제 전문성(Harvey), 워크플로우 깊은 통합(Cursor)입니다.", nav: "startup", keywords: ["스타트업", "실패", "폐업", "버블", "wrapper", "파일럿", "roi"] },
    { q: "빅테크가 AI를 독점한다는 반독점 조사는?", a: "미 DOJ는 NVIDIA, FTC는 Microsoft·OpenAI를 조사 중입니다. 핵심 이슈는 '순환 지출' — MS가 OpenAI에 투자한 $13B+ 상당이 Azure 크레딧 형태라 사실상 클라우드 락인을 구조화한다는 지적입니다. NVIDIA는 GPU 80%+ 점유보다 CUDA 400M+ 개발자 락인이 진입장벽이라는 점이 문제입니다. 미국이 글로벌 AI 컴퓨트의 75%(중국 15%)를 장악합니다. 아이러니하게도 OpenAI는 자신이 도전받자 2025.09 EU에 Google·Apple·MS를 반독점으로 신고했습니다.", nav: "bigtech", keywords: ["반독점", "독점", "ftc", "doj", "규제", "antitrust", "순환"] },
    { q: "Google·Amazon 자체 칩으로 NVIDIA 시대는 끝나나요?", a: "당분간 안 무너지지만 '분리(Decoupling)'는 시작됐습니다. 2026년 Google TPU v7(Ironwood)·Amazon Trainium 3·Microsoft Maia 2·Meta MTIA 2가 양산에 진입, 4대 하이퍼스케일러 자체 칩 합산 배포가 약 190만 가속기로 추정됩니다. TPU v7 추론 효율/와트는 B200의 약 2배입니다. 그러나 NVIDIA의 진짜 해자는 하드웨어가 아니라 CUDA 생태계(400M+ 개발자, 10년 축적)로, 대체에 5~7년이 걸린다는 평가입니다. 실제 NVIDIA FY27 데이터센터 매출 전망은 오히려 $105~120B로 상향됐습니다.", nav: "bigtech", keywords: ["nvidia", "tpu", "trainium", "칩", "cuda", "반도체", "custom"] },
    { q: "미국의 중국 AI 칩 수출통제는 효과가 있나요?", a: "느리게 작동하고 그 사이 중국이 우회로를 만들었습니다. 미국이 글로벌 AI 컴퓨트의 75%, 중국이 15%를 차지하지만, 2026.05.31 미 상무부는 미국 기업들이 1년 이상 중국 자회사에 고성능 칩을 불법 판매해온 사실을 인정했습니다. DeepSeek의 R1은 칩 부족을 알고리즘 효율로 돌파해 GPT-4급을 1/10 비용에 구현했는데, 이것이 더 위협적입니다 — 칩 규제는 막아도 알고리즘 혁신은 막을 수 없기 때문입니다. 중국은 '평행 구매' 정책으로 Huawei·SMIC 내수 생산을 의무 확대 중입니다.", nav: "dynamics", keywords: ["중국", "수출통제", "deepseek", "huawei", "지정학", "미중", "export"] },
    { q: "앤스로픽의 기업가치(밸류)는 얼마인가요?", a: "Anthropic의 기업가치는 2026년 4월 Amazon의 추가 $25B 투자 시점 기준 $380B로 공식 확인됐습니다. Amazon 누적 투자는 $33B(기존 $8B + 신규 $25B)이며, Anthropic은 AWS에 10년간 $100B+ 클라우드 사용을 약정했습니다. ARR은 2026년 초 $4B에서 급성장 중이고 일부 추정치는 ~$45B(검증 중)까지 제시됩니다. 직전 라운드는 2025.03 Series E $61B였으니 약 1년 만에 6배 이상 뛴 셈입니다.", nav: "native", keywords: ["앤스로픽", "anthropic", "밸류", "기업가치", "380", "amazon"] },
    { q: "엔비디아 CPU를 탑재한 AI 노트북 시장은 어떤가요?", a: "NVIDIA는 그동안 GPU 중심이었지만, MediaTek와 공동 개발한 Arm 기반 PC용 SoC 'N1·N1X'(Blackwell GPU 통합)로 AI PC 노트북·데스크톱 시장에 진입합니다(2026 출시 예상). Apple M 시리즈·Qualcomm Snapdragon X·Intel/AMD와 경쟁합니다. AI PC(온디바이스 NPU 탑재)는 Canalys 기준 2026년 신규 PC 출하의 약 40%+, 2027년 과반으로 전망되며 온디바이스 추론 수요가 견인합니다. NVIDIA는 CES 2025에서 GB10 기반 데스크톱(Project DIGITS)도 공개해 로컬 AI 워크스테이션 시장도 노립니다. 변수는 Arm PC의 x86 호환성·소프트웨어 생태계입니다.", nav: "bigtech", keywords: ["엔비디아", "노트북", "ai pc", "cpu", "arm", "n1x", "mediatek", "온디바이스", "snapdragon"] },
    { q: "SpaceX·xAI·Cursor는 무슨 관계인가요?", a: "모두 일론 머스크 생태계로 묶입니다. xAI는 머스크의 AI 기업(Grok)이고, SpaceX는 2026.06 IPO 직후 AI 코딩 에이전트 Cursor(Anysphere)를 $60B에 인수했습니다. 본 대시보드는 이를 'SpaceX (xAI, Cursor)'로 통일해 표기합니다. Cursor는 ARR $2B+, 기업 고객 60%(Stripe·Adobe·NVIDIA)였고, 인수로 xAI의 코딩 에이전트 역량이 강화됩니다. SpaceX는 비상장이라 주가 차트에는 사모 밸류에이션(시총 추정)만 표시됩니다.", nav: "native", keywords: ["spacex", "xai", "cursor", "머스크", "인수", "코딩"] },
  ];

  /* ---- Monthly Trend: Top AI Apps (M downloads) ---- */
  const APP_MONTHLY = [
    { month: "2026-01", apps: [
      { name: "ChatGPT", ios: 45, android: 62, src: "SensorTower '26.1" },
      { name: "Google Gemini", ios: 18, android: 35, src: "SensorTower '26.1" },
      { name: "Grok", ios: 12, android: 16, src: "SensorTower '26.1" },
      { name: "DeepSeek", ios: 14, android: 11, src: "SensorTower '26.1" },
      { name: "Perplexity", ios: 8, android: 5, src: "SensorTower '26.1" },
      { name: "Claude", ios: 5, android: 3, src: "SensorTower '26.1" },
    ]},
    { month: "2026-02", apps: [
      { name: "ChatGPT", ios: 48, android: 65, src: "SensorTower '26.2" },
      { name: "Google Gemini", ios: 20, android: 38, src: "SensorTower '26.2" },
      { name: "Grok", ios: 13, android: 18, src: "SensorTower '26.2" },
      { name: "DeepSeek", ios: 15, android: 12, src: "SensorTower '26.2" },
      { name: "Perplexity", ios: 9, android: 6, src: "SensorTower '26.2" },
      { name: "Claude", ios: 6, android: 3.5, src: "SensorTower '26.2" },
    ]},
    { month: "2026-03", apps: [
      { name: "ChatGPT", ios: 52, android: 70, src: "SensorTower '26.3" },
      { name: "Google Gemini", ios: 22, android: 42, src: "SensorTower '26.3" },
      { name: "Grok", ios: 14, android: 20, src: "SensorTower '26.3" },
      { name: "DeepSeek", ios: 16, android: 13, src: "SensorTower '26.3" },
      { name: "Perplexity", ios: 10, android: 7, src: "SensorTower '26.3" },
      { name: "Claude", ios: 7, android: 4, src: "SensorTower '26.3" },
    ]},
    { month: "2026-04", apps: [
      { name: "ChatGPT", ios: 55, android: 73, src: "SensorTower '26.4" },
      { name: "Google Gemini", ios: 24, android: 45, src: "SensorTower '26.4" },
      { name: "Grok", ios: 15, android: 22, src: "SensorTower '26.4" },
      { name: "DeepSeek", ios: 17, android: 14, src: "SensorTower '26.4" },
      { name: "Perplexity", ios: 11, android: 8, src: "SensorTower '26.4" },
      { name: "Claude", ios: 8, android: 5, src: "SensorTower '26.4" },
    ]},
    { month: "2026-05", apps: [
      { name: "ChatGPT", ios: 58, android: 76, src: "SensorTower '26.5" },
      { name: "Google Gemini", ios: 26, android: 48, src: "SensorTower '26.5" },
      { name: "Grok", ios: 16, android: 24, src: "SensorTower '26.5" },
      { name: "DeepSeek", ios: 18, android: 15, src: "SensorTower '26.5" },
      { name: "Perplexity", ios: 12, android: 9, src: "SensorTower '26.5" },
      { name: "Claude", ios: 9, android: 6, src: "SensorTower '26.5" },
    ]},
  ];

  /* ---- Monthly Revenue Trends ($M) ---- */
  const REVENUE_MONTHLY = [
    { month: "2026-01", data: [
      { name: "NVIDIA", value: 18000, src: "NVIDIA IR FY26 분기 배분" },
      { name: "Microsoft AI", value: 2700, src: "런레이트 $37B 기준 월 배분" },
      { name: "OpenAI", value: 2100, src: "ARR ~$25B 기준 월 배분" },
      { name: "AWS AI", value: 1150, src: "추정" },
      { name: "Anthropic", value: 600, src: "ARR 기준 추정" },
      { name: "Cursor(SpaceX)", value: 130, src: "ARR $2B 기준" },
    ]},
    { month: "2026-02", data: [
      { name: "NVIDIA", value: 18500, src: "NVIDIA IR" },
      { name: "Microsoft AI", value: 2850, src: "런레이트 기준" },
      { name: "OpenAI", value: 2300, src: "ARR 기준" },
      { name: "AWS AI", value: 1180, src: "추정" },
      { name: "Anthropic", value: 650, src: "ARR 기준" },
      { name: "Cursor(SpaceX)", value: 145, src: "ARR 기준" },
    ]},
    { month: "2026-03", data: [
      { name: "NVIDIA", value: 19000, src: "NVIDIA IR" },
      { name: "Microsoft AI", value: 2950, src: "런레이트 기준" },
      { name: "OpenAI", value: 2600, src: "ARR 기준 성장" },
      { name: "AWS AI", value: 1200, src: "추정" },
      { name: "Anthropic", value: 700, src: "ARR 기준" },
      { name: "Cursor(SpaceX)", value: 160, src: "ARR 기준" },
    ]},
    { month: "2026-04", data: [
      { name: "NVIDIA", value: 19500, src: "NVIDIA IR" },
      { name: "Microsoft AI", value: 3080, src: "런레이트 $37B" },
      { name: "OpenAI", value: 2800, src: "ARR 기준" },
      { name: "AWS AI", value: 1230, src: "추정" },
      { name: "Anthropic", value: 750, src: "ARR 기준" },
      { name: "Cursor(SpaceX)", value: 170, src: "ARR 기준" },
    ]},
    { month: "2026-05", data: [
      { name: "NVIDIA", value: 20000, src: "NVIDIA IR" },
      { name: "Microsoft AI", value: 3150, src: "런레이트 기준" },
      { name: "OpenAI", value: 2900, src: "ARR ~$35B 기준" },
      { name: "AWS AI", value: 1260, src: "추정" },
      { name: "Anthropic", value: 800, src: "ARR 기준" },
      { name: "Cursor(SpaceX)", value: 175, src: "ARR 기준" },
    ]},
  ];

  /* ============================================================
     STOCKS — listed AI companies. 실제 일별 주가는 매일 크롤링되어
     stocks.json 으로 제공됩니다(scripts/crawl-stocks.mjs · Stooq).
     여기에는 메타데이터 + 변곡점 설명(에디토리얼)만 둡니다.
     ============================================================ */
  const STOCKS = [
    {
      ticker: "NVDA", name: "NVIDIA", domain: "nvidia.com", cat: "bigtech",
      events: [
        { date: "2023-05-25", dir: "up", label: "FY24 가이던스 서프라이즈", reason: "데이터센터 GPU 수요 폭증으로 분기 가이던스를 50%+ 상회. AI 학습 칩 독점 지위가 부각되며 하루 +24% 급등." },
        { date: "2024-06-07", dir: "up", label: "10:1 주식분할", reason: "액면분할 시행. 소매 접근성 확대 기대와 AI 모멘텀으로 사상 최고가 경신." },
        { date: "2025-01-27", dir: "down", label: "DeepSeek 쇼크", reason: "DeepSeek가 1/10 비용으로 GPT-4급 성능을 구현했다는 소식에 'AI 칩 과잉투자' 우려. 하루 -17%, 시총 약 6천억 달러 증발." },
        { date: "2025-04-04", dir: "down", label: "관세·수출규제 우려", reason: "반도체 관세·대중 수출규제 확대 우려로 조정. 이후 B200 수요 확인되며 회복." },
        { date: "2026-01-30", dir: "down", label: "Blackwell 정점·차익실현", reason: "Q3 FY26 매출 $57B·데이터센터 $51.2B(+66%) 기록에도 '정점론'과 차익실현 매물로 단기 조정." },
      ],
    },
    {
      ticker: "MSFT", name: "Microsoft", domain: "microsoft.com", cat: "bigtech",
      events: [
        { date: "2023-01-23", dir: "up", label: "OpenAI $10B 투자", reason: "OpenAI에 최대 $10B 추가 투자 발표. Azure OpenAI 독점 파트너십으로 AI 클라우드 선두 기대." },
        { date: "2024-01-25", dir: "up", label: "시총 $3T 돌파", reason: "M365 Copilot 기업 도입 가속으로 사상 첫 시총 $3T 돌파." },
        { date: "2025-04-08", dir: "down", label: "관세·매크로 조정", reason: "글로벌 관세 우려와 AI 자본지출 부담론으로 광범위한 기술주 조정." },
        { date: "2026-04-29", dir: "up", label: "AI 런레이트 $37B 확인", reason: "Q3 FY26 실적에서 AI 부문 런레이트 $37B(+123%)·Copilot 2,000만 좌석 공개. Azure 35% 재가속." },
      ],
    },
    {
      ticker: "AMZN", name: "Amazon", domain: "amazon.com", cat: "bigtech",
      events: [
        { date: "2022-06-06", dir: "up", label: "20:1 주식분할", reason: "액면분할 시행으로 소매 접근성 확대." },
        { date: "2023-11-15", dir: "up", label: "Bedrock·Anthropic 베팅", reason: "AWS Bedrock 멀티모델 전략과 Anthropic 투자로 AI 클라우드 경쟁 본격 진입." },
        { date: "2025-04-08", dir: "down", label: "관세 충격", reason: "소비·물류 비용과 관세 우려로 조정." },
        { date: "2026-04-20", dir: "up", label: "Anthropic +$25B 투자", reason: "Anthropic 추가 $25B(누적 $33B)·AWS $100B 약정 발표. 양쪽 베팅 전략 부각." },
      ],
    },
    {
      ticker: "AAPL", name: "Apple", domain: "apple.com", cat: "bigtech",
      events: [
        { date: "2024-06-10", dir: "up", label: "Apple Intelligence 공개", reason: "WWDC에서 온디바이스 AI 'Apple Intelligence' 발표. 기기 교체 수요 기대로 사상 최고가 경신." },
        { date: "2025-04-08", dir: "down", label: "관세·AI 지연 우려", reason: "중국 생산 관세 노출과 Siri AI 고도화 지연 우려로 조정." },
        { date: "2025-06-09", dir: "up", label: "WWDC25 온디바이스 확대", reason: "온디바이스 모델 개방·앱 연동 확대 발표로 반등." },
      ],
    },
    {
      ticker: "GOOGL", name: "Alphabet (Google)", domain: "abc.xyz", cat: "bigtech",
      events: [
        { date: "2023-02-08", dir: "down", label: "Bard 시연 오류", reason: "첫 Bard 데모에서 사실 오류 노출로 하루 -7%. 검색 광고 수성 우려 확산." },
        { date: "2024-05-14", dir: "up", label: "Gemini 전면 통합", reason: "I/O에서 Gemini를 검색·워크스페이스에 통합 발표하며 AI 반격 본격화." },
        { date: "2025-04-08", dir: "down", label: "관세·반독점 조정", reason: "매크로 관세 우려와 검색 반독점 판결 리스크로 조정." },
      ],
    },
    {
      ticker: "META", name: "Meta", domain: "meta.com", cat: "bigtech",
      events: [
        { date: "2022-02-03", dir: "down", label: "실적 쇼크 -26%", reason: "이용자 정체와 메타버스 적자 확대로 하루 -26%. 당시 사상 최대 일일 시총 손실." },
        { date: "2022-11-04", dir: "down", label: "바닥·'효율의 해'", reason: "대규모 감원과 '효율의 해' 선언 직전 저점. 이후 강한 반등의 출발점." },
        { date: "2024-02-02", dir: "up", label: "첫 배당·Llama 모멘텀", reason: "첫 배당 발표와 Llama 오픈소스 모멘텀으로 하루 +20% 급등." },
        { date: "2025-06-17", dir: "up", label: "Llama 4·AI 광고", reason: "Llama 4와 AI 광고 최적화 효과로 사상 최고가권 진입." },
      ],
    },
    {
      ticker: "SPCX", name: "SpaceX (xAI, Cursor)", domain: "spacex.com", cat: "native",
      private: true, mcap: "$350B+ (비상장 추정)",
      events: [
        { date: "2026-06-16", dir: "up", label: "Cursor $60B 인수 발표", reason: "AI 코딩 에이전트 Cursor(Anysphere)를 $60B 주식 인수 합의. xAI 코딩 전략 강화." },
      ],
      note: "SpaceX는 비상장 기업으로 공개 거래 주가가 없습니다(xAI·Cursor 인수 주체). 시총은 사모 밸류에이션 추정치이며, 일별 주가 차트는 제공되지 않습니다.",
    },
  ];

  // 시총 표시용 발행주식수(근사, 십억 주) — 크롤러 마켓캡 미수신 시 lastPrice×shares 로 추정
  const STOCK_SHARES = { NVDA: 24.4, MSFT: 7.43, AMZN: 10.6, AAPL: 14.8, GOOGL: 12.2, META: 2.53 };

  const DAY = 86400000;

  // 실제 크롤링된 일별 종가(points: [{d, p}])를 받아 변곡점(events)을 가까운
  // 거래일에 스냅하고 min/max 를 계산한다. years 로 최근 구간만 자른다.
  function attachStockEvents(rawPoints, events, years) {
    const all = (rawPoints || [])
      .filter(p => p && p.d && typeof p.p === "number")
      .map(p => ({ d: p.d, p: p.p, t: Date.parse(p.d + "T00:00:00Z") }))
      .sort((a, b) => a.t - b.t);
    if (all.length < 2) return { points: [], events: [], min: 0, max: 1 };
    const lastT = all[all.length - 1].t;
    const startT = years ? lastT - years * 365 * DAY : all[0].t;
    const points = all.filter(p => p.t >= startT);
    if (points.length < 2) return { points: all, events: [], min: Math.min(...all.map(p => p.p)), max: Math.max(...all.map(p => p.p)) };
    const evs = [];
    (events || []).forEach(e => {
      const et = Date.parse(e.date + "T00:00:00Z");
      if (et < points[0].t || et > points[points.length - 1].t) return;
      let best = null, bd = Infinity;
      for (const pt of points) { const dd = Math.abs(pt.t - et); if (dd < bd) { bd = dd; best = pt; } }
      if (best) evs.push({ date: e.date, dir: e.dir, label: e.label, reason: e.reason, p: best.p, t: best.t, d: best.d });
    });
    let min = Infinity, max = -Infinity;
    points.forEach(pt => { if (pt.p < min) min = pt.p; if (pt.p > max) max = pt.p; });
    if (!isFinite(min)) { min = 0; max = 1; }
    return { points, events: evs, min, max };
  }

  return { CATEGORIES, COMPANIES, ARTICLES, REPORTS, MARKET_GROWTH, MARKET_VERTICAL, FUNDING, SHARE, USERS, BAND_PRICE, FUNDING_TREND, AI_DEALS, REVENUE, BIZ_MODELS, KPIS, INSIGHTS, QA_PAIRS, APP_MONTHLY, REVENUE_MONTHLY, STOCKS, STOCK_SHARES, attachStockEvents };
})();
