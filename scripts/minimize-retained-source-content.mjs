#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const files = ["news.json", "history.json", "research.json", "market.json"];
const clean = value => String(value || "").replace(/\s+/g, " ").trim();
const quoteOf = value => clean(typeof value === "string" ? value : value?.quote || value?.text || value?.span || value?.evidence || value?.line);
const unique = values => [...new Map(values.map(value => [value.toLowerCase().replace(/\W+/gu, ""), value])).values()].filter(Boolean);

function evidenceLines(record) {
  return unique([
    ...(record.summaryLinesEn || []),
    ...(record.localization?.sourceLines || []),
    ...(record.sourceQuantifiedLines || []),
    ...(record.evidenceSpans || []).map(quoteOf),
    quoteOf(record.evidence),
    ...(record.sourceContent?.paragraphs || []).slice(0, 3),
  ].map(quoteOf).filter(value => value.length >= 20)).slice(0, 64);
}

function minimize(record) {
  const source = record?.sourceContent;
  if (source?.status !== "content-extracted") return { changed: false, saved: 0 };
  const lines = evidenceLines(record);
  if (!lines.length) return { changed: false, saved: 0 };
  const before = Buffer.byteLength(String(source.text || ""));
  const text = lines.join("\n\n");
  const after = Buffer.byteLength(text);
  const changed = text !== String(source.text || "") || source.retentionMode !== "evidence-spans-only";
  record.sourceContent = {
    ...source,
    paragraphs: lines,
    text,
    retentionMode: "evidence-spans-only",
    originalTextBytes: source.originalTextBytes || before,
    retainedTextBytes: after,
    retainedContentHash: createHash("sha256").update(text).digest("hex"),
  };
  return { changed, saved: Math.max(0, before - after) };
}

let saved = 0;
let records = 0;
for (const file of files) {
  const data = JSON.parse(await readFile(file, "utf8"));
  const collections = file === "history.json" ? [data.articles || []]
    : file === "news.json" ? [data.articles || []]
      : file === "research.json" ? [data.feed || [], data.pinned || []]
        : [data.records || []];
  for (const collection of collections) for (const record of collection) {
    const result = minimize(record);
    if (result.changed) records++;
    saved += result.saved;
  }
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}
console.log(`[retention] minimized ${records} records; saved ${(saved / 1_048_576).toFixed(2)} MB; evidence spans retained`);
