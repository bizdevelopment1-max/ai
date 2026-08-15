#!/usr/bin/env node
/* ============================================================
   crawl-infra.mjs — AI SW·서비스 기술 시그널 누적 갱신(모바일 신사업 관점)
   입력: news.json(매일 크롤된 최신 기사) — 별도 네트워크 호출 없이
         이미 수집된 기사에서 '단말에 올릴 만한 AI SW·서비스' 시그널만 선별.
   동작: 반도체·데이터센터 하드웨어가 아니라, 온디바이스 AI·에이전트·멀티모달
         기능·OS/앱 통합·AI 서비스(수익화) 등 SW·서비스 관점 5개 MECE 카테고리로
         분류하고, 한글 개조식 시그널 1줄 + 정량 수치를 추출해 infra.json 누적.
   특징: 기존 항목은 매 실행 시 새 분류 체계로 재분류(하드웨어 전용 신호는 자연 소거),
         url 중복 제거, 최신순, 최대 140건. 기사 기반으로 계속 쌓임.
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";
import { isExcludedText } from "./news-policy.mjs";
import { loadSuppressionRegistry } from "./suppression-registry.mjs";
const TODAY = new Date().toISOString().slice(0, 10);

// 5개 MECE 카테고리 — 단말(스마트폰) 관점의 AI SW·서비스 기술(위에서부터 우선)
const GROUPS = [
  { id: "ondevice", ko: "온디바이스·엣지 AI", desc: "기기 내 추론·경량 모델(SLM)·프라이버시 — 단말 직결", accent: "#0891B2",
    re: /온[\- ]?디바이스|on-device|엣지 ai|edge ai|경량 모델|소형 모델|small language model|\bSLM\b|기기 내 (?:추론|구동)|로컬 추론|local inference|온디바이스 추론|nano 모델|gemini nano|apple intelligence|private cloud compute|양자화|quantization|distill|증류|프라이버시 우선/i },
  { id: "agent", ko: "AI 에이전트·어시스턴트", desc: "자율 에이전트·컴퓨터 유즈·단말 기본 비서", accent: "#7A38D6",
    re: /에이전트|agentic|\bagent\b|어시스턴트|assistant|ai 비서|음성 비서|siri|gemini|copilot|comet|컴퓨터 유즈|computer use|tool use|툴 호출|자율 수행|autonomous|작업 자동화|task automation/i },
  { id: "multimodal", ko: "멀티모달·생성 기능", desc: "카메라·이미지·영상·음성 생성/이해 — 단말 기능", accent: "#EA580C",
    re: /멀티모달|multimodal|이미지 생성|image gen|영상 생성|video gen|음성 합성|\bTTS\b|음성 인식|\bSTT\b|보이스|voice|카메라 ai|camera|비전|vision|실시간 통역|translation|생성 편집|generative edit|아바타|avatar/i },
  { id: "os", ko: "OS·앱·플랫폼 통합", desc: "OS·브라우저·앱 통합·개인화·권한·컨텍스트", accent: "#2D6BFF",
    re: /운영체제|\bOS\b|android|안드로이드|\biOS\b|앱 통합|app integration|ai 브라우저|browser|개인화|personaliz|권한|permission|컨텍스트|context|플랫폼|platform|\bSDK\b|앱스토어|app store|딥링크|런타임/i },
  { id: "service", ko: "AI 서비스·수익화 신사업", desc: "구독·앱·API·수익화·에코시스템 — 신규 서비스", accent: "#16A34A",
    re: /수익화|monetiz|구독|subscription|서비스 출시|신규 서비스|new service|신사업|new business|에코시스템|ecosystem|앱 매출|과금|pricing|\bARR\b|유료 전환|번들|bundle|마켓플레이스|marketplace/i },
];

// 정량 수치(플레인 텍스트) 추출 — $B/T·$억/조, %, 억, 배, GB, MW/GW, nm 등
const QUANT = /(\$[\d,.]+\s?(?:[TBM]|억|조)?(?:\+)?|\d+\.?\d*\s?%|\d+\.?\d*\s?억\+?|\d+\.?\d*\s?조\+?|\d+\s?배|\d+\s?GB|\d+\.?\d*\s?[MG]W|\d+\s?nm|\d+\.?\d*[TP]B|[0-9]{2,}\s?M\+?)/;

const firstLine = sm => String(sm || "").split("\n").map(l => l.replace(/^[·\-•]\s*/, "").trim()).filter(Boolean)[0] || "";
const classify = (text) => { for (const g of GROUPS) if (g.re.test(text)) return g.id; return null; };
// URL 정규화(끝 슬래시·쿼리·해시 제거) — 같은 기사가 표기 차이로 중복 누적되는 것을 방지.
const canonUrl = u => {
  const s = String(u || "");
  try { const p = new URL(s); p.hash = ""; p.search = ""; return p.href.replace(/\/+$/, ""); }
  catch { return s.replace(/[?#].*$/, "").replace(/\/+$/, ""); }
};
const idOf = (url, title) => "if_" + Buffer.from(canonUrl(url) || String(title || "")).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(-16);

async function main() {
  const suppression = await loadSuppressionRegistry();
  let news = [];
  try {
    news = (JSON.parse(await readFile("news.json", "utf8")).articles || [])
      .filter(article => !suppression.matches(article, "article"));
  }
  catch { console.log("[infra] news.json 없음 — crawl-news.mjs 먼저 실행"); }

  // 이전 누적본 로드 — 새 분류 체계(SW·서비스)로 재분류하고, 어느 그룹에도 안 맞으면 제거.
  // (반도체·데이터센터 하드웨어 전용 신호는 자연스럽게 소거되어 SW·서비스 관점으로 수렴)
  let prev = { groups: GROUPS.map(({ re, ...g }) => g), items: [] };
  try { const p = JSON.parse(await readFile("infra.json", "utf8")); if (p && Array.isArray(p.items)) prev = p; } catch {}
  const reclassified = prev.items.filter(item => !suppression.matches(item, "infra-signal")).map(it => {
    const g = classify(`${it.title || ""} ${it.signal || ""}`);
    return g ? { ...it, group: g } : null;
  }).filter(Boolean);
  const byUrl = new Map(reclassified.map(it => [canonUrl(it.url), it]));

  let added = 0;
  for (const a of news) {
    if (a.displayEligible === false || a.summaryMode !== "source-content-extractive") continue;
    const hay = `${a.title || ""} ${a.tag || ""} ${a.summary || ""}`;
    if (isExcludedText(hay)) continue;
    const group = classify(hay);
    if (!group) continue;                                  // 인프라·미래기술 시그널이 아니면 skip
    const url = a.url; if (!url) continue;
    const line = firstLine(a.summary) || a.title;
    const signal = line.replace(/[.。]+\s*$/, "").trim();
    if (!signal || isExcludedText(signal)) continue;
    const qm = (a.summary || "").match(QUANT) || (a.title || "").match(QUANT);
    const item = {
      id: idOf(url, a.title), group,
      title: String(a.title || "").replace(/[.。]+\s*$/, "").trim(),
      signal, quant: qm ? qm[0].replace(/\s+/g, "") : "",
      source: a.source || "", date: a.date || TODAY, url,
      sourceSummaryMode: a.summaryMode || "legacy-or-unknown",
    };
    const ukey = canonUrl(url);
    if (!byUrl.has(ukey)) added++;
    byUrl.set(ukey, { ...byUrl.get(ukey), ...item });      // 최신 내용으로 갱신하되 누적 보존
  }

  const items = [...byUrl.values()]
    .filter(it => it.group && it.signal && it.url && !isExcludedText(JSON.stringify(it)))
    .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0))
    .slice(0, 140);                                        // 누적 상한(성능)

  const out = { generatedAt: new Date().toISOString(), count: items.length, groups: GROUPS.map(({ re, ...g }) => g), items };
  await writeFile("infra.json", JSON.stringify(out) + "\n");
  const per = GROUPS.map(g => `${g.id}:${items.filter(i => i.group === g.id).length}`).join(" ");
  console.log(`Wrote infra.json — ${items.length} signals (+${added} new) [${per}]`);
}

main().catch(e => { console.error(e); process.exit(1); });
