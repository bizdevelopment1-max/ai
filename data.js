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
      valuation: "$852B", valAsof: "26.03", metric: "연환산 매출", value: "$25B+", metricAsof: "26.02",
      funding: "$122B 누적(2026.03 확정)", trend: 120, trendBasis: "연환산 $25B+ · Q1 실매출 $5.7B",
      note: "GPT-4o·o3·GPT-5, ChatGPT, Sora. 2026.03.31 최종 라운드 확정: 총 조달 $122B(SoftBank·Amazon·Nvidia·a16z 등)·post-money 밸류 $852B(직전 2026.02 $730B pre+$110B 수식의 $840B에서 증액 확정). [보도] 2026.06.08 S-1 기밀 제출 — 공모 목표 밸류 미확정(최대 $1T 보도). ChatGPT 주간 활성 사용자 900M+. 연환산 매출 $25B+(2026.02), Q1 2026 실매출 $5.7B(분기). [The Information] Q1 Non-GAAP 운영 마진 -122%(분기 손실 ~$6.95B) — 연 캐시번이 연매출에 육박, IPO 밸류의 핵심 리스크. $852B는 2030년 매출 목표 $280B 가정에 기반. [WSJ/Bloomberg] Microsoft와의 독점 파트너십·양방향 수익공유 구조 재편(종료).",
      vp: "최고 성능 멀티모달 모델과 9억 규모의 소비자 접점을 동시에 보유한 유일한 사업자. API·구독·엔터프라이즈로 매출 다각화.",
      direction: "범용 인공지능(AGI) 지향 + 대규모 컴퓨트 자금 조달. 추론 모델(o-시리즈)과 에이전트로 확장. IPO 준비.",
      sources: ["총 조달 $122B·$852B post-money (2026.03.31, Bloomberg/CNBC)", "[보도] S-1 기밀 제출 2026.06.08 (Guardian) · 공모 목표 미확정", "[The Information] Q1 실매출 $5.7B · Non-GAAP 마진 -122%", "[WSJ] Microsoft 독점 파트너십 재편 종료"],
      url: "https://openai.com",
    },
    {
      cat: "native", name: "Anthropic", domain: "anthropic.com", unit: "파운데이션 모델·안전성",
      valuation: "$965B", valAsof: "26.05", metric: "run-rate 매출", value: "$47B", metricAsof: "26.05",
      funding: "Series H $65B(2026.05)", trend: 188, trendBasis: "run-rate $30B(4월)→$47B(5월), OpenAI 추월",
      note: "Claude Opus/Sonnet/Haiku, Constitutional AI. 2026.05.28 Series H $65B 조달·$965B post-money(직전 2026.02 Series G $380B). Series H 발표문서 'run-rate revenue crossed $47 billion earlier this month' 명시 — 2026.04.07 ARR $30B(당시 OpenAI가 회계 인식 차이로 ~$22B 반박)에서 6주 만에 $47B로 급증, OpenAI ARR($25B)을 2배 가까이 추월. Claude Code 단독 $2.5B+ ARR 돌파. Amazon은 기존 $8B 외 즉시 $5B 투자, 향후 최대 $20B 추가 가능(2026.04.20). AWS 10년 $100B+ 약정.",
      vp: "Constitutional AI 기반 신뢰·안전성으로 금융·의료·법률 등 규제 산업 엔터프라이즈에서 선호. 코딩 에이전트 성능 최상위(Claude Code).",
      direction: "안전성 연구와 상업화의 균형. Amazon·Google 클라우드 파트너십으로 컴퓨트 확보, 엔터프라이즈 침투 가속.",
      sources: ["run-rate 매출 $47B (Anthropic Series H 발표문, 2026.05.28)", "Series H $65B·$965B post-money (2026.05.28)", "Claude Code $2.5B+ ARR", "Amazon 즉시 $5B + 향후 최대 $20B(기존 $8B 별도) (2026.04.20)"],
      url: "https://anthropic.com",
    },
    {
      cat: "bigtech", name: "Google DeepMind", domain: "deepmind.google", unit: "파운데이션 모델(Alphabet)",
      valuation: "—", valAsof: "—", metric: "Gemini 앱 MAU", value: "900M+", metricAsof: "26.05",
      funding: "Alphabet 산하", trend: 38, trendBasis: "Gemini 앱 MAU 900M+ 돌파",
      note: "Gemini 3.x, AlphaFold, Gemma — Alphabet의 AI 연구 조직. Google I/O 2026에서 Sundar Pichai가 Gemini 앱 MAU 900M+ 돌파 공식 발표. Gemini 3 멀티모달 최고 성능권, 100만 토큰 컨텍스트. AlphaFold로 노벨화학상 수상. 검색·워크스페이스·안드로이드에 Gemini 전면 통합.",
      vp: "검색·유튜브·안드로이드·클라우드 등 수십억 사용자 유통망에 모델을 직접 배포. TPU 자체 칩으로 컴퓨트 수직계열화.",
      direction: "프런티어 모델 연구 + Alphabet 제품 전면 통합. 온디바이스(Gemini Nano)부터 데이터센터까지 풀스택.",
      sources: ["Gemini 앱 MAU 900M+ (Google I/O 2026, Pichai)", "Gemini 3 출시 (Google I/O '26.5)", "AlphaFold 노벨화학상 2024"],
      url: "https://deepmind.google",
    },
    {
      cat: "native", name: "DeepSeek", domain: "deepseek.com", unit: "오픈 파운데이션 모델(중국)",
      valuation: "$50B+", valAsof: "26.06", metric: "추론 비용", value: "GPT-4급 1/10", metricAsof: "26.05",
      funding: "첫 외부 라운드 완료 $7.4B", trend: 50, trendBasis: "효율 혁신·첫 외부 투자 완료",
      note: "DeepSeek-V3, R1 — 중국 최대 AI 연구소. 2026.06.16 첫 외부 투자 라운드 완료(CNY 50B+ ≈ $7.4B 조달, 밸류 $50B+ 확정 — $52B~$59B 범위의 하단부, 중국 국유 빅펀드 주도). R1·V3가 GPT-4급 성능을 약 1/10 비용으로 구현해 'AI 비용 혁명(Sputnik Moment)' 촉발. 단, 국유 펀드 투자로 지정학적 리스크 존재.",
      vp: "압도적 비용 효율과 오픈 가중치 배포로 빠른 채택. AI 인프라 비용 패러다임 전환의 상징.",
      direction: "효율 중심 모델 + 오픈 생태계. 다만 수출 규제·지정학 변수에 노출.",
      sources: ["첫 외부 라운드 완료 $7.4B·밸류 $50B+ (TrendForce / TechStartups '26.06.16)", "R1·V3 1/10 비용 GPT-4급 성능", "중국 국유 빅펀드 주도 (FT '26.6)"],
      url: "https://www.deepseek.com",
    },

    // ── bigtech ──
    {
      cat: "bigtech", name: "Apple", domain: "apple.com", unit: "온디바이스+PCC 하이브리드",
      valuation: "$3.3T", valAsof: "26.06", metric: "처리 방식", value: "온디바이스+PCC", metricAsof: "—",
      funding: "상장 (AAPL)", trend: 5, trendBasis: "온디바이스 AI 통합 범위",
      note: "Apple Intelligence는 온디바이스 처리와 Private Cloud Compute(PCC)를 결합한 하이브리드 아키텍처. 단순 '기기 내 추론'이 아니라, 무거운 작업은 무기명 PCC로 처리하고 민감정보는 기기 밖으로 내보내지 않음. WWDC26에서 Foundation Models 프레임워크가 온디바이스 모델·서버 모델·제3자 LLM 제공자까지 연결하는 개발자 경로를 제공한다고 발표.",
      vp: "온디바이스+PCC 하이브리드로 프라이버시를 지키면서 성능 확보. 하드웨어(Neural Engine)와 OS 수직 통합.",
      direction: "온디바이스·서버·제3자 모델을 잇는 Foundation Models 프레임워크로 개발자 생태계 확장 + 단말 경험 차별화.",
      sources: ["온디바이스 + Private Cloud Compute 하이브리드 (Apple 보안 문서)", "Foundation Models 프레임워크 — 온디바이스/서버/제3자 모델 지원 (WWDC26)"],
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
      note: "Bedrock, Alexa+, Trainium 칩 — AWS Bedrock 멀티모델 호스팅. 2026.04.20 Anthropic에 즉시 $5B 투자 + 향후 최대 $20B 추가 가능(기존 $8B 별도)·AWS $100B 약정. 2026.02 OpenAI $50B 투자+$100B 클라우드 약정과 함께 '양쪽 베팅(two-horse)' 전략. Trainium2로 NVIDIA 의존도 저감. ($14B AWS AI ARR은 [업계 추정])",
      vp: "어느 AI가 이기든 인프라 공급자로서 수익을 확보하는 중립적 클라우드 포지션 + 자체 가속기.",
      direction: "OpenAI·Anthropic 양쪽 투자 + Bedrock 멀티모델 + Trainium 수직계열화로 Azure 대항.",
      sources: ["Anthropic 즉시 $5B + 최대 $20B 추가(기존 $8B 별도) (2026.04.20)", "OpenAI $50B 투자+$100B AWS 약정 (2026.02)", "[업계 추정] AWS AI 서비스 ARR ~$14B (2026E)"],
      url: "https://aws.amazon.com/ai/",
    },
    {
      cat: "bigtech", name: "NVIDIA", domain: "nvidia.com", unit: "AI GPU·CUDA",
      valuation: "$3.5T+", valAsof: "26.06", metric: "분기 매출", value: "$81.6B", metricAsof: "FY27 1Q",
      funding: "상장 (NVDA)", trend: 85, trendBasis: "Q1 FY27 +85% YoY · 분기 $81.6B·DC $75.2B",
      note: "H100/B200 GPU, CUDA — AI 학습/추론 GPU 시장 80%+ 점유. 최신 공개 분기 FY2027 1Q 매출 $81.6B(+85% YoY, 2026.05.20) · 데이터센터 $75.2B(+92% YoY, 전체의 ~92%). Q2 FY27 가이던스 $91.0B±2%(China DC 제외 기준). FY2026 연매출 $215.9B(+65% YoY) — Q4 FY26 $68.1B(+73%)·DC $62.3B(+75%) 포함, 직전 FY2025 연 $130.5B와 구분 필요. 데이터센터 영업이익률 ~74.9%. [업계 추정] B200 출하량은 외부 추정. 개발자 생태계 NVIDIA Developer Program 7.5M+ / CUDA-X 1M+ developers(공식) — '400M 개발자'는 근거 없음.",
      vp: "GPU 하드웨어 80%+ 점유에 CUDA 소프트웨어 락인을 더한 이중 해자. 풀스택(칩·네트워킹·소프트웨어).",
      direction: "Blackwell(B200)·차세대 아키텍처 램프 + DGX Cloud + Omniverse. 전력·공급망이 핵심 변수.",
      sources: ["FY27 1Q 매출 $81.6B(+85%)·DC $75.2B(+92%) (NVIDIA 2026.05.20)", "Q2 FY27 가이던스 $91.0B±2%", "FY2026 연매출 $215.9B · FY2025 $130.5B (구분)", "Developer Program 7.5M+ / CUDA-X 1M+"],
      url: "https://www.nvidia.com",
    },
    {
      cat: "bigtech", name: "Meta AI", domain: "ai.meta.com", unit: "오픈소스 LLM",
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
      valuation: "$5.5B", valAsof: "25.07", metric: "ARR", value: "$240M", metricAsof: "25(2026 갱신 대기)",
      funding: "Series D · IPO 준비", trend: 50, trendBasis: "전 분기 QoQ 50%+",
      note: "기업용·소버린 AI 특화. 표기 수치는 2025년 기준(ARR $240M·밸류 $5.5B, 2025.07) — 2026 최신 공식 수치 미확인으로 업데이트 대기. 2026.05 Command A+ 오픈소스·North Mini Code 출시. Oracle·Salesforce·SAP 파트너십, IPO 준비.",
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
    { date: "2026-06-08", co: "OpenAI", cat: "native", source: "Al Jazeera / Reuters", title: "OpenAI, 미국 증시 S-1 제출 — 밸류 $852B·총 조달 $122B 확정", summary: "· 2026.03.31 최종 라운드 확정: 밸류 $852B post-money·총 조달 $122B(구 $730B+$110B=$840B에서 증액)\n· 2026.06.08 SEC S-1 기밀 제출 — 공모 목표 미확정(최대 $1T 보도)\n· Q1 2026 실매출 $5.7B(분기)·연환산 $25B+ · Non-GAAP 운영 마진 -122%(분기 손실 ~$6.95B)\n· $852B 밸류는 2030년 매출 $280B 가정 기반 — Microsoft 독점 파트너십 재편(종료)", tag: "IPO", url: "https://www.aljazeera.com/economy/2026/6/8/tech-giant-openai-files-for-us-initial-public-offering" },
    { date: "2026-06-09", co: "Anthropic", cat: "native", source: "Anthropic", title: "Anthropic, Claude Fable 5 출시 — 자율 코딩 에이전트 SWE-bench 신기록", summary: "· 최신 플래그십 Claude Fable 5 출시(2026.06.09) — 코딩 에이전트 역대 최고 성능\n· SWE-bench Verified 최상위권, 1M 토큰 컨텍스트·128K 출력\n· Claude Opus 4.6(2026.02)→4.7(2026.04 GA)→Fable 5 빠른 사이클\n· Amazon 추가 $25B 투자 후 AWS Bedrock 최우선 배포", tag: "Product", url: "https://www.anthropic.com/news" },
    { date: "2026-04-21", co: "Google DeepMind", cat: "bigtech", source: "Google", title: "Google, Gemini 3.1 Pro + Deep Research Max — ARC-AGI-2 77.1%", summary: "· Gemini 3.1 Pro ARC-AGI-2 77.1%, SWE-Bench Verified 80.6%\n· Deep Research Max — 자율 리서치 에이전트, MCP 지원\n· 100만 토큰 컨텍스트, 검색·워크스페이스 전면 통합\n· Google AI Ultra 구독자 우선 배포", tag: "Product", url: "https://blog.google/technology/ai/" },
    { date: "2026-01-06", co: "SpaceX (xAI, Cursor)", cat: "native", source: "TechCrunch / NYT / The Guardian", title: "xAI, Series E $20B 완료 — 밸류 $230B+, Grok 딥페이크 논란 동시 직면", summary: "· Series E $20B 완료(NVIDIA·Cisco·카타르 국부펀드·Fidelity)\n· 누적 총 조달액 $42B+(PitchBook) · 밸류 $230B+ 추정\n· Grok+X 합산 도달 6억(독립 제품 MAU와는 구분 — 대부분 X 사용자)\n· Grok 미성년 딥페이크 자동 생성 논란 → 다수 정부 조사 개시", tag: "Funding", url: "https://www.theguardian.com/technology/2026/jan/06/elon-musk-xai-investment-grok-backlash" },
    { date: "2026-06-16", co: "DeepSeek", cat: "native", source: "TrendForce / TechStartups", title: "DeepSeek, 첫 외부 펀딩 완료 — $7.4B 조달·밸류 $50B+ 확정", summary: "· 첫 외부 라운드 완료(CNY 50B+ ≈ $7.4B), 중국 국유 빅펀드 주도\n· 밸류 $50B+ 확정 — $52B~$59B 범위의 하단부\n· R1·V3로 GPT-4급 성능을 1/10 비용 구현\n· 'Sputnik Moment' — AI 인프라 비용 혁신의 상징", tag: "Funding", url: "https://techstartups.com/2026/06/16/deepseek-funding/" },
    { date: "2026-05-28", co: "Anthropic", cat: "native", source: "Anthropic / Reuters", title: "Anthropic, Series H $65B·밸류 $965B — run-rate 매출 $47B로 OpenAI 추월", summary: "· Series H $65B 조달·$965B post-money(직전 2026.02 $380B)\n· 발표문서 run-rate 매출이 '이달 $47B 돌파' 명시 — 4월 $30B에서 6주 만에 급증\n· OpenAI 연환산 $25B을 2배 가까이 추월 — 최대 경쟁 역학 변화\n· Claude Code 단독 $2.5B+ ARR 돌파", tag: "Funding", url: "https://www.anthropic.com/news" },

    // ── Big Tech AI ──
    { date: "2026-06-08", co: "Apple", cat: "bigtech", source: "MacRumors / Apple", title: "Apple WWDC 2026 — Siri AI 재설계, 온디바이스 + Private Cloud Compute 강화", summary: "· Siri를 'Siri AI'로 재설계 — 온디바이스 Foundation Models 중심\n· Private Cloud Compute: 클라우드 처리 시 무기명(Anonymous) 보장\n· 시스템 전역 컨텍스트 이해·Visual Intelligence 확장\n· Foundation Models 프레임워크 외부 개발자 공개 · iOS 27 가을 출시", tag: "Product", url: "https://www.apple.com/apple-intelligence/" },
    { date: "2026-04-29", co: "Microsoft", cat: "bigtech", source: "Microsoft IR / UC Today", title: "Microsoft Q3 FY2026 — AI 연 매출 $37B 런레이트, Azure 35% 재가속", summary: "· Nadella 확인: AI 사업 연 매출 런레이트 $37B(+123% YoY)\n· M365 Copilot 유료 좌석 2,000만 돌파(+250% YoY)\n· 전체 매출 $82.9B(+18%) · Azure 35% 재가속\n· Accenture 74만 좌석 최대 고객", tag: "Earnings", url: "https://www.uctoday.com/unified-communications/microsoft-earnings-2026-ai-copilot-enterprise/" },
    { date: "2026-04-20", co: "Amazon", cat: "bigtech", source: "CNBC / NYT / GeekWire", title: "Amazon, Anthropic에 추가 투자 — 즉시 $5B + 향후 최대 $20B, AWS $100B+ 약정", summary: "· 즉시 $5B 투자 + 향후 최대 $20B 추가 가능(기존 $8B와 별도) — '누적 $33B 완료'는 부정확\n· Anthropic의 AWS 10년 클라우드 약정 $100B+\n· 2개월 전 OpenAI $50B+$100B 딜과 동시 진행 '양쪽 베팅'\n· Bedrock ~100개 파운데이션 모델 지원, Guardrails 80% 인하", tag: "Funding", url: "https://www.cnbc.com/2026/04/20/amazon-invest-up-to-25-billion-in-anthropic-part-of-ai-infrastructure.html" },
    { date: "2026-02-25", co: "NVIDIA", cat: "bigtech", source: "NVIDIA IR / The Verge", title: "NVIDIA Q4 FY2026 분기 매출 $68.1B — FY2026 연 $215.9B 확정", summary: "· Q4 FY2026 분기 매출 $68.1B(+73% YoY, 신기록) · 데이터센터 $62.3B(+75%)\n· FY2026 연 $215.9B 확정(+65% YoY) — Q1 $44.1B+Q2 $46.7B+Q3 $57.0B+Q4 $68.1B (직전 FY2025 $130.5B와 구분)\n· B200 추론 성능 H100 대비 30배, 연 150~200만 대 출하 전망\n· 하이퍼스케일러 자체 칩 190만 가속기 배포로 '분리' 가속", tag: "Earnings", url: "https://www.nvidia.com/en-us/investor-relations/" },
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

    // ── 시장·산업·디바이스(온디바이스 AI 관점) ──
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
    { house: "Bridgewater (Reuters)", type: "Securities", date: "2026-02-23", title: "빅테크 2026 AI 인프라 투자 ~$650B 전망 (2025 ~$410B)", figure: "$650B 투자", rating: "Report", url: "https://www.reuters.com/business/big-tech-invest-about-650-billion-ai-2026-bridgewater-says-2026-02-23/",
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
    { name: "OpenAI", value: 840, cat: "native", src: "2026.02 $730B pre + $110B 신규(post ~$840B)" },
    { name: "SpaceX (xAI, Cursor)", value: 230, cat: "native", src: "xAI Series E '26.1 밸류 $230B+ · Cursor 인수 $60B" },
    { name: "Databricks", value: 134, cat: "startup", src: "Series L '26.2 $134B ($175B 협의)" },
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
    { name: "ChatGPT(주간 활성)", value: 900, cat: "native", src: "OpenAI 2026.02 WAU 900M+" },
    { name: "Gemini 앱(MAU)", value: 900, cat: "bigtech", src: "Google I/O 2026 MAU 900M+" },
    { name: "Meta AI(제품 MAU)", value: 1200, cat: "bigtech", src: "Meta AI 제품 1.2B (Q1 2026 IR, 앱군 Family DAP 35억과 구분)" },
    { name: "X+Grok(합산 도달)", value: 600, cat: "native", src: "xAI Series E — X+Grok combined reach ~600M (Grok 단독 아님)" },
    { name: "GitHub Copilot", value: 200, cat: "bigtech", src: "Microsoft '26.4 (Copilot 좌석 2,000만 별도)" },
    { name: "DeepSeek", value: 150, cat: "native", src: "[업계 추정] '26.4" },
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
    { name: "NVIDIA (FY26 연)", value: 215.9, cat: "bigtech", src: "NVIDIA FY2026 연매출 $215.9B (FY25 $130.5B와 구분)" },
    { name: "Microsoft AI (런레이트)", value: 37.0, cat: "bigtech", src: "Microsoft IR FY26 Q3 — $37B(+123%)" },
    { name: "Anthropic (run-rate)", value: 47.0, cat: "native", src: "run-rate $47B (Series H 발표문 2026.05.28) — OpenAI ARR 추월" },
    { name: "OpenAI (연환산)", value: 25.0, cat: "native", src: "연환산 $25B+ (2026.02) · Q1 실매출 $5.7B" },
    { name: "AWS AI (추정)", value: 14.0, cat: "bigtech", src: "[업계 추정] AWS Bedrock + AI 서비스 ARR" },
    { name: "Databricks (ARR)", value: 2.4, cat: "startup", src: "Databricks IR '25 ARR $2.4B" },
    { name: "Cursor(SpaceX) ARR", value: 2.0, cat: "native", src: "Longbridge '26.6 ARR $2B+" },
    { name: "Scale AI (ARR)", value: 1.4, cat: "startup", src: "Forbes '25 ARR $1.4B 추정" },
  ];

  /* ---- AI Business Models ---- */
  const BIZ_MODELS = [
    { name: "API 사용량 과금", cat: "native", model: "API Usage-based", pricing: "토큰당 과금($0.25~$75/1M)", sub: "무료 티어 + 사용량 과금", revenue: "OpenAI 연환산 $25B+, Anthropic 연환산 $30B+", margin: "비공개", arpu: "기업당 $10K~$10M+/yr", retention: "높음(기술 의존성)", moat: "모델 성능 + 개발자 생태계 + 안전성 프레임워크", strategy: "모델 성능 경쟁 + 엔터프라이즈 침투 + 구독 병행", src: "OpenAI/Anthropic 공식 가격표" },
    { name: "SaaS 구독", cat: "bigtech", model: "SaaS Subscription", pricing: "$20~$60/사용자/월", sub: "Copilot Pro/Business/Enterprise", revenue: "Microsoft AI $37B 런레이트, Copilot 2,000만 좌석", margin: "높음(80%+ 추정)", arpu: "$240~$720/yr", retention: "매우 높음(Office 번들)", moat: "Office/Windows/Teams 락인 + OpenAI 파트너", strategy: "Copilot 전 영역 통합 + 워크플로우 AI 표준화", src: "Microsoft IR FY26 Q3" },
    { name: "오픈소스+엔터프라이즈", cat: "bigtech", model: "Open Source + Enterprise", pricing: "오픈 가중치 무료 + 광고/엔터프라이즈", sub: "Llama 무료 + Meta AI 광고", revenue: "Meta AI 광고 기여 $20B+ 추정", margin: "광고 기반 고마진", arpu: "광고주 기반", retention: "개발자 생태계 락인", moat: "30억 앱 사용자 + 가장 넓은 오픈소스 분포", strategy: "오픈 Llama로 생태계 확장 + AI 광고 최적화", src: "Meta IR '26, Llama 배포 통계" },
    { name: "하드웨어+클라우드", cat: "bigtech", model: "Hardware + Cloud", pricing: "B200 $30K~$50K · DGX Cloud 시간당 과금", sub: "GPU 판매 + DGX Cloud + CUDA 무료", revenue: "NVIDIA $215.9B(FY26 연), 분기 $57B", margin: "~78% 데이터센터 마진", arpu: "기업당 수백만~수십억 달러", retention: "CUDA 7.5M+·CUDA-X 1M+ 개발자 락인", moat: "GPU 80%+ 점유 + CUDA 생태계 + 풀스택", strategy: "B200 램프 + DGX Cloud + Omniverse", src: "NVIDIA IR FY2026" },
    { name: "버티컬 AI 에이전트", cat: "startup", model: "Vertical AI Agent", pricing: "시트/사용량 구독 + 성과 기반", sub: "산업별 전문 에이전트 구독", revenue: "Harvey $190M, Sierra $150M, Glean $200M+ ARR", margin: "SaaS형 고마진 지향", arpu: "기업당 수만~수백만 달러", retention: "워크플로우 내재화로 높음", moat: "도메인 데이터 + 업무 통합 + 규제 신뢰", strategy: "특정 산업 전문화로 수평 LLM과 차별화(ARR 배수 최대 67x)", src: "AgentMarketCap '26, 각사 공식" },
  ];

  /* ---- KPI Cards (6) ---- */
  const KPIS = [
    { label: "글로벌 AI 시장 (2025)", value: "$390.9B", delta: +40, sub: "Grand View Research 최신판 · 2026E $539.5B · 2030E $1,812B", fill: 0.74, src: "Grand View Research AI Market Report '26 최신판" },
    { label: "OpenAI 밸류 (2026.03)", value: "$852B", delta: +120, sub: "post-money · 총 조달 $122B 확정 · S-1 제출(공모 목표 미확정)", fill: 0.92, src: "Bloomberg/CNBC 2026.03.31" },
    { label: "Anthropic run-rate", value: "$47B", delta: +188, sub: "Series H 발표문 · 6주 만에 $30B→$47B · OpenAI ARR 추월", fill: 0.98, src: "Anthropic 공식 2026.05.28" },
    { label: "NVIDIA 매출 (FY27 1Q)", value: "$81.6B", delta: +85, sub: "+85% YoY · DC $75.2B(+92%) · Q2 가이던스 $91B", fill: 0.90, src: "NVIDIA IR 2026.05.20" },
    { label: "Microsoft AI 런레이트", value: "$37B", delta: +123, sub: "Copilot 2,000만 좌석 · Azure 35% 재가속", fill: 0.78, src: "Microsoft IR FY26 Q3" },
    { label: "ChatGPT 주간 활성 사용자", value: "900M+", delta: +60, sub: "OpenAI 2026.02 발표", fill: 0.80, src: "OpenAI 공식 2026.02" },
  ];

  /* ---- Insight Cards (9) ---- */
  const INSIGHTS = [
    { title: "Anthropic, OpenAI ARR 추월 — 최대 경쟁 역학 변화", desc: "Anthropic run-rate 매출이 2026.05 $47B로 6주 만에 $30B(4월)에서 급증해 OpenAI 연환산 $25B을 2배 가까이 추월. NVIDIA $215.9B·Microsoft AI $37B까지 더하면 GenAI 런레이트 합계는 $100B을 훌쩍 넘어 독립 산업화", icon: "ai", src: "Anthropic Series H '26.05.28, Microsoft IR" },
    { title: "OpenAI 수익성 역설 — 밸류 $852B vs 마진 -122%", desc: "OpenAI는 $852B(2026.03) 밸류로 S-1 제출했으나 Q1 Non-GAAP 운영 마진 -122%(분기 손실 ~$6.95B)로 연 캐시번이 연매출($30B 목표)에 육박. $852B는 2030년 매출 $280B 가정 기반 — 파운데이션 모델(대규모 적자) vs NVIDIA(~75% 마진)의 수익성 스펙트럼 양극단", icon: "pulse", src: "The Information '26.05, Bloomberg" },
    { title: "AI 칩 전쟁 — NVIDIA vs 커스텀 실리콘", desc: "NVIDIA B200이 AI 학습 시장 80%+를 점유하나, Google TPU·Amazon Trainium·Microsoft Maia 등 커스텀 칩이 추격. DeepSeek의 1/10 비용 모델로 효율이 핵심 변수로 부상", icon: "chip", src: "Goldman Sachs '26.02, NVIDIA IR FY26" },
    { title: "AI 에이전트 — 파일럿에서 프로덕션으로", desc: "Gartner: 2026년 말 엔터프라이즈 앱 40%에 task-specific 에이전트 내장(2025년 <5%에서), 2028년 SW 33%에 agentic AI 포함, 2026 agentic AI 지출 $201.9B(+141% YoY). 단, 프로젝트 40%+는 2027년까지 취소 경고. 독립 시장조사 기준 에이전트 시장은 $8.8~12.1B(2026)→$33.9~53.2B(2030~32)", icon: "spark", src: "Gartner '26 / Reuters '25.6, 독립 시장조사" },
    { title: "버티컬 AI — 모든 산업에 $1B+ 유니콘", desc: "법률(Harvey $11B), 음성(ElevenLabs $11B), 기업검색(Glean $7.2B), 고객서비스(Sierra $10B) — 수평 LLM 경쟁에서 산업 전문화 AI로 투자 이동. ARR 배수 최대 67x", icon: "chart", src: "AgentMarketCap '26.04, 각사 공식" },
    { title: "오픈소스 vs 클로즈드 — 전략 분기", desc: "Meta Llama·Mistral·DeepSeek 등 오픈 가중치 모델이 도입을 가속하며 클로즈드 모델과 성능 격차 축소. EU AI Act 규제 환경에서 오픈소스 선호도 상승", icon: "chart", src: "Mistral·Meta·DeepSeek 공식, EU AI Act" },
    { title: "Physical AI — AI가 현실 세계로", desc: "Tesla Optimus Gen 3 제한 생산(2026 여름), Figure AI 공장 배포, Waymo 밸류 $126B. 골드만삭스: 2026년 인간형 로봇 5~10만 대 출하·휴머노이드 TAM 2035E $38B(구 $6B서 6배↑, 단가 $4~6만으로 하락). 물리적 AI 전체(자율주행 포함)는 별도 추정 2035E $1.15T — scope 구분", icon: "chip", src: "Goldman Sachs '26, Pomegra '26" },
    { title: "AI 전력 수요 쇼크 — 데이터센터가 전력망을 흔들다", desc: "IEA: 데이터센터 전력 소비 460 TWh는 2022년 수치(2024년은 ~415~490 TWh로 조정) → 2030E ~945 TWh로 수렴(전망 범위는 출처마다 상이). 미국 비중 2023년 4.4% → 2028년 6.7~12%(EIA). 전력 확충이 반도체보다 핵심 병목", icon: "spark", src: "IEA Energy & AI '25, EIA '26" },
    { title: "GenAI ROI — $1 투자 → $3.70 회수", desc: "성숙 AI 기업 평균 ROI $4.60/$1(Accenture), 파일럿 단계 $1.20/$1. 개발자 생산성 +26~40%. 회수기간: 고객서비스 4.1개월·마케팅 6.7개월·엔지니어링 9.3개월. 단 전사 ROI 체감은 29%에 그침", icon: "chart", src: "Accenture '26, McKinsey '26, Futurum '26" },
    { title: "AI 고용 충격 — 3억 명 노출, '고용 없는 성장'", desc: "Goldman Sachs: 전 세계 3억 명 일자리가 AI에 노출, 2026년 2,500만 대체 → 2030년 2.7억. 행정(26%)·고객서비스(20%)가 취약. 다만 신직종 창출로 순 고용 효과는 중립~플러스 전망", icon: "pulse", src: "Goldman Sachs Research '26.01" },
    { title: "NVIDIA, AI PC용 Arm CPU 진입 — 노트북 시장 공략", desc: "NVIDIA가 MediaTek와 공동 개발한 Arm 기반 PC SoC 'N1·N1X'(Blackwell GPU 통합)로 AI PC 노트북·데스크톱에 진입(2026 예상). Apple M·Qualcomm Snapdragon X와 경쟁. AI PC는 2026년 신규 PC 출하의 40%+(Canalys), 2027년 과반 전망. CES 2025 GB10 데스크톱(Project DIGITS)도 공개", icon: "chip", src: "Canalys '26, NVIDIA CES 2025, 업계 보도" },
  ];

  /* ---- Widget 1: Capability vs Reliability Gap ----
     AI 성능(capability)은 빠르게 오르지만 신뢰성(reliability, 구조화 과제 성공률)은 뒤처짐.
     cap=벤치마크 성능, rel=실제 자율 성공률(나머지는 실패·휴먼 개입). 출처: Stanford HAI AI Index 2026 등. */
  const CAP_REL = [
    { period: "2024 H1", cap: 12, rel: 9, note: "에이전트 OSWorld ~12% · 실사용 성공률 한 자릿수", src: "Stanford HAI AI Index 2026" },
    { period: "2024 H2", cap: 28, rel: 18, note: "도구사용 LLM 급성장 · 신뢰성은 지연", src: "Stanford HAI AI Index 2026" },
    { period: "2025 H1", cap: 42, rel: 27, note: "Computer Use 등장 · OSWorld 38.1%(OpenAI)", src: "OpenAI / HAI '26" },
    { period: "2025 H2", cap: 55, rel: 38, note: "WebArena 58% · 구조화 과제 ~1/3 실패 지속", src: "OpenAI / HAI '26" },
    { period: "2026 H1", cap: 66, rel: 45, note: "OSWorld ~66% 도달 · 그러나 ~1/3 여전히 실패", src: "Stanford HAI AI Index 2026" },
  ];

  /* ---- Widget 3: Fact-Check Layer ----
     핵심 수치마다 grade(A 공식/B 보도/C 추정)·type·검증일·소스를 명시. */
  const FACTCHECK = [
    { item: "OpenAI 밸류·조달", value: "$852B post · 총 조달 $122B", grade: "A", type: "공식", verified: "2026-06-17", src: "2026.03.31 확정 (Bloomberg/CNBC) — 구 '$730B+$110B=$840B'에서 증액" },
    { item: "OpenAI 연환산 매출", value: "$25B+ · Q1 실매출 $5.7B", grade: "A", type: "공식·보도", verified: "2026-06-17", src: "OpenAI·Reuters '26.02 / The Information '26.05" },
    { item: "OpenAI 운영 마진", value: "Non-GAAP -122% (Q1 손실 ~$6.95B)", grade: "B", type: "보도", verified: "2026-06-17", src: "The Information '26.05 (단순 '$3.7B'은 과소표현)" },
    { item: "Anthropic run-rate 매출", value: "$47B (OpenAI ARR 추월)", grade: "A", type: "공식", verified: "2026-06-17", src: "Series H 발표문 '26.05.28 — 4월 $30B에서 급증" },
    { item: "NVIDIA FY2026 / FY27 1Q", value: "$215.9B 연 · 1Q $81.6B·DC $75.2B", grade: "A", type: "공식", verified: "2026-06-17", src: "NVIDIA IR (Q2 FY27 가이던스 $91B)" },
    { item: "Gartner 에이전트 내장률", value: "40% by 2026말 · 현재 배포 17%", grade: "B", type: "전망·현재", verified: "2026-06-17", src: "Gartner '26.05 (전망 40% vs 현재 17% 병기, '80%'는 오인용)" },
    { item: "글로벌 AI 지출(2026)", value: "전체 $2.59T (+47%) ≠ 순수시장 $539.5B", grade: "B", type: "전망·scope", verified: "2026-06-17", src: "Gartner '26.05.19(전체) / GVR(순수 AI 시장) — scope 다름" },
    { item: "Meta AI 제품 MAU", value: "1.2B (Family DAP 35억과 구분)", grade: "A", type: "공식", verified: "2026-06-17", src: "Meta Q1 2026 IR (DAP QoQ -5% 리스크 부기)" },
    { item: "DeepSeek 펀딩", value: "완료 $7.4B · 밸류 $50B+", grade: "B", type: "보도", verified: "2026-06-17", src: "TrendForce '26.06.16 (구 '협의중'에서 완료)" },
    { item: "Goldman 휴머노이드 TAM", value: "2035E $38B (구 $6B서 6배↑)", grade: "B", type: "보고서·scope", verified: "2026-06-17", src: "Goldman Sachs '26 (physical AI 전체 $1.15T와 scope 다름)" },
    { item: "IEA 데이터센터 전력", value: "460TWh=2022 (2024는 ~415~490)", grade: "C", type: "기준연도 주의", verified: "2026-06-17", src: "IEA Energy & AI '25 (2030E ~945TWh)" },
    { item: "Cohere ARR/밸류", value: "$240M / $5.5B (2025)", grade: "C", type: "구버전", verified: "2025-07", src: "2026 최신 공식 미확인 — 업데이트 대기" },
  ];

  /* ---- Q&A Pairs (Korean) ---- */
  const QA_PAIRS = [
    { q: "OpenAI의 현재 밸류와 IPO 전망은?", a: "OpenAI는 2026.03 라운드로 밸류 $840B(사모 사상 최고)를 기록했고, 2026.06.08 SEC에 S-1을 비밀 제출(이르면 2026.09 상장 목표)했습니다. 주간 활성 사용자 900M+, 연환산 매출은 $25B+(2026.02 회사·Reuters 확인, 궤적 $6B→$20B→$25B)이며 ~$35B 등 그 이상은 외부 추정입니다. 다만 함정도 있습니다: 2026 Q1에만 $3.7B를 소각해 연 $15B+ 운영 적자 수준입니다. $840B 밸류는 현재 수익성이 아니라 'AI가 OS가 되는 미래'에 베팅한 가격입니다. 모델은 GPT-5(2025.08)→GPT-5.4→GPT-5.5(2026.04)로 빠르게 갱신됩니다.", nav: "native", keywords: ["openai", "ipo", "밸류", "840", "s-1", "상장", "적자", "gpt-5"] },
    { q: "OpenAI의 실제 매출은? $12.7B가 맞나요?", a: "$12.7B은 오래된 수치입니다. 회사·Reuters가 확인한 가장 최근 공식 수치는 연환산 매출 $25B+(2026.02 말, 월 매출 ~$2B)입니다. 궤적은 $6B(2024말)→$20B(2025말, CFO 확인)→$25B+(2026.02 확인)이며, ~$35B 등 그 이상은 외부 추정치입니다. 어느 쪽이든 S-1 제출 시 밸류 ~$840B(2026.02 $730B pre-money)의 근거가 됩니다.", nav: "native", keywords: ["openai", "arr", "매출", "수익", "재무", "25"] },
    { q: "Anthropic과 OpenAI의 차이는?", a: "Anthropic은 Constitutional AI 기반 안전성 우선 설계가 핵심입니다. 2026.05.28 Series H $65B 조달로 밸류 $965B post-money(직전 2026.02 Series G $380B)를 기록했고, 연환산 매출 $30B+(2026.04, Reuters)에 코딩 에이전트 성능이 최상위권입니다. OpenAI가 소비자 시장(ChatGPT 900M+)을 선도하는 반면, Anthropic은 규제 산업 엔터프라이즈에서 신뢰를 쌓고 있습니다.", nav: "native", keywords: ["anthropic", "claude", "openai", "차이", "965", "amazon"] },
    { q: "Amazon은 왜 OpenAI·Anthropic 양쪽에 투자하나요?", a: "AWS의 '양쪽 베팅(two-horse)' 전략입니다. 2026.02 OpenAI에 $50B 투자+$100B AWS 약정, 2개월 뒤 2026.04.20 Anthropic에 즉시 $5B+향후 최대 $20B(기존 $8B와 별도)+$100B AWS 약정을 체결했습니다. 어느 AI가 이기든 인프라 공급자로서 수익을 확보하고, Azure-OpenAI 독점 구도를 견제하려는 포석입니다.", nav: "bigtech", keywords: ["amazon", "aws", "anthropic", "openai", "투자", "전략", "베팅"] },
    { q: "Cursor가 SpaceX에 인수된다는데 코딩 AI 시장은?", a: "SpaceX(xAI 생태계)가 2026.06.16 Cursor(Anysphere)를 $60B 주식 인수에 합의했습니다(2026 Q3 완료 예정). Cursor ARR은 $2B+, 기업 고객 60%이며 Stripe·Adobe·NVIDIA가 고객입니다. 밸류는 $29.3B→$50B→$60B로 뛰었습니다. 본 대시보드는 'SpaceX (xAI, Cursor)'로 통일 표기합니다. 이는 GitHub Copilot·OpenAI Codex·Claude Code와의 경쟁 격화 신호입니다.", nav: "native", keywords: ["cursor", "spacex", "xai", "인수", "코딩", "에이전트", "60"] },
    { q: "Microsoft의 AI 매출은 얼마나 되나요?", a: "Satya Nadella가 Q3 FY2026 실적에서 AI 부문 연 매출 런레이트 $37B(+123% YoY)를 공식 확인했습니다. M365 Copilot 유료 좌석은 2,000만(+250%)을 돌파했고 Azure는 35% 재가속했습니다. Accenture가 74만 좌석으로 최대 고객입니다.", nav: "bigtech", keywords: ["microsoft", "copilot", "azure", "매출", "37", "런레이트"] },
    { q: "NVIDIA가 압도적인 이유는?", a: "AI GPU 시장 80%+ 점유에 CUDA 소프트웨어 락인(7.5M+·CUDA-X 1M+ 개발자, 10년 축적)이 더해진 이중 해자입니다. Q3 FY2026 분기 매출 $57B·데이터센터 $51.2B(+66%), FY26 연 $215.9B를 기록했습니다. B200은 H100 대비 추론 30배, 연 150~200만 대 출하 전망입니다. 다만 위협도 큽니다: 하이퍼스케일러 4곳(Google TPU v7·Amazon Trainium 3·MS Maia 2·Meta MTIA 2)의 자체 칩 합산 배포가 190만 가속기에 달해 '분리'가 시작됐습니다. 그래도 CUDA 대체에는 5~7년이 걸린다는 평가이며 FY27 데이터센터 전망은 오히려 $105~120B로 상향됐습니다.", nav: "bigtech", keywords: ["nvidia", "엔비디아", "gpu", "b200", "cuda", "57", "tpu", "trainium"] },
    { q: "DeepSeek가 왜 중요한가요?", a: "중국 DeepSeek의 R1·V3 모델은 GPT-4급 성능을 약 1/10 비용으로 구현해 'AI 비용 혁명(Sputnik Moment)'을 촉발했습니다. 2026년 첫 외부 라운드에서 목표 밸류 $52B~$59B(중국 국유 빅펀드 주도)입니다. 효율 패러다임 전환의 상징이지만, 국유 자본·수출규제 등 지정학 리스크가 있습니다.", nav: "native", keywords: ["deepseek", "딥시크", "중국", "비용", "효율", "r1"] },
    { q: "AI 에이전트란 무엇이며 도입 현황은?", a: "AI 에이전트는 단순 챗봇을 넘어 스스로 계획을 세우고 작업을 실행하는 자율 시스템입니다. Gartner 공개 예측 기준 2026년 말 엔터프라이즈 앱의 40%에 에이전트가 내장되고(2025년 5% 미만에서 급증), 2028년에는 엔터프라이즈 SW의 33%가 agentic AI를 포함하며 일상 업무 의사결정의 15%가 자율 수행될 전망입니다. 2026년 agentic AI 지출은 $201.9B(+141% YoY)로 전망되나, 동시에 agentic AI 프로젝트의 40%+가 2027년까지 비용·불명확한 가치 때문에 취소될 것이라는 경고(Gartner)도 공존합니다. Harvey(법률)·Sierra(고객서비스)·Glean(기업검색) 등 버티컬 에이전트가 고성장 중입니다.", nav: "dynamics", keywords: ["에이전트", "agentic", "자율", "엔터프라이즈", "도입", "gartner", "201", "취소"] },
    { q: "가장 빠르게 성장하는 AI 스타트업은?", a: "ElevenLabs($11B·음성), Harvey($11B·법률), Sierra($10B·고객서비스), Glean($7.2B·기업검색), Databricks($134B·데이터+AI), Mistral($23B·유럽) 등입니다. 수평 LLM에서 산업 전문 '버티컬 AI'로 투자가 이동 중이며, ARR 배수가 최대 67x(Sierra)에 이릅니다. (Cursor는 SpaceX에 $60B로 인수돼 'SpaceX (xAI, Cursor)'로 편입됐습니다.)", nav: "startup", keywords: ["스타트업", "성장", "빠른", "버티컬", "elevenlabs", "harvey"] },
    { q: "상장 AI 기업 주가는 어디서 보나요?", a: "본 대시보드 하단 '주가 차트' 섹션에서 NVIDIA·Microsoft·Amazon·Apple·Alphabet(Google)·Meta의 일별 주가와 시가총액을 1년/5년으로 볼 수 있습니다. 주가는 매일 자동 크롤링된 실제 종가(Stooq)이며, 차트에 마우스를 올리면 해당일 종가가, 주요 변곡점에는 상승/하락 사유가 표시됩니다. SpaceX(xAI, Cursor)는 SPCX 티커의 일별 종가를 매일 자동 크롤링해 함께 표시합니다.", nav: "stocks", keywords: ["주가", "주식", "차트", "상장", "stock", "시총", "변곡점", "spcx"] },
    { q: "Physical AI(물리적 AI)란?", a: "소프트웨어를 넘어 로봇·자율주행 등 현실 세계로 들어간 AI입니다. Waymo 로보택시(밸류 $126B), Tesla Optimus, Figure AI 공장 배포 등이 대표 사례입니다. 골드만삭스는 2026년 인간형 로봇 5~10만 대 출하를 전망하며, 물리적 AI 시장은 2035E $1.15T(CAGR 33.5%)로 추정됩니다.", nav: "insights", keywords: ["physical", "물리적", "로봇", "자율주행", "waymo", "optimus"] },
    { q: "AI가 정말 일자리를 빼앗나요?", a: "Goldman Sachs(2026.01)는 전 세계 3억 명의 일자리가 AI에 노출되며, 2026년 2,500만 대체 → 2030년 2.7억으로 확대될 것으로 추정합니다. 행정(26%)·고객서비스(20%)가 취약합니다. 다만 AI 신규 직종 창출로 순 고용 효과는 중립~플러스 전망이며, GenAI 사용자는 비사용자 대비 직업 안정성이 더 높다는 데이터도 있습니다.", nav: "insights", keywords: ["일자리", "고용", "자동화", "실직", "goldman", "직업"] },
    { q: "오픈소스와 클로즈드 모델의 차이는?", a: "오픈 가중치 모델(Llama·Mistral·DeepSeek)은 무료 배포로 커스터마이징·데이터 보안·비용 통제가 가능합니다. 클로즈드 모델(GPT·Claude)은 최고 성능을 API로 제공하며 인프라 부담이 없습니다. 2026년 성능 격차가 빠르게 줄고 있으며, EU AI Act 환경에서는 오픈소스 선호가 높습니다.", nav: "dynamics", keywords: ["오픈소스", "llama", "deepseek", "클로즈드", "차이"] },
    { q: "2026년 AI 시장 규모와 투자 전망은?", a: "Grand View Research 최신판 기준 2025년 글로벌 AI 시장은 $390.9B, 2026E $539.5B이며, 2030년 $1,811.75B 전망(CAGR ~35%, 기준연도에 따라 30.6~36.6%)입니다. 구판의 2024년 $279.22B 수치에서 상향됐습니다. 산업별로는 BFSI(금융)·헬스케어·리테일·IT통신 순으로 채택이 빠릅니다. KPMG에 따르면 Q1 2026 글로벌 VC는 $330.9B 신기록이며 AI가 미국 VC의 73%를 차지했습니다. AI 인프라에 2025~2028 누적 $1T+ 투자가 예상됩니다.", nav: "overview", keywords: ["시장", "규모", "투자", "전망", "버티컬", "산업", "330", "vc"] },
    { q: "ChatGPT가 Google 검색을 죽이나요? 실제 숫자는?", a: "'Google이 망한다'는 말은 2023년부터 나왔지만 실제는 더 복잡합니다. Google은 여전히 글로벌 검색 74~80%를 점유합니다. ChatGPT Search는 글로벌 쿼리 17~18%로 급성장했고, Gemini는 LLM 트래픽의 20%를 차지합니다. 더 의미있는 지표는 세션 깊이로, Perplexity 사용자의 세션당 쿼리는 Google의 4.5배입니다. 역설은 OpenAI가 2025.09 EU에 'Google·Apple·MS의 데이터 독점이 경쟁을 막는다'고 신고한 점 — AI 검색의 진짜 해자는 아직 모델이 아니라 데이터입니다.", nav: "dynamics", keywords: ["구글", "검색", "chatgpt", "시장점유율", "gemini", "perplexity", "검색전쟁"] },
    { q: "AI 추론 비용은 얼마나 빠르게 떨어지나요?", a: "AI 추론 비용은 2021년 대비 약 280배 하락했습니다. GPT-4급 API가 2023.03 $60/100만 토큰에서 2026년 초 $0.40 이하로 폭락(연 10배), Blackwell은 H100 대비 추론 비용을 10~15배 추가 절감했습니다. 그러나 역설이 있습니다: 단가가 90% 하락하는 동안 기업 총 AI 인프라 지출은 오히려 320% 증가했고(쌀수록 더 많이 씀), 최고 성능 프런티어 모델은 여전히 $15~$75/100만 토큰 프리미엄을 유지합니다. 평범한 인텔리전스는 공짜로 수렴하되 최첨단 추론의 프리미엄은 벌어집니다.", nav: "dynamics", keywords: ["추론", "비용", "inference", "토큰", "가격", "commoditization"] },
    { q: "AI 할루시네이션은 얼마나 심각한가요?", a: "할루시네이션이 2024년 한 해 전 세계 기업에 약 $67.4B 손실을 일으켰다는 추정이 있습니다. 모델별 실측(요약 작업): Gemini 2.0 Flash 0.7%, GPT-4o 1.5%, Claude 4.6 4%, 평균 프로덕션 ~9.2%, 법률 분야는 17~34%까지 치솟습니다(Stanford HAI). 역설은 가장 비싼 추론 모델이 오히려 근거 기반 작업에서 확신에 차 더 높은 할루시네이션을 보일 수 있다는 점입니다. IT 전문가 68%가 프로덕션에서 직접 목격했고, 엔터프라이즈 사용자 47%가 할루시네이션 정보로 실제 의사결정을 내린 적이 있다고 답했습니다.", nav: "dynamics", keywords: ["할루시네이션", "hallucination", "거짓", "신뢰", "오류", "위험"] },
    { q: "AI 투자 붐인데 왜 스타트업이 망하나요?", a: "2024년 창업한 14,000개+ AI 스타트업 중 2025년에만 3,800개가 폐업(1년 실패율 27%), 2026년 초 추가 1,800개가 닫아 누적 생존율 60%입니다. 3가지 사망 패턴: (1) '래퍼 신드롬' — OpenAI API를 얇게 감싸 팔다 본사가 같은 기능을 내면 우위 상실, (2) '파일럿 지옥' — MIT 기준 AI 파일럿의 95%가 측정 가능한 ROI 실패, (3) '비용 역진' — API 단가 급락으로 저가 차별화 소멸. 생존한 40%의 공통점은 독점 데이터(Scale), 규제 전문성(Harvey), 워크플로우 깊은 통합(Cursor)입니다.", nav: "startup", keywords: ["스타트업", "실패", "폐업", "버블", "wrapper", "파일럿", "roi"] },
    { q: "빅테크가 AI를 독점한다는 반독점 조사는?", a: "미 DOJ는 NVIDIA, FTC는 Microsoft·OpenAI를 조사 중입니다. 핵심 이슈는 '순환 지출' — MS가 OpenAI에 투자한 $13B+ 상당이 Azure 크레딧 형태라 사실상 클라우드 락인을 구조화한다는 지적입니다. NVIDIA는 GPU 80%+ 점유보다 CUDA 7.5M+·CUDA-X 1M+ 개발자 락인이 진입장벽이라는 점이 문제입니다. 미국이 글로벌 AI 컴퓨트의 75%(중국 15%)를 장악합니다. 아이러니하게도 OpenAI는 자신이 도전받자 2025.09 EU에 Google·Apple·MS를 반독점으로 신고했습니다.", nav: "bigtech", keywords: ["반독점", "독점", "ftc", "doj", "규제", "antitrust", "순환"] },
    { q: "Google·Amazon 자체 칩으로 NVIDIA 시대는 끝나나요?", a: "당분간 안 무너지지만 '분리(Decoupling)'는 시작됐습니다. 2026년 Google TPU v7(Ironwood)·Amazon Trainium 3·Microsoft Maia 2·Meta MTIA 2가 양산에 진입, 4대 하이퍼스케일러 자체 칩 합산 배포가 약 190만 가속기로 추정됩니다. TPU v7 추론 효율/와트는 B200의 약 2배입니다. 그러나 NVIDIA의 진짜 해자는 하드웨어가 아니라 CUDA 생태계(7.5M+·CUDA-X 1M+ 개발자, 10년 축적)로, 대체에 5~7년이 걸린다는 평가입니다. 실제 NVIDIA FY27 데이터센터 매출 전망은 오히려 $105~120B로 상향됐습니다.", nav: "bigtech", keywords: ["nvidia", "tpu", "trainium", "칩", "cuda", "반도체", "custom"] },
    { q: "미국의 중국 AI 칩 수출통제는 효과가 있나요?", a: "느리게 작동하고 그 사이 중국이 우회로를 만들었습니다. 미국이 글로벌 AI 컴퓨트의 75%, 중국이 15%를 차지하지만, 2026.05.31 미 상무부는 미국 기업들이 1년 이상 중국 자회사에 고성능 칩을 불법 판매해온 사실을 인정했습니다. DeepSeek의 R1은 칩 부족을 알고리즘 효율로 돌파해 GPT-4급을 1/10 비용에 구현했는데, 이것이 더 위협적입니다 — 칩 규제는 막아도 알고리즘 혁신은 막을 수 없기 때문입니다. 중국은 '평행 구매' 정책으로 Huawei·SMIC 내수 생산을 의무 확대 중입니다.", nav: "dynamics", keywords: ["중국", "수출통제", "deepseek", "huawei", "지정학", "미중", "export"] },
    { q: "앤스로픽의 기업가치(밸류)는 얼마인가요?", a: "Anthropic의 최신 기업가치는 2026.05.28 Series H $65B 조달로 $965B post-money(회사 발표)입니다. 직전 2026.02 Series G가 $380B였으니 약 3개월 만에 2.5배 뛴 셈입니다. 연환산 매출은 2026.04 기준 $30B+(Reuters)를 돌파했습니다. Amazon은 기존 $8B 외에 2026.04 즉시 $5B 투자 + 향후 최대 $20B 추가 가능을 발표했고(별도 합산), Anthropic은 AWS에 10년간 $100B+ 클라우드 사용을 약정했습니다.", nav: "native", keywords: ["앤스로픽", "anthropic", "밸류", "기업가치", "965", "amazon"] },
    { q: "엔비디아 CPU를 탑재한 AI 노트북 시장은 어떤가요?", a: "NVIDIA는 그동안 GPU 중심이었지만, MediaTek와 공동 개발한 Arm 기반 PC용 SoC 'N1·N1X'(Blackwell GPU 통합)로 AI PC 노트북·데스크톱 시장에 진입합니다(2026 출시 예상). Apple M 시리즈·Qualcomm Snapdragon X·Intel/AMD와 경쟁합니다. AI PC(온디바이스 NPU 탑재)는 Canalys 기준 2026년 신규 PC 출하의 약 40%+, 2027년 과반으로 전망되며 온디바이스 추론 수요가 견인합니다. NVIDIA는 CES 2025에서 GB10 기반 데스크톱(Project DIGITS)도 공개해 로컬 AI 워크스테이션 시장도 노립니다. 변수는 Arm PC의 x86 호환성·소프트웨어 생태계입니다.", nav: "bigtech", keywords: ["엔비디아", "노트북", "ai pc", "cpu", "arm", "n1x", "mediatek", "온디바이스", "snapdragon"] },
    { q: "SpaceX·xAI·Cursor는 무슨 관계인가요?", a: "모두 일론 머스크 생태계로 묶입니다. xAI는 머스크의 AI 기업(Grok)이고, SpaceX는 2026.06 IPO 직후 AI 코딩 에이전트 Cursor(Anysphere)를 $60B에 인수했습니다. 본 대시보드는 이를 'SpaceX (xAI, Cursor)'로 통일해 표기합니다. Cursor는 ARR $2B+, 기업 고객 60%(Stripe·Adobe·NVIDIA)였고, 인수로 xAI의 코딩 에이전트 역량이 강화됩니다. SpaceX는 SPCX 티커로 거래되며, 주가 차트에 SPCX 일별 종가가 매일 자동 갱신됩니다.", nav: "native", keywords: ["spacex", "xai", "cursor", "머스크", "인수", "코딩", "spcx"] },
    { q: "AI 에이전트가 스마트폰에서 지금 당장 할 수 있는 일과 아직 위험한 일은?", a: "지금 적합한 영역은 검색·요약·번역·사진 편집·일정 정리·설정 변경·쇼핑 후보 비교·이메일 초안처럼 위험이 낮고 되돌릴 수 있는 작업입니다. 반대로 결제·계약·계정 변경·의료/금융 판단·외부 전송은 사용자 승인, 작업 로그, 취소 기능, 권한 제한이 반드시 필요합니다. OpenAI의 Computer Use 모델도 WebVoyager 87%·OSWorld 38.1%로 아직 실수 가능성과 휴먼 감독 필요성을 명시했습니다. 모바일 에이전트는 당분간 완전 자동화보다 '승인형 자동화(approval-based)'가 현실적이며, 작업 로그·취소/복구·민감 작업 차단이 핵심 UX입니다.", nav: "dynamics", keywords: ["에이전트", "agent", "스마트폰", "모바일", "승인", "자동화", "computer use", "온디바이스"] },
  ];

  /* ---- Monthly Trend: Top AI Apps (M downloads) ---- */
  const APP_MONTHLY = [
    { month: "2026-01", apps: [
      { name: "ChatGPT", ios: 45, android: 62, src: "SensorTower '26.1" },
      { name: "Gemini", ios: 18, android: 35, src: "SensorTower '26.1" },
      { name: "Grok", ios: 12, android: 16, src: "SensorTower '26.1" },
      { name: "DeepSeek", ios: 14, android: 11, src: "SensorTower '26.1" },
      { name: "Perplexity", ios: 8, android: 5, src: "SensorTower '26.1" },
      { name: "Claude", ios: 5, android: 3, src: "SensorTower '26.1" },
    ]},
    { month: "2026-02", apps: [
      { name: "ChatGPT", ios: 48, android: 65, src: "SensorTower '26.2" },
      { name: "Gemini", ios: 20, android: 38, src: "SensorTower '26.2" },
      { name: "Grok", ios: 13, android: 18, src: "SensorTower '26.2" },
      { name: "DeepSeek", ios: 15, android: 12, src: "SensorTower '26.2" },
      { name: "Perplexity", ios: 9, android: 6, src: "SensorTower '26.2" },
      { name: "Claude", ios: 6, android: 3.5, src: "SensorTower '26.2" },
    ]},
    { month: "2026-03", apps: [
      { name: "ChatGPT", ios: 52, android: 70, src: "SensorTower '26.3" },
      { name: "Gemini", ios: 22, android: 42, src: "SensorTower '26.3" },
      { name: "Grok", ios: 14, android: 20, src: "SensorTower '26.3" },
      { name: "DeepSeek", ios: 16, android: 13, src: "SensorTower '26.3" },
      { name: "Perplexity", ios: 10, android: 7, src: "SensorTower '26.3" },
      { name: "Claude", ios: 7, android: 4, src: "SensorTower '26.3" },
    ]},
    { month: "2026-04", apps: [
      { name: "ChatGPT", ios: 55, android: 73, src: "SensorTower '26.4" },
      { name: "Gemini", ios: 24, android: 45, src: "SensorTower '26.4" },
      { name: "Grok", ios: 15, android: 22, src: "SensorTower '26.4" },
      { name: "DeepSeek", ios: 17, android: 14, src: "SensorTower '26.4" },
      { name: "Perplexity", ios: 11, android: 8, src: "SensorTower '26.4" },
      { name: "Claude", ios: 8, android: 5, src: "SensorTower '26.4" },
    ]},
    { month: "2026-05", apps: [
      { name: "ChatGPT", ios: 58, android: 76, src: "SensorTower '26.5" },
      { name: "Gemini", ios: 26, android: 48, src: "SensorTower '26.5" },
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
      { name: "OpenAI", value: 2900, src: "연환산 매출 $25B+ 기준(2026.02 확인)" },
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
        { date: "2026-04-20", dir: "up", label: "Anthropic +$25B 투자", reason: "Anthropic 추가 $25B(기존 $8B+즉시 $5B(추가 최대 $20B 가능))·AWS $100B 약정 발표. 양쪽 베팅 전략 부각." },
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
      events: [
        { date: "2026-06-16", dir: "up", label: "Cursor $60B 인수 발표", reason: "AI 코딩 에이전트 Cursor(Anysphere)를 $60B 주식 인수 합의. xAI 코딩 전략 강화." },
      ],
      note: "SPCX 티커의 일별 주가를 매일 자동 크롤링하여 표시합니다. (Yahoo/Stooq/Nasdaq 순서로 수집)",
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

  return { CATEGORIES, COMPANIES, ARTICLES, REPORTS, MARKET_GROWTH, MARKET_VERTICAL, FUNDING, SHARE, USERS, BAND_PRICE, FUNDING_TREND, AI_DEALS, REVENUE, BIZ_MODELS, KPIS, INSIGHTS, CAP_REL, FACTCHECK, QA_PAIRS, APP_MONTHLY, REVENUE_MONTHLY, STOCKS, STOCK_SHARES, attachStockEvents };
})();
