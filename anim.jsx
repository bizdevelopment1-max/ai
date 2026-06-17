/* ============================================================
   anim.jsx — scroll-triggered animation primitives (v2)
   Every animated unit (number, gauge, trend bar, chart) owns
   its OWN eye-level IntersectionObserver. It counts up from 0
   when it reaches the viewer's eye level, and RESETS so it
   replays every time you scroll it away and back.
   ============================================================ */
const { useState: useStateA, useRef: useRefA, useEffect: useEffectA, useContext: useCtxA, createContext: createCtxA } = React;

const AnimCtx = createCtxA(false); // legacy fallback context

// NOTE: animation is the central, explicitly-requested feature of this
// dashboard, so we intentionally always animate — even when the OS/browser
// reports `prefers-reduced-motion: reduce`. (That setting is what was silently
// disabling every count-up and chart fill before.) Kept as a constant so the
// safety-snap paths still read cleanly.
const REDUCED = false;

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
  // periodic catch-up for layout shifts (images, fonts, async data)
  setInterval(_queueScan, 600);
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
function useInView(ref) {
  const [inView, setInView] = useStateA(false);
  useEffectA(() => {
    const el = ref && ref.current;
    if (!el) return;
    if (REDUCED) { setInView(true); return; }
    return _register(el, setInView, 40);
  }, []);
  return inView;
}

/* ---- eased 0→1 progress, restarts whenever `active`/`replayKey` flip ---- */
function useProgress(active, dur, delay, replayKey) {
  dur = dur || 1200;
  const [p, setP] = useStateA(0);
  useEffectA(() => {
    if (!active) { setP(0); return; }
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
  const [disp, setDisp] = useStateA(p.ok ? fmtNum(0, p) : p.raw);
  useEffectA(() => {
    if (!p.ok) { setDisp(value); return; }
    if (!on) { setDisp(fmtNum(0, p)); return; }
    if (REDUCED) { setDisp(fmtNum(p.num, p)); return; }
    setDisp(fmtNum(0, p));
    let raf, start, done = false;
    const d = dur || 1300;
    const snapFn = () => { if (!done) { done = true; setDisp(fmtNum(p.num, p)); } };
    _snapCallbacks.add(snapFn);
    const finish = setTimeout(snapFn, d + 300);
    const step = (t) => {
      if (done) return;
      if (!start) start = t;
      const k = Math.min((t - start) / d, 1);
      const e = 1 - Math.pow(1 - k, 3);
      setDisp(fmtNum(p.num * e, p));
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
