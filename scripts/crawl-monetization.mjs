#!/usr/bin/env node
/* ============================================================
   crawl-monetization.mjs — 'AI 수익화 플레이북' 기업별 누적 갱신
   입력: news.json(이미 크롤된 최신 기사) — 별도 네트워크 호출 없음.
   목적: 신사업 발굴 관점에서 "어떤 기업이 ①어떻게 돈을 버는가(수익모델)
         ②비즈니스 모델 신호 ③앞으로의 투자·사업 방향"을 기사 근거로 계속 축적.
   동작:
     - 대시보드 기업(밸류체인 계층 부여)을 별칭으로 기사에서 탐지.
     - 각 기사를 7개 수익모델 유형 + 4개 방향(투자·인수·확장·제휴)으로 분류.
     - 기업별로 modelMix(수익모델 분포)·최신 수익화 시그널·투자/사업 방향 시그널을
       누적(merge)해 monetization.json 생성. 하드코딩 아님 — 기사 근거로 갱신.
     - 모든 시그널은 displayEligible + 원문 발췌(source-content-extractive) 기사만,
       사명(삼성/MX/Galaxy) 미출력.
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";
import { isExcludedText } from "./news-policy.mjs";
import { loadDash } from "./load-dash.mjs";
const TODAY = new Date().toISOString().slice(0, 10);

// 대시보드 기업 별칭. 계층·버티컬은 data.js COMPANY_LAYER에서 매 실행 시
// 읽어 단일 소스로 유지한다(밸류체인 재분류 시 크롤 산출물도 자동 정렬).
const COMPANY_ALIASES = [
  { name: "Microsoft", layer: "infra", vertical: "하이퍼스케일 클라우드", alias: ["Microsoft", "Azure", "Copilot"] },
  { name: "Amazon", layer: "infra", vertical: "하이퍼스케일 클라우드", alias: ["Amazon", "AWS", "Bedrock"] },
  { name: "NVIDIA", layer: "infra", vertical: "AI 가속기·칩", alias: ["NVIDIA", "Nvidia"] },
  { name: "OpenAI", layer: "model", vertical: "프런티어 모델", alias: ["OpenAI", "ChatGPT", "GPT-4", "GPT-5", "Sora"] },
  { name: "Anthropic", layer: "model", vertical: "프런티어 모델", alias: ["Anthropic", "Claude"] },
  { name: "Google DeepMind", layer: "model", vertical: "프런티어 모델", alias: ["Google DeepMind", "DeepMind", "Gemini"] },
  { name: "Meta AI", layer: "model", vertical: "오픈 모델", alias: ["Meta AI", "Llama"] },
  { name: "DeepSeek", layer: "model", vertical: "오픈·저비용 모델", alias: ["DeepSeek"] },
  { name: "Mistral AI", layer: "model", vertical: "오픈·소버린 모델", alias: ["Mistral"] },
  { name: "Cohere", layer: "model", vertical: "엔터프라이즈 모델", alias: ["Cohere"] },
  { name: "SpaceX (xAI, Cursor)", layer: "model", vertical: "프런티어 모델(xAI)", alias: ["xAI", "Grok"] },
  { name: "Databricks", layer: "data", vertical: "데이터·레이크하우스", alias: ["Databricks"] },
  { name: "Scale AI", layer: "data", vertical: "데이터 라벨링·평가", alias: ["Scale AI"] },
  { name: "Hugging Face", layer: "data", vertical: "모델 허브·오픈소스", alias: ["Hugging Face", "HuggingFace"] },
  { name: "Together AI", layer: "data", vertical: "추론·학습 클라우드", alias: ["Together AI"] },
  { name: "Apple", layer: "app", vertical: "온디바이스·컨슈머", alias: ["Apple Intelligence", "Apple", "Siri"] },
  { name: "Perplexity", layer: "app", vertical: "검색·어시스턴트", alias: ["Perplexity"] },
  { name: "Glean", layer: "app", vertical: "엔터프라이즈 검색", alias: ["Glean"] },
  { name: "Sierra AI", layer: "app", vertical: "고객경험 에이전트", alias: ["Sierra AI"] },
  { name: "Writer", layer: "app", vertical: "엔터프라이즈 생산성", alias: ["Writer.com", "Writer AI"] },
  { name: "Harvey", layer: "app", vertical: "법률", alias: ["Harvey AI", "Harvey"] },
  { name: "Abridge", layer: "app", vertical: "의료", alias: ["Abridge"] },
  { name: "Cursor", layer: "app", vertical: "코딩", alias: ["Cursor"] },
  { name: "Replit", layer: "app", vertical: "코딩", alias: ["Replit"] },
  { name: "Lovable", layer: "app", vertical: "코딩", alias: ["Lovable"] },
  { name: "Midjourney", layer: "app", vertical: "크리에이티브·이미지", alias: ["Midjourney"] },
  { name: "Stability AI", layer: "app", vertical: "크리에이티브·이미지", alias: ["Stability AI"] },
  { name: "Runway", layer: "app", vertical: "크리에이티브·영상", alias: ["Runway ML", "RunwayML", "Runway"] },
  { name: "Kling AI", layer: "app", vertical: "크리에이티브·영상", alias: ["Kling"] },
  { name: "Hailuo (MiniMax)", layer: "app", vertical: "크리에이티브·영상", alias: ["Hailuo", "MiniMax"] },
  { name: "Synthesia", layer: "app", vertical: "크리에이티브·영상", alias: ["Synthesia"] },
  { name: "Suno", layer: "app", vertical: "크리에이티브·음악", alias: ["Suno"] },
  { name: "ElevenLabs", layer: "app", vertical: "크리에이티브·음성", alias: ["ElevenLabs", "Eleven Labs"] },
];
const DASH_LAYER = loadDash().COMPANY_LAYER || {};
const COMPANIES = COMPANY_ALIASES.map(c => ({
  ...c,
  layer: DASH_LAYER[c.name]?.layer || c.layer,
  vertical: DASH_LAYER[c.name]?.vertical || c.vertical,
}));

// 별칭을 단어경계 정규식으로(오탐 방지). 알파벳으로 시작/끝나는 별칭에만 \b 부착.
const bound = s => {
  const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const l = /^[A-Za-z0-9]/.test(s) ? "\\b" : "";
  const r = /[A-Za-z0-9]$/.test(s) ? "\\b" : "";
  return `${l}${esc}${r}`;
};
const withRegex = list => list.map(c => ({ ...c, re: new RegExp("(?:" + c.alias.map(bound).join("|") + ")") }));

// 7개 수익모델 유형(crawl-bizmodel과 정렬) — 위에서부터 우선 매칭
const MODELS = [
  { id: "vertical", ko: "수직통합·자체 서비스", accent: "#7A38D6",
    re: /자회사|subsidiary|분사|spin(?:s|ning)?[-\s]?off|spin(?:s|ning)?[-\s]?out|수직통합|vertical integrat|first-?party (?:app|product|service)|자체 (?:앱|서비스|플랫폼)|직접 서비스/i },
  { id: "subscription", ko: "구독·시트", accent: "#16A34A",
    re: /구독|subscription|월정액|시트당|좌석당|per-seat|premium tier|pro 요금|유료 전환|paywall|멤버십|플러스 요금/i },
  { id: "usage", ko: "사용량·API·토큰", accent: "#2D6BFF",
    re: /\bAPI\b|토큰당|per-token|사용량 기반|usage-based|종량|pay-as-you-go|크레딧|credit|추론 단가|inference cost|호출당|metered/i },
  { id: "ads", ko: "광고·커머스·수수료", accent: "#EA580C",
    re: /광고|advertis|\bads\b|커머스|commerce|수수료|commission|중개|affiliate|마켓플레이스|marketplace|take ?rate/i },
  { id: "hardware", ko: "하드웨어·단말·번들", accent: "#C026D3",
    re: /단말|디바이스|device|하드웨어|hardware|번들|bundle|기기 판매|웨어러블|이어버드|글라스|가격 프리미엄/i },
  { id: "outcome", ko: "성과·아웃컴 기반", accent: "#DB2777",
    re: /성과 기반|아웃컴 기반|해결 건당|per-resolution|성공 보수|success fee|ROI 기반|outcome-based|outcome based|performance-based|per-outcome/i },
  { id: "enterprise", ko: "엔터프라이즈·라이선스", accent: "#0D9488",
    re: /엔터프라이즈|enterprise|라이선스|licen[sc]e|온프레미스|on-?prem|기업 계약|소버린|sovereign|연간 계약|\bTCV\b|\bACV\b/i },
];

// 4개 사업 방향 유형 — 앞으로의 투자·사업 방향 신호
const DIRECTIONS = [
  { id: "ma", ko: "인수·합병", accent: "#C026D3", re: /인수|합병|acqui|merger|\bM&A\b|매입|takeover/i },
  { id: "invest", ko: "투자·펀딩", accent: "#16A34A", re: /투자|지분|invest|stake|펀딩|funding|조달|라운드|\bround\b|밸류에이션|valuation|\bIPO\b|상장/i },
  { id: "expand", ko: "확장·신제품", accent: "#2D6BFF", re: /출시|launch|공개|unveil|roll ?out|신제품|신규 서비스|진출|expand|확장|데이터센터|증설|capacity|신시장|entry/i },
  { id: "partner", ko: "제휴·파트너십", accent: "#EA580C", re: /파트너십|제휴|partner|협력|collaborat|계약 체결|독점 계약|합작|joint venture/i },
];

const toLines = sm => String(sm || "").split("\n").map(l => l.replace(/^[·\-•]\s*/, "").trim()).filter(Boolean);
const firstLine = sm => toLines(sm)[0] || "";
const classifyFirst = (list, text) => { for (const g of list) if (g.re.test(text)) return g.id; return null; };
// 여러 후보 문장 중 이 유형(list)의 키워드를 실제로 담은 첫 문장을 골라 {id, line} 반환 —
// 화면에 보이는 시그널 문장이 태그와 항상 일치하도록.
const pickTagged = (list, lines) => {
  for (const line of lines) { const id = classifyFirst(list, line); if (id) return { id, line: line.replace(/[.。]+\s*$/, "").trim() }; }
  return null;
};
const canonUrl = u => { const s = String(u || ""); try { const p = new URL(s); p.hash = ""; p.search = ""; return p.href.replace(/\/+$/, ""); } catch { return s.replace(/[?#].*$/, "").replace(/\/+$/, ""); } };

async function main() {
  let news = [];
  try { news = JSON.parse(await readFile("news.json", "utf8")).articles || []; }
  catch { console.log("[monetization] news.json 없음 — crawl-news.mjs 먼저 실행"); }

  // 스타트업 분석(startups.json)의 업체도 스캔 대상에 자동 포함 — 밸류체인 기업과
  // 동일한 깊이(수익모델·사업 방향)로 통일. 하드코딩 아님: 매 실행 시 startups.json에서
  // 이름을 읽어 별칭 스캔 대상으로 편입(신규 스타트업이 추가되면 자동으로 스캔 대상에 포함).
  let startupNames = [];
  try {
    const su = JSON.parse(await readFile("startups.json", "utf8"));
    startupNames = [...(su.large || []), ...(su.small || [])];
  } catch {}
  const knownNames = new Set(COMPANIES.map(c => c.name));
  const startupEntries = startupNames
    .filter(s => s.name && !knownNames.has(s.name))
    .map(s => ({
      name: s.name,
      layer: DASH_LAYER[s.name]?.layer || "app",
      vertical: DASH_LAYER[s.name]?.vertical || s.vertical || "스타트업",
      alias: [s.name],
    }));
  const ALL_COMPANIES = withRegex([...COMPANIES, ...startupEntries]);

  // 기존 누적 로드 — signals는 URL 기준으로 병합(중복 방지)
  let prev = { companies: [] };
  try { const p = JSON.parse(await readFile("monetization.json", "utf8")); if (p && Array.isArray(p.companies)) prev = p; } catch {}
  const prevByName = new Map(prev.companies.map(c => [c.name, c]));

  // 기업별 시그널 버킷: url -> signal (누적 병합)
  const buckets = new Map();     // name -> { monetize: Map(url->sig), direction: Map(url->sig), modelMix: {id:n} }
  const bucket = name => {
    if (!buckets.has(name)) {
      const p = prevByName.get(name) || {};
      buckets.set(name, {
        monetize: new Map((p.monetize || []).map(s => [canonUrl(s.url), s])),
        direction: new Map((p.direction || []).map(s => [canonUrl(s.url), s])),
      });
    }
    return buckets.get(name);
  };

  let scanned = 0, added = 0;
  for (const a of news) {
    if (a.displayEligible === false || a.summaryMode !== "source-content-extractive") continue;
    const hay = `${a.title || ""} ${a.tag || ""} ${a.co || ""} ${a.summary || ""}`;
    if (isExcludedText(hay)) continue;
    const url = a.url; if (!url) continue;
    // 태그는 화면에 보일 문장(제목·요약 각 줄) 중 그 유형 키워드를 담은 문장에서만 —
    // 표시 시그널과 태그가 항상 일치(요약 뒷부분 우연 매칭 오분류 방지).
    const cand = [a.title || "", ...toLines(a.summary)].map(s => s.trim()).filter(s => s && !isExcludedText(s));
    if (!cand.length) continue;
    const mHit = pickTagged(MODELS, cand);                  // 수익모델 시그널(있으면)
    const dHit = pickTagged(DIRECTIONS, cand);              // 사업 방향 시그널(있으면)
    if (!mHit && !dHit) continue;

    for (const c of ALL_COMPANIES) {
      if (!c.re.test(hay)) continue;
      scanned++;
      const meta = { source: a.source || "", date: a.date || TODAY, url };
      const k = canonUrl(url);
      const b = bucket(c.name);
      if (mHit) {
        if (!b.monetize.has(k)) added++;
        b.monetize.set(k, { signal: mHit.line, model: mHit.id, ...meta });
      }
      if (dHit) b.direction.set(k, { signal: dHit.line, kind: dHit.id, ...meta });
    }
  }

  const recent = (m, n) => [...m.values()]
    .filter(s => !isExcludedText(JSON.stringify(s)))
    .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0))
    .slice(0, n);

  const companies = ALL_COMPANIES.map(c => {
    const b = buckets.get(c.name) || { monetize: new Map(), direction: new Map() };
    const monetize = recent(b.monetize, 5);
    const direction = recent(b.direction, 5);
    const mix = {};
    for (const s of b.monetize.values()) if (s.model) mix[s.model] = (mix[s.model] || 0) + 1;
    const modelMix = Object.entries(mix).sort((a, b2) => b2[1] - a[1]).map(([id, n]) => ({ id, n }));
    const primaryModel = modelMix.length ? modelMix[0].id : null;
    return { name: c.name, layer: c.layer, vertical: c.vertical, primaryModel, modelMix, monetize, direction };
  }).filter(c => c.monetize.length || c.direction.length);   // 근거 없는 기업은 노출 안 함

  const out = {
    generatedAt: new Date().toISOString(),
    count: companies.length,
    models: MODELS.map(({ re, ...m }) => m),
    directions: DIRECTIONS.map(({ re, ...d }) => d),
    companies,
  };
  await writeFile("monetization.json", JSON.stringify(out) + "\n");
  const withMon = companies.filter(c => c.monetize.length).length;
  console.log(`Wrote monetization.json — ${companies.length} companies (${withMon} with revenue signals · +${added} monetize rows)`);
  companies.slice(0, 12).forEach(c => console.log(`  [${c.layer}] ${c.name}: model=${c.primaryModel || "-"} mix=${c.modelMix.map(m => m.id + ":" + m.n).join(",") || "-"} dir=${c.direction.length}`));
}

main().catch(e => { console.error(e); process.exit(1); });
