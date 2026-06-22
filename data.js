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
      note: "GPT-4o·o3·GPT-5, ChatGPT, Sora. 2026.03.31 최종 라운드 확정: 총 조달 $122B(SoftBank·Amazon·Nvidia·a16z 등)·post-money 밸류 $852B(직전 2026.02 $730B pre+$110B 수식의 $840B에서 증액 확정). [보도] S-1 2026.05.22 기밀 제출·06.08 공식 발표(이르면 2026.09 상장, 공모 목표 최대 $1T). ChatGPT 주간 활성 사용자 ~905M(2월 920M 정점에서 소폭 감소·유료 55M ≈6%). 연환산 매출 $25B+(2026.02). [The Information] Q1 2026 실매출 $5.7B·GAAP 운영손실 $9.3B·현금소각 $3.7B(매출 65%)·순손실 $21.3B($12.4B 회계비용 포함)·Non-GAAP 마진 -122% — 수익성이 핵심 IPO 리스크. $852B는 2030년 매출 목표 $280B 가정에 기반. [WSJ/Bloomberg] Microsoft와의 독점 파트너십·양방향 수익공유 구조 재편(종료).",
      vp: "최고 성능 멀티모달 모델과 9억 규모의 소비자 접점을 동시에 보유한 유일한 사업자. API·구독·엔터프라이즈로 매출 다각화.",
      direction: "범용 인공지능(AGI) 지향 + 대규모 컴퓨트 자금 조달. 추론 모델(o-시리즈)과 에이전트로 확장. IPO 준비.",
      sources: ["총 조달 $122B·$852B post-money (2026.03.31, Bloomberg/CNBC)", "[보도] S-1 2026.05.22 기밀 제출·06.08 발표 (Reuters)", "[The Information] Q1 실매출 $5.7B · Non-GAAP 마진 -122%", "[WSJ] Microsoft 독점 파트너십 재편 종료"],
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
      note: "DeepSeek-V3, R1 — 중국 최대 AI 연구소. 2026.06.16 첫 외부 투자 라운드 완료(CNY 50B+ ≈ $7.4B 조달, 밸류 $50B+ 확정 — $52B~$59B 범위의 하단부). 주요 투자자는 Tencent·CATL·창업자 Liang(약 40% 자체 출자)이며 국가 AI 펀드(CAIIF)도 참여 — 단 외부 투자자는 5년 락업·의결권 없음, 국가 펀드만 의결권 보유. R1·V3가 GPT-4급 성능을 약 1/10 비용으로 구현해 'AI 비용 혁명(Sputnik Moment)' 촉발. 단, 국유 펀드 투자로 지정학적 리스크 존재.",
      vp: "압도적 비용 효율과 오픈 가중치 배포로 빠른 채택. AI 인프라 비용 패러다임 전환의 상징.",
      direction: "효율 중심 모델 + 오픈 생태계. 다만 수출 규제·지정학 변수에 노출.",
      sources: ["첫 외부 라운드 완료 $7.4B·밸류 $50B+ (TrendForce / TechStartups '26.06.16)", "R1·V3 1/10 비용 GPT-4급 성능", "Tencent·CATL·창업자 40% 출자, 국가 AI 펀드만 의결권 (FT '26.6)"],
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
      cat: "startup", name: "Perplexity", rel: "어시스턴트 경쟁자", tier: "T2", domain: "perplexity.ai", unit: "AI 검색·에이전트 브라우저",
      valuation: "$18B", valAsof: "26", metric: "ARR", value: "$450M+", metricAsof: "26.03",
      funding: "Series", trend: 50, trendBasis: "ARR 1개월 +50%",
      note: "AI 검색·답변 엔진 + Comet AI 브라우저. ARR $450M+(2026.03, 1개월 만에 +50%), 연 $656M 목표. 2026.03.23 Comet 전 세계 무료 전환($200/월→$0)으로 크롬(점유율 65%)과 정면 충돌. 출처 명시 답변으로 신뢰도 차별화.",
      vp: "출처를 명시하는 답변 엔진 + 자율 에이전트 브라우저(Comet)로 탐색·구매까지 대행.",
      direction: "검색을 넘어 에이전틱 브라우징·커머스로 확장. 광고/구독 하이브리드 수익화.",
      sources: ["ARR $305M→$450M+ (1개월 +50%) (Perplexity/CNET '26.3)", "Comet 전 세계 무료 공개 (Perplexity '26.6)", "연 $656M ARR 목표"],
      url: "https://www.perplexity.ai",
    },
    {
      cat: "startup", name: "Mistral AI", rel: "오픈모델 소싱 후보", tier: "T1", domain: "mistral.ai", unit: "유럽 파운데이션 모델",
      valuation: "$23B", valAsof: "26.06", metric: "라운드", value: "€3B 협의", metricAsof: "26.06",
      funding: "€20B 협의 중", trend: 100, trendBasis: "밸류 €11.7B→€20B (협의, 2배)",
      note: "프랑스 기반 AI 스타트업. 2026.06 밸류 €20B($23B) 신규 €3B 라운드 협의 중(정식 클로즈 미완료, 직전 €11.7B 대비 2배). 파리 데이터센터(13,800 NVIDIA 칩)·스웨덴 시설 건설. Le Chat·Mistral Large. 유럽 AI 주권의 상징.",
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
      cat: "startup", name: "Runway", rel: "온디바이스 음성·미디어", tier: "T1", domain: "runwayml.com", unit: "비디오 생성 AI",
      valuation: "$4B", valAsof: "24.06", metric: "제품", value: "Gen-4", metricAsof: "26.05",
      funding: "Series D", trend: 25, trendBasis: "영상 생성 채택",
      note: "비디오 생성 AI 선도. 2026.05 Gen-4 출시 — 네이티브 오디오 생성·리얼리스틱 물리 엔진. Adobe Firefly에 Gen-4.5 최우선 배포 멀티이어 파트너십. 할리우드 제작 현장 도입 가속. 밸류 $4B(2024.06).",
      vp: "전문가급 영상+오디오 생성 품질과 크리에이티브 워크플로우 도구.",
      direction: "영상·오디오 통합 생성 고도화 + Adobe 파트너십으로 제작 시장 침투.",
      sources: ["Gen-4 출시 (2026.05)", "Adobe Firefly 멀티이어 파트너십", "밸류 $4B (Bloomberg '24.6)"],
      url: "https://runwayml.com",
    },
    {
      cat: "startup", name: "Stability AI", rel: "온디바이스 음성·미디어", tier: "T1", domain: "stability.ai", unit: "생성 미디어(재건)",
      valuation: "$1B", valAsof: "23 피크", metric: "매출(추정)", value: "$190M", metricAsof: "26",
      funding: "구조조정·재건", trend: -10, trendBasis: "턴어라운드 케이스",
      note: "Stable Diffusion으로 이미지 생성을 대중화했으나 재정난·구조조정을 겪은 재건 케이스. 2026.05 Stable Audio 3.0(오픈웨이트)·Brand Studio 출시. 신임 CEO Prem Akkaraju(전 Weta)+Sean Parker·Eric Schmidt 이사회. 2026 추정 매출 $190M — 이미지에서 오디오·엔터프라이즈로 전환.",
      vp: "오픈 가중치 생성 모델 자산 + 엔터프라이즈 라이선싱·커스텀 트레이닝으로 수익 재편.",
      direction: "이미지→오디오·영상·엔터프라이즈 크리에이티브 툴로 포트폴리오 확장(턴어라운드 진행).",
      sources: ["Stable Audio 3.0·Brand Studio (2026.5)", "신임 CEO·이사회 재건 (CIO)", "2026 추정 매출 $190M"],
      url: "https://stability.ai",
    },
    {
      cat: "startup", name: "ElevenLabs", rel: "온디바이스 음성·미디어", tier: "T1", domain: "elevenlabs.io", unit: "AI 음성 합성",
      valuation: "$11B", valAsof: "26.02", metric: "ARR", value: "$330M+", metricAsof: "26.01",
      funding: "Series D $500M", trend: 233, trendBasis: "밸류 $3.3B→$11B (3배+)",
      note: "AI 음성 생성·TTS 시장 선도. 2026.02 Series D $500M로 밸류 $11B(1년 전 $3.3B 대비 3배+), Sequoia 주도·NVIDIA 백업. ARR $330M+(2026.01). 팟캐스트·게임·영상 제작의 표준 음성 API.",
      vp: "자연스러운 다국어 음성 합성 품질과 개발자 친화 API. 콘텐츠 제작 파이프라인 표준화.",
      direction: "음성 에이전트·더빙·실시간 대화로 확장. IPO 옵션 검토.",
      sources: ["Series D $500M, 밸류 $11B (CNBC / Reuters '26.2.4)", "ARR $330M+ (2026.01)", "Sequoia 주도·NVIDIA 투자"],
      url: "https://elevenlabs.io",
    },
    {
      cat: "startup", name: "Harvey", rel: "에이전트 UX 벤치마크", tier: "T2", domain: "harvey.ai", unit: "법률 버티컬 AI",
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
      cat: "startup", name: "Sierra AI", rel: "에이전트 UX 벤치마크", tier: "T2", domain: "sierra.ai", unit: "고객 서비스 AI 에이전트",
      valuation: "$10B", valAsof: "26.03", metric: "ARR", value: "$150M", metricAsof: "26.01",
      funding: "Sequoia 주도", trend: 100, trendBasis: "Revenue Multiple 67x",
      note: "고객 대면 AI 에이전트 플랫폼 — 기업 고객 서비스 전문. 밸류 $10B, ARR $150M. Revenue Multiple 67x로 AI 에이전트 섹터 최고 수준. (공동창업: Bret Taylor) Sequoia 투자.",
      vp: "기업 브랜드 맞춤형 고객 응대 에이전트로 콜센터·CS 비용 구조 재편.",
      direction: "산업별 CS 에이전트 템플릿 확장. 성과 기반 과금 실험.",
      sources: ["밸류 $10B, ARR $150M (ValueAdd VC '26)", "Revenue Multiple 67x"],
      url: "https://sierra.ai",
    },
    {
      cat: "native", name: "SpaceX (xAI, Cursor)", domain: "x.ai", unit: "AI 생태계(xAI·Grok·Cursor)",
      valuation: "$230B+", valAsof: "26.01", metric: "Grok+X 합산 도달", value: "6억", metricAsof: "26.01",
      funding: "xAI Series E $20B · SPCX 상장", trend: 120, trendBasis: "xAI 밸류 $230B+ · Cursor $60B 인수",
      note: "일론 머스크 AI 생태계 통합 표기. xAI(Grok)는 2026.01 Series E $20B 완료·밸류 $230B+(누적 조달 $42B+). SpaceX는 SPCX 티커로 거래되며 2026.06.16 AI 코딩 에이전트 Cursor(Anysphere)를 $60B 주식 인수 합의(ARR $2B+, 기업고객 60%). Grok+X 합산 도달 6억(독립 제품 MAU와 구분 — 대부분 X 사용자). 단, Grok 딥페이크 논란 등 거버넌스 리스크.",
      vp: "X 플랫폼 유통·자체 컴퓨트(Colossus)·코딩 에이전트(Cursor)를 묶은 수직 통합. 머스크 생태계 시너지.",
      direction: "Grok 프런티어 모델 + Cursor 코딩 에이전트 + X 통합. SPCX 상장으로 자본 조달.",
      sources: ["xAI Series E $20B·밸류 $230B+ (TechCrunch/NYT '26.1)", "SpaceX, Cursor $60B 인수 합의 (CNBC '26.06.16)", "Grok+X 합산 도달 6억 (Grok 단독 아님)"],
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

  /* ---- Articles (per-company, newest first) — co: 기업명(필터용) ---- */
  const ARTICLES = [
    // ── AI Native ──
    { date: "2026-05-22", co: "OpenAI", cat: "native", source: "Reuters / The Information", title: "OpenAI, 미국 증시 S-1 기밀 제출 — 밸류 $852B·공모 목표 최대 $1T", summary: "· 2026.05.22 SEC S-1 기밀 제출 · 06.08 공식 발표 — 이르면 2026.09 상장(Goldman·Morgan Stanley 주관)\n· 밸류 $852B post-money·총 조달 $122B(2026.03 확정) · 공모 목표 최대 $1T\n· Q1 2026 실매출 $5.7B · GAAP 운영손실 $9.3B · 현금소각 $3.7B(매출의 65%) · 순손실 $21.3B($12.4B 회계비용 포함)\n· 수익성이 최대 IPO 리스크 · Microsoft 독점 파트너십도 재편(종료)", tag: "IPO", url: "https://www.aljazeera.com/economy/2026/6/8/tech-giant-openai-files-for-us-initial-public-offering" },
    { date: "2026-06-09", co: "Anthropic", cat: "native", source: "Anthropic", title: "Anthropic, Claude Fable 5 출시 — 자율 코딩 에이전트 SWE-bench 신기록", summary: "· 최신 플래그십 Claude Fable 5 출시(2026.06.09) — 코딩 에이전트 역대 최고 성능\n· SWE-bench Verified 최상위권, 1M 토큰 컨텍스트·128K 출력\n· Claude Opus 4.6(2026.02)→4.7(2026.04 GA)→Fable 5 빠른 사이클\n· Amazon 추가 $25B 투자 후 AWS Bedrock 최우선 배포", tag: "Product", url: "https://www.anthropic.com/news" },
    { date: "2026-05-20", co: "Google DeepMind", cat: "bigtech", source: "Google", title: "Google I/O 2026 — Gemini 3.1 Pro + Deep Research Max, ARC-AGI-2 77.1%", summary: "· Gemini 3.1 Pro ARC-AGI-2 77.1%, SWE-Bench Verified 80.6%\n· Deep Research Max — 자율 리서치 에이전트, MCP 지원\n· 100만 토큰 컨텍스트, 검색·워크스페이스 전면 통합\n· Google AI Ultra 구독자 우선 배포", tag: "Product", url: "https://blog.google/technology/ai/" },
    { date: "2026-01-06", co: "SpaceX (xAI, Cursor)", cat: "native", source: "TechCrunch / NYT / The Guardian", title: "xAI, Series E $20B 완료 — 밸류 $230B+, Grok 딥페이크 논란 동시 직면", summary: "· Series E $20B 완료(NVIDIA·Cisco·카타르 국부펀드·Fidelity)\n· 누적 총 조달액 $42B+(PitchBook) · 밸류 $230B+ 추정\n· Grok+X 합산 도달 6억(독립 제품 MAU와는 구분 — 대부분 X 사용자)\n· Grok 미성년 딥페이크 자동 생성 논란 → 다수 정부 조사 개시", tag: "Funding", url: "https://www.theguardian.com/technology/2026/jan/06/elon-musk-xai-investment-grok-backlash" },
    { date: "2026-06-16", co: "DeepSeek", cat: "native", source: "TrendForce / TechStartups", title: "DeepSeek, 첫 외부 펀딩 완료 — $7.4B 조달·밸류 $50B+ 확정", summary: "· 첫 외부 라운드 완료(CNY 50B+ ≈ $7.4B), 밸류 $50B+ 확정($52B~$59B 하단부)\n· 주요 투자자: Tencent·CATL·창업자 Liang(약 40% 자체 출자) · 국가 AI 펀드(CAIIF)도 참여\n· 외부 투자자 5년 락업·의결권 없음 — 국가 펀드만 의결권 보유(거버넌스 리스크)\n· R1·V3로 GPT-4급을 1/10 비용 구현 — 'Sputnik Moment'", tag: "Funding", url: "https://techstartups.com/2026/06/16/deepseek-funding/" },
    { date: "2026-05-28", co: "Anthropic", cat: "native", source: "Anthropic / Reuters", title: "Anthropic, Series H $65B·밸류 $965B — run-rate 매출 $47B로 OpenAI 추월", summary: "· Series H $65B 조달·$965B post-money(직전 2026.02 $380B)\n· 발표문서 run-rate 매출이 '이달 $47B 돌파' 명시 — 4월 $30B에서 6주 만에 급증\n· OpenAI 연환산 $25B을 2배 가까이 추월 — 최대 경쟁 역학 변화\n· Claude Code 단독 $2.5B+ ARR 돌파", tag: "Funding", url: "https://www.anthropic.com/news" },

    // ── Big Tech AI ──
    { date: "2026-06-08", co: "Apple", cat: "bigtech", source: "MacRumors / Apple", title: "Apple WWDC 2026 — Siri AI 재설계, 온디바이스 + Private Cloud Compute 강화", summary: "· Siri를 'Siri AI'로 재설계 — 온디바이스 Foundation Models 중심\n· Private Cloud Compute: 클라우드 처리 시 무기명(Anonymous) 보장\n· 시스템 전역 컨텍스트 이해·Visual Intelligence 확장\n· Foundation Models 프레임워크 외부 개발자 공개 · iOS 27 가을 출시", tag: "Product", url: "https://www.apple.com/apple-intelligence/" },
    { date: "2026-04-29", co: "Microsoft", cat: "bigtech", source: "Microsoft IR / UC Today", title: "Microsoft Q3 FY2026 — AI 연 매출 $37B 런레이트, Azure 35% 재가속", summary: "· Nadella 확인: AI 사업 연 매출 런레이트 $37B(+123% YoY)\n· M365 Copilot 유료 좌석 2,000만 돌파(+250% YoY)\n· 전체 매출 $82.9B(+18%) · Azure 35% 재가속\n· Accenture 74만 좌석 최대 고객", tag: "Earnings", url: "https://www.uctoday.com/unified-communications/microsoft-earnings-2026-ai-copilot-enterprise/" },
    { date: "2026-04-20", co: "Amazon", cat: "bigtech", source: "CNBC / NYT / GeekWire", title: "Amazon, Anthropic에 추가 투자 — 즉시 $5B + 향후 최대 $20B, AWS $100B+ 약정", summary: "· 즉시 $5B 투자 + 향후 최대 $20B 추가 가능(기존 $8B와 별도) — '누적 $33B 완료'는 부정확\n· Anthropic의 AWS 10년 클라우드 약정 $100B+\n· 2개월 전 OpenAI $50B+$100B 딜과 동시 진행 '양쪽 베팅'\n· Bedrock ~100개 파운데이션 모델 지원, Guardrails 80% 인하", tag: "Funding", url: "https://www.cnbc.com/2026/04/20/amazon-invest-up-to-25-billion-in-anthropic-part-of-ai-infrastructure.html" },
    { date: "2026-02-25", co: "NVIDIA", cat: "bigtech", source: "NVIDIA IR / The Verge", title: "NVIDIA Q4 FY2026 분기 매출 $68.1B — FY2026 연 $215.9B 확정", summary: "· Q4 FY2026 분기 매출 $68.1B(+73% YoY, 신기록) · 데이터센터 $62.3B(+75%)\n· FY2026 연 $215.9B 확정(+65% YoY) — Q1 $44.1B+Q2 $46.7B+Q3 $57.0B+Q4 $68.1B (직전 FY2025 $130.5B와 구분)\n· B200 추론 성능 H100 대비 30배, 연 150~200만 대 출하 전망\n· 하이퍼스케일러 자체 칩 190만 가속기 배포로 '분리' 가속", tag: "Earnings", url: "https://www.nvidia.com/en-us/investor-relations/" },
    { date: "2025-04-05", co: "Meta AI", cat: "bigtech", source: "Meta / NDTV", title: "Meta, Llama 4 발표 — Scout·Maverick 오픈소스, Behemoth 2T MoE 예고", summary: "· Llama 4 Scout·Maverick 오픈소스 즉시 공개\n· Behemoth: 2T 총 파라미터, 288B 활성 MoE — 업계 최대 규모\n· Meta AI 어시스턴트 WhatsApp·Instagram·Messenger 통합, 월 30억+\n· Llama Guard 4 등 오픈소스 보안 툴 동시 공개", tag: "Product", url: "https://www.ndtv.com/world-news/meta-launches-llama-4-all-about-the-latest-open-source-ai-model-8100928" },

    // ── AI Startup ──
    { date: "2026-06-16", co: "SpaceX (xAI, Cursor)", cat: "native", source: "CNBC / Bloomberg / Forbes", title: "SpaceX, Cursor $60B 인수 합의 — IPO 직후 AI 코딩 에이전트 M&A 시대", summary: "· SpaceX(xAI 생태계)가 IPO 직후 Cursor(Anysphere) $60B 주식 인수 합의\n· ARR $2B+, 기업 고객 60%(Stripe·Adobe·NVIDIA)\n· 밸류 $2.5B→$29.3B→$50B 협상→$60B 최종\n· Jensen Huang '최애 엔터프라이즈 AI 서비스'로 지목, 2026 Q3 완료", tag: "M&A", url: "https://www.cnbc.com/2026/06/16/spacex-spcx-cursor-acquisition-ipo.html" },
    { date: "2026-03-23", co: "Perplexity", cat: "startup", source: "Perplexity / CNET", title: "Perplexity Comet 브라우저 전 세계 무료 전환 — ARR $450M+, 크롬과 충돌", summary: "· 2026.03.23 전 플랫폼 무료 전환($200/월 → $0)\n· 무료화 1개월 만에 ARR $305M→$450M+(+50%), 연 $656M 목표\n· AI 에이전트가 탭 관리·이메일 요약·자동 구매 대행 — 크롬(65% 점유)과 정면 경쟁\n· Comet 출시 궤적: 2025.07 데스크톱 → 2025.11 Android → 2026.03 iOS", tag: "Product", url: "https://www.perplexity.ai/hub/blog/comet-is-now-available-to-everyone-worldwide" },
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
    { name: "OpenAI", value: 840, cat: "native", src: "2026.02 $730B pre + $110B 신규(post ~$840B)" },
    { name: "SpaceX (xAI, Cursor)", value: 230, cat: "native", src: "xAI Series E '26.1 밸류 $230B+ · Cursor 인수 $60B" },
    { name: "Databricks", value: 134, cat: "startup", src: "Series L '26.2 $134B ($175B 협의)" },
    { name: "DeepSeek", value: 55, cat: "native", src: "Reuters '26.5 $52B~59B" },
    { name: "Mistral AI", value: 23, cat: "startup", src: "Bloomberg '26.6 €20B($23B) 협의 중(미확정)" },
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
      decision: "폰의 '기본 비서' 자리가 단말 차별화의 핵심 전장 — 자사 기본 어시스턴트 노선(파트너 심화 vs 자체 vs 멀티)을 지금 확정해야 함" },
    { tag: "온디바이스 스펙 경쟁", tone: "signal", nav: "bigtech",
      now: "Morgan Stanley: 구형 iPhone 8.5억대가 메모리 한계로 온디바이스 AI 구동 곤란(고급 비서엔 12GB) · IDC: 생성형 AI 폰 2028년 70%",
      decision: "AI 기능 = 하드웨어 스펙 = 프리미엄 전환·교체수요 동력 — 단 'AI 탑재=판매 증가'는 단정 금물(침투율과 실제 교체수요는 분리)" },
    { tag: "수익화 분기", tone: "revenue", nav: "bizmodel",
      now: "Perplexity는 구독 버리고 광고·에이전트 커머스로 · OpenAI는 구독+API지만 Q1 마진 -122% · 버티컬은 ARR 배수 67배",
      decision: "무료로 푸는 온디바이스 AI 기능의 과금 노선(구독 유료화 vs 단말 가격 프리미엄 vs 커머스 수수료) 결정이 임박" },
    { tag: "에이전트 UX", tone: "compete", nav: "signals",
      now: "Computer Use·Deep Research·Comet이 탭 관리·구매 대행까지 자동화 · 그러나 자율 성공률 OSWorld 66%서 정체·구조화 과제 1/3 실패",
      decision: "온디바이스 에이전트는 완전 자동화가 아니라 승인형·작업 로그·취소/복구 설계가 정답 — 자사 에이전트 UX 원칙으로 못박을 것" },
  ];

  const KPIS = [
    { label: "글로벌 AI 시장 (2025)", value: "$390.9B", delta: +40, sub: "출처: Grand View Research(인프라+모델+앱) · 2026E $539.5B · 2030E $1,812B", fill: 0.74, src: "Grand View Research AI Market Report '26 최신판" },
    { label: "OpenAI 밸류 (2026.03)", value: "$852B", delta: +120, sub: "post-money · 총 조달 $122B 확정 · S-1 제출(공모 목표 미확정)", fill: 0.92, src: "Bloomberg/CNBC 2026.03.31" },
    { label: "Anthropic run-rate", value: "$47B", delta: +188, sub: "Series H 발표문 · 6주 만에 $30B→$47B · OpenAI ARR 추월", fill: 0.98, src: "Anthropic 공식 2026.05.28" },
    { label: "NVIDIA 매출 (FY27 1Q)", value: "$81.6B", delta: +85, sub: "+85% YoY · DC $75.2B(+92%) · Q2 가이던스 $91B", fill: 0.90, src: "NVIDIA IR 2026.05.20" },
    { label: "Microsoft AI 런레이트", value: "$37B", delta: +123, sub: "Copilot 15M→20M(+33% QoQ) · Azure 35% 재가속", fill: 0.78, src: "Microsoft IR FY26 Q3" },
    { label: "ChatGPT 주간 활성 사용자", value: "900M+", delta: +60, sub: "OpenAI 2026.02 발표", fill: 0.80, src: "OpenAI 공식 2026.02" },
  ];

  /* ---- Insight Cards (9) ---- */
  const INSIGHTS = [
    { title: "Anthropic, OpenAI ARR 추월 — 최대 경쟁 역학 변화", desc: "Anthropic run-rate 매출이 2026.05 $47B로 6주 만에 $30B(4월)에서 급증해 OpenAI 연환산 $25B을 2배 가까이 추월. NVIDIA $215.9B·Microsoft AI $37B까지 더하면 GenAI 런레이트 합계는 $100B을 훌쩍 넘어 독립 산업화", icon: "ai", src: "Anthropic Series H '26.05.28, Microsoft IR" },
    { title: "OpenAI 수익성 역설 — 밸류 $852B vs 마진 -122%", desc: "OpenAI는 $852B(2026.03) 밸류로 S-1 제출했으나 Q1 GAAP 운영손실 $9.3B·현금소각 $3.7B(매출의 65%)·순손실 $21.3B·Non-GAAP 마진 -122%를 기록. $852B는 2030년 매출 $280B 가정 기반 — 파운데이션 모델(대규모 적자) vs NVIDIA(~75% 마진)의 수익성 스펙트럼 양극단", icon: "pulse", src: "The Information '26.05, Bloomberg" },
    { title: "AI 칩 전쟁 — NVIDIA vs 커스텀 실리콘", desc: "NVIDIA B200이 AI 학습 시장 80%+를 점유하나, Google TPU·Amazon Trainium·Microsoft Maia 등 커스텀 칩이 추격. DeepSeek의 1/10 비용 모델로 효율이 핵심 변수로 부상", icon: "chip", src: "Goldman Sachs '26.02, NVIDIA IR FY26" },
    { title: "AI 에이전트 — 파일럿에서 프로덕션으로", desc: "Gartner: 2026년 말 엔터프라이즈 앱 40%에 task-specific 에이전트 내장(2025년 <5%에서·현재 실제 배포는 17%), 2028년 SW 33%에 agentic AI 포함, 2026 agentic AI 지출 $201.9B(+141% YoY). 단, 프로젝트 40%+는 2027년까지 취소 경고. 독립 시장조사 기준 에이전트 시장은 $8.8~12.1B(2026)→$33.9~53.2B(2030~32)", icon: "spark", src: "Gartner '26 / Reuters '25.6, 독립 시장조사" },
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


  /* ---- Q&A Pairs (Korean) ---- */
  const QA_PAIRS = [
    { q: "지금 AI 산업에서 가장 중요한 사건은 무엇인가요?", a: "2026년 상반기는 AI 역사에서 가장 밀도 높은 6개월이었습니다. 세 가지 사건이 한꺼번에 터졌습니다. 첫째, Anthropic이 2026.05.28 Series H $65B를 조달하며 밸류 $965B post-money를 확정했습니다 — OpenAI($852B)를 처음으로 추월한 순간이며, 연환산 매출(ARR)도 $47B로 OpenAI($25B)의 거의 2배에 달합니다. 불과 3개월 전 $380B였던 회사가 3개월 만에 $965B가 됐다는 것은 AI 시장이 얼마나 빠르게 가격을 재평가하고 있는지를 보여줍니다. 둘째, SpaceX(xAI 생태계)가 2026.06.16 AI 코딩 에이전트 Cursor(Anysphere)를 $60B 주식 거래로 인수하기로 합의했습니다 — ARR $2B+의 실전 도구가 이 가격에 팔렸다는 것은 코딩 AI가 빅테크 M&A 핵심 타깃임을 상징합니다. 셋째, OpenAI가 2026.06.08 SEC에 S-1을 기밀 제출했습니다(이르면 2026.09 상장, 목표 밸류 최대 $1T). 이 세 사건이 10일 안에 겹치며 'AI 사기업 밸류 합산 $3T+'라는 전례 없는 수치가 등장했습니다. 단, 냉정한 시선도 필요합니다: OpenAI는 Q1 2026에만 $3.7B를 소각했고, AI 스타트업 연간 실패율은 여전히 27%입니다.", nav: "overview", keywords: ["중요", "사건", "이벤트", "2026", "요약", "anthropic", "openai", "spacex"] },
    { q: "OpenAI의 현재 밸류와 IPO 전망은?", a: "OpenAI의 밸류는 지난 2년간 $29B(2023.01) → $157B(2024.10) → $340B(2025.03) → $730B(2026.02) → $852B(2026.03)으로 수직 상승했습니다. 어떤 사기업도 경험하지 못한 속도입니다. 현재 핵심 지표: 주간 활성 사용자 ~905M(2월 920M 정점에서 소폭 감소, 유료 55M≈6%), 연환산 매출 $25B+(2026.02, 회사·Reuters 공식 확인), 누적 조달 총액 $122B(SoftBank·Amazon·Nvidia·a16z 등). IPO 시나리오: 2026.05.22 SEC에 S-1 기밀 제출(06.08 공식 발표), 이르면 2026.09 공모 목표, 공모 목표 밸류 최대 $1T로 보도 — 사상 최대 기술 IPO가 될 전망입니다. 함정: 2026 Q1에 GAAP 운영손실 $9.3B·현금소각 $3.7B(매출의 65%)·순손실 $21.3B를 기록했습니다. $852B는 현재 수익성이 아니라 '2030년 매출 $280B 달성 시나리오'에 베팅한 가격입니다. Anthropic의 추격($965B·ARR $47B)이 심상치 않고, Microsoft와의 독점 파트너십도 IPO를 계기로 재편됩니다 — 이것이 IPO 이후 밸류에이션의 최대 불확실성입니다.", nav: "native", keywords: ["openai", "ipo", "밸류", "852", "s-1", "상장", "적자", "122"] },
    { q: "Anthropic과 OpenAI의 차이는?", a: "두 회사는 같은 기술을 다른 철학으로 만듭니다. OpenAI: '빠르게 배포하고 문제는 해결하며 간다'는 철학으로 ChatGPT로 9억+ 소비자를 확보, GPT 브랜드가 일반명사가 됐습니다. Anthropic: OpenAI 전 연구진이 '안전성 우선'을 내걸고 나와 만든 회사로, Constitutional AI(AI가 스스로 행동을 평가·수정하는 구조)를 개발해 의료·법률·금융 등 규제 산업에서 압도적 신뢰를 얻었습니다. 수치로 보는 현재(2026.05): Anthropic 밸류 $965B(OpenAI $852B 추월), ARR $47B(OpenAI $25B의 약 2배), Claude Code 단독 $2.5B+ ARR. Amazon이 기존 $8B에 더해 즉시 $5B+향후 최대 $20B 추가 투자 의사를 밝혔고 AWS 10년 $100B+ 약정도 체결됐습니다. 결론: OpenAI는 소비자 AI의 상징, Anthropic은 엔터프라이즈 AI의 실세입니다. '누가 이기냐'보다 '어느 분야에서'를 함께 봐야 합니다.", nav: "native", keywords: ["anthropic", "claude", "openai", "차이", "965", "constitutional"] },
    { q: "OpenAI의 실제 매출은? $12.7B가 맞나요?", a: "$12.7B는 2024년 중반 유통된 구시대 수치입니다. 공식 확인된 매출 궤적: $1B(2023 초) → $3.4B(2023 말) → $6B(2024 말) → $20B(2025 말, CFO 공식 발언) → $25B+(2026.02, 회사·Reuters 공식 확인, 월 매출 ~$2B 이상). 주의: $35B 이상 수치들이 언론에 유통되나 이는 외부 추정치로, 회사 공식 확인 숫자와 구분해야 합니다. 맥락: 이 성장세에도 OpenAI는 적자입니다(연간 운영 비용이 매출 초과). S-1 제출 후 공개될 실제 재무제표가 마지막 퍼즐 조각입니다. 또한 Anthropic이 2026.05 ARR $47B로 OpenAI를 추월했다는 점도 중요합니다 — 밸류는 OpenAI가 높지만 매출 성장 속도는 이제 Anthropic이 앞섭니다.", nav: "native", keywords: ["openai", "arr", "매출", "수익", "재무", "25", "12.7"] },
    { q: "앤스로픽의 기업가치(밸류)는 얼마인가요?", a: "Anthropic의 밸류 상승 속도는 업계 독보적입니다. Series A $704M(2023.05) → Series B $1.25B(2023.07) → Series C $7.3B(Amazon 포함, 2023.09) → Series G $380B post-money(2026.02) → Series H $965B post-money(2026.05.28). 단 3개월 만에 $380B→$965B로 2.5배 상승했습니다. Series H의 의미: $65B 조달은 사모 역사상 단일 라운드 최대급입니다. 이 라운드에서 Amazon이 즉시 $5B를 투자(기존 $8B와 별개)하고 향후 최대 $20B 추가 가능을 밝혔으며, Anthropic은 AWS에 10년 $100B+ 클라우드 사용을 약정했습니다 — 사실상 Amazon AI 전략의 핵심 파트너입니다. 매출: 발표 공식 문서에 'run-rate revenue crossed $47 billion earlier this month'(2026.05)라고 명시됐고, Claude Code 단독 $2.5B+ ARR을 돌파했습니다. 유의: $965B는 아직 상장 전 사모 평가로, IPO·2차 시장에서 유지될지는 별개 문제입니다.", nav: "native", keywords: ["앤스로픽", "anthropic", "밸류", "기업가치", "965", "47", "amazon"] },
    { q: "NVIDIA가 압도적인 이유는?", a: "NVIDIA의 지배력은 '좋은 GPU'만이 아니라 두 개 층의 해자로 이뤄집니다. 첫째 하드웨어: AI GPU 점유율 80%+. FY27 Q1(2026.05.20) 매출 $81.6B(+85% YoY), 데이터센터 $75.2B(+92% YoY), Q2 가이던스 $91.0B. B200(Blackwell)은 H100 대비 추론 30배·전력효율도 대폭 향상. 둘째 소프트웨어(핵심): CUDA 생태계는 10년간 7.5M+ 개발자가 쌓은 라이브러리·최적화·워크플로우의 집합입니다. PyTorch·TensorFlow가 모두 CUDA 위에서 최적화됐고, 연구자·엔지니어가 CUDA로 훈련받았습니다 — 이를 바꾸는 건 기술이 아니라 '수백만 명의 습관'을 바꾸는 일입니다. 위협은 실재합니다: Google TPU v7(Ironwood)·Amazon Trainium 3·MS Maia 2·Meta MTIA 2 등 4대 하이퍼스케일러 자체 칩 합산 배포가 약 190만 가속기, TPU v7 추론 전력효율은 B200의 약 2배. 그럼에도 'CUDA 대체에 최소 5~7년'이라는 평가이며, FY27 데이터센터 전망은 오히려 $105~120B로 상향됐습니다. '분리'는 시작됐지만 NVIDIA 시대의 끝을 말하긴 이릅니다.", nav: "bigtech", keywords: ["nvidia", "엔비디아", "gpu", "b200", "cuda", "85", "tpu", "trainium"] },
    { q: "Microsoft의 AI 매출은 얼마나 되나요?", a: "Microsoft는 AI를 가장 성공적으로 수익화한 기존 빅테크입니다. OpenAI 독점 파트너십 덕에 경쟁사가 인프라를 짓는 동안 이미 수십억 사용자에게 AI를 판매합니다. 핵심 수치(Q3 FY2026): Satya Nadella가 공식 확인한 AI 부문 연 매출 런레이트 $37B(+123% YoY), M365 Copilot 유료 좌석 2,000만 돌파(+250% YoY), Azure 35% 재가속, Accenture 74만 좌석으로 최대 단일 고객. 왜 중요한가: Office 365·Teams·Azure 기존 번들에 Copilot을 '추가 옵션'으로 팔기 때문에 기존 고객 락인이 극히 강합니다. 리스크: OpenAI IPO 이후 파트너십 재편이 최대 불확실성입니다. MS가 OpenAI에 투자한 $13B+ 중 상당분이 Azure 크레딧 형태라 FTC 반독점 조사의 핵심 쟁점이 됐습니다. 시총은 $3.5T+(2026.06)로 세계 최고 수준입니다.", nav: "bigtech", keywords: ["microsoft", "copilot", "azure", "매출", "37", "런레이트"] },
    { q: "Amazon은 왜 OpenAI·Anthropic 양쪽에 투자하나요?", a: "이것은 전략이지 실수가 아닙니다. 논리는 단순합니다 — '누가 이기든 우리가 인프라를 공급한다.' 타임라인: 2026.02 OpenAI에 $50B 투자+$100B AWS 약정. 2개월 뒤 2026.04.20 Anthropic에 즉시 $5B(기존 $8B와 별개)+향후 최대 $20B 추가 가능+AWS 10년 $100B+ 약정. 왜 합리적인가: AI 모델 경쟁의 승자 예측은 불가능에 가깝지만, 확실한 하나 — 어떤 AI가 이기든 학습·서비스에 클라우드 컴퓨트는 반드시 필요하고 AWS가 그 공급자입니다. 양쪽을 장기 계약으로 묶으면 Amazon은 'AI 전쟁의 무기 공급상' 포지션을 확보합니다. 추가로 Microsoft-OpenAI 독점이 Azure로 모든 AI 트래픽을 끌어가는 것을 견제하는 효과도 있습니다.", nav: "bigtech", keywords: ["amazon", "aws", "anthropic", "openai", "투자", "전략", "베팅"] },
    { q: "Cursor가 SpaceX에 인수된다는데 코딩 AI 시장은?", a: "2026.06.16 SpaceX(xAI 생태계)가 AI 코딩 에이전트 Cursor(Anysphere)를 $60B 주식 거래로 인수 합의했습니다(2026 Q3 완료 예정). Cursor가 왜 $60B인가: 창업 3년 만에 ARR $2B+, 기업 고객 60%(Stripe·Adobe·NVIDIA 포함), 밸류 궤적 $29.3B→$50B→$60B. 숫자보다 중요한 건 '코딩 에이전트가 개발자 워크플로우 깊숙이 파고들었다'는 사실입니다 — 단순 자동완성이 아니라 코드베이스 전체를 이해하고 버그를 찾고 리팩토링을 제안하는 수준입니다. 전쟁 구도: GitHub Copilot(MS)·OpenAI Codex·Claude Code(Anthropic)·Gemini Code Assist(Google) — 코딩 AI는 빅테크가 개발자 생태계를 장악하기 위한 핵심 전쟁터입니다. 개발자에게 주는 신호: 기능 차별화는 빠르게 줄고, 결국 '어느 IDE·어느 클라우드와 얼마나 깊이 통합됐는가'가 승부를 가릅니다.", nav: "native", keywords: ["cursor", "spacex", "xai", "인수", "코딩", "에이전트", "60"] },
    { q: "DeepSeek가 왜 중요한가요?", a: "DeepSeek는 AI 산업의 근본 가정을 흔든 존재입니다. 무슨 일이 있었나: 2025년 초 R1·V3 모델이 GPT-4급 성능을 훈련·추론 비용 약 1/10로 구현했습니다. NVIDIA 주가가 하루 17% 폭락했고 '엄청난 컴퓨트 없이도 AI를 만들 수 있다'는 인식이 퍼졌습니다 — 'AI의 Sputnik Moment'입니다. 왜 혁명인가: 그 전 상식은 '더 많은 컴퓨트=더 좋은 모델'이었는데, DeepSeek는 알고리즘 혁신(Mixture of Experts 최적화, 추론 시간 컴퓨트 배분 등)으로 공식을 깼습니다. 미국 칩 수출 규제로 고성능 GPU가 부족한 상태에서 이룬 성과라 더 충격적입니다. 2026년 현재: 2026.06.16 첫 외부 라운드 완료 — CNY 50B+($7.4B) 조달, 밸류 $50B+ 확정 — 주요 투자자는 Tencent·CATL·창업자 Liang(약 40% 자체 출자)이고 국가 AI 펀드도 참여하나 외부 투자자는 5년 락업·의결권이 없고 국가 펀드만 의결권을 보유합니다(거버넌스 리스크). 오픈 가중치 배포로 전 세계 개발자가 무료로 사용·수정 가능합니다. 리스크: 국유 자본·수출규제·데이터 프라이버시. 그러나 '알고리즘 혁신은 국경을 넘는다'는 교훈은 지워지지 않습니다.", nav: "native", keywords: ["deepseek", "딥시크", "중국", "비용", "효율", "r1", "7.4"] },
    { q: "2026년 AI 시장 규모와 투자 전망은?", a: "AI 시장은 레이어로 나눠야 합니다 — 인프라(GPU·클라우드), 모델(API), 애플리케이션(SaaS)이 각각 다른 속도로 성장합니다. 전체 규모: Grand View Research 최신판 기준 2025년 $390.9B, 2026E $539.5B, 2030E $1,811.75B(CAGR ~35%). 기관마다 정의 범위가 달라 $279B~$540B까지 유통되지만, 모든 기관이 CAGR 30~37%의 폭발적 성장에 동의합니다. 투자 현황: KPMG 기준 Q1 2026 글로벌 VC $330.9B(분기 신기록), AI가 미국 VC의 73% 차지. AI 인프라에 2025~2028 누적 $1T+ 투자 예상. 사기업 밸류 합산: OpenAI $852B + Anthropic $965B + SpaceX $500B+ = AI 사기업만 $3T+ — 단일 섹터 사기업으로는 전례 없는 규모입니다.", nav: "overview", keywords: ["시장", "규모", "투자", "전망", "390", "330", "vc"] },
    { q: "AI 에이전트란 무엇이며 도입 현황은?", a: "AI 에이전트는 '목표를 주면 스스로 계획하고, 도구를 쓰고, 실행하고, 결과를 평가하는 AI'입니다. 챗봇이 '질문에 답하는 AI'라면 에이전트는 '일을 처리하는 AI'입니다. 예: 법률 에이전트(Harvey)는 계약서 검토·판례 검색·수정 제안 전체를 자동화하고, 코딩 에이전트(Cursor/Claude Code)는 버그 리포트를 받아 코드베이스 분석·원인 규명·수정·테스트까지 수행합니다. 전망(Gartner): 2026년 말 엔터프라이즈 앱의 40%에 에이전트 내장(2025년 5% 미만에서 급증), 2028년 일상 업무 의사결정의 15%가 에이전트 자율 수행, 2026년 agentic AI 지출 $201.9B(+141% YoY). 경고도 공존: Gartner는 'agentic AI 프로젝트의 40%+가 2027년까지 비용·불명확한 ROI로 취소될 것'으로 예측합니다. Harvey($11B)·Sierra($10B, ARR 배수 67x)·Glean($7.2B)처럼 산업 특화 버티컬 에이전트가 가장 빠르게 성장합니다 — 범용보다 전문화가 ROI를 증명하기 쉽기 때문입니다.", nav: "dynamics", keywords: ["에이전트", "agentic", "자율", "엔터프라이즈", "도입", "gartner", "201"] },
    { q: "ChatGPT가 Google 검색을 죽이나요? 실제 숫자는?", a: "이 질문은 2023년부터 매해 반복됐지만 데이터는 더 복잡합니다. 현재(2026.06): Google은 여전히 글로벌 검색 74~80%를 점유합니다. ChatGPT Search는 글로벌 쿼리 17~18%로 급성장, Gemini는 LLM 트래픽의 20%를 차지합니다. Perplexity는 점유율은 낮지만 세션당 쿼리가 Google의 4.5배로 '깊은 탐색'에서 사용자를 뺏습니다. 진짜 위협: Google 수익 구조는 '검색→광고 클릭'인데, AI 검색은 바로 답을 줘 광고 링크 클릭 이유가 줄어듭니다 — 점유율보다 '클릭률 하락'이 실제 위협입니다. Goldman Sachs는 AI 검색 확산으로 Google 검색 광고 매출이 연 $20~40B 잠식될 수 있다고 추정합니다. 역설: OpenAI 자신이 2025.09 EU에 'Google·Apple·MS의 데이터 독점이 AI 검색 경쟁을 막는다'고 반독점 신고했습니다 — AI 검색의 진짜 해자가 모델이 아니라 '10년간 쌓은 검색 데이터'임을 스스로 인정한 셈입니다.", nav: "dynamics", keywords: ["구글", "검색", "chatgpt", "시장점유율", "gemini", "perplexity"] },
    { q: "AI 추론 비용은 얼마나 빠르게 떨어지나요?", a: "AI 추론 비용 하락 속도는 무어의 법칙(2년 2배)을 훨씬 능가합니다. 실제 수치: GPT-4급 API — 2023.03 $60/100만 토큰 → 2024 초 $10 → 2025 초 $2 → 2026 초 $0.40 이하. 약 3년 만에 150배 하락(연 ~10배). Blackwell(B200)은 H100 대비 추론 비용을 추가 10~15배 절감, 2021년 대비 전체 하락폭은 약 280배입니다. 역설1 — 싸질수록 더 쓴다: 단가가 90% 하락하는 동안 기업 총 AI 인프라 지출은 오히려 320% 증가했습니다(수요 탄력성). 역설2 — 최고급은 여전히 비싸다: 평범한 추론은 무료에 수렴하나 최고 성능 프런티어 모델은 $15~$75/100만 토큰 프리미엄을 유지합니다. 시사점: 비용 절감만을 위한 AI 도입은 유효기간이 짧습니다(경쟁자도 같은 AI 사용). 차별화하려면 데이터·워크플로우 통합·독점 지식이 핵심입니다.", nav: "dynamics", keywords: ["추론", "비용", "inference", "토큰", "가격", "280"] },
    { q: "AI 할루시네이션은 얼마나 심각한가요?", a: "할루시네이션은 AI가 존재하지 않는 사실을 자신감 있게 만들어내는 현상으로, 완전 해결됐다는 회사는 없습니다. 규모: 2024년 한 해 전 세계 기업에 약 $67.4B 손실을 야기했다는 추정이 있습니다(Salesforce Research). 모델별(요약 작업): Gemini 2.0 Flash 0.7%, GPT-4o 1.5%, Claude 4.6 4%, 평균 프로덕션 ~9.2%, 법률 문서는 17~34%(Stanford HAI). 더 위험한 진실: 비싼 추론 모델일수록 '모른다' 대신 그럴듯한 답을 만들어 더 자신감 있게 틀릴 수 있습니다. IT 전문가 68%가 프로덕션에서 목격, 엔터프라이즈 사용자 47%가 할루시네이션 정보로 실제 의사결정을 내린 경험이 있다고 답했습니다(IBM Institute). 실무 대응: (1) RAG — 답하기 전 검증된 문서에서 근거 검색, (2) 소스 인용 요구, (3) 이중 검증(다른 AI/사람 팩트체크), (4) 도메인 파인튜닝. 0% 할루시네이션 AI는 없습니다 — 중요한 의사결정엔 반드시 사람 검증이 필요합니다.", nav: "dynamics", keywords: ["할루시네이션", "hallucination", "거짓", "신뢰", "오류", "rag"] },
    { q: "AI 투자 붐인데 왜 스타트업이 망하나요?", a: "투자 금액과 생존율은 별개입니다. 규모: 2024년 창업한 14,000개+ AI 스타트업 중 2025년에만 3,800개 폐업(1년 실패율 27%), 2026년 초 추가 1,800개 폐업, 누적 생존율 약 60%. 3가지 사망 패턴: (1) 래퍼 신드롬 — OpenAI·Claude API를 얇게 포장해 파는 앱은 본사가 같은 기능을 기본 탑재하는 순간 우위 상실('AI로 이력서 써드립니다'류). (2) 파일럿 지옥 — 기업 고객의 무료 파일럿 요청이 반복되는데, MIT 기준 AI 파일럿의 95%가 측정 가능한 ROI를 증명 못 해 본계약으로 못 갑니다. (3) 비용 역진 — 저가를 경쟁 우위로 삼았는데 API 단가가 매년 10배씩 하락해 '우리가 더 싸다'가 무의미해집니다. 생존한 40%의 공통점: Scale AI(독점 데이터), Harvey(법률 워크플로우 통합), Cursor(IDE 깊은 통합) — 모두 API 위가 아니라 워크플로우 안에 녹아들었습니다.", nav: "startup", keywords: ["스타트업", "실패", "폐업", "버블", "wrapper", "파일럿", "roi"] },
    { q: "가장 빠르게 성장하는 AI 스타트업은?", a: "2026년 가장 큰 변화는 '수평적 LLM'에서 '수직적 전문 AI'로의 중심 이동입니다. 주요 기업: ElevenLabs(음성 합성, 밸류 $11B, 160개국 3M+ 크리에이터), Harvey(AI 법률, $11B, Allen & Overy 등 글로벌 로펌), Sierra(AI 고객서비스, $10B, ARR 배수 67x로 최고 수준), Glean(기업 지식 검색, $7.2B, Fortune 500 200+ 고객), Databricks(데이터+AI, $134B, ARR $3B+), Mistral(유럽 최대, $23B, 오픈소스 전략). 투자 패턴 변화: 2023~24년엔 'GPT를 업종에 적용한다'만으로 투자가 쏟아졌지만, 2026년엔 '실제 ARR과 고객 ROI 증명' 없이는 후속 투자가 어렵습니다. Sierra의 67x ARR 배수는 고객 서비스 비용을 60~80% 절감한다는 구체적 데이터가 뒷받침합니다.", nav: "startup", keywords: ["스타트업", "성장", "빠른", "버티컬", "elevenlabs", "harvey", "sierra"] },
    { q: "Physical AI(물리적 AI)란?", a: "지금까지 AI는 주로 화면 속(검색·요약·코드)에 있었습니다. Physical AI는 이 경계를 넘어 로봇·자율주행이라는 물리 세계로 AI를 확장합니다 — NVIDIA Jensen Huang은 이를 'AI의 다음 물결'이라 표현했습니다. 앞선 사례: Waymo(Alphabet 산하, 밸류 $126B, SF·피닉스·LA 상용 서비스, 주당 10만 회+ 유료 탑승), Tesla Optimus(인간형 로봇, 2025 공장 투입, 2026 외부 판매 목표), Figure AI(BMW 공장 배포, OpenAI 파트너십으로 언어 이해 통합), 1X Technologies(가정용 로봇 개발). 전망: 골드만삭스는 2026년 인간형 로봇 5~10만 대 출하 전망, 물리적 AI 시장 2035E $1.15T(CAGR 33.5%). 왜 지금인가: ① 대형 언어 모델(환경 이해) ② 컴퓨터 비전(시각 인식) ③ 로봇 제어 알고리즘이 동시에 성숙했기 때문입니다. NVIDIA Isaac Sim·Omniverse는 로봇을 가상 환경에서 먼저 훈련시키는 핵심 인프라입니다.", nav: "insights", keywords: ["physical", "물리적", "로봇", "자율주행", "waymo", "optimus", "figure"] },
    { q: "AI가 정말 일자리를 빼앗나요?", a: "기술 혁명마다 반복된 공포지만, 이번엔 AI가 처음으로 '지식 노동'을 자동화한다는 점이 다릅니다. 데이터: Goldman Sachs(2026.01)는 전 세계 3억 명 일자리가 AI에 노출, 2026년 2,500만 대체 → 2030년 2.7억으로 확대될 것으로 추정합니다. 취약 직군은 행정·데이터 입력(노출도 26%), 고객서비스(20%), 회계·법률 보조(18%) 순. 반대 데이터도 있습니다: AI 신규 직종(프롬프트 엔지니어, AI 트레이너, AI 감사관, 에이전트 아키텍트 등)이 빠르게 생기고, LinkedIn 기준 GenAI 능숙자 채용 수요는 비사용자 대비 3.5배, McKinsey 연구에선 AI 통합자가 평균 40% 높은 생산성을 보였습니다. 솔직한 결론: '대체'보다 'AI를 쓰는 사람이 못 쓰는 사람을 대체'하는 패턴이며, 같은 직업 안에서도 생산성·소득 격차가 벌어지고 있습니다.", nav: "insights", keywords: ["일자리", "고용", "자동화", "실직", "goldman", "직업"] },
    { q: "오픈소스와 클로즈드 모델의 차이는?", a: "오픈소스 vs 클로즈드는 기업의 데이터 전략·비용 구조·규제 대응 전체가 달라지는 결정입니다. 오픈 가중치(Llama 4·Mistral·DeepSeek): 가중치를 공개 배포 — 장점은 무료/저렴, 자체 서버 배포로 데이터 외부 유출 없음, 파인튜닝 자유, EU AI Act 기본 의무 대부분 면제. 단점은 자체 인프라 비용·운영/보안 책임·최고 성능 대비 격차(축소 중). 클로즈드(GPT·Claude·Gemini): API 전용 — 장점은 최고 성능·운영 부담 없음·빠른 업데이트. 단점은 데이터가 API 서버 통과·토큰 비용 누적·서비스 중단/정책 변경 리스크. 2026년 격차: DeepSeek R1이 GPT-4급을 1/10 비용으로 구현하며 격차가 급격히 줄고, Meta Llama 4도 근접했습니다. 한국·유럽 기업은 규제 때문에 오픈소스 자체 배포가 늘고 있습니다. 선택 기준: 데이터 보안·컴플라이언스 최우선 → 오픈소스 자체 배포 / 최고 성능·빠른 도입 우선 → 클로즈드 API.", nav: "dynamics", keywords: ["오픈소스", "llama", "deepseek", "클로즈드", "차이", "eu"] },
    { q: "빅테크가 AI를 독점한다는 반독점 조사는?", a: "AI 반독점 구도는 '가해자와 피해자가 동시에 되는' 구조입니다. 조사 현황: 미 DOJ는 NVIDIA를, FTC는 Microsoft·OpenAI를 조사 중이며 EU도 여러 AI 파트너십을 예비 조사 중입니다. 핵심 쟁점 — 순환 지출: MS가 OpenAI에 투자한 $13B+의 상당분이 Azure 크레딧 형태라, OpenAI가 이를 다시 Azure 사용료로 MS에 지불 — 돈이 순환되며 Azure 사용을 구조적으로 강제합니다. FTC는 이를 사실상의 클라우드 락인으로 봅니다. NVIDIA: GPU 80%+ 점유보다 CUDA 생태계 락인이 더 문제입니다(다른 칩으로 이전하려면 코드 전면 재작성). 역설: OpenAI는 자신이 FTC 조사를 받으면서 2025.09 EU에 Google·Apple·MS를 데이터 독점으로 반독점 신고했습니다 — '모두가 서로를 독점이라 부르는 상태'입니다.", nav: "bigtech", keywords: ["반독점", "독점", "ftc", "doj", "규제", "antitrust", "순환"] },
    { q: "Google·Amazon 자체 칩으로 NVIDIA 시대는 끝나나요?", a: "'NVIDIA 시대의 끝'은 이르지만 '분리(Decoupling)의 시작'은 사실입니다. 2026년 자체 칩: Google TPU v7(Ironwood, 추론 전력효율 B200의 약 2배, Google 내부 추론 80%+에 사용), Amazon Trainium 3(Anthropic 모델 학습에 집중), MS Maia 2(Copilot 추론 일부), Meta MTIA 2(광고 추천). 4사 합산 약 190만 가속기 배포. 왜 NVIDIA가 안 무너지나: 첫째 CUDA 생태계 — 수백만 연구자·엔지니어가 PyTorch/TensorFlow 기반으로 훈련받았고 최적화 라이브러리가 모두 CUDA 위에서 작동합니다(기술이 아니라 업계 전체의 습관 변화 필요). 둘째 하이퍼스케일러들이 자체 칩을 쓰면서도 NVIDIA 구매를 줄이지 않습니다(자체 칩=추론 특화, NVIDIA=범용 학습·R&D). 전망: NVIDIA FY27 데이터센터 매출 전망은 오히려 $105~120B로 상향됐고, 'CUDA 완전 대체에 5~7년'이 현재 컨센서스입니다.", nav: "bigtech", keywords: ["nvidia", "tpu", "trainium", "칩", "cuda", "반도체", "custom"] },
    { q: "미국의 중국 AI 칩 수출통제는 효과가 있나요?", a: "수출통제는 '속도를 늦추는 데'는 효과가 있었지만 '막는 데'는 실패했습니다. DeepSeek 등장 이후 '칩보다 알고리즘'이 드러나며 전략 재검토 목소리가 커졌습니다. 구멍: 2022년 이후 미국은 H100·A100 등 고성능 칩의 중국 수출을 금지했지만, 2026.05.31 미 상무부는 자국 기업들이 1년+ 중국 자회사를 통해 우회 판매해온 사실을 인정했고 싱가포르·말레이시아 등 제3국 우회 조달도 확인됐습니다. DeepSeek가 바꾼 게임: 칩 부족 환경에서 알고리즘 혁신(MoE 구조 최적화, 추론 시간 컴퓨트 배분)으로 GPT-4급을 1/10 비용에 구현 — '최고 성능 칩 없이도 최고 성능 AI가 가능'함을 증명했습니다. 수출통제는 하드웨어를 겨냥했지만 진짜 경쟁력은 알고리즘·데이터에 있었습니다. 중국 대응: Huawei Ascend·SMIC 내수 생산을 의무 확대하는 '평행 구매' 정책으로 2026년 말 AI 칩 내수 자급률 60% 목표를 세웠습니다.", nav: "dynamics", keywords: ["중국", "수출통제", "deepseek", "huawei", "지정학", "미중", "export"] },
    { q: "엔비디아 CPU를 탑재한 AI 노트북 시장은 어떤가요?", a: "NVIDIA는 서버·데스크톱 GPU의 절대 강자였지만 노트북에선 Intel·AMD에 밀렸습니다. 2026년 구도가 바뀌기 시작합니다. AI PC 진입: MediaTek와 공동 개발한 Arm 기반 PC용 SoC 'N1·N1X'(Blackwell GPU 코어 통합)를 2026년 출시 — GPU는 NVIDIA, CPU는 MediaTek Arm 설계 구조이며 주요 노트북 제조사와 협의 중입니다. CES 2025에서 GB10 Superchip 기반 데스크톱 'Project DIGITS'도 공개 — 로컬에서 200B 파라미터 모델을 실행하는 AI 워크스테이션($3,000 이하 목표). AI PC 전체 전망: Canalys 기준 2026년 신규 PC 출하의 40%+가 AI PC(온디바이스 NPU), 2027년 과반. Qualcomm Snapdragon X Elite·Apple M4·Intel Core Ultra가 주도하며 NVIDIA N1X는 후발 참전입니다. 핵심 변수: Arm PC의 x86 호환성 — Windows on Arm 에뮬레이션이 크게 향상됐지만 구형 x86 전용 SW 기업 환경에선 여전히 제약이 있습니다.", nav: "bigtech", keywords: ["엔비디아", "노트북", "ai pc", "arm", "n1x", "mediatek", "온디바이스", "snapdragon"] },
    { q: "SpaceX·xAI·Cursor는 무슨 관계인가요?", a: "세 이름은 일론 머스크 생태계의 다른 레이어입니다. 구조: xAI는 머스크가 2023년 창업한 AI 기업으로 Grok(대화 AI)을 만들어 X(구 Twitter)에 통합했습니다. SpaceX는 xAI의 투자자·파트너이자 머스크의 비공개 기업 중 최대 규모입니다. Cursor는 2026.06.16 SpaceX가 $60B에 인수 합의한 AI 코딩 에이전트입니다. 왜 SpaceX가 Cursor를 샀나: SpaceX·xAI·Tesla 생태계는 막대한 SW 엔지니어링 인력을 보유 — Cursor(ARR $2B+, 기업 고객 60%)로 내부 개발 생산성을 높이고 동시에 외부 시장에서 GitHub Copilot·Claude Code와 경쟁하는 포석입니다. 주가: SpaceX는 2026.06.12 나스닥에 SPCX로 상장했고, 본 대시보드 '주가 차트' 섹션에서 일별 종가를 확인할 수 있습니다(실시세 피드 반영 전까지는 상장일 기준 시나리오 시세로 표시). 본 대시보드는 'SpaceX (xAI, Cursor)'로 통일 표기합니다.", nav: "native", keywords: ["spacex", "xai", "cursor", "머스크", "인수", "코딩", "spcx"] },
    { q: "AI 에이전트가 스마트폰에서 지금 당장 할 수 있는 일과 아직 위험한 일은?", a: "AI 에이전트가 폰에 탑재되며 '알아서 일을 처리'한다는 기대가 커졌지만 현실은 단계적입니다. 지금 잘 되는 일(저위험·되돌릴 수 있음): 웹 검색 요약·비교, 사진 편집·배경 제거, 이메일/문자 초안, 일정 등록·알람, 번역, 쇼핑 가격 비교, 설정 변경 안내 — 실수해도 쉽게 확인·복구됩니다. 아직 위험한 일(고위험·복구 어려움): 결제·이체, 계약서 서명, 계정 비밀번호·보안 설정 변경, 의료 진단·약 복용 결정, 금융 투자 주문, 외부 서비스 자동 가입 — 실수 시 피해가 즉각적입니다. 벤치마크 현실: OpenAI Computer Use 모델은 WebVoyager 87%, OSWorld 38.1% — 즉 38%는 실수한다는 뜻이며, Apple Intelligence도 '중요 작업 전 사용자 확인' 원칙을 유지합니다. 설계 원칙: 완전 자동화(Fire-and-Forget)보다 '승인형 자동화(Human-in-the-Loop)'가 정답입니다 — AI가 계획·제안하면 사람이 최종 확인. 작업 로그 기록·단계별 취소·민감 작업 권한 분리가 모바일 에이전트의 필수 UX입니다.", nav: "dynamics", keywords: ["에이전트", "agent", "스마트폰", "모바일", "승인", "자동화", "computer use", "온디바이스"] },
    { q: "AI 데이터센터 전력 소비 문제는 얼마나 심각한가요?", a: "AI가 세상을 바꾸는 속도만큼 전력망도 바꾸고 있습니다 — AI 성장의 가장 현실적인 물리적 제약입니다. 현재 규모: 글로벌 데이터센터 전력 소비는 2026년 약 1,000TWh(전 세계 전력의 3~4%), 2030년 2,500~4,000TWh(8~10%)로 2~4배 증가 전망입니다(IEA). GPT-4 쿼리 한 건은 Google 검색의 약 10배 전력을 씁니다. 왜 특히 심각한가: Blackwell(B200) 칩 하나가 1,000W, DGX B200 서버 하나가 14,400W를 소비하며, 이를 수십만 대 운영하는 하이퍼스케일러의 총 수요는 기존 전력망 설계를 벗어납니다. Goldman Sachs는 AI 수요로 미국 전력망 수요가 2030년까지 +160GW(현 발전 용량의 약 15%) 증가할 것으로 추정합니다. 해결책·새 산업: 효율 혁신(Blackwell H100 대비 전력효율 30배), 재생에너지(MS·Amazon 100% 조달 목표), SMR(MS의 Three Mile Island 재가동 계약, Amazon의 SMR 스타트업 투자), 지열(Google–Fervo Energy 장기 계약). 이 흐름에서 원자력 유틸리티 Vistra·Constellation이 AI 수혜주로 2025~26년 100%+ 상승했습니다.", nav: "insights", keywords: ["전력", "데이터센터", "에너지", "twh", "원자력", "smr", "iea", "160gw"] },
    { q: "Apple AI(Apple Intelligence)는 왜 늦은 건가요?", a: "Apple Intelligence는 출시가 늦었습니다(ChatGPT 2022, Claude 2023, Apple은 WWDC 2024 iPhone 16부터). 단순 지연이 아니라 접근 방식 자체가 달랐기 때문입니다. 설계 원칙 — 프라이버시 우선: 다른 회사는 데이터를 서버로 보내 처리했지만, Apple은 '사용자 데이터가 Apple 서버조차 통과해선 안 된다'를 고수했습니다. 이것이 Private Cloud Compute(PCC)의 배경입니다 — 무거운 추론이 필요할 때만 무기명 암호화 상태로 클라우드에 맡기고 Apple 엔지니어조차 데이터를 볼 수 없는 구조입니다. 왜 어려운가: 온디바이스는 성능 제약이 있고, PCC는 프라이버시와 성능을 동시에 달성하려 신뢰 검증·암호화·무기명 파이프라인을 새로 설계해야 했습니다(Siri 백엔드도 전면 재설계). 2026 WWDC 변화: Foundation Models 프레임워크를 공개해 개발자가 온디바이스 모델·PCC·제3자 LLM(ChatGPT 포함)을 하나의 API로 연결 가능 — Apple이 'AI 배포 플랫폼'으로 진화하는 신호입니다. 진짜 강점: 느리지만 Neural Engine 탑재 Apple Silicon(M4·A18 Pro)은 온디바이스 추론 전력효율 동급 최강이며, 약 20억 대 기기가 이 칩을 탑재한 독보적 배포 채널입니다.", nav: "bigtech", keywords: ["apple", "애플", "apple intelligence", "siri", "pcc", "온디바이스", "프라이버시", "foundation models"] },
    { q: "상장 AI 기업 주가는 어디서 보나요?", a: "본 대시보드 하단 '주가 차트' 섹션에서 NVIDIA·Microsoft·Amazon·Apple·Alphabet(Google)·Meta의 일별 주가와 시가총액을 1년/5년으로 볼 수 있습니다. 주가는 매일 자동 크롤링된 실제 종가이며(Yahoo Finance→Stooq→Nasdaq 등 다중 소스), 차트에 마우스를 올리면 해당일 종가가, 주요 변곡점에는 상승/하락 사유가 표시됩니다. SpaceX(xAI, Cursor)는 2026.06.12 나스닥 SPCX로 상장 — 공개 시세 피드가 SPCX를 반영하면 실데이터로 자동 표시되며, 그 전까지는 상장일 기준 시나리오 시세(실데이터 아님)로 표시됩니다.", nav: "stocks", keywords: ["주가", "주식", "차트", "상장", "stock", "시총", "변곡점", "spcx"] },
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
        { date: "2025-01-27", dir: "down", label: "DeepSeek 쇼크", reason: "DeepSeek가 1/10 비용으로 GPT-4급 성능을 구현했다는 소식에 'AI 칩 과잉투자' 우려. 하루 -17%, 시총 약 $600B 증발." },
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
      note: "SPCX(나스닥, 2026-06-12 상장). 매일 Yahoo Finance→Stooq→Nasdaq→StockAnalysis→TradingView 순으로 실시세를 시도하며, 실데이터가 확인되면 자동 대체됩니다. 현재 차트는 상장일 기준 '시나리오 추정 시세'이며 실제 거래 데이터가 아닙니다.",
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

  return { CATEGORIES, COMPANIES, COMPANY_ORDER, ARTICLES, REPORTS, MARKET_GROWTH, MARKET_VERTICAL, FUNDING, SHARE, USERS, BAND_PRICE, FUNDING_TREND, AI_DEALS, REVENUE, BIZ_MODELS, PRICING_MODELS, TOKEN_PRICING, KPIS, TOPLINE, INSIGHTS, CAP_REL, QA_PAIRS, REVENUE_MONTHLY, STOCKS, STOCK_SHARES, attachStockEvents };
})();
