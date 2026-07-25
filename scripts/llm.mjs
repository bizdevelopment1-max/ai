#!/usr/bin/env node
/**
 * Compatibility helper for the former LLM enrichment path.
 *
 * The dashboard now deliberately makes no model/API request during collection.
 * Callers must use their deterministic, source-linked fallback and label any
 * derived analysis as rule-based. Keeping this tiny module avoids silently
 * reviving a networked model call from an older script.
 */
export function llmAvailable() { return ""; }

export async function llmJSON() {
  return null;
}
