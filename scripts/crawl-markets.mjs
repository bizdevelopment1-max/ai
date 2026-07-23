#!/usr/bin/env node
/* ============================================================
   crawl-markets.mjs — AI 신사업 버티컬 시장 최신 시그널 갱신
   입력: market.json(seed-markets.mjs가 생성한 베이스라인)
   동작: 각 버티컬마다 Google News에서 "<name> market size forecast"
         최신 기사 1건을 크롤해 freshness 시그널(latest)로 덧붙임.
         베이스라인 수치(size/forecast/cagr/source/url)는 보존 —
         시장 리포트는 연 단위라 죽지 않게 유지, 최신 링크만 갱신.
   주 1회 갱신(주말 또는 7일 경과 시). 사이트는 이 파일을 lazy-load.
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TODAY = new Date().toISOString().slice(0, 10);
const decode = s => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tagOf = (xml, n) => { const m = xml.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`, "i")); return m ? m[1] : ""; };

// 한국어 버티컬명 → 영문 검색 키워드
const EN = {
  "생성형 AI폰": "generative AI phone", "온디바이스 멀티모달 AI": "on-device multimodal AI",
  "엣지 AI 반도체": "edge AI chip", "AI PC / AI 컴퓨팅": "AI PC", "AI 카메라·이미지센서": "AI camera image sensor",
  "플렉시블·폴더블 OLED": "foldable OLED display", "5G RedCap": "5G RedCap", "모바일 AI(온디바이스 통칭)": "mobile AI",
  "AI 에이전트": "AI agents", "AI 음성 어시스턴트": "voice assistant AI", "AI 컴패니언 앱": "AI companion app",
  "대화형 AI·챗봇": "conversational AI chatbot", "AI 통역·번역": "AI translation", "AI 노트·전사": "AI transcription",
  "웨어러블 AI": "wearable AI", "AR·스마트글라스": "smart glasses AR", "AR 가상피팅": "virtual try-on AR",
  "생성형 AI 콘텐츠 제작": "generative AI content", "AI 사진 편집 앱": "AI photo editing", "AI 게이밍": "AI in games",
  "클라우드 게이밍(모바일)": "cloud gaming mobile", "AI 헬스케어 진단": "AI healthcare diagnosis",
  "AI 스마트홈": "AI smart home", "AI 핀테크·모바일 결제": "AI fintech mobile payment", "AI 에듀테크": "AI education edtech",
  "노코드·로우코드 AI 앱개발": "no-code AI app development", "AI 시스템·모바일 보안": "AI security market",
  "딥페이크 탐지": "deepfake detection", "디지털ID·모바일지갑": "digital ID wallet",
};

async function latest(name) {
  try {
    const q = `${EN[name] || name} market size forecast when:30d`;
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const xml = await res.text();
    const m = /<item>([\s\S]*?)<\/item>/.exec(xml);
    if (!m) return null;
    const it = m[1];
    const d = new Date(tagOf(it, "pubDate"));
    return { title: decode(tagOf(it, "title")).replace(/ - [^-]*$/, "").trim(), url: decode(tagOf(it, "link")), source: decode(tagOf(it, "source")) || "Google News", date: isNaN(d) ? TODAY : d.toISOString().slice(0, 10) };
  } catch { return null; }
}

async function main() {
  let data;
  try { data = JSON.parse(await readFile("market.json", "utf8")); } catch { console.log("[market] no market.json — run seed-markets.mjs first"); return; }
  const age = data.freshAt ? (Date.now() - new Date(data.freshAt).getTime()) / 86400000 : 99;
  if (age < 6.5) { console.log(`[market] fresh signals (${data.freshAt}) — skip`); return; }

  let hit = 0;
  for (const it of data.items) {
    const n = await latest(it.name);
    if (n) { it.latest = n; hit++; }
  }
  data.freshAt = new Date().toISOString();
  data.generatedAt = new Date().toISOString();
  await writeFile("market.json", JSON.stringify(data, null, 1) + "\n");
  console.log(`Wrote market.json — refreshed latest signals for ${hit}/${data.items.length} verticals`);
}

main().catch(e => { console.error(e); process.exit(0); });
