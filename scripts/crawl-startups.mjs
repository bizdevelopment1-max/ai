#!/usr/bin/env node
/* ============================================================
   crawl-startups.mjs — 스타트업 전략 분석(투자·협력) 생성기
   출력: startups.json  { generatedAt, weekOf, engine, items: {name: {...}} }

   - 대상 목록은 data.js의 cat:"startup" 항목에서 자동 추출(별도 하드코딩 없음).
   - 각 스타트업: Google News 최신 기사 1건 크롤(14일 창) + LLM 배치 평가:
     invest(투자 매력 1~5)·investNote(투자 가능성)·collab(협력 포인트)·
     label(파트너십 기회/인수 후보/투자 검토/모니터링).
   - 주 1회 갱신(레이더와 동일 주기). LLM(llm/llm-gh) 실패 시 이전 결과
     유지, 그것도 없으면 버티컬 기반 규칙 폴백 — 죽은 데이터 방지.
   - 관점 노출 금지(삼성/MX 미표기) — '글로벌 단말 제조사' 관점.
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";
import { llmJSON } from "./llm.mjs";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TODAY = new Date().toISOString().slice(0, 10);
const BANNED = /삼성|samsung|갤럭시|galaxy|\bMX\b/gi;
const scrub = s => String(s || "").replace(BANNED, "글로벌 제조사").trim();
const clamp15 = n => Math.max(1, Math.min(5, Math.round(Number(n) || 3)));
const LABELS = ["파트너십 기회", "인수 후보", "투자 검토", "모니터링"];

// data.js에서 스타트업 마스터 추출(name·domain·vertical·unit)
async function loadStartups() {
  const src = await readFile("data.js", "utf8");
  const out = [];
  const re = /cat:\s*"startup",\s*name:\s*"([^"]+)"[^}]*?domain:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) {
    const block = src.slice(m.index, m.index + 900);
    const vert = (block.match(/vertical:\s*"([^"]+)"/) || [])[1] || "";
    const unit = (block.match(/unit:\s*"([^"]+)"/) || [])[1] || "";
    if (!out.some(s => s.name === m[1])) out.push({ name: m[1], domain: m[2], vertical: vert, unit });
  }
  return out;
}

const decode = s => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tagOf = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i")); return m ? m[1] : ""; };

async function latestNews(s) {
  try {
    const q = `"${s.name.replace(/\s*\(.*\)/, "")}" AI when:14d`;
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const xml = await res.text();
    const m = /<item>([\s\S]*?)<\/item>/.exec(xml);
    if (!m) return null;
    const it = m[1];
    const d = new Date(tagOf(it, "pubDate"));
    return {
      title: decode(tagOf(it, "title")).replace(/ - [^-]*$/, "").trim(),
      url: decode(tagOf(it, "link")),
      source: decode(tagOf(it, "source")) || "Google News",
      date: isNaN(d) ? TODAY : d.toISOString().slice(0, 10),
    };
  } catch { return null; }
}

async function llmStrategies(startups, newsByName) {
  const items = {};
  let engine = null;
  for (let i = 0; i < startups.length; i += 10) {
    const chunk = startups.slice(i, i + 10);
    const list = chunk.map((s, k) => `[${k}] ${s.name} (${s.vertical || s.unit})${newsByName[s.name] ? ` — 최신: ${newsByName[s.name].title}` : ""}`).join("\n");
    const r = await llmJSON({
      system: "당신은 글로벌 스마트폰·온디바이스 AI 기기 제조사의 신사업·투자 전략 분석가입니다. 특정 기업명(삼성, 갤럭시, MX 등)은 절대 언급하지 않습니다. 한국어 개조식. JSON으로 출력.",
      user: `다음 AI 스타트업들을 단말 제조사 신사업 관점에서 평가해 rows 배열로 출력하세요.\n\n${list}\n\n각 항목 {idx, invest(투자 매력도 1~5 — 시장 성장성·기술 희소성·밸류 부담 종합), investNote(투자 가능성 평가 1문장), collab(협력 포인트 — 단말·서비스 접목 각도 1~2문장), label(${JSON.stringify(LABELS)} 중 1개)}. 근거 없는 수치 생성 금지.`,
      maxTokens: 2800,
      schema: { type: "object", properties: { rows: { type: "array", items: { type: "object", properties: { idx: { type: "integer" }, invest: { type: "integer" }, investNote: { type: "string" }, collab: { type: "string" }, label: { type: "string" } }, required: ["idx", "invest", "investNote", "collab", "label"], additionalProperties: false } } }, required: ["rows"], additionalProperties: false },
    });
    if (!r) continue;
    engine = engine || r.engine;
    for (const row of r.data.rows || []) {
      const s = chunk[row.idx];
      if (!s) continue;
      items[s.name] = {
        invest: clamp15(row.invest), investNote: scrub(row.investNote), collab: scrub(row.collab),
        label: LABELS.includes(row.label) ? row.label : "모니터링",
        latest: newsByName[s.name] || null,
      };
    }
  }
  return Object.keys(items).length >= Math.min(5, startups.length) ? { engine: engine || "llm-gh", items } : null;
}

const VDEF = { "검색·어시스턴트": [4, "단말 어시스턴트 대체·보완 후보로 전략 가치 높음"], "음성 AI": [4, "음성 UX 고도화 직결"], "파운데이션 모델": [3, "멀티소싱 대상"], "영상 생성": [3, "카메라·편집 접목"], "코딩 에이전트": [3, "개발 생태계 자산"] };
function ruleStrategies(startups, newsByName) {
  const items = {};
  for (const s of startups) {
    const [invest, note] = VDEF[s.vertical] || [3, "동향 추적 지속 — 밸류·기술 검증 필요"];
    items[s.name] = { invest, investNote: note, collab: s.unit || s.vertical || "단말·서비스 접목 각도 분석 대기", label: invest >= 4 ? "투자 검토" : "모니터링", latest: newsByName[s.name] || null };
  }
  return { engine: "rules", items };
}

async function main() {
  const startups = await loadStartups();
  console.log(`[startups] master ${startups.length} companies (from data.js)`);
  let prev = null;
  try { prev = JSON.parse(await readFile("startups.json", "utf8")); } catch {}
  const age = prev && prev.weekOf ? (Date.now() - new Date(prev.weekOf + "T00:00:00Z").getTime()) / 86400000 : 99;
  const need = age >= 6.5 || !prev || prev.engine === "rules" || Object.keys(prev.items || {}).length < startups.length;

  if (!need) { console.log(`[startups] fresh (weekOf ${prev.weekOf}, engine ${prev.engine}) — skip`); return; }

  // 최신 기사 크롤(순차·소량)
  const newsByName = {};
  for (const s of startups) { const n = await latestNews(s); if (n) newsByName[s.name] = n; }
  console.log(`[startups] latest news for ${Object.keys(newsByName).length}/${startups.length}`);

  let res = await llmStrategies(startups, newsByName);
  if (!res && prev && prev.engine !== "rules") { console.log("[startups] LLM 실패 — 기존 결과 유지"); return; }
  if (!res) res = ruleStrategies(startups, newsByName);

  // 이전 항목과 병합(누락 이름은 이전 값 유지 — 죽은 데이터 방지)
  const merged = { ...(prev && prev.items || {}), ...res.items };
  const out = { generatedAt: new Date().toISOString(), weekOf: TODAY, engine: res.engine, items: merged };
  await writeFile("startups.json", JSON.stringify(out) + "\n");
  console.log(`Wrote startups.json — ${Object.keys(merged).length} startups (engine: ${res.engine})`);
}

main().catch(e => { console.error(e); process.exit(0); });
