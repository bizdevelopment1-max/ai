/* ============================================================
   charts.jsx — lightweight animated SVG charts (no deps)
   Each chart observes its own visibility and fills 0→100,
   replaying every time it scrolls back into view.
   Labels count up alongside their chart elements.
   ============================================================ */
const { useRef: useRefC, useContext: useCtxC, useState: useStateC } = React;

// Re-fire a chart's animation as the pointer moves over it. Throttled so the
// 0→target ramp is actually visible (a fresh restart at most ~every 350ms).
function useHoverReplay() {
  const [nonce, setNonce] = useStateC(0);
  const last = useRefC(0);
  const bump = () => {
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
    if (now - last.current > 350) { last.current = now; setNonce(n => n + 1); }
  };
  return [nonce, bump];
}

// Floating description tooltip that follows the cursor (per-line / per-bar / per-segment).
// Hides on container mouseleave and on any scroll, so it can never get stuck
// when hover-replay animations unmount the element under the cursor.
function useTip() {
  const [tip, setTip] = useStateC(null);
  const show = (e, content) => setTip({ x: e.clientX, y: e.clientY, content });
  const move = (e) => setTip(t => (t ? { x: e.clientX, y: e.clientY, content: t.content } : t));
  const hide = () => setTip(null);
  React.useEffect(() => {
    if (!tip) return;
    const off = () => setTip(null);
    window.addEventListener("scroll", off, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", off, { capture: true });
  }, [tip !== null]);
  const node = tip ? (
    <div className="chart-tip" style={{
      left: Math.min(tip.x + 16, (typeof window !== "undefined" ? window.innerWidth : 1200) - 260),
      top: tip.y + 18,
    }}>{tip.content}</div>
  ) : null;
  return { show, move, hide, node };
}

// lighten a hex color toward white (for gradient stops)
function liteC(c, f) {
  if (!c || c[0] !== "#" || (c.length !== 7)) return c;
  const n = c.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  const m = x => Math.round(x + (255 - x) * f);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

function niceTicks(max, count) {
  const step = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step)));
  const norm = step / mag;
  let nice;
  if (norm < 1.5) nice = 1; else if (norm < 3) nice = 2; else if (norm < 7) nice = 5; else nice = 10;
  const tick = nice * mag;
  const ticks = [];
  for (let v = 0; v <= max + tick * 0.001; v += tick) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

// ---- Combo: market size (area+line draws L→R) + growth markers count up ---
function MarketGrowthChart({ data, accent, ink, grid, muted }) {
  const [ref, inView] = useEyeLevel();
  const [nonce, bump] = useHoverReplay();
  const tip = useTip();
  const prog = useProgress(inView, 2000, 0, nonce);

  const W = 520, H = 235, padL = 46, padR = 16, padT = 26, padB = 30;
  const iw = W - padL - padR, ih = H - padT - padB;
  const maxSize = Math.max(...data.map(d => d.size));
  const ticks = niceTicks(maxSize * 1.08, 4);
  const tMax = ticks[ticks.length - 1];
  const x = i => padL + (iw * i) / (data.length - 1);
  const y = v => padT + ih - (ih * v) / tMax;

  const linePts = data.map((d, i) => `${x(i)},${y(d.size)}`).join(" ");
  const areaPts = `${padL},${padT + ih} ${linePts} ${padL + iw},${padT + ih}`;
  const n = data.length;

  return (
    <div ref={ref} style={{ position: "relative" }} onMouseLeave={tip.hide}>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", cursor: "pointer" }}
      onMouseMove={bump} onMouseEnter={bump}>
      <defs>
        <linearGradient id="mg-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.34" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="mg-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={liteC(accent, 0.5)} />
          <stop offset="100%" stopColor={accent} />
        </linearGradient>
        <clipPath id="mg-clip"><rect x={padL} y="0" width={iw * prog} height={H} /></clipPath>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={padL + iw} y1={y(t)} y2={y(t)} stroke={grid} strokeWidth="1" />
          <text x={padL - 8} y={y(t) + 3} textAnchor="end" fontSize="10" fill={muted} style={{ fontVariantNumeric: "tabular-nums" }}>${t}B</text>
        </g>
      ))}
      <g clipPath="url(#mg-clip)">
        <polygon points={areaPts} fill="url(#mg-fill)" />
        <polyline points={linePts} fill="none" stroke="url(#mg-line)" strokeWidth="3" strokeLinejoin="round" />
      </g>
      {data.map((d, i) => {
        const frac = i / (n - 1);
        const reveal = prog >= frac - 0.001;
        const localProg = reveal ? Math.min((prog - frac) / (1 / (n - 1)), 1) : 0;
        const shownGrowth = Math.round(d.growth * (reveal ? Math.min(localProg * 3, 1) : 0));
        const shownSize = Math.round(d.size * (reveal ? Math.min(localProg * 3, 1) : 0));
        return (
          <g key={i} style={{ opacity: reveal ? 1 : 0, transition: "opacity .25s" }}>
            <title>{d.src || `${d.year}: $${d.size}B`}</title>
            <circle cx={x(i)} cy={y(d.size)} r="3.4" fill="#fff" stroke={accent} strokeWidth="2" />
            <circle cx={x(i)} cy={y(d.size)} r="12" fill="transparent" style={{ cursor: "pointer" }}
              onMouseEnter={e => tip.show(e, <span><b>{d.year}</b> · 시장규모 <b>${d.size}B</b> · 성장률 <b>{d.growth}%</b>{d.src ? <span><br /><em>{d.src}</em></span> : null}</span>)}
              onMouseMove={tip.move} onMouseLeave={tip.hide} />
            <text x={x(i)} y={y(d.size) - 11} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={ink} style={{ fontVariantNumeric: "tabular-nums" }}>{shownGrowth}%</text>
            <text x={x(i)} y={padT + ih + 18} textAnchor="middle" fontSize="9.5" fill={muted}>{d.year}</text>
          </g>
        );
      })}
    </svg>
    {tip.node}
    </div>
  );
}

// easeOutBack: slight overshoot then settle — gives bars a "spring" feel
function easeOutBack(p) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

// ---- Horizontal bars (funding / users): spring widths, staggered, labels count ----
function HBarChart({ data, colorOf, ink, muted, grid, unit, valuePrefix }) {
  const [ref, inView] = useEyeLevel();
  const [nonce, bump] = useHoverReplay();
  const tip = useTip();
  const gid = useRefC("hb" + Math.random().toString(36).slice(2, 8)).current;
  const prog = useProgress(inView, 2700, 0, nonce);

  const rowH = 28, padL = 4, padT = 6;
  const labelW = 108, barMaxW = 300;
  const W = labelW + barMaxW + 64, H = padT * 2 + data.length * rowH;
  const max = Math.max(...data.map(d => d.value));
  const pre = valuePrefix || "";
  const stagger = 0.08;
  return (
    <div ref={ref} style={{ position: "relative" }} onMouseLeave={tip.hide}>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", cursor: "pointer" }}
      onMouseMove={bump} onMouseEnter={bump}>
      <defs>
        {data.map((d, i) => {
          const c = colorOf(d);
          return (
            <linearGradient key={i} id={`${gid}-${i}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={liteC(c, 0.38)} />
              <stop offset="100%" stopColor={c} />
            </linearGradient>
          );
        })}
      </defs>
      {data.map((d, i) => {
        const t0 = i * stagger;
        const local = Math.max(0, Math.min((prog - t0) / (1 - t0 || 1), 1));
        const spring = local >= 1 ? 1 : easeOutBack(local);
        const w = Math.max((barMaxW * d.value) / max * spring, 0);
        const yy = padT + i * rowH;
        const c = colorOf(d);
        const dec = (String(d.value).split(".")[1] || "").length;
        const shown = dec ? (d.value * Math.min(local * 1.15, 1)).toFixed(dec) : Math.round(d.value * Math.min(local * 1.15, 1));
        return (
          <g key={i} style={{ opacity: local > 0 ? 1 : 0.35, transition: "opacity .2s", cursor: "pointer" }}
            onMouseEnter={e => tip.show(e, <span><b>{d.name}</b> · {pre}{d.value}{unit}{d.src ? <span><br /><em>{d.src}</em></span> : null}</span>)}
            onMouseMove={tip.move} onMouseLeave={tip.hide}>
            <title>{d.src || d.name}</title>
            <rect x={padL} y={yy} width={W - padL * 2} height={rowH} fill="transparent" />
            <text x={padL} y={yy + rowH / 2 + 3.5} fontSize="11.5" fill={ink} fontWeight="600">{d.name}</text>
            <rect x={labelW} y={yy + 5} width={barMaxW} height={rowH - 13} rx="3.5" fill={grid} />
            <rect x={labelW} y={yy + 5} width={Math.max(w, 0.5)} height={rowH - 13} rx="3.5" fill={`url(#${gid}-${i})`} />
            <text x={labelW + Math.max(w, 0.5) + 8} y={yy + rowH / 2 + 3.5} fontSize="11.5" fontWeight="800" fill={ink}
              style={{ fontVariantNumeric: "tabular-nums", opacity: Math.min(local * 2, 1) }}>{pre}{shown}{unit}</text>
          </g>
        );
      })}
    </svg>
    {tip.node}
    </div>
  );
}

// ---- Donut (category share): clockwise sweep + scale-in pop, center & legend count up ----
function DonutChart({ data, colorOf, ink, muted, centerLabel, centerSub }) {
  const [ref, inView] = useEyeLevel();
  const [nonce, bump] = useHoverReplay();
  const tip = useTip();
  const gid = useRefC("dn" + Math.random().toString(36).slice(2, 8)).current;
  const prog = useProgress(inView, 2000, 0, nonce);

  const size = 184, cx = size / 2, cy = size / 2, r = 64, sw = 27;
  const total = data.reduce((s, d) => s + d.value, 0);
  const sweepEnd = -90 + prog * 360;
  let acc = -90;
  const segs = data.map(d => {
    const frac = d.value / total;
    const start = acc, end = acc + frac * 360;
    acc = end;
    const drawnEnd = Math.min(end, sweepEnd);
    let path = null;
    if (drawnEnd > start + 0.01) {
      const large = drawnEnd - start > 180 ? 1 : 0;
      const sr = (start * Math.PI) / 180, er = (drawnEnd * Math.PI) / 180;
      const x1 = cx + r * Math.cos(sr), y1 = cy + r * Math.sin(sr);
      const x2 = cx + r * Math.cos(er), y2 = cy + r * Math.sin(er);
      path = `M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    }
    return { d, path, color: colorOf(d) };
  });

  const centerParsed = parseNum(centerLabel);
  const centerShown = centerParsed.ok ? fmtNum(centerParsed.num * prog, centerParsed) : centerLabel;
  const ringScale = 0.86 + 0.14 * Math.min(prog * 1.6, 1);
  const ringSpin = (1 - Math.min(prog * 1.4, 1)) * -14;
  const centerPop = 0.7 + 0.3 * Math.min(prog * 1.8, 1);

  return (
    <div ref={ref} style={{ display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}
      onMouseMove={bump} onMouseEnter={bump} onMouseLeave={tip.hide}>
      <svg viewBox={`0 0 ${size} ${size}`} width="150" height="150" style={{ flexShrink: 0 }}>
        <defs>
          {segs.map((s, i) => (
            <linearGradient key={i} id={`${gid}-${i}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={liteC(s.color, 0.3)} />
              <stop offset="100%" stopColor={s.color} />
            </linearGradient>
          ))}
        </defs>
        <g transform={`rotate(${ringSpin} ${cx} ${cy}) translate(${cx} ${cy}) scale(${ringScale}) translate(${-cx} ${-cy})`}
          style={{ opacity: Math.min(prog * 3 + 0.15, 1) }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={ink} strokeOpacity="0.06" strokeWidth={sw} />
          {segs.map((s, i) => s.path && (
            <path key={i} d={s.path} fill="none" stroke={`url(#${gid}-${i})`} strokeWidth={sw} strokeLinecap="butt"
              style={{ cursor: "pointer" }}
              onMouseEnter={e => tip.show(e, <span><b>{s.d.label}</b> · <b>{s.d.value}%</b>{s.d.src ? <span><br /><em>{s.d.src}</em></span> : null}</span>)}
              onMouseMove={tip.move} onMouseLeave={tip.hide} />
          ))}
        </g>
        <g transform={`translate(${cx} ${cy}) scale(${centerPop}) translate(${-cx} ${-cy})`}
          style={{ opacity: Math.min(prog * 2.2, 1) }}>
          <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="800" fill={ink} style={{ fontVariantNumeric: "tabular-nums" }}>{centerShown}</text>
          <text x={cx} y={cy + 15} textAnchor="middle" fontSize="9.5" fill={muted}>{centerSub}</text>
        </g>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
        {segs.map((s, i) => {
          const t0 = 0.15 + i * 0.18;
          const local = Math.max(0, Math.min((prog - t0) / 0.3, 1));
          return (
            <div key={i} title={s.d.src || s.d.label} style={{
              display: "flex", alignItems: "center", gap: 8, fontSize: 12,
              opacity: 0.25 + 0.75 * local, transform: `translateX(${(1 - local) * 14}px)`,
              cursor: "pointer",
            }}
              onMouseEnter={e => tip.show(e, <span><b>{s.d.label}</b> · <b>{s.d.value}%</b>{s.d.src ? <span><br /><em>{s.d.src}</em></span> : null}</span>)}
              onMouseMove={tip.move} onMouseLeave={tip.hide}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }}></span>
              <span style={{ color: ink, fontWeight: 500, whiteSpace: "nowrap" }}>{s.d.label}</span>
              <span style={{ color: muted, marginLeft: "auto", fontWeight: 800, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                {Math.round(s.d.value * prog)}%
              </span>
            </div>
          );
        })}
      </div>
      {tip.node}
    </div>
  );
}

const SHORT_NAMES = { "Google DeepMind": "DeepMind", "Anthropic Claude": "Anthropic", "Stability AI": "Stability", "Mistral AI": "Mistral" };
function shortName(n) { return SHORT_NAMES[n] || n.split(" ")[0]; }

function MonthlyLineChart({ series, months, colors, ink, muted, grid, unit, valuePrefix, companies }) {
  const [ref, inView] = useEyeLevel();
  const [nonce, bump] = useHoverReplay();
  const tip = useTip();
  const prog = useProgress(inView, 2100, 0, nonce);

  const W = 520, H = 210, padL = 46, padR = 16, padT = 26, padB = 24;
  const iw = W - padL - padR, ih = H - padT - padB;
  const allVals = series.flatMap(s => s.values);
  const ticks = niceTicks(Math.max(...allVals, 1) * 1.12, 4);
  const tMax = ticks[ticks.length - 1];
  const x = i => padL + (iw * i) / (months.length - 1 || 1);
  const y = v => padT + ih - (ih * v) / tMax;
  const pre = valuePrefix || "";

  return (
    <div ref={ref} style={{ position: "relative" }} onMouseLeave={tip.hide}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", cursor: "pointer" }}
        onMouseMove={bump} onMouseEnter={bump}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={padL + iw} y1={y(t)} y2={y(t)} stroke={grid} strokeWidth="1" />
            <text x={padL - 8} y={y(t) + 3} textAnchor="end" fontSize="9" fill={muted} style={{ fontVariantNumeric: "tabular-nums" }}>{pre}{t}{unit}</text>
          </g>
        ))}
        {months.map((m, i) => (
          <text key={i} x={x(i)} y={padT + ih + 16} textAnchor="middle" fontSize="8.5" fill={muted}>{m.replace("2026-", "")}</text>
        ))}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => `${x(i)},${y(v)}`);
          const visiblePts = Math.floor(prog * pts.length) + 1;
          const shownPts = pts.slice(0, visiblePts).join(" ");
          return (
            <g key={si}>
              <polyline points={shownPts} fill="none" stroke={colors[si % colors.length]} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
              {s.values.slice(0, visiblePts).map((v, i) => (
                <g key={i}>
                  <title>{s.name} {months[i]}: {pre}{v}{unit} — {s.srcs && s.srcs[i] || ""}</title>
                  <circle cx={x(i)} cy={y(v)} r="2.5" fill="#fff" stroke={colors[si % colors.length]} strokeWidth="1.5" />
                  <circle cx={x(i)} cy={y(v)} r="9" fill="transparent" style={{ cursor: "pointer" }}
                    onMouseEnter={e => tip.show(e, <span><b style={{ color: colors[si % colors.length] }}>{s.name}</b> · {months[i].replace("2026-", "")}월 · <b>{pre}{v}{unit}</b>{s.srcs && s.srcs[i] ? <span><br /><em>{s.srcs[i]}</em></span> : null}</span>)}
                    onMouseMove={tip.move} onMouseLeave={tip.hide} />
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="mlc-legend">
        {series.map((s, si) => {
          const co = companies && companies.find(c => s.name.startsWith(c.name.split(" (")[0]) || s.name.startsWith(shortName(c.name)));
          const domain = co && co.domain;
          return (
            <span key={si} className="mlc-leg-item" style={{ cursor: "pointer" }}
              onMouseEnter={e => tip.show(e, <span><b style={{ color: colors[si % colors.length] }}>{s.name}</b> — 월별 추이</span>)}
              onMouseMove={tip.move} onMouseLeave={tip.hide}>
              <i style={{ background: colors[si % colors.length] }} />
              {domain && <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" loading="lazy" />}
              <span>{shortName(s.name)}</span>
            </span>
          );
        })}
      </div>
      {tip.node}
    </div>
  );
}

// ---- Interactive daily stock chart (hover price + inflection notes) ----
function StockChart({ stock, years, accent, ink, muted, grid }) {
  const [ref, inView] = useEyeLevel();
  const [nonce, bump] = useHoverReplay();
  const prog = useProgress(inView, 1500, 0, nonce);
  const tip = useTip();
  const [hover, setHover] = useStateC(null);
  const svgRef = useRefC(null);

  const series = (window.DASH.buildStockSeries(stock, years)) || { points: [], events: [] };
  const pts = series.points;
  const W = 760, H = 320, padL = 54, padR = 18, padT = 22, padB = 30;
  const iw = W - padL - padR, ih = H - padT - padB;
  if (!pts || pts.length < 2) {
    return <div ref={ref} className="stock-empty">주가 데이터가 부족합니다.</div>;
  }
  const lo0 = series.min, hi0 = series.max;
  const pad = (hi0 - lo0) * 0.10 || 1;
  const lo = Math.max(0, lo0 - pad), hi = hi0 + pad;
  const x = i => padL + (iw * i) / (pts.length - 1);
  const y = v => padT + ih - (ih * (v - lo)) / (hi - lo || 1);
  const ticks = niceTicks(hi, 5).filter(t => t >= lo - 0.001 && t <= hi + 0.001);

  const visN = Math.max(2, Math.floor(prog * (pts.length - 1)) + 1);
  const shownArr = pts.slice(0, visN);
  const shownLine = shownArr.map((p, i) => `${x(i)},${y(p.p)}`).join(" ");
  const areaPts = `${x(0)},${y(lo)} ${shownLine} ${x(visN - 1)},${y(lo)}`;
  const first = pts[0].p, last = pts[pts.length - 1].p;
  const up = last >= first;
  const lineCol = accent;
  const changePct = ((last - first) / first) * 100;

  const evList = (series.events || []).map(e => {
    let bi = 0, bd = Infinity;
    pts.forEach((p, i) => { const dd = Math.abs(p.t - e.t); if (dd < bd) { bd = dd; bi = i; } });
    return { e, i: bi };
  });

  const fmtKo = d => { const [Y, M, D] = d.split("-"); return `${Y}.${M}.${D}`; };

  const onMove = (ev) => {
    bump();
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    let i = Math.round(((px - padL) / iw) * (pts.length - 1));
    i = Math.max(0, Math.min(pts.length - 1, i));
    setHover(i);
  };
  const hp = hover != null ? pts[hover] : pts[pts.length - 1];
  const hChange = hp ? ((hp.p - first) / first) * 100 : 0;

  return (
    <div ref={ref} className="stock-chart" style={{ position: "relative" }} onMouseLeave={() => { setHover(null); tip.hide(); }}>
      <div className="stock-readout">
        <span className="sr-date">{hp ? fmtKo(hp.d) : ""}</span>
        <span className="sr-price" style={{ color: lineCol }}>${hp ? hp.p.toFixed(2) : last.toFixed(2)}</span>
        <span className={"sr-chg " + (hChange >= 0 ? "pos" : "neg")}>{hChange >= 0 ? "+" : ""}{hChange.toFixed(1)}% <em>(기간 시작 대비)</em></span>
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", cursor: "crosshair" }}
        onMouseMove={onMove} onMouseEnter={bump}>
        <defs>
          <linearGradient id={`sc-fill-${stock.ticker}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineCol} stopOpacity="0.28" />
            <stop offset="100%" stopColor={lineCol} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={padL + iw} y1={y(t)} y2={y(t)} stroke={grid} strokeWidth="1" />
            <text x={padL - 8} y={y(t) + 3} textAnchor="end" fontSize="10" fill={muted} style={{ fontVariantNumeric: "tabular-nums" }}>${t}</text>
          </g>
        ))}
        {/* x labels: ~5 evenly spaced dates */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const idx = Math.round(f * (pts.length - 1));
          return <text key={i} x={x(idx)} y={padT + ih + 18} textAnchor="middle" fontSize="9.5" fill={muted}>{pts[idx].d.slice(0, 7)}</text>;
        })}
        <polygon points={areaPts} fill={`url(#sc-fill-${stock.ticker})`} opacity={prog} />
        <polyline points={shownLine} fill="none" stroke={lineCol} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {/* inflection markers */}
        {evList.map((o, k) => o.i < visN && (
          <g key={k} style={{ cursor: "pointer" }}
            onMouseEnter={e => tip.show(e, <span><b style={{ color: o.e.dir === "up" ? "#0E8F6E" : "#D23B3B" }}>{o.e.dir === "up" ? "▲ 상승" : "▼ 하락"} · {o.e.label}</b><br />{fmtKo(o.e.d)} · ${o.e.p.toFixed(2)}<br /><em>{o.e.reason}</em></span>)}
            onMouseMove={tip.move} onMouseLeave={tip.hide}>
            <circle cx={x(o.i)} cy={y(o.e.p)} r="9" fill="transparent" />
            <circle cx={x(o.i)} cy={y(o.e.p)} r="5.5" fill={o.e.dir === "up" ? "#0E8F6E" : "#D23B3B"} opacity="0.18" />
            <circle cx={x(o.i)} cy={y(o.e.p)} r="3.2" fill="#fff" stroke={o.e.dir === "up" ? "#0E8F6E" : "#D23B3B"} strokeWidth="2" />
          </g>
        ))}
        {/* hover crosshair */}
        {hover != null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke={lineCol} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
            <circle cx={x(hover)} cy={y(pts[hover].p)} r="4.5" fill="#fff" stroke={lineCol} strokeWidth="2" />
          </g>
        )}
      </svg>
      {/* inflection explanations list */}
      {evList.length > 0 && (
        <div className="stock-events">
          {evList.slice().reverse().map((o, k) => (
            <div key={k} className={"se-item " + (o.e.dir === "up" ? "up" : "down")}>
              <span className="se-dot" />
              <span className="se-date">{fmtKo(o.e.d)}</span>
              <span className="se-label">{o.e.dir === "up" ? "▲" : "▼"} {o.e.label}</span>
              <span className="se-reason">{o.e.reason}</span>
            </div>
          ))}
        </div>
      )}
      {stock.note && <p className="stock-note">{stock.note}</p>}
      {tip.node}
    </div>
  );
}

Object.assign(window, { MarketGrowthChart, HBarChart, DonutChart, MonthlyLineChart, StockChart });
