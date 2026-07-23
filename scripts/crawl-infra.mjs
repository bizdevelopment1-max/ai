#!/usr/bin/env node
/* ============================================================
   crawl-infra.mjs — AI 인프라·미래기술 시그널 누적 갱신
   입력: news.json(매일 크롤된 최신 기사) — 별도 네트워크 호출 없이
         이미 수집된 기사에서 인프라·미래기술 시그널만 선별·분류.
   동작: HBM·컴퓨트·광통신·전력·차세대 아키텍처 등 인프라 키워드를 가진
         기사를 5개 MECE 카테고리로 분류하고, 한글 개조식 시그널 1줄 +
         정량 수치(플레인 텍스트)를 추출해 infra.json 으로 누적(merge).
   특징: 기존 시그널 보존(누적), url 기준 중복 제거, 최신순, 최대 140건.
         하드코딩이 아니라 매일 기사 기반으로 계속 쌓임.
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";

const BANNED = /삼성|samsung|갤럭시|galaxy|\bMX\b/i;
const TODAY = new Date().toISOString().slice(0, 10);

// 5개 MECE 인프라 카테고리 — 각 키워드 매칭으로 분류(위에서부터 우선)
const GROUPS = [
  { id: "compute", ko: "AI 컴퓨트·가속기", desc: "GPU·NPU·커스텀 실리콘·파운드리 — 연산 공급", accent: "#C026D3",
    re: /\bGPU\b|\bNPU\b|가속기|accelerator|custom silicon|커스텀 실리콘|\bASIC\b|파운드리|foundry|반도체 공정|Blackwell|\bH100\b|\bH200\b|\bB200\b|\bTPU\b|\bMI3\d0\b|웨이퍼|tensor core/i },
  { id: "memory", ko: "메모리·HBM", desc: "고대역폭메모리·DRAM — AI 가속기 최대 병목", accent: "#EA580C",
    re: /\bHBM\b|고대역폭|메모리|\bDRAM\b|\bDDR\d\b|memory bandwidth|스택|낸드|\bNAND\b/i },
  { id: "network", ko: "네트워킹·광통신", desc: "CPO·광인터커넥트·이더넷 — 클러스터 대역폭", accent: "#0D9488",
    re: /광통신|optical|\bCPO\b|co-packaged|인터커넥트|interconnect|네트워킹|networking|\bInfiniBand\b|이더넷|ethernet|\bNVLink\b|실리콘 포토닉스|photonics|스위치|switch fabric/i },
  { id: "power", ko: "데이터센터·전력·냉각", desc: "CapEx·전력·수랭/액침 냉각 — 물리 인프라", accent: "#1428A0",
    re: /데이터센터|data center|datacenter|\bCapEx\b|capex|전력|power|냉각|cooling|액침|수랭|liquid cool|원자력|nuclear|\bSMR\b|그리드|grid|메가와트|\bMW\b|기가와트|\bGW\b|하이퍼스케일|hyperscale/i },
  { id: "future", ko: "차세대 아키텍처", desc: "뉴로모픽·양자·온디바이스·엣지 — 미래 기술", accent: "#7A38D6",
    re: /뉴로모픽|neuromorphic|양자|quantum|온디바이스|on-device|엣지 AI|edge AI|아날로그 컴퓨팅|analog comput|포토닉 컴퓨팅|photonic comput|칩렛|chiplet|3D 적층|advanced packaging|추론 최적화|inference optim/i },
];

// 정량 수치(플레인 텍스트) 추출 — $B/T·$억/조, %, 억, 배, GB, MW/GW, nm 등
const QUANT = /(\$[\d,.]+\s?(?:[TBM]|억|조)?(?:\+)?|\d+\.?\d*\s?%|\d+\.?\d*\s?억\+?|\d+\.?\d*\s?조\+?|\d+\s?배|\d+\s?GB|\d+\.?\d*\s?[MG]W|\d+\s?nm|\d+\.?\d*[TP]B|[0-9]{2,}\s?M\+?)/;

const firstLine = sm => String(sm || "").split("\n").map(l => l.replace(/^[·\-•]\s*/, "").trim()).filter(Boolean)[0] || "";
const classify = (text) => { for (const g of GROUPS) if (g.re.test(text)) return g.id; return null; };
const idOf = (url, title) => "if_" + Buffer.from(String(url || title || "")).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(-16);

async function main() {
  let news = [];
  try { news = JSON.parse(await readFile("news.json", "utf8")).articles || []; }
  catch { console.log("[infra] news.json 없음 — crawl-news.mjs 먼저 실행"); }

  // 이전 누적본 로드(보존)
  let prev = { groups: GROUPS.map(({ re, ...g }) => g), items: [] };
  try { const p = JSON.parse(await readFile("infra.json", "utf8")); if (p && Array.isArray(p.items)) prev = p; } catch {}
  const byUrl = new Map(prev.items.map(it => [it.url, it]));

  let added = 0;
  for (const a of news) {
    const hay = `${a.title || ""} ${a.tag || ""} ${a.summary || ""}`;
    if (BANNED.test(hay)) continue;
    const group = classify(hay);
    if (!group) continue;                                  // 인프라·미래기술 시그널이 아니면 skip
    const url = a.url; if (!url) continue;
    const line = firstLine(a.summary) || a.title;
    const signal = line.replace(/[.。]+\s*$/, "").trim();
    if (!signal || BANNED.test(signal)) continue;
    const qm = (a.summary || "").match(QUANT) || (a.title || "").match(QUANT);
    const item = {
      id: idOf(url, a.title), group,
      title: String(a.title || "").replace(/[.。]+\s*$/, "").trim(),
      signal, quant: qm ? qm[0].replace(/\s+/g, "") : "",
      source: a.source || "", date: a.date || TODAY, url,
    };
    if (!byUrl.has(url)) added++;
    byUrl.set(url, { ...byUrl.get(url), ...item });        // 최신 내용으로 갱신하되 누적 보존
  }

  const items = [...byUrl.values()]
    .filter(it => it.group && it.signal && it.url && !BANNED.test(JSON.stringify(it)))
    .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0))
    .slice(0, 140);                                        // 누적 상한(성능)

  const out = { generatedAt: new Date().toISOString(), count: items.length, groups: GROUPS.map(({ re, ...g }) => g), items };
  await writeFile("infra.json", JSON.stringify(out) + "\n");
  const per = GROUPS.map(g => `${g.id}:${items.filter(i => i.group === g.id).length}`).join(" ");
  console.log(`Wrote infra.json — ${items.length} signals (+${added} new) [${per}]`);
}

main().catch(e => { console.error(e); process.exit(0); });
