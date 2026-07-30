/* ============================================================
   load-dash.mjs — data.js(브라우저 IIFE)를 Node 스크립트에서 읽는 공용 로더.
   data.js는 `window.DASH = (function(){...})()` 형태의 순수 스크립트라
   window 전역만 섀임(shim)하면 그대로 실행·평가할 수 있다. crawl 스크립트가
   COMPANY_ORG·COMPANY_LAYER 등 큐레이션 데이터를 '읽기 전용'으로 참조할 때 사용
   — 하드코딩된 별도 목록을 유지하지 않고 data.js 한 곳만 갱신하면 되도록 함.
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import vm from "node:vm";

let cached = null;

export function loadDash() {
  if (cached) return cached;
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const source = readFileSync(resolve(root, "data.js"), "utf8");
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "data.js" });
  cached = sandbox.window.DASH || {};
  return cached;
}
