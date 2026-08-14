/* ============================================================
   components.jsx — UI building blocks
   ============================================================ */
// Site-wide Korean display-copy gate
// Raw evidence stays unchanged in JSON; only rendered Korean copy is converted
// to concise consulting bullets without sentence periods or declarative -다
const CONSULTING_COPY_CACHE = new Map();
const CONSULTING_ENDINGS = [
  [/하지 않았습니다$/, "하지 않음"], [/되지 않았습니다$/, "되지 않음"],
  [/있지 않았습니다$/, "있지 않음"], [/있지 않습니다$/, "있지 않음"],
  [/찾지 못했습니다$/, "찾지 못함"],
  [/것으로 보입니다$/, "것으로 전망"], [/것으로 보인다$/, "것으로 전망"],
  [/그렇지 않습니다$/, "그렇지 않음"],
  [/아니었습니다$/, "아니었음"], [/아닙니다$/, "아님"], [/아니다$/, "아님"],
  [/하였습니다$/, "함"], [/했습니다$/, "함"], [/합니다$/, "함"],
  [/하였다$/, "함"], [/했다$/, "함"], [/한다$/, "함"],
  [/되었습니다$/, "됨"], [/됐습니다$/, "됨"], [/되었다$/, "됨"],
  [/됐다$/, "됨"], [/됩니다$/, "됨"], [/된다$/, "됨"],
  [/있었습니다$/, "있었음"], [/있었다$/, "있었음"], [/있습니다$/, "있음"], [/있다$/, "있음"],
  [/없었습니다$/, "없었음"], [/없었다$/, "없었음"], [/없습니다$/, "없음"], [/없다$/, "없음"],
  [/이었습니다$/, "이었음"], [/였습니다$/, "였음"], [/이었다$/, "이었음"],
  [/였다$/, "였음"], [/입니다$/, "임"], [/이다$/, "임"],
  [/보입니다$/, "보임"], [/보인다$/, "보임"],
  [/나타났습니다$/, "나타남"], [/나타났다$/, "나타남"],
  [/밝혔습니다$/, "밝힘"], [/밝혔다$/, "밝힘"],
  [/예상됩니다$/, "예상"], [/전망됩니다$/, "전망"],
  [/필요합니다$/, "필요"], [/중요합니다$/, "중요"], [/가능합니다$/, "가능"],
  [/어렵습니다$/, "어려움"], [/쉽습니다$/, "쉬움"],
  [/높습니다$/, "높음"], [/낮습니다$/, "낮음"],
  [/많습니다$/, "많음"], [/적습니다$/, "적음"],
  [/큽니다$/, "큼"], [/작습니다$/, "작음"],
  [/늘린다$/, "확대"], [/높인다$/, "제고"], [/넓힌다$/, "확대"],
  [/줄인다$/, "축소"], [/낮춘다$/, "축소"], [/만든다$/, "구축"],
  [/선보인다$/, "공개"], [/나타낸다$/, "나타냄"], [/받는다$/, "받음"],
  [/않았습니다$/, "않음"], [/않습니다$/, "않음"], [/않았다$/, "않음"], [/않는다$/, "않음"],
  [/드립니다$/, "드림"], [/습니다$/, "음"], [/는다$/, "음"],
  [/과제다$/, "과제"], [/전제다$/, "전제"], [/목표다$/, "목표"],
];
// CONSULTING_ENDINGS above only lists verbs seen so far; any other -ㅂ니다(formal)/
// -ㄴ다(plain present) verb still needs a correct noun-form ending. Blindly
// cutting the final -다 breaks the stem (e.g. "가져옵니다" -> "가져옵니"), so shift
// the stem's own batchim (ㅂ or ㄴ) to ㅁ instead, which is how Korean actually
// nominalizes these.
const HANGUL_BASE = 0xac00, HANGUL_LAST = 0xd7a3, JONG_COUNT = 28;
const JONG_NIEUN = 4, JONG_MIEUM = 16, JONG_BIEUP = 17;
const jongseongOf = ch => {
  const code = ch.codePointAt(0);
  return code >= HANGUL_BASE && code <= HANGUL_LAST ? (code - HANGUL_BASE) % JONG_COUNT : -1;
};
const withJongseong = (ch, jong) => String.fromCodePoint(ch.codePointAt(0) - jongseongOf(ch) + jong);
const nominalizeStatementEnding = clause => {
  if (clause.endsWith("니다") && clause.length >= 3) {
    const stem = clause.slice(0, -2);
    const last = stem.slice(-1);
    return jongseongOf(last) === JONG_BIEUP ? stem.slice(0, -1) + withJongseong(last, JONG_MIEUM) : null;
  }
  if (clause.endsWith("다") && clause.length >= 2) {
    const last = clause.slice(-2, -1);
    if (jongseongOf(last) === JONG_NIEUN) return clause.slice(0, -2) + withJongseong(last, JONG_MIEUM);
  }
  return null;
};
function consultingBulletText(value) {
  const source = String(value ?? "");
  if (!source || !/[가-힣]/.test(source) || /^https?:\/\/\S+$/i.test(source.trim())) return source;
  if (CONSULTING_COPY_CACHE.has(source)) return CONSULTING_COPY_CACHE.get(source);
  const normalized = source
    .replace(/\b(\d{4})\.(\d{1,2})\.(\d{1,2})\b/g, "$1-$2-$3")
    .replace(/\bU\.S\./gi, "US").replace(/\bU\.K\./gi, "UK").replace(/\bE\.U\./gi, "EU")
    .replace(/([가-힣])([.!?。！？]+)(["'”’]?)(?=\s|$|라고|이라며|라는)/g, "$1$3 · ")
    .replace(/([가-힣])\s*[:：]\s+/g, "$1 · ")
    .replace(/。/g, " · ");
  const result = normalized.split("\n").map(line =>
    line.split(/\s+·\s+/).map(raw => {
      let part = raw.trim().replace(/^[·\s]+|[·\s]+$/g, "");
      const closing = part.match(/(["'”’]+)$/)?.[1] || "";
      if (closing) part = part.slice(0, -closing.length).trimEnd();
      part = part.replace(/[。.!?！？]+$/g, "").trim();
      for (const [ending, replacement] of CONSULTING_ENDINGS) {
        if (ending.test(part)) {
          part = part.replace(ending, replacement);
          break;
        }
      }
      if (/다$/u.test(part)) part = (nominalizeStatementEnding(part) || part.replace(/다$/u, "")).trim();
      return `${part}${closing}`;
    }).filter(Boolean).join(" · ")
  ).join("\n").replace(/[ \t]{2,}/g, " ").trim();
  if (CONSULTING_COPY_CACHE.size > 3000) CONSULTING_COPY_CACHE.clear();
  CONSULTING_COPY_CACHE.set(source, result);
  return result;
}

const ORIGINAL_CREATE_ELEMENT = React.createElement.bind(React);
const normalizeDisplayChild = child => {
  if (typeof child === "string") return consultingBulletText(child);
  if (Array.isArray(child)) return child.map(normalizeDisplayChild);
  return child;
};
React.createElement = (type, props, ...children) => {
  const className = typeof props?.className === "string" ? props.className : "";
  const preserve = props?.["data-preserve-copy"] || /(?:^|\s)user(?:\s|$)/.test(className);
  const nextProps = props ? { ...props } : props;
  if (!preserve && nextProps) {
    for (const key of ["title", "aria-label", "placeholder"]) {
      if (typeof nextProps[key] === "string") nextProps[key] = consultingBulletText(nextProps[key]);
    }
  }
  return ORIGINAL_CREATE_ELEMENT(
    type,
    nextProps,
    ...(preserve ? children : children.map(normalizeDisplayChild)),
  );
};

const { useState, useRef, useEffect, useContext } = React;

// ---- tiny icon set (stroke) ------------------------------------
function Icon({ name, size = 16, sw = 1.6 }) {
  const p = {
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
    pulse: "M3 12h4l2-6 4 12 2-6h6",
    device: "M9 2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2",
    ai: "M12 3a4 4 0 0 1 4 4 4 4 0 0 1 0 8 4 4 0 0 1-8 0 4 4 0 0 1 0-8 4 4 0 0 1 4-4zM12 7v10M8 11h8",
    spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18",
    news: "M4 5h16v14H4zM7 9h10M7 13h10M7 17h6",
    report: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 16h6",
    chart: "M4 20V8M10 20V4M16 20v-8M22 20H2",
    chevron: "M9 6l6 6-6 6",
    collapse: "M15 6l-6 6 6 6",
    search: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4",
    sun: "M12 5V3M12 21v-2M5 12H3M21 12h-2M6 6 4.5 4.5M19.5 19.5 18 18M18 6l1.5-1.5M4.5 19.5 6 18M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z",
    moon: "M21 12.8A8 8 0 1 1 11.2 3a6 6 0 0 0 9.8 9.8z",
    ext: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
    up: "M6 15l6-6 6 6",
    down: "M6 9l6 6 6-6",
    dot: "M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
    x: "M6 6l12 12M18 6L6 18",
    target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11.2a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6z",
    menu: "M3 6h18M3 12h18M3 18h18",
    copy: "M8 8h11v11H8zM5 16H4V5h11v1",
    download: "M12 3v12M7 10l5 5 5-5M4 21h16",
    palette: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.1-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16c3.3 0 6-2.7 6-6 0-5.5-4.5-9.7-10-9.7z",
    brain: "M12 2a7 7 0 0 0-5.2 2.3A6.5 6.5 0 0 0 3 10c0 2.1 1 4 2.5 5.3V20a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-2h1v2a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-4.7A6.5 6.5 0 0 0 21 10a6.5 6.5 0 0 0-3.8-5.7A7 7 0 0 0 12 2zM9 10h6M12 7v6M9 13h6",
    server: "M3 4h18v6H3zM3 14h18v6H3zM7 7h.01M7 17h.01M12 7h4M12 17h4",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d={p[name] || p.dot} />
    </svg>
  );
}

// ---- trend chip (counts up while its board is in view) ----------
function Trend({ v, small, animate }) {
  const ctx = useContext(AnimCtx);
  const prog = useProgress(animate && ctx, 900);
  if (v === 0 || v == null) return <span className="trend flat">—</span>;
  const up = v > 0;
  const shown = (Math.abs(v) * (animate ? prog : 1)).toFixed(1);
  return (
    <span className={"trend " + (up ? "up" : "down")} style={small ? { fontSize: 10.5 } : null}>
      <Icon name={up ? "up" : "down"} size={small ? 11 : 12} sw={2.2} />
      {shown}%
    </span>
  );
}

// ---- Sidebar ------------------------------
const NAV = [
  { id: "ib", ko: "증권사 인사이트", en: "IB Research", icon: "report", group: "개요" },
  { id: "overview", ko: "Executive Summary", en: "Overview", icon: "grid", group: "개요" },
  { id: "opportunity", ko: "모바일 AI 신사업 DB", en: "Market · Money · Move", icon: "target", group: "개요" },
  { id: "strategy", ko: "단말 AI 전략 프레임", en: "Mobile AI Strategy", icon: "target", group: "개요" },
  { id: "articles", ko: "데일리 기사", en: "Daily Articles", icon: "news", group: "개요" },
  { id: "app", ko: "AI 경험·버티컬", en: "Experience & Verticals", icon: "spark", group: "SW·서비스 밸류체인" },
  { id: "agent", ko: "에이전트·오케스트레이션", en: "Agents & Orchestration", icon: "ai", group: "SW·서비스 밸류체인" },
  { id: "service", ko: "서비스 플랫폼·수익화", en: "Platform & Monetization", icon: "grid", group: "SW·서비스 밸류체인" },
  { id: "trust", ko: "데이터·컨텍스트·신뢰", en: "Data, Context & Trust", icon: "report", group: "SW·서비스 밸류체인" },
  { id: "model", ko: "모델·온디바이스 지능", en: "Models & On-device", icon: "ai", group: "SW·서비스 밸류체인" },
  { id: "data", ko: "개발·배포 툴링", en: "Developer & Deployment", icon: "grid", group: "SW·서비스 밸류체인" },
  { id: "infra", ko: "엣지·클라우드 런타임", en: "Edge & Cloud Runtime", icon: "server", group: "SW·서비스 밸류체인" },
  { id: "sanalysis", ko: "스타트업 분석", en: "Startup Analysis", icon: "target", group: "SW·서비스 밸류체인" },
  { id: "signals", ko: "AI SW·서비스 기술", en: "AI SW & Services", icon: "spark", group: "심층 분석" },
  { id: "newbiz", ko: "AI 비즈니스 모델", en: "AI Business Models", icon: "spark", group: "심층 분석" },
  { id: "survey", ko: "AI 관련 소비자 조사", en: "AI Consumer Surveys", icon: "target", group: "정량 데이터" },
  { id: "market", ko: "AI 관련 시장", en: "AI Market Map", icon: "grid", group: "정량 데이터" },
  { id: "stocks", ko: "Stock 분석", en: "Stock Analysis", icon: "up", group: "정량 데이터" },
  { id: "audit", ko: "데이터 신뢰센터", en: "Data Trust Center", icon: "report", group: "운영·검증" },
];
const NAV_SECTION_IDS = NAV.map(item => item.id);

// gradient background for the sidebar, derived from a single brand color
function sbBg(hex) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  const sh = (f) => {
    const m = (c) => f >= 0 ? Math.round(c + (255 - c) * f) : Math.round(c * (1 + f));
    return `rgb(${m(r)},${m(g)},${m(b)})`;
  };
  return `linear-gradient(168deg, ${sh(0.16)} 0%, ${hex} 40%, ${sh(-0.46)} 100%)`;
}

function Sidebar({ active, onNav, brand, onLogo, onBgClick, collapsed, articleCount, companies, cats, onSelectCompany, open, onToggle }) {
  const [openCat, setOpenCat] = useState(null);
  const navRef = useRef(null);
  const isCat = id => id === "native" || id === "bigtech";   // startup은 하위 목록 미표시
  const stop = fn => (e) => { e.stopPropagation(); fn && fn(e); };
  useEffect(() => {
    const item = navRef.current?.querySelector(`[data-nav-id="${active}"]`);
    item?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);
  return (
    <>
    {open && <div className="sb-backdrop" onClick={onToggle} />}
    <aside className={"sidebar" + (open ? " sb-open" : "") + (collapsed ? " sb-collapsed" : "")}
      style={{ background: sbBg(brand.bg) }}
      onClick={onBgClick}>
      <div className="sb-head">
        <span className="sb-logo">
          <span className="sb-logo-mark" style={{ color: brand.bg }}><Icon name="pulse" size={18} sw={2.4} /></span>
          <span className="sb-logo-txt">
            <b>AI</b><span>INTELLIGENCE</span>
          </span>
        </span>
      </div>

      <nav className="sb-nav" ref={navRef} aria-label="대시보드 섹션">
        {NAV.map((n, idx) => {
          const cat = isCat(n.id) ? (cats || []).find(c => c.id === n.id) : null;
          const subs = cat ? (companies || []).filter(c => c.cat === n.id) : [];
          const startupVerts = n.id === "startup" ? ((window.DASH && window.DASH.STARTUP_VERTICALS) || []) : null;
          const openS = openCat === n.id;
          const showGroup = n.group && (idx === 0 || NAV[idx - 1].group !== n.group);
          return (
            <React.Fragment key={n.id}>
              {showGroup && <div className="sb-group">{n.group}</div>}
              <button className={"sb-item" + (active === n.id ? " on" : "")} title={n.ko}
                data-nav-id={n.id} aria-current={active === n.id ? "page" : undefined}
                onClick={stop(() => { onNav(n.id); if (cat) setOpenCat(openS ? null : n.id); })}>
                <span className="sb-ic"><Icon name={n.icon} size={17} /></span>
                <span className="sb-label">{n.ko}</span>
                {n.id === "articles" && articleCount > 0 && (
                  <span className="sb-badge">{articleCount}</span>
                )}
                {cat && <span className={"sb-caret" + (openS ? " open" : "")}><Icon name="chevron" size={13} sw={2.2} /></span>}
              </button>
              {cat && openS && (
                <div className="sb-sub">
                  {startupVerts ? startupVerts.map(v => {
                    const grp = subs.filter(c => c.vertical === v.ko);
                    if (!grp.length) return null;
                    return (
                      <React.Fragment key={v.id}>
                        <div className="sb-sub-group">{v.ko}</div>
                        {grp.map((c, i) => (
                          <button key={c.name} className="sb-subitem" title={c.name + " 상세 보기"}
                            onClick={stop(() => onSelectCompany && onSelectCompany(c))}>
                            <span className="sb-sub-dot" style={{ background: cat.accent }} />
                            <span className="sb-sub-name">{c.name}</span>
                            <span className="sb-sub-val">{c.value}</span>
                          </button>
                        ))}
                      </React.Fragment>
                    );
                  }) : subs.map((c, i) => (
                    <button key={i} className="sb-subitem" title={c.name + " 상세 보기"}
                      onClick={stop(() => onSelectCompany && onSelectCompany(c))}>
                      <span className="sb-sub-dot" style={{ background: cat.accent }} />
                      <span className="sb-sub-name">{c.name}</span>
                      <span className="sb-sub-val">{c.value}</span>
                    </button>
                  ))}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      <div className="sb-foot"></div>
    </aside>
    </>
  );
}

const BRANDS = [
  { name: "Deep Purple", bg: "#4322A8" },
  { name: "Classic Blue", bg: "#1428A0" },
  { name: "Midnight", bg: "#10131C" },
  { name: "Teal", bg: "#0A6E63" },
  { name: "Navy", bg: "#0B1F4D" },
];

// 상대 시간(방금 전·n분 전·n시간 전·n일 전) — 30초마다 갱신해 '살아있는 사이트'임을
// 시각적으로 드러냄. 소스는 data-version.json의 generatedAt(매일 자동 갱신).
function relTime(iso) {
  const t = Date.parse(iso || "");
  if (isNaN(t)) return "";
  const m = Math.max(0, (Date.now() - t) / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${Math.floor(m)}분 전`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}
function useRelativeTime(iso) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(x => x + 1), 30000);
    return () => clearInterval(id);
  }, []);
  return relTime(iso);
}

// ---- Top bar ----------------------------------------------------
function TopBar({ dark, onTheme, onMenuToggle, onColorCycle, onNav, generatedAt }) {
  const rel = useRelativeTime(generatedAt);
  return (
    <header className="topbar">
      <button className="tb-menu" onClick={onMenuToggle} title="메뉴">
        <Icon name="menu" size={18} sw={2} />
      </button>
      <div className="tb-title">
        <h1>AI Intelligence</h1>
        {rel && (
          <span className="tb-live" title={`데이터 파이프라인 마지막 갱신: ${generatedAt}`}>
            <i className="tb-live-dot" />LIVE <em>{rel} 갱신</em>
          </span>
        )}
      </div>
      <div className="tb-tools">
        <AIChatbot onNav={onNav} />
        <button className="tb-color" onClick={onColorCycle} title="색상 변경">
          <Icon name="palette" size={16} />
        </button>
        <button className="tb-theme" onClick={onTheme} title="다크모드 토글">
          <Icon name={dark ? "sun" : "moon"} size={16} />
        </button>
      </div>
    </header>
  );
}

// ---- KPI strip: counts replay in view · cards drag-reorder & fold ----
function KpiStrip({ kpis }) {
  const ref = useRef(null);
  const inView = useInView(ref);
  const [order, setOrder] = useState(kpis.map((_, i) => i));
  const [folded, setFolded] = useState({});
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const [hoverNonce, setHoverNonce] = useState({}); // bump to re-run a card's count-up on hover
  const replay = (ki) => setHoverNonce(h => ({ ...h, [ki]: (h[ki] || 0) + 1 }));

  const move = (from, to) => {
    setOrder(o => {
      const arr = [...o];
      const [x] = arr.splice(from, 1);
      arr.splice(to, 0, x);
      return arr;
    });
  };

  return (
    <AnimCtx.Provider value={inView}>
      <div className="kpi-strip" ref={ref}>
        {order.map((ki, pos) => {
          const k = kpis[ki];
          const isFold = !!folded[ki];
          const cls = "kpi" + (isFold ? " kpi-folded" : "")
            + (dragIdx === pos ? " kpi-dragging" : "")
            + (overIdx === pos && dragIdx !== null && dragIdx !== pos ? " kpi-dragover" : "");
          return (
            <div className={cls} key={ki} title={k.src || ""}
              draggable
              onMouseEnter={() => replay(ki)}
              onDragStart={e => { setDragIdx(pos); e.dataTransfer.effectAllowed = "move"; }}
              onDragEnter={() => setOverIdx(pos)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (dragIdx !== null && dragIdx !== pos) move(dragIdx, pos); setDragIdx(null); setOverIdx(null); }}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}>
              <button className="kpi-fold" title={isFold ? "카드 펼치기" : "카드 접기"}
                onClick={e => { e.stopPropagation(); setFolded(f => ({ ...f, [ki]: !f[ki] })); }}>
                <Icon name="chevron" size={11} sw={2.4} />
              </button>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-row">
                <span className="kpi-val">{k.value}</span>
                {!isFold && <Trend v={k.delta} small animate />}
              </div>
              {!isFold && <MiniBar key={"b" + (hoverNonce[ki] || 0)} frac={k.fill} color="var(--accent)" />}
              {!isFold && <div className="kpi-sub">{k.sub}</div>}
              {!isFold && k.src && <div className="kpi-src">{k.src}</div>}
            </div>
          );
        })}
      </div>
    </AnimCtx.Provider>
  );
}

// ---- Site CLI · local evidence search + optional LLM patch workspace ----
const SITE_CLI_COMMANDS = [
  ["/search <키워드>", "사이트 전체 근거 검색"],
  ["/company <기업명>", "기업 개요·수익 모델·전략 검색"],
  ["/market <키워드>", "시장·소비자 조사 검색"],
  ["/ask <질문>", "로컬 근거 또는 연결된 LLM 답변"],
  ["/edit <요청>", "검토 가능한 사이트 수정안 생성"],
  ["/open <섹션명>", "대시보드 섹션 이동"],
  ["/connect", "LLM 엔드포인트 설정"],
  ["/export", "현재 작업 기록 저장"],
  ["/clear", "콘솔 기록 정리"],
];

const SITE_CLI_DEFAULT_CONFIG = {
  endpoint: "https://api.openai.com/v1/responses",
  model: "gpt-5.6-sol",
};

const SITE_CLI_SYSTEM = `당신은 AI Intelligence 사이트 전용 분석·편집 콘솔임
제공된 SITE EVIDENCE만 사실 근거로 사용
근거에 없는 수치·날짜·인물·거래는 생성 금지
한국어 개조식으로 답변하고 문장형 종결과 마침표 사용 금지
질문 답변은 핵심 결론·근거·시사점 순서로 MECE하게 구성
수정 요청은 요약·영향 파일·unified diff·검증 항목 순서로 구성
실제 저장소 반영 전 사용자가 검토할 수 있는 수정안만 출력`;

function siteCliText(value, limit = 2600) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).slice(0, limit);
  try { return JSON.stringify(value).slice(0, limit); } catch { return ""; }
}

function buildSiteCliIndex() {
  const D = window.DASH || {};
  const docs = [];
  const add = (kind, title, text, nav, url, source) => {
    const body = siteCliText(text).replace(/\s+/g, " ").trim();
    if (!title || !body) return;
    docs.push({ id: `${kind}-${docs.length}`, kind, title: String(title), text: body, nav, url, source });
  };
  (D.COMPANIES || []).forEach(company => add(
    "기업",
    company.name,
    [company.unit, company.note, company.vp, company.direction, company.metric, company.value,
      company.funding, company.valuation, siteCliText(D.COMPANY_PROFILES?.[company.name])].filter(Boolean).join(" · "),
    company.cat,
    company.url,
    company.domain,
  ));
  (D.INSIGHTS || []).forEach(item => add("전략", item.title, item.desc, "overview", item.url, item.src));
  (D.ARTICLES || []).forEach(item => add(
    "기사", item.title, [item.co, item.summary, item.tag, item.date].filter(Boolean).join(" · "),
    "articles", item.url, item.source,
  ));
  (D.QA_PAIRS || []).forEach(item => add("분석", item.q, item.a, item.nav || "overview", "", "사이트 분석"));
  [
    ["시장", D.MARKET_GROWTH, "market"],
    ["시장", D.MARKET_VERTICAL, "market"],
    ["비즈니스 모델", D.BIZ_MODELS, "newbiz"],
    ["비즈니스 모델", D.PRICING_MODELS, "newbiz"],
    ["소비자 조사", D.USERS, "survey"],
    ["소비자 조사", D.SHARE, "survey"],
    ["리서치", D.REPORTS, "ib"],
  ].forEach(([kind, rows, nav]) => (rows || []).forEach((row, index) => {
    const title = row.title || row.name || row.label || row.market || `${kind} ${index + 1}`;
    add(kind, title, row, nav, row.url || row.sourceUrl, row.source || row.src);
  }));
  return docs;
}

function siteCliTokens(query) {
  const stop = new Set(["대한", "관련", "어떻게", "무엇", "사이트", "내용", "알려줘", "보여줘"]);
  return String(query || "").toLowerCase().split(/[\s,./?!:;()\[\]{}·—_-]+/)
    .map(token => token.trim()).filter(token => token.length > 1 && !stop.has(token));
}

function searchSiteCli(query, kindFilter) {
  const raw = String(query || "").toLowerCase().trim();
  const tokens = siteCliTokens(raw);
  return buildSiteCliIndex().map(doc => {
    if (kindFilter && doc.kind !== kindFilter) return { ...doc, score: -1 };
    const title = doc.title.toLowerCase();
    const text = doc.text.toLowerCase();
    let score = raw && title.includes(raw) ? 36 : raw && text.includes(raw) ? 18 : 0;
    tokens.forEach(token => {
      if (title === token) score += 24;
      else if (title.includes(token)) score += 12;
      if (text.includes(token)) score += 3;
    });
    const first = tokens.map(token => text.indexOf(token)).filter(index => index >= 0).sort((a, b) => a - b)[0] || 0;
    const start = Math.max(0, first - 70);
    const excerpt = `${start ? "…" : ""}${doc.text.slice(start, start + 320)}${doc.text.length > start + 320 ? "…" : ""}`;
    return { ...doc, score, excerpt };
  }).filter(doc => doc.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  return (payload?.output || []).flatMap(item => item.content || [])
    .map(item => item.text || item.output_text || "").filter(Boolean).join("\n").trim();
}

function AIChatbot({ onNav }) {
  const [launcher, setLauncher] = useState("");
  const [visible, setVisible] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [token, setToken] = useState("");
  const [config, setConfig] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("siteCliLLMConfig") || "null");
      return { ...SITE_CLI_DEFAULT_CONFIG, ...(saved || {}) };
    } catch { return SITE_CLI_DEFAULT_CONFIG; }
  });
  const [draftConfig, setDraftConfig] = useState(config);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [log, setLog] = useState([{
    id: "boot", role: "system", label: "READY",
    text: "사이트 공개 데이터 인덱스 연결 · /help 명령어 확인 · 일반 문장 입력 시 질문으로 처리",
  }]);
  const launcherRef = useRef(null);
  const terminalInputRef = useRef(null);
  const outputRef = useRef(null);

  const append = entry => setLog(current => [
    ...current,
    { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, ...entry },
  ]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => terminalInputRef.current?.focus(), 40);
    const onKey = event => { if (event.key === "Escape") setVisible(false); };
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(timer); document.removeEventListener("keydown", onKey); };
  }, [visible]);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [log, busy, configOpen]);

  const localResponse = (query, kindFilter) => {
    const results = searchSiteCli(query, kindFilter);
    if (!results.length) {
      return {
        text: "일치 근거 없음 · 기업명·시장·수익 모델·조직·제품 중 하나를 포함해 범위 축소 권장",
        results: [],
      };
    }
    return {
      text: `${results.length}개 근거 확인 · 제목과 요약을 선택해 해당 섹션 이동`,
      results,
    };
  };

  const callLlm = async (question, mode, evidence) => {
    const endpoint = config.endpoint.trim();
    if (!endpoint) throw new Error("LLM 엔드포인트 입력 필요");
    if (/api\.openai\.com/i.test(endpoint) && !token.trim()) throw new Error("OpenAI 연결 토큰 입력 필요");
    const evidenceText = evidence.length
      ? evidence.map((doc, index) => `[${index + 1}] ${doc.kind} | ${doc.title}\n${doc.excerpt}\n${doc.source || "사이트 데이터"} ${doc.url || ""}`).join("\n\n")
      : "직접 일치 근거 없음";
    const modeInstruction = mode === "edit"
      ? "요청을 구현 가능한 변경안으로 변환 · 정확한 코드 근거가 없으면 diff를 추정하지 말고 변경 명세로 대체"
      : "질문에 직접 답변 · 근거 번호를 함께 표시";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}),
      },
      body: JSON.stringify({
        model: config.model.trim() || SITE_CLI_DEFAULT_CONFIG.model,
        instructions: SITE_CLI_SYSTEM,
        input: `${modeInstruction}\n\nUSER REQUEST\n${question}\n\nSITE EVIDENCE\n${evidenceText}`,
        reasoning: { effort: mode === "edit" ? "high" : "medium" },
        text: { verbosity: mode === "edit" ? "high" : "medium" },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `LLM 요청 오류 ${response.status}`);
    const text = extractResponseText(payload);
    if (!text) throw new Error("LLM 응답 본문 없음");
    return text;
  };

  const saveConfig = () => {
    const next = {
      endpoint: draftConfig.endpoint.trim(),
      model: draftConfig.model.trim() || SITE_CLI_DEFAULT_CONFIG.model,
    };
    setConfig(next);
    setLlmEnabled(Boolean(next.endpoint));
    sessionStorage.setItem("siteCliLLMConfig", JSON.stringify(next));
    setConfigOpen(false);
    append({ role: "system", label: "LLM", text: `${next.model} 구성 완료 · 토큰은 현재 탭 메모리에만 유지` });
  };

  const exportSession = () => {
    const body = [
      "# Site CLI 작업 기록",
      `생성 시각 · ${new Date().toISOString()}`,
      "",
      ...log.flatMap(item => [`## ${item.label || item.role}`, item.text || "", ...(item.results || []).map(result => `- ${result.title} · ${result.excerpt}`), ""]),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `site-cli-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const openSection = raw => {
    const needle = String(raw || "").toLowerCase().trim();
    const match = NAV.find(item => [item.id, item.ko, item.en].some(value => String(value).toLowerCase().includes(needle)));
    if (!match || !needle) {
      append({ role: "error", label: "NAV", text: "섹션 확인 실패 · /open 시장 · /open 기업 · /open stocks 형식 권장" });
      return;
    }
    onNav?.(match.id);
    append({ role: "system", label: "NAV", text: `${match.ko} 섹션 이동` });
  };

  const execute = async rawValue => {
    const raw = String(rawValue || "").trim();
    if (!raw || busy) return;
    setVisible(true);
    setInput("");
    setLauncher("");
    setHistory(current => [raw, ...current.filter(item => item !== raw)].slice(0, 40));
    setHistoryIndex(-1);
    append({ role: "user", label: "YOU", text: raw });

    const commandMatch = raw.match(/^\/(\S+)\s*(.*)$/s);
    const command = commandMatch ? commandMatch[1].toLowerCase() : "ask";
    const args = commandMatch ? commandMatch[2].trim() : raw;

    if (command === "help") {
      append({ role: "system", label: "COMMANDS", text: "질문·검색·섹션 이동·수정안 생성·내보내기 지원", commands: SITE_CLI_COMMANDS });
      return;
    }
    if (command === "clear") { setLog([]); return; }
    if (command === "export") { exportSession(); append({ role: "system", label: "EXPORT", text: "Markdown 작업 기록 저장" }); return; }
    if (command === "connect") { setDraftConfig(config); setConfigOpen(true); return; }
    if (command === "disconnect") {
      setToken(""); setLlmEnabled(false); setConfigOpen(false);
      append({ role: "system", label: "LLM", text: "LLM 연결 해제 · 로컬 사이트 검색 유지" });
      return;
    }
    if (command === "status") {
      append({ role: "system", label: "STATUS", text: `로컬 인덱스 ${buildSiteCliIndex().length}건 · LLM ${llmEnabled ? `${config.model} 구성` : "미연결"} · 자동 적용 비활성` });
      return;
    }
    if (command === "open") { openSection(args); return; }
    if (!["search", "company", "market", "ask", "edit"].includes(command)) {
      append({ role: "error", label: "COMMAND", text: `지원하지 않는 명령어 /${command} · /help 확인` });
      return;
    }
    if (!args) {
      append({ role: "error", label: "INPUT", text: `/${command} 뒤에 검색어 또는 요청 입력 필요` });
      return;
    }

    const kindFilter = command === "company" ? "기업" : command === "market" ? "시장" : null;
    const evidence = searchSiteCli(args, kindFilter);
    if (command === "search" || command === "company" || command === "market") {
      append({ role: "assistant", label: "LOCAL INDEX", ...localResponse(args, kindFilter) });
      return;
    }
    if (!llmEnabled) {
      if (command === "edit") {
        append({
          role: "assistant", label: "CHANGE BRIEF",
          text: `요청 · ${args}\n영향 영역 · ${evidence.slice(0, 3).map(item => item.kind).filter((item, index, list) => list.indexOf(item) === index).join(" · ") || "화면 구성"}\n검증 · 기존 데이터 보존 · 모바일 정렬 · 번들 재생성 · 자동 테스트\n적용 방식 · /connect 후 코드 수정안 생성 또는 현재 기록 내보내기`,
          results: evidence.slice(0, 3),
        });
      } else {
        append({ role: "assistant", label: "LOCAL ANSWER", ...localResponse(args, null) });
      }
      return;
    }

    setBusy(true);
    try {
      const text = await callLlm(args, command === "edit" ? "edit" : "ask", evidence);
      append({ role: "assistant", label: command === "edit" ? "PATCH REVIEW" : config.model, text, results: evidence.slice(0, 4), exportable: command === "edit" });
    } catch (error) {
      append({ role: "error", label: "LLM ERROR", text: `${error.message} · /connect 설정 확인 · 로컬 검색은 계속 사용 가능` });
    } finally { setBusy(false); }
  };

  const onTerminalKey = event => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); execute(input); return; }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.min(history.length - 1, historyIndex + 1);
      if (next >= 0) { setHistoryIndex(next); setInput(history[next]); }
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = historyIndex - 1;
      setHistoryIndex(next);
      setInput(next >= 0 ? history[next] : "");
    }
  };

  const copyText = text => navigator.clipboard?.writeText(text || "").catch(() => {});

  return (
    <div className="site-cli">
      <div className="site-cli-launcher">
        <span className="site-cli-prompt" aria-hidden="true">$</span>
        <input
          ref={launcherRef}
          value={launcher}
          onChange={event => setLauncher(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); launcher.trim() ? execute(launcher) : setVisible(true); } }}
          placeholder="site-cli · 질문 또는 수정 명령어"
          aria-label="사이트 CLI 명령어"
          data-preserve-copy="true"
        />
        <button className="site-cli-open" onClick={() => launcher.trim() ? execute(launcher) : setVisible(true)} title="CLI 열기">
          <span className="site-cli-triangle" />
        </button>
      </div>

      {visible && ReactDOM.createPortal(
        <div className="site-cli-overlay" role="dialog" aria-modal="true" aria-label="사이트 CLI">
          <section className="site-cli-terminal">
            <header className="site-cli-head">
              <div className="site-cli-window-controls" aria-hidden="true"><i /><i /><i /></div>
              <div className="site-cli-title">
                <span className="site-cli-mark"><Icon name="pulse" size={17} sw={2.2} /></span>
                <div><b>SITE CLI</b><small>CONTENT · LLM · PATCH WORKSPACE</small></div>
              </div>
              <div className="site-cli-status">
                <span>LOCAL INDEX</span>
                <span className={llmEnabled ? "is-on" : ""}>LLM {llmEnabled ? "READY" : "OPTIONAL"}</span>
                <span>PATCH REVIEW</span>
              </div>
              <button className="site-cli-close" onClick={() => setVisible(false)} title="닫기"><Icon name="x" size={17} sw={2} /></button>
            </header>

            <div className="site-cli-flow" aria-hidden="true">
              <span>SITE DATA</span><i /><span>RETRIEVAL</span><i /><span>LLM</span><i /><span>REVIEW</span>
            </div>

            <div className="site-cli-output" ref={outputRef} data-preserve-copy="true">
              {log.map(item => (
                <article key={item.id} className={`site-cli-line ${item.role}`}>
                  <div className="site-cli-line-head">
                    <span>{item.label}</span>
                    {item.role !== "user" && item.text && <button onClick={() => copyText(item.text)} title="복사"><Icon name="copy" size={12} /></button>}
                  </div>
                  {item.text && <pre data-preserve-copy="true">{item.text}</pre>}
                  {item.commands && (
                    <div className="site-cli-command-grid">
                      {item.commands.map(([cmd, desc]) => <button key={cmd} onClick={() => setInput(cmd.split(" ")[0] + " ")}><code>{cmd}</code><span>{desc}</span></button>)}
                    </div>
                  )}
                  {item.results?.length > 0 && (
                    <div className="site-cli-results">
                      {item.results.map(result => (
                        <button key={result.id} onClick={() => { result.nav && onNav?.(result.nav); }}>
                          <span>{result.kind}</span><b>{result.title}</b><p>{result.excerpt}</p><em>{result.source || "사이트 근거"}</em>
                        </button>
                      ))}
                    </div>
                  )}
                  {item.exportable && <button className="site-cli-export" onClick={exportSession}><Icon name="download" size={13} /> 수정안 내보내기</button>}
                </article>
              ))}
              {busy && <div className="site-cli-running"><i /><span>근거 분석과 수정안 구성</span></div>}
            </div>

            {configOpen && (
              <div className="site-cli-config">
                <div className="site-cli-config-title"><b>LLM CONNECTION</b><span>OpenAI Responses API 또는 호환 보안 프록시</span></div>
                <label><span>ENDPOINT</span><input value={draftConfig.endpoint} onChange={event => setDraftConfig({ ...draftConfig, endpoint: event.target.value })} spellCheck="false" /></label>
                <label><span>MODEL</span><input value={draftConfig.model} onChange={event => setDraftConfig({ ...draftConfig, model: event.target.value })} spellCheck="false" /></label>
                <label><span>SESSION TOKEN</span><input type="password" value={token} onChange={event => setToken(event.target.value)} autoComplete="new-password" placeholder="현재 탭 메모리에만 유지" /></label>
                <p>공개 페이지에 키 저장 금지 · 운영 환경은 서버측 보안 프록시 권장 · 수정안은 자동 반영 없이 검토 후 내보내기</p>
                <div className="site-cli-config-actions">
                  <button onClick={() => setConfigOpen(false)}>취소</button>
                  <button className="primary" onClick={saveConfig}>연결 구성</button>
                </div>
              </div>
            )}

            <footer className="site-cli-input-row">
              <span>site-cli&nbsp;$</span>
              <textarea
                ref={terminalInputRef}
                value={input}
                onChange={event => setInput(event.target.value)}
                onKeyDown={onTerminalKey}
                placeholder="질문 입력 · /help 명령어 확인"
                rows="1"
                disabled={busy}
                data-preserve-copy="true"
              />
              <button onClick={() => execute(input)} disabled={busy || !input.trim()} title="실행"><span className="site-cli-triangle" /></button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}

Object.assign(window, { Icon, Trend, Sidebar, TopBar, KpiStrip, NAV, BRANDS, sbBg, AIChatbot, consultingBulletText });
