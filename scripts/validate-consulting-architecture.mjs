#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const readJson = async file => JSON.parse(await readFile(file, "utf8"));
const architecture = await readJson("config/consulting-architecture.json");
const registry = await readJson("config/site-content-registry.json");
const overview = await readJson("overview-view.json");
const strategy = await readJson("strategy-view.json");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const requiredSectionIds = [
  "overview", "strategy", "opportunity", "newbiz", "valuechain",
  "signals", "sanalysis", "evidence", "validation",
];
const removedSidebarChildren = new Set([
  "executive-brief", "execution-plan", "build-buy-partner",
  "execution-hypothesis", "action-implication",
]);

const workstreams = (architecture.workstreams || [])
  .slice()
  .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
const sections = workstreams.flatMap(workstream => workstream.sections || []);
const sectionIds = sections.map(section => section.id);
const unique = values => new Set(values).size === values.length;

expect(architecture.schemaVersion >= 1, "consulting architecture schemaVersion is missing");
expect(workstreams.length === 4, `MECE architecture must contain exactly four workstreams; received ${workstreams.length}`);
expect(unique(workstreams.map(item => item.id)), "workstream IDs must be unique");
expect(unique(workstreams.map(item => item.order)), "workstream order values must be unique");
expect(unique(sectionIds), "every public section must belong to exactly one workstream");
expect(JSON.stringify(sectionIds) === JSON.stringify(requiredSectionIds),
  `navigation order mismatch: ${sectionIds.join(", ")}`);

for (const workstream of workstreams) {
  expect(workstream.label && workstream.labelEn, `${workstream.id}: labels are required`);
  expect(workstream.question && workstream.output && workstream.gate,
    `${workstream.id}: question, output and gate are required`);
  expect((workstream.sections || []).length > 0, `${workstream.id}: at least one section is required`);
}
for (const section of sections) {
  expect(section.label && section.labelEn && section.icon, `${section.id}: labels and icon are required`);
  expect(section.question && section.output, `${section.id}: question and output are required`);
  expect(Array.isArray(section.children), `${section.id}: children must be an array`);
  for (const child of section.children || []) {
    expect(!removedSidebarChildren.has(child.key), `${section.id}: removed sidebar child returned: ${child.key}`);
  }
}

const registrySections = new Set((registry.datasets || []).map(dataset => dataset.section));
for (const section of registrySections) {
  expect(requiredSectionIds.includes(section), `content registry section is outside the MECE architecture: ${section}`);
}
for (const section of requiredSectionIds) {
  expect((registry.datasets || []).some(dataset => dataset.section === section),
    `${section}: no generated dataset is registered`);
}

const generatedNavigation = strategy.consultingModel?.navigation || [];
const initialNavigation = overview.consultingNavigation || [];
expect(JSON.stringify(generatedNavigation.map(item => item.id)) === JSON.stringify(requiredSectionIds),
  "strategy-view navigation is not synchronized with the consulting architecture");
expect(JSON.stringify(initialNavigation.map(item => item.id)) === JSON.stringify(requiredSectionIds),
  "overview-view navigation is not synchronized with the consulting architecture");
expect((strategy.consultingModel?.workstreams || []).length === workstreams.length,
  "strategy-view is missing the generated MECE operating model");
expect(Number(strategy.consultingModel?.coverage?.sections || 0) === requiredSectionIds.length,
  "strategy-view coverage does not include every public section");

if (failures.length) {
  console.error(`[consulting-architecture] ${failures.length} failure(s)`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`[consulting-architecture] 4 workstreams · ${sectionIds.length} exclusive sections · navigation synchronized`);
