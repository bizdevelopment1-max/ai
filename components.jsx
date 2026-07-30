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
      return `${part.replace(/다$/u, "").trim()}${closing}`;
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

// ---- chat answer formatting (bold lead · accent terms · yellow figures) ----
const CHAT_TERMS = ["LLM","Transformer","GPT","GPT-4","GPT-5","Gemini","Claude","RLHF","Diffusion","Neural","Token","AGI","API","Fine-tune","RAG","Vector","Embedding","OpenAI","Anthropic","Google","DeepMind","Meta","Microsoft","Mistral","Cohere","Stability AI","Midjourney","Hugging Face","NVIDIA","AMD","Perplexity","Character AI","Inflection","Adept","Runway","Jasper","Copy.ai","Synthesia","ElevenLabs","Replicate","Scale AI","Databricks","Snowflake","Pinecone","Weaviate","LangChain","LlamaIndex","xAI","Grok","Llama","Mixtral","DALL-E","Sora","Copilot","ChatGPT","Bard","AWS","Azure","GCP","TPU","GPU","FLOPS","IPO","S-1","CB Insights","Sequoia","a16z","Benchmark","Accel","데카콘"];
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
const CHAT_FIG = "\\$[\\d.,]+[BMK]?\\+?|[+-]?\\d[\\d.,]*%|\\d[\\d.,]*억\\+?|\\d[\\d.,]*만\\s?명?\\+?";
const CHAT_TERM_PAT = CHAT_TERMS.slice().sort((a, b) => b.length - a.length).map(escRe).join("|");
const CHAT_SPLIT = new RegExp("(" + CHAT_FIG + "|" + CHAT_TERM_PAT + ")", "g");
const CHAT_FIG_RE = new RegExp("^(" + CHAT_FIG + ")$");
const CHAT_TERMSET = new Set(CHAT_TERMS);
function hlInline(str, key) {
  return String(str).split(CHAT_SPLIT).map((p, i) => {
    if (!p) return null;
    if (CHAT_FIG_RE.test(p)) return <b key={key + "-" + i} className="num-hl">{p}</b>;
    if (CHAT_TERMSET.has(p)) return <b key={key + "-" + i} className="chat-term">{p}</b>;
    return <React.Fragment key={key + "-" + i}>{p}</React.Fragment>;
  });
}
function MatrixRain() {
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  useEffect(() => {
    const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$@#%&";
    function initRain(canvas) {
      if (!canvas) return null;
      const ctx = canvas.getContext("2d");
      const w = canvas.width = 32;
      const h = canvas.height = canvas.parentElement ? canvas.parentElement.offsetHeight : 600;
      const fontSize = 11;
      const cols = Math.floor(w / fontSize);
      const drops = Array.from({ length: cols }, () => Math.random() * -20);
      return setInterval(() => {
        ctx.fillStyle = "rgba(10,10,10,0.12)";
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < cols; i++) {
          const ch = chars[Math.floor(Math.random() * chars.length)];
          const bright = Math.random() > 0.92;
          ctx.fillStyle = bright ? "#7fff7f" : "rgba(0,255,65," + (0.25 + Math.random() * 0.35) + ")";
          ctx.font = (bright ? "bold " : "") + fontSize + "px monospace";
          ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
          if (drops[i] * fontSize > h && Math.random() > 0.96) drops[i] = 0;
          drops[i] += 0.4 + Math.random() * 0.3;
        }
      }, 70);
    }
    const id1 = initRain(leftRef.current);
    const id2 = initRain(rightRef.current);
    return () => { if (id1) clearInterval(id1); if (id2) clearInterval(id2); };
  }, []);
  return (
    <>
      <canvas ref={leftRef} className="matrix-rain matrix-left" />
      <canvas ref={rightRef} className="matrix-rain matrix-right" />
    </>
  );
}

function formatAnswer(text) {
  if (!text) return null;
  return String(text).split(/\n\n+/).map((para, pi) => (
    <p key={pi} className={"chat-para" + (pi === 0 ? " lead" : "")}>{hlInline(para, "p" + pi)}</p>
  ));
}

// ---- AI Chatbot (dropdown questions + natural language search) ----
function AIChatbot({ onNav }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [answer, setAnswer] = useState(null);
  const [displayText, setDisplayText] = useState("");
  const [typing, setTyping] = useState(false);
  const [answerNav, setAnswerNav] = useState(null);
  const dropRef = useRef(null);
  const typingRef = useRef(null);
  const inputRef = useRef(null);

  const QA = window.DASH.QA_PAIRS || [];
  const QA_CATS = window.DASH.QA_CATS || [];

  const QUICK_Q = [
    "LLM 시장 규모와 성장률은?",
    "OpenAI vs Anthropic 경쟁 구도는?",
    "GPT-5 출시 일정과 예상 성능은?",
    "AI 스타트업 펀딩 트렌드는?",
    "RAG와 Fine-tuning 비교 분석",
    "GPU 공급난 현황과 전망은?",
  ];

  useEffect(() => {
    const close = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const typeOut = (text, nav) => {
    setAnswer(text);
    setAnswerNav(nav);
    setDisplayText("");
    setTyping(true);
    setOpen(false);
    if (typingRef.current) clearInterval(typingRef.current);
    let i = 0;
    typingRef.current = setInterval(() => {
      i += 1;
      if (i >= text.length) {
        setDisplayText(text);
        setTyping(false);
        clearInterval(typingRef.current);
      } else {
        setDisplayText(text.slice(0, i));
      }
    }, 14);
  };

  const selectQ = (qa) => {
    setSearch(qa.q);
    typeOut(qa.a, qa.nav);
  };

  const doSearch = () => {
    if (!search.trim()) return;
    const q = search.toLowerCase().trim();
    // tokenize: split on spaces AND pull 2-gram-ish Korean chunks so spaceless
    // Korean questions still match
    const words = q.split(/[\s,./?!·]+/).filter(w => w.length > 1);

    const strip = s => s.replace(/[의은는이가을를에서도와과로부터까지만]/g, "");
    const qStripped = strip(q);
    const wordsStripped = words.map(strip).filter(w => w.length > 1);

    const scored = QA.map(qa => {
      let score = 0;
      const kw = qa.keywords || [];
      const ql = qa.q.toLowerCase();
      const al = qa.a.toLowerCase();
      kw.forEach(k => {
        if (q.includes(k) || qStripped.includes(k)) score += 12;
        wordsStripped.forEach(w => {
          if (w === k || k === w) score += 12;
          else if (w.length > 1 && (k.startsWith(w) || w.startsWith(k))) score += 6;
        });
      });
      if (ql.includes(q) || q.includes(ql.slice(0, 8))) score += 8;
      wordsStripped.forEach(w => { if (ql.includes(w)) score += 3; });
      wordsStripped.forEach(w => { if (al.includes(w)) score += 1; });
      kw.forEach(k => { wordsStripped.forEach(w => { if (k.includes(w) || w.includes(k)) score += 2; }); });
      return { qa, score };
    });
    scored.sort((a, b) => b.score - a.score);
    if (scored[0] && scored[0].score >= 3) { typeOut(scored[0].qa.a, scored[0].qa.nav); return; }

    const D = window.DASH;
    const results = [];
    (D.COMPANIES || []).forEach(c => {
      const txt = (c.name + " " + c.note + " " + (c.vp || "") + " " + (c.direction || "")).toLowerCase();
      let s = 0;
      if (txt.includes(q)) s += 10;
      words.forEach(w => { if (c.name.toLowerCase().includes(w)) s += 5; if (txt.includes(w)) s += 1; });
      if (s > 0) results.push({ text: c.name + " — " + c.note, nav: c.cat, score: s });
    });
    (D.INSIGHTS || []).forEach(ins => {
      const txt = (ins.title + " " + ins.desc).toLowerCase();
      let s = 0;
      if (txt.includes(q)) s += 8;
      words.forEach(w => { if (txt.includes(w)) s += 1; });
      if (s > 0) results.push({ text: ins.title + " — " + ins.desc, nav: "insights", score: s });
    });
    (D.ARTICLES || []).forEach(a => {
      const txt = (a.title + " " + (a.summary || "") + " " + (a.co || "")).toLowerCase();
      let s = 0;
      if (a.co && q.includes(a.co.toLowerCase())) s += 6;
      words.forEach(w => { if (txt.includes(w)) s += 1; });
      if (s > 0) results.push({ text: a.source + ": " + a.title, nav: "articles", score: s });
    });

    results.sort((a, b) => b.score - a.score);
    if (results.length > 0) {
      const top = results.slice(0, 3);
      const answerText = top.map((r, i) => (i + 1) + ". " + r.text).join("\n\n");
      typeOut(answerText, top[0].nav);
    } else if (scored[0] && scored[0].score > 0) {
      // 키워드 매칭이 약해도 가장 가까운 Q&A로 답한다 (항상 답변)
      typeOut(scored[0].qa.a, scored[0].qa.nav);
    } else {
      // 근거를 찾지 못한 질의에는 숫자·거래를 추정해서 답하지 않는다.
      const fb = "현재 공개된 원문 근거에서 정확히 일치하는 항목을 찾지 못했습니다. 기업명(OpenAI·Anthropic·NVIDIA·Apple 등)이나 '수익 모델', '사업 방향', '에이전트', '조직도'처럼 범위를 좁혀 다시 질문해 주세요. 최신 기업 상세에서는 원문 링크와 생성일을 함께 확인할 수 있습니다.";
      typeOut(fb, "overview");
    }
  };

  const closeAnswer = () => {
    setAnswer(null);
    setDisplayText("");
    setTyping(false);
    setAnswerNav(null);
    if (typingRef.current) clearInterval(typingRef.current);
    setSearch("");
    setOpen(false);
    setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 30);
  };

  // click inside the open answer: while typing -> reveal full text; once done -> clear & let user re-ask
  const onPanelClick = (e) => {
    if (typing) {
      e.stopPropagation();
      if (typingRef.current) clearInterval(typingRef.current);
      setDisplayText(answer);
      setTyping(false);
    }
    // when finished, allow the click to bubble to the overlay -> closeAnswer (clears input)
  };

  const goToSection = () => {
    if (answerNav && onNav) { onNav(answerNav); }
    closeAnswer();
  };

  const filtered = search.trim()
    ? QA.filter(qa => {
        const s = search.toLowerCase();
        return qa.q.toLowerCase().includes(s) || (qa.keywords || []).some(k => s.includes(k));
      })
    : QA;

  return (
    <div className="chatbot" ref={dropRef}>
      <div className="chatbot-box">
        <input
          className="chatbot-input"
          ref={inputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } }}
          placeholder="AI 시장에 대해 물어보세요…"
        />
        <button className="chatbot-arrow" onClick={() => setOpen(!open)} title="질문 선택">
          <Icon name={open ? "up" : "down"} size={14} sw={2.2} />
        </button>
      </div>
      {open && (
        <div className="chatbot-drop">
          <div className="chatbot-drop-title">질문을 선택하세요 · 예시 {filtered.length}개</div>
          <div className="chatbot-drop-list">
            {QA_CATS.map(c => {
              const items = filtered.filter(qa => (qa.cat || 0) === c.id);
              if (!items.length) return null;
              return (
                <React.Fragment key={c.id}>
                  <div className="qa-cat-head" style={{ color: c.color }}>
                    <span className="qa-cat-dot" style={{ background: c.color }} />{c.name}
                  </div>
                  {items.map((qa, i) => (
                    <button key={c.id + "-" + i} className="chatbot-drop-item" style={{ "--qa": c.color }} onClick={() => selectQ(qa)}>
                      {qa.q}
                    </button>
                  ))}
                </React.Fragment>
              );
            })}
            {/* 카테고리 없는(레거시) 항목 */}
            {filtered.filter(qa => !qa.cat).map((qa, i) => (
              <button key={"x-" + i} className="chatbot-drop-item" onClick={() => selectQ(qa)}>{qa.q}</button>
            ))}
            {filtered.length === 0 && <div className="chatbot-drop-empty">일치하는 질문이 없습니다. Enter로 자연어 검색</div>}
          </div>
        </div>
      )}
      {answer && (
        <div className="chatbot-overlay" onClick={closeAnswer}>
          <div className="chat-panel" onClick={onPanelClick}>
            <MatrixRain />
            <div className="chat-head">
              <span className="chat-ava"><Icon name="brain" size={16} /></span>
              <b>AI INTELLIGENCE TERMINAL</b>
              {typing && <span className="chat-typing">PROCESSING…</span>}
              <button className="chatbot-bubble-close" onClick={closeAnswer}><Icon name="x" size={15} sw={2} /></button>
            </div>
            <div className="chat-body">
              <div className="chat-msg user">
                <div className="chat-bubble user">{search}</div>
              </div>
              <div className="chat-msg bot">
                <span className="chat-ava sm"><Icon name="brain" size={14} /></span>
                <div className="chat-bubble bot">
                  {typing
                    ? <span className="chat-typetext">{displayText}<span className="chatbot-cursor">▋</span></span>
                    : formatAnswer(answer)}
                </div>
              </div>
              {!typing && answerNav && (
                <div className="chat-msg bot">
                  <span className="chat-ava sm" style={{ visibility: "hidden" }}></span>
                  <button className="chatbot-go" onClick={e => { e.stopPropagation(); goToSection(); }}>
                    해당 섹션으로 이동 <Icon name="chevron" size={12} />
                  </button>
                </div>
              )}
              {!typing && <div className="chat-hint">아무 곳이나 클릭하면 닫고 새 질문을 입력할 수 있어요</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Icon, Trend, Sidebar, TopBar, KpiStrip, NAV, BRANDS, sbBg, AIChatbot, consultingBulletText });
