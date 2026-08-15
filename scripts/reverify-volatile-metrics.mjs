#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const CONFIG_FILE = "config/volatile-metrics.json";
const GOVERNANCE_FILE = "config/metric-governance.json";
const AUDIT_FILE = "volatile-metrics-audit.json";
const HISTORY_FILE = "metric-history.json";
const args = new Set(process.argv.slice(2));
const fetchEnabled = args.has("--fetch");
const writeEnabled = args.has("--write");
const strict = args.has("--strict");

const readJson = async file => JSON.parse(await readFile(file, "utf8"));
const normalize = value => String(value || "")
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/\s+/g, " ")
  .trim();

const fetchText = async url => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 MX-Metric-Verifier/1.0", accept: "text/html,application/xhtml+xml" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return normalize(await response.text());
  } finally {
    clearTimeout(timeout);
  }
};

const validateMetric = (metric, governance) => {
  const issues = [];
  for (const field of ["id", "kind", "label", "region", "currency", "priceType", ...(governance.requiredTemporalFields || [])]) {
    if (metric[field] === undefined || metric[field] === null || metric[field] === "") issues.push(`missing:${field}`);
  }
  if (!(metric.values || []).length) issues.push("missing:values");
  if (!(metric.sources || []).length) issues.push("missing:sources");
  for (const source of metric.sources || []) {
    if (!source.sourceUrl) issues.push("source:missing-url");
    if (!source.evidenceSpan) issues.push("source:missing-evidence-span");
    if (!(source.requiredLiterals || []).length) issues.push("source:missing-required-literals");
  }
  const allowed = governance.volatileMetricPolicy?.[metric.kind];
  if (!allowed) issues.push(`unknown-kind:${metric.kind}`);
  return issues;
};

const verifySource = async source => {
  try {
    const text = await fetchText(source.sourceUrl);
    const missing = (source.requiredLiterals || []).filter(literal => !text.toLowerCase().includes(String(literal).toLowerCase()));
    return { sourceUrl: source.sourceUrl, status: missing.length ? "literal-missing" : "verified", missing, retrievedChars: text.length };
  } catch (error) {
    return { sourceUrl: source.sourceUrl, status: "unreachable", missing: source.requiredLiterals || [], error: error.message };
  }
};

const appendHistory = (history, metric, checkedAt) => {
  const next = structuredClone(history);
  next.generatedAt = checkedAt;
  const priorRuns = next.verificationRuns || [];
  const previous = [...priorRuns].reverse().find(run => run.metricId === metric.id);
  const currentFingerprint = JSON.stringify({ values: metric.values, announcedAt: metric.announcedAt, metricObservedAt: metric.metricObservedAt });
  const previousFingerprint = previous ? JSON.stringify({ values: previous.values, announcedAt: previous.announcedAt, metricObservedAt: previous.metricObservedAt }) : "";
  if (currentFingerprint === previousFingerprint) return next;
  next.verificationRuns = [...priorRuns, {
    checkedAt,
    metricId: metric.id,
    values: metric.values,
    announcedAt: metric.announcedAt,
    metricObservedAt: metric.metricObservedAt,
    lastVerifiedAt: metric.lastVerifiedAt,
  }].slice(-200);
  return next;
};

const main = async () => {
  const [config, governance, priorHistory] = await Promise.all([
    readJson(CONFIG_FILE),
    readJson(GOVERNANCE_FILE),
    readJson(HISTORY_FILE).catch(() => ({ schemaVersion: 1, series: [] })),
  ]);
  const checkedAt = new Date().toISOString();
  const rows = [];
  let history = priorHistory;

  for (const metric of config.metrics || []) {
    const schemaIssues = validateMetric(metric, governance);
    const sourceChecks = fetchEnabled && !schemaIssues.length
      ? await Promise.all(metric.sources.map(verifySource))
      : [];
    const verifiedSources = sourceChecks.filter(source => source.status === "verified").length;
    const status = schemaIssues.length
      ? "invalid"
      : !fetchEnabled
        ? "schema-valid"
        : verifiedSources === sourceChecks.length
          ? "verified"
          : verifiedSources
            ? "partial"
            : "unverified";
    rows.push({
      id: metric.id,
      kind: metric.kind,
      status,
      schemaIssues,
      checkedAt,
      announcedAt: metric.announcedAt,
      metricObservedAt: metric.metricObservedAt,
      observedWindow: metric.observedWindow,
      lastVerifiedAt: metric.lastVerifiedAt,
      sourceChecks,
    });
    if (writeEnabled && status === "verified") history = appendHistory(history, metric, checkedAt);
  }

  const audit = {
    generatedAt: checkedAt,
    schemaVersion: 1,
    mode: fetchEnabled ? "network-literal-verification" : "offline-schema-validation",
    summary: {
      total: rows.length,
      verified: rows.filter(row => row.status === "verified").length,
      partial: rows.filter(row => row.status === "partial").length,
      invalid: rows.filter(row => row.status === "invalid").length,
      unverified: rows.filter(row => row.status === "unverified").length,
    },
    rows,
  };
  if (writeEnabled) {
    await writeFile(AUDIT_FILE, `${JSON.stringify(audit, null, 2)}\n`);
    await writeFile(HISTORY_FILE, `${JSON.stringify(history, null, 2)}\n`);
  }
  console.log(`[volatile-metrics] ${audit.mode} · ${rows.length} metrics · ${audit.summary.verified} verified · ${audit.summary.partial} partial · ${audit.summary.invalid} invalid`);
  if (rows.some(row => row.status === "invalid") || (strict && rows.some(row => !["verified", "schema-valid"].includes(row.status)))) process.exitCode = 1;
};

main().catch(error => {
  console.error(`[volatile-metrics] ${error.stack || error.message}`);
  process.exit(1);
});
