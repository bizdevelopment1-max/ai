#!/usr/bin/env node
/* ============================================================
   crawl-infra.mjs — AI Application·HW/SW 기술·시장 시그널 누적 갱신
   입력: news.json(매일 크롤된 최신 기사) — 별도 네트워크 호출 없이
         이미 수집된 기사에서 모델·RAG·Vector DB·추론·반도체·데이터센터·
         AI Application 시그널을 선별.
   동작: config/tech-market-taxonomy.json의 8개 MECE 트랙으로 분류하고,
         원문 발췌 1줄 + 정량 수치를 추출해 infra.json을 갱신.
   특징: 공개 스냅샷은 트랙별 최신 항목을 균형 있게 유지하고, 새 원문은
         intelligence-ledger/technology-YYYY-MM.jsonl에 계속 누적.
   ============================================================ */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { isExcludedText } from "./news-policy.mjs";
import { loadSuppressionRegistry } from "./suppression-registry.mjs";
const TODAY = new Date().toISOString().slice(0, 10);

const taxonomy = JSON.parse(await readFile("config/tech-market-taxonomy.json", "utf8"));
const escapeRe = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const GROUPS = (taxonomy.technologyTracks || []).map(track => ({
  id: track.id,
  ko: track.label,
  desc: track.description,
  accent: track.accent,
  re: new RegExp((track.terms || []).map(escapeRe).join("|"), "i"),
}));

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
  const newItems = [];
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
    if (!byUrl.has(ukey)) { added++; newItems.push(item); }
    byUrl.set(ukey, { ...byUrl.get(ukey), ...item });      // 최신 내용으로 갱신하되 누적 보존
  }

  const sorted = [...byUrl.values()]
    .filter(it => it.group && it.signal && it.url && !isExcludedText(JSON.stringify(it)))
    .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
  const perTrackLimit = Number(taxonomy.publicSnapshotLimits?.signalsPerTrack || 24);
  const items = GROUPS.flatMap(group => sorted.filter(item => item.group === group.id).slice(0, perTrackLimit));

  if (newItems.length) {
    const ledgerDir = "intelligence-ledger";
    await mkdir(ledgerDir, { recursive: true });
    const partition = TODAY.slice(0, 7);
    await appendFile(`${ledgerDir}/technology-${partition}.jsonl`, `${newItems.map(item => JSON.stringify({ schemaVersion: 1, observedAt: new Date().toISOString(), ...item })).join("\n")}\n`, "utf8");
  }

  const out = { generatedAt: new Date().toISOString(), count: items.length, groups: GROUPS.map(({ re, ...g }) => g), items };
  await writeFile("infra.json", JSON.stringify(out) + "\n");
  const per = GROUPS.map(g => `${g.id}:${items.filter(i => i.group === g.id).length}`).join(" ");
  console.log(`Wrote infra.json — ${items.length} signals (+${added} new) [${per}]`);
}

main().catch(e => { console.error(e); process.exit(1); });
