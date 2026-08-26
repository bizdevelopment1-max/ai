#!/usr/bin/env node
import { spawn } from "node:child_process";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const modeArg = process.argv.find(value => value.startsWith("--mode="));
const mode = modeArg ? modeArg.split("=")[1] : "full";
const dryRun = process.argv.includes("--dry-run");
const validModes = new Set(["full", "recovery", "publish"]);
if (!validModes.has(mode)) throw new Error(`Unsupported update mode: ${mode}`);

const node = script => ({ command: process.execPath, args: [script] });
const retry = script => node("scripts/run-with-retry.mjs").args.concat(script);
const retryStep = (id, script, options = {}) => ({ id, command: process.execPath, args: retry(script), ...options });
const nodeStep = (id, script, args = [], options = {}) => ({ id, command: process.execPath, args: [script, ...args], ...options });
const pythonStep = (id, script) => ({ id, command: process.platform === "win32" ? "python" : "python3", args: [script] });

const commonPublish = [
  nodeStep("normalize-final", "scripts/normalize-temporal-fields.mjs"),
  retryStep("verify-evidence", "scripts/verify-pipeline.mjs"),
  retryStep("rebuild-decisions", "scripts/build-mobile-ai-business-db.mjs"),
  nodeStep("build-intelligence-tracks", "scripts/build-intelligence-tracks.mjs"),
  nodeStep("validate-intelligence-tracks", "scripts/validate-intelligence-tracks.mjs"),
  nodeStep("validate-decisions", "scripts/validate-mx-intelligence.mjs"),
  retryStep("audit", "scripts/audit-agent.mjs"),
  nodeStep("minimize-source-content", "scripts/minimize-retained-source-content.mjs"),
  nodeStep("focus-gate", "scripts/prune-retired-focus.mjs"),
  retryStep("materialize-public-views", "scripts/build-public-data.mjs"),
  nodeStep("source-compliance", "scripts/build-source-compliance-catalog.mjs"),
  nodeStep("dataset-lineage", "scripts/build-dataset-manifest.mjs"),
  nodeStep("service-level-report", "scripts/build-slo-report.mjs"),
  nodeStep("immutable-archive", "scripts/archive-immutable-snapshot.mjs"),
  nodeStep("validate-publish-contracts", "scripts/validate-data-contracts.mjs", ["--stage=publish"]),
  nodeStep("validate-publication-policy", "scripts/validate-publication-policy.mjs"),
  nodeStep("calibrate-dedup", "scripts/calibrate-dedup-threshold.mjs"),
  nodeStep("validate-boundaries", "scripts/validate-data-boundaries.mjs"),
  nodeStep("validate-dag", "scripts/validate-pipeline-dag.mjs"),
  nodeStep("validate-consulting-architecture", "scripts/validate-consulting-architecture.mjs"),
  nodeStep("validate-nvidia-investments", "scripts/validate-nvidia-investments.mjs"),
  nodeStep("validate-content-registry", "scripts/validate-site-content.mjs"),
  nodeStep("test-data-platform", "scripts/test-data-platform.mjs"),
  nodeStep("build-browser-bundles", "scripts/build-browser-bundle.mjs"),
  nodeStep("audit-content-lifecycle", "scripts/audit-content-lifecycle.mjs"),
  nodeStep("validate-delivery-performance", "scripts/validate-delivery-performance.mjs"),
  retryStep("test-automation", "scripts/test-automation.mjs"),
  nodeStep("test-readability", "scripts/test-visual-readability.mjs"),
];

const ingest = [
  nodeStep("normalize-ingest", "scripts/normalize-temporal-fields.mjs"),
  nodeStep("validate-ingest-contracts", "scripts/validate-data-contracts.mjs", ["--stage=ingest"]),
  retryStep("collect-direct-sources", "scripts/collect-source-registry.mjs"),
  retryStep("crawl-news", "scripts/crawl-news.mjs"),
  nodeStep("focus-before-analysis", "scripts/prune-retired-focus.mjs"),
];

const full = [
  ...ingest,
  retryStep("crawl-stocks", "scripts/crawl-stocks.mjs"),
  retryStep("crawl-financials", "scripts/crawl-financials.mjs"),
  retryStep("stock-events", "scripts/crawl-stock-events.mjs"),
  retryStep("briefing", "scripts/generate-briefing.mjs"),
  retryStep("startup-radar", "scripts/startup-radar.mjs"),
  retryStep("insights", "scripts/build-insights.mjs"),
  retryStep("research", "scripts/crawl-research.mjs"),
  retryStep("markets", "scripts/crawl-markets.mjs"),
  nodeStep("refresh-source-content", "scripts/refresh-source-content.mjs", [], { env: { SOURCE_REFRESH_LIMIT: "45", SOURCE_REFRESH_CONCURRENCY: "4" } }),
  nodeStep("refresh-market-content", "scripts/refresh-market-source-content.mjs", [], { env: { MARKET_SOURCE_REFRESH_LIMIT: "150", MARKET_SOURCE_REFRESH_CONCURRENCY: "4" } }),
  nodeStep("reframe-source-briefs", "scripts/reframe-source-briefs.mjs"),
  retryStep("a16z-startups", "scripts/crawl-a16z-startups.mjs"),
  retryStep("startup-profiles", "scripts/crawl-startups.mjs"),
  retryStep("startup-organizations", "scripts/crawl-startup-organizations.mjs", { env: { STARTUP_ORG_REFRESH_BUDGET: "36", STARTUP_ORG_MAX_AGE_DAYS: "21", STARTUP_ORG_CONCURRENCY: "6" } }),
  pythonStep("localize-source-sentences", "scripts/translate_summarize.py"),
  retryStep("company-officials", "scripts/crawl-company-officials.mjs"),
  retryStep("company-profiles", "scripts/crawl-companies.mjs"),
  retryStep("technology-signals", "scripts/crawl-infra.mjs"),
  retryStep("monetization", "scripts/crawl-monetization.mjs"),
  retryStep("initial-decisions", "scripts/build-mobile-ai-business-db.mjs"),
  nodeStep("focus-after-ingest", "scripts/prune-retired-focus.mjs"),
  nodeStep("company-registry", "scripts/normalize-company-registry.mjs"),
  retryStep("strategic-ventures", "scripts/crawl-strategic-ventures.mjs"),
  retryStep("company-intelligence", "scripts/build-company-intelligence.mjs", { env: { PIPELINE_TIMEOUT_MS: "1200000", GITHUB_MODELS_MAX_RETRY_WAIT_MS: "20000", COMPANY_INTELLIGENCE_AI_BUDGET: "6" } }),
  retryStep("company-news-index", "scripts/build-company-news.mjs"),
  retryStep("investment-map", "scripts/build-nvidia-investments.mjs"),
  ...commonPublish,
];

const recovery = [
  ...ingest,
  retryStep("markets", "scripts/crawl-markets.mjs"),
  nodeStep("refresh-source-content", "scripts/refresh-source-content.mjs", [], { env: { SOURCE_REFRESH_LIMIT: "30", SOURCE_REFRESH_CONCURRENCY: "4" } }),
  nodeStep("refresh-market-content", "scripts/refresh-market-source-content.mjs", [], { env: { MARKET_SOURCE_REFRESH_LIMIT: "90", MARKET_SOURCE_REFRESH_CONCURRENCY: "4" } }),
  pythonStep("localize-source-sentences", "scripts/translate_summarize.py"),
  retryStep("insights", "scripts/build-insights.mjs"),
  retryStep("briefing", "scripts/generate-briefing.mjs"),
  retryStep("company-news-index", "scripts/build-company-news.mjs"),
  retryStep("monetization", "scripts/crawl-monetization.mjs"),
  retryStep("initial-decisions", "scripts/build-mobile-ai-business-db.mjs"),
  nodeStep("focus-after-ingest", "scripts/prune-retired-focus.mjs"),
  nodeStep("company-registry", "scripts/normalize-company-registry.mjs"),
  retryStep("investment-map", "scripts/build-nvidia-investments.mjs"),
  ...commonPublish,
];

const steps = mode === "full" ? full : mode === "recovery" ? recovery : commonPublish;
const startedAt = new Date().toISOString();
const report = { schemaVersion: 1, mode, dryRun, startedAt, completedAt: null, status: "running", stages: [] };

const persist = async () => writeFile(resolve(root, "automation-status.json"), `${JSON.stringify(report, null, 2)}\n`);
const run = step => new Promise((resolveRun, rejectRun) => {
  const started = Date.now();
  console.log(`\n[site-update] START ${step.id}`);
  if (dryRun) {
    report.stages.push({ id: step.id, status: "planned", command: [step.command, ...step.args].join(" ") });
    resolveRun();
    return;
  }
  const child = spawn(step.command, step.args, {
    cwd: root,
    env: { ...process.env, ...(step.env || {}) },
    stdio: "inherit",
    shell: false,
  });
  child.on("error", rejectRun);
  child.on("exit", code => {
    const durationMs = Date.now() - started;
    report.stages.push({ id: step.id, status: code === 0 ? "completed" : "failed", durationMs, exitCode: code });
    if (code === 0) resolveRun();
    else rejectRun(new Error(`${step.id} exited with code ${code}`));
  });
});

try {
  for (const step of steps) {
    await run(step);
    await persist();
  }
  report.status = dryRun ? "planned" : "completed";
} catch (error) {
  report.status = "failed";
  report.error = error.message;
  throw error;
} finally {
  report.completedAt = new Date().toISOString();
  await persist();
  if (!dryRun) {
    const month = report.completedAt.slice(0, 7);
    const ledgerDir = resolve(root, "source-ledger");
    await mkdir(ledgerDir, { recursive: true });
    await appendFile(resolve(ledgerDir, `pipeline-runs-${month}.jsonl`), `${JSON.stringify(report)}\n`);
  }
  console.log(`\n[site-update] ${report.status.toUpperCase()} ${mode} · ${report.stages.length} stages`);
}
