#!/usr/bin/env node
/**
 * Runs a pipeline step with bounded retries. A step must exit non-zero to be
 * retried; this prevents a partial or failed crawl from being committed as a
 * successful refresh.
 */
import { spawn } from "node:child_process";
import { resolve, sep } from "node:path";

const [target, ...args] = process.argv.slice(2);
const attempts = Math.max(1, Math.min(4, Number(process.env.RETRY_ATTEMPTS || 3)));
const delays = [0, 2_000, 6_000, 15_000];
const scriptsRoot = resolve("scripts") + sep;
const resolvedTarget = target ? resolve(target) : "";

if (!target || !resolvedTarget.startsWith(scriptsRoot) || !resolvedTarget.endsWith(".mjs") || resolvedTarget.endsWith("run-with-retry.mjs")) {
  console.error("Usage: node scripts/run-with-retry.mjs scripts/<pipeline-step>.mjs [args]");
  process.exit(2);
}

const wait = ms => new Promise(resolveWait => setTimeout(resolveWait, ms));
let currentAttempt = 0;
const run = () => new Promise(resolveRun => {
  const child = spawn(process.execPath, [resolvedTarget, ...args], {
    stdio: "inherit",
    env: { ...process.env, PIPELINE_ATTEMPT: String(currentAttempt) },
  });
  child.once("error", () => resolveRun(1));
  child.once("exit", code => resolveRun(code ?? 1));
});

let exitCode = 1;
for (currentAttempt = 1; currentAttempt <= attempts; currentAttempt++) {
  if (currentAttempt > 1) {
    const delay = delays[currentAttempt - 1] || delays.at(-1);
    console.warn(`[retry] ${target}: retry ${currentAttempt}/${attempts} in ${delay / 1000}s`);
    await wait(delay);
  }
  exitCode = await run();
  if (exitCode === 0) {
    console.log(`[retry] ${target}: succeeded on attempt ${currentAttempt}/${attempts}`);
    process.exit(0);
  }
  console.warn(`[retry] ${target}: attempt ${currentAttempt}/${attempts} failed (exit ${exitCode})`);
}
console.error(`[retry] ${target}: failed after ${attempts} attempts`);
process.exit(exitCode || 1);
