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
const MIN_REQUEST_INTERVAL_MS = Math.max(0, Number(process.env.GITHUB_MODELS_MIN_INTERVAL_MS || 16_000));
const MAX_RATE_LIMIT_WAIT_MS = Math.max(
  MIN_REQUEST_INTERVAL_MS,
  Number(process.env.GITHUB_MODELS_MAX_RETRY_WAIT_MS || 120_000),
);
let lastRequestAt = 0;

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
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const wait = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt));
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      lastRequestAt = Date.now();
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
      if (response.status === 429 && attempt < 3) {
        const advertisedWait = Number(response.headers.get("retry-after") || 20);
        const advertisedWaitMs = Number.isFinite(advertisedWait)
          ? (advertisedWait > 300 ? advertisedWait : advertisedWait * 1000)
          : 20_000;
        const retryAfter = Math.max(
          MIN_REQUEST_INTERVAL_MS,
          Math.min(MAX_RATE_LIMIT_WAIT_MS, advertisedWaitMs),
        );
        console.warn(`[llm] GitHub Models rate limited · retry ${attempt}/3 in ${Math.ceil(retryAfter / 1000)}s`);
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        continue;
      }
      if (!response.ok) {
        console.warn(`[llm] GitHub Models ${response.status}: ${String(await response.text()).slice(0, 240)}`);
        return null;
      }
      const json = await response.json();
      const data = parseJson(json?.choices?.[0]?.message?.content);
      return data ? { data, engine: `github-models:${MODEL}` } : null;
    } catch (error) {
      if (attempt < 3) {
        console.warn(`[llm] GitHub Models transient error · retry ${attempt}/3: ${error.message}`);
        continue;
      }
      console.warn(`[llm] GitHub Models unavailable: ${error.message}`);
      return null;
    }
  }
  return null;
}
