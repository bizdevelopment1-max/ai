#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";

const [snapshot, policy] = await Promise.all([
  readFile("intelligence-tracks.json", "utf8").then(JSON.parse),
  readFile("config/intelligence-tracks.json", "utf8").then(JSON.parse),
]);
const failures = [];
const expected = new Set((policy.tracks || []).map(track => track.id));
const actual = new Set(Object.keys(snapshot.tracks || {}));
for (const id of expected) if (!actual.has(id)) failures.push(`${id}: track missing`);
const ledgerFiles = (await readdir(policy.ledgerDirectory || "intelligence-ledger"))
  .filter(file => file.endsWith(".jsonl"));
const ledgerVersionKeys = new Set();
for (const file of ledgerFiles) {
  const raw = await readFile(`${policy.ledgerDirectory || "intelligence-ledger"}/${file}`, "utf8");
  for (const line of raw.split(/\r?\n/).filter(Boolean)) {
    try {
      const record = JSON.parse(line);
      if (record.versionKey) ledgerVersionKeys.add(record.versionKey);
    } catch { failures.push(`${file}: invalid JSONL record`); }
  }
}

let total = 0;
let sourceBacked = 0;
let newVersions = 0;
for (const definition of policy.tracks || []) {
  const track = snapshot.tracks?.[definition.id];
  if (!track) continue;
  const records = track.records || [];
  total += records.length;
  sourceBacked += records.filter(record => record.evidenceStatus === "source-backed").length;
  newVersions += Number(track.newVersionCount || 0);
  if (track.recordCount !== records.length) failures.push(`${definition.id}: recordCount mismatch`);
  if (records.length < Number(definition.minimumRecords || 1)) failures.push(`${definition.id}: minimum record coverage not met`);
  if (new Set(records.map(record => record.stableKey)).size !== records.length) failures.push(`${definition.id}: duplicate stableKey`);
  if (track.sourceBackedCount !== records.filter(record => record.evidenceStatus === "source-backed").length) failures.push(`${definition.id}: sourceBackedCount mismatch`);
  if (Number(track.sourceBackedRatio || 0) < Number(definition.minimumSourceBackedRatio || 0)) failures.push(`${definition.id}: source-backed ratio below policy`);
  for (const record of records) {
    if (!/^[0-9a-f]{64}$/.test(record.payloadHash || "")) failures.push(`${definition.id}:${record.stableKey}: invalid payload hash`);
    if (!/^[0-9a-f]{64}$/.test(record.versionKey || "")) failures.push(`${definition.id}:${record.stableKey}: invalid version key`);
    if (record.evidenceStatus === "source-backed" && !/^https?:\/\//.test(record.sourceUrl || "")) failures.push(`${definition.id}:${record.stableKey}: source-backed URL missing`);
    if (!record.firstSeenAt || !record.lastSeenAt || Number(record.revision || 0) < 1) failures.push(`${definition.id}:${record.stableKey}: temporal revision fields missing`);
    if (!ledgerVersionKeys.has(record.versionKey)) failures.push(`${definition.id}:${record.stableKey}: latest version missing from append-only ledger`);
  }
}
if (snapshot.summary?.trackCount !== expected.size) failures.push("summary.trackCount mismatch");
if (snapshot.summary?.recordCount !== total) failures.push("summary.recordCount mismatch");
if (snapshot.summary?.sourceBackedCount !== sourceBacked) failures.push("summary.sourceBackedCount mismatch");
if (snapshot.summary?.newVersionCount !== newVersions) failures.push("summary.newVersionCount mismatch");
if (snapshot.reverificationQueue?.total !== (snapshot.reverificationQueue?.records || []).length) failures.push("reverificationQueue.total mismatch");

if (failures.length) {
  console.error(`[intelligence-tracks] ${failures.length} validation failure(s)`);
  failures.slice(0, 40).forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`[intelligence-tracks] ${expected.size} tracks · ${total} latest records · ${sourceBacked} source-backed · ${newVersions} new revisions`);
