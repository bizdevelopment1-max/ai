#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const dag = JSON.parse(await readFile("config/pipeline-dag.json", "utf8"));
const nodes = new Map((dag.nodes || []).map(node => [node.id, node]));
const errors = [];
if (nodes.size !== (dag.nodes || []).length) errors.push("node IDs must be unique");
for (const node of nodes.values()) {
  if (!(node.outputs || []).length) errors.push(`${node.id}: outputs are required`);
  for (const dependency of node.dependsOn || []) if (!nodes.has(dependency)) errors.push(`${node.id}: unknown dependency ${dependency}`);
}
const visiting = new Set();
const visited = new Set();
const visit = id => {
  if (visiting.has(id)) return errors.push(`${id}: dependency cycle detected`);
  if (visited.has(id)) return;
  visiting.add(id);
  for (const dependency of nodes.get(id)?.dependsOn || []) visit(dependency);
  visiting.delete(id);
  visited.add(id);
};
for (const id of nodes.keys()) visit(id);

if (errors.length) {
  errors.forEach(error => console.error(`[pipeline-dag] ${error}`));
  process.exit(1);
}
console.log(`[pipeline-dag] ${nodes.size} nodes are acyclic and dependency-complete`);
