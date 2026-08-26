#!/usr/bin/env node
/**
 * Converts crawled publisher-page evidence into company-level business
 * intelligence. The model is asked to synthesise only the supplied evidence
 * IDs. If model inference is unavailable, the site receives an extractive
 * source-linked summary rather than generic portfolio labels.
 */
import { readFile, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadDash } from "./load-dash.mjs";
import { llmJSON, llmAvailable } from "./llm.mjs";
import { aliasesFor, articleFocusScore, articleFocusedOnCompany, companyRegex, COMPANY_SOURCES } from "./company-sources.mjs";
import { bulletizeKorean } from "./korean-copy.mjs";

const readJson = async (file, fallback) => {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; }
};
const clean = value => String(value || "").replace(/\s+/g, " ").trim();
const first = (...values) => values.map(clean).find(Boolean) || "";
const claimKey = value => clean(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const claimTokens = value => new Set(clean(value).toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ").split(" ").filter(token => token.length >= 2));
const claimSimilarity = (left, right) => {
  const a = claimTokens(left);
  const b = claimTokens(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap++;
  return overlap / Math.min(a.size, b.size);
};
const nearDuplicateClaim = (left, right) => {
  const a = claimKey(left);
  const b = claimKey(right);
  if (!a || !b) return false;
  return a === b || (Math.min(a.length, b.length) >= 24 && (a.includes(b) || b.includes(a)))
    || claimSimilarity(left, right) >= 0.82;
};
const clip = (value, size = 280) => {
  const text = clean(value);
  return text.length > size ? `${text.slice(0, size - 1)}…` : text;
};
const decodeEntities = value => clean(value)
  .replace(/&#x27;|&#39;|&apos;/gi, "'")
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&amp;/gi, "&");
const compactBusinessLine = (value, companyName = "") => {
  const text = decodeEntities(value);
  if (!text) return "";
  const englishApp = text.match(/^Download\s+(.+?)\s+by\s+.+?\s+on the App Store\b/i);
  if (englishApp) return `${clip(englishApp[1], 120)} · iOS 앱`;
  const chineseApp = text.match(/App Store\s*下载[“\"](?:[^”\"]+)[”\"]的[“\"]([^”\"]+)[”\"]/i)
    || text.match(/在\s*App Store\s*下载[“\"](?:[^”\"]+)[”\"]的[“\"]([^”\"]+)[”\"]/i);
  if (chineseApp) return `${clip(chineseApp[1], 120)} · iOS 앱`;
  const segments = text.split(/\s+·\s+/).map(clean).filter(Boolean);
  const localized = segments.find(segment => /[가-힣]/.test(segment)
    && !/^(?:iOS|Android|Web)\s*앱$/i.test(segment)
    && !/스크린샷|평점|리뷰|사용자 팁/.test(segment));
  if (localized) return clip(localized, 180);
  const withoutStoreBoilerplate = text
    .replace(/\s*See screenshots, ratings and reviews[\s\S]*$/i, "")
    .replace(/\s*查看截屏、评分及评论[\s\S]*$/i, "");
  const firstSentence = withoutStoreBoilerplate.split(/(?<=[.!?])\s+/)[0];
  return clip(firstSentence || companyName, 180);
};
const compactBusinessProfile = (values, companyName = "") => {
  const rows = (Array.isArray(values) ? values : [values])
    .map(value => compactBusinessLine(value, companyName)).filter(Boolean)
    .filter((value, index, all) => all.findIndex(other => nearDuplicateClaim(other, value)) === index);
  const localizedDescriptions = rows.filter(value => /[가-힣]/.test(value) && !/· iOS 앱$/.test(value));
  return (localizedDescriptions.length ? localizedDescriptions : rows).slice(0, 4);
};
const canon = value => {
  try {
    const url = new URL(String(value || ""));
    url.hash = "";
    url.search = "";
    return url.href.replace(/\/+$/, "");
  } catch { return String(value || "").replace(/[?#].*$/, "").replace(/\/+$/, ""); }
};
const sourceBacked = article => article?.displayEligible !== false
  && article?.summaryMode === "source-content-extractive"
  && article?.provenance?.status === "source-backed"
  && /^https?:\/\//.test(String(article?.url || ""));
const localizedTitle = article => first(article?.titleKo, article?.localization?.title, article?.titleEn, article?.title);
const localizedLines = article => {
  const lines = article?.summaryLinesKo || article?.localization?.summaryLines || article?.summaryLinesEn || [];
  return Array.isArray(lines) ? lines.map(clean).filter(Boolean) : [];
};
const englishLines = article => {
  const lines = article?.summaryLinesEn || String(article?.summary || "").split("\n");
  return Array.isArray(lines) ? lines.map(clean).filter(Boolean) : [];
};
const alignedQuoteTranslation = (article, quote) => {
  const original = englishLines(article);
  const translated = localizedLines(article);
  const target = claimKey(quote);
  const index = original.findIndex(line => {
    const candidate = claimKey(line);
    return target.length >= 24 && candidate.length >= 24
      && (candidate.includes(target) || target.includes(candidate));
  });
  return index >= 0 && translated[index] ? bulletizeKorean(translated[index]) : "";
};

const quoteCandidates = (article, leaders) => {
  const paragraphs = article?.sourceContent?.paragraphs || [];
  const rows = [];
  for (const paragraph of paragraphs.slice(0, 28)) {
    const rawParagraph = String(paragraph);
    const hits = [...rawParagraph.matchAll(/[“"]([^"”]{24,420})[”"]/g)];
    const speakerHits = (leaders || []).map(person => {
      const index = rawParagraph.toLowerCase().indexOf(clean(person.name).toLowerCase());
      return index >= 0 ? { person, index, length: clean(person.name).length } : null;
    }).filter(Boolean);
    for (const speakerHit of speakerHits) {
      const nearest = hits.map(hit => {
        const start = hit.index;
        const end = start + hit[0].length;
        const speakerStart = speakerHit.index;
        const speakerEnd = speakerStart + speakerHit.length;
        const distance = speakerEnd < start ? start - speakerEnd : end < speakerStart ? speakerStart - end : 0;
        return { hit, distance };
      }).sort((left, right) => left.distance - right.distance)[0];
      if (!nearest || nearest.distance > 220) continue;
      const hit = nearest.hit;
      const speaker = speakerHit.person;
      rows.push({
        speaker: speaker.name,
        role: speaker.role || "",
        quoteOriginal: clean(hit[1]),
        quoteKo: alignedQuoteTranslation(article, hit[1]),
        evidenceUrl: article.url,
        source: article.source || "",
        date: article.date || "",
      });
    }
  }
  return rows.slice(0, 3);
};

const evidenceFor = (name, allArticles, leaders) => {
  const seen = new Set();
  const combined = allArticles
    .filter(article => sourceBacked(article) && articleFocusedOnCompany(name, article))
    .filter(article => {
      const key = canon(article.url);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))
      || articleFocusScore(name, b) - articleFocusScore(name, a))
    .slice(0, 8);
  return combined.map((article, index) => ({
    id: `e${index + 1}`,
    date: article.date || "",
    source: article.source || "",
    url: article.url,
    titleKo: clip(localizedTitle(article), 180),
    titleOriginal: clip(article.titleEn || article.title, 180),
    linesKo: localizedLines(article).slice(0, 3).map(line => clip(line, 260)),
    linesOriginal: englishLines(article).slice(0, 3).map(line => clip(line, 260)),
    quotes: quoteCandidates(article, leaders),
  }));
};
const officialEvidenceFor = rec => (rec.organization?.officialPages || [])
  .filter(page => page.category === "official-update"
    && page.status === "reachable"
    && /^https?:\/\//.test(page.resolvedUrl || page.url)
    && clean(page.pageTitle)
    && !/just a moment|access denied|attention required/i.test(page.pageTitle))
  .map(page => ({
    date: page.date || String(page.checkedAt || "").slice(0, 10),
    source: "Official company update",
    url: page.resolvedUrl || page.url,
    titleKo: clip(page.titleKo || page.pageTitle, 180),
    titleOriginal: clip(page.pageTitle, 180),
    linesKo: [clip(page.summaryKo, 260)].filter(Boolean),
    linesOriginal: [clip(page.description, 260)].filter(Boolean),
    quotes: [],
    sourceTier: "official",
  }));
const mergeEvidence = (...groups) => {
  const seen = new Set();
  return groups.flat()
    .filter(item => {
      const key = canon(item.url);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))
      || (b.sourceTier === "official") - (a.sourceTier === "official"))
    .slice(0, 8)
    .map((item, index) => ({ ...item, id: `e${index + 1}` }));
};

const evidenceRefs = (ids, evidence) => {
  const wanted = new Set(Array.isArray(ids) ? ids.map(String) : []);
  return evidence.filter(item => wanted.has(item.id))
    .map(item => ({ title: item.titleKo || item.titleOriginal, source: item.source, date: item.date, url: item.url }));
};
const allRefs = evidence => evidence.slice(0, 3)
  .map(item => ({ title: item.titleKo || item.titleOriginal, source: item.source, date: item.date, url: item.url }));
const negativeAction = /jailbreak|escaped? (?:its )?training|hack(?:ed|ing)?|attack(?:ed|ing)?|incident|wayward|rogue|compromis|sabotage|backlash|ditching|drops?\b|abandons?|switches? from|replaces?|lawsuit|settlement|sued?\b|security flaw|data breach|privacy (?:risk|concern|question|problem)|opt[- ]?out|raises? questions?|climate polluter|copyright complaint/i;
const strategicAction = /\b(?:launch(?:ed|es|ing)?|introduc(?:e|ed|es|ing)|expand(?:ed|s|ing)?|partner(?:ed|s|ing|ship)?|acquir(?:e|ed|es|ing)|invest(?:ed|s|ing|ment)?|build(?:s|ing)?|built|deploy(?:ed|s|ing|ment)?|releas(?:e|ed|es|ing)|open(?:ed|ing)?|enter(?:ed|s|ing)?|announc(?:e|ed|es|ing)|develop(?:ed|s|ing|ment)?|fund(?:ed|s|ing)?|rais(?:e|ed|es|ing)|appoint(?:ed|s|ing|ment)?|restructur(?:e|ed|es|ing)|publish(?:ed|es|ing)?)\b/i;
const isCompanyActionEvidence = item => {
  const text = clean(`${item?.titleOriginal || ""} ${(item?.linesOriginal || []).join(" ")}`);
  return strategicAction.test(text) && !negativeAction.test(text);
};
const isCompanyActionEvidenceFor = (name, item) => {
  if (!isCompanyActionEvidence(item)) return false;
  const title = clean(item?.titleOriginal || item?.titleKo);
  const match = companyRegex(name)?.exec(title);
  if (!match) return false;
  const prefix = title.slice(0, match.index);
  return !(/\b(?:without|competitor|rival|beats?|versus|vs\.?)\b/i.test(prefix)
    || /takes? (?:aim at|on)/i.test(prefix)
    || /\b(?:uses?|used|using|customer|client)\b/i.test(prefix));
};
const officialHostsFor = name => (COMPANY_SOURCES[name]?.official || []).map(url => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}).filter(Boolean);
const officialCompanyUrl = (name, url) => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return officialHostsFor(name).some(official => host === official || host.endsWith(`.${official}`));
  } catch { return false; }
};

const signalFocusedOnCompany = (name, signal, articleByUrl, kind) => {
  const linked = articleByUrl.get(canon(signal?.url));
  const text = clean(signal?.signal);
  const re = companyRegex(name);
  let titleMatched = false;
  if (linked) {
    const title = clean(linked.titleEn || linked.title);
    // Monetization and strategic ledgers require the company in the headline;
    // a comparison in the body is context, not evidence of the company's move.
    titleMatched = !!re?.test(title);
    if (!titleMatched || !articleFocusedOnCompany(name, linked)) return false;
  }
  const match = re?.exec(text);
  if (!match && !titleMatched) return false;
  const prefix = match ? text.slice(0, match.index) : "";
  if (match && (/\b(?:without|competitor|rival|beats?|versus|vs\.?)\b/i.test(prefix)
    || /takes? (?:aim at|on)/i.test(prefix))) return false;
  if (kind === "revenue") {
    if (!officialCompanyUrl(name, signal?.url)) return false;
    if (/settlement|eligible to receive|supported devices?|depend(?:s|ed)? on hardware|compatib/i.test(text)) return false;
    const revenueLanguage = /price|pricing|subscription|paying|revenue|\bARR\b|sales|sold|contract|licen[cs]e|usage (?:fee|credit|limit)|per (?:month|year)|purchase|orders?|shipment|margin|billing|monetiz|\bfee\b|\bseat\b|enterprise (?:plan|contract|license)|cloud (?:contract|revenue)/i;
    if (!revenueLanguage.test(text)) return false;
  } else {
    if (negativeAction.test(text)) return false;
    if (!strategicAction.test(text)) return false;
  }
  return titleMatched || match.index <= 120 || aliasesFor(name).some(alias => text.toLowerCase().startsWith(alias.toLowerCase()));
};

const sanitiseMonetization = (name, monet, articleByUrl) => {
  if (!monet) return null;
  const monetize = (monet.monetize || []).filter(signal => signalFocusedOnCompany(name, signal, articleByUrl, "revenue"));
  const direction = (monet.direction || []).filter(signal => signalFocusedOnCompany(name, signal, articleByUrl, "direction"));
  return { ...monet, monetize, direction };
};

const numericTokens = value => (clean(value).match(/(?:[$€£₩]\s*)?(?:[A-Za-z][A-Za-z.-]*[- ]?)?\d[\d,.]*(?:\s*[%억조만배명건]|[TBMK])?/gi) || [])
  .map(token => token.replace(/\s+/g, "").replace(/,/g, "").toLowerCase());
const speculative = value => /가능성|예상(?:된다|되는|한)|전망(?:된다|되는|한)|할 것으로|적용될 수|추정(?:된다|되는|한)/.test(clean(value));
const evidenceFingerprint = evidence => createHash("sha256")
  .update(evidence.map(item => `${canon(item.url)}|${item.date}`).join("\n"))
  .digest("hex").slice(0, 16);
const analysisCorpus = ({ base, rec, monet, evidence }) => clean(JSON.stringify({
  profile: rec.profile,
  strategyProfile: rec.strategyProfile,
  officialPages: rec.organization?.officialPages,
  monetization: monet,
  evidence,
}));
const supportedNumbers = (value, corpus) => numericTokens(value)
  .every(token => corpus.toLowerCase().replace(/,/g, "").includes(token));
const refKey = ref => canon(ref?.url);
const placeholderCopy = value => /(?:수집|확인|분석|업데이트|준비)\s*중|입력되지|신호\s*(?:없음|대기)|근거\s*매칭\s*대기|표시할\s+.+없|정보\s*없음/i.test(clean(value));
const blankSection = () => ({ summary: "", details: [], evidence: [] });
const PRACTICE_TYPES = [
  { id: "technology", legacyId: "model", label: "개발·기술", re: /\bmodel\b|research|reasoning|inference|benchmark|foundation|multimodal|training|모델|연구|추론|벤치마크|학습|멀티모달/i },
  { id: "product", legacyId: "product", label: "제품", re: /launch|release|rollout|feature|product|service|\bapp\b|출시|공개|기능|제품|서비스|앱|업데이트/i },
  { id: "partnerships", legacyId: "partner", label: "파트너십", re: /partner|collaboration|integration|alliance|ecosystem|customer|enterprise|제휴|협력|통합|생태계|고객|계약/i },
  { id: "infrastructure", legacyId: "infra", label: "인프라·생산", re: /data ?cent(?:er|re)|\bGPU\b|\bNPU\b|chip|compute|cloud|capex|infrastructure|server|factory|manufactur|데이터센터|칩|컴퓨트|클라우드|인프라|서버|공장|생산/i },
  { id: "capital", legacyId: "capital", label: "자본·인수", re: /funding|raise|invest|acqui|valuation|\bIPO\b|equity|조달|투자|인수|밸류|상장|지분/i },
  { id: "safety", legacyId: "safety", label: "안전·규제", re: /safety|regulat|policy|govern|lawsuit|copyright|privacy|security|안전|규제|정책|소송|저작권|프라이버시|보안/i },
  { id: "organization", legacyId: "talent", label: "인재·조직", re: /\bhire\b|talent|executive|leadership|founder|layoff|채용|인재|경영진|리더십|창업|감원|조직/i },
];
const practiceTypeFor = value => {
  const text = clean(value);
  return PRACTICE_TYPES.find(type => type.re.test(text)) || null;
};
const CAPABILITY_ARCHETYPES = {
  voice: {
    focus: "실시간 음성 인식·합성·대화 처리",
    delivery: "음성 모델·API와 사용자 경험",
    implication: "지연시간·정확도·로컬 처리 범위를 기준으로 서비스 결합 후보 비교",
    metrics: ["추론 지연시간", "인식·합성 품질", "로컬 처리 비중"],
  },
  camera: {
    focus: "이미지 생성·편집·복원",
    delivery: "크리에이터 앱·SDK·모델 API",
    implication: "편집 완성도·처리 원가·반복 사용을 기준으로 크리에이터 기능 결합성 검증",
    metrics: ["편집 완료율", "처리 원가", "주간 재사용률"],
  },
  video: {
    focus: "영상 생성·편집·아바타",
    delivery: "크리에이터 앱·기업용 제작 도구·API",
    implication: "생성 품질·처리시간·유료 전환을 기준으로 미디어 서비스 확장성 검증",
    metrics: ["생성 완료율", "처리시간", "유료 전환율"],
  },
  music: {
    focus: "음악·오디오 생성",
    delivery: "소비자 제작 서비스·라이선스 모델",
    implication: "저작권 범위·생성 품질·결제 전환을 중심으로 콘텐츠 사업 적합성 검증",
    metrics: ["생성 후 저장률", "유료 전환율", "권리 처리 범위"],
  },
  ondevice: {
    focus: "경량 모델·로컬 추론 최적화",
    delivery: "런타임·SDK·모델 라이선스",
    implication: "메모리·전력·지연시간 절감 효과를 기준으로 로컬 실행 역량 검증",
    metrics: ["메모리 사용량", "전력 소모", "추론 지연시간"],
  },
  foundation: {
    focus: "파운데이션·멀티모달 모델",
    delivery: "모델 API·기업 배포·라이선스",
    implication: "모델 효율·차별 성능·라이선스 유연성을 기준으로 공급 포트폴리오 비교",
    metrics: ["품질 벤치마크", "토큰당 원가", "라이선스 범위"],
  },
  infra: {
    focus: "학습·추론 인프라와 모델 배포",
    delivery: "클라우드·서빙 플랫폼·가속 하드웨어",
    implication: "추론 단가·가용성·전환 비용을 기준으로 인프라 파트너 적합성 검증",
    metrics: ["추론 단가", "가용성", "배포 전환시간"],
  },
  data: {
    focus: "기업 데이터·검색·거버넌스 기반",
    delivery: "데이터 플랫폼·API·기업용 관리 계층",
    implication: "데이터 연결성·거버넌스·검색 품질을 기준으로 기업 AI 기반 적합성 검증",
    metrics: ["데이터 연결 범위", "검색 정확도", "거버넌스 적용률"],
  },
  trust: {
    focus: "AI 안전·보안·위변조 탐지",
    delivery: "탐지 API·SDK·기업 보안 서비스",
    implication: "탐지 정확도·오탐률·로컬 실행성을 기준으로 신뢰 서비스 결합성 검증",
    metrics: ["탐지 정확도", "오탐률", "로컬 실행 가능성"],
  },
  agent: {
    focus: "에이전트 실행·개인화·오케스트레이션",
    delivery: "소비자 서비스·기업용 에이전트·API",
    implication: "과업 완료율·유지율·권한 통제를 기준으로 에이전트 서비스 결합성 검증",
    metrics: ["과업 완료율", "주간 유지율", "승인 없는 실행률"],
  },
  search: {
    focus: "검색·리서치·답변 생성",
    delivery: "검색 서비스·에이전트·API",
    implication: "답변 품질·재방문·외부 서비스 연결을 기준으로 검색 접점 확장성 검증",
    metrics: ["답변 성공률", "재방문율", "행동 전환율"],
  },
  productivity: {
    focus: "업무 생산성·문서·워크플로 자동화",
    delivery: "기업 좌석형 서비스·앱·API",
    implication: "업무시간 절감·좌석 확장·데이터 통제를 기준으로 기업 서비스 적합성 검증",
    metrics: ["활성 좌석률", "업무시간 절감", "순매출 유지율"],
  },
  vertical: {
    focus: "산업 특화 데이터·업무 흐름",
    delivery: "산업별 구독·기업 라이선스·성과형 서비스",
    implication: "도메인 정확도·규제 요건·기업 계약 확장성을 기준으로 버티컬 진입성 검증",
    metrics: ["도메인 정확도", "계약 확장률", "규제 충족 범위"],
  },
  robotics: {
    focus: "피지컬 AI·로보틱스·신규 폼팩터",
    delivery: "하드웨어·제어 모델·연결 서비스",
    implication: "안전성·원가·사용 빈도를 기준으로 신규 폼팩터 사업성을 단계 검증",
    metrics: ["과업 성공률", "단위 원가", "주간 사용시간"],
  },
};
const capabilityArchetype = (profile, currentBusiness = "") => {
  const explicit = CAPABILITY_ARCHETYPES[clean(profile?.classification?.category).toLowerCase()];
  if (explicit) return explicit;
  const text = clean(`${currentBusiness} ${profile?.currentBusiness || ""} ${profile?.classification?.vertical || ""}`).toLowerCase();
  const inferred = [
    [/딥페이크|사기|보안|안전|검증|guardrail|security|fraud|authentication/, "trust"],
    [/lakehouse|database|vector|데이터|검색 증강|거버넌스|rag\b/, "data"],
    [/온디바이스|로컬 추론|경량 모델|on[- ]?device|local inference|\bslm\b/, "ondevice"],
    [/사진|이미지|카메라|photo|image|camera|editor/, "camera"],
    [/영상|비디오|아바타|video|avatar/, "video"],
    [/음악|오디오|music|audio/, "music"],
    [/음성|voice|speech|stt|tts/, "voice"],
    [/로봇|robot|physical ai|피지컬/, "robotics"],
    [/검색|search|answer engine|리서치/, "search"],
    [/에이전트|agent|assistant|automation|workflow|워크플로/, "agent"],
    [/파운데이션|언어 모델|멀티모달 모델|foundation|\bllm\b/, "foundation"],
    [/클라우드|컴퓨트|추론 인프라|cloud|compute|inference platform|serving/, "infra"],
    [/생산성|문서|업무|enterprise|productivity|workspace/, "productivity"],
  ].find(([pattern]) => pattern.test(text))?.[1];
  return CAPABILITY_ARCHETYPES[inferred] || {
    focus: first(profile?.classification?.vertical, "AI 제품·서비스 차별화"),
    delivery: "제품·서비스·API 제공 계층",
    implication: "사용자 가치·차별성·반복 매출 가능성을 기준으로 포트폴리오 적합성 검증",
    metrics: ["활성 사용자", "유료 전환율", "고객 유지율"],
  };
};
const analystAction = value => {
  const text = clean(value);
  const actions = [
    /인수|M&A/i.test(text) && "M&A",
    /제휴|파트너|협력|라이선스/i.test(text) && "Partner",
    /투자/i.test(text) && "Invest",
  ].filter(Boolean);
  return actions.length ? actions.join(" · ") : "Watch";
};
const capabilityBaseline = ({ rec, currentBusiness, officialEvidence }) => {
  const strategyProfile = rec.strategyProfile || {};
  const archetype = capabilityArchetype(strategyProfile, currentBusiness);
  const dimensions = [
    { id: "business-focus", label: "제품·서비스 초점", value: first(strategyProfile.currentBusiness, currentBusiness) },
    { id: "capability-focus", label: "핵심 기술·경험", value: archetype.focus },
    { id: "delivery-layer", label: "제공 계층", value: archetype.delivery },
    { id: "market-focus", label: "시장·고객 축", value: strategyProfile.classification?.vertical },
  ].filter(item => clean(item.value)).filter((item, index, rows) =>
    rows.findIndex(other => nearDuplicateClaim(other.value, item.value)) === index).slice(0, 4);
  return {
    schemaVersion: 1,
    summary: dimensions.map(item => item.value).slice(0, 3).join(" · "),
    dimensions,
    evidence: officialEvidence.slice(0, 2),
    groundingStatus: "profile-and-taxonomy-grounded",
  };
};
const implicationBaseline = ({ rec, currentBusiness, officialEvidence }) => {
  const strategyProfile = rec.strategyProfile || {};
  const archetype = capabilityArchetype(strategyProfile, currentBusiness);
  const explicit = clean(strategyProfile.analystImplication);
  const assessment = explicit || archetype.implication;
  if (!assessment) return [];
  return [{
    id: "portfolio-fit",
    title: "사업 포트폴리오 검토",
    actionOption: analystAction(explicit),
    assessment: clip(assessment, 320),
    rationale: clip([currentBusiness, strategyProfile.classification?.vertical].filter(Boolean).join(" · "), 300),
    watchMetrics: archetype.metrics.slice(0, 4),
    evidence: officialEvidence.slice(0, 1),
    confidence: explicit ? "curated-assessment" : "taxonomy-inference",
    groundingStatus: "analyst-inference-separated-from-company-fact",
  }];
};
const publicationProfile = intelligence => {
  const practices = Array.isArray(intelligence.corePractices) ? intelligence.corePractices : [];
  const evidence = [
    ...["currentBusiness", "revenueModel", "strategyDirection", "investmentDirection"]
      .flatMap(key => intelligence[key]?.evidence || []),
    ...practices.map(item => item.evidence),
    ...(intelligence.capabilityProfile?.evidence || []),
    ...(intelligence.strategicImplications || []).flatMap(item => item.evidence || []),
  ].filter(item => item && /^https?:\/\//.test(String(item.url || "")));
  const latestEvidence = evidence.slice().sort((left, right) =>
    String(right.date || "").localeCompare(String(left.date || "")))[0] || null;
  const verifiedAt = clean(latestEvidence?.date);
  const verifiedTime = Date.parse(verifiedAt || "");
  const ageDays = Number.isFinite(verifiedTime)
    ? Math.max(0, Math.floor((Date.now() - verifiedTime) / 86_400_000)) : null;
  const visibleSections = [
    clean(intelligence.currentBusiness?.summary) && "product",
    practices.some(item => item.sectionId === "technology") && "technology",
    practices.some(item => item.sectionId === "infrastructure") && "infrastructure",
    clean(intelligence.revenueModel?.summary) && "goToMarket",
    practices.some(item => item.sectionId === "partnerships") && "partnerships",
    clean(intelligence.investmentDirection?.summary) && "investment",
  ].filter(Boolean);
  return {
    schemaVersion: 2,
    policy: "business+capability+implication-required+source-backed-optional-sections",
    coreComplete: visibleSections.includes("product")
      && (intelligence.capabilityProfile?.dimensions || []).length >= 2
      && (intelligence.strategicImplications || []).length >= 1,
    visibleSections,
    omittedSections: ["technology", "infrastructure", "goToMarket", "partnerships", "investment"]
      .filter(section => !visibleSections.includes(section)),
    lastVerifiedAt: verifiedAt,
    freshness: ageDays === null ? "undated" : ageDays <= 14 ? "fresh" : ageDays <= 90 ? "aging" : "stale",
    ageDays,
    latestEvidence: latestEvidence ? {
      title: latestEvidence.title || "",
      source: latestEvidence.source || "",
      date: latestEvidence.date || "",
      url: latestEvidence.url,
    } : null,
  };
};
const safeFallback = (fallback, corpus) => {
  const out = { ...fallback };
  for (const key of ["currentBusiness", "revenueModel", "strategyDirection", "investmentDirection"]) {
    const value = fallback[key] || blankSection();
    const body = `${value.summary || ""} ${(value.details || []).join(" ")}`;
    if (!placeholderCopy(body) && supportedNumbers(body, corpus)) continue;
    out[key] = blankSection();
  }
  return out;
};

// Sparse refreshes retain the last pipeline-verified section instead of
// replacing it with operational status copy. Numeric claims must still occur
// in the current source corpus.
const retainLastVerified = (next, previous, corpus) => {
  const out = { ...next };
  for (const key of ["currentBusiness", "revenueModel", "strategyDirection", "investmentDirection"]) {
    if (clean(out[key]?.summary)) continue;
    const prior = previous?.[key];
    const body = `${prior?.summary || ""} ${(prior?.details || []).join(" ")}`;
    const refs = (prior?.evidence || []).filter(ref => /^https?:\/\//.test(String(ref?.url || "")));
    const grounded = /grounded|checked/i.test(String(prior?.groundingStatus || previous?.groundingStatus || ""));
    if (!clean(prior?.summary) || placeholderCopy(body) || !supportedNumbers(body, corpus) || (!grounded && !refs.length)) continue;
    out[key] = { ...prior, evidence: refs, retainedSnapshot: true };
  }
  return out;
};

const finaliseIntelligence = (value, { name, evidence, fallback, corpus }) => {
  const allowedUrls = new Set([
    ...evidence.map(item => canon(item.url)),
    ...["currentBusiness", "revenueModel", "strategyDirection", "investmentDirection"]
      .flatMap(key => (fallback[key]?.evidence || []).map(refKey)),
    ...(fallback.executiveQuotes || []).map(item => canon(item.evidenceUrl)),
  ].filter(Boolean));
  const sectionKeys = ["currentBusiness", "revenueModel", "strategyDirection", "investmentDirection"];
  const seenDetails = new Set();
  const seenClaims = [];
  const seenEvidenceUrls = new Set();
  const evidenceByUrl = new Map(evidence.map(item => [canon(item.url), item]));
  const out = { ...value };
  for (const key of sectionKeys) {
    const fallbackSection = fallback[key] || blankSection();
    const candidate = out[key] || fallbackSection;
    const validSectionRef = ref => {
      if (!allowedUrls.has(refKey(ref))) return false;
      const source = evidenceByUrl.get(refKey(ref));
      if (!["strategyDirection", "investmentDirection"].includes(key)) return true;
      return Boolean(source) && isCompanyActionEvidenceFor(name, source);
    };
    const refs = (candidate.evidence || []).filter(validSectionRef);
    const body = `${candidate.summary || ""} ${(candidate.details || []).join(" ")}`;
    const unsupported = placeholderCopy(body)
      || !supportedNumbers(body, corpus)
      || ((key === "strategyDirection" || key === "investmentDirection") && speculative(body) && refs.length === 0)
      || (candidate.evidence || []).some(ref => !allowedUrls.has(refKey(ref)));
    let chosen = unsupported ? fallbackSection : { ...candidate, evidence: refs };
    const chosenRefs = (chosen.evidence || []).filter(validSectionRef);
    if (clean(`${chosen.summary || ""} ${(chosen.details || []).join(" ")}`) && chosenRefs.length === 0) {
      chosen = blankSection();
    } else {
      chosen = { ...chosen, evidence: chosenRefs };
    }
    if (seenClaims.some(previous => nearDuplicateClaim(previous, chosen.summary))) {
      const alternative = [fallbackSection.summary, ...(chosen.details || []), ...(fallbackSection.details || [])]
        .map(clean).find(text => text && !seenClaims.some(previous => nearDuplicateClaim(previous, text)));
      chosen = alternative ? { ...chosen, summary: alternative } : blankSection();
    }
    const summary = bulletizeKorean(clean(chosen.summary));
    if (summary) seenClaims.push(summary);
    const details = (chosen.details || []).map(detail => bulletizeKorean(clean(detail))).filter(detail => {
      const fingerprint = clean(detail).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
      if (!fingerprint || seenDetails.has(fingerprint)
        || seenClaims.some(previous => nearDuplicateClaim(previous, detail))) return false;
      seenDetails.add(fingerprint);
      seenClaims.push(detail);
      return true;
    });
    const uniqueEvidence = (chosen.evidence || []).filter(ref => {
      const url = refKey(ref);
      if (!url || seenEvidenceUrls.has(url)) return false;
      seenEvidenceUrls.add(url);
      return true;
    });
    const evidenceCount = uniqueEvidence.length;
    out[key] = {
      ...chosen,
      summary,
      details,
      evidence: uniqueEvidence,
      evidenceCount,
      confidence: evidenceCount >= 2 ? "high" : evidenceCount === 1 ? "medium" : "low",
      groundingStatus: unsupported ? "fallback-after-grounding-check"
        : evidenceCount ? "source-grounded" : "profile-grounded",
    };
  }
  const occupied = new Set(sectionKeys.flatMap(key => [
    out[key]?.summary,
    ...(out[key]?.details || []),
  ]).map(value => clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")).filter(Boolean));
  out.corePractices = (out.corePractices || []).filter(item => {
    if (!item.evidence?.url || !allowedUrls.has(refKey(item.evidence))) return false;
    const source = evidenceByUrl.get(refKey(item.evidence));
    const fingerprint = clean(item.title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    return source && isCompanyActionEvidenceFor(name, source) && !occupied.has(fingerprint);
  }).slice(0, 4).map(item => {
    const type = PRACTICE_TYPES.find(candidate => candidate.legacyId === item.id)
      || practiceTypeFor(`${item.title || ""} ${item.insight || ""} ${item.evidence?.title || ""}`);
    return {
      ...item,
      id: type?.legacyId || item.id || "",
      sectionId: type?.id || "",
      sectionLabel: type?.label || "",
      title: bulletizeKorean(item.title),
      insight: bulletizeKorean(item.insight),
    };
  });
  const fallbackCapabilities = fallback.capabilityProfile || { dimensions: [], evidence: [] };
  const capabilityCandidate = (out.capabilityProfile?.dimensions || []).length >= 2
    ? out.capabilityProfile : fallbackCapabilities;
  const capabilityEvidence = (capabilityCandidate.evidence || [])
    .filter(ref => allowedUrls.has(refKey(ref))).slice(0, 2);
  out.capabilityProfile = {
    schemaVersion: 1,
    summary: bulletizeKorean(clip(capabilityCandidate.summary, 360)),
    dimensions: (capabilityCandidate.dimensions || []).map(item => ({
      id: clean(item.id),
      label: clean(item.label),
      value: bulletizeKorean(clip(item.value, 240)),
    })).filter(item => item.id && item.label && item.value).slice(0, 4),
    evidence: capabilityEvidence,
    groundingStatus: "profile-and-taxonomy-grounded",
  };
  const implicationCandidate = (out.strategicImplications || []).length
    ? out.strategicImplications : fallback.strategicImplications || [];
  out.strategicImplications = implicationCandidate.map(item => ({
    id: clean(item.id) || "portfolio-fit",
    title: bulletizeKorean(clip(item.title, 100)),
    actionOption: clean(item.actionOption) || "Watch",
    assessment: bulletizeKorean(clip(item.assessment, 320)),
    rationale: bulletizeKorean(clip(item.rationale, 300)),
    watchMetrics: (item.watchMetrics || []).map(metric => bulletizeKorean(clip(metric, 80))).filter(Boolean).slice(0, 4),
    evidence: (item.evidence || []).filter(ref => allowedUrls.has(refKey(ref))).slice(0, 2),
    confidence: clean(item.confidence) || "taxonomy-inference",
    groundingStatus: "analyst-inference-separated-from-company-fact",
  })).filter(item => item.assessment && item.rationale).slice(0, 3);
  out.newBusinessModels = (out.newBusinessModels || []).filter(item =>
    item.evidence?.url && allowedUrls.has(refKey(item.evidence))
    && supportedNumbers(`${item.title} ${item.model} ${item.implication}`, corpus)).slice(0, 3)
    .map(item => ({
      ...item,
      title: bulletizeKorean(item.title),
      model: bulletizeKorean(item.model),
      implication: bulletizeKorean(item.implication),
    }));
  out.executiveQuotes = (out.executiveQuotes || []).filter(item =>
    item.evidenceUrl && allowedUrls.has(canon(item.evidenceUrl))).slice(0, 4)
    .map(item => ({ ...item, quoteKo: bulletizeKorean(item.quoteKo) }));
  out.meceFramework = [
    { key: "currentBusiness", label: "사업 범위", question: "무엇을 제공하는가" },
    { key: "revenueModel", label: "수익 엔진", question: "어떻게 돈을 버는가" },
    { key: "strategyDirection", label: "성장 방향", question: "어디로 확장하는가" },
    { key: "investmentDirection", label: "자본 배분", question: "무엇에 투자하는가" },
  ];
  out.evidenceFingerprint = evidenceFingerprint(evidence);
  out.groundingStatus = "numeric-and-source-reference-checked";
  out.publication = publicationProfile(out);
  return out;
};

const normaliseAnalysis = (analysis, evidence, fallback, corpus) => {
  const section = (value, base) => {
    const refs = evidenceRefs(value?.evidenceIds, evidence);
    // Model-authored copy is publishable only when it cites supplied evidence.
    // Missing/invalid evidence IDs fall back to the existing source-bound
    // extract rather than borrowing unrelated fallback links.
    const useModel = clean(value?.summary) && refs.length > 0;
    return {
      summary: clip(useModel ? value.summary : base.summary, 360),
      details: (useModel && Array.isArray(value?.details) ? value.details : base.details || [])
        .map(item => clip(item, 220)).filter(Boolean).slice(0, 4),
      evidence: useModel ? refs : base.evidence,
    };
  };
  const quoteIndex = new Map(evidence.flatMap(item => (item.quotes || []).map(quote => [`${item.id}|${quote.speaker}|${quote.quoteOriginal}`, { ...quote, evidenceId: item.id }])));
  const executiveQuotes = (analysis?.executiveQuotes || []).map(item => {
    const match = [...quoteIndex.values()].find(candidate => candidate.evidenceId === item.evidenceId
      && clean(candidate.quoteOriginal) === clean(item.quoteOriginal));
    if (!match || !clean(item.quoteKo)) return null;
    return { ...match, quoteKo: clip(item.quoteKo, 520) };
  }).filter(Boolean).slice(0, 4);
  const corePractices = (analysis?.corePractices || []).map(item => {
    const ref = evidence.find(source => source.id === item.evidenceId);
    if (!ref || !clean(item.title)) return null;
    const type = practiceTypeFor(`${item.title} ${item.insight || ""} ${ref.titleKo || ref.titleOriginal || ""}`);
    return {
      id: type?.legacyId || "",
      sectionId: type?.id || "",
      sectionLabel: type?.label || "",
      title: clip(item.title, 100),
      insight: clip(item.insight, 300),
      evidence: { title: ref.titleKo || ref.titleOriginal, source: ref.source, date: ref.date, url: ref.url },
    };
  }).filter(Boolean).slice(0, 4);
  const newBusinessModels = (analysis?.newBusinessModels || []).map(item => {
    const ref = evidence.find(source => source.id === item.evidenceId);
    if (!ref || !clean(item.title)) return null;
    return {
      title: clip(item.title, 120),
      model: clip(item.model, 300),
      implication: clip(item.implication, 300),
      evidence: { title: ref.titleKo || ref.titleOriginal, source: ref.source, date: ref.date, url: ref.url },
    };
  }).filter(Boolean).slice(0, 3);
  return finaliseIntelligence({
    currentBusiness: section(analysis?.currentBusiness, fallback.currentBusiness),
    revenueModel: section(analysis?.revenueModel, fallback.revenueModel),
    strategyDirection: section(analysis?.strategyDirection, fallback.strategyDirection),
    investmentDirection: section(analysis?.investmentDirection, fallback.investmentDirection),
    corePractices: corePractices.length ? corePractices : fallback.corePractices,
    newBusinessModels: newBusinessModels.length ? newBusinessModels : fallback.newBusinessModels,
    executiveQuotes: executiveQuotes.length ? executiveQuotes : fallback.executiveQuotes,
  }, { name: analysis?.name || "", evidence, fallback, corpus });
};

const fallbackIntelligence = ({ base, rec, monet, evidence, modelLabels, directionLabels }) => {
  const profile = rec.profile || {};
  const businessLines = compactBusinessProfile(profile.business || rec.strategyProfile?.currentBusiness, base?.name);
  const revenueSignals = monet?.monetize || [];
  const directionSignals = monet?.direction || [];
  const primaryModel = modelLabels.get(monet?.primaryModel);
  const currentBusiness = businessLines.join(" · ")
    || compactBusinessLine(base?.unit || localizedTitle(rec.latest), base?.name);
  const revenueEvidence = first(revenueSignals[0]?.signal);
  const revenueSummary = primaryModel
    ? [primaryModel, revenueEvidence].filter(Boolean).join(" 중심 · ")
    : revenueEvidence;
  const actionEvidence = evidence.find(item => isCompanyActionEvidenceFor(base?.name, item));
  const actionEvidenceRows = evidence.filter(item => isCompanyActionEvidenceFor(base?.name, item));
  const strategySummary = first(
    directionSignals[0]?.signal,
    actionEvidence?.titleKo,
    actionEvidence?.titleOriginal,
    rec.strategyProfile?.strategyDirection,
    base?.direction,
  );
  const investSignal = directionSignals.find(signal => ["ma", "invest", "partner"].includes(signal.kind));
  const investmentSummary = investSignal
    ? `${directionLabels.get(investSignal.kind) || "사업 확장"} · ${clip(investSignal.signal, 220)}`
    : "";
  const official = (rec.organization?.officialPages || []).find(page => page.status === "reachable");
  const profileVerifiedAt = first(profile.sourceAsOf, String(rec.coverage?.checkedAt || "").slice(0, 10));
  const profileUrls = [...new Set([
    profile.officialWebsite,
    ...(profile.sourceUrls || []),
    ...(COMPANY_SOURCES[base?.name]?.official || []),
  ].filter(url => /^https?:\/\//.test(String(url || ""))))];
  const profileEvidence = profileUrls.slice(0, 2).map((url, index) => ({
    title: index === 0 ? "공식 회사·제품 페이지" : "공식 기업 정보 원문",
    source: "Official company page",
    date: profileVerifiedAt,
    url,
  }));
  const officialEvidence = official ? [{
    title: "공식 회사·리더십 페이지",
    source: "Official company page",
    date: String(official.checkedAt || "").slice(0, 10),
    url: official.resolvedUrl || official.url,
  }] : profileEvidence;
  const executiveQuoteSeen = new Set();
  const executiveQuotes = [
    ...(rec.executiveFeed?.quotes || []),
    ...evidence.flatMap(item => item.quotes || []),
  ].filter(item => {
    const key = `${item.speaker}|${claimKey(item.quoteOriginal)}`;
    if (!item.quoteOriginal || !item.quoteKo || !/^https?:\/\//.test(String(item.evidenceUrl || "")) || executiveQuoteSeen.has(key)) return false;
    executiveQuoteSeen.add(key);
    return true;
  }).slice(0, 4);
  const capabilities = capabilityBaseline({ rec, currentBusiness, officialEvidence });
  const strategicImplications = implicationBaseline({ rec, currentBusiness, officialEvidence });
  return {
    currentBusiness: { summary: clip(currentBusiness, 360), details: businessLines.slice(0, 4), evidence: officialEvidence },
    revenueModel: {
      summary: clip(revenueSummary, 360),
      details: revenueSignals.slice(0, 3).map(signal => clip(signal.signal, 220)),
      evidence: revenueSignals.slice(0, 3).map(signal => ({ title: signal.signal, source: signal.source, date: signal.date, url: signal.url })),
    },
    strategyDirection: {
      summary: clip(strategySummary, 360),
      details: directionSignals.length
        ? directionSignals.slice(0, 3).map(signal => clip(signal.signal, 220))
        : actionEvidenceRows.slice(0, 3).map(item => item.titleKo || item.titleOriginal),
      evidence: directionSignals.length
        ? directionSignals.slice(0, 3).map(signal => ({ title: signal.signal, source: signal.source, date: signal.date, url: signal.url }))
        : actionEvidenceRows.slice(0, 3).map(item => ({ title: item.titleKo || item.titleOriginal, source: item.source, date: item.date, url: item.url })),
    },
    investmentDirection: {
      summary: clip(investmentSummary, 360),
      details: directionSignals.filter(signal => ["ma", "invest", "partner"].includes(signal.kind)).slice(0, 3).map(signal => clip(signal.signal, 220)),
      evidence: investSignal ? [{ title: investSignal.signal, source: investSignal.source, date: investSignal.date, url: investSignal.url }] : [],
    },
    corePractices: evidence.filter(item => isCompanyActionEvidenceFor(base?.name, item)).slice(0, 8).map(item => {
      const title = item.titleKo || item.titleOriginal;
      const insight = item.linesKo[1] || item.linesKo[0] || item.linesOriginal[0] || item.titleKo;
      const type = practiceTypeFor(`${title || ""} ${insight || ""} ${item.titleOriginal || ""} ${(item.linesOriginal || []).join(" ")}`);
      return {
        id: type?.legacyId || "",
        sectionId: type?.id || "",
        sectionLabel: type?.label || "",
        title,
        insight,
        evidence: { title, source: item.source, date: item.date, url: item.url },
      };
    }),
    newBusinessModels: revenueSignals.slice(0, 2).map(signal => ({
      title: modelLabels.get(signal.model) || "신규 수익화",
      model: clip(signal.signal, 300),
      implication: "제품·서비스·배포 방식의 변화가 반복 매출과 고객 접점을 확장하는지 추적",
      evidence: { title: signal.signal, source: signal.source, date: signal.date, url: signal.url },
    })),
    capabilityProfile: capabilities,
    strategicImplications,
    executiveQuotes,
  };
};

async function synthesizeBatch(inputs) {
  const schema = {
    type: "object",
    properties: {
      companies: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            currentBusiness: { type: "object", properties: { summary: { type: "string" }, details: { type: "array", items: { type: "string" } }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["summary", "details", "evidenceIds"], additionalProperties: false },
            revenueModel: { type: "object", properties: { summary: { type: "string" }, details: { type: "array", items: { type: "string" } }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["summary", "details", "evidenceIds"], additionalProperties: false },
            strategyDirection: { type: "object", properties: { summary: { type: "string" }, details: { type: "array", items: { type: "string" } }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["summary", "details", "evidenceIds"], additionalProperties: false },
            investmentDirection: { type: "object", properties: { summary: { type: "string" }, details: { type: "array", items: { type: "string" } }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["summary", "details", "evidenceIds"], additionalProperties: false },
            corePractices: { type: "array", items: { type: "object", properties: { title: { type: "string" }, insight: { type: "string" }, evidenceId: { type: "string" } }, required: ["title", "insight", "evidenceId"], additionalProperties: false } },
            newBusinessModels: { type: "array", items: { type: "object", properties: { title: { type: "string" }, model: { type: "string" }, implication: { type: "string" }, evidenceId: { type: "string" } }, required: ["title", "model", "implication", "evidenceId"], additionalProperties: false } },
            executiveQuotes: { type: "array", items: { type: "object", properties: { speaker: { type: "string" }, quoteOriginal: { type: "string" }, quoteKo: { type: "string" }, evidenceId: { type: "string" } }, required: ["speaker", "quoteOriginal", "quoteKo", "evidenceId"], additionalProperties: false } },
          },
          required: ["name", "currentBusiness", "revenueModel", "strategyDirection", "investmentDirection", "corePractices", "newBusinessModels", "executiveQuotes"],
          additionalProperties: false,
        },
      },
    },
    required: ["companies"],
    additionalProperties: false,
  };
  return llmJSON({
    system: [
      "당신은 통신·스마트폰 사업자를 위한 기업전략 애널리스트다.",
      "입력된 company profile, monetization signals, publisher evidence만 사용해 회사별 현재 사업, 수익모델, 향후 사업·투자 방향, 핵심 실행, 신규 비즈니스 모델을 한국어로 구체적으로 종합한다.",
      "MECE 원칙을 지킨다. currentBusiness는 제품·고객, revenueModel은 과금·매출원, strategyDirection은 회사가 발표하거나 실행한 확장, investmentDirection은 투자·인수·파트너 자본배분만 다룬다.",
      "같은 문장·사실·근거 ID를 여러 섹션에 반복하지 않는다. 어느 한 섹션에만 배치하고 다른 섹션은 고유 근거가 없으면 비운다.",
      "포트폴리오 옵션, 신호 감시, 우선순위 같은 일반론을 쓰지 않는다.",
      "근거가 없는 수치·인물·인과를 만들지 않는다. 각 판단은 입력 evidence id를 연결한다.",
      "근거가 부족한 선택 항목은 빈 문자열과 빈 배열로 반환한다. '수집 중', '확인 중', '대기', '데이터 없음' 같은 운영 상태 문구를 쓰지 않는다.",
      "executiveQuotes는 candidates에 있는 영문 원문을 단 한 글자도 바꾸지 말고 한국어 번역을 함께 제공한다. candidate가 없으면 빈 배열이다.",
      "모든 한국어 출력은 마침표 없이 명사형 개조식으로 쓴다. '~다', '~습니다', '~입니다', '~합니다' 종결은 금지한다.",
    ].join(" "),
    user: `다음 기업 묶음을 분석해 JSON으로 반환:\n${JSON.stringify(inputs)}`,
    maxTokens: 3_500,
    schema,
  });
}

async function main() {
  const [companyData, newsData, monetData, ventures, metricHistory] = await Promise.all([
    readJson("companies.json", { companies: {} }),
    readJson("news.json", { articles: [] }),
    readJson("monetization.json", { companies: [], models: [], directions: [] }),
    readJson("strategic-ventures.json", { companies: {} }),
    readJson("metric-history.json", { series: [] }),
  ]);
  const dash = loadDash();
  const bases = new Map((dash.COMPANIES || []).map(company => [company.name, company]));
  const monetByName = new Map((monetData.companies || []).map(company => [company.name, company]));
  const articleByUrl = new Map((newsData.articles || []).map(article => [canon(article.url), article]));
  const modelLabels = new Map((monetData.models || []).map(model => [model.id, model.ko]));
  const directionLabels = new Map((monetData.directions || []).map(direction => [direction.id, direction.ko]));
  const metricSeriesFor = name => (metricHistory.series || []).filter(series => {
    if (series.entity === name) return true;
    const haystack = `${series.id || ""} ${series.label || ""}`.toLowerCase();
    return aliasesFor(name).some(alias => haystack.includes(String(alias).toLowerCase()));
  }).map(series => ({
    id: series.id,
    label: series.label,
    unit: series.unit,
    definition: series.definition,
    derivedChange: series.derivedChange,
    points: (series.points || []).map(point => ({
      observedAt: point.observedAt,
      announcedAt: point.announcedAt || null,
      value: point.value,
      evidenceTier: point.evidenceTier,
      sourceUrl: point.sourceUrl,
    })),
  })).filter(series => series.points.length);
  const prepared = [];
  const engine = llmAvailable();
  const persistCompanyData = async () => {
    const rows = Object.values(companyData.companies || {});
    const publicSectionKeys = ["currentBusiness", "revenueModel", "strategyDirection", "investmentDirection"];
    const visibleSections = rows.flatMap(company => publicSectionKeys
      .map(key => company.intelligence?.[key]).filter(section => clean(section?.summary)));
    companyData.schemaVersion = 6;
    companyData.generatedAt = new Date().toISOString();
    companyData.methodology = "normalized-profile+strategy-profile+live-financials+official-executive-verification+company-focused-publisher-evidence+grounded-ai-source-synthesis+complete-capability-and-implication-baseline+source-backed-section-publication+freshness+strict-individual-url-gate";
    companyData.quality = {
      schemaVersion: 1,
      companyCount: rows.length,
      visibleClaimSections: visibleSections.length,
      sourceBackedClaimSections: visibleSections.filter(section =>
        (section.evidence || []).some(ref => /^https?:\/\//.test(String(ref?.url || "")))).length,
      omittedUnsupportedSections: rows.length * publicSectionKeys.length - visibleSections.length,
      allVisibleClaimsSourceBacked: visibleSections.every(section =>
        (section.evidence || []).some(ref => /^https?:\/\//.test(String(ref?.url || "")))),
    };
    const checkpoint = "companies.json.checkpoint";
    await writeFile(checkpoint, `${JSON.stringify(companyData)}\n`);
    await rename(checkpoint, "companies.json");
  };
  const maxAiAgeDays = Math.max(0.25, Number(process.env.COMPANY_INTELLIGENCE_MAX_AGE_DAYS || 0.8));
  const ageDays = value => {
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 86_400_000) : 999;
  };

  for (const [name, rec] of Object.entries(companyData.companies || {})) {
    rec.metricHistory = metricSeriesFor(name);
    if (rec.profile) {
      rec.profile.business = compactBusinessProfile(rec.profile.business, name);
    }
    if (rec.strategyProfile) {
      const normalizedBusiness = compactBusinessProfile(
        rec.profile?.business || rec.strategyProfile.currentBusiness,
        name,
      ).join(" · ");
      if (normalizedBusiness) rec.strategyProfile.currentBusiness = normalizedBusiness;
    }
    const leaders = Array.isArray(rec.organization?.executiveTeam) && rec.organization.executiveTeam.length
      ? rec.organization.executiveTeam : rec.organization?.leadership || [];
    const evidence = mergeEvidence(officialEvidenceFor(rec), evidenceFor(name, newsData.articles || [], leaders));
    const monet = sanitiseMonetization(name, monetByName.get(name) || null, articleByUrl);
    const fallbackRaw = fallbackIntelligence({
      base: bases.get(name),
      rec,
      monet,
      evidence,
      modelLabels,
      directionLabels,
    });
    const corpus = analysisCorpus({ base: bases.get(name), rec, monet, evidence });
    const fallback = retainLastVerified(
      safeFallback(fallbackRaw, corpus),
      rec.intelligence,
      corpus,
    );
    const groundedFallback = finaliseIntelligence(fallback, { name, evidence, fallback, corpus });
    const priorAiRaw = rec.intelligence?.engine?.startsWith("github-models:") ? rec.intelligence : null;
    const priorAi = priorAiRaw ? finaliseIntelligence(priorAiRaw, { name, evidence, fallback: groundedFallback, corpus }) : null;
    const currentFingerprint = evidenceFingerprint(evidence);
    const priorMatchesEvidence = priorAi?.evidenceFingerprint === currentFingerprint
      && priorAiRaw?.evidenceFingerprint === currentFingerprint;
    const refreshAi = !!engine && (!priorAi || !priorMatchesEvidence || ageDays(priorAi.generatedAt) >= maxAiAgeDays);
    rec.intelligence = priorMatchesEvidence ? priorAi : {
        generatedAt: new Date().toISOString(),
        engine: "source-extractive-synthesis",
        evidenceWindow: "제목·리드문에서 회사가 확인된 최신 원문 8건 + 누적 수익화·사업 방향 원장",
        ...groundedFallback,
      };
    rec.strategicVentures = ventures.companies?.[name] || [];
    if (rec.strategicVentures.length) {
      if (ventures.comparison) rec.strategicVentureComparison = ventures.comparison;
      const publication = rec.intelligence.publication || publicationProfile(rec.intelligence);
      publication.visibleSections = [...new Set([...(publication.visibleSections || []), "partnerships"])];
      publication.omittedSections = ["technology", "infrastructure", "goToMarket", "partnerships", "investment"]
        .filter(section => !publication.visibleSections.includes(section));
      const latestVentureSource = rec.strategicVentures.flatMap(venture => venture.sources || [])
        .filter(source => /^https?:\/\//.test(String(source?.url || "")))
        .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")))[0];
      if (latestVentureSource && String(latestVentureSource.date || "") > String(publication.lastVerifiedAt || "")) {
        publication.lastVerifiedAt = latestVentureSource.date;
        publication.latestEvidence = {
          title: latestVentureSource.title || rec.strategicVentures[0]?.title || "",
          source: latestVentureSource.publisher || "",
          date: latestVentureSource.date,
          url: latestVentureSource.url,
        };
        const time = Date.parse(latestVentureSource.date || "");
        publication.ageDays = Number.isFinite(time) ? Math.max(0, Math.floor((Date.now() - time) / 86_400_000)) : null;
        publication.freshness = publication.ageDays === null ? "undated"
          : publication.ageDays <= 14 ? "fresh" : publication.ageDays <= 90 ? "aging" : "stale";
      }
      rec.intelligence.publication = publication;
    }
    if (!refreshAi) continue;
    prepared.push({
      name,
      profile: {
        founded: rec.profile?.founded || "",
        headquarters: rec.profile?.hq || "",
        headcount: rec.profile?.headcount || rec.employees || "",
        business: rec.profile?.business || [],
      },
      leadership: leaders.slice(0, 10).map(person => ({
        name: person.name, role: person.role, education: person.edu || "", career: person.career || person.bg || "",
      })),
      monetization: {
        primaryModel: modelLabels.get(monet?.primaryModel) || "",
        revenueSignals: (monet?.monetize || []).slice(0, 4),
        directionSignals: (monet?.direction || []).slice(0, 4),
      },
      evidence,
      quoteCandidates: evidence.flatMap(item => item.quotes.map(quote => ({ ...quote, evidenceId: item.id }))).slice(0, 6),
      _rec: rec,
      _fallback: fallback,
      _corpus: corpus,
      _priorAi: priorAiRaw,
    });
  }

  if (engine) {
    // GitHub Models gpt-4.1 currently enforces an 8k request-body limit.
    // Evidence-heavy major companies can exceed it even in groups of three.
    // Analyse one company per request so all companies receive equal depth.
    // Bound each workflow run so rate limiting cannot block the full crawl.
    // Firms without a current model result go first, then the oldest result.
    const aiBudget = Math.max(1, Number(process.env.COMPANY_INTELLIGENCE_AI_BUDGET || 10));
    const modelQueue = prepared
      .sort((left, right) => {
        const leftHasPrior = !!left._priorAi;
        const rightHasPrior = !!right._priorAi;
        if (leftHasPrior !== rightHasPrior) return leftHasPrior ? 1 : -1;
        const leftAt = Date.parse(left._priorAi?.generatedAt || "") || 0;
        const rightAt = Date.parse(right._priorAi?.generatedAt || "") || 0;
        return leftAt - rightAt || left.name.localeCompare(right.name);
      })
      .slice(0, aiBudget);
    const batchSize = 1;
    for (let start = 0; start < modelQueue.length; start += batchSize) {
      const batch = modelQueue.slice(start, start + batchSize);
      const publicInput = batch.map(({ _rec, _fallback, _corpus, _priorAi, ...value }) => value);
      const result = await synthesizeBatch(publicInput);
      const byName = new Map((result?.data?.companies || []).map(company => [company.name, company]));
      for (const item of batch) {
        const analysis = byName.get(item.name);
        if (!analysis) continue;
        item._rec.intelligence = {
          generatedAt: new Date().toISOString(),
          engine: result.engine,
          evidenceWindow: "제목·리드문에서 회사가 확인된 최신 원문 8건 + 누적 수익화·사업 방향 원장",
          ...normaliseAnalysis(analysis, item.evidence, item._fallback, item._corpus),
        };
      }
      // The first schema-v6 run can refresh every company. Persist each batch
      // so a runner retry resumes from completed evidence fingerprints.
      await persistCompanyData();
      console.log(`[company-intelligence] batch ${Math.floor(start / batchSize) + 1}/${Math.ceil(modelQueue.length / batchSize)} · ${result ? result.engine : "extractive fallback"}`);
    }
  }

  await persistCompanyData();
  const aiCount = Object.values(companyData.companies || {}).filter(company => company.intelligence?.engine?.startsWith("github-models:")).length;
  const total = Object.keys(companyData.companies || {}).length;
  console.log(`[company-intelligence] wrote ${total} companies · AI ${aiCount} · extractive ${total - aiCount} · eligible ${prepared.length}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
