import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { dirname, extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");
const HOST = "127.0.0.1";
const PORT = Number(process.env.SITE_CODEX_PORT || 4510);
const CODEX_ENTRY = join(ROOT, "node_modules", "@openai", "codex", "bin", "codex.js");
const MAX_BODY = 48 * 1024;
const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
};

let activeRun = null;

function runCodexSync(args, timeout = 20_000) {
  if (!existsSync(CODEX_ENTRY)) return { ok: false, text: "Codex CLI 미설치" };
  const result = spawnSync(process.execPath, [CODEX_ENTRY, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout,
    windowsHide: true,
    env: { ...process.env, NO_COLOR: "1" },
  });
  const text = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  return { ok: result.status === 0, status: result.status, text };
}

function codexStatus() {
  const versionResult = runCodexSync(["--version"]);
  const loginResult = runCodexSync(["login", "status"]);
  const version = versionResult.text.match(/codex-cli\s+([^\s]+)/i)?.[1] || "미확인";
  const authenticated = loginResult.ok && /logged in|로그인/i.test(loginResult.text);
  return {
    ready: Boolean(versionResult.ok && authenticated),
    installed: versionResult.ok,
    authenticated,
    version,
    root: ROOT,
    transport: `http://${HOST}:${PORT}`,
    execution: "codex exec",
  };
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "Cross-Origin-Resource-Policy": "same-origin",
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("요청 크기 초과");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function sse(res, payload) {
  if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function taskPrompt(prompt, mode) {
  const shared = [
    "AI Intelligence 대시보드 전용 Codex 작업",
    `작업 루트 ${ROOT}`,
    "사이트 파일과 데이터에서 근거를 확인",
    "확인되지 않은 수치 날짜 인물 거래 생성 금지",
    "한국어 개조식으로 핵심 결론 근거 실행 결과 순서 구성",
    "마침표와 장황한 문장형 종결 최소화",
  ];
  if (mode === "edit") {
    shared.push(
      "사용자가 이번 요청의 실제 파일 수정을 명시적으로 승인",
      "요청 범위 안에서 파일 수정과 필요한 검증 실행",
      "기존 사용자 변경 보존",
      "git commit push 배포 금지",
      "완료 후 변경 파일 검증 결과 남은 제약만 요약",
    );
  } else {
    shared.push(
      "읽기 전용 분석",
      "파일 수정 명령 실행 금지",
      "질문에 직접 답변하고 확인한 파일 또는 데이터 근거 제시",
    );
  }
  return `${shared.map(item => `- ${item}`).join("\n")}\n\n사용자 요청\n${prompt}`;
}

function eventFromCodex(event) {
  if (event.type === "thread.started") return { type: "status", text: "Codex 작업 세션 시작", threadId: event.thread_id };
  if (event.type === "turn.started") return { type: "status", text: "저장소 분석 시작" };
  if (event.type === "item.started" && event.item?.type === "command_execution") {
    return { type: "tool", text: event.item.command || "검증 명령 실행" };
  }
  if (event.type === "item.completed" && event.item?.type === "command_execution") {
    return { type: "tool", text: event.item.command || "검증 명령 완료", exitCode: event.item.exit_code };
  }
  if (event.type === "item.completed" && event.item?.type === "agent_message") {
    return { type: "message", text: event.item.text || "" };
  }
  if (event.type === "turn.completed") return { type: "done", usage: event.usage || {} };
  if (event.type === "turn.failed") return { type: "error", message: event.error?.message || "Codex 실행 실패" };
  return null;
}

async function runCodex(req, res) {
  if (activeRun) return json(res, 409, { error: "다른 Codex 작업 실행 중" });
  let body;
  if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")) return json(res, 415, { error: "JSON 요청만 허용" });
  try { body = await readJson(req); } catch (error) { return json(res, 400, { error: error.message }); }
  const prompt = String(body.prompt || "").trim();
  const mode = body.mode === "edit" ? "edit" : "ask";
  if (!prompt) return json(res, 400, { error: "요청 내용 필요" });
  if (mode === "edit" && body.confirm !== "APPLY") return json(res, 403, { error: "실제 파일 수정 승인 필요" });
  const status = codexStatus();
  if (!status.ready) return json(res, 503, { error: status.installed ? "Codex 로그인 필요" : "Codex CLI 설치 필요", status });

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Cross-Origin-Resource-Policy": "same-origin",
  });
  sse(res, { type: "status", text: mode === "edit" ? "실제 파일 수정 승인 확인" : "읽기 전용 질의 시작" });

  const args = [
    CODEX_ENTRY,
    "--ask-for-approval", "never",
    "exec",
    "--json",
    "--ephemeral",
    "--ignore-user-config",
    "--sandbox", mode === "edit" ? "workspace-write" : "read-only",
    "--cd", ROOT,
    "-",
  ];
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    env: { ...process.env, NO_COLOR: "1", TERM: "dumb" },
  });
  activeRun = child;
  let stderr = "";
  let sawDone = false;

  const lines = readline.createInterface({ input: child.stdout });
  lines.on("line", line => {
    try {
      const mapped = eventFromCodex(JSON.parse(line));
      if (mapped) {
        if (mapped.type === "done") sawDone = true;
        sse(res, mapped);
      }
    } catch {
      if (line.trim()) sse(res, { type: "status", text: line.trim().slice(0, 300) });
    }
  });
  child.stderr.on("data", chunk => { stderr = `${stderr}${chunk}`.slice(-5000); });
  child.stdin.end(taskPrompt(prompt, mode), "utf8");

  const stop = () => {
    if (child.exitCode == null && !child.killed) child.kill();
  };
  req.once("aborted", stop);
  res.once("close", () => { if (!res.writableEnded) stop(); });
  child.once("error", error => {
    activeRun = null;
    sse(res, { type: "error", message: error.message });
    res.end();
  });
  child.once("close", code => {
    activeRun = null;
    if (code !== 0 && !sawDone) {
      const clean = stderr.split(/\r?\n/).filter(line => !/WARN|shell snapshot|rmcp|AuthRequired/i.test(line)).join(" ").trim();
      sse(res, { type: "error", message: clean.slice(0, 800) || `Codex 종료 코드 ${code}` });
    } else if (!sawDone) {
      sse(res, { type: "done", usage: {} });
    }
    res.end();
  });
}

function staticFile(req, res, pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  if (!relative || relative.startsWith(".") || /(^|[\\/])(node_modules|scripts|config|\.git)([\\/]|$)/i.test(relative)) {
    return json(res, 404, { error: "경로 없음" });
  }
  const file = normalize(resolve(ROOT, relative));
  const fromRoot = relative(ROOT, file);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) return json(res, 403, { error: "경로 차단" });
  if (!existsSync(file) || !statSync(file).isFile()) return json(res, 404, { error: "파일 없음" });
  const type = MIME[extname(file).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": extname(file) === ".html" ? "no-store" : "public, max-age=60",
    "Cross-Origin-Resource-Policy": "same-origin",
  });
  createReadStream(file).pipe(res);
}

function trustedLocalRequest(req) {
  const host = String(req.headers.host || "").toLowerCase();
  const allowedHosts = new Set([`${HOST}:${PORT}`, `localhost:${PORT}`]);
  if (!allowedHosts.has(host)) return false;
  const origin = String(req.headers.origin || "").toLowerCase();
  if (!origin) return true;
  return origin === `http://${HOST}:${PORT}` || origin === `http://localhost:${PORT}`;
}

const server = createServer(async (req, res) => {
  if (!trustedLocalRequest(req)) return json(res, 403, { error: "로컬 동일 출처 요청만 허용" });
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  if (req.method === "GET" && url.pathname === "/api/codex/status") return json(res, 200, codexStatus());
  if (req.method === "GET" && url.pathname === "/healthz") return json(res, 200, { ok: true, active: Boolean(activeRun) });
  if (req.method === "POST" && url.pathname === "/api/codex/run") return runCodex(req, res);
  if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "허용되지 않은 요청" });
  return staticFile(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
  const status = codexStatus();
  console.log("");
  console.log("SITE CODEX BRIDGE");
  console.log(`URL       http://${HOST}:${PORT}`);
  console.log(`CODEX     ${status.installed ? status.version : "미설치"}`);
  console.log(`LOGIN     ${status.authenticated ? "READY" : "필요"}`);
  console.log(`WORKSPACE ${ROOT}`);
  console.log("");
  console.log("종료  Ctrl+C");
});

process.on("SIGINT", () => {
  if (activeRun?.exitCode == null) activeRun.kill();
  server.close(() => process.exit(0));
});
