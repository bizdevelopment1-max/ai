#!/usr/bin/env node
/**
 * Converts crawled publisher-page evidence into company-level business
 * intelligence. The model is asked to synthesise only the supplied evidence
 * IDs. If model inference is unavailable, the site receives an extractive
 * source-linked summary rather than generic portfolio labels.
 */
import { readFile, writeFile } from "node:fs/promises";
import { loadDash } from "./load-dash.mjs";
import { llmJSON, llmAvailable } from "./llm.mjs";

const readJson = async (file, fallback) => {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; }
};
const clean = value => String(value || "").replace(/\s+/g, " ").trim();
const first = (...values) => values.map(clean).find(Boolean) || "";
const clip = (value, size = 280) => {
  const text = clean(value);
  return text.length > size ? `${text.slice(0, size - 1)}…` : text;
};
const canon = value => {
  try {
    const url = new URL(String(value || ""));
    url.hash = "";
    url.search = "";
    return url.href.replace(/\/+$/, "");
  } catch { return String(value || "").replace(/[?#].*$/, "").replace(/\/+$/, ""); }
};
const sourceBacked = article => article?.displayEligible !== false
  && article?.summaryMode === "source-content-extractive"
  && article?.provenance?.status === "source-backed"
  && /^https?:\/\//.test(String(article?.url || ""));
const escaped = value => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const nameRegex = name => {
  const simple = String(name || "").replace(/\s*\(.*\)\s*$/, "").trim();
  return simple ? new RegExp(`\\b${escaped(simple)}\\b`, "i") : null;
};
const localizedTitle = article => first(article?.titleKo, article?.localization?.title, article?.titleEn, article?.title);
const localizedLines = article => {
  const lines = article?.summaryLinesKo || article?.localization?.summaryLines || article?.summaryLinesEn || [];
  return Array.isArray(lines) ? lines.map(clean).filter(Boolean) : [];
};
const englishLines = article => {
  const lines = article?.summaryLinesEn || String(article?.summary || "").split("\n");
  return Array.isArray(lines) ? lines.map(clean).filter(Boolean) : [];
};

const quoteCandidates = (article, leaders) => {
  const paragraphs = article?.sourceContent?.paragraphs || [];
  const rows = [];
  for (const paragraph of paragraphs.slice(0, 28)) {
    const hits = [...String(paragraph).matchAll(/[“"]([^"”]{24,420})[”"]/g)];
    for (const hit of hits) {
      const speaker = (leaders || []).find(person => clean(paragraph).toLowerCase().includes(clean(person.name).toLowerCase()));
      if (!speaker) continue;
      rows.push({
        speaker: speaker.name,
        role: speaker.role || "",
        quoteOriginal: clean(hit[1]),
        evidenceUrl: article.url,
        source: article.source || "",
        date: article.date || "",
      });
    }
  }
  return rows.slice(0, 3);
};

const evidenceFor = (name, allArticles, leaders) => {
  const re = nameRegex(name);
  const direct = allArticles.filter(article => sourceBacked(article) && article.co === name);
  const matched = re
    ? allArticles.filter(article => sourceBacked(article)
      && re.test(`${article.title || ""} ${article.summary || ""} ${article.co || ""}`))
    : [];
  const seen = new Set();
  const combined = [...direct, ...matched]
    .filter(article => {
      const key = canon(article.url);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 6);
  return combined.map((article, index) => ({
    id: `e${index + 1}`,
    date: article.date || "",
    source: article.source || "",
    url: article.url,
    titleKo: clip(localizedTitle(article), 180),
    titleOriginal: clip(article.titleEn || article.title, 180),
    linesKo: localizedLines(article).slice(0, 3).map(line => clip(line, 260)),
    linesOriginal: englishLines(article).slice(0, 3).map(line => clip(line, 260)),
    quotes: quoteCandidates(article, leaders),
  }));
};

const evidenceRefs = (ids, evidence) => {
  const wanted = new Set(Array.isArray(ids) ? ids.map(String) : []);
  return evidence.filter(item => wanted.has(item.id))
    .map(item => ({ title: item.titleKo || item.titleOriginal, source: item.source, date: item.date, url: item.url }));
};
const allRefs = evidence => evidence.slice(0, 3)
  .map(item => ({ title: item.titleKo || item.titleOriginal, source: item.source, date: item.date, url: item.url }));

const normaliseAnalysis = (analysis, evidence, fallback) => {
  const section = (value, base) => ({
    summary: clip(value?.summary || base.summary, 360),
    details: (Array.isArray(value?.details) ? value.details : base.details || []).map(item => clip(item, 220)).filter(Boolean).slice(0, 4),
    evidence: evidenceRefs(value?.evidenceIds, evidence).length
      ? evidenceRefs(value.evidenceIds, evidence)
      : base.evidence,
  });
  const quoteIndex = new Map(evidence.flatMap(item => (item.quotes || []).map(quote => [`${item.id}|${quote.speaker}|${quote.quoteOriginal}`, { ...quote, evidenceId: item.id }])));
  const executiveQuotes = (analysis?.executiveQuotes || []).map(item => {
    const match = [...quoteIndex.values()].find(candidate => candidate.evidenceId === item.evidenceId
      && clean(candidate.quoteOriginal) === clean(item.quoteOriginal));
    if (!match || !clean(item.quoteKo)) return null;
    return { ...match, quoteKo: clip(item.quoteKo, 520) };
  }).filter(Boolean).slice(0, 4);
  const corePractices = (analysis?.corePractices || []).map(item => {
    const ref = evidence.find(source => source.id === item.evidenceId);
    if (!ref || !clean(item.title)) return null;
    return {
      title: clip(item.title, 100),
      insight: clip(item.insight, 300),
      evidence: { title: ref.titleKo || ref.titleOriginal, source: ref.source, date: ref.date, url: ref.url },
    };
  }).filter(Boolean).slice(0, 4);
  const newBusinessModels = (analysis?.newBusinessModels || []).map(item => {
    const ref = evidence.find(source => source.id === item.evidenceId);
    if (!ref || !clean(item.title)) return null;
    return {
      title: clip(item.title, 120),
      model: clip(item.model, 300),
      implication: clip(item.implication, 300),
      evidence: { title: ref.titleKo || ref.titleOriginal, source: ref.source, date: ref.date, url: ref.url },
    };
  }).filter(Boolean).slice(0, 3);
  return {
    currentBusiness: section(analysis?.currentBusiness, fallback.currentBusiness),
    revenueModel: section(analysis?.revenueModel, fallback.revenueModel),
    strategyDirection: section(analysis?.strategyDirection, fallback.strategyDirection),
    investmentDirection: section(analysis?.investmentDirection, fallback.investmentDirection),
    corePractices: corePractices.length ? corePractices : fallback.corePractices,
    newBusinessModels: newBusinessModels.length ? newBusinessModels : fallback.newBusinessModels,
    executiveQuotes: executiveQuotes.length ? executiveQuotes : fallback.executiveQuotes,
  };
};

const fallbackIntelligence = ({ base, rec, monet, evidence, modelLabels, directionLabels }) => {
  const profile = rec.profile || {};
  const revenueSignals = monet?.monetize || [];
  const directionSignals = monet?.direction || [];
  const primaryModel = modelLabels.get(monet?.primaryModel);
  const currentBusiness = (profile.business || []).join(" · ") || base?.unit || localizedTitle(rec.latest) || "사업 원문 수집 중";
  const revenueSummary = primaryModel
    ? `${primaryModel} 중심 · ${clip(first(base?.vp, revenueSignals[0]?.signal, "최신 과금 구조 근거를 수집 중"), 220)}`
    : first(revenueSignals[0]?.signal, base?.vp, "공개 원문에서 수익 구조를 수집 중");
  const strategySummary = first(base?.direction, directionSignals[0]?.signal, evidence[0]?.titleKo, "최신 사업 방향 원문을 수집 중");
  const investSignal = directionSignals.find(signal => ["ma", "invest", "partner"].includes(signal.kind)) || directionSignals[0];
  const investmentSummary = investSignal
    ? `${directionLabels.get(investSignal.kind) || "사업 확장"} · ${clip(investSignal.signal, 220)}`
    : "투자·제휴·인수 관련 공식 발표를 수집 중";
  const refs = allRefs(evidence);
  return {
    currentBusiness: { summary: clip(currentBusiness, 360), details: (profile.business || []).slice(0, 4), evidence: refs.slice(0, 1) },
    revenueModel: {
      summary: clip(revenueSummary, 360),
      details: revenueSignals.slice(0, 3).map(signal => clip(signal.signal, 220)),
      evidence: revenueSignals.slice(0, 3).map(signal => ({ title: signal.signal, source: signal.source, date: signal.date, url: signal.url })),
    },
    strategyDirection: {
      summary: clip(strategySummary, 360),
      details: directionSignals.slice(0, 3).map(signal => clip(signal.signal, 220)),
      evidence: directionSignals.slice(0, 3).map(signal => ({ title: signal.signal, source: signal.source, date: signal.date, url: signal.url })),
    },
    investmentDirection: {
      summary: clip(investmentSummary, 360),
      details: directionSignals.filter(signal => ["ma", "invest", "partner"].includes(signal.kind)).slice(0, 3).map(signal => clip(signal.signal, 220)),
      evidence: investSignal ? [{ title: investSignal.signal, source: investSignal.source, date: investSignal.date, url: investSignal.url }] : [],
    },
    corePractices: evidence.slice(0, 4).map(item => ({
      title: item.titleKo || item.titleOriginal,
      insight: item.linesKo[1] || item.linesKo[0] || item.linesOriginal[0] || item.titleKo,
      evidence: { title: item.titleKo || item.titleOriginal, source: item.source, date: item.date, url: item.url },
    })),
    newBusinessModels: revenueSignals.slice(0, 2).map(signal => ({
      title: modelLabels.get(signal.model) || "신규 수익화",
      model: clip(signal.signal, 300),
      implication: "제품·서비스·배포 방식의 변화가 반복 매출과 고객 접점을 확장하는지 추적",
      evidence: { title: signal.signal, source: signal.source, date: signal.date, url: signal.url },
    })),
    executiveQuotes: [],
  };
};

async function synthesizeBatch(inputs) {
  const schema = {
    type: "object",
    properties: {
      companies: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            currentBusiness: { type: "object", properties: { summary: { type: "string" }, details: { type: "array", items: { type: "string" } }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["summary", "details", "evidenceIds"], additionalProperties: false },
            revenueModel: { type: "object", properties: { summary: { type: "string" }, details: { type: "array", items: { type: "string" } }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["summary", "details", "evidenceIds"], additionalProperties: false },
            strategyDirection: { type: "object", properties: { summary: { type: "string" }, details: { type: "array", items: { type: "string" } }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["summary", "details", "evidenceIds"], additionalProperties: false },
            investmentDirection: { type: "object", properties: { summary: { type: "string" }, details: { type: "array", items: { type: "string" } }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["summary", "details", "evidenceIds"], additionalProperties: false },
            corePractices: { type: "array", items: { type: "object", properties: { title: { type: "string" }, insight: { type: "string" }, evidenceId: { type: "string" } }, required: ["title", "insight", "evidenceId"], additionalProperties: false } },
            newBusinessModels: { type: "array", items: { type: "object", properties: { title: { type: "string" }, model: { type: "string" }, implication: { type: "string" }, evidenceId: { type: "string" } }, required: ["title", "model", "implication", "evidenceId"], additionalProperties: false } },
            executiveQuotes: { type: "array", items: { type: "object", properties: { speaker: { type: "string" }, quoteOriginal: { type: "string" }, quoteKo: { type: "string" }, evidenceId: { type: "string" } }, required: ["speaker", "quoteOriginal", "quoteKo", "evidenceId"], additionalProperties: false } },
          },
          required: ["name", "currentBusiness", "revenueModel", "strategyDirection", "investmentDirection", "corePractices", "newBusinessModels", "executiveQuotes"],
          additionalProperties: false,
        },
      },
    },
    required: ["companies"],
    additionalProperties: false,
  };
  return llmJSON({
    system: [
      "당신은 통신·스마트폰 사업자를 위한 기업전략 애널리스트다.",
      "입력된 company profile, monetization signals, publisher evidence만 사용해 회사별 현재 사업, 수익모델, 향후 사업·투자 방향, 핵심 실행, 신규 비즈니스 모델을 한국어로 구체적으로 종합한다.",
      "포트폴리오 옵션, 신호 감시, 우선순위 같은 일반론을 쓰지 않는다.",
      "근거가 없는 수치·인물·인과를 만들지 않는다. 각 판단은 입력 evidence id를 연결한다.",
      "executiveQuotes는 candidates에 있는 영문 원문을 단 한 글자도 바꾸지 말고 한국어 번역을 함께 제공한다. candidate가 없으면 빈 배열이다.",
      "문장은 짧은 컨설팅 보고서 문체로 쓴다.",
    ].join(" "),
    user: `다음 기업 묶음을 분석해 JSON으로 반환:\n${JSON.stringify(inputs)}`,
    maxTokens: 7_500,
    schema,
  });
}

async function main() {
  const [companyData, newsData, monetData, ventures] = await Promise.all([
    readJson("companies.json", { companies: {} }),
    readJson("news.json", { articles: [] }),
    readJson("monetization.json", { companies: [], models: [], directions: [] }),
    readJson("strategic-ventures.json", { companies: {} }),
  ]);
  const dash = loadDash();
  const bases = new Map((dash.COMPANIES || []).map(company => [company.name, company]));
  const monetByName = new Map((monetData.companies || []).map(company => [company.name, company]));
  const modelLabels = new Map((monetData.models || []).map(model => [model.id, model.ko]));
  const directionLabels = new Map((monetData.directions || []).map(direction => [direction.id, direction.ko]));
  const prepared = [];
  const engine = llmAvailable();
  const maxAiAgeDays = Math.max(0.25, Number(process.env.COMPANY_INTELLIGENCE_MAX_AGE_DAYS || 0.8));
  const ageDays = value => {
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 86_400_000) : 999;
  };

  for (const [name, rec] of Object.entries(companyData.companies || {})) {
    const leaders = rec.organization?.leadership || [];
    const evidence = evidenceFor(name, newsData.articles || [], leaders);
    const monet = monetByName.get(name) || null;
    const fallback = fallbackIntelligence({
      base: bases.get(name),
      rec,
      monet,
      evidence,
      modelLabels,
      directionLabels,
    });
    const priorAi = rec.intelligence?.engine?.startsWith("github-models:") ? rec.intelligence : null;
    const refreshAi = !!engine && (!priorAi || ageDays(priorAi.generatedAt) >= maxAiAgeDays);
    rec.intelligence = priorAi || {
        generatedAt: new Date().toISOString(),
        engine: "source-extractive-synthesis",
        evidenceWindow: "최신 원문 6건 + 누적 수익화·사업 방향 원장",
        ...fallback,
      };
    rec.strategicVentures = ventures.companies?.[name] || [];
    if (rec.strategicVentures.length && ventures.comparison) rec.strategicVentureComparison = ventures.comparison;
    if (!refreshAi) continue;
    prepared.push({
      name,
      profile: {
        founded: rec.profile?.founded || "",
        headquarters: rec.profile?.hq || "",
        headcount: rec.profile?.headcount || rec.employees || "",
        business: rec.profile?.business || [],
      },
      leadership: leaders.slice(0, 10).map(person => ({
        name: person.name, role: person.role, education: person.edu || "", career: person.career || person.bg || "",
      })),
      monetization: {
        primaryModel: modelLabels.get(monet?.primaryModel) || "",
        revenueSignals: (monet?.monetize || []).slice(0, 4),
        directionSignals: (monet?.direction || []).slice(0, 4),
      },
      evidence,
      quoteCandidates: evidence.flatMap(item => item.quotes.map(quote => ({ ...quote, evidenceId: item.id }))).slice(0, 6),
      _rec: rec,
      _fallback: fallback,
      _priorAi: priorAi,
    });
  }

  if (engine) {
    // GitHub Models gpt-4.1 currently enforces an 8k request-body limit.
    // Evidence-heavy major companies can exceed it even in groups of three.
    // Analyse one company per request so all companies receive equal depth.
    const batchSize = 1;
    for (let start = 0; start < prepared.length; start += batchSize) {
      const batch = prepared.slice(start, start + batchSize);
      const publicInput = batch.map(({ _rec, _fallback, _priorAi, ...value }) => value);
      const result = await synthesizeBatch(publicInput);
      const byName = new Map((result?.data?.companies || []).map(company => [company.name, company]));
      for (const item of batch) {
        const analysis = byName.get(item.name);
        if (!analysis) continue;
        item._rec.intelligence = {
          generatedAt: new Date().toISOString(),
          engine: result.engine,
          evidenceWindow: "최신 원문 6건 + 누적 수익화·사업 방향 원장",
          ...normaliseAnalysis(analysis, item.evidence, item._fallback),
        };
      }
      console.log(`[company-intelligence] batch ${Math.floor(start / batchSize) + 1}/${Math.ceil(prepared.length / batchSize)} · ${result ? result.engine : "extractive fallback"}`);
    }
  }

  companyData.schemaVersion = 4;
  companyData.generatedAt = new Date().toISOString();
  companyData.methodology = "normalized-profile+live-financials+verified-linkedin+publisher-evidence+ai-source-synthesis";
  await writeFile("companies.json", `${JSON.stringify(companyData)}\n`);
  const aiCount = Object.values(companyData.companies || {}).filter(company => company.intelligence?.engine?.startsWith("github-models:")).length;
  const total = Object.keys(companyData.companies || {}).length;
  console.log(`[company-intelligence] wrote ${total} companies · AI ${aiCount} · extractive ${total - aiCount} · refreshed ${prepared.length}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
