#!/usr/bin/env node
/**
 * Source-grounded synthesis helper.
 *
 * GitHub Actions can call GitHub Models with its built-in GITHUB_TOKEN.
 * Local and unauthorised runs return null so every caller can preserve the
 * last model-authored result or publish an extractive, source-linked fallback.
 */
const TOKEN = process.env.GITHUB_MODELS_TOKEN || process.env.GITHUB_TOKEN || "";
const MODEL = process.env.GITHUB_MODELS_MODEL || "openai/gpt-4.1";
const ENDPOINT = process.env.GITHUB_MODELS_ENDPOINT || "https://models.github.ai/inference/chat/completions";
const TIMEOUT_MS = Math.max(15_000, Number(process.env.GITHUB_MODELS_TIMEOUT_MS || 90_000));

export function llmAvailable() {
  return TOKEN ? `github-models:${MODEL}` : "";
}

const parseJson = value => {
  const raw = String(value || "").trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try { return JSON.parse(raw); } catch {}
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch {}
  }
  return null;
};

export async function llmJSON({ system, user, maxTokens = 3000, schema } = {}) {
  if (!TOKEN || !system || !user) return null;
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.1,
    max_tokens: maxTokens,
    response_format: schema
      ? { type: "json_schema", json_schema: { name: "source_grounded_result", strict: true, schema } }
      : { type: "json_object" },
  };
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`[llm] GitHub Models ${response.status}: ${String(await response.text()).slice(0, 240)}`);
      return null;
    }
    const json = await response.json();
    const data = parseJson(json?.choices?.[0]?.message?.content);
    return data ? { data, engine: `github-models:${MODEL}` } : null;
  } catch (error) {
    console.warn(`[llm] GitHub Models unavailable: ${error.message}`);
    return null;
  }
}
