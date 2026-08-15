#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { isExcludedText } from "./news-policy.mjs";
import { loadSuppressionRegistry } from "./suppression-registry.mjs";

// The legacy filename is retained for cache compatibility. Its contents are
// now an AI-infrastructure-to-memory opportunity database, not a phone-app DB.
const OUTPUT = "mobile-ai-business-view.json";
const now = new Date().toISOString();
const compact = value => String(value || "").replace(/\s+/g, " ").trim();
const stableHash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
const readJson = async (file, fallback) => {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; }
};
const dateValue = value => Number.isFinite(Date.parse(String(value || ""))) ? Date.parse(String(value || "")) : 0;
const latestByStableKey = rows => [...new Map([...rows]
  .filter(row => row?.stableKey && row?.sourceUrl && row?.publishedAt)
  .sort((a, b) => dateValue(a.publishedAt) - dateValue(b.publishedAt))
  .map(row => [row.stableKey, row])).values()]
  .sort((a, b) => dateValue(b.publishedAt) - dateValue(a.publishedAt));
const previousIdentity = payload => new Map([
  ...(payload?.markets || []),
  ...(payload?.competitors || []),
].map(item => [item.stableKey, `${item.sourceUrl}|${item.publishedAt}|${stableHash(item.metrics || item.proof)}`]));

const textOf = article => compact([
  article.titleKo, article.title, article.summary,
  ...(article.summaryLinesKo || []), ...(article.summaryLinesEn || []),
].filter(Boolean).join(" "));
const displayTitle = article => compact(article.titleKo || article.title);
const displaySummary = article => compact((article.summaryLinesKo || [])[0] || article.summary || article.titleKo || article.title);
const dateMetric = date => {
  const match = String(date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${Number(match[2])}/${Number(match[3])}` : String(date || "");
};
const verified = article => article?.url && article?.date
  && (!article.provenance?.status || article.provenance.status === "source-backed")
  && displayTitle(article);
const MEMORY_SCOPE = /(?:HBM\d*|custom HBM|DRAM|NAND|eSSD|CXL|MRDIMM|SOCAMM|memory chip|memory bandwidth|AI infrastructure|data cent(?:er|re)|GPU|accelerator|메모리 반도체|고대역폭|D램|낸드|데이터센터|AI 인프라|가속기)/i;

const TOPICS = [
  { id: "hbm-custom", label: "HBM·Custom Memory", accent: "#0D7377", match: /(?:HBM\d*|custom HBM|고대역폭)/i },
  { id: "server-memory", label: "Server Memory Architecture", accent: "#2454A6", match: /(?:DRAM|CXL|MRDIMM|SOCAMM|memory bandwidth|메모리 반도체|D램)/i },
  { id: "enterprise-storage", label: "Enterprise Storage", accent: "#6B5AA6", match: /(?:NAND|eSSD|enterprise storage|storage system|낸드|스토리지)/i },
  { id: "ai-infrastructure", label: "AI Infrastructure Demand", accent: "#B06B32", match: /(?:AI infrastructure|data cent(?:er|re)|GPU|accelerator|AI 인프라|데이터센터|가속기)/i },
];

const marketRow = (topic, article) => ({
  stableKey: `memory-market:${topic.id}`,
  topicId: topic.id,
  topic: topic.label,
  accent: topic.accent,
  title: displayTitle(article),
  metrics: [
    { label: "최근 공개 근거", value: dateMetric(article.date) },
    { label: "출처", value: compact(article.source || "원문") },
  ],
  insight: displaySummary(article),
  sourceName: compact(article.source || "원문"),
  sourceUrl: article.url,
  publishedAt: article.date,
  sourceTier: 3,
  provenance: "source-backed",
});

const competitorRows = articles => {
  const grouped = new Map();
  for (const article of articles) {
    const name = compact(article.co || article.source || "");
    if (!name) continue;
    const previous = grouped.get(name);
    if (!previous || article.date > previous.date) grouped.set(name, article);
  }
  return [...grouped.entries()].map(([name, article]) => ({
    stableKey: `memory-actor:${name.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-")}`,
    name,
    segment: TOPICS.find(topic => topic.match.test(textOf(article)))?.label || "AI Infrastructure",
    businessModel: "공개 실행 신호",
    modelId: "evidence",
    metrics: [
      { label: "최근 공개 근거", value: dateMetric(article.date) },
      { label: "근거 유형", value: "원문" },
    ],
    proof: displaySummary(article),
    sourceName: compact(article.source || "원문"),
    sourceUrl: article.url,
    publishedAt: article.date,
    sourceTier: 3,
    provenance: "source-backed",
  })).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 16);
};

const OPPORTUNITY_FRAMEWORK = [
  {
    id: "custom-hbm", priority: 1, title: "Custom HBM 공동 설계",
    whereToPlay: "가속기별 대역폭·용량·전력·열 설계와 베이스다이·패키징 협업",
    valueCapture: "공동 로드맵·인증 게이트·장기 공급계약을 묶은 프리미엄 메모리",
    pattern: /(?:HBM\d*|custom HBM|고대역폭|GPU|accelerator|가속기)/i,
    rationale: "가속기 로드맵을 메모리 요구와 함께 검증해 제품 정의와 고객 인증 시점을 연결",
    nextMetrics: ["고객 인증 단계", "대역폭·전력 목표", "패키징 수율", "장기계약 범위"],
  },
  {
    id: "memory-pooling", priority: 2, title: "AI 서버 메모리 풀링",
    whereToPlay: "CPU·GPU·가속기 사이 데이터 이동과 용량 병목을 줄이는 CXL·확장 메모리",
    valueCapture: "시스템 PoC·컨트롤러·펌웨어·메모리 모듈을 결합한 솔루션 매출",
    pattern: /(?:CXL|MRDIMM|SOCAMM|DRAM|memory bandwidth|server|데이터센터|서버|D램)/i,
    rationale: "워크로드의 토큰 처리량·지연·활용률을 메모리 아키텍처와 직접 연결",
    nextMetrics: ["PoC 고객 수", "GPU 활용률", "메모리 용량 효율", "시스템 인증"],
  },
  {
    id: "enterprise-essd", priority: 3, title: "AI 데이터 파이프라인 eSSD",
    whereToPlay: "체크포인트·벡터DB·RAG·학습 데이터 파이프라인의 읽기·쓰기 병목",
    valueCapture: "워크로드별 펌웨어·내구성·QoS가 포함된 엔터프라이즈 스토리지",
    pattern: /(?:NAND|eSSD|storage|vector database|RAG|checkpoint|낸드|스토리지)/i,
    rationale: "모델 학습과 추론의 데이터 공급 병목을 용량 판매가 아닌 워크로드 SLA로 전환",
    nextMetrics: ["고객 qualification", "지연·QoS", "내구성", "반복 수주"],
  },
  {
    id: "ai-infra-execution", priority: 4, title: "AI Infra 대내·대외 실행",
    whereToPlay: "클라우드·네오클라우드·가속기·서버 OEM 계정별 메모리 요구와 투자 시점",
    valueCapture: "계정 Pain point 맵과 90일 의사결정 보드 기반 설계 채택·공급 협업",
    pattern: /(?:AI infrastructure|data cent(?:er|re)|GPU|accelerator|AI 인프라|데이터센터|가속기)/i,
    rationale: "수요·기술·제품·파트너 신호를 하나의 계정 실행 리듬으로 관리",
    nextMetrics: ["계정별 근거", "설계 채택", "공급 게이트", "90일 실행률"],
  },
];

const main = async () => {
  const [news, previous, suppression] = await Promise.all([
    readJson("news.json", { articles: [] }), readJson(OUTPUT, null), loadSuppressionRegistry(),
  ]);
  const evidenceArticles = (news.articles || [])
    .filter(article => verified(article) && MEMORY_SCOPE.test(textOf(article)) && !suppression.matches(article, "article"))
    .sort((a, b) => b.date.localeCompare(a.date));
  const markets = latestByStableKey(TOPICS.map(topic => {
    const article = evidenceArticles.find(row => topic.match.test(textOf(row)));
    return article ? marketRow(topic, article) : null;
  }).filter(Boolean));
  const competitors = latestByStableKey(competitorRows(evidenceArticles));
  const opportunities = OPPORTUNITY_FRAMEWORK.map(item => {
    const support = evidenceArticles.filter(article => item.pattern.test(textOf(article))).slice(0, 6);
    return {
      ...item,
      evidenceCount: new Set(support.map(article => article.url)).size,
      latestEvidenceAt: support[0]?.date || "",
      sources: support.map(article => ({
        title: displayTitle(article), sourceName: article.source || "원문",
        sourceUrl: article.url, publishedAt: article.date,
      })),
    };
  }).filter(item => item.evidenceCount >= 2);

  const previousMap = previousIdentity(previous);
  const currentRows = [...markets, ...competitors];
  const replacementCount = currentRows.filter(item => {
    const before = previousMap.get(item.stableKey);
    const after = `${item.sourceUrl}|${item.publishedAt}|${stableHash(item.metrics || item.proof)}`;
    return before && before !== after;
  }).length;
  const snapshotCore = { markets, competitors, opportunities };
  const output = {
    generatedAt: now,
    schemaVersion: 2,
    snapshotVersion: stableHash(snapshotCore),
    database: {
      mode: "latest-verified-snapshot",
      replacementPolicy: "stable-key + newest source-backed evidence",
      publicRetention: "current-only",
      replacementCount,
      retiredCount: [...previousMap.keys()].filter(key => !currentRows.some(item => item.stableKey === key)).length,
      previousSnapshotVersion: previous?.snapshotVersion || "",
    },
    summary: {
      marketTopics: markets.length,
      competitors: competitors.length,
      businessModels: new Set(competitors.map(item => item.segment)).size,
      opportunities: opportunities.length,
      sources: new Set(currentRows.map(item => item.sourceUrl)).size,
    },
    markets, competitors, opportunities,
  };
  if (isExcludedText(JSON.stringify(output))) throw new Error("AI memory opportunity snapshot contains an excluded term");
  await writeFile(OUTPUT, `${JSON.stringify(output)}\n`);
  console.log(`[ai-memory-opportunity] ${markets.length} demand signals · ${competitors.length} actors · ${opportunities.length} opportunities · ${replacementCount} replaced`);
};

main().catch(error => { console.error(error); process.exit(1); });
