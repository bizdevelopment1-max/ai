#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { containsRestrictedDisplayTerm } from "./public-copy.mjs";

const data = JSON.parse(await readFile("tech-market-intelligence.json", "utf8"));
const fail = message => { throw new Error(`[tech-market] ${message}`); };
const validUrl = value => /^https?:\/\//.test(String(value || ""));
const tracks = data.technologyTracks || [];
const entities = data.infrastructureLandscape?.entities || [];
const verticals = data.infrastructureLandscape?.verticalWorkloads || [];
const partners = data.inferenceMarket?.partnerCandidates || [];
const valuationContext = value => /\b(?:valuation|valued?\s+(?:it|the\s+company)?\s*at|market\s+cap|enterprise\s+value|worth)\b|기업\s*가치/i.test(String(value || ""));

if (data.schemaVersion !== 1 || data.sourceMode !== "generated-from-source-linked-ledgers") fail("invalid schema or source mode");
if (tracks.length < 8) fail(`technology taxonomy is incomplete (${tracks.length}/8)`);
if (!tracks.some(track => track.id === "inference-serving") || !tracks.some(track => track.id === "rag-retrieval")
  || !tracks.some(track => track.id === "vector-data") || !tracks.some(track => track.id === "data-center-system")) {
  fail("required RAG, vector, inference and data-center tracks are missing");
}
const signals = tracks.flatMap(track => track.signals || []);
if (!signals.length) fail("no source-backed technology signals were generated");
if (signals.some(signal => !validUrl(signal.url) || !signal.title || !signal.date)) fail("technology signal lacks a title, date or source URL");
if (entities.some(entity => [...(entity.investmentMetrics || []), ...(entity.strategySignals || [])].some(signal => !validUrl(signal.url)))) {
  fail("infrastructure landscape contains an unlinked fact");
}
if (verticals.some(vertical => (vertical.signals || []).some(signal => !validUrl(signal.url)))) fail("vertical workload contains an unlinked fact");
if (partners.some(candidate => !(candidate.signals || []).length || (candidate.signals || []).some(signal => !validUrl(signal.url)))) {
  fail("partner candidate lacks source-linked evidence");
}
const investmentSignals = entities.flatMap(entity => (entity.investmentMetrics || []).map(signal => ({ ...signal, entity: entity.name })));
if (investmentSignals.some(signal => !(signal.metricValues || []).length
  || !["entity+metric+investment-same-clause", "entity-in-title-or-company+metric-investment-sentence"].includes(signal.entityBinding))) {
  fail("investment metric was published without an entity-bound source-extracted currency value");
}
if (investmentSignals.some(signal => valuationContext(signal.excerpt))) fail("valuation-only figure leaked into infrastructure investment metrics");
const investmentKeys = investmentSignals.map(signal => `${signal.entity}|${String(signal.date || "").slice(0, 7)}|${signal.metricValues.map(value => String(value).toLowerCase()).sort().join("|")}`);
if (new Set(investmentKeys).size !== investmentKeys.length) fail("duplicate infrastructure investment event was not consolidated");
if (containsRestrictedDisplayTerm({
  summary: data.summary,
  technologyTracks: tracks,
  infrastructureLandscape: data.infrastructureLandscape,
  inferenceMarket: data.inferenceMarket,
})) fail("restricted public wording remains in generated copy");

console.log(`[tech-market] valid · ${signals.length} signals · ${entities.length} infrastructure entities · ${verticals.length} verticals · ${partners.length} partners`);
