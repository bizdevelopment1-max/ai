/* ============================================================
   anim.jsx — scroll-triggered animation primitives (v2)
   Every animated unit (number, gauge, trend bar, chart) owns
   its OWN eye-level IntersectionObserver. It counts up from 0
   when it reaches the viewer's eye level, and RESETS so it
   replays every time you scroll it away and back.
   ============================================================ */
const { useState: useStateA, useRef: useRefA, useEffect: useEffectA, useContext: useCtxA, createContext: createCtxA } = React;

const AnimCtx = createCtxA(false); // legacy fallback context

// 애니메이션 비활성화 — 등장 리빌·카운트업·차트 필은 즉시 최종 상태로 렌더한다.
// 데이터 지연 로딩에 쓰이는 useInView는 모션 설정과 분리해 실제 위치를 계속 측정한다.
const REDUCED = true;

/* ============================================================
   Eye-level trigger engine (scroll-position based, NOT
   IntersectionObserver). The dashboard scrolls inside `.main`,
   and IntersectionObserver delivery proved unreliable across
   nested scroll containers in this environment — so instead we
   measure every registered element against the viewport on each
   scroll frame. A capture-phase scroll listener catches scroll
   events from ANY container (window OR `.main`), guaranteeing the
   numbers/charts reset to 0 and replay every time they re-enter
   the viewer's eye level — scrolling down AND back up.
   ============================================================ */

// Eye-level band as a fraction of the viewport height.
// An element is "active" while it overlaps this vertical band.
const EYE_TOP = 0.04;     // ignore the top 4%
const EYE_BOTTOM = 0.94;  // ignore the bottom 6%

const _watchers = new Set();
let _scanQueued = false;

function _scan() {
  _scanQueued = false;
  const vh = window.innerHeight || document.documentElement.clientHeight || 800;
  const bandTop = vh * EYE_TOP;
  const bandBottom = vh * EYE_BOTTOM;
  _watchers.forEach((w) => {
    const el = w.el;
    if (!el || !el.isConnected) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return; // not laid out yet
    // overlaps the eye-level band?
    const lead = w.lead || 0; // extra leniency (px) for large boards
    const visible = r.top < bandBottom + lead && r.bottom > bandTop - lead;
    if (visible !== w.state) { w.state = visible; w.cb(visible); }
  });
}
function _queueScan() {
  if (_scanQueued) return;
  _scanQueued = true;
  requestAnimationFrame(_scan);
}

let _engineReady = false;
function _initEngine() {
  if (_engineReady) return;
  _engineReady = true;
  // capture:true → also receives scroll from the inner `.main` scroller
  window.addEventListener("scroll", _queueScan, { passive: true, capture: true });
  window.addEventListener("resize", _queueScan, { passive: true });
  window.addEventListener("load", _queueScan);
  document.addEventListener("DOMContentLoaded", _queueScan);
  // Catch late fonts and async content without keeping the page awake every
  // 600ms for its entire lifetime.
  [120, 650, 1600].forEach(delay => setTimeout(_queueScan, delay));
  if (document.fonts?.ready) document.fonts.ready.then(_queueScan).catch(() => {});
}

function _register(el, cb, lead) {
  _initEngine();
  const w = { el, cb, state: false, lead: lead || 0 };
  _watchers.add(w);
  // run an initial measurement on the next couple frames
  _queueScan();
  requestAnimationFrame(() => requestAnimationFrame(_scan));
  return () => _watchers.delete(w);
}

const _snapCallbacks = new Set();
(function initVisSnap() {
  const snap = () => { if (document.hidden) _snapCallbacks.forEach(fn => fn()); };
  document.addEventListener("visibilitychange", snap);
  window.addEventListener("beforeprint", () => _snapCallbacks.forEach(fn => fn()));
})();

/* ---- per-element eye-level visibility (replays) ---------------- */
function useEyeLevel() {
  const ref = useRefA(null);
  const [active, setActive] = useStateA(false);
  useEffectA(() => {
    const el = ref.current;
    if (!el) return;
    if (REDUCED) { setActive(true); return; }
    return _register(el, setActive, 0);
  }, []);
  return [ref, active];
}

/* ---- board-level visibility (large sections, a bit more lenient) ---- */
function useInView(ref, lead = 1400) {
  const [inView, setInView] = useStateA(false);
  useEffectA(() => {
    const el = ref && ref.current;
    if (!el) return;
    let confirmTimer = 0;
    const update = visible => {
      clearTimeout(confirmTimer);
      if (!visible) { setInView(false); return; }
      // Async first-view data can expand the boards above this element. Confirm
      // the position after that short layout window so lower payloads are not
      // fetched because of a transient, pre-data offset.
      confirmTimer = setTimeout(() => {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight || 800;
        const sectionId = el.closest?.("[data-section]")?.dataset?.section;
        const navTarget = window.__DASH_NAV_TARGET;
        const belongsToTarget = !navTarget || !sectionId || sectionId === navTarget;
        setInView(belongsToTarget && r.top < vh * EYE_BOTTOM + lead && r.bottom > vh * EYE_TOP - lead);
      }, 60);
    };
    const unregister = _register(el, update, lead);
    return () => { clearTimeout(confirmTimer); unregister(); };
  }, [lead]);
  return inView;
}

/* ---- eased 0→1 progress, restarts whenever `active`/`replayKey` flip ---- */
function useProgress(active, dur, delay, replayKey) {
  dur = Math.min(dur || 520, 720);
  const [p, setP] = useStateA(REDUCED ? 1 : 0);
  useEffectA(() => {
    if (!active) { setP(REDUCED ? 1 : 0); return; }
    if (REDUCED) { setP(1); return; }
    setP(0);
    let raf, start, to, done = false;
    const snapFn = () => { if (!done) { done = true; setP(1); } };
    _snapCallbacks.add(snapFn);
    const safety = setTimeout(snapFn, (delay || 0) + dur + 300);
    const run = () => {
      const step = (t) => {
        if (done) return;
        if (!start) start = t;
        const k = Math.min((t - start) / dur, 1);
        setP(1 - Math.pow(1 - k, 4)); // easeOutQuart — gentle, smooth settle
        if (k < 1) raf = requestAnimationFrame(step); else { done = true; setP(1); }
      };
      raf = requestAnimationFrame(step);
    };
    if (delay) to = setTimeout(run, delay); else run();
    return () => { cancelAnimationFrame(raf); clearTimeout(to); clearTimeout(safety); _snapCallbacks.delete(snapFn); };
  }, [active, replayKey]);
  return p;
}

function parseNum(str) {
  const m = String(str).match(/^([^\d-]*)(-?\d[\d,]*\.?\d*)(.*)$/);
  if (!m) return { ok: false, raw: String(str) };
  const numStr = m[2].replace(/,/g, "");
  const dec = (numStr.split(".")[1] || "").length;
  return { ok: true, prefix: m[1], num: parseFloat(numStr), suffix: m[3], dec, comma: m[2].indexOf(",") >= 0 };
}
function fmtNum(n, p) {
  let s = p.dec > 0 ? n.toFixed(p.dec) : Math.round(n).toString();
  if (p.comma) s = Number(s).toLocaleString();
  return p.prefix + s + p.suffix;
}

/* ---- staggered local progress: ONE useProgress per board, derive
   each item's 0→1 from it (safe with filtered lists — no hooks in loops) */
function staggerP(prog, i, n, overlap) {
  const per = 1 / Math.max(n || 1, 1);
  const t0 = Math.min(i * per * (overlap == null ? 0.6 : overlap), 0.85);
  const d = Math.max(1 - t0, 0.0001);
  return Math.max(0, Math.min((prog - t0) / d, 1));
}

/* ---- CountUp: drives the digits 0→value while `active` ---------- */
function CountUp({ value, active, dur }) {
  const ctx = useCtxA(AnimCtx);
  const on = active === undefined ? ctx : active;
  const pRef = useRefA(null);
  if (pRef.current === null || pRef.current.raw !== value) pRef.current = Object.assign(parseNum(value), { raw: value });
  const p = pRef.current;
  // First paint uses the verified value instead of a synthetic zero. This
  // removes the $0B/0% flash while retaining a short replay when motion is on.
  const [disp, setDisp] = useStateA(p.ok ? fmtNum(p.num, p) : p.raw);
  useEffectA(() => {
    if (!p.ok) { setDisp(value); return; }
    if (!on) { setDisp(fmtNum(p.num, p)); return; }
    if (REDUCED) { setDisp(fmtNum(p.num, p)); return; }
    setDisp(fmtNum(p.num * 0.72, p));
    let raf, start, done = false;
    const d = Math.min(dur || 420, 620);
    const snapFn = () => { if (!done) { done = true; setDisp(fmtNum(p.num, p)); } };
    _snapCallbacks.add(snapFn);
    const finish = setTimeout(snapFn, d + 300);
    const step = (t) => {
      if (done) return;
      if (!start) start = t;
      const k = Math.min((t - start) / d, 1);
      const e = 1 - Math.pow(1 - k, 3);
      setDisp(fmtNum(p.num * (0.72 + 0.28 * e), p));
      if (k < 1) raf = requestAnimationFrame(step); else { done = true; setDisp(fmtNum(p.num, p)); }
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); clearTimeout(finish); _snapCallbacks.delete(snapFn); };
  }, [on, value]);
  return disp;
}

/* ---- diverging ± trend bar (owns observer) --------------------- */
function TrendBar({ v, max }) {
  const [ref, active] = useEyeLevel();
  const prog = useProgress(active, 900);
  const cap = max || 25;
  if (v === 0 || v == null) return <span className="tbar" ref={ref}><span className="tbar-half neg" /><span className="tbar-half pos" /></span>;
  const up = v > 0;
  const pct = Math.min(Math.abs(v) / cap, 1) * 100 * prog;
  return (
    <span className="tbar" ref={ref}>
      <span className="tbar-half neg">{!up && <i style={{ width: pct + "%" }} />}</span>
      <span className="tbar-half pos">{up && <i style={{ width: pct + "%" }} />}</span>
    </span>
  );
}

/* ---- AnimatedNumber: each digit group counts from 0, replays ---- */
function AnimatedNumber({ value, active, className, dur }) {
  const [ref, eyeActive] = useEyeLevel();
  const on = active === undefined ? eyeActive : (active && eyeActive);
  return <span className={className} ref={ref}><CountUp value={value} active={on} dur={dur} /></span>;
}

/* ---- MiniBar gauge (owns observer) ----------------------------- */
function MiniBar({ frac, color, height, active }) {
  const [ref, eyeActive] = useEyeLevel();
  const on = active === undefined ? eyeActive : (active && eyeActive);
  const prog = useProgress(on, 1000);
  const f = frac == null ? 0 : Math.max(0, Math.min(1, frac));
  return (
    <span className="minibar" style={height ? { height } : null} ref={ref}>
      <span className="minibar-fill" style={{ width: (f * 100 * prog) + "%", background: color || "var(--accent)" }} />
    </span>
  );
}

Object.assign(window, { AnimCtx, useEyeLevel, useInView, useProgress, staggerP, parseNum, fmtNum, CountUp, TrendBar, AnimatedNumber, MiniBar });
