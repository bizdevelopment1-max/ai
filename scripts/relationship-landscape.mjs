const LAYER_ORDER = ["app", "agent", "service", "trust", "model", "data", "infra"];

const ADJACENT_LAYERS = {
  app: ["agent", "service", "trust", "model"],
  agent: ["app", "service", "trust", "model", "data"],
  service: ["app", "agent", "trust", "data", "infra"],
  trust: ["app", "agent", "service", "model", "data"],
  model: ["app", "agent", "trust", "data", "infra"],
  data: ["agent", "service", "trust", "model", "infra"],
  infra: ["service", "model", "data"],
};

const LAYER_TERMS = {
  infra: [
    "inference", "serving", "compute", "cloud", "gpu", "chip", "accelerator", "hosting",
    "추론", "서빙", "컴퓨트", "클라우드", "인프라", "가속기", "반도체", "데이터센터",
  ],
  data: [
    "developer", "coding", "ide", "mlops", "model hub", "observability", "vector database", "database",
    "개발자", "코딩", "개발환경", "모델 허브", "배포", "관측", "벡터", "데이터베이스",
  ],
  trust: [
    "security", "safety", "evaluation", "guardrail", "data labeling", "governance", "privacy", "identity", "rag", "deepfake", "fraud", "authentication",
    "보안", "안전", "평가", "가드레일", "라벨링", "거버넌스", "개인정보", "신원", "검증", "탐지", "딥페이크", "사기 방지",
  ],
  agent: [
    "agent", "agentic", "assistant", "automation", "workflow", "customer service", "browser",
    "에이전트", "어시스턴트", "자동화", "워크플로", "고객 서비스", "고객지원", "브라우저",
  ],
  service: [
    "enterprise ai platform", "marketplace", "billing", "payment", "monetization", "service platform", "workspace",
    "기업용 ai 플랫폼", "엔터프라이즈 플랫폼", "마켓플레이스", "과금", "정산", "결제", "수익화 플랫폼", "워크스페이스",
    "여러 ai 모델을 한곳", "사내 데이터 연결", "통합 디자인",
  ],
  model: [
    "foundation model", "language model", "llm", "multimodal model", "voice model", "image model", "video model",
    "파운데이션", "언어 모델", "멀티모달 모델", "음성 모델", "이미지 생성 모델", "영상 모델", "생성 모델",
  ],
  app: [
    "consumer", "companion", "creative", "design", "health", "medical", "finance", "legal", "education", "translation",
    "소비자", "컴패니언", "크리에이티브", "디자인", "헬스", "의료", "금융", "법률", "교육", "번역", "회의",
  ],
};

const normalize = value => String(value || "").toLowerCase().replace(/\s+/g, " ").trim();

const evidenceUrls = record => [
  record?.intelligence?.currentBusiness,
  record?.intelligence?.revenueModel,
  record?.intelligence?.strategyDirection,
  record?.intelligence?.investmentDirection,
].flatMap(section => section?.evidence || [])
  .map(item => item?.url)
  .filter(url => /^https?:\/\//.test(String(url || "")));

const companyText = record => normalize([
  ...(record?.profile?.business || []),
  record?.intelligence?.currentBusiness?.summary,
  record?.intelligence?.revenueModel?.summary,
  record?.intelligence?.strategyDirection?.summary,
].filter(Boolean).join(" · "));

export function classifyLandscapeLayer(record, registeredLayer = null) {
  if (registeredLayer?.layer && LAYER_ORDER.includes(registeredLayer.layer)) return registeredLayer.layer;
  const text = companyText(record);
  const scores = Object.fromEntries(LAYER_ORDER.map(layer => [layer, 0]));
  for (const [layer, terms] of Object.entries(LAYER_TERMS)) {
    for (const term of terms) if (text.includes(term)) scores[layer] += term.includes(" ") ? 5 : 3;
  }
  if (/\b(?:api|sdk)\b|개발 도구/.test(text)) scores.data += 4;
  if (/\b(?:platform|saas)\b|플랫폼/.test(text)) scores.service += 2;
  if (/\b(?:robot|robotics|wearable)\b|로봇|웨어러블/.test(text)) scores.app += 4;
  const ranked = LAYER_ORDER.map((layer, order) => ({ layer, score: scores[layer], order }))
    .sort((left, right) => right.score - left.score || left.order - right.order);
  return ranked[0].score > 0 ? ranked[0].layer : "app";
}

const conciseVertical = record => {
  const raw = record?.intelligence?.currentBusiness?.summary
    || (record?.profile?.business || []).find(Boolean)
    || "AI 소프트웨어·서비스";
  return String(raw).replace(/&#x27;|&apos;/gi, "'").replace(/&amp;/gi, "&").replace(/<[^>]*>/g, "")
    .split(" · ")[0].split(/[.!?。]/)[0].replace(/\s*\([^)]*\)\s*$/, "").trim().slice(0, 54);
};

const candidateScore = record => {
  const evidenceCount = new Set(evidenceUrls(record)).size;
  const grounded = [
    record?.intelligence?.currentBusiness,
    record?.intelligence?.revenueModel,
    record?.intelligence?.strategyDirection,
    record?.intelligence?.investmentDirection,
  ].filter(section => section?.groundingStatus === "source-grounded").length;
  const mentions = Math.max(0, Number(record?.mentions30 || 0));
  const official = /^https?:\/\//.test(String(record?.profile?.officialWebsite || "")) ? 1 : 0;
  const recent = /^20\d{2}-\d{2}-\d{2}/.test(String(record?.latest?.date || "")) ? 1 : 0;
  return evidenceCount * 12 + grounded * 6 + Math.min(mentions, 20) * 2 + official * 4 + recent * 3;
};

export function buildRelationshipLandscape({ dash, companyLedger, targetPerLayer = 6, maxCompanies = 56 }) {
  const registry = dash?.COMPANIES || [];
  const layerRegistry = dash?.COMPANY_LAYER || {};
  const companies = companyLedger?.companies || {};
  const selected = [];
  const selectedNames = new Set();

  for (const identity of registry) {
    const layerMeta = layerRegistry[identity.name] || {};
    const record = companies[identity.name] || {};
    const layer = classifyLandscapeLayer(record, layerMeta);
    selected.push({
      ...identity,
      domain: record?.logo?.domain || identity.domain || identity.url?.replace(/^https?:\/\/(?:www\.)?/, "").split("/")[0],
      logoUrl: record?.logo?.url || identity.logoUrl || "",
      layer,
      vchainVertical: layerMeta.vertical || conciseVertical(record) || identity.unit,
      adjacentLayers: Array.isArray(layerMeta.adjacent) ? layerMeta.adjacent : ADJACENT_LAYERS[layer],
      mobileFit: layerMeta.fit || "medium",
      sourceScore: candidateScore(record),
      registered: true,
    });
    selectedNames.add(identity.name);
  }

  const candidates = Object.entries(companies).flatMap(([name, record]) => {
    if (!name || selectedNames.has(name)) return [];
    const urls = new Set(evidenceUrls(record));
    if (!urls.size || record?.intelligence?.currentBusiness?.groundingStatus !== "source-grounded") return [];
    const layer = classifyLandscapeLayer(record);
    const website = record?.profile?.officialWebsite || "";
    return [{
      name,
      cat: "startup",
      group: layer,
      domain: website.replace(/^https?:\/\/(?:www\.)?/, "").split("/")[0],
      logoUrl: record?.logo?.url || "",
      unit: conciseVertical(record),
      url: website,
      layer,
      vchainVertical: conciseVertical(record),
      adjacentLayers: ADJACENT_LAYERS[layer],
      mobileFit: "medium",
      sourceScore: candidateScore(record),
      registered: false,
    }];
  }).sort((left, right) => right.sourceScore - left.sourceScore || left.name.localeCompare(right.name));

  for (const layer of LAYER_ORDER) {
    const current = selected.filter(company => company.layer === layer).length;
    const needed = Math.max(0, targetPerLayer - current);
    candidates.filter(company => company.layer === layer && !selectedNames.has(company.name))
      .slice(0, needed)
      .forEach(company => {
        selected.push(company);
        selectedNames.add(company.name);
      });
  }

  while (selected.length < maxCompanies) {
    const counts = Object.fromEntries(LAYER_ORDER.map(layer => [layer, selected.filter(company => company.layer === layer).length]));
    const next = candidates.filter(company => !selectedNames.has(company.name))
      .sort((left, right) => counts[left.layer] - counts[right.layer]
        || right.sourceScore - left.sourceScore
        || left.name.localeCompare(right.name))[0];
    if (!next) break;
    selected.push(next);
    selectedNames.add(next.name);
  }

  selected.sort((left, right) => LAYER_ORDER.indexOf(left.layer) - LAYER_ORDER.indexOf(right.layer)
    || Number(right.registered) - Number(left.registered)
    || right.sourceScore - left.sourceScore
    || left.name.localeCompare(right.name));

  const layerCounts = Object.fromEntries(LAYER_ORDER.map(layer => [
    layer,
    selected.filter(company => company.layer === layer).length,
  ]));
  return {
    schemaVersion: 1,
    sourceMode: "source-grounded-balanced-layer-selection",
    targetPerLayer,
    companyCount: selected.length,
    layerCounts,
    companies: selected,
  };
}

export const RELATIONSHIP_LANDSCAPE_LAYERS = LAYER_ORDER;
