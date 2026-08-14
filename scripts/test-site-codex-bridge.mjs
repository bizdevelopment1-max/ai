import { spawn } from "node:child_process";

const port = 4511;
const base = `http://127.0.0.1:${port}`;
const live = process.argv.includes("--live");
const child = spawn(process.execPath, ["scripts/site-codex-bridge.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, SITE_CODEX_PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForBridge() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${base}/healthz`);
      if (response.ok) return;
    } catch { /* bridge startup */ }
    await delay(250);
  }
  throw new Error("bridge startup timeout");
}

try {
  await waitForBridge();
  const status = await fetch(`${base}/api/codex/status`).then(response => response.json());
  if (!status.installed || !status.authenticated || !status.ready) throw new Error(`codex status invalid ${JSON.stringify(status)}`);
  console.log(`OK status · codex ${status.version} · authenticated`);

  const blockedOrigin = await fetch(`${base}/api/codex/status`, { headers: { Origin: "https://example.com" } });
  if (blockedOrigin.status !== 403) throw new Error(`cross-origin request allowed ${blockedOrigin.status}`);
  const unconfirmedEdit = await fetch(`${base}/api/codex/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "edit", prompt: "파일 수정" }),
  });
  if (unconfirmedEdit.status !== 403) throw new Error(`unconfirmed edit allowed ${unconfirmedEdit.status}`);
  console.log("OK security · same-origin only · edit confirmation required");

  if (live) {
    const response = await fetch(`${base}/api/codex/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "ask", prompt: "실제 사이트 Codex 연결 검증 아래 문구만 출력 CODEX_SITE_LIVE" }),
    });
    const stream = await response.text();
    if (!response.ok || !stream.includes("CODEX_SITE_LIVE") || !stream.includes('"type":"done"')) {
      throw new Error(`live response invalid ${stream.slice(0, 1200)}`);
    }
    console.log("OK live · actual codex exec response");
  }
} finally {
  child.kill();
}
