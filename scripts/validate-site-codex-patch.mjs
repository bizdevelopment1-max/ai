#!/usr/bin/env node

import { stat, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const patchPath = resolve(process.argv[2] || "");
if (!process.argv[2]) throw new Error("patch file path required");

const info = await stat(patchPath);
if (!info.isFile() || info.size === 0) throw new Error("patch is empty");
if (info.size > 5 * 1024 * 1024) throw new Error("patch exceeds 5 MB safety limit");

const patch = await readFile(patchPath);
if (patch.includes(Buffer.from([0]))) throw new Error("patch contains an unexpected NUL byte");

const parsed = spawnSync("git", ["apply", "--numstat", patchPath], {
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
});
if (parsed.status !== 0) throw new Error(`invalid git patch: ${(parsed.stderr || "parse failed").trim()}`);

const paths = parsed.stdout.trim().split(/\r?\n/).filter(Boolean).map(line => {
  const fields = line.split("\t");
  if (fields.length < 3) throw new Error(`unrecognized patch entry: ${line}`);
  return fields.slice(2).join("\t").replace(/^"|"$/g, "").replaceAll("\\", "/");
});

if (!paths.length) throw new Error("patch has no file changes");
if (paths.length > 120) throw new Error("patch changes more than 120 files");

const blockedExact = new Set([
  ".gitmodules",
  ".npmrc",
  ".pnpmfile.cjs",
  "package-lock.json",
]);
const blockedPrefixes = [
  ".git/",
  ".github/actions/",
  ".github/workflows/",
  "node_modules/",
];
const secretLike = /(^|\/)(?:\.env(?:\.|$)|[^/]+\.(?:pem|key|p12|pfx|jks|keystore))$/i;

for (const path of paths) {
  if (!path || path.startsWith("/") || path.includes("../") || path.includes("=>") || path.includes("{") || path.includes("}")) {
    throw new Error(`unsafe or unsupported patch path: ${path}`);
  }
  if (blockedExact.has(path) || blockedPrefixes.some(prefix => path.startsWith(prefix)) || secretLike.test(path)) {
    throw new Error(`protected path cannot be changed by Site Codex: ${path}`);
  }
}

console.log(`[site-codex] validated ${paths.length} file path(s), ${info.size} bytes`);
