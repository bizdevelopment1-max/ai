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
  { id: "overview", ko: "휴대폰 AI 신사업 브리핑", en: "New Business Brief", icon: "grid", group: "신사업 의사결정" },
  { id: "strategy", ko: "신사업 발굴 프레임", en: "User Need → New Biz", icon: "target", group: "신사업 의사결정" },
  { id: "ib", ko: "시장·소비자 리서치", en: "Market & Consumer Research", icon: "report", group: "신사업 의사결정" },
  { id: "opportunity", ko: "휴대폰 AI 신사업 DB", en: "Market · Money · Move", icon: "target", group: "신사업 의사결정" },
  { id: "articles", ko: "산업·고객 신호", en: "Industry & Customer Signals", icon: "news", group: "신사업 의사결정" },
  { id: "app", ko: "AI 경험·버티컬", en: "Experience & Verticals", icon: "spark", group: "SW·서비스 밸류체인" },
  { id: "agent", ko: "에이전트·오케스트레이션", en: "Agents & Orchestration", icon: "ai", group: "SW·서비스 밸류체인" },
  { id: "service", ko: "서비스 플랫폼·수익화", en: "Platform & Monetization", icon: "grid", group: "SW·서비스 밸류체인" },
  { id: "trust", ko: "데이터·컨텍스트·신뢰", en: "Data, Context & Trust", icon: "report", group: "SW·서비스 밸류체인" },
  { id: "model", ko: "모델·온디바이스 지능", en: "Models & On-device", icon: "ai", group: "SW·서비스 밸류체인" },
  { id: "data", ko: "개발·배포 툴링", en: "Developer & Deployment", icon: "grid", group: "SW·서비스 밸류체인" },
  { id: "infra", ko: "엣지·클라우드 런타임", en: "Edge & Cloud Runtime", icon: "server", group: "SW·서비스 밸류체인" },
  { id: "sanalysis", ko: "스타트업·파트너", en: "Startups & Partners", icon: "target", group: "전략·사업개발" },
  { id: "signals", ko: "기술 변화 신호", en: "Technology Signals", icon: "spark", group: "전략·사업개발" },
  { id: "newbiz", ko: "AI 서비스 신사업", en: "AI Service Opportunities", icon: "spark", group: "전략·사업개발" },
  { id: "survey", ko: "수요처 조사", en: "Demand Surveys", icon: "target", group: "시장 검증" },
  { id: "market", ko: "시장·TAM", en: "Market & TAM", icon: "grid", group: "시장 검증" },
  { id: "stocks", ko: "Stock 분석", en: "Stock Analysis", icon: "up", group: "시장 검증" },
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
            <b>MOBILE AI</b><span>NEW BUSINESS INTELLIGENCE</span>
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

// ---- Site CLI · GitHub request ledger + ChatGPT Pro Codex Cloud ----
const SITE_CODEX_REPO = "bizdevelopment1-max/ai";
const SITE_CODEX_API = `https://api.github.com/repos/${SITE_CODEX_REPO}`;
const SITE_CODEX_WEB = `https://github.com/${SITE_CODEX_REPO}`;
const SITE_CODEX_CLOUD = "https://chatgpt.com/codex";
const SITE_CODEX_ENVIRONMENTS = "https://chatgpt.com/codex/settings/environments";
const SITE_CODEX_REVIEW = "https://chatgpt.com/codex/settings/code-review";
const SITE_CODEX_RESULT_MARKER = "<!-- site-codex-result:v1 -->";
const SITE_CODEX_COMMANDS = [
  ["/search <키워드>", "사이트 전체 근거 검색"],
  ["/company <기업명>", "기업 개요·수익 모델·전략 검색"],
  ["/market <키워드>", "시장·소비자 조사 검색"],
  ["/ask <질문>", "Pro Codex Cloud용 GitHub 질문 생성"],
  ["/edit <요청>", "Pro Codex Cloud용 GitHub PR 요청 생성"],
  ["/sync <요청 ID>", "GitHub 요청 등록 상태 확인"],
  ["/open <섹션명>", "대시보드 섹션 이동"],
  ["/connect", "ChatGPT Pro·GitHub 연결 안내"],
  ["/doctor", "GitHub Cloud 브리지 상태"],
  ["/export", "현재 작업 기록 저장"],
  ["/clear", "콘솔 기록 정리"],
];

const SITE_CODEX_LINKS = [
  ["01", "Pro Codex Cloud 로그인", SITE_CODEX_CLOUD],
  ["02", "GitHub 저장소 환경 연결", SITE_CODEX_ENVIRONMENTS],
  ["03", "Pull Request 리뷰 설정", SITE_CODEX_REVIEW],
];

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

function siteCodexRequestId() {
  const random = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0].toString(36)
    : Math.random().toString(36).slice(2, 10);
  return `site-${Date.now()}-${random.slice(0, 8)}`;
}

function siteCodexIssueUrl(prompt, mode, requestId) {
  const title = `[SITE CODEX][${mode.toUpperCase()}][${requestId}]`;
  const body = [
    "<!-- site-codex-request:v1 -->",
    `REQUEST_ID: ${requestId}`,
    `MODE: ${mode}`,
    `CONFIRMED: ${mode === "edit" ? "yes" : "not-required"}`,
    "RUNTIME: chatgpt-pro-codex-cloud",
    "",
    "## 요청",
    "",
    prompt.slice(0, 6000),
    "",
    "## 실행 범위",
    "",
    mode === "edit"
      ? "Codex Cloud에서 연결된 저장소 수정 → 새 브랜치 → Pull Request → GitHub 검증"
      : "Codex Cloud에서 연결된 저장소를 읽고 근거 기반 답변",
    "",
    "> 공개 저장소 요청 · API 키·비밀번호·브라우저 세션·개인정보 입력 금지",
  ].join("\n");
  const query = new URLSearchParams({ title, body, labels: "site-codex" });
  return `${SITE_CODEX_WEB}/issues/new?${query.toString()}`;
}

function siteCodexCloudPrompt(prompt, mode, requestId) {
  return [
    `GitHub 저장소 ${SITE_CODEX_REPO}에서 아래 요청을 처리`,
    `요청 ID ${requestId}`,
    `모드 ${mode}`,
    "",
    mode === "edit"
      ? "새 브랜치에서 구현하고 관련 검증을 실행한 뒤 main 직접 푸시 없이 Pull Request로 제안"
      : "저장소를 변경하지 않고 코드와 데이터 근거를 확인해 한국어로 답변",
    "비밀정보·브라우저 세션·로컬 auth.json을 요청하거나 출력하지 않음",
    "",
    "사용자 요청",
    prompt,
  ].join("\n");
}

function siteCodexResultStatus(body) {
  return String(body || "").match(/^STATUS:\s*([^\n]+)\s*$/mi)?.[1]?.trim().toLowerCase() || "";
}

function cleanSiteCodexResult(body) {
  return String(body || "")
    .replaceAll(SITE_CODEX_RESULT_MARKER, "")
    .replace(/^REQUEST_ID:\s*[^\n]+\n?/gm, "")
    .replace(/^STATUS:\s*[^\n]+\n?/gm, "")
    .trim();
}

function AIChatbot({ onNav }) {
  const [launcher, setLauncher] = useState("");
  const [visible, setVisible] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState("GitHub 요청 대기");
  const [githubPanelOpen, setGithubPanelOpen] = useState(false);
  const [githubState, setGithubState] = useState({ state: "idle", conclusion: "" });
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [log, setLog] = useState([{
    id: "boot", role: "system", label: "READY",
    text: "사이트 데이터 인덱스 연결 · ChatGPT Pro Codex Cloud · GitHub 요청·PR 흐름 연결 · /help 명령어 확인",
  }]);
  const launcherRef = useRef(null);
  const terminalInputRef = useRef(null);
  const outputRef = useRef(null);
  const pollTimerRef = useRef(null);

  const append = entry => setLog(current => [
    ...current,
    { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, ...entry },
  ]);

  const checkGithubBridge = async (announce = false) => {
    setGithubState(current => ({ ...current, state: "checking" }));
    try {
      const response = await fetch(`${SITE_CODEX_API}/actions/workflows/site-codex.yml/runs?per_page=1`, {
        cache: "no-store",
        headers: { Accept: "application/vnd.github+json" },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(`GitHub API ${response.status}`);
      const latest = payload.workflow_runs?.[0];
      const next = { state: "ready", conclusion: latest?.conclusion || latest?.status || "실행 이력 없음", url: latest?.html_url || `${SITE_CODEX_WEB}/actions` };
      setGithubState(next);
      if (announce) append({
        role: "assistant",
        label: "PRO CLOUD BRIDGE",
        text: `GitHub 요청·PR 검증 브리지 연결 · 최근 상태 ${next.conclusion} · API 키와 로컬 실행 불필요`,
        url: next.url,
        actionLabel: "GitHub 검증 기록 열기",
      });
      return next;
    } catch (error) {
      const next = { state: "error", conclusion: "확인 실패" };
      setGithubState(next);
      if (announce) append({ role: "error", label: "GITHUB API", text: `${error.message} · GitHub 워크플로 페이지에서 직접 확인` });
      return next;
    }
  };

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => terminalInputRef.current?.focus(), 40);
    const onKey = event => { if (event.key === "Escape") setVisible(false); };
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(timer); document.removeEventListener("keydown", onKey); };
  }, [visible]);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [log, busy, githubPanelOpen, activity]);

  useEffect(() => () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
  }, []);

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

  const fetchGithubRequest = async identifier => {
    const headers = { Accept: "application/vnd.github+json" };
    let issue;
    if (/^\d+$/.test(String(identifier))) {
      const response = await fetch(`${SITE_CODEX_API}/issues/${identifier}`, { cache: "no-store", headers });
      if (response.ok) issue = await response.json();
    } else {
      const response = await fetch(`${SITE_CODEX_API}/issues?state=all&sort=created&direction=desc&per_page=30`, { cache: "no-store", headers });
      if (!response.ok) throw new Error(`GitHub API ${response.status}`);
      const issues = await response.json();
      issue = issues.find(item => !item.pull_request && item.title?.includes(String(identifier)));
    }
    if (!issue) return { state: "missing" };
    const commentResponse = await fetch(issue.comments_url, { cache: "no-store", headers });
    if (!commentResponse.ok) throw new Error(`GitHub 댓글 API ${commentResponse.status}`);
    const comments = await commentResponse.json();
    const result = [...comments].reverse().find(comment => comment.body?.includes(SITE_CODEX_RESULT_MARKER));
    if (!result) return { state: "registered", issue };
    const status = siteCodexResultStatus(result.body);
    return status === "cloud-ready"
      ? { state: "cloud-ready", issue, result: cleanSiteCodexResult(result.body), resultUrl: result.html_url }
      : { state: "complete", issue, result: cleanSiteCodexResult(result.body), resultUrl: result.html_url };
  };

  const pollGithubRequest = requestId => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    let checks = 0;
    setBusy(true);
    setActivity("GitHub Issue 제출 확인");
    const check = async () => {
      checks += 1;
      try {
        const current = await fetchGithubRequest(requestId);
        if (current.state === "missing") setActivity("GitHub Issue 제출 대기");
        if (current.state === "registered") setActivity(`Pro Codex Cloud 실행문 준비 · Issue #${current.issue.number}`);
        if (current.state === "cloud-ready") {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setBusy(false);
          setActivity("Pro Codex Cloud 실행 준비 완료");
          append({
            role: "assistant",
            label: "PRO CODEX CLOUD",
            text: `GitHub Issue #${current.issue.number} 등록 완료 · 실행문을 복사해 Pro 계정으로 Codex Cloud에서 작업 시작 · 수정 요청은 Pull Request로 검토`,
            links: [
              ["GitHub 요청 열기", current.issue.html_url],
              ["Codex Cloud 열기", SITE_CODEX_CLOUD],
            ],
            copyValue: localStorage.getItem(`site-codex-prompt-${requestId}`) || current.result,
          });
          return;
        }
        if (current.state === "complete") {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setBusy(false);
          setActivity("GitHub 요청 처리 완료");
          append({
            role: "assistant",
            label: "GITHUB RESULT",
            text: current.result || `Issue #${current.issue.number} 처리 완료`,
            url: current.resultUrl || current.issue.html_url,
            actionLabel: `Issue #${current.issue.number} 결과 열기`,
            exportable: true,
          });
          return;
        }
        if (checks >= 18) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setBusy(false);
          append({ role: "system", label: "GITHUB QUEUE", text: `자동 확인 종료 · Issue 제출 여부 확인 후 /sync ${requestId} 로 다시 확인` });
        }
      } catch (error) {
        if (checks >= 3) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setBusy(false);
          append({ role: "error", label: "GITHUB API", text: `${error.message} · /sync ${requestId} 로 다시 확인` });
        }
      }
    };
    check();
    pollTimerRef.current = setInterval(check, 20000);
  };

  const submitGithubRequest = async (prompt, mode) => {
    const requestId = siteCodexRequestId();
    const url = siteCodexIssueUrl(prompt, mode, requestId);
    const cloudPrompt = siteCodexCloudPrompt(prompt, mode, requestId);
    localStorage.setItem("site-codex-last-request", requestId);
    localStorage.setItem(`site-codex-prompt-${requestId}`, cloudPrompt);
    window.open(url, "_blank", "noopener,noreferrer");
    let copied = false;
    try {
      await navigator.clipboard?.writeText(cloudPrompt);
      copied = true;
    } catch {}
    append({
      role: "system",
      label: "GITHUB REQUEST",
      text: `${mode === "edit" ? "수정" : "질의"} 요청 ${requestId} · 열린 GitHub 화면에서 Issue 제출 · ${copied ? "Codex Cloud 실행문 복사 완료" : "아래 복사 버튼으로 실행문 복사"}`,
      links: [
        ["GitHub 요청 열기", url],
        ["Pro Codex Cloud 열기", SITE_CODEX_CLOUD],
      ],
      copyValue: cloudPrompt,
    });
    pollGithubRequest(requestId);
  };

  const exportSession = () => {
    const body = [
      "# Site Codex CLI 작업 기록",
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
      append({ role: "system", label: "COMMANDS", text: "사이트 검색 · ChatGPT Pro Codex Cloud 질의 · GitHub Pull Request 수정 · Cloud 브리지 상태 확인", commands: SITE_CODEX_COMMANDS });
      return;
    }
    if (command === "clear") { setLog([]); return; }
    if (command === "export") { exportSession(); append({ role: "system", label: "EXPORT", text: "Markdown 작업 기록 저장" }); return; }
    if (command === "connect") { setGithubPanelOpen(true); checkGithubBridge(true); return; }
    if (command === "doctor" || command === "status") {
      await checkGithubBridge(true);
      return;
    }
    if (command === "open") { openSection(args); return; }
    if (command === "sync") {
      const requestId = args || localStorage.getItem("site-codex-last-request");
      if (!requestId) append({ role: "error", label: "SYNC", text: "요청 ID 또는 Issue 번호 입력 필요" });
      else pollGithubRequest(requestId);
      return;
    }
    if (!["search", "company", "market", "ask", "edit"].includes(command)) {
      append({ role: "error", label: "COMMAND", text: `지원하지 않는 명령어 /${command} · /help 확인` });
      return;
    }
    if (!args) {
      append({ role: "error", label: "INPUT", text: `/${command} 뒤에 검색어 또는 요청 입력 필요` });
      return;
    }

    const kindFilter = command === "company" ? "기업" : command === "market" ? "시장" : null;
    if (command === "search" || command === "company" || command === "market") {
      append({ role: "assistant", label: "SITE INDEX", ...localResponse(args, kindFilter) });
      return;
    }

    if (command === "edit") {
      const approved = window.confirm("ChatGPT Pro Codex Cloud에서 연결된 GitHub 저장소의 새 브랜치를 수정합니다\n\n결과는 main 직접 반영 없이 Pull Request로 제안되며 GitHub 검증을 거칩니다\n\nGitHub 요청 Issue를 생성할까요");
      if (!approved) {
        append({ role: "system", label: "EDIT CANCEL", text: "GitHub 수정 요청 취소 · 저장소 변경 없음" });
        return;
      }
    }
    await submitGithubRequest(args, command === "edit" ? "edit" : "ask");
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
          placeholder="github-codex · 질문 또는 수정 명령어"
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
                <div><b>SITE CODEX</b><small>CHATGPT PRO · GITHUB · CODEX CLOUD</small></div>
              </div>
              <div className="site-cli-status">
                <span>SITE INDEX</span>
                <span className={githubState.state === "ready" ? "is-on" : ""}>PRO CLOUD</span>
                <span>PR REVIEW</span>
              </div>
              <button className="site-cli-close" onClick={() => setVisible(false)} title="닫기"><Icon name="x" size={17} sw={2} /></button>
            </header>

            <div className="site-cli-flow" aria-hidden="true">
              <span>SITE DATA</span><i /><span>GITHUB ISSUE</span><i /><span>CODEX CLOUD</span><i /><span>REVIEW + PR</span>
            </div>

            <div className="site-cli-output" ref={outputRef} data-preserve-copy="true">
              {log.map(item => (
                <article key={item.id} className={`site-cli-line ${item.role}`}>
                  <div className="site-cli-line-head">
                    <span>{item.label}</span>
                    {item.role !== "user" && item.text && <button onClick={() => copyText(item.text)} title="복사"><Icon name="copy" size={12} /></button>}
                  </div>
                  {item.text && <pre data-preserve-copy="true">{item.text}</pre>}
                  {(item.url || item.links?.length > 0 || item.copyValue) && (
                    <div className="site-cli-link-row">
                      {item.url && <a className="site-cli-link" href={item.url} target="_blank" rel="noreferrer">{item.actionLabel || "GitHub에서 열기"} ↗</a>}
                      {item.links?.map(([label, url]) => <a key={`${label}-${url}`} className="site-cli-link" href={url} target="_blank" rel="noreferrer">{label} ↗</a>)}
                      {item.copyValue && <button className="site-cli-link" onClick={() => copyText(item.copyValue)}><Icon name="copy" size={11} /> 실행문 복사</button>}
                    </div>
                  )}
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
              {busy && <div className="site-cli-running"><i /><span>{activity}</span></div>}
            </div>

            {githubPanelOpen && (
              <div className="site-cli-config">
                <div className="site-cli-config-title"><b>CHATGPT PRO · CODEX CLOUD</b><span>Pro 계정 로그인으로 GitHub 저장소 연결 · Actions Secret 없이 실행</span></div>
                <div className={`site-cli-github-card ${githubState.state === "ready" ? "is-ready" : ""}`}>
                  <b>{githubState.state === "ready" ? "GITHUB CLOUD BRIDGE ONLINE" : "CLOUD BRIDGE CONNECTION"}</b>
                  <span>Issue는 요청 기록 · Codex Cloud는 작업 실행 · Pull Request는 변경 검토와 자동 검증</span>
                </div>
                <div className="site-cli-github-links">
                  {SITE_CODEX_LINKS.map(([step, label, url]) => <a key={url} href={url} target="_blank" rel="noreferrer"><span>{step}</span><b>{label}</b><Icon name="ext" size={12} /></a>)}
                </div>
                <p>최초 1회 Codex Cloud에서 ChatGPT Pro 로그인 후 GitHub 저장소 환경 연결 · 브라우저 세션·auth.json·API 키를 GitHub Secret에 저장하지 않음 · 사이트 요청은 공개 Issue로 기록 · 수정 결과는 main 직접 반영 없이 Pull Request로 제안 · 공개 Issue에 비밀정보 입력 금지</p>
                <div className="site-cli-config-actions">
                  <button onClick={() => setGithubPanelOpen(false)}>닫기</button>
                  <button className="primary" onClick={() => checkGithubBridge(true)}>브리지 확인</button>
                </div>
              </div>
            )}

            <footer className="site-cli-input-row">
              <span>github-codex&nbsp;$</span>
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
