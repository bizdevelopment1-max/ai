#!/usr/bin/env node
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

const strict = process.argv.includes("--strict");
const configured = process.env.DATA_LAKE_ROOT;
if (!configured) {
  console.log("[immutable-store] DATA_LAKE_ROOT is not configured; manifest-only mode remains active");
  if (strict) process.exitCode = 2;
} else {
  const root = resolve(configured);
  const repository = resolve(".");
  const repositoryRelative = relative(repository, root);
  if (!isAbsolute(root) || (!repositoryRelative.startsWith("..") && !isAbsolute(repositoryRelative))) {
    throw new Error("DATA_LAKE_ROOT must resolve outside the repository");
  }
  const catalog = JSON.parse(await readFile("config/data-catalog.json", "utf8"));
  const snapshot = JSON.parse(await readFile("dataset-manifest.json", "utf8"));
  const stored = [];
  for (const dataset of (catalog.datasets || []).filter(row => row.publication === "never" && String(row.path).endsWith(".json"))) {
    try { if (!(await stat(dataset.path)).isFile()) continue; } catch { continue; }
    const bytes = await readFile(dataset.path);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const directory = resolve(root, dataset.id);
    await mkdir(directory, { recursive: true });
    const target = resolve(directory, `${hash}.json`);
    try { await stat(target); } catch { await copyFile(dataset.path, target); }
    stored.push({ dataset: dataset.id, hash, bytes: bytes.length, uri: target });
  }
  const runDirectory = resolve(root, "manifests");
  await mkdir(runDirectory, { recursive: true });
  await writeFile(resolve(runDirectory, `${snapshot.datasetVersion}.json`), `${JSON.stringify({ ...snapshot, stored }, null, 2)}\n`);
  console.log(`[immutable-store] ${stored.length} immutable datasets archived as ${snapshot.datasetVersion}`);
}
