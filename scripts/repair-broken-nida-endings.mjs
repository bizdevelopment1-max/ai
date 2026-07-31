#!/usr/bin/env node
// One-time repair for Korean display text already stored with the
// "final-gate blindly cuts -다" bug (e.g. "가져옵니다" persisted as "가져옵니").
// A bare 니 as the very last character of a bullet clause never occurs in
// correctly-formed 개조식 Korean, so it is a safe, unambiguous signal that the
// stored string is broken; reconstructing it only requires shifting the
// preceding syllable's ㅂ batchim to ㅁ (the same fix now in korean-copy.mjs /
// translate_summarize.py). Operates on raw file text via regex substitution
// (not JSON.parse/stringify) so files that were stored as compact single-line
// JSON stay compact — only the broken substrings change.
import { readFile, writeFile } from "node:fs/promises";

const HANGUL_BASE = 0xac00, HANGUL_LAST = 0xd7a3, JONG_COUNT = 28;
const JONG_MIEUM = 16, JONG_BIEUP = 17;
const jongseongOf = ch => {
  const code = ch.codePointAt(0);
  return code >= HANGUL_BASE && code <= HANGUL_LAST ? (code - HANGUL_BASE) % JONG_COUNT : -1;
};
const withJongseong = (ch, jong) => String.fromCodePoint(ch.codePointAt(0) - jongseongOf(ch) + jong);

const FILES = [
  "news.json", "market.json", "research.json", "startups.json",
  "news-view.json", "market-view.json", "research-view.json",
  "company-news.json", "history.json",
];

// charX(captured) + 니 + optional decorative closing quote(s) — either a
// literal escaped quote embedded in the string's own content (\") or an
// unescaped straight/curly quote character — followed by the real clause
// boundary: the JSON string terminator ("), the bullet separator ( · ), or
// an escaped newline (\n) inside a multi-line field.
const PATTERN = /([가-힣])니((?:\\"|['”’])*)(?="|\s+·\s+|\\n)/gu;

const dryRun = process.argv.includes("--dry-run");
let totalFixed = 0;
const samples = [];

for (const file of FILES) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch {
    console.log(`  스킵 ${file} (없음)`);
    continue;
  }
  let fileCount = 0;
  const fixed = text.replace(PATTERN, (match, charX, closing) => {
    if (jongseongOf(charX) !== JONG_BIEUP) return match;
    fileCount++;
    totalFixed++;
    if (samples.length < 30) samples.push(`${JSON.stringify(match)} -> ${JSON.stringify(withJongseong(charX, JONG_MIEUM) + closing)}`);
    return withJongseong(charX, JONG_MIEUM) + closing;
  });
  if (fileCount > 0) {
    if (!dryRun) await writeFile(file, fixed);
    console.log(`  수정 ${file}: ${fileCount}건`);
  } else {
    console.log(`  변경없음 ${file}`);
  }
}

console.log(`\n총 ${totalFixed}건 복구${dryRun ? " (dry-run, 미저장)" : ""}`);
if (samples.length) console.log(samples.join("\n"));
