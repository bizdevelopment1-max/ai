#!/usr/bin/env node
/* ============================================================
   llm.mjs — 공용 LLM 호출 헬퍼(키 없이도 동작하는 공급자 체인)
   1) ANTHROPIC_API_KEY 있으면 Claude API (engine: "llm")
   2) 없으면 GitHub Models — GitHub Actions 내장 GITHUB_TOKEN만으로
      무료 호출(워크플로 permissions: models: read 필요) (engine: "llm-gh")
   3) 둘 다 실패 → null (호출측 규칙 폴백)
   반환: { data, engine } | null.  data는 schema를 따르는 파싱된 객체.
   ============================================================ */

const AKEY = process.env.ANTHROPIC_API_KEY || "";
const GH = process.env.GITHUB_TOKEN || process.env.GH_MODELS_TOKEN || "";

export function llmAvailable() { return AKEY ? "anthropic" : GH ? "github-models" : ""; }

export async function llmJSON({ system, user, schema, maxTokens = 2000 }) {
  if (AKEY) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": AKEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
          max_tokens: maxTokens, system,
          messages: [{ role: "user", content: user }],
          output_config: { format: { type: "json_schema", schema } },
        }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status + " " + (await res.text()).slice(0, 100));
      const j = await res.json();
      if (j.stop_reason === "refusal") throw new Error("refusal");
      const block = (j.content || []).find(b => b.type === "text");
      return { data: JSON.parse(block.text), engine: "llm" };
    } catch (e) { console.warn(`[llm:anthropic] ${e.message}`); }
  }
  if (GH) {
    // GitHub Models: 신형 엔드포인트 → 구형(azure) 순으로 시도
    const targets = [
      { base: "https://models.github.ai/inference", model: process.env.GH_MODEL || "openai/gpt-4o-mini" },
      { base: "https://models.inference.ai.azure.com", model: "gpt-4o-mini" },
    ];
    for (const t of targets) {
      try {
        const res = await fetch(t.base + "/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${GH}` },
          body: JSON.stringify({
            model: t.model, max_tokens: maxTokens,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: system + " 반드시 유효한 JSON 객체 하나만 출력합니다(설명·마크다운 금지)." },
              { role: "user", content: user + "\n\n다음 JSON 스키마를 정확히 따르는 JSON만 출력하세요:\n" + JSON.stringify(schema) },
            ],
          }),
        });
        if (!res.ok) throw new Error("HTTP " + res.status + " " + (await res.text()).slice(0, 100));
        const j = await res.json();
        const raw = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        if (!raw) throw new Error("no content");
        return { data: JSON.parse(raw), engine: "llm-gh" };
      } catch (e) { console.warn(`[llm:gh:${t.base.replace("https://", "").slice(0, 22)}] ${e.message}`); }
    }
  }
  return null;
}
