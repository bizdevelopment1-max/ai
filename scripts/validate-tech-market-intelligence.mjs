#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { containsRestrictedDisplayTerm } from "./public-copy.mjs";

const data = JSON.parse(await readFile("tech-market-intelligence.json", "utf8"));
const fail = message => { throw new Error(`[tech-market] ${message}`); };
const validUrl = value => /^https?:\/\//.test(String(value || ""));
const tracks = data.technologyTracks || [];
const entities = data.infrastructureLandscape?.entities || [];
const segments = data.infrastructureLandscape?.segments || [];
const verticals = data.infrastructureLandscape?.verticalWorkloads || [];
const partners = data.inferenceMarket?.partnerCandidates || [];
const partnerLevels = data.inferenceMarket?.partnerLevels || [];
const valuationContext = value => /\b(?:valuation|valued?\s+(?:it|the\s+company)?\s*at|market\s+cap|enterprise\s+value|worth)\b|기업\s*가치/i.test(String(value || ""));

const validKoreanBullets = bullets => Array.isArray(bullets) && bullets.length === 3
  && bullets.every(bullet => bullet?.label && /[가-힣]/.test(String(bullet.text || "")))
  && new Set(bullets.map(bullet => String(bullet.text || "").trim())).size === 3;
const allPublicSignals = [
  ...tracks.flatMap(track => track.signals || []),
  ...entities.flatMap(entity => [...(entity.investmentMetrics || []), ...(entity.strategySignals || [])]),
  ...verticals.flatMap(vertical => vertical.signals || []),
  ...(data.inferenceMarket?.signals || []),
  ...partners.flatMap(candidate => candidate.signals || []),
];

if (data.schemaVersion !== 3 || data.sourceMode !== "generated-from-source-linked-ledgers") fail("invalid schema or source mode");
if (tracks.length < 8) fail(`technology taxonomy is incomplete (${tracks.length}/8)`);
if (segments.length !== 8 || new Set(segments.map(segment => segment.id)).size !== 8) fail(`future infrastructure taxonomy is incomplete (${segments.length}/8)`);
if (Number(data.summary?.trackedEntityUniverse || 0) < 40) fail(`automated company universe is too narrow (${data.summary?.trackedEntityUniverse || 0})`);
if (!tracks.some(track => track.id === "inference-serving") || !tracks.some(track => track.id === "rag-retrieval")
  || !tracks.some(track => track.id === "vector-data") || !tracks.some(track => track.id === "data-center-system")) {
  fail("required RAG, vector, inference and data-center tracks are missing");
}
const signals = tracks.flatMap(track => track.signals || []);
if (!signals.length) fail("no source-backed technology signals were generated");
if (signals.some(signal => !validUrl(signal.url) || !signal.title || !signal.date)) fail("technology signal lacks a title, date or source URL");
if (allPublicSignals.some(signal => !validKoreanBullets(signal.bullets))) fail("a public signal lacks three distinct Korean fact/change/implication bullets");
if (entities.some(entity => [...(entity.investmentMetrics || []), ...(entity.strategySignals || [])].some(signal => !validUrl(signal.url)))) {
  fail("infrastructure landscape contains an unlinked fact");
}
if (entities.some(entity => !entity.segmentId || !entity.futureRole || !validKoreanBullets(entity.summaryBullets))) {
  fail("infrastructure entity lacks a future-value-chain segment or three Korean summary bullets");
}
if (verticals.some(vertical => (vertical.signals || []).some(signal => !validUrl(signal.url)))) fail("vertical workload contains an unlinked fact");
if (verticals.some(vertical => !validKoreanBullets(vertical.summaryBullets)
  || (vertical.signals || []).some(signal => signal.bindingRule !== "same-evidence-block" || !(signal.classificationTerms || []).length))) {
  fail("vertical workload lacks same-block classification evidence or three Korean summary bullets");
}
if (partners.some(candidate => !(candidate.signals || []).length || (candidate.signals || []).some(signal => !validUrl(signal.url)))) {
  fail("partner candidate lacks source-linked evidence");
}
if (partnerLevels.length !== 5 || new Set(partnerLevels.map(level => level.id)).size !== 5
  || partnerLevels.some(level => !level.label || !level.strategicMeaning || !level.decisionGate)) {
  fail("inference partner levels are incomplete");
}
if (!validKoreanBullets(data.inferenceMarket?.summaryBullets)) fail("inference market lacks three Korean decision insights");
if (partners.some(candidate => !candidate.partnerLevelId || !partnerLevels.some(level => level.id === candidate.partnerLevelId)
  || !candidate.role || !candidate.focus || !candidate.strategicInsight || !candidate.decisionGate || !candidate.nextAction
  || !["repeated-official", "official-included", "reported-only"].includes(candidate.evidenceCode)
  || !["공식 반복", "공식 포함", "보도 근거"].includes(candidate.evidenceLabel)
  || Number(candidate.sourceCount || 0) < 1 || Number(candidate.publisherCount || 0) < 1
  || Array.isArray(candidate.actions))) {
  fail("partner candidate lacks a single level, differentiated insight or evidence gate");
}
const investmentSignals = entities.flatMap(entity => (entity.investmentMetrics || []).map(signal => ({ ...signal, entity: entity.name })));
if (investmentSignals.some(signal => !(signal.metricValues || []).length
  || !["entity+metric+investment-same-clause", "entity-in-title-or-company+metric-investment-sentence"].includes(signal.entityBinding))) {
  fail("investment metric was published without an entity-bound source-extracted currency value");
}
if (investmentSignals.some(signal => valuationContext(signal.evidenceExcerpt))) fail("valuation-only figure leaked into infrastructure investment metrics");
const investmentKeys = investmentSignals.map(signal => `${signal.entity}|${String(signal.date || "").slice(0, 7)}|${signal.metricValues.map(value => String(value).toLowerCase()).sort().join("|")}`);
if (new Set(investmentKeys).size !== investmentKeys.length) fail("duplicate infrastructure investment event was not consolidated");
if (containsRestrictedDisplayTerm({
  summary: data.summary,
  technologyTracks: tracks,
  infrastructureLandscape: data.infrastructureLandscape,
  inferenceMarket: data.inferenceMarket,
})) fail("restricted public wording remains in generated copy");

console.log(`[tech-market] valid · ${signals.length} signals · ${entities.length} infrastructure entities · ${verticals.length} verticals · ${partners.length} partners`);
