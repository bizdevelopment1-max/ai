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
      valuation: "$852B", valAsof: "26.03", metric: "연환산 매출", value: "$24B+", metricAsof: "26.02",
      funding: "$122B 라운드(2026.03 확정)", trend: 120, trendBasis: "연환산 $25B+ · Q1 실매출 $5.7B",
      note: "GPT-4o·o3·GPT-5, ChatGPT, Sora. 2026.03.31 최종 라운드 확정: 총 조달 $122B(SoftBank·Amazon·Nvidia·a16z 등)·post-money 밸류 $852B(직전 2026.02 $730B pre+$110B 수식의 $840B에서 증액 확정). [보도] S-1 2026.06.08 SEC 기밀 제출(이르면 2026.09 상장, 공모 목표 최대 $1T). 2026 전체 매출 ~$30B 목표 트랙([The Information]; 일부 추정 $46B는 미확인). ChatGPT 주간 활성 사용자 ~905M(2월 920M 정점 후 성장 정체 — IPO 핵심 리스크로 부각). 유료 구독자 공식 '50M+'(2026.02 발표)·복수 보도 기준 ~55M(2026 Q1 말, 연말 47M서 증가, The Information). 월 매출 ~$2B(연환산 $24B+, 2026.02). [The Information] Q1 2026 실매출 $5.7B·GAAP 운영손실 $9.3B·현금소각 $3.7B(매출 $5.7B의 65%)·순손실 $21.3B($12.4B 회계비용 포함)·Non-GAAP 마진 -122% · 현금 보유 $73B+·컴퓨트 조달 약정 $665B — 수익성이 핵심 IPO 리스크. $852B는 2030년 매출 목표 $280B 가정에 기반. [OpenAI/Forbes 2026.04.27] Microsoft와의 '독점성(exclusivity)'만 종료 — 파트너십 자체는 유지(Azure 제1 클라우드 지속·MS IP 라이선스 2032년까지 연장·MS 대상 수익공유 20% 2030년까지 지속). 누적 조달 ~$186B(PitchBook).",
      vp: "최고 성능 멀티모달 모델과 9억 규모의 소비자 접점을 동시에 보유한 유일한 사업자. API·구독·엔터프라이즈로 매출 다각화.",
      direction: "범용 인공지능(AGI) 지향 + 대규모 컴퓨트 자금 조달. 추론 모델(o-시리즈)과 에이전트로 확장. IPO 준비.",
      sources: ["총 조달 $122B·$852B post-money (2026.03.31, Bloomberg/CNBC)", "[보도] S-1 2026.06.08 SEC 기밀 제출 (Reuters)", "[The Information] Q1 실매출 $5.7B · Non-GAAP 마진 -122%", "[OpenAI '26.04.27] MS '독점성'만 종료·파트너십 유지(IP 라이선스 2032·수익공유 20% 2030까지)"],
      url: "https://openai.com",
    },
    {
      cat: "native", name: "Anthropic", domain: "anthropic.com", unit: "파운데이션 모델·안전성",
      valuation: "$965B", valAsof: "26.05", metric: "run-rate 매출", value: "$47B(공식·논쟁)", metricAsof: "26.05",
      funding: "Series H $65B(2026.05)", trend: 188, trendBasis: "run-rate $30B(4월)→$47B(5월), OpenAI 추월",
      note: "Claude Opus/Sonnet/Haiku, Constitutional AI. 2026.05.28 Series H $65B 조달·$965B post-money(직전 2026.02 Series G $380B). Series H 발표문서 'run-rate revenue crossed $47 billion earlier this month' 명시 — 2026.04.07 ARR $30B(당시 OpenAI가 회계 인식 차이로 ~$22B 반박)에서 6주 만에 $47B로 급증, OpenAI ARR($25B)을 2배 가까이 추월. 단, run-rate $47B의 신뢰성은 논쟁 — The Information의 Q1 실매출 추정은 $4.8B(연환산 ~$19B)로 run-rate와 간극이 크며, GAAP 감사 재무 미공개·단기 급등 요인 존재(S-1 공개가 검증 분수령). Claude Code 단독 $2.5B+ ARR 돌파(코딩 에이전트 섹터: Cursor ~$4B·GitHub Copilot·Windsurf와 3강). 2026.06.02 IPO용 S-1 기밀 제출($965B 기준). Amazon은 기존 $8B 외 즉시 $5B 투자, 향후 최대 $20B 추가 가능(2026.04.20)·AWS 10년 $100B+ 약정. Google도 최대 $40B 투자(즉시 $10B+성과 연동 $30B, 2026.04.24)·Google Cloud 5GW 컴퓨트(2027~)·Broadcom TPU 3.5GW — Amazon·Google 양대 후원으로 컴퓨트 병목 해소. 누적 조달 ~$127B(PitchBook). PitchBook 기록상 거래 시점 trailing 매출 $9B — $47B는 회사 발표 연환산 run-rate로 기준 상이.",
      vp: "Constitutional AI 기반 신뢰·안전성으로 금융·의료·법률 등 규제 산업 엔터프라이즈에서 선호. 코딩 에이전트 성능 최상위(Claude Code).",
      direction: "안전성 연구와 상업화의 균형. Amazon·Google 클라우드 파트너십으로 컴퓨트 확보, 엔터프라이즈 침투 가속.",
      sources: ["run-rate 매출 $47B (Anthropic Series H 발표문, 2026.05.28)", "Series H $65B·$965B post-money (2026.05.28)", "Claude Code $2.5B+ ARR", "Amazon 즉시 $5B + 향후 최대 $20B(기존 $8B 별도) (2026.04.20)"],
      url: "https://anthropic.com",
    },
    {
      cat: "bigtech", name: "Google DeepMind", group: "model", domain: "deepmind.google", unit: "파운데이션 모델(Alphabet)",
      valuation: "—", valAsof: "—", metric: "Gemini 앱 MAU", value: "900M+", metricAsof: "26.05",
      funding: "Alphabet 산하", trend: 38, trendBasis: "Gemini 앱 MAU 900M+ 돌파",
      note: "Gemini 3.x, AlphaFold, Gemma — Alphabet의 AI 연구 조직. Google I/O 2026에서 Sundar Pichai가 Gemini 앱 MAU 900M+ 돌파 공식 발표(단 Sensor Tower 집계는 662M으로 방법론 차이). 별도 지표로 'AI Mode in Search' MAU 10억+ 발표 — 검색·앱 이중 모수로 실질 AI 도달은 더 큼. Gemini 3 멀티모달 최고 성능권, 100만 토큰 컨텍스트. AlphaFold로 노벨화학상 수상. 검색·워크스페이스·안드로이드에 Gemini 전면 통합.",
      vp: "검색·유튜브·안드로이드·클라우드 등 수십억 사용자 유통망에 모델을 직접 배포. TPU 자체 칩으로 컴퓨트 수직계열화.",
      direction: "프런티어 모델 연구 + Alphabet 제품 전면 통합. 온디바이스(Gemini Nano)부터 데이터센터까지 풀스택.",
      sources: ["Gemini 앱 MAU 900M+ (Google I/O 2026, Pichai)", "Gemini 3 출시 (Google I/O '26.5)", "AlphaFold 노벨화학상 2024"],
      url: "https://deepmind.google",
    },
    {
      cat: "startup", name: "DeepSeek", vertical: "지역 AI 플랫폼", domain: "deepseek.com", unit: "오픈 파운데이션 모델(중국)",
      valuation: "$50B+", valAsof: "26.06", metric: "밸류에이션", value: "$52B~$59B", metricAsof: "26.06",
      funding: "첫 외부 라운드 완료 $7.4B", trend: 50, trendBasis: "효율 혁신·첫 외부 투자 완료",
      note: "DeepSeek-V3, R1 — 중국 최대 AI 연구소. 2026.06.16 첫 외부 투자 라운드 완료(CNY 50B+ ≈ $7.4B 조달, 밸류 $50B+ 확정 — $52B~$59B 범위의 하단부). 주요 투자자는 Tencent·CATL·창업자 Liang(약 40% 자체 출자)이며 국가 AI 펀드(CAIIF)도 참여 — 단 외부 투자자는 5년 락업·의결권 없음, 국가 펀드만 의결권 보유. R1·V3가 GPT-4급 성능을 약 1/10 비용으로 구현해 'AI 비용 혁명(Sputnik Moment)' 촉발. 단, 국유 펀드 투자로 지정학적 리스크 존재.",
      vp: "압도적 비용 효율과 오픈 가중치 배포로 빠른 채택. AI 인프라 비용 패러다임 전환의 상징.",
      direction: "효율 중심 모델 + 오픈 생태계. 다만 수출 규제·지정학 변수에 노출.",
      sources: ["첫 외부 라운드 완료 $7.4B·밸류 $50B+ (TrendForce / TechStartups '26.06.16)", "R1·V3 1/10 비용 GPT-4급 성능", "Tencent·CATL·창업자 40% 출자, 국가 AI 펀드만 의결권 (FT '26.6)"],
      url: "https://www.deepseek.com",
    },

    // ── bigtech ──
    {
      cat: "bigtech", name: "Apple", group: "device", domain: "apple.com", unit: "온디바이스+PCC+외부 LLM 3단 하이브리드",
      valuation: "$3.3T", valAsof: "26.06", metric: "처리 방식", value: "온디바이스+PCC+외부모델", metricAsof: "26.06",
      funding: "상장 (AAPL)", trend: 5, trendBasis: "자체 프런티어 포기·모델 오케스트레이터 전환",
      note: "Apple Intelligence는 ①온디바이스 처리 ②무기명 Private Cloud Compute(PCC) ③외부 프런티어 LLM 호출을 잇는 3단 하이브리드 아키텍처. WWDC26의 핵심 전환은 Siri를 외부 모델(Google Gemini 커스텀, 연 약 $10억 라이선스 추정)로 구동하고, 멀티 AI Extensions로 ChatGPT·Claude까지 선택 가능하게 한 것 — 자체 프런티어 모델 개발을 사실상 포기하고 '모델 선택형 오케스트레이터'로 선회. 민감정보는 기기 밖으로 내보내지 않는 PCC는 유지. iOS 27 지원은 iPhone 12 이상, EU·중국은 규제로 초기 출시 제외, Tim Cook은 2026.09.01 사임·John Ternus 승계 예정.",
      vp: "온디바이스+PCC로 프라이버시를 지키면서, 무거운 추론은 외부 프런티어 모델로 위임 — 하드웨어(Neural Engine)·OS·모델 선택권을 수직 통합.",
      direction: "자체 모델 고집을 버리고 Gemini·ChatGPT·Claude를 잇는 멀티 AI 오케스트레이터로 전환 — 단말 비서의 '모델 개방' 레퍼런스.",
      sources: ["Siri, Google Gemini 커스텀 모델로 구동 (WWDC26, 연 ~$10억 라이선스 추정)", "멀티 AI Extensions — Gemini·ChatGPT·Claude 선택 (WWDC26)", "온디바이스+PCC+외부 LLM 3단 하이브리드"],
      url: "https://www.apple.com/apple-intelligence/",
    },
    {
      cat: "bigtech", name: "Microsoft", group: "infra", domain: "microsoft.com", unit: "Copilot·Azure AI",
      valuation: "$3.5T", valAsof: "26.06", metric: "AI 런레이트", value: "$37B", metricAsof: "26.Q3",
      funding: "상장 (MSFT)", trend: 123, trendBasis: "AI 부문 +123% YoY",
      note: "Copilot, Azure OpenAI, GitHub Copilot — OpenAI 최대 파트너. Q3 FY2026 실적에서 Satya Nadella가 AI 부문 연 매출 런레이트 $37B(+123% YoY) 공식 확인. M365 Copilot 유료 좌석 2,000만 돌파(+250% YoY), Azure and other cloud services 40% YoY(상수통화 39%) 재가속(이전 '35%'는 구 추정치). Accenture 74만 좌석 최대 고객.",
      vp: "Office·Windows·Teams 번들 락인 + OpenAI 독점 파트너십. 기업 워크플로우에 AI를 기본 탑재.",
      direction: "Copilot 전 제품 통합 + Azure AI 인프라 확장. 자체 모델(MAI)과 OpenAI 병행으로 의존도 관리.",
      sources: ["AI 런레이트 $37B (+123%) — Q3 FY26 (Microsoft IR '26.4.29)", "Copilot 유료 좌석 2,000만 (+250% YoY)", "Azure 성장 40% YoY(상수통화 39%) — Microsoft IR Q3 FY26", "Accenture 74만 좌석 최대 고객 (UC Today '26)"],
      url: "https://www.microsoft.com/ai",
    },
    {
      cat: "bigtech", name: "Amazon", group: "infra", domain: "amazon.com", unit: "AWS Bedrock·Trainium",
      valuation: "$2.4T", valAsof: "26.06", metric: "AWS AI ARR", value: "$14B+", metricAsof: "26E",
      funding: "상장 (AMZN)", trend: 40, trendBasis: "Bedrock·자체 칩 성장",
      note: "Bedrock, Alexa+, Trainium 칩 — AWS Bedrock 멀티모델 호스팅. 2026.04.20 Anthropic에 즉시 $5B 투자 + 향후 최대 $20B 추가 가능(기존 $8B 별도)·AWS $100B 약정. 2026.02 OpenAI $50B 투자+$100B 클라우드 약정과 함께 '양쪽 베팅(two-horse)' 전략. Trainium2로 NVIDIA 의존도 저감. ($14B AWS AI ARR은 [업계 추정])",
      vp: "어느 AI가 이기든 인프라 공급자로서 수익을 확보하는 중립적 클라우드 포지션 + 자체 가속기.",
      direction: "OpenAI·Anthropic 양쪽 투자 + Bedrock 멀티모델 + Trainium 수직계열화로 Azure 대항.",
      sources: ["Anthropic 즉시 $5B + 최대 $20B 추가(기존 $8B 별도) (2026.04.20)", "OpenAI $50B 투자+$100B AWS 약정 (2026.02)", "[업계 추정] AWS AI 서비스 ARR ~$14B (2026E)"],
      url: "https://aws.amazon.com/ai/",
    },
    {
      cat: "bigtech", name: "NVIDIA", group: "infra", domain: "nvidia.com", unit: "AI GPU·CUDA",
      valuation: "$3.5T+", valAsof: "26.06", metric: "분기 매출", value: "$81.6B", metricAsof: "FY27 1Q",
      funding: "상장 (NVDA)", trend: 85, trendBasis: "Q1 FY27 +85% YoY · 분기 $81.6B·DC $75.2B",
      note: "H100/B200 GPU, CUDA — AI 학습/추론 GPU 시장 80%+ 점유. 최신 공개 분기 FY2027 1Q 매출 $81.6B(+85% YoY, 2026.05.20)·EPS $0.96(추정 $0.89 대비 +8% 서프라이즈)·그로스 마진 ~75% 유지(Blackwell 풀 램프 중 마진 방어) · 데이터센터 $75.2B(NVIDIA 공식 IR, +92% YoY, 전체의 ~92%; 일부 리포트 $73.5B는 네트워킹 제외 기준). Q2 FY27 가이던스 $91.0B±2%(China DC 제외 기준). FY2026 연매출 $215.9B(+65% YoY) — Q4 FY26 $68.1B(+73%)·DC $62.3B(+75%) 포함, 직전 FY2025 연 $130.5B와 구분 필요. 데이터센터 영업이익률 ~74.9%. [업계 추정] B200 출하량은 외부 추정. 개발자 생태계 NVIDIA Developer Program 7.5M+ / CUDA-X 1M+ developers(공식) — '400M 개발자'는 근거 없음.",
      vp: "GPU 하드웨어 80%+ 점유에 CUDA 소프트웨어 락인을 더한 이중 해자. 풀스택(칩·네트워킹·소프트웨어).",
      direction: "Blackwell(B200)·차세대 아키텍처 램프 + DGX Cloud + Omniverse. 전력·공급망이 핵심 변수.",
      sources: ["FY27 1Q 매출 $81.6B(+85%)·DC $75.2B(+92%) (NVIDIA 2026.05.20)", "Q2 FY27 가이던스 $91.0B±2%", "FY2026 연매출 $215.9B · FY2025 $130.5B (구분)", "Developer Program 7.5M+ / CUDA-X 1M+"],
      url: "https://www.nvidia.com",
    },
    {
      cat: "bigtech", name: "Meta AI", group: "model", domain: "ai.meta.com", unit: "오픈소스 LLM",
      valuation: "$1.7T", valAsof: "26.06", metric: "Meta AI 제품 MAU", value: "1.2B", metricAsof: "26.Q1",
      funding: "상장 (META)", trend: 50, trendBasis: "Meta AI 제품 MAU 1.2B (Q1 2026 공식)",
      note: "Llama 4, 오픈 가중치 LLM 리더. Meta AI 어시스턴트(제품) MAU 1.2B (Q1 2026 공식, 직전 1B+ 2025.10에서 증가). 별개로 페이스북·인스타·왓츠앱 앱군 Family DAP는 3.56B(Q1 2026) — 단 Iran 전쟁·러시아 WhatsApp 금지로 QoQ -5% 역대 첫 순감소(리스크 변수). 제품 MAU와 앱군 도달은 다른 지표이므로 분리 표기. 연간 AI 인프라 투자 $65B+.",
      vp: "가장 넓은 오픈소스 분포 + 앱군 35억 도달 유통망. 무료 모델로 생태계를 키우고 AI 광고로 수익화.",
      direction: "오픈 가중치 Llama로 표준 장악 + 광고 최적화 수익. 슈퍼인텔리전스 랩으로 프런티어 투자.",
      sources: ["Meta AI 제품 MAU 1.2B (Meta Q1 2026 IR)", "[구분 지표] Family DAP 3.56B(Q1'26) · QoQ -5% 역대 첫 감소(지정학)", "Llama 4 오픈 가중치 배포 · AI 인프라 투자 $65B+"],
      url: "https://ai.meta.com",
    },

    // ── startup ──
    {
      cat: "startup", name: "Perplexity", vertical: "검색·어시스턴트", rel: "어시스턴트 경쟁자", tier: "T2", domain: "perplexity.ai", unit: "AI 검색·에이전트 브라우저",
      valuation: "$20B", valAsof: "25.09", metric: "ARR", value: "$450M+", metricAsof: "26.03",
      funding: "Series", trend: 50, trendBasis: "ARR 1개월 +50%",
      note: "AI 검색·답변 엔진 + Comet AI 브라우저. 최신 확정 라운드 $20B post(2025.09 Series E-6, PitchBook)·2026.01 이후 보도 추정 $22.6B~23B는 미확정. 누적 조달 ~$1.71B. ARR $450M+(2026.03, 1개월 만에 +50%), 연 $656M 목표. 2026.03.23 Comet 전 세계 무료 전환($200/월→$0)으로 크롬(점유율 65%)과 정면 충돌. 출처 명시 답변으로 신뢰도 차별화.",
      vp: "출처를 명시하는 답변 엔진 + 자율 에이전트 브라우저(Comet)로 탐색·구매까지 대행.",
      direction: "검색을 넘어 에이전틱 브라우징·커머스로 확장. 광고/구독 하이브리드 수익화.",
      sources: ["ARR $305M→$450M+ (1개월 +50%) (Perplexity/CNET '26.3)", "Comet 전 세계 무료 공개 (Perplexity '26.6)", "연 $656M ARR 목표"],
      url: "https://www.perplexity.ai",
    },
    {
      cat: "startup", name: "Mistral AI", vertical: "인프라·파운데이션", rel: "오픈모델 소싱 후보", tier: "T1", domain: "mistral.ai", unit: "유럽 파운데이션 모델",
      valuation: "$20B", valAsof: "26.06", metric: "ARR", value: "$400M+", metricAsof: "26.02",
      funding: "$3.5B 라운드(클로즈)", trend: 71, trendBasis: "밸류 $12.8B(€11.7B)→$20B · ARR 20배↑",
      note: "프랑스 기반 AI 스타트업. 2026.06 신규 $3.5B 라운드를 밸류 $20B로 클로즈(직전 $12.8B(€11.7B) 대비 약 2배) — 유럽 최고가 사기업 중 하나. ARR $400M+(2026.02, 전년比 20배)·연말 $1B ARR 목표. 2026.03 $830M 부채로 파리 데이터센터(NVIDIA 칩 13,800개) 구축. Le Chat·Mistral Large. 유럽 AI 주권의 상징.",
      vp: "유럽 규제 호환성·데이터 주권 + 효율적 오픈 모델. EU 공공·산업 고객 접근성.",
      direction: "유럽 주권 AI 포지셔닝 + 자체 컴퓨트 확보 + 엔터프라이즈 커스텀 모델.",
      sources: ["$3.5B 라운드·밸류 $20B 클로즈 (2026.06)", "ARR $400M+ (2026.02, 전년比 20배)·$1B 목표", "$830M 부채로 파리 DC 13,800 NVIDIA 칩 (2026.03)"],
      url: "https://mistral.ai",
    },
    {
      cat: "startup", name: "Cohere", vertical: "엔터프라이즈 AI", domain: "cohere.com", unit: "엔터프라이즈·소버린 LLM",
      valuation: "$5.5B", valAsof: "25.07", metric: "ARR", value: "$240M", metricAsof: "25(2026 갱신 대기)",
      funding: "Series D · IPO 준비", trend: 50, trendBasis: "전 분기 QoQ 50%+",
      note: "기업용·소버린 AI 특화. 표기 수치는 2025년 기준(ARR $240M·밸류 $5.5B, 2025.07) — 2026 최신 공식 수치 미확인으로 업데이트 대기. 2026.05 Command A+ 오픈소스·North Mini Code 출시. Oracle·Salesforce·SAP 파트너십, IPO 준비.",
      vp: "엔터프라이즈 데이터 보안·소버린(주권) 배포와 RAG 최적화 모델.",
      direction: "규제·보안 민감 산업 + 국가 소버린 AI 타깃, IPO 추진.",
      sources: ["ARR $240M (CNBC '26.2)", "Command A+ 오픈소스 (2026.5)", "Oracle·Salesforce·SAP 파트너십"],
      url: "https://cohere.com",
    },
    {
      cat: "startup", name: "Databricks", vertical: "인프라·파운데이션", domain: "databricks.com", unit: "데이터+AI 플랫폼",
      valuation: "$134B", valAsof: "26.02", metric: "ARR", value: "$5.4B", metricAsof: "26.06",
      funding: "Series L · $175B 협의", trend: 116, trendBasis: "밸류 $62B→$134B",
      note: "데이터 레이크하우스 + AI 통합 플랫폼. 2026.02 Series L $5B로 밸류 $134B 확정(JPMorgan·Goldman·카타르). ARR 런레이트 $5.4B 돌파, 밸류 $175B 라운드 협의. CEO Ghodsi 'IPO는 2027년 목표'. 최고가치 미상장 소프트웨어 기업.",
      vp: "기업 데이터가 모여 있는 레이크하우스 위에서 바로 AI를 학습·배포. 데이터-모델 통합 가치사슬.",
      direction: "데이터+AI 통합 플랫폼 확장 + 에이전트·거버넌스. 2027년 IPO 목표.",
      sources: ["Series L $5B, 밸류 $134B (2026.02)", "ARR 런레이트 $5.4B (2026.06)", "밸류 $175B 라운드 협의"],
      url: "https://databricks.com",
    },
    {
      cat: "startup", name: "Scale AI", vertical: "인프라·파운데이션", domain: "scale.com", unit: "AI 데이터·평가·국방",
      valuation: "$14B", valAsof: "24.05", metric: "국방 계약", value: "$500M", metricAsof: "26.05",
      funding: "Series F", trend: 30, trendBasis: "국방 계약 5배 확대",
      note: "AI 학습 데이터·RLHF·모델 평가 플랫폼. 2026.05 미 국방부 $500M OTA 계약(8개월 만에 $100M→$500M, 5배). 컴퓨터 비전·GenAI 의사결정 지원·군사 계획 도구. 데이터 품질·평가가 모델 경쟁의 핵심 변수.",
      vp: "프런티어 모델 학습용 고품질 라벨·평가 데이터 + 정부(국방) 의사결정 레이어.",
      direction: "RLHF·평가·국방 AI로 확장. 데이터 신뢰성·평가 표준화.",
      sources: ["국방부 $500M 계약 (Bloomberg '26.5)", "밸류 $14B (Forbes '24.5)", "ARR $1.4B+ 추정"],
      url: "https://scale.com",
    },
    {
      cat: "startup", name: "Runway", vertical: "크리에이티브 도구", rel: "온디바이스 음성·미디어", tier: "T1", domain: "runwayml.com", unit: "비디오 생성 AI",
      valuation: "$4B", valAsof: "24.06", metric: "제품", value: "Gen-4", metricAsof: "26.05",
      funding: "Series D", trend: 25, trendBasis: "영상 생성 채택",
      note: "비디오 생성 AI 선도. 2026.05 Gen-4 출시 — 네이티브 오디오 생성·리얼리스틱 물리 엔진. Adobe Firefly에 Gen-4.5 최우선 배포 멀티이어 파트너십. 할리우드 제작 현장 도입 가속. 밸류 $4B(2024.06).",
      vp: "전문가급 영상+오디오 생성 품질과 크리에이티브 워크플로우 도구.",
      direction: "영상·오디오 통합 생성 고도화 + Adobe 파트너십으로 제작 시장 침투.",
      sources: ["Gen-4 출시 (2026.05)", "Adobe Firefly 멀티이어 파트너십", "밸류 $4B (Bloomberg '24.6)"],
      url: "https://runwayml.com",
    },
    {
      cat: "startup", name: "Stability AI", vertical: "크리에이티브 도구", rel: "온디바이스 음성·미디어", tier: "T1", domain: "stability.ai", unit: "생성 미디어(재건)",
      valuation: "$1B", valAsof: "23 피크", metric: "매출(추정)", value: "$190M", metricAsof: "26",
      funding: "구조조정·재건", trend: -10, trendBasis: "턴어라운드 케이스",
      note: "Stable Diffusion으로 이미지 생성을 대중화했으나 재정난·구조조정을 겪은 재건 케이스. 2026.05 Stable Audio 3.0(오픈웨이트)·Brand Studio 출시. 신임 CEO Prem Akkaraju(전 Weta)+Sean Parker·Eric Schmidt 이사회. 2026 추정 매출 $190M — 이미지에서 오디오·엔터프라이즈로 전환.",
      vp: "오픈 가중치 생성 모델 자산 + 엔터프라이즈 라이선싱·커스텀 트레이닝으로 수익 재편.",
      direction: "이미지→오디오·영상·엔터프라이즈 크리에이티브 툴로 포트폴리오 확장(턴어라운드 진행).",
      sources: ["Stable Audio 3.0·Brand Studio (2026.5)", "신임 CEO·이사회 재건 (CIO)", "2026 추정 매출 $190M"],
      url: "https://stability.ai",
    },
    {
      cat: "startup", name: "ElevenLabs", vertical: "크리에이티브 도구", rel: "온디바이스 음성·미디어", tier: "T1", domain: "elevenlabs.io", unit: "AI 음성 합성",
      valuation: "$11B", valAsof: "26.02", metric: "ARR", value: "$330M+", metricAsof: "26.01",
      funding: "Series D $500M", trend: 233, trendBasis: "밸류 $3.3B→$11B (3배+)",
      note: "AI 음성 생성·TTS 시장 선도. 2026.02 Series D $500M로 밸류 $11B(1년 전 $3.3B 대비 3배+), Sequoia 주도·NVIDIA 백업. ARR $330M+(2026.01). 팟캐스트·게임·영상 제작의 표준 음성 API.",
      vp: "자연스러운 다국어 음성 합성 품질과 개발자 친화 API. 콘텐츠 제작 파이프라인 표준화.",
      direction: "음성 에이전트·더빙·실시간 대화로 확장. IPO 옵션 검토.",
      sources: ["Series D $500M, 밸류 $11B (CNBC / Reuters '26.2.4)", "ARR $330M+ (2026.01)", "Sequoia 주도·NVIDIA 투자"],
      url: "https://elevenlabs.io",
    },
    {
      cat: "startup", name: "Harvey", vertical: "엔터프라이즈 AI", rel: "에이전트 UX 벤치마크", tier: "T2", domain: "harvey.ai", unit: "법률 버티컬 AI",
      valuation: "$11B", valAsof: "26.03", metric: "ARR", value: "$190M", metricAsof: "26.01",
      funding: "Series C $200M", trend: 90, trendBasis: "ARR 5개월 $100M→$190M",
      note: "법률 전문 AI 에이전트 — 버티컬 AI 리더. 2026.03 Series C $200M로 밸류 $11B(Sequoia·GIC 주도). ARR $190M(5개월 만에 $100M→$190M, +90%). 전 세계 1,300개+ 법률 조직, 변호사 10만 명+ 사용. AmLaw 100 과반수 고객.",
      vp: "법률 워크플로우에 특화된 도메인 데이터·에이전트로 대형 로펌의 신뢰 확보.",
      direction: "법률 외 전문서비스(세무·컴플라이언스)로 확장. 버티컬 에이전트 섹터 지표 기업.",
      sources: ["Series C $200M, 밸류 $11B (2026.03)", "ARR $190M (AgentMarketCap '26.4)", "변호사 10만 명+ 사용"],
      url: "https://www.harvey.ai",
    },
    {
      cat: "startup", name: "Glean", vertical: "엔터프라이즈 AI", domain: "glean.com", unit: "엔터프라이즈 AI 검색",
      valuation: "$7.2B", valAsof: "26.02", metric: "ARR", value: "$200M+", metricAsof: "26.01",
      funding: "Series F", trend: 80, trendBasis: "엔터프라이즈 표준화",
      note: "기업 내부 데이터 연결 AI 검색·지식 에이전트. 밸류 $7.2B, ARR $200M+. 대형 기업 IT·운영 부서의 AI 표준 도구로 부상. 'The Agentic List 2026' 선정.",
      vp: "사내 SaaS·문서를 권한 기반으로 통합 검색하는 엔터프라이즈 지식 그래프 + 에이전트.",
      direction: "검색에서 업무 자동화 에이전트로 확장. 대기업 표준 플랫폼 지향.",
      sources: ["밸류 $7.2B, ARR $200M+ (2026)", "The Agentic List 2026 선정 (IBL News)"],
      url: "https://www.glean.com",
    },
    {
      cat: "startup", name: "Sierra AI", vertical: "엔터프라이즈 AI", rel: "에이전트 UX 벤치마크", tier: "T2", domain: "sierra.ai", unit: "고객 서비스 AI 에이전트",
      valuation: "$15B+", valAsof: "26.05", metric: "ARR", value: "$150M", metricAsof: "26.05",
      funding: "$950M(Tiger Global·GV)", trend: 110, trendBasis: "밸류 $10B→$15B+ · 8분기 만에 ARR $150M",
      note: "고객 대면 AI 에이전트 플랫폼 — 기업 고객 서비스 전문. 2026.05 $950M 라운드(Tiger Global·GV)로 밸류 $15B+(직전 $10B). 출시(2024.02) 8분기 만에 ARR $150M 돌파 — 엔터프라이즈 AI 패권 경쟁 가열. (공동창업: Bret Taylor) Sequoia 투자.",
      vp: "기업 브랜드 맞춤형 고객 응대 에이전트로 콜센터·CS 비용 구조 재편.",
      direction: "산업별 CS 에이전트 템플릿 확장. 성과 기반 과금 실험.",
      sources: ["$950M 라운드·밸류 $15B+ (TechCrunch '26.05.04)", "8분기 만에 ARR $150M"],
      url: "https://sierra.ai",
    },
    {
      cat: "startup", name: "Midjourney", vertical: "크리에이티브 도구", rel: "온디바이스 음성·미디어", tier: "T1", domain: "midjourney.com", unit: "이미지·영상 생성 AI",
      valuation: "비상장(무외부투자)", valAsof: "—", metric: "매출(추정)", value: "$300M+", metricAsof: "24",
      funding: "외부투자 없음(부트스트랩)", trend: 20, trendBasis: "이미지→영상 확장",
      note: "외부 투자 없이 흑자 운영하는 이미지 생성 AI 대표주자. Discord 기반에서 자체 웹·V7 모델로 전환, 2025년 영상 생성에 진입. 추정 매출 $300M+(2024)로 부트스트랩 수익화의 모범 사례. a16z 컨슈머 톱100 이미지 부문 상위권.",
      vp: "고품질 이미지/영상 생성과 강력한 크리에이터 커뮤니티. 구독 단일 모델로 높은 마진.",
      direction: "이미지→영상·3D로 확장, 자체 플랫폼 강화. 외부 투자 없이 자력 성장.",
      sources: ["외부 투자 없는 부트스트랩 흑자 (The Information)", "추정 매출 $300M+ (2024)", "V7·영상 생성 진입 (2025)"],
      url: "https://www.midjourney.com",
    },
    {
      cat: "startup", name: "Suno", vertical: "크리에이티브 도구", rel: "온디바이스 음성·미디어", tier: "T1", domain: "suno.com", unit: "AI 음악 생성",
      valuation: "$5.4B", valAsof: "26.06", metric: "ARR", value: "$300M", metricAsof: "26",
      funding: "Series D $400M(2026.06)", trend: 120, trendBasis: "밸류 $2.45B(25.11)→$5.4B(26.06)",
      note: "텍스트→음악 생성 선도. 2026.06.03 Series D $400M·밸류 $5.4B(Bond Capital 주도) — 2025.11 $2.45B서 2배 급등. 구독자 2M+·ARR $300M. 가사·장르만 입력하면 완성곡 생성. WMG는 2025.11 합의·라이선스 파트너십(첫 라이선스 기반 모델 출시 준비), UMG·Sony는 저작권 소송 진행 중·2026.06 독립 아티스트 1,800+ 명 별도 집단소송 제기.",
      vp: "일반 사용자의 음악 창작 진입장벽 제거. 짧은 프롬프트로 완성도 높은 곡 생성.",
      direction: "음악 품질·편집 고도화 + 라이선스 협상으로 저작권 리스크 해소.",
      sources: ["Series D $400M·밸류 $5.4B (Variety/TechCrunch '26.06.03)", "구독자 2M+·ARR $300M", "WMG 라이선스 합의·UMG/Sony 소송 진행"],
      url: "https://suno.com",
    },
    {
      cat: "startup", name: "Hugging Face", vertical: "인프라·파운데이션", domain: "huggingface.co", unit: "오픈 모델 허브·MLOps",
      valuation: "$4.5B", valAsof: "23.08", metric: "등록 모델", value: "100만+", metricAsof: "25",
      funding: "Series D", trend: 30, trendBasis: "모델·데이터셋 폭증",
      note: "오픈소스 AI의 깃허브 — 모델·데이터셋·스페이스 허브. 2023.08 Series D로 밸류 $4.5B(Google·NVIDIA·Salesforce 등 참여). 등록 모델 100만+·데이터셋 20만+. 온디바이스용 경량·오픈 모델 배포의 사실상 표준 채널.",
      vp: "오픈 모델·데이터셋 유통 표준과 Transformers 라이브러리 생태계. 개발자 접근성 최고.",
      direction: "온디바이스·엣지용 경량 모델 허브 강화 + 엔터프라이즈 호스팅 수익화.",
      sources: ["Series D 밸류 $4.5B (2023.08)", "등록 모델 100만+ (2025)", "Google·NVIDIA·Salesforce 투자"],
      url: "https://huggingface.co",
    },
    {
      cat: "startup", name: "Synthesia", vertical: "크리에이티브 도구", rel: "온디바이스 음성·미디어", tier: "T2", domain: "synthesia.io", unit: "AI 아바타·영상 생성",
      valuation: "$2.1B", valAsof: "25.01", metric: "ARR", value: "$100M+", metricAsof: "25",
      funding: "Series D", trend: 50, trendBasis: "엔터프라이즈 영상 채택",
      note: "텍스트→AI 아바타 영상 생성 플랫폼. 2025.01 Series D로 밸류 $2.1B. 사내 교육·마케팅 영상 자동 제작으로 엔터프라이즈 표준화. 다국어 더빙·립싱크 강점.",
      vp: "대본만 입력하면 사람 없이 다국어 아바타 영상 제작. 영상 제작 비용·시간 대폭 절감.",
      direction: "실시간 아바타·인터랙티브 영상으로 확장.",
      sources: ["Series D 밸류 $2.1B (2025.01)", "ARR $100M+ (2025)", "엔터프라이즈 영상 표준 도구"],
      url: "https://www.synthesia.io",
    },
    {
      cat: "startup", name: "Abridge", vertical: "엔터프라이즈 AI", rel: "에이전트 UX 벤치마크", tier: "T2", domain: "abridge.com", unit: "의료 음성 AI(임상 기록)",
      valuation: "$2.75B", valAsof: "25.02", metric: "라운드", value: "$250M", metricAsof: "25.02",
      funding: "Series D", trend: 80, trendBasis: "병원 도입 급증",
      note: "의사-환자 대화를 실시간으로 임상 노트로 변환하는 의료 음성 AI. 2025.02 Series D로 밸류 $2.75B. 미국 대형 병원 네트워크 도입 확대 — 의료 행정 부담 절감 대표 사례.",
      vp: "진료 대화를 자동으로 구조화된 의무기록으로 전환. 의사 문서 작업 시간 대폭 절감.",
      direction: "전문과목별 모델·EHR(전자의무기록) 통합 확대.",
      sources: ["Series D 밸류 $2.75B (2025.02)", "미국 대형 병원 네트워크 도입", "임상 문서 자동화 선두권"],
      url: "https://www.abridge.com",
    },
    {
      cat: "startup", name: "Together AI", vertical: "인프라·파운데이션", domain: "together.ai", unit: "오픈모델 추론·학습 클라우드",
      valuation: "$3.3B", valAsof: "25.02", metric: "라운드", value: "$305M", metricAsof: "25.02",
      funding: "Series B", trend: 70, trendBasis: "오픈모델 추론 수요",
      note: "오픈소스 모델 학습·추론에 특화된 GPU 클라우드. 2025.02 Series B로 밸류 $3.3B(General Catalyst·NVIDIA 등). 오픈 모델을 저비용으로 서빙 — 온디바이스를 보완하는 클라우드 추론 후방 인프라.",
      vp: "오픈 모델 전용 최적화 추론 스택으로 클라우드 추론 단가 절감.",
      direction: "엔터프라이즈 전용 클러스터·파인튜닝 서비스 확대.",
      sources: ["Series B 밸류 $3.3B (2025.02)", "General Catalyst·NVIDIA 투자", "오픈모델 추론 클라우드"],
      url: "https://www.together.ai",
    },
    {
      cat: "startup", name: "Cursor", vertical: "에이전틱 AI·코딩", domain: "cursor.com", unit: "AI 코딩 에이전트(IDE)",
      valuation: "$60B", valAsof: "26.06", metric: "ARR", value: "$2B+→$4B", metricAsof: "26.06",
      funding: "SpaceX 인수 합의", trend: 100, trendBasis: "밸류 $29.3B→$60B · ARR $2B+→$4B(추정)",
      note: "AI 코딩 에이전트(Anysphere). 2026.06.16 SpaceX가 $60B 전액 주식 인수 합의(3분기 클로징 예정·딜 미성사 시 위약금 $1.5B 현금+$8.5B 컴퓨트=$10B). 창업 3년 만에 ARR $2B+(2026.02 기준), 인수 발표 후 Oppenheimer는 현재 ARR ~$4B·연말 $6B 전망으로 상향. 일일 활성 사용자(DAU) 100만+·총 활성 개발자 400만+·기업 고객 60%(Stripe·Adobe·NVIDIA). SpaceX가 Cursor 코드 데이터를 Grok 학습에 활용하겠다는 계획에 개발자 커뮤니티(Hacker News)서 데이터 프라이버시 논란.",
      vp: "IDE에 깊이 통합된 코딩 에이전트 — 단순 자동완성을 넘어 코드베이스 단위 작업.",
      direction: "SpaceX·xAI 생태계 편입 후 Grok 연계·엔터프라이즈 확장.",
      sources: ["SpaceX $60B 인수 합의·위약금 $10B($1.5B 현금+$8.5B 컴퓨트) (CNBC/Reuters '26.06.16)", "ARR $2B+(2026.02) → ~$4B 현재·연말 $6B 전망 (Oppenheimer '26.06.18)", "DAU 100만+·총 활성 개발자 400만+·기업고객 60% (CNBC/Forbes)"],
      url: "https://cursor.com",
    },
    {
      cat: "startup", name: "Lovable", vertical: "에이전틱 AI·코딩", domain: "lovable.dev", unit: "바이브 코딩(앱 생성)",
      valuation: "$6.6B", valAsof: "25.12", metric: "ARR", value: "$500M", metricAsof: "26",
      funding: "Series B $330M", trend: 150, trendBasis: "ARR $200M→$500M",
      note: "자연어로 웹앱을 만드는 '바이브 코딩' 대표주자. 2025.12 Series B $330M로 밸류 $6.6B. ARR $200M(2025)→$500M(2026)로 12개월 만에 $1M→$200M 돌파 후 급성장. 비개발자도 프롬프트로 앱 제작.",
      vp: "코드를 몰라도 자연어로 동작하는 앱을 생성 — 소프트웨어 제작 진입장벽 제거.",
      direction: "엔터프라이즈·협업 기능 확장, 코딩 에이전트와 경쟁/공존.",
      sources: ["Series B $330M·밸류 $6.6B (CNBC '25.12)", "ARR $500M (2026)", "직전 $1.8B (2025)"],
      url: "https://lovable.dev",
    },
    {
      cat: "startup", name: "Replit", vertical: "에이전틱 AI·코딩", domain: "replit.com", unit: "클라우드 IDE·AI 에이전트",
      valuation: "$9B", valAsof: "26.01", metric: "ARR 목표", value: "$1B", metricAsof: "26",
      funding: "~$400M 라운드 협의", trend: 120, trendBasis: "밸류 3배↑·$1B ARR 목표",
      note: "클라우드 기반 코딩 플랫폼+AI 에이전트. 2026.01 ~$400M 라운드로 밸류 약 $9B(직전 대비 약 3배) 협의. Replit Agent로 자연어→앱 배포 자동화, ARR 수억$ 규모로 $1B 목표.",
      vp: "브라우저에서 코딩·배포·호스팅을 한 번에 + AI 에이전트로 자동화.",
      direction: "엔터프라이즈·교육 시장 + 에이전트 자율 개발 고도화.",
      sources: ["~$400M 라운드·밸류 $9B 협의 (Bloomberg '26.01)", "$1B ARR 목표", "Replit Agent 자율 개발"],
      url: "https://replit.com",
    },
    {
      cat: "startup", name: "Kling AI", vertical: "크리에이티브 도구", rel: "온디바이스 음성·미디어", tier: "T2", domain: "klingai.com", unit: "AI 영상 생성(중국)",
      valuation: "$20B", valAsof: "26", metric: "ARR", value: "$240M~$500M", metricAsof: "25.12",
      funding: "Kuaishou 스핀오프 제안", trend: 140, trendBasis: "ARR $100M→$240M+(3월→12월)",
      note: "중국 Kuaishou의 AI 영상 생성. Kuaishou가 약 $20B 밸류·$2B 조달 스핀오프 제안 평가 중. ARR $240M(2025.12, 3월 $100M서 급증)·일부 보도 $500M. 글로벌 AI 영상 생성 랭킹 상위권(Runway·MiniMax와 경쟁).",
      vp: "고품질 텍스트→영상 생성 + Kuaishou 유통. 중국 크리에이터 생태계 장악.",
      direction: "스핀오프로 독립 자본 조달 + 글로벌 확장.",
      sources: ["Kuaishou 스핀오프 ~$20B 제안 (The Information '26)", "ARR $240M (2025.12)", "글로벌 AI 영상 상위권"],
      url: "https://klingai.com",
    },
    {
      cat: "startup", name: "Hailuo (MiniMax)", vertical: "크리에이티브 도구", rel: "온디바이스 음성·미디어", tier: "T2", domain: "hailuoai.com", unit: "AI 영상·멀티모달(중국)",
      valuation: "$13.7B", valAsof: "26", metric: "밸류", value: "$13.7B", metricAsof: "26",
      funding: "멀티모달 성장", trend: 120, trendBasis: "약 3년 만에 $13.7B",
      note: "중국 MiniMax의 AI 영상 생성 제품(Hailuo). 모회사 MiniMax는 텍스트·음성·영상 멀티모달 전략으로 약 3년 만에 밸류 $13.7B 도달. Hailuo는 Kling과 함께 크리에이터용 AI 영상 생성 1위권 경쟁.",
      vp: "텍스트·음성·영상을 아우르는 멀티모달 + 저비용 고품질 영상.",
      direction: "멀티모달 통합 + 글로벌 크리에이터·API 확장.",
      sources: ["MiniMax 밸류 $13.7B (2026)", "Hailuo·Kling 글로벌 AI 영상 상위권", "멀티모달(텍스트·음성·영상)"],
      url: "https://hailuoai.com",
    },
    {
      cat: "startup", name: "Writer", vertical: "엔터프라이즈 AI", domain: "writer.com", unit: "엔터프라이즈 생성 AI",
      valuation: "$1.9B", valAsof: "24.11", metric: "라운드", value: "$200M", metricAsof: "24.11",
      funding: "Series C", trend: 40, trendBasis: "엔터프라이즈 에이전트 채택",
      note: "엔터프라이즈 전용 생성 AI 플랫폼. 2024.11 Series C $200M로 밸류 $1.9B. 자체 모델(Palmyra)+에이전트로 기업 콘텐츠·워크플로우 자동화. Fortune 500 다수 고객, 규제 산업 컴플라이언스 강점.",
      vp: "기업 브랜드·규정에 맞춘 자체 모델 기반 생성 AI — 데이터 거버넌스 강점.",
      direction: "에이전틱 엔터프라이즈 워크플로우로 확장.",
      sources: ["Series C $200M·밸류 $1.9B (TechCrunch '24.11)", "자체 모델 Palmyra", "Fortune 500 고객"],
      url: "https://writer.com",
    },
    {
      cat: "native", name: "SpaceX (xAI, Cursor)", domain: "x.ai", unit: "AI 생태계(xAI·Grok·Cursor)",
      valuation: "$230B+", valAsof: "26.01", metric: "Grok+X 합산 도달", value: "600M+", metricAsof: "26.01",
      funding: "xAI Series E $20B · SPCX 상장", trend: 120, trendBasis: "xAI 밸류 $230B+ · Cursor $60B 인수",
      note: "일론 머스크 AI 생태계 통합 표기. xAI(Grok)는 2026.01 Series E $20B 완료·밸류 $230B+(누적 조달 $42B+). SpaceX는 SPCX 티커로 거래되며 2026.06.16 AI 코딩 에이전트 Cursor(Anysphere)를 $60B 주식 인수 합의(ARR $2B+, 기업고객 60%). Grok+X 합산 도달 600M+(독립 제품 MAU와 구분 — 대부분 X 사용자). 단, Grok 딥페이크 논란 등 거버넌스 리스크.",
      vp: "X 플랫폼 유통·자체 컴퓨트(Colossus)·코딩 에이전트(Cursor)를 묶은 수직 통합. 머스크 생태계 시너지.",
      direction: "Grok 프런티어 모델 + Cursor 코딩 에이전트 + X 통합. SPCX 상장으로 자본 조달.",
      sources: ["xAI Series E $20B·밸류 $230B+ (TechCrunch/NYT '26.1)", "SpaceX, Cursor $60B 인수 합의 (CNBC '26.06.16)", "Grok+X 합산 도달 600M+ (Grok 단독 아님)"],
      url: "https://x.ai",
    },
  ];

  // 업체 정렬: 카테고리 내에서 규모(밸류에이션) 큰 순. 카드·사이드바·피드 드롭다운이 동일 순서를 따름.
  const VAL_OVERRIDE = { "Google DeepMind": 2500 };   // Alphabet 산하 — 밸류 '—'이므로 ~$2.5T로 정렬
  const sizeOf = (c) => {
    if (VAL_OVERRIDE[c.name] != null) return VAL_OVERRIDE[c.name];
    const m = String(c.valuation).replace(/[$,+~\s]/g, "").match(/([\d.]+)\s*([TBM])?/i);
    if (!m) return 0;
    const v = parseFloat(m[1]); const u = (m[2] || "B").toUpperCase();
    return u === "T" ? v * 1000 : u === "M" ? v / 1000 : v;
  };
  COMPANIES.sort((a, b) => sizeOf(b) - sizeOf(a));
  const COMPANY_ORDER = COMPANIES.map(c => c.name);   // 피드 드롭다운 정렬 기준

  /* ---- 스타트업 버티컬 분류 (a16z Top 100 기준 — 온디바이스 단말 관점 우선순위 정렬) ---- */
  const STARTUP_VERTICALS = [
    { id: "coding", ko: "에이전틱 AI·코딩", en: "Agentic & Coding", desc: "코드 생성·자율 에이전트 — 개발 워크플로우 깊은 통합" },
    { id: "assistant", ko: "검색·어시스턴트", en: "Search & Assistant", desc: "AI 검색·답변·에이전트 브라우저 — 단말 어시스턴트 경쟁축" },
    { id: "creative", ko: "크리에이티브 도구", en: "Creative Tools", desc: "영상·음악·이미지·음성 생성 — 온디바이스 생성 기능과 직접 연결" },
    { id: "infra", ko: "인프라·파운데이션", en: "Infra & Foundation", desc: "오픈·소버린 모델·데이터·평가·모델 허브 — 모델 경쟁의 후방 가치사슬" },
    { id: "regional", ko: "지역 AI 플랫폼", en: "Regional Ecosystems", desc: "중국 등 지역 생태계 — 비용 효율·지정학 변수" },
    { id: "enterprise", ko: "엔터프라이즈 AI", en: "Enterprise AI", desc: "법률·CS·헬스케어·사내검색 등 도메인 특화(별도 소스: CB Insights)" },
  ];

  /* ---- 빅테크 그룹(핵심지표 성격별) ---- */
  const BIGTECH_GROUPS = [
    { id: "model", ko: "모델·어시스턴트", en: "Model & Assistant", desc: "파운데이션 모델·소비자 AI 접점 — 핵심지표는 사용자(MAU)" },
    { id: "infra", ko: "AI 인프라·매출", en: "AI Infra & Revenue", desc: "GPU·클라우드·Copilot — 핵심지표는 매출/런레이트(ARR)" },
    { id: "device", ko: "온디바이스·단말", en: "On-Device", desc: "단말 내 AI 처리 — 핵심지표는 처리 아키텍처" },
  ];

  /* ---- Articles (per-company, newest first) — co: 기업명(필터용) ---- */
  const ARTICLES = [
    // ── AI Native ──
    { date: "2026-07-02", co: "Meta AI", cat: "bigtech", source: "Reuters", title: "Zuckerberg 'AI 에이전트, 기대보다 느리다' — 사내 타운홀서 직접 인정", summary: "· Zuckerberg, 사내 타운홀서 '지난 4개월간 AI 에이전트 개발이 기대한 방식으로 가속화되지 않았다' 직접 발언\n· 3~6개월 내 의미 있는 성과 기대 언급 — 초대형 CapEx 대비 에이전트 성과 지연 공식 인정\n· 에이전트 능력 vs 신뢰성 격차가 빅테크 수장 발언으로 재확인 — 승인형·단계적 에이전트 설계 타당성 보강", tag: "AI 에이전트", url: "https://www.reuters.com/technology/artificial-intelligence/" },
    { date: "2026-07-02", co: "AI 에이전트", cat: "native", source: "CB Insights", title: "Q1 2026 글로벌 AI 투자 $226B 신기록 — 2025년 연간 합계를 한 분기에 초과", summary: "· 민간 AI 기업 투자 단일 분기 $226B — 2025년 연간 합계를 1개 분기에 초과\n· OpenAI $122B 단일 라운드가 54% 차지 — 제외해도 $104B로 역대 최고 수준\n· 자본이 초대형 모델사로 집중 — 단말·응용 계층은 파트너십·멀티소싱으로 접근하는 구조 고착", tag: "인사이트", url: "https://www.cbinsights.com/research/report/ai-trends-q1-2026/" },
    { date: "2026-07-02", co: "AI 에이전트", cat: "native", source: "CB Insights", title: "AI 에이전트 ROI 측정 공백 — 도입 의향 80% vs ROI 불명 40%", summary: "· 기업 임원 59명 서베이(Q4'25) — 80%가 AI 에이전트 도입을 최우선 과제로 선정\n· 그러나 40%는 ROI 추적 불가·미파악 — 배포 장벽 1위 신뢰성·보안(47%), 2위 통합(41%), 3위 인재(35%)\n· 단말 관점: 에이전트 기능의 성과 지표(KPI) 설계가 도입 성패 좌우 — 측정 가능한 UX부터 탑재", tag: "인사이트", url: "https://www.cbinsights.com/research/#agent-roi" },
    { date: "2026-07-02", co: "AI 에이전트", cat: "native", source: "CB Insights", title: "2026년 14대 기술 트렌드 — 'AI 에이전트 ROI 검증' 원년 선정", summary: "· CB Insights, 2026년 핵심 테마 1위로 '에이전트의 ROI 검증' 선정 — 속도·규모·자동화가 기본값 되는 운영 모델 전환기\n· 옵저버빌리티(LLM 성능 모니터링) 시장, 추적 대상 91개 GenAI 시장 중 딜 건수 1위\n· 에이전트 감사·모니터링 스택이 신규 기회 — 단말 에이전트도 로그·관측성 설계가 신뢰 확보 관건", tag: "인사이트", url: "https://www.cbinsights.com/research/#tech-trends-2026" },
    { date: "2026-07-02", co: "AI 에이전트", cat: "native", source: "CB Insights", title: "기업 63% 'AI 에이전트 최우선 도입' — 조사 기업 전원 최소 실험 단계 진행", summary: "· 서베이: 63% 기업이 향후 12개월 AI 에이전트 도입에 '매우 큰 비중' — 100%가 최소 실험 단계 진행\n· Salesforce·Workday가 2025년 에이전트 M&A 각 9건·4건으로 인수 주도\n· 엔터프라이즈 에이전트 표준 경쟁 개시 — 단말 에이전트도 업무 스택 연동성이 채택 관건", tag: "인사이트", url: "https://www.cbinsights.com/research/#agents-63" },
    { date: "2026-06-30", co: "Anthropic", cat: "native", source: "Anthropic / TNW", title: "Anthropic, Claude Sonnet 5 출시 — 역대 최고 에이전트 Sonnet·인트로 가격 $2/$10", summary: "· Claude Sonnet 5 출시(06.30) — 1M 컨텍스트·128K 출력·에이전트 특화, claude.ai Free·Pro 기본 모델로 즉시 적용\n· Terminal-Bench 2.1 80.4%로 Opus 4.8(74.6%) 상회·GDPval-AA v2 1,618 Elo — 인트로 가격 $2/$10(8월 말까지, 이후 $3/$15)\n· 단말 관점: Opus급 성능을 중급가로 — 에이전트 상용 배포의 비용 장벽 완화", tag: "Product", url: "https://www.anthropic.com/news/claude-sonnet-5" },
    { date: "2026-06-30", co: "Anthropic", cat: "native", source: "CNBC / STAT / MIT Tech Review", title: "Anthropic, Claude Science 공개 — 제약·바이오 특화 워크벤치, 자체 신약 연구 병행", summary: "· 'AI for Science' 이벤트서 Claude Science 공개 — 60개+ 과학 DB·연산 툴 통합 연구 워크벤치, 유료 구독자 전체 개방\n· 희귀·소외 질환 신약 연구 자체 수행 선언 — 50개 프로젝트에 최대 $3만 컴퓨팅 크레딧 지원\n· GPT-Rosalind·Isomorphic Labs와 과학 AI 정면 경쟁 — IPO 앞두고 제약 엔터프라이즈 매출 확장 포석", tag: "Product", url: "https://www.cnbc.com/2026/06/30/anthropic-launches-ai-drug-discovery-program-claude-science.html" },
    { date: "2026-06-30", co: "Anthropic", cat: "native", source: "CNBC / Forbes / Al Jazeera", title: "美, Fable 5·Mythos 5 수출 통제 전면 해제 — 07.01 글로벌 접근 복원", summary: "· 미 상무부, Claude Fable 5·Mythos 5 수출 통제 해제(06.30) — 발동 18일 만에 종료, 07.01부터 글로벌 접근 복원\n· 발단은 세이프가드 우회·취약점 식별 프롬프트 보고 — 신규 사이버보안 분류기 훈련 후 재배포\n· Pro·Max·Team 한도 50%로 07.07까지 운영 후 크레딧 전환 — 모델 접근권의 지정학 리스크 실증", tag: "Regulation", url: "https://www.cnbc.com/2026/06/30/anthropic-says-trump-admin-has-lifted-export-controls-on-claude-fable-5-and-mythos-5.html" },
    { date: "2026-06-26", co: "", cat: "bigtech", source: "CNBC", title: "'토큰맥싱'에서 효율로 — OpenAI·Anthropic, AI 지출 절감 전환 직면", summary: "· CNBC 분석: 기업·개발자가 토큰 사용 극대화('tokenmaxxing')에서 비용 효율 최적화로 전환\n· 모델 가격 인하 경쟁·경량 모델 확산 — API 매출 성장률 둔화 압력\n· 단말 관점: 경량·저비용 모델 수요 확대 — 온디바이스 처리의 경제성 부각", tag: "Analysis", url: "https://www.cnbc.com/2026/06/26/openai-anthropic-new-ai-spending-reality-as-users-shift-to-efficiency.html" },
    { date: "2026-06-24", co: "OpenAI", cat: "native", source: "OpenAI / TechCrunch / CNBC", title: "OpenAI, 첫 자체 칩 'Jalapeño' 공개(Broadcom 공동) — NVIDIA 의존 축소 노림", summary: "· OpenAI·Broadcom, LLM 추론 전용 첫 커스텀 ASIC 'Jalapeño' 공개 — 설계→테이프아웃 9개월(업계 최단 추정)\n· 전력효율(perf-per-watt) 현 최첨단 대비 우위 주장·2026년 말 초기 배포 — ChatGPT·Codex·API 추론에 투입\n· 단말 관점: 모델사 자체 추론칩이 AI 인프라 단가·공급 다변화 가속 — '풀스택' 수직통합 경쟁 본격화", tag: "Chip", url: "https://openai.com/index/openai-broadcom-jalapeno-inference-chip/" },
    { date: "2026-06-24", co: "Anthropic", cat: "native", source: "CNBC / Bloomberg", title: "Anthropic, Alibaba가 Claude 역대 최대 증류 공격 실행 주장 — 백악관·상원 서한 제출", summary: "· 06.04~06.05 Alibaba 연계 25,000개 가짜 계정으로 2,880만 Claude 대화 — Fable Preview 능력 추출('역대 최대 AI 증류 공격')\n· 코딩·다단계 추론·사이버보안 능력을 Qwen 훈련에 전용 — Anthropic, 백악관·미 상원(Scott·Warren)에 서한 제출\n· '수백억 달러 미국 AI 투자를 지정학적 경쟁자 보조금으로 전용' — Mythos 5 수출 통제의 직접 배경", tag: "Security", url: "https://www.cnbc.com/2026/06/24/anthropic-alibaba-distillation-campaign.html" },
    { date: "2026-06-25", co: "", cat: "bigtech", source: "Reuters / CNBC / Evertiq", title: "Qualcomm, AI 소프트웨어 기업 Modular $3.9B 인수 — Swift 창시자 Chris Lattner 합류", summary: "· Qualcomm, AI 소프트웨어 인프라 기업 Modular $3.9B 주식 교환 인수 합의 — Swift 창시자 Chris Lattner 포함 ~150명 합류\n· CPU·GPU·NPU·ASIC 재작성 없이 AI 실행하는 플랫폼 — CUDA 독점에 소프트웨어 레이어 도전\n· NVIDIA 소프트웨어 생태계 대항마로 Qualcomm AI 인프라 스택 확보", tag: "M&A", url: "https://www.reuters.com/technology/#qualcomm-modular-39b" },
    { date: "2026-06-25", co: "OpenAI", cat: "native", source: "Axios / Reuters / NYT", title: "트럼프 행정부, GPT-5.6 출시 제한 요청 — 역사상 첫 프런티어 모델 사전 개입", summary: "· ONCD·OSTP가 OpenAI에 GPT-5.6 배포 제한 요청·OpenAI 수용 — 역사상 첫 프런티어 모델 사전 개입\n· 초도 Amazon Bedrock 포함 20개 파트너 한정·정부 케이스별 접근권 심사 — Altman '2~3주 후 출시 희망'\n· IPO: Altman '$1T 이하 없다' → Reuters/NYT 2027년 상장 유력(09월 목표 후퇴)", tag: "Regulation", url: "https://www.axios.com/2026/06/25/trump-administration-openai-gpt-model-release" },
    { date: "2026-06-25", co: "OpenAI", cat: "native", source: "NYT / Reuters", pub: "2026-06-25", title: "OpenAI IPO 2027년으로 연기 검토 — Kalshi 예측시장 발표 확률 59%", summary: "· NYT 보도: OpenAI IPO 2026년 말 → 2027년 연기 검토 — SpaceX 상장 후 기술주 변동성 확대가 배경\n· Altman: '$1T 평가액 이하로 낮추는 것은 받아들일 수 없다'\n· Kalshi 예측시장: 03.01 이전 IPO 발표 확률 59% 평가", tag: "IPO", url: "https://www.nytimes.com" },
    { date: "2026-06-25", co: "", cat: "startup", source: "TechCrunch / Reuters", title: "Agility Robotics, SPAC 합병 $2.5B 상장 추진 — 순수 휴머노이드 로봇 미국 첫 공모", summary: "· 이족보행 로봇 Digit 보유 Agility Robotics, Churchill Capital XI와 SPAC 합병 추진 — 평가액 $2.5B·조달 $620M+·티커 $AGLT\n· 순수 휴머노이드 로봇 기업으로 미국 시장 최초 상장 사례\n· 물류·제조 자동화 타깃 — Physical AI 자본 유입의 공모시장 진입 신호", tag: "IPO", url: "https://techcrunch.com" },
    { date: "2026-06-25", co: "", cat: "startup", source: "The AI Insider / Yahoo Finance", title: "Cerebras Q1 2026 첫 실적 — 매출 $193.4M +94% YoY, 주가 ~20% 급락", summary: "· Cerebras Q1 2026 매출 $193.4M(+94% YoY) — 첫 분기 실적에도 주가 ~20% 급락\n· 연간 총이익률 가이던스 38~41%가 Q1(47%)보다 낮게 제시 — Feldman CEO '고객 시스템 임대로 수요 충당하는 일시 전략'\n· 장기 목표 마진 60% — AI 추론 칩 전문 기업 수익성 구조 검증 국면", tag: "Earnings", url: "https://finance.yahoo.com" },
    { date: "2026-06-26", co: "OpenAI", cat: "native", source: "Reuters / InsiderFinance", title: "GPT-5.6 세부 공개 — Sol·Terra·Luna 3개 모델 구성, 20개 파트너 한정 배포", summary: "· GPT-5.6은 Sol(코딩·사이버보안)·Terra(균형형)·Luna(빠르고 저렴) 3개 모델 구성 — 초도 20개 파트너 한정 배포\n· Altman: '이 수준의 정부 접근은 장기적 기본값이 되어선 안 된다'\n· 2~3주 후 확대 배포 희망 — 향후 프런티어 모델 정부 개입 표준화 압력", tag: "Product", url: "https://www.reuters.com/technology/#gpt-56-sol-terra-luna" },
    { date: "2026-06-26", co: "OpenAI", cat: "native", source: "OpenAI / Yahoo Finance Tech", title: "GPT-4.5 ChatGPT 전면 은퇴 — GPT-4 계열 마지막 모델·GPT-5 시대 공식 전환", summary: "· GPT-4.5, 06.26 ChatGPT에서 전면 은퇴 — GPT-4 계열 마지막 모델·05.28 공지 후 30일 sunset 완료\n· 기존 대화는 GPT-5.5로 자동 계속·API는 유지 — o3도 08.26 은퇴 예정\n· GPT-4 시대 공식 종료 — GPT-5 계열 전면 전환 로드맵 확정", tag: "Product", url: "https://tech.yahoo.com/ai/chatgpt/articles/openai-just-quietly-retired-final-152930749.html" },
    { date: "2026-06-26", co: "Anthropic", cat: "native", source: "CNBC / Reuters", title: "美 상무부 서한, Mythos 5 100개+ 기관에 부분 허용 — Lutnick 장관 서명", summary: "· 미 상무부 서한: Mythos 5 접근을 100개+ 미국 기업·연방기관에 부분 허용 — Lutnick 장관 '적절한 안전장치 마련'\n· 앞서 06.12 수출 통제로 Fable 5·Mythos 5 외국인 접근 전면 차단\n· 중요 인프라 운영·방어 조직 대상 — AI 모델 접근권이 국가 안보 자산화", tag: "Regulation", url: "https://www.cnbc.com" },
    { date: "2026-06-27", co: "Google DeepMind", cat: "bigtech", source: "Google / Forbes", title: "Gemini 3.5 Flash, 네이티브 Computer Use 탑재 — OSWorld 78.4점·GPT-5.5 대비 3배 저렴", summary: "· Gemini 3.5 Flash에 네이티브 Computer Use 내장 — 마우스 클릭·폼 입력 자율 수행, 데스크탑·모바일·브라우저 통합\n· OSWorld-Verified 78.4점(Claude Sonnet 4.6 동률)·GPT-5.5 대비 약 3배 저렴 — 프롬프트 인젝션 방지 적대적 학습 포함\n· 가격 경쟁력 + 에이전트 능력 동시 충족 — 엔터프라이즈 확산 가속 전망", tag: "Product", url: "https://deepmind.google" },
    { date: "2026-06-27", co: "", cat: "bigtech", source: "Yahoo Finance / Bloomberg", title: "빅테크 AI 청구서 — 6월 시총 $2.7T 증발·FCF -91%·CapEx $7,250억", summary: "· Mag 7+Broadcom+Oracle 6월 한 달 시총 합산 $2.7T 증발 — AI CapEx 회수 불확실성 본격 반영\n· 하이퍼스케일러 4사 2026 CapEx $7,250억(+77% YoY)·FCF 합산 약 -91%(~$160억) vs 순이익 +25%(~$5,060억)\n· Goldman Sachs '기업 7%만 의미 있는 ROI' 경고 현실화 — CapEx 과잉 vs 수익화 속도 격차 부각", tag: "Market", url: "https://finance.yahoo.com/markets/article/big-techs-27-trillion-ai-bill-comes-due-chart-of-the-day-100000100.html" },
    { date: "2026-06-28", co: "OpenAI", cat: "native", source: "OpenAI", title: "OpenAI, GPT-5.6 Sol Preview 첫 공식 공개 — 코딩·사이버보안 특화 최초 프런티어 공개", summary: "· OpenAI, 06.28 GPT-5.6 Sol Preview 공식 첫 공개 — 정부 협의 후 제한적 출시\n· Sol 코딩·사이버보안 특화(3-tier 확정) — Amazon Bedrock 포함 20개 파트너 한정·수 주 내 일반 배포 목표\n· Polymarket 7월 말 이전 전면 출시 확률 94% — 정부 개입 이후 첫 프런티어 공개 사례", tag: "Product", url: "https://openai.com/news/" },
    { date: "2026-06-28", co: "Google DeepMind", cat: "bigtech", source: "CNBC / Bloomberg", title: "Google, Meta의 Gemini 사용량 제한 — AI 인프라 공급 병목 심화", summary: "· Google, Meta의 Gemini 사용량 제한 — 컴퓨팅 용량 공급 불가(FT 보도)\n· Meta 일부 내부 AI 프로젝트 지연·직원 토큰 효율 권고 — 다른 Google 고객사도 일부 영향\n· 수요 > 공급 구조 심화 — $650B+ CapEx에도 병목 해소 미완", tag: "Analysis", url: "https://www.bloomberg.com" },
    { date: "2026-06-28", co: "Anthropic", cat: "native", source: "Reuters", title: "오스트리아, EU에 Anthropic 유럽 법적 설립 제안 — AI 수출 통제 갈등 가시화", summary: "· 오스트리아, EU 기술담당 집행위원 Virkkunen에 Anthropic 유럽 내 법적 설립 제안\n· 배경: 미국 수출 통제로 Fable 5·Mythos 5 외국인 접근 차단 → EU 기술 주권 위협(Proell '유럽이 혁신에서 단절되어선 안 된다')\n· AI 수출 통제가 미·EU 기술 패권 갈등으로 번지는 첫 공식 신호", tag: "Regulation", url: "https://www.reuters.com/world/europe/#austria-anthropic-eu" },
    { date: "2026-04-24", co: "Anthropic", cat: "native", source: "TechCrunch / CNBC", title: "Google, Anthropic에 최대 $40B 투자 — 즉시 $10B + 성과 연동 $30B, TPU 컴퓨트 확대", summary: "· Google, Anthropic에 최대 $40B 투자(즉시 $10B·이후 성과 연동 $30B) — Amazon과 함께 양대 후원\n· Google Cloud 5년간 5GW 컴퓨트 공급(2027~)·Broadcom TPU 3.5GW 증설 — Claude 공급 병목 해소\n· 단말 관점: Anthropic이 Amazon·Google 양쪽 인프라 확보 — 모델 공급 안정성이 단말 탑재 신뢰성으로 직결", tag: "Funding", url: "https://techcrunch.com/2026/04/24/google-to-invest-up-to-40b-in-anthropic-in-cash-and-compute/" },
    { date: "2026-06-19", co: "Anthropic", cat: "native", source: "Bloomberg / TechCrunch", title: "노벨화학상 John Jumper, DeepMind 떠나 Anthropic行 — 과학 AI 인재 이동", summary: "· AlphaFold(2024 노벨화학상) John Jumper, DeepMind→Anthropic 이적(연말 인수인계 후)\n· 같은 주 Gemini 공동리드 Noam Shazeer도 OpenAI行 — Google 인재 유출 가속\n· 최정상 과학 AI 인재가 모델 개발사로 집중되는 신호(Anthropic AI-for-science 강화)", tag: "People", url: "https://www.bloomberg.com/news/articles/2026-06-19/nobel-winner-john-jumper-to-leave-google-deepmind-for-anthropic" },
    { date: "2026-06-12", co: "Anthropic", cat: "native", source: "Reuters / CNBC", title: "글로벌 IT서비스 양대 DXC·TCS, 24시간 내 잇따라 Claude 파트너십 체결", summary: "· DXC Technology(06.11)·Tata Consultancy Services(06.12)가 하루 차이로 Claude 글로벌 파트너십 발표\n· Anthropic run-rate $47B(2025말 $9B서 급증)·Q2 첫 영업흑자 ~$559M 전망 — 엔터프라이즈 채택이 견인\n· 단말 관점: 대형 SI가 Claude를 표준 채택 — 기업 단말·업무 환경의 기본 AI 레이어로 확산", tag: "Enterprise", url: "https://www.reuters.com/technology/" },
    { date: "2026-06-16", co: "OpenAI", cat: "native", source: "TechCrunch / Fast Company", title: "ChatGPT 점유율 첫 50% 이하 — Gemini·Claude 약진, '3파전' 고착", summary: "· 2026.05 ChatGPT 점유율 46.4%로 첫 50% 붕괴(2024.12 65.3%→2025.12 52.8%)\n· Gemini 27.7%·Claude 10.3%(반년 4배↑) — 단 ChatGPT MAU 11.1억으로 1위 유지\n· AI 플랫폼이 OpenAI·Google·Anthropic '3파전'으로 고착(점유율↓ vs 사용자↑ 분리)", tag: "Market", url: "https://techcrunch.com/2026/06/16/chatgpts-market-share-slips-below-50-for-first-time/" },
    { date: "2026-06-10", co: "OpenAI", cat: "native", source: "AP / Axios", title: "Visa, ChatGPT에 결제망 직접 연동 — AI 에이전트가 대신 쇼핑·결제", summary: "· 2026.06.10 Visa, 결제망을 ChatGPT에 내장 — 카드 연결 시 에이전트가 가맹점서 결제 대행\n· 가드레일: 지출한도·승인단계·승인 가맹점 · 초기엔 건별 승인(휴먼인더루프)\n· Agentic AI가 '대화'를 넘어 실거래(커머스)로 진입한 첫 주요 사례", tag: "Product", url: "https://www.axios.com/2026/06/10/visa-chatgpt-agents-commerce" },
    { date: "2026-06-08", co: "OpenAI", cat: "native", source: "Reuters / The Information", title: "OpenAI, 미국 증시 S-1 기밀 제출 — 밸류 $852B·공모 목표 최대 $1T", summary: "· 2026.06.08 SEC S-1 기밀 제출 — 밸류 $852B·총 조달 $122B·공모 목표 최대 $1T(09월 상장 목표)\n· Q1 실매출 $5.7B·순손실 $21.3B·현금 보유 $73B+·컴퓨트 약정 $665B\n· 2026 매출 ~$30B 목표 트랙(일부 추정 $46B는 미확인) — 수익성이 최대 IPO 리스크", tag: "IPO", url: "https://www.aljazeera.com/economy/2026/6/8/tech-giant-openai-files-for-us-initial-public-offering" },
    { date: "2026-06-09", co: "Anthropic", cat: "native", source: "Anthropic", title: "Anthropic, Claude Fable 5 출시 — 자율 코딩 에이전트 SWE-bench 신기록", summary: "· Claude Fable 5 출시(2026.06.09) — SWE-bench Verified 최상위·1M 토큰·128K 출력\n· Opus 4.6(2월)→4.7(4월)→Fable 5 빠른 사이클 — 코딩 에이전트 역대 최고 성능\n· Amazon 추가 $25B 투자 후 AWS Bedrock 최우선 배포", tag: "Product", url: "https://www.anthropic.com/news#claude-fable-5" },
    { date: "2026-05-20", co: "Google DeepMind", cat: "bigtech", source: "Google", title: "Google I/O 2026 — Gemini 3.1 Pro + Deep Research Max, ARC-AGI-2 77.1%", summary: "· Gemini 3.1 Pro — ARC-AGI-2 77.1%·SWE-Bench 80.6%·100만 토큰 컨텍스트\n· Deep Research Max — 자율 리서치 에이전트(MCP 지원)\n· 검색·워크스페이스 전면 통합 — AI Ultra 구독자 우선 배포", tag: "Product", url: "https://blog.google/technology/ai/" },
    { date: "2026-05-19", co: "Google DeepMind", cat: "bigtech", source: "Google DeepMind / 9to5Google", title: "Gemini 3.5 Flash 출시 — 'Flash 속도로 Pro급 추론', 앱 기본 모델로", summary: "· Gemini 3.5 Flash — 출시 즉시 앱·검색 AI Mode 기본 모델로 전환\n· 에이전트·멀티모달서 Pro급 상회(ARC-AGI-2 72.1%) — 중급가로 코딩·에이전트 처리\n· Gemini 앱 MAU 900M+ 공개($84.75B 증자) · AI 개발자 구독 $100/월", tag: "Product", url: "https://deepmind.google/models/gemini/flash/" },
    { date: "2026-01-06", co: "SpaceX (xAI, Cursor)", cat: "native", source: "TechCrunch / NYT / The Guardian", title: "xAI, Series E $20B 완료 — 밸류 $230B+, Grok 딥페이크 논란 동시 직면", summary: "· xAI Series E $20B 완료(NVIDIA·Cisco·카타르·Fidelity) — 누적 $42B+·밸류 $230B+\n· Grok+X 합산 도달 600M+(독립 MAU와 구분 — 대부분 X 사용자)\n· Grok 미성년 딥페이크 자동 생성 논란 → 다수 정부 조사(성장 vs 거버넌스 리스크)", tag: "Funding", url: "https://www.theguardian.com/technology/2026/jan/06/elon-musk-xai-investment-grok-backlash" },
    { date: "2026-06-16", co: "DeepSeek", cat: "startup", source: "CNBC / Reuters", title: "DeepSeek, 첫 외부 펀딩 완료 — $7.4B 조달·밸류 $50B+ 확정", summary: "· 첫 외부 라운드 $7.4B(CNY 50B+)·밸류 $50B+ 확정($52B~$59B 하단부)\n· 투자자 Tencent·CATL·창업자 40%·국가 AI 펀드 — 외부 투자자 5년 락업·의결권 없음\n· R1·V3로 GPT-4급을 1/10 비용 구현('Sputnik Moment') — 단 국유자본 거버넌스 리스크", tag: "Funding", url: "https://www.cnbc.com/2026/06/03/deepseek-slated-to-draw-7-billion-in-maiden-fundraising-sources-say.html" },
    { date: "2026-05-28", co: "Anthropic", cat: "native", source: "Anthropic / Reuters", title: "Anthropic, Series H $65B·밸류 $965B — run-rate 매출 $47B로 OpenAI 추월", summary: "· Series H $65B·$965B post-money(직전 2026.02 $380B) — 3개월 만에 2.5배\n· run-rate 매출 '이달 $47B 돌파'(4월 $30B서 급증) — OpenAI $25B 2배 가까이 추월\n· Claude Code 단독 $2.5B+ ARR — 최대 경쟁 역학 변화", tag: "Funding", url: "https://www.anthropic.com/news#series-h" },
    { date: "2026-06-17", co: "Anthropic", cat: "native", source: "Anthropic / The Information", title: "Anthropic, IPO 기밀 제출 + 서울 오피스 개설 — 한국 AI 생태계 파트너십", summary: "· 2026.06.01 밸류 $965B로 IPO 기밀 제출 — AI 최대어 상장 경쟁 가세\n· 06.17 서울 오피스 개설 + 한국 AI 생태계 파트너십 — 단말·제조 적용 신호\n· OpenAI(09월 목표)와 상장 레이스 본격화", tag: "IPO", url: "https://www.anthropic.com/news#seoul-office" },
    { date: "2026-06-12", co: "SpaceX (xAI, Cursor)", cat: "native", source: "CNBC / TechCrunch", title: "SpaceX, SPCX로 나스닥 데뷔 — 공모가 $135·조달 최종 $85.7B '사상 최대 IPO'", summary: "· 2026.06.12 나스닥 SPCX 데뷔 — 공모가 $135·조달 $75B → 그린슈 행사로 최종 $85.7B(사상 최대 IPO)\n· 첫날 +19% $161 마감·시총 $2.1T 데뷔 → 06.16 주가 급등으로 ~$2.51T(미 시총 4위권)\n· 4일 뒤 Cursor $60B 전액 주식 인수 합의 — 머스크 거버넌스 리스크 병존", tag: "IPO", url: "https://www.cnbc.com/2026/06/16/spacex-spcx-cursor-acquisition-ipo.html#nasdaq-debut" },

    // ── Big Tech AI ──
    { date: "2026-06-08", co: "Apple", cat: "bigtech", source: "Fortune / CNBC / Apple", title: "Apple WWDC 2026 — 'Gemini 탑재 Siri' + 멀티 AI 확장으로 Claude도 아이폰 선택지", summary: "· WWDC26 — Siri를 외부 모델로 구동하는 'Gemini 탑재 Siri AI' 공개\n· 멀티 AI Extensions로 Claude를 아이폰 선택지로 최초 편입(모델 선택 개방)\n· 자체 온디바이스 모델+PCC 유지 — 단말 기본 비서의 '모델 개방' 전환점", tag: "Product", url: "https://www.apple.com/apple-intelligence/" },
    { date: "2026-04-29", co: "Microsoft", cat: "bigtech", source: "Microsoft IR / CNBC", title: "Microsoft Q3 FY2026 — AI 연 매출 $37B 런레이트, Azure 40% 재가속", summary: "· Nadella 확인 — AI 사업 연 매출 런레이트 $37B(+123% YoY)\n· M365 Copilot 유료 좌석 2,000만(+250%)·Azure 40% 재가속·전체 매출 $82.9B(+18%)\n· Accenture 74만 좌석 최대 고객 — 기존 번들 락인이 수익화 핵심", tag: "Earnings", url: "https://www.cnbc.com/2026/04/29/microsoft-msft-q3-earnings-report-2026.html" },
    { date: "2026-04-20", co: "Amazon", cat: "bigtech", source: "CNBC / NYT / GeekWire", title: "Amazon, Anthropic에 추가 투자 — 즉시 $5B + 향후 최대 $20B, AWS $100B+ 약정", summary: "· 지분투자 = 기존 $8B + 즉시 $5B + 향후 최대 $20B(약정·미집행) — '누적 $33B 완료'는 부정확\n· 별도로 Anthropic AWS 10년 컴퓨트 약정 $100B+(투자와 구분) · Bedrock ~100개 모델·Guardrails 80%↓\n· 2개월 전 OpenAI $50B+$100B 딜과 동시 — '양쪽 베팅' 인프라 중립 전략", tag: "Funding", url: "https://www.cnbc.com/2026/04/20/amazon-invest-up-to-25-billion-in-anthropic-part-of-ai-infrastructure.html" },
    { date: "2026-02-25", co: "NVIDIA", cat: "bigtech", source: "NVIDIA IR / The Verge", title: "NVIDIA Q4 FY2026 분기 매출 $68.1B — FY2026 연 $215.9B 확정", summary: "· Q4 FY26 매출 $68.1B(+73%, 신기록)·DC $62.3B(+75%)\n· FY26 연 $215.9B 확정(+65%, 직전 FY25 $130.5B와 구분)\n· B200 추론 H100 대비 30배 — 단 하이퍼스케일러 자체칩 190만대로 '분리' 가속", tag: "Earnings", url: "https://www.nvidia.com/en-us/investor-relations/" },
    { date: "2025-04-05", co: "Meta AI", cat: "bigtech", source: "Meta / NDTV", title: "Meta, Llama 4 발표 — Scout·Maverick 오픈소스, Behemoth 2T MoE 예고", summary: "· Llama 4 Scout·Maverick 오픈소스 즉시 공개 · Llama Guard 4 보안툴 동시\n· Behemoth 2T 총 파라미터·288B 활성 MoE — 업계 최대 규모 예고\n· Meta AI 어시스턴트 WhatsApp·IG·Messenger 통합 월 30억+ — 오픈소스로 표준 장악", tag: "Product", url: "https://www.ndtv.com/world-news/meta-launches-llama-4-all-about-the-latest-open-source-ai-model-8100928" },

    // ── AI Startup ──
    { date: "2026-06-15", co: "Glean", cat: "startup", source: "Crunchbase News / TechCrunch", title: "Glean, Series F $150M — 밸류 $7.2B, 9개월 만에 또 라운드", summary: "· Series F $150M·밸류 $7.2B — 직전 Series E($260M·$4.6B) 9개월 만에 재차 조달\n· 사내 SaaS·문서 권한 기반 통합 검색 + 업무 에이전트로 ARR $200M+\n· 단말 관점: 기업 업무 에이전트가 사내 데이터 허브로 — B2B 단말의 기본 AI 레이어 경쟁", tag: "Funding", url: "https://news.crunchbase.com/venture/ai-powered-work-assistant-glean-valuation-jumps/" },
    { date: "2026-05-14", co: "Cerebras", cat: "startup", source: "TechCrunch / CNBC", title: "Cerebras, 2026 첫 대형 IPO — $4.8B 조달·시총 $95B, 상장 첫날 +108%", summary: "· 나스닥 데뷔 — $4.8B 조달·밸류 $48.8B 책정 후 첫날 +108%·시총 $95B 마감\n· 웨이퍼스케일 엔진(WSE-3)로 추론 GPU 대비 최대 15배 속도 — OpenAI·G42·AWS 고객\n· 단말 관점: NVIDIA 외 추론 가속 대안 부상 — AI 인프라 단가·공급 다변화 신호", tag: "IPO", url: "https://techcrunch.com/2026/05/14/cerebras-raises-5-5b-kicking-off-2026s-ipo-season-with-a-bang/" },
    { date: "2026-05-04", co: "Sierra AI", cat: "startup", source: "TechCrunch / Bloomberg", title: "Sierra AI, $950M 조달 — 밸류 $15B+로 점프, 엔터프라이즈 AI 패권 경쟁", summary: "· $950M 라운드(Tiger Global·GV)·밸류 $15B+ — 직전 $10B서 상향\n· 출시(2024.02) 8분기 만에 ARR $150M 돌파 · Bret Taylor 공동창업\n· 단말 관점: 고객 응대 에이전트가 CS 전면 대체 — 기업 단말·콜센터 운영 구조 재편", tag: "Funding", url: "https://techcrunch.com/2026/05/04/sierra-raises-950m-as-the-race-to-own-enterprise-ai-gets-serious/" },
    { date: "2026-06-09", co: "Perplexity", cat: "startup", source: "CNBC / Yahoo Finance", title: "Perplexity, 2028년 IPO 목표 공식화 — OpenAI·Anthropic 상장과 무관하게 추진", summary: "· CEO Aravind Srinivas, 경쟁사 상장 반응과 무관하게 2028년 IPO 추진 공식화\n· 밸류 ~$21B·ARR $500M(2026.04, +335% YoY)·MAU 1억+·기업고객 2만+\n· 단말 관점: AI 검색·에이전트가 단말 기본 브라우징 진입점 노려 — 비서·검색 통합 압박", tag: "IPO", url: "https://www.cnbc.com/2026/06/09/perplexity-ipo-2028-as-anthropic-openai-prepare-listings.html" },
    { date: "2026-06-04", co: "Supabase", cat: "startup", source: "CNBC / TechCrunch", title: "Supabase, Series F $500M — 밸류 $10.5B, '바이브 코딩'이 DB 폭증 견인", summary: "· Series F $500M·밸류 $10.5B(GIC 주도) — 8개월 만에 밸류 2배\n· DB 생성 600% YoY 급증·연초 이후 Claude Code가 최대 기여자 · 누적 조달 $1B+\n· 단말 관점: AI 에이전트가 백엔드·DB를 자동 생성 — 앱 개발 후단 인프라까지 자동화 확산", tag: "Funding", url: "https://www.cnbc.com/2026/06/04/database-startup-supabase-raises-500-million-10point5-billion-valuation.html" },
    { date: "2026-06-03", co: "Suno", cat: "startup", source: "Variety / TechCrunch", title: "Suno, Series D $400M — 밸류 $5.4B로 2배 급등, 소송 속 AI 음악 1위", summary: "· Series D $400M·밸류 $5.4B(Bond Capital 주도) — 2025.11 $2.45B서 2배\n· 구독자 2M+·ARR $300M · WMG 합의·라이선스(첫 라이선스 모델 준비), UMG·Sony 소송+독립 아티스트 1,800+ 집단소송\n· 단말 관점: 텍스트→완성곡 생성이 단말 오디오 창작 표준 후보 — 저작권 라이선스가 상용화 관건", tag: "Funding", url: "https://variety.com/2026/digital/news/ai-music-suno-funding-round-400-million-5-4-billion-valuation-1236765727/" },
    { date: "2026-06-05", co: "Ramp", cat: "startup", source: "Crunchbase News / Bloomberg", title: "Ramp, $750M 조달 — 밸류 $44B, AI 자동화로 기업 지출관리 급성장", summary: "· $750M 조달·밸류 $44B — AI 에이전트 기반 기업 지출·경비 자동화\n· 송장·영수증·승인 워크플로우를 AI로 자동 처리 · 엔터프라이즈 핀테크 대표주자\n· 단말 관점: 버티컬 업무 에이전트가 기업 SaaS를 대체 — 에이전트 커머스·결제 동선과 연결", tag: "Funding", url: "https://news.crunchbase.com/venture/biggest-funding-rounds-june-5-2026/" },
    { date: "2026-06-16", co: "SpaceX (xAI, Cursor)", cat: "native", source: "CNBC / Bloomberg / Forbes", title: "SpaceX, Cursor $60B 인수 합의 — IPO 직후 AI 코딩 에이전트 M&A 시대", summary: "· SpaceX, IPO 직후 Cursor(Anysphere) $60B 전액 주식 인수 합의(2026 Q3 완료·미성사 시 위약금 $1.5B 현금+$8.5B 컴퓨트=$10B)\n· ARR $2B+·DAU 100만+·총 활성 개발자 400만+·기업 고객 60%(Stripe·Adobe·NVIDIA)\n· 코딩 에이전트가 빅테크 M&A 핵심 타깃 — 단 Cursor 코드 데이터의 Grok 학습 활용 계획에 프라이버시 논란", tag: "M&A", url: "https://www.cnbc.com/2026/06/16/spacex-spcx-cursor-acquisition-ipo.html" },
    { date: "2026-03-23", co: "Perplexity", cat: "startup", source: "Perplexity / CNET", title: "Perplexity Comet 브라우저 전 세계 무료 전환 — ARR $450M+, 크롬과 충돌", summary: "· 2026.03.23 Comet 전 플랫폼 무료 전환($200/월→$0)\n· 1개월 만에 ARR $305M→$450M+(+50%)·연 $656M 목표\n· 에이전트가 탭관리·구매 대행 — 크롬(65% 점유)과 정면 충돌", tag: "Product", url: "https://www.perplexity.ai/hub/blog/comet-is-now-available-to-everyone-worldwide" },
    { date: "2026-06-11", co: "Mistral AI", cat: "startup", source: "Bloomberg / TechCrunch", title: "Mistral AI, $3.5B 라운드 클로즈 — 밸류 $20B, 유럽 최고가 사기업", summary: "· $3.5B 라운드·밸류 $20B 클로즈(직전 $12.8B(€11.7B) 대비 약 2배)\n· ARR $400M+(전년比 20배)·연말 $1B 목표 · $830M 부채로 파리 DC(NVIDIA 13,800칩)\n· EU AI 자주권 기업으로 정부·기업 수요 지속", tag: "Funding", url: "https://thenextweb.com/news/mistral-ai-830m-debt-data-centre-paris" },
    { date: "2026-05-20", co: "Cohere", cat: "startup", source: "CNBC / Cohere", title: "Cohere, ARR $240M 돌파 + Command A+ 오픈소스 — IPO 준비 본격화", summary: "· 2025 ARR $240M(목표 $200M 초과)·QoQ 50%+ — IPO 준비 본격화\n· Command A+ 오픈소스·North Mini Code 에이전트 공개\n· Oracle·Salesforce·SAP 파트너십 — 소버린 엔터프라이즈 AI 포지션", tag: "Earnings", url: "https://www.cnbc.com/2026/02/13/ai-startup-cohere-revenue-ipo.html" },
    { date: "2026-05-20", co: "Stability AI", cat: "startup", source: "Stability AI / CIO", title: "Stability AI, Stable Audio 3.0 + Brand Studio — 엔터프라이즈 전환 가속", summary: "· Stable Audio 3.0 오픈웨이트(최대 6분 음악)·Brand Studio 런칭\n· 신임 CEO Prem Akkaraju + Sean Parker·Eric Schmidt 이사회\n· 2026 추정 매출 $190M — 이미지→오디오·엔터프라이즈로 전환(턴어라운드)", tag: "Product", url: "https://www.cio.com/article/2505518/stability-ai-gets-new-ceo-and-investment-dream-team-to-start-rescue-mission.html" },
    { date: "2026-06-08", co: "Databricks", cat: "startup", source: "CNBC / TechFundingNews", title: "Databricks, ARR 런레이트 $5.4B 돌파 — 밸류 $175B 라운드 협의", summary: "· ARR 런레이트 $5.4B 돌파(이전 $4.8B서 급증)\n· 밸류 $165B~$175B 신규 라운드 협의(7월 완료 전망, 직전 $134B)\n· CEO Ghodsi '2027년 IPO 목표' — 최고가치 미상장 SW 기업", tag: "Funding", url: "https://www.cnbc.com/" },
    { date: "2026-05-06", co: "Scale AI", cat: "startup", source: "Bloomberg / Washington Technology", title: "Scale AI, 국방부 계약 $500M — 8개월 만에 5배 확대", summary: "· 미 국방부 $500M OTA 계약 — 8개월 만에 $100M→$500M(5배)\n· 컴퓨터 비전 ML 운영·GenAI 의사결정 지원·군사 계획(CDAO 주관)\n· '데이터·평가 레이어'로 하이퍼스케일러와 차별화", tag: "Defense", url: "https://www.bloomberg.com/news/articles/2026-05-06/meta-backed-scale-ai-wins-500-million-defense-department-deal" },
    { date: "2026-05-03", co: "Runway", cat: "startup", source: "TechCrunch", title: "Runway Gen-4 출시 — 네이티브 오디오 생성, Adobe Firefly 독점 파트너십", summary: "· Gen-4 출시 — 텍스트·이미지→영상 + 네이티브 오디오·리얼리스틱 물리 엔진\n· TikTok/Reels 수직형 템플릿·하이브리드 파이프라인 API\n· Adobe Firefly에 Gen-4.5 최우선 배포 멀티이어 파트너십", tag: "Product", url: "https://techcrunch.com/2026/05/15/runway-started-by-helping-filmmakers-now-it-wants-to-beat-google-at-ai/" },
    { date: "2026-02-04", co: "ElevenLabs", cat: "startup", source: "CNBC / Reuters", title: "ElevenLabs, 밸류 $11B — AI 음성 생성 시장 1위 굳히기", summary: "· Series D $500M·밸류 $11B(전년比 3배+)·ARR $330M+(Sequoia 주도·NVIDIA 백업)\n· 텍스트→음성 API로 콘텐츠 제작 표준 도구\n· IPO 옵션 검토 중", tag: "Funding", url: "https://www.cnbc.com/2026/02/04/nvidia-backed-ai-startup-elevenlabs-11-billion-valuation.html" },
    { date: "2026-03-25", co: "Harvey", cat: "startup", source: "CNBC / Bloomberg", title: "Harvey AI, $200M 라운드 — 법률 버티컬 AI $11B 밸류 달성", summary: "· Series C $200M·밸류 $11B(Sequoia·GIC) · ARR $190M(5개월 +90%)\n· 변호사 10만 명+·AmLaw 100 과반수 고객\n· 법률 버티컬 AI 리더 — 전문서비스로 확장", tag: "Funding", url: "https://www.cnbc.com/2026/03/25/legal-ai-startup-harvey-raises-200-million-at-11-billion-valuation.html" },
    { date: "2026-02-12", co: "Replit", cat: "startup", source: "Bloomberg / TechCrunch", title: "Replit, ~$400M 라운드 협의 — 밸류 $9B로 약 3배 점프, 코딩 에이전트 본격화", summary: "· ~$400M 신규 라운드로 밸류 약 $9B 협의 — 직전 대비 약 3배 상향\n· Replit Agent로 자연어→앱 빌드·배포 자동화 · ARR $1B 목표 제시\n· 단말 관점: 비개발자도 앱을 만드는 에이전트형 개발 — 단말 앱 생태계 진입장벽 붕괴 신호", tag: "Funding", url: "https://replit.com" },
    { date: "2025-12-15", co: "Lovable", cat: "startup", source: "CNBC / TechCrunch", title: "Lovable, Series B $330M — 밸류 $6.6B, '바이브 코딩' 대장주 부상", summary: "· Series B $330M·밸류 $6.6B — 직전 $1.8B서 급등\n· ARR $200M→$500M(12개월 만에 $1M→$200M 돌파 후 가속)\n· 단말 관점: 프롬프트만으로 동작하는 앱 생성 — 소프트웨어 제작 대중화가 단말 콘텐츠 공급 폭증으로 연결", tag: "Funding", url: "https://lovable.dev" },
    { date: "2026-03-18", co: "Kling AI", cat: "startup", source: "The Information / Bloomberg", title: "Kuaishou, Kling AI 스핀오프 검토 — 밸류 ~$20B·$2B 조달 평가", summary: "· 모회사 Kuaishou가 Kling AI 분사·약 $20B 밸류·$2B 조달 검토\n· ARR $100M(3월)→$240M+(12월) 급증 · 일부 보도 $500M 추정\n· 단말 관점: 고품질 텍스트→영상 생성이 모바일 크리에이터 도구로 직결 — 온디바이스 미디어 수요 견인", tag: "Funding", url: "https://klingai.com" },
    { date: "2026-03-10", co: "Hailuo (MiniMax)", cat: "startup", source: "Bloomberg / The Information", title: "MiniMax, 밸류 $13.7B 도달 — Hailuo로 AI 영상 글로벌 1위권 경쟁", summary: "· MiniMax 밸류 $13.7B — 창업 약 3년 만에 멀티모달로 급성장\n· Hailuo 영상 생성, Kling·Runway와 글로벌 상위권 경쟁 · 텍스트·음성·영상 통합\n· 단말 관점: 저비용 고품질 멀티모달 생성 — 단말 카메라·음성 앱의 생성형 기능 원가 절감 기반", tag: "Market", url: "https://hailuoai.com" },
    { date: "2026-02-26", co: "Synthesia", cat: "startup", source: "Reuters / TechCrunch", title: "Synthesia, 밸류 $2.1B — AI 아바타 영상으로 엔터프라이즈 표준화", summary: "· Series D로 밸류 $2.1B · ARR $100M+ 돌파\n· 대본 입력만으로 다국어 아바타 영상 자동 제작 · 사내 교육·마케팅 채택 확대\n· 단말 관점: 사람·촬영 없는 영상 제작 — 단말 영상 소비·생성 수요를 동시에 키우는 공급원", tag: "Funding", url: "https://www.synthesia.io" },
    { date: "2025-04-15", co: "Midjourney", cat: "startup", source: "The Information / TechCrunch", title: "Midjourney, V7 공개·영상 진입 — 외부 투자 없는 부트스트랩 흑자", summary: "· V7 모델 공개·2025년 영상 생성 진입 · 외부 투자 없이 흑자 운영\n· 추정 매출 $300M+(2024) — 구독 단일 모델로 고마진 유지\n· 단말 관점: 이미지→영상·3D 확장 — 단말 비주얼 생성 품질 기준선을 끌어올리는 레퍼런스", tag: "Product", url: "https://www.midjourney.com" },
    { date: "2025-02-20", co: "Writer", cat: "startup", source: "TechCrunch / Forbes", title: "Writer, 밸류 $1.9B — 자체 모델 Palmyra로 엔터프라이즈 에이전트 공략", summary: "· Series C $200M·밸류 $1.9B · 자체 모델 Palmyra 기반 기업용 생성 AI\n· Fortune 500 다수 고객 · 규제 산업 데이터 거버넌스·컴플라이언스 강점\n· 단말 관점: 기업 규정에 맞춘 온프레미스·전용 모델 수요 — 단말·엣지 AI의 거버넌스 요구와 동일 축", tag: "Funding", url: "https://writer.com" },
    { date: "2025-02-13", co: "Abridge", cat: "startup", source: "CNBC / TechCrunch", title: "Abridge, Series D $250M — 밸류 $2.75B, 의료 음성 AI 병원 도입 급증", summary: "· Series D $250M·밸류 $2.75B · 의사-환자 대화를 실시간 임상 노트로 변환\n· 미국 대형 병원 네트워크 도입 확대 · 의료 행정 부담 절감 대표 사례\n· 단말 관점: 실시간 음성→구조화 텍스트 변환 — 온디바이스 음성 AI의 전문 버티컬 검증 사례", tag: "Funding", url: "https://www.abridge.com" },
    { date: "2025-02-20", co: "Together AI", cat: "startup", source: "Bloomberg / TechCrunch", title: "Together AI, Series B $305M — 밸류 $3.3B, 오픈모델 추론 클라우드", summary: "· Series B $305M·밸류 $3.3B(General Catalyst·NVIDIA 등 참여)\n· 오픈 모델 전용 최적화 추론 스택으로 클라우드 서빙 단가 절감\n· 단말 관점: 오픈 모델 저비용 추론 — 단말이 처리 못 하는 대형 작업의 후방 클라우드 인프라", tag: "Funding", url: "https://www.together.ai" },
    { date: "2024-09-26", co: "Hugging Face", cat: "startup", source: "The Verge / VentureBeat", title: "Hugging Face, 등록 모델 100만 돌파 — 오픈 AI 생태계 사실상 표준", summary: "· 등록 모델 100만+·데이터셋 20만+ — 오픈소스 AI의 깃허브\n· 밸류 $4.5B(Google·NVIDIA·Salesforce 투자) · Transformers 라이브러리 생태계\n· 단말 관점: 경량·오픈 모델 배포의 표준 채널 — 온디바이스용 모델 확보·유통의 1차 관문", tag: "Product", url: "https://huggingface.co" },

    // ── 시장·산업·디바이스(온디바이스 AI 관점) ──
    { date: "2026-06-18", co: "OpenAI", cat: "native", source: "Axios / The Information", title: "OpenAI, 첫 AI 디바이스 출시 채비 — Jony Ive 협업·스크린리스 기기, Foxconn 4~5천만 대", summary: "· Meta 리얼리티랩스(Quest·AI 글라스) 통신 총괄 Ha Thai 영입 — 디바이스 통신 VP\n· Jony Ive의 io/LoveFrom 협업 스크린리스·음성 중심 기기 · 연내 공개 목표(2027 지연설)·Foxconn 첫해 4~5천만 대 계획\n· 단말 관점: AI 네이티브 단말이 스마트폰·웨어러블에 새 폼팩터 경쟁축 추가 — '화면 없는 AI'가 핵심 실험", tag: "Device", url: "https://www.axios.com/2026/06/18/openai-devices-ha-thai" },
    { date: "2025-03-11", co: "OpenAI", cat: "native", source: "OpenAI", title: "OpenAI, 에이전트 구축 도구 공개 — Responses API·Computer Use·Agents SDK", summary: "· 에이전트를 '사용자를 대신해 독립적으로 작업을 수행하는 시스템'으로 정의 · Responses API·Web/File Search·Computer Use·Agents SDK 공개\n· Computer Use 모델 성공률 WebVoyager 87%·WebArena 58.1%·OSWorld 38.1% — OpenAI도 실수 가능성·휴먼 감독 필요성 명시\n· 모바일 에이전트 UX 시사점: 완전 자동화보다 사용자 승인형·작업 로그·취소/복구·민감 작업 차단이 핵심", tag: "Agent", url: "https://openai.com/index/new-tools-for-building-agents/" },
    { date: "2026-06-09", co: "Apple", cat: "bigtech", source: "Reuters / Morgan Stanley", title: "Morgan Stanley, 노후 기기가 Apple Siri AI 발목 — 8.5억대 처리 제약", summary: "· iPhone 8.5억대+ 기본 Apple Intelligence 쿼리 처리 곤란 · 13억대+는 고급 Siri 기능 사용 난망\n· 고급 Siri에 12GB 통합 메모리 필요 가능성 — 하드웨어 병목 지적\n· 시사점: 온디바이스 AI는 메모리·SoC 사양이 곧 기능 격차 → 교체수요·프리미엄 전환의 핵심 변수", tag: "Analysis", url: "https://www.reuters.com/business/apples-ai-siri-will-be-held-back-by-aging-devices-morgan-stanley-says-2026-06-09/" },
    { date: "2026-05-15", co: "Apple", cat: "bigtech", source: "Financial Times / IDC", title: "FT·IDC, 생성형 AI 스마트폰 2028년 시장 70%까지 — 폴더블은 2% 미만", summary: "· IDC 전망: 생성형 AI 스마트폰 2028년 전체의 ~70% · 2026년부터 중가 제품군 확산이 관건\n· 폴더블은 전체 출하량 2% 미만 · 평균 판매가격 ~$1,400 수준\n· 시사점: 'AI 침투율'과 '실제 교체수요·프리미엄 전환율'은 분리 필요 — AI 탑재=판매 증가라는 단정은 위험", tag: "Market", url: "https://www.ft.com/content/8b806d9d-1fb6-462e-ba6a-ea357e6357e5" },
    { date: "2026-06-12", co: "", cat: "bigtech", source: "Financial Times", title: "FT, KPMG 'AI 환각' 의심 보고서 철회 — 사례·출처 오류", summary: "· KPMG, AI 환각으로 보이는 잘못된 사례·출처가 포함된 agentic AI 보고서 철회\n· UBS·NHS·스위스연방철도·Transport for London 등이 언급된 사례 부인\n· 시사점: 모든 수치·전망·사례에 소스 등급·검증일·공식/추정/보도 구분의 '팩트체크 레이어' 필요", tag: "Governance", url: "https://www.ft.com/content/b3828e92-4961-4b39-84f0-c42f33be3c3f" },
  ];

  /* ---- Reports (industry reports) ---- */
  const REPORTS = [
    { house: "Grand View Research", type: "Market", date: "2026-03-15", title: "글로벌 AI 시장 2025 $390.9B → 2026E $539.5B → 2030E $1,812B", figure: "$390.9B → $1,812B", rating: "Report", url: "https://www.grandviewresearch.com/industry-analysis/artificial-intelligence-ai-market",
      bullets: ["최신판: 2025년 $390.9B · 2026E $539.5B (구판 2024 $279.22B 기준에서 상향)", "2030E $1,811.75B · CAGR ~35% (기준연도에 따라 30.6~36.6%)", "GenAI 세그먼트 최고 성장률 · BFSI·헬스케어 채택 선도 · 북미 최대 시장"] },
    { house: "KPMG Venture Pulse", type: "Market", date: "2026-04-15", title: "Q1 2026 글로벌 VC $330.9B 신기록 — AI가 미국 VC의 73% 차지", figure: "Q1 $330.9B", rating: "Report", url: "https://kpmg.com/xx/en/media/press-releases/2026/04/global-vc-investment-surges-to-record-330-9-billion-dollar-in-q1-26.html",
      bullets: ["Q1 2026 글로벌 VC $330.9B — 분기 신기록", "미국 $267.2B · OpenAI·Anthropic·xAI 메가딜 주도", "AI가 글로벌 VC의 61%, 미국 VC의 73% 차지", "신규 유니콘 중 26%가 AI 기업"] },
    { house: "Gartner", type: "Market", date: "2026-03-10", title: "agentic AI 지출 2026 $201.9B(+141% YoY) — 2026말 엔터프라이즈 앱 40%에 에이전트 내장", figure: "$201.9B 지출", rating: "Report", url: "https://www.gartner.com/en/newsroom",
      bullets: ["[Gartner] 2026 agentic AI 지출 $201.9B(+141% YoY) · 2027년 챗봇·어시스턴트 지출 추월 전망", "[Gartner] 2026년 말 엔터프라이즈 앱 40%에 에이전트 내장(2025년 <5%에서)", "[Gartner] 2028년 엔터프라이즈 SW 33%에 agentic AI 포함 · 일상 업무 의사결정 15% 자율", "독립 시장조사: 에이전트 시장 $8.8~12.1B(2026)→$33.9~53.2B(2030~32) · 프로젝트 40%+ 2027년까지 취소 경고"] },
    { house: "Goldman Sachs", type: "Securities", date: "2026-02-10", title: "AI 인프라 투자: 2025~2028 글로벌 $1T+ 전망, 전력이 핵심 병목", figure: "$1T+ 인프라 투자", rating: "Overweight", url: "https://www.goldmansachs.com/insights/articles/ai-investment-forecast-2025",
      bullets: ["글로벌 AI 인프라 투자 2025~2028 누적 $1T+", "데이터센터 건설 CAPEX 연 $200B+", "전력 확충이 반도체보다 핵심 병목으로 부상"] },
    { house: "Goldman Sachs Research", type: "Securities", date: "2026-01-15", title: "AI 자동화 2026 — 전 세계 3억 명 일자리 노출, '고용 없는 성장' 경고", figure: "3억 명 노출", rating: "Report", url: "https://www.goldmansachs.com/insights/",
      bullets: ["전 세계 3억 명 풀타임 등가 일자리 AI 노출", "선진국 60% 직종이 자동화에 일부 노출", "2026년 2,500만 → 2030년 2.7억 대체 추정", "AI 신규 직종으로 순 고용 효과는 중립~플러스"] },
    { house: "CB Insights", type: "Market", date: "2026-04-15", title: "State of AI Q1 2026 — 펀딩 메가라운드 집중·유니콘 신규 탄생", figure: "Q1 메가라운드 65%", rating: "Report", url: "https://www.cbinsights.com/research/report/ai-trends-q1-2026/",
      bullets: ["Q1 2026 AI 펀딩 메가라운드 비중 65%", "AI 스타트업 유니콘 다수 신규 탄생", "엔터프라이즈 AI 도입률 상승세 지속"] },
    { house: "Stanford HAI", type: "Research", date: "2026-04-01", title: "AI Index 2026 — 조직 AI 도입 88%·생성형 AI 인구 도입 53%, 그러나 신뢰성 격차", figure: "도입 88% · GenAI 53%", rating: "Report", url: "https://hai.stanford.edu/ai-index/2026-ai-index-report",
      bullets: ["2025년 조직 AI 도입 88% · 생성형 AI 인구 기준 도입 53%", "AI 에이전트 OSWorld 벤치마크 ~12%→66% 개선 · 구조화 과제의 ~1/3은 여전히 실패", "capability-reliability gap — 'AI 성능 고도화'와 '신뢰성 부족'을 동시에 추적 필요"] },
    { house: "McKinsey", type: "Survey", date: "2025-05-01", title: "State of AI 2025 — 기업 88% AI 사용하나 2/3는 미완의 엔터프라이즈 스케일", figure: "도입 88% · 스케일 1/3", rating: "Report", url: "https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai",
      bullets: ["기업 88%가 최소 1개 기능에서 AI 사용 · ~2/3는 아직 엔터프라이즈 스케일 미진입", "62%가 AI 에이전트 실험 중 · 23%만 일부 스케일 단계서 agentic AI 운영", "도입률만이 아닌 pilot·scale·EBIT 임팩트·워크플로 재설계 단계로 구분 필요"] },
    { house: "Gartner (Reuters)", type: "Research", date: "2025-06-25", title: "agentic AI 프로젝트 40%+ 2027년까지 중단 — '에이전트 워싱' 경고", figure: "40%+ 중단", rating: "Caution", url: "https://www.reuters.com/business/over-40-agentic-ai-projects-will-be-scrapped-by-2027-gartner-says-2025-06-25/",
      bullets: ["2027년 말까지 agentic AI 프로젝트 40%+ 중단 가능 — 비용·불명확한 가치·리스크", "2028년 기업 SW 33%에 agentic AI 포함 · 일상 업무 의사결정 15% 에이전트 자율 수행 전망", "'에이전트 대세' 단정 금물 — agent washing·실패율·승인형 실행·거버넌스 리스크 병기"] },
    { house: "Bridgewater (Reuters)", type: "Securities", date: "2026-02-23", title: "빅테크 2026 AI 인프라 투자 ~$650B 전망 (빅4+공급사 전체; 하이퍼스케일러 4사 단독은 ~$350~380B)", figure: "$650B(범위 주의)", rating: "Report", url: "https://www.reuters.com/business/big-tech-invest-about-650-billion-ai-2026-bridgewater-says-2026-02-23/",
      bullets: ["Alphabet·Amazon·Meta·Microsoft 등 AI 인프라 투자 2025 ~$410B → 2026 ~$650B", "클라우드 AI 비용·컴퓨트 부족·메모리 수요가 모바일·PC BOM과 서비스 원가에 직접 영향", "온디바이스 AI는 프라이버시 전략이자 클라우드 비용·공급망 리스크를 줄이는 원가 전략"] },
  ];

  /* ---- Market Growth (global AI market size $B) — Grand View Research 최신판 ----
     2024 $279.22B(구판 실측) → 2025 $390.9B → 2026E $539.5B → 2030E $1,811.75B. CAGR ~35% (기준연도 명시). ---- */
  const MARKET_GROWTH = [
    { year: "2024", size: 279, growth: 42, src: "Grand View Research 구판 (2024 $279.22B 실측)" },
    { year: "2025", size: 391, growth: 40, src: "Grand View Research 최신판 (2025 $390.9B)" },
    { year: "2026E", size: 540, growth: 38, src: "Grand View Research 최신판 (2026E $539.5B)" },
    { year: "2027E", size: 731, growth: 35, src: "Grand View Research 최신판 전망" },
    { year: "2028E", size: 991, growth: 35, src: "Grand View Research 최신판 전망" },
    { year: "2029E", size: 1342, growth: 35, src: "Grand View Research 최신판 전망" },
    { year: "2030E", size: 1812, growth: 35, src: "Grand View Research 최신판 (2030E $1,811.75B)" },
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
    { name: "Anthropic", value: 965, cat: "native", src: "Series H $65B·$965B post (2026.05.28)" },
    { name: "OpenAI", value: 852, cat: "native", src: "2026.03 확정 $730B pre + $122B 신규(post $852B)" },
    { name: "SpaceX (xAI, Cursor)", value: 230, cat: "native", src: "xAI Series E '26.1 밸류 $230B+ · Cursor 인수 $60B" },
    { name: "Databricks", value: 134, cat: "startup", src: "Series L '26.2 $134B ($175B 협의)" },
    { name: "DeepSeek", value: 55, cat: "startup", src: "Reuters '26.5 $52B~59B" },
    { name: "Mistral AI", value: 20, cat: "startup", src: "$3.5B 라운드·밸류 $20B 클로즈 (2026.06)" },
    { name: "Perplexity", value: 20, cat: "startup", src: "'25.09 Series E-6 $20B post(보도 추정 $21B+)" },
    { name: "Scale AI", value: 14, cat: "startup", src: "Forbes '24.05 $14B" },
    { name: "ElevenLabs", value: 11, cat: "startup", src: "CNBC '26.2 Series D $11B" },
    { name: "Harvey", value: 11, cat: "startup", src: "'26.3 Series C $11B" },
    { name: "Sierra AI", value: 15, cat: "startup", src: "$950M 라운드 '26.05 밸류 $15B+" },
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
    { name: "ChatGPT(주간 활성)", value: 900, cat: "native", src: "OpenAI 2026.02 WAU 900M+" },
    { name: "Gemini 앱(MAU)", value: 900, cat: "bigtech", src: "Google I/O 2026 MAU 900M+" },
    { name: "Meta AI(제품 MAU)", value: 1200, cat: "bigtech", src: "Meta AI 제품 1.2B (Q1 2026 IR, 앱군 Family DAP 35억과 구분)" },
    { name: "X+Grok(합산 도달)", value: 600, cat: "native", src: "xAI Series E — X+Grok combined reach ~600M (Grok 단독 아님)" },
    { name: "GitHub Copilot", value: 200, cat: "bigtech", src: "Microsoft '26.4 (Copilot 좌석 2,000만 별도)" },
    { name: "DeepSeek", value: 150, cat: "startup", src: "[업계 추정] '26.4" },
    { name: "Perplexity", value: 100, cat: "startup", src: "Perplexity 공식 '26.3" },
    { name: "Claude", value: 90, cat: "native", src: "[업계 추정] Anthropic '26.5" },
  ];

  /* ---- AI Service Pricing Tiers ($/월) ---- */
  const BAND_PRICE = [
    { name: "Free (무료 티어)", value: 0, cat: "native", src: "ChatGPT Free / Claude Free / Gemini Free" },
    { name: "Pro (개인 구독)", value: 20, cat: "native", src: "ChatGPT Plus $20/월, Claude Pro $20/월" },
    { name: "Enterprise (기업)", value: 60, cat: "bigtech", src: "ChatGPT Enterprise ~$60/사용자/월" },
    { name: "API (1M 토큰 기준)", value: 15, cat: "native", src: "GPT-4o $2.5~$15/1M토큰, Claude $3~$15" },
  ];

  /* ---- Quarterly AI Funding ($B) ---- */
  // 시간 역순(최신 분기 우선) — 가로 막대 차트에서 위→아래로 최근→과거
  const FUNDING_TREND = [
    { name: "Q1 2026", value: 18.9, cat: "native", src: "CB Insights '26 (KPMG 기준 총 VC는 $330.9B)" },
    { name: "Q4 2025", value: 18.2, cat: "native", src: "CB Insights State of AI Q4'25" },
    { name: "Q3 2025", value: 17.4, cat: "native", src: "CB Insights State of AI Q3'25" },
    { name: "Q2 2025", value: 16.1, cat: "native", src: "CB Insights State of AI Q2'25" },
    { name: "Q1 2025", value: 15.6, cat: "native", src: "CB Insights State of AI Q1'25" },
    { name: "Q4 2024", value: 14.3, cat: "native", src: "CB Insights State of AI Q4'24" },
    { name: "Q3 2024", value: 11.8, cat: "native", src: "CB Insights State of AI Q3'24" },
    { name: "Q2 2024", value: 10.2, cat: "native", src: "CB Insights State of AI Q2'24" },
    { name: "Q1 2024", value: 8.5, cat: "native", src: "CB Insights State of AI Q1'24" },
  ];

  /* ---- Major AI Deals/Acquisitions (share %) ---- */
  const AI_DEALS = [
    { cat: "native", label: "LLM/GenAI 투자", value: 45, src: "CB Insights Q1'26 — GenAI 투자 비중 45%" },
    { cat: "bigtech", label: "AI 인프라/칩", value: 25, src: "CB Insights Q1'26 — 컴퓨트 인프라 25%" },
    { cat: "startup", label: "엔터프라이즈 AI", value: 18, src: "CB Insights Q1'26 — 기업용 AI 18%" },
    { cat: "startup", label: "기타 AI 버티컬", value: 12, src: "CB Insights Q1'26 — 기타 12%" },
  ];

  /* ---- Top AI Companies by Revenue/ARR ($B) ---- */
  // seg: hw=AI 하드웨어(칩) 매출 / sw=AI 소프트웨어·서비스(모델·클라우드·앱) 매출 — 척도가 달라 분리 표기
  const REVENUE = [
    { name: "NVIDIA (FY26 연)", value: 215.9, seg: "hw", cat: "bigtech", src: "NVIDIA FY2026 연매출 $215.9B (FY25 $130.5B와 구분)" },
    { name: "Anthropic (run-rate)", value: 47.0, seg: "sw", cat: "native", src: "run-rate $47B (Series H 공식 발표문 2026.05.28) — OpenAI ARR 추월" },
    { name: "Microsoft AI (런레이트)", value: 37.0, seg: "sw", cat: "bigtech", src: "Microsoft IR FY26 Q3 — $37B(+123%)" },
    { name: "OpenAI (연환산)", value: 24.0, seg: "sw", cat: "native", src: "월 매출 ~$2B = 연환산 $24B+ (2026.02) · Q1 실매출 $5.7B" },
    { name: "AWS AI (추정)", value: 14.0, seg: "sw", cat: "bigtech", src: "[업계 추정] AWS Bedrock + AI 서비스 ARR" },
    { name: "Databricks (ARR)", value: 5.4, seg: "sw", cat: "startup", src: "Databricks ARR $5.4B 런레이트 (2026.06)" },
    { name: "Cursor(SpaceX) ARR", value: 4.0, seg: "sw", cat: "native", src: "ARR $2B+(2026.02) → ~$4B 현재·연말 $6B 전망 (Oppenheimer '26.06.18)" },
    { name: "Scale AI (ARR)", value: 1.4, seg: "sw", cat: "startup", src: "Forbes '25 ARR $1.4B 추정" },
  ];

  /* ---- AI Business Models ---- */
  /* ---- AI Monetization Tracker — 모델별 토큰 단가 & 단말 원가 영향 ---- */
  const TOKEN_PRICING = [
    { tier: "Flagship", model: "GPT-5.5", io: "$5 / $30", cost: "클라우드 최고비용 — 핵심 기능만 선별 호출, 온디바이스 대체 시 절감 폭 가장 큼", tone: "native" },
    { tier: "Flagship", model: "Claude Opus 4.8", io: "$5 / $25", cost: "고난도 에이전트·코딩용 — 프리미엄 기능 한정 적용", tone: "native" },
    { tier: "Mid", model: "Claude Sonnet 4.6", io: "$3 / $15", cost: "일상 어시스턴트 기본값 후보 — 품질/원가 균형", tone: "native" },
    { tier: "Mid", model: "GPT-5.4", io: "$2.50 / $15", cost: "범용 클라우드 폴백 — 비용/품질 균형점", tone: "native" },
    { tier: "Economy", model: "Gemini Flash-Lite", io: "$0.25 / —", cost: "대량 요약·분류·번역 — 사실상 무료 수준, 온디바이스 무료화와 결합", tone: "bigtech" },
  ];

  /* ---- 수익화 프라이싱 모델 트래커 (5종) — '누가 얼마에 파는가' ---- */
  const PRICING_MODELS = [
    { model: "순수 사용량 기반", players: "OpenAI · Anthropic", price: "토큰당 과금 $0.25~$75 / 1M", note: "API 파트너십 비용 예측 기준", tone: "native" },
    { model: "하이브리드(구독+사용량)", players: "Databricks · Snowflake", price: "월정액 + 사용량", note: "온디바이스 AI 구독 티어 설계 참조", tone: "bigtech" },
    { model: "성과 기반(outcome)", players: "Intercom Fin · Zendesk AI", price: "$0.99 / 해결건", note: "기능 단위 과금 모델 후보", tone: "startup" },
    { model: "시트 기반(seat)", players: "Microsoft Copilot · Notion AI", price: "인당 월 $20~$60", note: "B2B 단말 번들 참조", tone: "bigtech" },
    { model: "크레딧 번들", players: "Midjourney · ElevenLabs", price: "선불 크레딧", note: "AI 포인트 생태계 설계", tone: "startup" },
  ];

  const BIZ_MODELS = [
    { name: "API 사용량 과금", cat: "native", model: "API Usage-based", pricing: "토큰당 과금($0.25~$75/1M)", sub: "무료 티어 + 사용량 과금", revenue: "OpenAI 연환산 $25B+, Anthropic 연환산 $30B+", margin: "비공개", arpu: "기업당 $10K~$10M+/yr", retention: "높음(기술 의존성)", moat: "모델 성능 + 개발자 생태계 + 안전성 프레임워크", strategy: "모델 성능 경쟁 + 엔터프라이즈 침투 + 구독 병행", src: "OpenAI/Anthropic 공식 가격표" },
    { name: "SaaS 구독", cat: "bigtech", model: "SaaS Subscription", pricing: "$20~$60/사용자/월", sub: "Copilot Pro/Business/Enterprise", revenue: "Microsoft AI $37B 런레이트, Copilot 좌석 15M→20M(+33% QoQ·보급률 ~4.4%)", margin: "높음(80%+ 추정)", arpu: "$240~$720/yr", retention: "매우 높음(Office 번들)", moat: "Office/Windows/Teams 락인 + OpenAI 파트너", strategy: "Copilot 전 영역 통합 + 워크플로우 AI 표준화", src: "Microsoft IR FY26 Q3" },
    { name: "오픈소스+엔터프라이즈", cat: "bigtech", model: "Open Source + Enterprise", pricing: "오픈 가중치 무료 + 광고/엔터프라이즈", sub: "Llama 무료 + Meta AI 광고", revenue: "Meta AI 광고 기여 $20B+ 추정", margin: "광고 기반 고마진", arpu: "광고주 기반", retention: "개발자 생태계 락인", moat: "30억 앱 사용자 + 가장 넓은 오픈소스 분포", strategy: "오픈 Llama로 생태계 확장 + AI 광고 최적화", src: "Meta IR '26, Llama 배포 통계" },
    { name: "하드웨어+클라우드", cat: "bigtech", model: "Hardware + Cloud", pricing: "B200 $30K~$50K · DGX Cloud 시간당 과금", sub: "GPU 판매 + DGX Cloud + CUDA 무료", revenue: "NVIDIA $215.9B(FY26 연), 분기 $57B", margin: "~78% 데이터센터 마진", arpu: "기업당 $1M~$10B+/yr", retention: "CUDA 7.5M+·CUDA-X 1M+ 개발자 락인", moat: "GPU 80%+ 점유 + CUDA 생태계 + 풀스택", strategy: "B200 램프 + DGX Cloud + Omniverse", src: "NVIDIA IR FY2026" },
    { name: "버티컬 AI 에이전트", cat: "startup", model: "Vertical AI Agent", pricing: "시트/사용량 구독 + 성과 기반", sub: "산업별 전문 에이전트 구독", revenue: "Harvey $190M, Sierra $150M, Glean $200M+ ARR", margin: "SaaS형 고마진 지향", arpu: "기업당 $10K~$1M+/yr", retention: "워크플로우 내재화로 높음", moat: "도메인 데이터 + 업무 통합 + 규제 신뢰", strategy: "특정 산업 전문화로 수평 LLM과 차별화(ARR 배수 최대 67x)", src: "AgentMarketCap '26, 각사 공식" },
  ];

  /* ---- KPI Cards (6) ---- */
  /* ---- Executive Top-line: 현상 → 의사결정 (온디바이스 AI 단말 사업 임원 관점, 사명 비표기) ---- */
  const TOPLINE = [
    { tag: "어시스턴트 전장", tone: "warn", nav: "bigtech",
      now: "Gemini 앱 MAU 900M+ · Apple, Siri를 'Siri AI'로 재설계 · Perplexity Comet $200/월→전면 무료 전환",
      cause: "AI 비서가 단말의 입력·앱 트래픽·데이터를 좌우하는 'OS 위의 새 관문'이 됨 → 비서를 쥔 쪽이 단말 경험·수익 동선을 통제",
      decision: "폰의 '기본 비서' 자리가 단말 차별화의 핵심 전장 — 자사 기본 어시스턴트 노선(파트너 심화 vs 자체 vs 멀티)을 지금 확정해야 함" },
    { tag: "온디바이스 스펙 경쟁", tone: "signal", nav: "bigtech",
      now: "Morgan Stanley: 구형 iPhone 8.5억대가 메모리 한계로 온디바이스 AI 구동 곤란(고급 비서엔 12GB) · IDC: 생성형 AI 폰 2028년 70%",
      cause: "고급 AI 추론에 메모리·NPU가 필수 → AI 성능이 하드웨어 사양에 직접 종속되고 구형 단말은 구조적으로 배제됨",
      decision: "AI 기능 = 하드웨어 스펙 = 프리미엄 전환·교체수요 동력 — 단 'AI 탑재=판매 증가'는 단정 금물(침투율과 실제 교체수요는 분리)" },
    { tag: "수익화 분기", tone: "revenue", nav: "bizmodel",
      now: "Perplexity는 구독 버리고 광고·에이전트 커머스로 · OpenAI는 구독+API지만 Q1 마진 -122% · 버티컬은 ARR 배수 67배",
      cause: "추론 단가가 3년 150배 급락 → 'AI 기능=무료' 압력이 커지며 '어디서 돈을 받는가'의 과금 모델 자체가 흔들림",
      decision: "무료로 푸는 온디바이스 AI 기능의 과금 노선(구독 유료화 vs 단말 가격 프리미엄 vs 커머스 수수료) 결정이 임박" },
    { tag: "에이전트 UX", tone: "compete", nav: "signals",
      now: "Computer Use·Deep Research·Comet이 탭 관리·구매 대행까지 자동화 · 그러나 자율 성공률 OSWorld 66%서 정체·구조화 과제 1/3 실패",
      cause: "성능(capability)은 빠르게 오르지만 자율 신뢰성(reliability)이 못 따라감 → 완전 자동화 시 오작동·책임·복구 비용이 폭증",
      decision: "온디바이스 에이전트는 완전 자동화가 아니라 승인형·작업 로그·취소/복구 설계가 정답 — 자사 에이전트 UX 원칙으로 못박을 것" },
  ];

  const KPIS = [
    { label: "글로벌 AI 시장 (2025)", value: "$390.9B", delta: +40, sub: "출처: Grand View Research(인프라+모델+앱) · 2026E $539.5B · 2030E $1,812B", fill: 0.74, src: "Grand View Research AI Market Report '26 최신판" },
    { label: "OpenAI 밸류 (2026.03)", value: "$852B", delta: +120, sub: "post-money · 총 조달 $122B 확정 · S-1 제출(공모 목표 미확정)", fill: 0.92, src: "Bloomberg/CNBC 2026.03.31" },
    { label: "Anthropic run-rate", value: "$47B", delta: +188, sub: "Series H 발표문 · 6주 만에 $30B→$47B · OpenAI ARR 추월", fill: 0.98, src: "Anthropic 공식 2026.05.28" },
    { label: "NVIDIA 매출 (FY27 1Q)", value: "$81.6B", delta: +85, sub: "+85% YoY · DC $75.2B(+92%) · Q2 가이던스 $91B", fill: 0.90, src: "NVIDIA IR 2026.05.20" },
    { label: "Microsoft AI 런레이트", value: "$37B", delta: +123, sub: "Copilot 15M→20M(+33% QoQ) · Azure 40% 재가속", fill: 0.78, src: "Microsoft IR FY26 Q3" },
    { label: "ChatGPT 활성 사용자", value: "WAU 905M / MAU 11억+", delta: +60, sub: "WAU 2월 920M 정점 후 정체 · MAU 11억+(Sensor Tower) — WAU/MAU 모수 구분 필요 · 어시스턴트 점유율 46.4%(Gemini 27.7%·Claude 10.3%)", fill: 0.80, src: "OpenAI '26.02 / Sensor Tower '26.06" },
  ];

  /* ---- Insight Cards ---- */
  const INSIGHTS = [
    { title: "OpenAI 하드웨어 직접 진입 — 'AI 네이티브 단말'이 새 경쟁축", desc: "OpenAI가 Jony Ive의 io(인수가 $6.4B)·LoveFrom과 첫 디바이스를 준비 — 화면 없는(스크린리스) 음성·주변(ambient) 중심 기기로, 중독성을 줄이는 'no-screen' 철학이 핵심. Meta 리얼리티랩스 통신 총괄 Ha Thai 영입(2026.06.18)으로 출시 채비 가속, Foxconn 첫해 4~5천만 대 생산 계획(미국·베트남 제조)·연내 공개 목표나 2027 지연설. 단말 관점: 모델 1위 기업이 단말까지 수직 통합하면 'AI 비서=별도 기기' 노선이 스마트폰·웨어러블 폼팩터에 정면 도전 — 제조사는 화면형 단말의 차별화 논리를 재정의해야", icon: "device", src: "Axios/The Information '26.06, TrendForce" },
    { title: "모델사 '자체 추론칩' 시대 — OpenAI Jalapeño로 NVIDIA 의존 축소", desc: "2026.06.24 OpenAI·Broadcom이 LLM 추론 전용 첫 커스텀 ASIC 'Jalapeño'를 공개 — 설계→테이프아웃 9개월(업계 최단 추정), 전력효율 현 최첨단 대비 우위 주장, 2026년 말 초기 배포. OpenAI는 io 디바이스·Stargate 데이터센터에 이어 추론칩까지 '풀스택' 수직통합. Google(TPU)·Amazon(Trainium)·Anthropic(Broadcom TPU 3.5GW)도 동일 방향 — NVIDIA 80%+ 점유에 균열. 단말 관점: 추론 단가·전력이 핵심 경쟁 변수로 — 클라우드 추론 원가 하락이 온디바이스/하이브리드 분기점을 좌우", icon: "chip", src: "OpenAI/TechCrunch '26.06.24" },
    { title: "AI 모델 거버넌스 분수령 — 美 정부, GPT-5.6 출시 첫 사전 제한", desc: "2026.06.25 미 정부(국가사이버국장실·OSTP)가 OpenAI에 GPT-5.6의 단계적 출시를 보안 우려로 요청, OpenAI 수용 — 프리뷰 기간 정부가 고객별로 접근 승인. 'Mythos급' 능력을 이유로, 미 정부가 출시 전 프런티어 모델을 선제 제한한 첫 사례. 향후 모든 프런티어 모델의 표준이 될 가능성. 단말 관점: 고성능 모델의 배포·접근 통제가 강화되면 단말 탑재 모델도 규제·승인·지역 제한 변수가 커짐 — '모델 가용성'이 곧 사업 리스크", icon: "report", src: "The Information/Axios '26.06.25" },
    { title: "에이전트 커머스 개막 — Visa, ChatGPT에 결제망 직접 연동", desc: "2026.06.10 Visa가 결제망을 ChatGPT에 내장 — AI 에이전트가 카드 연결로 추천부터 결제까지 대행(지출한도·승인단계·승인 가맹점 가드레일, 초기 건별 승인). Agentic AI가 '대화'를 넘어 '실거래'로 진입한 첫 주요 사례. 단말 관점 시사점: 온디바이스 비서가 결제·커머스 동선을 쥐면 '커머스 수수료'가 새 수익원 — 단, 결제는 고위험이라 승인형 UX·권한 분리가 필수", icon: "spark", src: "Visa Payments Forum '26.06.10, AP/Axios" },
    { title: "AI 어시스턴트 '3파전' 고착 — ChatGPT 첫 50% 이하", desc: "2026.05 ChatGPT AI 어시스턴트 점유율 46.4%로 첫 50% 붕괴(2024.12 65.3%→2025.12 52.8%→2026.05 46.4%). Gemini 27.7%·Claude 10.3%(반년 새 4배). 단 ChatGPT MAU는 11.1억으로 1위 유지 — 점유율↓과 절대 사용자↑는 분리해서 봐야. 단말 비서 파트너 선택이 OpenAI·Google·Anthropic 3파전 구도에서 핵심 변수", icon: "pulse", src: "TechCrunch/Fast Company '26.06.16" },
    { title: "Claude '효율 1위' — MAU 245M·유료 전환율 13%로 ChatGPT 2배", desc: "Sensor Tower 2026 State of AI(2026.06): Claude MAU 245M(+400% YoY 수준)·유료 전환율 13%로 ChatGPT(~6%)의 2배 이상 — 사용자 수는 적어도 '수익화 효율'은 최상위. ChatGPT MAU 11억+·Gemini 662M(앱 기준)과 모수·방법론 차이 병존. 어시스턴트 점유율은 ChatGPT 46.4%·Gemini 27.7%·Claude 10.3%. 단말 관점: 단말 비서 파트너는 사용자 규모뿐 아니라 유료 전환·엔터프라이즈 침투 효율로 평가해야", icon: "pulse", src: "Sensor Tower 2026 State of AI '26.06" },
    { title: "AI 앱 수익화 본격화 — H1 2026 지출 $4.2B·ChatGPT 광고 테스트", desc: "Sensor Tower: 2026 상반기 글로벌 AI 앱 다운로드 23억 건·사용자 지출 $4.2B 전망. ChatGPT는 2026.02부터 광고 테스트 시작, 5월 기준 DAU의 17%에 광고 노출 — 구독 일변도에서 광고·커머스로 수익원 다변화. 단말 관점: 온디바이스 비서가 광고·커머스 동선을 쥐면 단말 제조사도 새 수익 풀에 참여 가능 — 단, 프라이버시·신뢰 설계가 전제", icon: "spark", src: "Sensor Tower '26.06" },
    { title: "GenAI 스마트폰 2026 출하 45% — 아젠틱 칩 CAGR 281%", desc: "Counterpoint(2026.06): GenAI 지원 스마트폰이 2026년 전체 출하의 45%(2025년 36%)→2027년 52%. 아젠틱 AI 지원 칩 출하 2025~27 CAGR 281%, 2027년 침투율 32%·프리미엄 폰 80%+가 아젠틱 AI 지원 전망. AI 스마트폰 시장 2026E $140.8B→2034E $387.6B(CAGR 15.2%) — 단말 AI는 '옵션'에서 '프리미엄 표준'으로 이동", icon: "device", src: "Counterpoint Research '26.06, Grand View Research" },
    { title: "단말 기본 비서 '모델 개방' — Apple, Siri에 Gemini·Claude 편입", desc: "2026.06 WWDC에서 Apple이 Siri를 외부 프런티어 모델(Gemini)로 구동하고 멀티 AI 확장으로 Claude를 아이폰 선택지로 최초 편입. 자체 온디바이스 모델은 유지하되 '단일 비서'에서 '모델 선택형'으로 전환 — 단말 제조사의 비서 전략(자체 vs 파트너 vs 멀티)이 핵심 차별화 변수로 확정", icon: "device", src: "Apple WWDC '26.06.08, Fortune/CNBC" },
    { title: "AI 상장 슈퍼사이클 — SpaceX·OpenAI·Anthropic 동시 IPO 레이스", desc: "SpaceX가 2026.06.12 SPCX로 그린슈 포함 최종 $85.7B 조달(사상 최대)·시총 $2.1T 데뷔 후 06.16 ~$2.51T로 급등(미 시총 4위권), 4일 뒤 Cursor를 $60B에 인수. Oppenheimer는 목표주가를 $190→$250(+32%)로 상향. OpenAI($852B·9월 목표)·Anthropic($965B·기밀 제출)도 상장 가세 — AI 자본이 사모에서 공모로 이동하며 밸류 검증 국면 진입", icon: "report", src: "CNBC/Fortune/Oppenheimer '26.06" },
    { title: "OpenAI 수익성 역설 — 밸류 $852B vs 마진 -122%", desc: "OpenAI는 $852B(2026.03) 밸류로 S-1 제출했으나 Q1 GAAP 운영손실 $9.3B·현금소각 $3.7B(매출의 65%)·순손실 $21.3B·Non-GAAP 마진 -122%를 기록. $852B는 2030년 매출 $280B 가정 기반 — 파운데이션 모델(대규모 적자) vs NVIDIA(~75% 마진)의 수익성 스펙트럼 양극단", icon: "pulse", src: "The Information '26.05, Bloomberg" },
    { title: "OpenAI vs Anthropic 재무 구조 — IPO 수익성 검증 국면", desc: "두 IPO 후보의 '실제 수익성' 격차가 공모 핵심 변수로 부상. OpenAI: ARR ~$24B(연환산)·Q1 실매출 $5.7B·Non-GAAP 마진 -122%·현금 $73B+·컴퓨트 약정 $665B·밸류 $852B(09월 목표). Anthropic: run-rate $47B(공식)이나 Q1 실매출 추정 $4.8B(연환산 ~$19B)로 간극 큼·Q2 Non-GAAP 흑자 전망·밸류 $965B. 핵심 리스크 — 두 회사 모두 GAAP 감사 재무 미공개 상태로 공모 진행, OpenAI는 '매출 $1당 $1.22 손실' 구조적 적자, Anthropic은 run-rate 신빙성 — S-1 공개가 실질 밸류 검증 분수령", icon: "pulse", src: "The Information/Bloomberg '26.06" },
    { title: "AI 코딩 에이전트 '3강' — SpaceX·Cursor 인수로 지형 재편", desc: "SpaceX가 Cursor($60B 인수)로 코딩 AI 시장 진입 — GitHub Copilot(Microsoft)·Claude Code(Anthropic)·Grok Build(xAI/SpaceX) 3강 경쟁 본격화. Cursor ARR $2B+(2026.02)→Oppenheimer 현재 ~$4B·연말 $6B 전망, DAU 100만+·총 활성 개발자 400만+·Fortune 500의 60%+ 고객. 인수 위약금 $10B($1.5B 현금+$8.5B 컴퓨트)·Cursor 코드 데이터의 Grok 학습 활용 계획에 프라이버시 논란 — 단말 관점: 자연어→앱 생성이 단말 SW 공급 구조를 바꾸는 변곡점", icon: "spark", src: "CNBC/Reuters '26.06, Oppenheimer" },
    { title: "AI 칩 전쟁 — NVIDIA vs 커스텀 실리콘", desc: "NVIDIA B200이 AI 학습 시장 80%+를 점유하나, Google TPU·Amazon Trainium·Microsoft Maia 등 커스텀 칩이 추격. DeepSeek의 1/10 비용 모델로 효율이 핵심 변수로 부상. TIKR 모델 기준 NVDA 목표주가 $486(현 ~$220 대비 +121%, 20% 매출 CAGR 중간 케이스)·Q1 2026 AI VC 펀딩 $18.9B(CB Insights)로 자본 유입 지속", icon: "chip", src: "Goldman Sachs '26.02, TIKR/CB Insights '26" },
    { title: "AI 에이전트 — 파일럿에서 프로덕션으로", desc: "Gartner: 2026년 말 엔터프라이즈 앱 40%에 task-specific 에이전트 내장(2025년 <5%에서·현재 실제 배포는 17%), 2028년 SW 33%에 agentic AI 포함, 2026 agentic AI 지출 $201.9B(+141% YoY). 단, 프로젝트 40%+는 2027년까지 취소 경고. 독립 시장조사 기준 에이전트 시장은 $8.8~12.1B(2026)→$33.9~53.2B(2030~32)", icon: "spark", src: "Gartner '26 / Reuters '25.6, 독립 시장조사" },
    { title: "버티컬 AI — 모든 산업에 $1B+ 유니콘", desc: "법률(Harvey $11B), 음성(ElevenLabs $11B), 기업검색(Glean $7.2B), 고객서비스(Sierra $15B+) — 수평 LLM 경쟁에서 산업 전문화 AI로 투자 이동. Sierra는 $950M 라운드로 $15B+ 점프", icon: "chart", src: "TechCrunch '26.05, 각사 공식" },
    { title: "오픈소스 vs 클로즈드 — 전략 분기", desc: "Meta Llama·Mistral·DeepSeek 등 오픈 가중치 모델이 도입을 가속하며 클로즈드 모델과 성능 격차 축소. EU AI Act 규제 환경에서 오픈소스 선호도 상승", icon: "chart", src: "Mistral·Meta·DeepSeek 공식, EU AI Act" },
    { title: "Physical AI — AI가 현실 세계로", desc: "Tesla Optimus Gen 3 제한 생산(2026 여름), Figure AI 공장 배포, Waymo 밸류 $126B. 골드만삭스: 2026년 인간형 로봇 5~10만 대 출하·휴머노이드 TAM 2035E $38B(구 $6B서 6배↑, 단가 $4~6만으로 하락). 물리적 AI 전체(자율주행 포함)는 별도 추정 2035E $1.15T — scope 구분", icon: "chip", src: "Goldman Sachs '26, Pomegra '26" },
    { title: "AI 전력 수요 쇼크 — 데이터센터가 전력망을 흔들다", desc: "IEA: 데이터센터 전력 소비 460 TWh는 2022년 수치(2024년은 ~415~490 TWh로 조정) → 2030E ~945 TWh로 수렴(전망 범위는 출처마다 상이). 미국 비중 2023년 4.4% → 2028년 6.7~12%(EIA). 전력 확충이 반도체보다 핵심 병목", icon: "spark", src: "IEA Energy & AI '25, EIA '26" },
    { title: "GenAI ROI — $1 투자 → $3.70 회수", desc: "성숙 AI 기업 평균 ROI $4.60/$1(Accenture), 파일럿 단계 $1.20/$1. 개발자 생산성 +26~40%. 회수기간: 고객서비스 4.1개월·마케팅 6.7개월·엔지니어링 9.3개월. 단 전사 ROI 체감은 29%에 그침", icon: "chart", src: "Accenture '26, McKinsey '26, Futurum '26" },
    { title: "AI 고용 충격 — 3억 명 노출, '고용 없는 성장'", desc: "Goldman Sachs: 전 세계 3억 명 일자리가 AI에 노출, 2026년 2,500만 대체 → 2030년 2.7억. 행정(26%)·고객서비스(20%)가 취약. 다만 신직종 창출로 순 고용 효과는 중립~플러스 전망", icon: "pulse", src: "Goldman Sachs Research '26.01" },
    { title: "NVIDIA, AI PC용 Arm CPU 진입 — 노트북 시장 공략", desc: "NVIDIA가 MediaTek와 공동 개발한 Arm 기반 PC SoC 'N1·N1X'(Blackwell GPU 통합)로 AI PC 노트북·데스크톱에 진입(2026 예상). Apple M·Qualcomm Snapdragon X와 경쟁. AI PC는 2026년 신규 PC 출하의 40%+(Canalys), 2027년 과반 전망. CES 2025 GB10 데스크톱(Project DIGITS)도 공개", icon: "chip", src: "Canalys '26, NVIDIA CES 2025, 업계 보도" },
  ];

  /* ---- 하이퍼스케일러 AI 데이터센터 CapEx (Big 5 합산, $B) ---- */
  const DC_CAPEX = [
    { year: "2024", size: 225, growth: 39, src: "Big 5(MS·Google·Amazon·Meta·Oracle) 공시 합산 추정" },
    { year: "2025", size: 440, growth: 96, src: "Big 5 합산 추정 — 2026년 대비 +36% 증가분의 역산치(Introl)" },
    { year: "2026E", size: 725, growth: 65, src: "Big 5 컨센서스 — Amazon $200B·Alphabet $175~185B·Meta $115~135B·MS $120B+·Oracle $50B" },
    { year: "2027E", size: 950, growth: 31, src: "Moody's — 2027년 $1T 근접 전망" },
  ];

  /* ---- HBM(고대역폭메모리) 시장 규모 — AI 가속기 공급망 최대 병목($B) ---- */
  const HBM_MARKET = [
    { year: "2025", size: 33, growth: 133, src: "Gartner 인용 — 전년比 +130%+ 성장" },
    { year: "2026E", size: 55, growth: 67, src: "BofA 추정 — 전년比 +58%, 공급 대부분 선계약 완료" },
    { year: "2027E", size: 86, growth: 56, src: "Gartner — 2025~2027 CAGR 60.5%" },
  ];

  /* ---- AI 가속기 칩 믹스 — GPU 범용 vs 하이퍼스케일러 커스텀 실리콘(%) ---- */
  const CHIP_MIX = [
    { period: "2024", gpu: 95, custom: 5, note: "커스텀 실리콘 초기 단계 — GPU 절대 우위", src: "업계 추정" },
    { period: "2025", gpu: 88, custom: 12, note: "TPU·Trainium·MTIA 본격 양산 확대", src: "업계 추정" },
    { period: "2026E", gpu: 80, custom: 20, note: "커스텀 ASIC 출하 성장률이 GPU의 약 3배", src: "TechTimes '26.05" },
    { period: "2027E", gpu: 72, custom: 28, note: "OpenAI·Anthropic도 자체 칩 프로그램 합류(Broadcom 설계)", src: "업계 추정" },
  ];

  /* ---- 광통신(Co-Packaged Optics) 데이터센터 침투율(%) — 차세대 인터커넥트 전환 ---- */
  const OPTICAL_TREND = [
    { year: "2025", pen: 2, note: "상용화 초기 — NVIDIA Quantum-X·Broadcom 포트폴리오 발표 단계", src: "IDTechEx" },
    { year: "2026", pen: 10, note: "전환점(inflection point) — NVIDIA·Broadcom 양강 경쟁 본격화", src: "IDTechEx '26" },
    { year: "2028E", pen: 22, note: "5년 내 AI 데이터센터 인터커넥트 대부분이 광통신으로 전환 전망", src: "SemiEngineering" },
    { year: "2030E", pen: 35, note: "전력효율 최대 3.5배 개선 — 소비전력이 GPU 확장의 새 병목으로", src: "IDTechEx — CAGR 34.7%" },
  ];

  /* ---- 하이퍼스케일러 vs AI 네이티브 — 인프라 전략 방향 분기 ---- */
  const INFRA_STRATEGY = {
    hyperscaler: [
      { name: "Google", move: "TPU v7(Ironwood) 자체 설계 + Broadcom 공동 개발", note: "Gemini 수직계열화 + Anthropic에 5GW 컴퓨트 별도 공급 — 자사·파트너 양쪽에 인프라 임대" },
      { name: "Amazon", move: "Trainium 3 자체 칩 + Bedrock 멀티모델 중립 플랫폼", note: "Anthropic에 컴퓨트 $100B+ 약정 — 특정 모델 종속 없이 인프라 임대료로 수익화" },
      { name: "Microsoft", move: "Maia 200 자체 칩 + Azure Fairwater 데이터센터", note: "OpenAI 독점 관계 종료 후에도 인프라 파트너십 유지 — 멀티모델 확장 병행" },
      { name: "Meta", move: "MTIA 자체 칩 + Llama 오픈소스 배포", note: "CapEx $1,150~1,350억 최대 규모 집행에도 Zuckerberg 'AI 에이전트 성과 지연' 인정" },
    ],
    aiNative: [
      { name: "OpenAI", move: "Broadcom 공동 커스텀 ASIC 'Jalapeño' — 첫 자체 추론칩", note: "Microsoft·Oracle·CoreWeave 멀티클라우드 확보 병행 — 특정 인프라 종속 탈피 시도" },
      { name: "Anthropic", move: "자체 칩 없음 — Amazon Trainium + Google TPU 이중 소싱", note: "두 하이퍼스케일러 자본·컴퓨트를 동시 확보해 공급 병목 리스크 분산" },
      { name: "Qualcomm(도전자)", move: "Modular 인수로 소프트웨어 스택 확보(CUDA 비의존 실행)", note: "칩 자체보다 '어떤 실리콘에서도 AI 구동' 소프트웨어 레이어로 진입 — 칩–모델 종속 구도에 균열" },
    ],
  };


  /* ---- Q&A 카테고리(드롭다운 색상 구분) ---- */
  const QA_CATS = [
    { id: 1, name: "판세 읽기", color: "#2E6BFF" },
    { id: 2, name: "모델 경쟁", color: "#9B4DFF" },
    { id: 3, name: "인프라·하드웨어", color: "#00C2A8" },
    { id: 4, name: "응용·에이전트", color: "#FF3D9A" },
    { id: 5, name: "리스크·미래", color: "#FFB02E" },
  ];

  /* ---- Q&A Pairs (Korean) — 5개 카테고리 × 4문항(MECE) ---- */
  const QA_PAIRS = [
    // ── ① 판세 읽기 ──
    { cat: 1, q: "지금 AI 산업 판세를 한 문장으로 요약하면?", a: "한 문장: '모델 성능은 평준화되고, 이제 전쟁터는 에이전트·인프라·규제'입니다.\n\n2026년 상반기 핵심 구도: ① Anthropic이 Series H $65B 조달·밸류 $965B로 OpenAI($852B)를 추월 — ARR도 $47B vs $25B로 2배 격차. ② Claude Fable 5(2026.06.09)가 SWE-bench Verified 95%로 소프트웨어 공학 벤치마크를 지배하고, GPT-5.5(2026.04.22)는 터미널 에이전트·속도에서 우위. ③ OpenAI·Anthropic·SpaceX 모두 IPO 대기열에 올라 'AI 사기업 IPO 파이프라인 $3.6T'(Bloomberg). ④ EU AI Act 2026.08.02 완전 시행으로 규제가 현실이 됐습니다. 함정도 있습니다: OpenAI는 Q1에 $3.7B를 소각했고, 에이전트 프로젝트 40%+가 2027년까지 취소될 것으로 Gartner는 예측합니다 — 밸류에이션과 실제 수익성 사이의 간극이 가장 큰 리스크입니다.", nav: "overview", keywords: ["판세", "요약", "현황", "2026", "한눈에", "전체", "최신"] },
    { cat: 1, q: "AI IPO 레이스 — OpenAI·Anthropic·SpaceX 각각의 상태는?", a: "2026년 6월 현재 역사상 가장 큰 AI IPO 파이프라인이 동시에 움직이고 있습니다.\n\nOpenAI: 2026.06.08 SEC에 S-1 기밀 제출 공식 발표(Goldman Sachs·Morgan Stanley 주관), 2026.09 상장 목표·밸류 최대 $1T — Sam Altman은 내부에 '1년 안에 상장'이라고 말했습니다. 리스크: Q1 2026 순손실 $21.3B·현금소각 $3.7B, $852B 밸류는 '2030년 $280B 매출 시나리오' 기반.\n\nAnthropic: 2026.05.28 이미 S-1 기밀 제출, $965B·ARR $47B로 사모 최강자. 상장 전 마지막 라운드에서 Amazon이 즉시 $5B + 향후 최대 $20B 투자 의사.\n\nSpaceX·xAI: Bloomberg 기준 IPO 파이프라인에 $500B+ 규모로 포함. Cursor(Anysphere) $60B 인수(2026.06.16)로 코딩 AI 생태계 구축 중.\n\n공통 경고: Bloomberg는 'AI IPO 파이프라인 합산 $3.6T'로 보도 — 닷컴 버블 이후 최대 규모의 사기업 상장 러시이며, IPO 이후 밸류 유지 여부는 실제 수익성에 달려 있습니다.", nav: "native", keywords: ["ipo", "상장", "openai", "anthropic", "spacex", "s-1", "공모", "1조", "2026"] },
    { cat: 1, q: "2026년 AI 시장 규모와 투자 현황은?", a: "AI 시장은 레이어별로 성장 속도가 다릅니다 — 인프라(GPU·클라우드)·모델(API)·애플리케이션(SaaS)을 구분해야 합니다.\n\n시장 규모: Grand View Research 기준 2026E $539.5B, 2030E $1,811B(CAGR ~35%). 기관마다 정의 범위가 달라 $279B~$540B가 유통되지만, 모든 기관이 CAGR 30~37%에 동의합니다.\n\n투자 현황: KPMG Q1 2026 글로벌 VC $330.9B(분기 신기록), AI가 미국 VC의 73% 차지. AI 인프라에 2025~2028 누적 $1T+ 투자 예상. 사기업 밸류 합산 OpenAI $852B + Anthropic $965B + SpaceX $500B+ = $3T+.\n\n제조·로봇: 휴머노이드 로봇 시장 현재 $2~3B → 2035년 $200B(Barclays). 2026년 전 세계 출하 5만 대+ 예상(2025년 대비 700%+ 성장). 재미있는 역설: 추론 비용이 3년 만에 150배 하락했지만, 기업 AI 인프라 총지출은 같은 기간 320% 증가했습니다 — '싸질수록 더 쓴다'.", nav: "overview", keywords: ["시장", "규모", "투자", "전망", "390", "330", "vc", "시총", "ipo파이프라인"] },
    { cat: 1, q: "2026년 AI에서 가장 중요한 수치 하나만 고르면?", a: "$47B — Anthropic의 2026.05 ARR입니다. 왜 이 숫자인가:\n\n① 한 달 전 $30B였던 수치가 6주 만에 $47B가 됐습니다. AI가 얼마나 빠르게 실제 수익으로 전환되는지를 보여주는 가장 극적인 데이터입니다.\n② OpenAI ARR $25B의 약 2배 — '안전성'을 앞세운 회사가 소비자 AI 최강자를 수익 기준으로 제쳤습니다.\n③ Claude Code 단독 $2.5B+ ARR — 코딩 AI 하나의 수익이 중견 SaaS 회사 전체와 맞먹습니다.\n④ '밸류에이션은 허수, ARR은 사실'이라는 관점에서, $47B ARR은 $965B 밸류에 대한 가장 강력한 근거입니다.\n\n반론도 있습니다: ARR은 run-rate(현 월 매출×12)이므로 성장이 멈추면 즉시 낮아집니다. Anthropic의 비용 구조(컴퓨트·연구 인력)가 공개되지 않아 실제 수익성은 불명입니다.", nav: "native", keywords: ["중요", "수치", "47", "arr", "anthropic", "openai", "핵심지표"] },
    // ── ② 모델 경쟁 ──
    { cat: 2, q: "GPT-5.5 vs Claude Fable 5 — 지금 뭐가 더 낫나?", a: "2026년 6월 현재 두 모델이 최전선을 분점합니다. 한 줄 결론: '에이전트·속도→GPT-5.5, 코딩·장기 자율작업→Claude Fable 5'.\n\nGPT-5.5(2026.04.22 출시): Terminal-Bench 2.0 82.7%(Claude Opus 4.7의 69.4% 대비 +13p), FrontierMath 51.7%, 같은 작업 대비 72% 적은 토큰 사용. API $5/$30 per 1M 토큰, 1M 컨텍스트.\n\nClaude Fable 5(2026.06.09 출시): SWE-bench Verified 95.0%(GPT-5.5 82.6% 대비 +12p), SWE-Bench Pro 80.3%, Cognition FrontierCode Diamond 29.3%(GPT-5.5의 5.7%보다 5배). Hebbia Finance Benchmark 1위. API $10/$50 per 1M 토큰. 단, 미국 정부 수출 지시로 출시 3일 만에 일시 오프라인 → 현재 복귀.\n\n비교 요약: 코딩 벤치마크·장기 에이전트 자율작업(수 시간~수일)은 Fable 5 우위 / 속도·비용·에이전트 브레드스는 GPT-5.5 우위. 실무적으로는 '둘 다 무료 티어로 먼저 테스트하고 워크플로우에 맞는 쪽 선택'을 권장합니다.", nav: "native", keywords: ["gpt", "gpt-5.5", "claude", "fable", "비교", "벤치마크", "모델", "최신", "2026"] },
    { cat: 2, q: "OpenAI vs Anthropic — 철학과 수익화 전략의 차이는?", a: "같은 기술을 정반대 전략으로 팝니다.\n\nOpenAI: 철학='빠른 배포, 문제는 해결하며 간다.' ChatGPT로 주간 활성 사용자 ~905M 확보, GPT가 일반명사가 됐습니다. 수익화=구독(ChatGPT Plus/Pro)+API+엔터프라이즈. ARR $25B+(2026.02). IPO로 개인 투자자에게 문 열 예정.\n\nAnthropic: 철학='Constitutional AI — AI가 스스로 행동을 평가·수정'. OpenAI 전 연구진 창업, 안전성이 핵심 브랜드. Claude Code·Managed Agents로 개발자/기업 침투. ARR $47B(2026.05) — 의료·법률·금융 등 규제 산업에서 '안전성 프리미엄' 수익화. 상장 전 이미 OpenAI를 매출로 앞질렀습니다.\n\n전략적 포지션: OpenAI=소비자 AI 최강(9억 사용자) / Anthropic=엔터프라이즈 AI 실세(ARR 2배). '누가 이기냐'보다 '어느 시장에서'가 더 정확한 질문입니다. Amazon은 양쪽에 $13B+ 투자해 무승부 포지션을 취합니다.", nav: "native", keywords: ["openai", "anthropic", "claude", "차이", "비교", "철학", "constitutional", "전략"] },
    { cat: 2, q: "DeepSeek가 AI 산업의 상식을 어떻게 깼나?", a: "DeepSeek는 '컴퓨트가 많아야 좋은 AI'라는 10년 간의 상식을 깼습니다.\n\n무슨 일이 있었나(2025.01): R1·V3가 GPT-4급 성능을 훈련·추론 비용 1/10로 구현 → NVIDIA 주가 하루 17% 폭락 → 'AI의 Sputnik Moment'. 혁신의 핵심은 Mixture-of-Experts 최적화 + 추론 시간 컴퓨트 배분 — 미국 칩 수출 규제로 H100이 없는 상태에서 이뤄냈습니다.\n\n2026.06.16 현재: 첫 외부 투자 라운드 완료 — CNY 50B+($7.4B), 밸류 $50B+. 주요 투자자: Tencent·CATL·창업자 Liang(약 40% 자체 출자) + 국가 AI 펀드(CAIIF, 의결권 보유). 외부 투자자는 5년 락업·의결권 없음.\n\n산업에 남긴 교훈: ① 알고리즘 혁신은 컴퓨트 우위를 단기간에 무력화할 수 있다. ② 오픈 가중치 배포로 전 세계 무료 사용 → 생태계 급성장. 리스크: 국유 자본 거버넌스·수출 규제·데이터 프라이버시 — 미국·유럽 기업은 독립 배포 전 법무 검토 필수.", nav: "native", keywords: ["deepseek", "딥시크", "r1", "v3", "비용", "효율", "sputnik", "7.4"] },
    { cat: 2, q: "오픈소스 vs 클로즈드 모델 — 기업은 어떤 걸 써야 하나?", a: "이건 기술 선택이 아니라 데이터 전략·비용 구조·컴플라이언스 전략의 선택입니다.\n\n오픈 가중치(Llama 4·Mistral·DeepSeek R1): 가중치 공개 배포. 장점=무료·자체 서버 배포로 데이터 외부 유출 없음·파인튜닝 자유·EU AI Act 대부분 면제. 단점=자체 인프라 비용·운영/보안 책임 전담·최신 성능 격차(줄어들고 있음).\n\n클로즈드(GPT-5.5·Claude Fable 5·Gemini 3.x): API 전용. 장점=최고 성능·운영 부담 제로·빠른 업데이트. 단점=데이터 API 통과·토큰 비용 누적·서비스 정책 변경 리스크.\n\n2026년 격차 현황: DeepSeek R1이 GPT-4급을 1/10 비용으로, Llama 4도 근접 — 격차가 빠르게 줄고 있습니다. EU·한국 기업은 GDPR/개인정보보호법으로 오픈소스 자체 배포가 늘고 있습니다.\n\n선택 기준: 데이터 보안·컴플라이언스 최우선 → 오픈소스 자체 배포 / 최고 성능·빠른 도입·지원 우선 → 클로즈드 API.", nav: "dynamics", keywords: ["오픈소스", "클로즈드", "llama", "deepseek", "차이", "기업", "eu", "gdpr", "데이터"] },
    // ── ③ 인프라·하드웨어 ──
    { cat: 3, q: "NVIDIA는 왜 아직도 압도적인가?", a: "NVIDIA의 해자는 '좋은 GPU' 하나가 아니라 하드웨어+소프트웨어 이중 구조입니다.\n\n하드웨어: AI GPU 점유율 80%+. FY27 Q1(2026.05) 매출 $81.6B(+85% YoY)·데이터센터 $75.2B(+92%). Q2 가이던스 $91.0B. B200(Blackwell)은 H100 대비 추론 30배·전력효율 대폭 향상.\n\n소프트웨어(핵심 해자): CUDA 생태계는 10년간 7.5M+ 개발자가 쌓은 라이브러리·워크플로우. PyTorch·TensorFlow 모두 CUDA 위에서 최적화 — '수백만 명의 습관'을 바꾸는 건 기술이 아닙니다.\n\n위협은 실재: Google TPU v7(Ironwood) 추론 전력효율 B200의 약 2배, Amazon Trainium 3·MS Maia 2·Meta MTIA 2 등 4대 하이퍼스케일러 자체 칩 합산 190만 가속기. 업계 컨센서스는 'CUDA 대체 최소 5~7년'. FY27 데이터센터 전망 $105~120B로 오히려 상향됐습니다 — '분리'는 시작됐지만 NVIDIA 시대의 끝은 아닙니다.", nav: "bigtech", keywords: ["nvidia", "엔비디아", "gpu", "cuda", "b200", "blackwell", "tpu", "trainium"] },
    { cat: 3, q: "빅테크 자체 칩이 NVIDIA를 위협하나?", a: "위협은 실재하지만, 2026년 현재는 '보완재' 단계입니다.\n\n4대 하이퍼스케일러 현황: Google TPU v7(Ironwood)=추론 전력효율 B200의 약 2배, Google 내부 Gemini 학습에 우선 사용. Amazon Trainium 3=NVIDIA 의존도 감소·Anthropic과 10년 $100B 약정 연계. MS Maia 2=Copilot·Azure 일부 워크로드 전환. Meta MTIA 2=Llama 학습 일부 담당.\n\n합산 배포 약 190만 가속기이지만, CUDA 생태계 미지원으로 외부 개발자에게는 '접근 불가' 상태. 이 칩들은 자체 워크로드 비용 절감용이지 NVIDIA를 대체하는 상품이 아닙니다.\n\n결론: 하이퍼스케일러들은 NVIDIA 의존도를 '전략적으로 낮추는 중'이지, 대체하는 게 아닙니다. NVIDIA가 더 위협적으로 보는 것은 칩 자체보다 'AWS/Azure가 GPU 서버를 되팔면서 NVIDIA 최종 고객에게 접근하는 것'입니다.", nav: "bigtech", keywords: ["tpu", "trainium", "자체칩", "nvidia", "대체", "google", "amazon", "maia"] },
    { cat: 3, q: "Amazon은 왜 OpenAI·Anthropic 양쪽에 투자하나?", a: "전략이지 실수가 아닙니다 — '누가 이기든 인프라를 공급한다'는 논리입니다.\n\n타임라인: 2026.02 OpenAI에 $50B 투자+$100B AWS 약정. 2026.04.20 Anthropic에 즉시 $5B(기존 $8B 별도)+향후 최대 $20B 추가+AWS 10년 $100B+ 약정.\n\n왜 합리적인가: AI 모델 경쟁 승자 예측은 불가능에 가깝습니다. 그러나 '어떤 AI가 이기든 학습·서비스에 클라우드 컴퓨트는 반드시 필요하고 AWS가 그 공급자'라는 사실은 확실합니다. 양쪽을 장기 계약으로 묶으면 Amazon은 'AI 전쟁의 무기 공급상' 포지션을 확보합니다.\n\n부가 효과: Microsoft-OpenAI 독점이 Azure로 모든 AI 트래픽을 끌어가는 것을 견제. Anthropic의 AWS 10년 $100B 약정은 Azure 대비 클라우드 경쟁력을 수치로 확보한 것입니다. 이 전략의 유일한 리스크는 '투자한 두 회사가 합병하거나 하나가 AWS를 떠나는 경우'입니다.", nav: "bigtech", keywords: ["amazon", "aws", "anthropic", "openai", "양쪽투자", "전략", "베팅", "100b"] },
    { cat: 3, q: "AI 데이터센터 전력 문제는 얼마나 심각한가?", a: "전력은 2026년 AI 확장의 가장 큰 물리적 제약입니다.\n\n수치: 2025년 AI 데이터센터 연간 전력 소비 약 415 TWh — 스페인 전체 소비량에 맞먹습니다(IEA). 2030년까지 최대 1,000 TWh로 3배 이상 증가 전망. Microsoft·Google·Amazon은 모두 원자력 투자를 발표 — MS는 Three Mile Island 재가동 계약, Google은 차세대 소형모듈원자로(SMR) 7기 계약.\n\n실질 제약: 새 데이터센터 전력망 연결에 평균 4~7년 소요(미국 기준). NVIDIA B200 랙 하나가 120kW 이상 소비 → 기존 건물 대부분 수용 불가. '컴퓨트는 충분한데 전기가 없다'는 상황이 2027~28년 AI 확장의 병목이 될 가능성이 높습니다.\n\n역설: TPU v7의 전력 효율이 B200의 2배라는 점 — '더 좋은 하드웨어'보다 '에너지 효율 혁신'이 다음 AI 레이스의 핵심이 될 수 있습니다.", nav: "bigtech", keywords: ["전력", "에너지", "데이터센터", "탄소", "원자력", "smr", "전기", "nvidia"] },
    // ── ④ 응용·에이전트 ──
    { cat: 4, q: "AI 에이전트 — 실제 도입 성과와 실패 패턴은?", a: "에이전트는 '챗봇이 답한다'에서 '에이전트가 처리한다'로의 전환입니다.\n\n정의: 목표를 주면 스스로 계획·도구 사용·실행·검증하는 AI. 예: Harvey(법률)=계약서 검토→판례 검색→수정 제안 자동화. Cursor/Claude Code=버그 리포트→코드베이스 분석→수정→테스트 자동 수행.\n\n2026 실제 성과(SoundHound 조사): 기업의 96%가 에이전트 AI 도입 ROI가 기대치를 충족/초과했다고 응답. 직원 만족도 증가 72%. Appian의 에이전트: 광고 검토 정확도 98%, 리소스 필요 33% 감소.\n\n실패 패턴(Gartner 경고): 'agentic AI 프로젝트의 40%+가 2027년까지 비용·불명확한 ROI로 취소'. 주요 원인: 프로세스 정의 없이 AI부터 도입(기반 없는 배관 공사), 파일럿에서 본계약 전환 실패, 에이전트 간 충돌 미처리.\n\n성공 패턴: Harvey($11B)·Sierra($10B, ARR 67x)처럼 '산업 특화 + 워크플로우 깊은 통합' — 범용보다 전문화가 ROI를 증명합니다.", nav: "dynamics", keywords: ["에이전트", "agentic", "harvey", "cursor", "claude code", "도입", "roi", "gartner"] },
    { cat: 4, q: "AI 추론 비용은 얼마나 빠르게 떨어지나?", a: "무어의 법칙(2년 2배)을 훨씬 능가하는 속도로 하락 중입니다.\n\n실제 수치: GPT-4급 API — 2023.03 $60/1M 토큰 → 2024 초 $10 → 2025 초 $2 → 2026 초 $0.40 이하. 약 3년 만에 150배 하락(연 ~10배). B200(Blackwell)은 H100 대비 추론 비용 10~15배 추가 절감, 2021년 대비 전체 약 280배.\n\n두 가지 역설: ① 싸질수록 더 쓴다 — 단가 90% 하락 동안 기업 총 AI 인프라 지출은 320% 증가(수요 탄력성). ② 최고급은 여전히 비싸다 — Claude Fable 5 $10/$50, GPT-5.5 Pro $30/$180 per 1M 토큰. 평범한 추론은 무료에 수렴하나 최고 성능 프런티어 모델은 프리미엄 유지.\n\n실무 시사점: '비용 절감'을 위한 AI 도입은 유효기간이 짧습니다(경쟁자도 같은 AI 사용). 차별화하려면 독점 데이터·워크플로우 통합이 핵심입니다.", nav: "dynamics", keywords: ["추론", "비용", "inference", "토큰", "가격", "하락", "api", "gpt", "claude"] },
    { cat: 4, q: "ChatGPT는 구글 검색을 죽이고 있나?", a: "점유율 수치보다 '수익 구조 파괴'가 진짜 위협입니다.\n\n2026.06 현재: Google은 여전히 글로벌 검색 74~80% 점유. ChatGPT Search 17~18%, Gemini 트래픽 20% 차지. Perplexity는 점유율은 낮지만 세션당 쿼리 Google의 4.5배 — '깊은 탐색'에서 사용자를 뺏습니다.\n\n진짜 위협: Google 수익 구조는 '검색→광고 클릭'인데, AI 검색은 직접 답변을 줘 광고 링크 클릭 이유가 줄어듭니다. Goldman Sachs 추정: AI 검색 확산으로 Google 검색 광고 매출 연 $20~40B 잠식 가능.\n\n역설: OpenAI 자신이 2025.09 EU에 'Google·Apple·MS의 데이터 독점이 AI 검색 경쟁을 막는다'고 반독점 신고 — AI 검색의 진짜 해자가 모델이 아니라 '10년간 쌓인 검색 데이터'임을 스스로 인정한 셈입니다. Google의 반격: Gemini 앱 MAU 900M+ 돌파(Google I/O 2026), AI Overview 검색 통합으로 '검색 자체를 AI화'하는 전략.", nav: "dynamics", keywords: ["구글", "검색", "chatgpt", "점유율", "광고", "perplexity", "gemini", "시장"] },
    { cat: 4, q: "Physical AI(로봇·자율주행)의 현황은?", a: "2026년은 Physical AI가 연구실에서 공장·도로로 나오는 원년입니다.\n\n시장: 글로벌 로보틱스 시장 $38B(2026, YoY +34%). 휴머노이드 12개 플랫폼이 구매 가능 상태(2024년엔 3개). TrendForce 예측 2026년 출하 5만 대+(2025년 700%+ 성장). 2035년 $200B(Barclays) → 2050년 $1.4~1.7T(UBS).\n\n주요 업체: Tesla Optimus·Boston Dynamics Atlas·Figure AI·Agility Robotics — 실제 공장 배포 시작. 단가: 고성능 모델 약 $200,000 → 2035년 $13,000~17,000으로 예상.\n\nJensen Huang(NVIDIA)이 '물리적 AI는 다음 10조 달러 산업'이라 부르는 이유: 모든 로봇·자동차·드론에 AI 칩이 들어가야 하기 때문입니다. NVIDIA의 Isaac·Omniverse 플랫폼이 로봇 학습 인프라 표준을 노리고 있습니다.", nav: "overview", keywords: ["physical ai", "로봇", "휴머노이드", "자율주행", "optimus", "figure", "공장"] },
    // ── ⑤ 리스크·미래 ──
    { cat: 5, q: "AI 할루시네이션은 얼마나 심각하고 어떻게 줄이나?", a: "완전 해결된 모델은 없습니다 — 하지만 GPT-5.5·Claude Fable 5로 크게 줄었습니다.\n\n규모: 2024년 기업 피해 추정 $67.4B(Salesforce Research). IT 전문가 68%가 프로덕션에서 목격, 엔터프라이즈 사용자 47%가 할루시네이션 정보로 실제 의사결정을 내린 경험 있음(IBM Institute).\n\n2026 최신 수치: GPT-5.5(thinking mode)는 GPT-4o 대비 사실 오류 ~80% 감소, 기만율 4.8%→2.1%로 절반 수준(OpenAI 시스템카드). 모델별 요약 작업 할루시네이션율: Gemini Flash ~0.7%, GPT-4o ~1.5%, Claude ~4%(Stanford HAI), 프로덕션 평균 ~9.2%, 법률 문서 17~34%.\n\n위험한 진실: 비싼 추론 모델일수록 '모른다' 대신 그럴듯한 답을 자신감 있게 만들 수 있습니다. 실무 대응 4단계: ① RAG(답하기 전 검증 문서 검색) → ② 소스 인용 요구 → ③ 이중 검증(다른 AI/사람 팩트체크) → ④ 도메인 파인튜닝. 0% 할루시네이션 AI는 없습니다.", nav: "dynamics", keywords: ["할루시네이션", "hallucination", "오류", "신뢰", "rag", "팩트", "gpt-5", "claude"] },
    { cat: 5, q: "AI는 실제로 일자리를 빼앗고 있나?", a: "처음으로 '지식 노동'을 자동화한다는 점에서 이번은 다릅니다.\n\n데이터: McKinsey '현재 AI 기술로 미국 업무 시간의 57% 기술적 자동화 가능.' Goldman Sachs(2026.01) 전 세계 3억 명 노출, 2030년 2.7억 대체 추산. 취약 직군: 행정·데이터 입력(노출도 26%), 고객서비스(20%), 회계·법률 보조(18%). McKinsey 자체 사례: AI로 클라이언트 대면 역할 +25% 확대, 비대면 역할 -25% 축소 — 총 인원은 비슷하지만 '성격이 달라졌다'.\n\n반대 데이터: AI 신직종(프롬프트 엔지니어·AI 트레이너·에이전트 아키텍트) 급증. LinkedIn 기준 GenAI 능숙자 채용 수요 비사용자 대비 3.5배. 2026 McKinsey 조사: AI 사용자 76%(2023년 30%에서 급증).\n\n솔직한 결론: '대체'보다 'AI를 쓰는 사람이 못 쓰는 사람을 대체'하는 패턴. 동일 직업 내 생산성·소득 격차가 벌어지고 있습니다. 기업의 51%가 'AI로 신입 채용 필요가 줄었다'고 응답했습니다(McKinsey 2025).", nav: "insights", keywords: ["일자리", "고용", "자동화", "실직", "goldman", "mckinsey", "직업", "채용"] },
    { cat: 5, q: "EU AI Act 완전 시행 — 기업이 알아야 할 것은?", a: "2026.08.02, EU AI Act가 완전 시행됩니다 — 세계 최초의 포괄적 AI 법체계입니다.\n\n주요 일정: 2025.02.02 금지 AI 관행 시행(소셜 스코어링·실시간 생체 인식 등). 2026.02.02 고위험 AI 시스템 1차 의무. 2026.08.02 완전 시행(GPT·Claude 등 범용 AI 모델 투명성 의무 포함). 2028까지 규제 제품 내 고위험 AI 연장.\n\n벌금: 금지 관행 위반 최대 €35M 또는 전 세계 매출 7%. 고위험 위반 최대 €15M 또는 3%. 허위 정보 제공 최대 €7.5M.\n\n핵심: GDPR처럼 역외 적용 — EU에서 AI 시스템이 사용되면 공급자가 어디 있든 적용. 오픈소스 가중치 모델은 대부분 면제지만 상업 배포 시 일부 의무 적용.\n\n기업 체크리스트: ① 사용 중인 AI 시스템의 위험 등급 분류 → ② 고위험이면 기술 문서·인간 감독 체계 구축 → ③ 범용 AI 모델 사용 시 투명성 공시 준비. 한국 기업도 EU에 서비스하면 즉시 적용됩니다.", nav: "insights", keywords: ["eu", "ai act", "규제", "법", "벌금", "컴플라이언스", "gdpr", "2026"] },
    { cat: 5, q: "AI 스타트업이 망하는 3가지 패턴은?", a: "2024 창업 14,000개+ AI 스타트업 중 2025년에만 3,800개 폐업(1년 실패율 27%). 투자 금액과 생존율은 별개입니다.\n\n패턴 1 — 래퍼 신드롬: OpenAI·Claude API를 얇게 포장해 파는 앱은 본사가 같은 기능을 기본 탑재하는 순간 우위 상실. 'AI로 이력서 써드립니다' 류 서비스가 전형.\n\n패턴 2 — 파일럿 지옥: 기업 고객의 무료 파일럿 요청이 반복되는데, MIT 연구 기준 AI 파일럿의 95%가 측정 가능한 ROI를 증명 못 해 본계약으로 전환 실패. 프로세스 정의 없이 AI를 먼저 도입한 결과.\n\n패턴 3 — 비용 역진: 저가를 경쟁 우위로 삼았는데 API 단가가 연 10배씩 하락해 '우리가 더 싸다'가 무의미해짐.\n\n생존한 40%의 공통점: Scale AI(독점 데이터)·Harvey(법률 워크플로우 통합)·Cursor(IDE 깊은 통합) — 모두 'API 위'가 아니라 '워크플로우 안에' 녹아들었습니다. 차별화의 핵심은 데이터와 프로세스 통합입니다.", nav: "startup", keywords: ["스타트업", "실패", "폐업", "래퍼", "파일럿", "roi", "버블", "생존"] },
  ];

  /* ---- Monthly Revenue Trends ($M) ---- */
  // 분기 공시(10-Q/IR)·공개 ARR·run-rate 기반 월 배분만 사용(내부 추정 제외).
  // NVIDIA=분기 Data Center 매출÷3, MS=AI run-rate÷12, OpenAI=S-1 분기매출÷3, Anthropic=공개 run-rate÷12.
  const REVENUE_MONTHLY = [
    { month: "2026-01", data: [
      { name: "NVIDIA", value: 17100, src: "FY26 Q4 DC $51.2B ÷3" },
      { name: "Microsoft AI", value: 3000, src: "AI run-rate $36B 공시 ÷12" },
      { name: "OpenAI", value: 1900, src: "S-1 Q1'26 매출 $5.7B ÷3" },
      { name: "Anthropic", value: 1170, src: "공개 run-rate ~$14B ÷12" },
    ]},
    { month: "2026-02", data: [
      { name: "NVIDIA", value: 25100, src: "FY27 Q1 DC $75.2B ÷3" },
      { name: "Microsoft AI", value: 3050, src: "AI run-rate 공시 ÷12" },
      { name: "OpenAI", value: 1900, src: "S-1 Q1'26 매출 $5.7B ÷3" },
      { name: "Anthropic", value: 1500, src: "공개 run-rate ~$18B ÷12" },
    ]},
    { month: "2026-03", data: [
      { name: "NVIDIA", value: 25100, src: "FY27 Q1 DC $75.2B ÷3" },
      { name: "Microsoft AI", value: 3080, src: "AI run-rate 공시 ÷12" },
      { name: "OpenAI", value: 1900, src: "S-1 Q1'26 매출 $5.7B ÷3" },
      { name: "Anthropic", value: 1900, src: "공개 run-rate ~$23B ÷12" },
    ]},
    { month: "2026-04", data: [
      { name: "NVIDIA", value: 25100, src: "FY27 Q1 DC $75.2B ÷3" },
      { name: "Microsoft AI", value: 3120, src: "AI run-rate $37B 공시 ÷12" },
      { name: "OpenAI", value: 2080, src: "공개 ARR 월 배분" },
      { name: "Anthropic", value: 2500, src: "공개 run-rate $30B ÷12" },
    ]},
    { month: "2026-05", data: [
      { name: "NVIDIA", value: 28000, src: "FY27 Q2 가이던스 $91B 기반 DC ÷3" },
      { name: "Microsoft AI", value: 3150, src: "AI run-rate $37B 공시 ÷12" },
      { name: "OpenAI", value: 2150, src: "공개 ARR 월 배분" },
      { name: "Anthropic", value: 3900, src: "공개 run-rate $47B ÷12 (Series H)" },
    ]},
  ];

  /* ---- 분기별 매출 추이 ($M) — seg:ai=AI 부문 / total=기업 전체 매출. 모두 분기 공시 기반.
     Google·Amazon은 AI 매출 비공개 → 클라우드 부문(Google Cloud·AWS)으로 대체(AI 인프라 근사).
     Microsoft만 AI run-rate 공시. NVIDIA는 회계분기(FY), 라벨은 캘린더 분기 근사. ---- */
  const REVENUE_QUARTERLY = [
    { q: "2025 Q2", data: [
      { name: "NVIDIA (AI·DC)", seg: "ai", cat: "native", value: 41000, src: "NVIDIA 데이터센터 매출 공시(Q2E 가이던스 근사)" },
      { name: "AWS", seg: "ai", cat: "bigtech", value: 30900, src: "AWS 분기 매출 공시(클라우드, AI 비중 큼)" },
      { name: "Google Cloud", seg: "ai", cat: "bigtech", value: 13600, src: "Alphabet 'Google Cloud' 분기 매출 공시(AI 인프라 근사)" },
      { name: "Microsoft AI", seg: "ai", cat: "bigtech", value: 5000, src: "AI run-rate 공시 ÷4" },
      { name: "OpenAI", seg: "ai", cat: "native", value: 2800, src: "공개 ARR/실매출 기반" },
      { name: "Anthropic", seg: "ai", cat: "native", value: 1000, src: "공개 run-rate ÷4" },
      { name: "NVIDIA (전체)", seg: "total", cat: "native", value: 46700, src: "NVIDIA 분기 총매출 공시(Q2E 가이던스)" },
      { name: "Amazon (전체)", seg: "total", cat: "bigtech", value: 167700, src: "Amazon 분기 총매출 공시(Q2E 근사)" },
      { name: "Alphabet (전체)", seg: "total", cat: "bigtech", value: 96400, src: "Alphabet 분기 총매출 공시(Q2E 근사)" },
      { name: "Apple (전체)", seg: "total", cat: "bigtech", value: 94000, src: "Apple 분기 총매출 공시(회계분기·Q2E 근사)" },
      { name: "Microsoft (전체)", seg: "total", cat: "bigtech", value: 76400, src: "Microsoft 분기 총매출 공시(회계분기·Q2E 근사)" },
      { name: "Meta (전체)", seg: "total", cat: "bigtech", value: 47500, src: "Meta 분기 총매출 공시(Q2E 근사)" },
    ]},
    { q: "2025 Q3", data: [
      { name: "NVIDIA (AI·DC)", seg: "ai", cat: "native", value: 51000, src: "NVIDIA 데이터센터 매출 공시(Q2E 가이던스 근사)" },
      { name: "AWS", seg: "ai", cat: "bigtech", value: 33000, src: "AWS 분기 매출 공시(클라우드, AI 비중 큼)" },
      { name: "Google Cloud", seg: "ai", cat: "bigtech", value: 15000, src: "Alphabet 'Google Cloud' 분기 매출 공시(AI 인프라 근사)" },
      { name: "Microsoft AI", seg: "ai", cat: "bigtech", value: 6500, src: "AI run-rate 공시 ÷4" },
      { name: "OpenAI", seg: "ai", cat: "native", value: 3300, src: "공개 ARR/실매출 기반" },
      { name: "Anthropic", seg: "ai", cat: "native", value: 1750, src: "공개 run-rate ÷4" },
      { name: "NVIDIA (전체)", seg: "total", cat: "native", value: 57000, src: "NVIDIA 분기 총매출 공시(Q2E 가이던스)" },
      { name: "Amazon (전체)", seg: "total", cat: "bigtech", value: 185000, src: "Amazon 분기 총매출 공시(Q2E 근사)" },
      { name: "Alphabet (전체)", seg: "total", cat: "bigtech", value: 102350, src: "Alphabet 분기 총매출 공시(Q2E 근사)" },
      { name: "Apple (전체)", seg: "total", cat: "bigtech", value: 102000, src: "Apple 분기 총매출 공시(회계분기·Q2E 근사)" },
      { name: "Microsoft (전체)", seg: "total", cat: "bigtech", value: 77700, src: "Microsoft 분기 총매출 공시(회계분기·Q2E 근사)" },
      { name: "Meta (전체)", seg: "total", cat: "bigtech", value: 51240, src: "Meta 분기 총매출 공시(Q2E 근사)" },
    ]},
    { q: "2025 Q4", data: [
      { name: "NVIDIA (AI·DC)", seg: "ai", cat: "native", value: 62300, src: "NVIDIA 데이터센터 매출 공시(Q2E 가이던스 근사)" },
      { name: "AWS", seg: "ai", cat: "bigtech", value: 35600, src: "AWS 분기 매출 공시(클라우드, AI 비중 큼)" },
      { name: "Google Cloud", seg: "ai", cat: "bigtech", value: 16400, src: "Alphabet 'Google Cloud' 분기 매출 공시(AI 인프라 근사)" },
      { name: "Microsoft AI", seg: "ai", cat: "bigtech", value: 8000, src: "AI run-rate 공시 ÷4" },
      { name: "OpenAI", seg: "ai", cat: "native", value: 4000, src: "공개 ARR/실매출 기반" },
      { name: "Anthropic", seg: "ai", cat: "native", value: 2250, src: "공개 run-rate ÷4" },
      { name: "NVIDIA (전체)", seg: "total", cat: "native", value: 68100, src: "NVIDIA 분기 총매출 공시(Q2E 가이던스)" },
      { name: "Amazon (전체)", seg: "total", cat: "bigtech", value: 213000, src: "Amazon 분기 총매출 공시(Q2E 근사)" },
      { name: "Alphabet (전체)", seg: "total", cat: "bigtech", value: 113800, src: "Alphabet 분기 총매출 공시(Q2E 근사)" },
      { name: "Apple (전체)", seg: "total", cat: "bigtech", value: 143800, src: "Apple 분기 총매출 공시(회계분기·Q2E 근사)" },
      { name: "Microsoft (전체)", seg: "total", cat: "bigtech", value: 81300, src: "Microsoft 분기 총매출 공시(회계분기·Q2E 근사)" },
      { name: "Meta (전체)", seg: "total", cat: "bigtech", value: 59890, src: "Meta 분기 총매출 공시(Q2E 근사)" },
    ]},
    { q: "2026 Q1", data: [
      { name: "NVIDIA (AI·DC)", seg: "ai", cat: "native", value: 75200, src: "NVIDIA 데이터센터 매출 공시(Q2E 가이던스 근사)" },
      { name: "AWS", seg: "ai", cat: "bigtech", value: 37600, src: "AWS 분기 매출 공시(클라우드, AI 비중 큼)" },
      { name: "Google Cloud", seg: "ai", cat: "bigtech", value: 20000, src: "Alphabet 'Google Cloud' 분기 매출 공시(AI 인프라 근사)" },
      { name: "Microsoft AI", seg: "ai", cat: "bigtech", value: 9250, src: "AI run-rate 공시 ÷4" },
      { name: "OpenAI", seg: "ai", cat: "native", value: 5700, src: "공개 ARR/실매출 기반" },
      { name: "Anthropic", seg: "ai", cat: "native", value: 5750, src: "공개 run-rate ÷4" },
      { name: "NVIDIA (전체)", seg: "total", cat: "native", value: 81600, src: "NVIDIA 분기 총매출 공시(Q2E 가이던스)" },
      { name: "Amazon (전체)", seg: "total", cat: "bigtech", value: 177500, src: "Amazon 분기 총매출 공시(Q2E 근사)" },
      { name: "Alphabet (전체)", seg: "total", cat: "bigtech", value: 109900, src: "Alphabet 분기 총매출 공시(Q2E 근사)" },
      { name: "Apple (전체)", seg: "total", cat: "bigtech", value: 111200, src: "Apple 분기 총매출 공시(회계분기·Q2E 근사)" },
      { name: "Microsoft (전체)", seg: "total", cat: "bigtech", value: 82900, src: "Microsoft 분기 총매출 공시(회계분기·Q2E 근사)" },
      { name: "Meta (전체)", seg: "total", cat: "bigtech", value: 56310, src: "Meta 분기 총매출 공시(Q2E 근사)" },
    ]},
    { q: "2026 Q2E", data: [
      { name: "NVIDIA (AI·DC)", seg: "ai", cat: "native", value: 84000, src: "NVIDIA 데이터센터 매출 공시(Q2E 가이던스 근사)" },
      { name: "AWS", seg: "ai", cat: "bigtech", value: 39000, src: "AWS 분기 매출 공시(클라우드, AI 비중 큼)" },
      { name: "Google Cloud", seg: "ai", cat: "bigtech", value: 21500, src: "Alphabet 'Google Cloud' 분기 매출 공시(AI 인프라 근사)" },
      { name: "Microsoft AI", seg: "ai", cat: "bigtech", value: 9500, src: "AI run-rate 공시 ÷4" },
      { name: "OpenAI", seg: "ai", cat: "native", value: 6500, src: "공개 ARR/실매출 기반" },
      { name: "Anthropic", seg: "ai", cat: "native", value: 11750, src: "공개 run-rate ÷4" },
      { name: "NVIDIA (전체)", seg: "total", cat: "native", value: 91000, src: "NVIDIA 분기 총매출 공시(Q2E 가이던스)" },
      { name: "Amazon (전체)", seg: "total", cat: "bigtech", value: 196000, src: "Amazon 분기 총매출 공시(Q2E 근사)" },
      { name: "Alphabet (전체)", seg: "total", cat: "bigtech", value: 112000, src: "Alphabet 분기 총매출 공시(Q2E 근사)" },
      { name: "Apple (전체)", seg: "total", cat: "bigtech", value: 99000, src: "Apple 분기 총매출 공시(회계분기·Q2E 근사)" },
      { name: "Microsoft (전체)", seg: "total", cat: "bigtech", value: 84000, src: "Microsoft 분기 총매출 공시(회계분기·Q2E 근사)" },
      { name: "Meta (전체)", seg: "total", cat: "bigtech", value: 58000, src: "Meta 분기 총매출 공시(Q2E 근사)" },
    ]},
  ];

  /* ============================================================
     STOCK_GROUPS — AI 밸류체인 카테고리(칩·메모리·하이퍼스케일러·
     데이터센터·온디바이스·AI 네이티브). STOCKS[].group 이 이 id를 참조합니다.
     ============================================================ */
  const STOCK_GROUPS = [
    { id: "chip", ko: "AI 칩", en: "AI Chips", accent: "#C026D3" },
    { id: "memory", ko: "메모리", en: "Memory", accent: "#EA580C" },
    { id: "hyperscaler", ko: "하이퍼스케일러", en: "Hyperscalers", accent: "#1428A0" },
    { id: "datacenter", ko: "데이터센터·뉴클라우드", en: "Data Center / Neocloud", accent: "#0891B2" },
    { id: "device", ko: "온디바이스", en: "On-device", accent: "#16A34A" },
    { id: "native", ko: "AI 네이티브", en: "AI Native", accent: "#7A38D6" },
  ];

  /* ============================================================
     STOCKS — listed AI companies. 실제 일별 주가는 매일 크롤링되어
     stocks.json 으로 제공됩니다(scripts/crawl-stocks.mjs · Stooq).
     group = AI 밸류체인 카테고리(STOCK_GROUPS 참조). 여기에는 메타데이터 +
     변곡점 설명(에디토리얼)만 둡니다.
     ============================================================ */
  const STOCKS = [
    {
      ticker: "NVDA", name: "NVIDIA", group: "chip", domain: "nvidia.com", cat: "bigtech",
      events: [
        { date: "2023-05-25", dir: "up", label: "FY24 가이던스 서프라이즈", reason: "왜 올랐나: 데이터센터 GPU 수요가 예상을 압도해 다음 분기 매출 가이던스를 시장 추정치보다 50%+ 높게 제시. ChatGPT發 AI 학습 붐의 '유일한 삽·곡괭이' 공급자로 부각되며 하루 +24%, 단숨에 AI 대장주로 등극." },
        { date: "2024-06-07", dir: "up", label: "10:1 주식분할", reason: "왜 올랐나: 10:1 액면분할로 주당 가격을 낮춰 소매·옵션 접근성 확대. 분할 자체는 가치를 바꾸지 않지만 수급 기대와 H100/H200 수요 지속이 겹쳐 사상 최고가 경신." },
        { date: "2025-01-27", dir: "down", label: "DeepSeek 쇼크 -17%", reason: "왜 빠졌나: 중국 DeepSeek가 GPU를 훨씬 적게 쓰고도 GPT-4급 성능을 냈다는 소식에 'AI 칩 과잉투자(capex 거품)' 공포 확산. 하루 -17%·시총 약 $600B 증발(미국 증시 사상 최대 일일 손실). 단, 이후 추론 수요 급증으로 회복." },
        { date: "2025-04-04", dir: "down", label: "관세·수출규제 우려", reason: "왜 빠졌나: 반도체 관세와 대중(對中) 수출규제 확대 가능성에 마진·물량 훼손 우려. 매크로 위험회피까지 겹쳐 조정됐으나, B200(Blackwell) 실수요 확인되며 반등." },
        { date: "2026-01-30", dir: "down", label: "Blackwell 정점론·차익실현", reason: "왜 빠졌나: Q3 FY26 매출 $57B·데이터센터 $51.2B(+66%)의 호실적에도 '성장 정점' 논쟁과 단기 차익실현 매물 출회. 호재가 이미 주가에 반영됐다는 인식(sell-the-news)이 단기 조정을 유발." },
        { date: "2026-05-20", dir: "up", label: "FY27 Q1 사상 최대 실적", reason: "왜 올랐나: 분기 매출 $81.6B(+85%)·데이터센터 $75.2B(+92%) 신기록에 Q2 가이던스 $91B 제시. '정점론'을 실적으로 반박하며 사상 최고가권 회복." },
      ],
    },
    {
      ticker: "AMD", name: "AMD", group: "chip", domain: "amd.com", cat: "bigtech",
      events: [],
      note: "AMD(나스닥, 반도체). MI300/MI350 시리즈 AI 가속기로 NVIDIA 대항마 포지셔닝 — 데이터센터 GPU 2위 사업자.",
    },
    {
      ticker: "AVGO", name: "Broadcom", group: "chip", domain: "broadcom.com", cat: "bigtech",
      events: [],
      note: "Broadcom(나스닥, 반도체·네트워킹). Google TPU 등 커스텀 AI ASIC 공동설계·고속 네트워킹 칩으로 AI 인프라 핵심 공급사.",
    },
    {
      ticker: "TSM", name: "TSMC", group: "chip", domain: "tsmc.com", cat: "bigtech",
      events: [],
      note: "TSMC(뉴욕 ADR, 파운드리). NVIDIA·AMD·Apple 등 최선단 AI 칩 위탁생산 — 첨단 공정 사실상 독점적 지위.",
    },
    {
      ticker: "MU", name: "Micron", group: "memory", domain: "micron.com", cat: "bigtech",
      events: [],
      note: "Micron(나스닥, 메모리). HBM(고대역폭메모리) 3대 공급사 중 하나로 AI 가속기 필수 부품 제공.",
    },
    {
      ticker: "SKHY", name: "SK hynix", group: "memory", domain: "skhynix.com", cat: "bigtech",
      events: [
        { date: "2026-07-10", dir: "up", label: "나스닥 ADR 상장 데뷔 +13%", reason: "공모가 $149로 $26.5B 조달(외국기업 사상 최대 미국 주식 공모) — 한국거래소(000660) 상장 유지한 채 나스닥에 예탁증권(ADR) 동시 상장. 첫날 +13% $168.01 마감 — HBM 공급 부족 장기화 기대가 상승을 견인." },
      ],
      note: "SK hynix(나스닥 ADR, 2026-07-10 상장). HBM 시장 선도업체 — 상장 초기라 일별 시세 데이터가 아직 얇을 수 있습니다.",
    },
    {
      ticker: "MSFT", name: "Microsoft", group: "hyperscaler", domain: "microsoft.com", cat: "bigtech",
      events: [
        { date: "2023-01-23", dir: "up", label: "OpenAI $10B 투자", reason: "왜 올랐나: OpenAI에 최대 $10B 투자 발표로 GPT를 Azure에 독점 연결. 경쟁사가 모델을 짓는 동안 '기존 고객에게 바로 AI를 파는' 선점 기대가 재평가를 견인." },
        { date: "2024-01-25", dir: "up", label: "시총 $3T 돌파", reason: "왜 올랐나: M365 Copilot의 기업 유료 좌석이 빠르게 늘며 기존 오피스 번들에 AI를 '추가 과금'하는 수익 모델 입증. 사상 첫 시총 $3T 돌파." },
        { date: "2025-04-08", dir: "down", label: "관세·capex 부담 조정", reason: "왜 빠졌나: 글로벌 관세 충격과 'AI 데이터센터 과잉투자' 논쟁이 겹쳐 위험회피. 막대한 capex 대비 회수 시점 불확실성이 멀티플 압박." },
        { date: "2026-04-29", dir: "up", label: "AI 런레이트 $37B 확인", reason: "왜 올랐나: Q3 FY26에서 AI 부문 런레이트 $37B(+123%)·Copilot 2,000만 좌석·Azure 40% 재가속을 수치로 확인. 'AI 투자 → 실매출' 전환이 입증되며 capex 우려 완화." },
      ],
    },
    {
      ticker: "AMZN", name: "Amazon", group: "hyperscaler", domain: "amazon.com", cat: "bigtech",
      events: [
        { date: "2022-06-06", dir: "up", label: "20:1 주식분할", reason: "왜 올랐나: 20:1 액면분할로 소매 접근성 확대. 분할 전후 수급 기대가 단기 상승 요인." },
        { date: "2023-11-15", dir: "up", label: "Bedrock·Anthropic 베팅", reason: "왜 올랐나: AWS Bedrock 멀티모델 호스팅 + Anthropic 투자로 'AI 인프라 중립 공급자' 포지션 확립. 어느 모델이 이기든 클라우드 수요를 흡수한다는 논리가 재평가를 견인." },
        { date: "2025-04-08", dir: "down", label: "관세·소비 둔화 우려", reason: "왜 빠졌나: 관세에 따른 물류·소비 비용 상승과 리테일 마진 압박 우려로 조정. 매크로 위험회피가 겹침." },
        { date: "2026-04-20", dir: "up", label: "Anthropic 베팅·AWS 재가속", reason: "왜 올랐나: Anthropic에 즉시 $5B+향후 최대 $20B(기존 $8B 별도)·AWS 10년 $100B 약정 발표. AWS 성장 재가속(분기 $37.6B)과 'OpenAI·Anthropic 양쪽 베팅' 전략이 부각." },
      ],
    },
    {
      ticker: "AAPL", name: "Apple", group: "device", domain: "apple.com", cat: "bigtech",
      events: [
        { date: "2024-06-10", dir: "up", label: "Apple Intelligence 공개", reason: "왜 올랐나: WWDC에서 온디바이스 AI 'Apple Intelligence' 발표. 약 20억 대 기기의 'AI 업그레이드 교체 사이클' 기대가 사상 최고가를 견인." },
        { date: "2025-04-08", dir: "down", label: "관세·AI 지연 우려", reason: "왜 빠졌나: 중국 생산 비중에 따른 관세 노출과 Siri 고도화 지연(기능 출시 연기) 우려가 겹쳐 조정. 'AI 후발주자' 인식이 멀티플 압박." },
        { date: "2025-06-09", dir: "up", label: "WWDC25 온디바이스 확대", reason: "왜 올랐나: 온디바이스 모델 개방·Foundation Models 프레임워크로 개발자 생태계 확장 발표. 프라이버시 기반 단말 AI 차별화 기대로 반등." },
      ],
    },
    {
      ticker: "GOOGL", name: "Alphabet (Google)", group: "hyperscaler", domain: "abc.xyz", cat: "bigtech",
      events: [
        { date: "2023-02-08", dir: "down", label: "Bard 시연 오류 -7%", reason: "왜 빠졌나: 첫 Bard 데모에서 사실 오류가 노출되며 하루 -7%. ChatGPT發 'AI 검색이 구글 광고 본업을 잠식한다'는 공포가 확산." },
        { date: "2024-05-14", dir: "up", label: "Gemini 전면 통합", reason: "왜 올랐나: I/O에서 Gemini를 검색·워크스페이스·안드로이드에 통합 발표. 자체 모델+TPU+수십억 유통망의 풀스택 반격이 부각되며 AI 열위 우려 완화." },
        { date: "2025-04-08", dir: "down", label: "관세·반독점 조정", reason: "왜 빠졌나: 매크로 관세 우려에 더해 검색 반독점 패소 리스크(사업 분할 가능성)가 겹쳐 조정." },
        { date: "2026-05-20", dir: "up", label: "Gemini MAU 9억·실적", reason: "왜 올랐나: I/O 2026에서 Gemini 앱 MAU 900M+ 공개, Google Cloud 분기 $20B(+63%) 등 AI 수익화 가속 확인. 검색 잠식 우려를 성장으로 상쇄." },
      ],
    },
    {
      ticker: "META", name: "Meta", group: "hyperscaler", domain: "meta.com", cat: "bigtech",
      events: [
        { date: "2022-02-03", dir: "down", label: "실적 쇼크 -26%", reason: "왜 빠졌나: 이용자 정체와 메타버스(Reality Labs) 적자 확대로 하루 -26%. 당시 미국 기업 사상 최대 일일 시총 손실(약 $2,300억)." },
        { date: "2022-11-04", dir: "down", label: "바닥·'효율의 해'", reason: "왜 바닥인가: 대규모 감원과 '효율의 해(Year of Efficiency)' 선언 직전 저점. 비용 절감 기대가 이후 강한 반등의 출발점이 됨." },
        { date: "2024-02-02", dir: "up", label: "첫 배당·Llama 모멘텀 +20%", reason: "왜 올랐나: 사상 첫 배당·자사주 매입 발표에 Llama 오픈소스 모멘텀이 겹쳐 하루 +20%. '효율의 해' 성과가 이익으로 확인됨." },
        { date: "2025-06-17", dir: "up", label: "Llama 4·AI 광고 최적화", reason: "왜 올랐나: Llama 4 공개와 AI 기반 광고 타기팅·전환율 개선이 매출로 연결. AI capex가 본업(광고) 수익을 키운다는 논리로 사상 최고가권 진입." },
      ],
    },
    {
      ticker: "ORCL", name: "Oracle", group: "hyperscaler", domain: "oracle.com", cat: "bigtech",
      events: [],
      note: "Oracle(뉴욕, 클라우드 인프라). Stargate 등 초대형 AI 데이터센터 프로젝트로 하이퍼스케일러 경쟁에 본격 진입.",
    },
    {
      ticker: "CRWV", name: "CoreWeave", group: "datacenter", domain: "coreweave.com", cat: "startup",
      events: [],
      note: "CoreWeave(나스닥, AI 클라우드/뉴클라우드). GPU 전문 클라우드로 빅테크 외 AI 컴퓨트 공급망의 신흥 축.",
    },
    {
      ticker: "APLD", name: "Applied Digital", group: "datacenter", domain: "applieddigital.com", cat: "startup",
      events: [],
      note: "Applied Digital(나스닥, 데이터센터). 하이퍼스케일러 대상 AI 데이터센터 장기 임대(리스) 모델로 성장.",
    },
    {
      ticker: "SPCX", name: "SpaceX (xAI, Cursor)", group: "native", domain: "spacex.com", cat: "native",
      events: [
        { date: "2026-06-12", dir: "up", label: "나스닥 상장 데뷔 +19%", reason: "공모가 $135로 조달 $75B → 그린슈(초과배정) 행사로 최종 $85.7B을 거둔 사상 최대 IPO. 첫날 +19% $161 마감·시총 $2.1T 돌파 — 'AI+우주' 통합 스토리에 수요 폭주가 상승을 견인." },
        { date: "2026-06-16", dir: "up", label: "Cursor 인수 + 목표주가 상향", reason: "AI 코딩 에이전트 Cursor(Anysphere) $60B 전액 주식 인수 합의에 더해, Oppenheimer가 목표주가를 $190→$250(+32%)·아웃퍼폼으로 상향. 시총 ~$2.51T로 Amazon·Microsoft를 제치고 미 시총 4위권 진입 — 코딩 AI 시장 진입 기대가 상승을 견인." },
        { date: "2026-06-19", dir: "down", label: "희석·락업 우려로 조정", reason: "$60B 전액 주식 인수에 따른 약 3.4% 지분 희석과 8월 보호예수(락업) 해제 물량 우려가 부각. 데뷔 직후 차익실현까지 겹치며 $185 → $166 수준으로 되돌림." },
      ],
      note: "SPCX(나스닥, 2026-06-12 상장). 매일 Yahoo Finance→Stooq→Nasdaq→StockAnalysis→TradingView 순으로 실시세를 자동 크롤링합니다. 공개 피드 미수집 시에만 상장일 기준 시나리오 시세로 폴백합니다.",
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

  return { CATEGORIES, COMPANIES, COMPANY_ORDER, STARTUP_VERTICALS, BIGTECH_GROUPS, ARTICLES, REPORTS, MARKET_GROWTH, MARKET_VERTICAL, FUNDING, SHARE, USERS, BAND_PRICE, FUNDING_TREND, AI_DEALS, REVENUE, BIZ_MODELS, PRICING_MODELS, TOKEN_PRICING, KPIS, TOPLINE, INSIGHTS, DC_CAPEX, HBM_MARKET, CHIP_MIX, OPTICAL_TREND, INFRA_STRATEGY, QA_PAIRS, QA_CATS, REVENUE_MONTHLY, REVENUE_QUARTERLY, STOCKS, STOCK_GROUPS, STOCK_SHARES, attachStockEvents };
})();
