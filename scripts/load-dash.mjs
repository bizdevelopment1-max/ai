/* Private identity, taxonomy and framework-schema loader.
   Mutable facts remain in cumulative generated JSON ledgers only. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

let cached = null;

export function loadDash() {
  if (cached) return cached;
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  cached = JSON.parse(readFileSync(resolve(root, "config/dashboard-taxonomy.json"), "utf8"));
  return cached;
}
