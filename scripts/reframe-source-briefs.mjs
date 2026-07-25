#!/usr/bin/env node
/**
 * Re-select visible source briefs as fact → change → implication.
 *
 * The cumulative source text is never removed. This migration only replaces
 * weak first-paragraph excerpts with distinct evidence already stored in each
 * publisher-page record. Rows without enough material remain in the database
 * but are withheld from the visible research feed.
 */
import { readFile, writeFile } from "node:fs/promises";
import { selectInsightLines } from "./source-content.mjs";

const SELECTION_VERSION = 7;
const readJson = async (file, fallback) => {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch { return fallback; }
};

function reframeRow(row, minimum) {
  const source = row?.sourceContent;
  if (!source || source.status !== "content-extracted" || Number(source.selectionVersion || 0) >= SELECTION_VERSION) {
    return { row, changed: false, hidden: false };
  }
  const sourceText = String(source.text || (source.paragraphs || []).join("\n\n") || "");
  const selected = selectInsightLines(sourceText, row.titleEn || source.headline || row.title || "");
  const nextSource = { ...source, selectionVersion: SELECTION_VERSION };
  if (selected.length < minimum) {
    return {
      row: { ...row, sourceContent: nextSource, displayEligible: false, insightSelection: "insufficient-distinct-source-evidence" },
      changed: true,
      hidden: true,
    };
  }
  const summaryLinesEn = selected.map(item => item.line);
  const summaryRoles = selected.map(item => item.role);
  // Localization hashes include the source excerpts. Removing the old
  // localized display forces the following localization step to translate the
  // newly selected source-backed sentences, not stale first-paragraph copy.
  const { localization, titleKo, summaryLinesKo, ...base } = row;
  return {
    row: {
      ...base,
      summaryLinesEn,
      summaryRoles,
      summary: summaryLinesEn.join("\n"),
      summaryVersion: 5,
      summaryMode: "source-content-extractive",
      summaryEngine: "source-content-insight-extractive",
      sourceContent: nextSource,
      displayEligible: true,
      insightSelection: "fact-change-implication",
    },
    changed: true,
    hidden: false,
  };
}

async function reframeFile(file, key, minimum) {
  const data = await readJson(file, { [key]: [] });
  let changed = 0;
  let hidden = 0;
  data[key] = (data[key] || []).map(row => {
    const result = reframeRow(row, minimum);
    if (result.changed) changed++;
    if (result.hidden) hidden++;
    return result.row;
  });
  if (changed) {
    data.generatedAt = new Date().toISOString();
    await writeFile(file, JSON.stringify(data, null, 2) + "\n");
  }
  console.log(`[reframe] ${file}: updated ${changed}, withheld ${hidden}, cumulative ${data[key].length}`);
  return { changed, hidden };
}

const news = await reframeFile("news.json", "articles", 2);
const research = await reframeFile("research.json", "feed", 3);
console.log(`[reframe] complete: updated ${news.changed + research.changed}, withheld ${news.hidden + research.hidden}`);
