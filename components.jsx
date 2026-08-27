/* ============================================================
   components.jsx — UI building blocks
   ============================================================ */
// Site-wide Korean display-copy gate
// Raw evidence stays unchanged in JSON; only rendered Korean copy is converted
// to concise consulting bullets without sentence periods or declarative -다
const CONSULTING_COPY_CACHE = new Map();
const DISPLAY_COPY_REPLACEMENTS = [
  [/Samsung Electronics MX/gi, "자사 모바일 사업"],
  [/Samsung MX/gi, "자사 모바일 사업"],
  [/MX\s*사업부/gi, "모바일 사업부"],
  [/Galaxy AI/gi, "자사 단말 AI"],
  [/Galaxy Store/gi, "자사 앱스토어"],
  [/Galaxy Watch/gi, "자사 워치"],
  [/Galaxy Ring/gi, "자사 링"],
  [/Samsung Account/gi, "자사 계정"],
  [/Samsung Health/gi, "자사 헬스 플랫폼"],
  [/Samsung Wallet/gi, "자사 월렛"],
  [/Samsung Members/gi, "자사 사용자 커뮤니티"],
  [/Samsung Phone/gi, "자사 단말"],
  [/One UI/gi, "자사 UI"],
  [/Knox Vault/gi, "자사 보안 금고"],
  [/Knox Suite/gi, "자사 보안 제품군"],
  [/Knox/gi, "자사 보안 플랫폼"],
  [/SmartThings/gi, "자사 연결 플랫폼"],
  [/\bDeX\b/g, "자사 데스크톱 모드"],
  [/\bSVIC\b/gi, "사내 벤처투자"],
  [/삼성전자/g, "자사"],
  [/삼성/g, "자사"],
  [/Samsung/gi, "자사"],
  [/갤럭시/g, "자사 단말"],
  [/Galaxy/gi, "자사 단말"],
  [/\bMX\b/gi, "모바일 사업"],
];
const neutralizeDisplayText = value => DISPLAY_COPY_REPLACEMENTS
  .reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), String(value ?? ""));
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
  const source = neutralizeDisplayText(value);
  const hasDisplayDate = /\b20\d{2}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}/.test(source);
  if (!source || (!/[가-힣]/.test(source) && !hasDisplayDate) || /^https?:\/\/\S+$/i.test(source.trim())) return source;
  if (CONSULTING_COPY_CACHE.has(source)) return CONSULTING_COPY_CACHE.get(source);
  const normalized = source
    // Dates are a display concern: retain ISO values in the ledgers, while
    // every rendered label uses the compact M/DD convention.
    .replace(/\b(?:20\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?:\.)?/g,
      (_, month, day) => `${Number(month)}/${String(Number(day)).padStart(2, "0")}`)
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
const normalizeDisplayChild = (child, preserve = false) => {
  if (typeof child === "string") return preserve ? neutralizeDisplayText(child) : consultingBulletText(child);
  if (Array.isArray(child)) return child.map(item => normalizeDisplayChild(item, preserve));
  return child;
};
React.createElement = (type, props, ...children) => {
  const className = typeof props?.className === "string" ? props.className : "";
  const preserve = props?.["data-preserve-copy"] || /(?:^|\s)user(?:\s|$)/.test(className);
  const nextProps = props ? { ...props } : props;
  if (nextProps) {
    for (const key of ["title", "aria-label", "placeholder"]) {
      if (typeof nextProps[key] === "string") nextProps[key] = preserve ? neutralizeDisplayText(nextProps[key]) : consultingBulletText(nextProps[key]);
    }
  }
  return ORIGINAL_CREATE_ELEMENT(
    type,
    nextProps,
    ...children.map(child => normalizeDisplayChild(child, preserve)),
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
  { id: "overview", ko: "산업·경쟁 브리핑", en: "Industry & Competition Brief", icon: "grid", group: "01 · 방향 설정", children: [
    { key: "relationship-map", ko: "산업 관계 지도" },
  ] },
  { id: "strategy", ko: "전략 우선순위", en: "Strategic Priorities", icon: "target", group: "01 · 방향 설정", children: [
    { key: "priority-model", ko: "우선순위 모델" }, { key: "opportunity-portfolio", ko: "후보 포트폴리오" },
    { key: "evidence-signals", ko: "근거 신호" }, { key: "decision-criteria", ko: "평가 기준" },
  ] },
  { id: "opportunity", ko: "신사업 기회 DB", en: "Opportunity Database", icon: "report", group: "02 · 기회 설계", children: [
    { key: "decision-radar", ko: "의사결정 레이더" }, { key: "opportunity-candidates", ko: "기회 후보" },
    { key: "monetization-roi", ko: "수익화·ROI" },
  ] },
  { id: "newbiz", ko: "서비스·수익 모델", en: "Service & Revenue Models", icon: "spark", group: "02 · 기회 설계", children: [
    { key: "revenue-model", ko: "수익 모델" },
  ] },
  { id: "valuechain", ko: "AI 밸류체인", en: "AI Value Chain", icon: "ai", group: "03 · 생태계 선택", children: [] },
  { id: "signals", ko: "기술 변화 신호", en: "Technology Signals", icon: "pulse", group: "03 · 생태계 선택", children: [
    { key: "technology-shift", ko: "기술 변화" }, { key: "market-shift", ko: "시장 변화" },
  ] },
  { id: "sanalysis", ko: "파트너·M&A 후보", en: "Partner & M&A Candidates", icon: "target", group: "03 · 생태계 선택", children: [] },
  { id: "evidence", ko: "시장·고객 근거", en: "Market & Customer Evidence", icon: "news", group: "04 · 근거 검증", children: [
    { key: "institutional-research", ko: "기관 리서치" }, { key: "industry-customer-source", ko: "산업·고객 원문" },
  ] },
  { id: "validation", ko: "수요·시장·재무 검증", en: "Demand, Market & Financial Validation", icon: "chart", group: "04 · 근거 검증", children: [
    { key: "survey", ko: "수요 조사" }, { key: "market", ko: "시장 규모" }, { key: "stocks", ko: "상장사·투자" },
  ] },
];
const NAV_SECTION_IDS = NAV.map(item => item.id);
const HIDDEN_SIDEBAR_CHILD_KEYS = new Set([
  "executive-brief", "execution-plan", "build-buy-partner",
  "execution-hypothesis", "action-implication",
]);
const HIDDEN_SIDEBAR_CHILD_LABELS = /^(?:영상[·\s]*핵심 브리핑|핵심 브리핑|실행 계획|Build[·\s-]*Buy[·\s-]*Partner|실행 가설|실행 시사점)$/i;

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

function Sidebar({ active, activeCategory, onNav, onCategory, brand, onLogo, onBgClick, collapsed, articleCount, companies, sectionCategories, navigation, onSelectCompany, open, onToggle }) {
  const [openSection, setOpenSection] = useState(active || null);
  const [openCategory, setOpenCategory] = useState(null);
  const navRef = useRef(null);
  const navItems = Array.isArray(navigation) && navigation.length ? navigation : NAV;
  const stop = fn => (e) => { e.stopPropagation(); fn && fn(e); };
  const categoriesFor = item => {
    const dynamic = sectionCategories && sectionCategories[item.id];
    const categories = Array.isArray(dynamic) && dynamic.length ? dynamic : (item.children || []);
    return categories.filter(category => {
      const id = category.id || category.key;
      const label = String(category.ko || category.label || "").trim();
      return !HIDDEN_SIDEBAR_CHILD_KEYS.has(id) && !HIDDEN_SIDEBAR_CHILD_LABELS.test(label);
    });
  };
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
            <b>AI</b><span>NEW BUSINESS INTELLIGENCE</span>
          </span>
        </span>
      </div>

      <nav className="sb-nav" ref={navRef} aria-label="대시보드 섹션">
        {navItems.map((n, idx) => {
          const categories = categoriesFor(n);
          const openS = openSection === n.id;
          const showGroup = n.group && (idx === 0 || navItems[idx - 1].group !== n.group);
          return (
            <React.Fragment key={n.id}>
              {showGroup && <div className="sb-group">{n.group}</div>}
              <button className={"sb-item" + (active === n.id ? " on" : "")} title={n.ko}
                data-nav-id={n.id} aria-current={active === n.id ? "page" : undefined}
                onClick={stop(() => {
                  onNav(n.id);
                  setOpenSection(openS ? null : n.id);
                  setOpenCategory(null);
                })}>
                <span className="sb-ic"><Icon name={n.icon} size={17} /></span>
                <span className="sb-label">{n.ko}</span>
                {n.id === "articles" && articleCount > 0 && (
                  <span className="sb-badge">{articleCount}</span>
                )}
                {categories.length > 0 && <span className={"sb-caret" + (openS ? " open" : "")}><Icon name="chevron" size={13} sw={2.2} /></span>}
              </button>
              {categories.length > 0 && openS && (
                <div className="sb-sub" aria-label={`${n.ko} 하위 카테고리`}>
                  {categories.map(category => {
                    const categoryId = category.id || category.key;
                    const categoryCompanies = Array.isArray(category.companies) ? category.companies : [];
                    const categoryOpen = openCategory === `${n.id}:${categoryId}`;
                    const selectedCategory = active === n.id && activeCategory === categoryId;
                    return (
                      <div className="sb-category-block" key={categoryId}>
                        <button className={"sb-category" + (selectedCategory ? " on" : "")}
                          title={`${category.ko}${categoryCompanies.length ? ` · ${categoryCompanies.length}개사` : ""}`}
                          aria-expanded={categoryCompanies.length ? categoryOpen : undefined}
                          onClick={stop(() => {
                            onCategory && onCategory(n.id, categoryId);
                            if (categoryCompanies.length) setOpenCategory(categoryOpen ? null : `${n.id}:${categoryId}`);
                          })}>
                          <span className="sb-category-dot" style={{ background: category.accent || "rgba(255,255,255,.58)" }} />
                          <span className="sb-category-name">{category.ko}</span>
                          {categoryCompanies.length > 0 && <span className="sb-category-count">{categoryCompanies.length}</span>}
                          {categoryCompanies.length > 0 && <span className={"sb-category-caret" + (categoryOpen ? " open" : "")}><Icon name="chevron" size={11} sw={2.2} /></span>}
                        </button>
                        {categoryCompanies.length > 0 && categoryOpen && (
                          <div className="sb-company-list" aria-label={`${category.ko} 기업`}>
                            {categoryCompanies.map(company => (
                              <button key={company.name} className="sb-company" title={`${company.name} 상세 보기`}
                                onClick={stop(() => onSelectCompany && onSelectCompany(company, { section: n.id, category: categoryId }))}>
                                <span className="sb-company-name">{company.name}</span>
                                <Icon name="chevron" size={10} sw={2} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
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

// ---- Top bar ----------------------------------------------------
function TopBar({ dark, onTheme, onMenuToggle, onColorCycle, onNav }) {
  const [cliGuideSignal, setCliGuideSignal] = useState(0);
  return (
    <header className="topbar">
      <button className="tb-menu" onClick={onMenuToggle} title="메뉴">
        <Icon name="menu" size={18} sw={2} />
      </button>
      <div className="tb-title">
        <h1>AI Intelligence</h1>
      </div>
      <nav className="tb-resource-actions" aria-label="작성 및 CLI 도움말">
        <a
          className="tb-how-link"
          href="https://bizdevelopment1-max.github.io/ai/How/"
          target="_blank"
          rel="noreferrer"
          title="How 작성 방법 열기"
          aria-label="How 작성 방법 새 탭에서 열기"
        >
          <i className="tb-resource-icon"><Icon name="report" size={14} sw={1.9} /></i>
          <span>How · 작성 방법</span>
          <Icon name="ext" size={10} sw={2} />
        </a>
        <button
          className="tb-cli-guide"
          onClick={() => setCliGuideSignal(value => value + 1)}
          title="상단 CLI 활용법 열기"
          aria-label="상단 CLI 활용법 열기"
        >
          <i className="tb-resource-icon"><Icon name="server" size={14} sw={1.9} /></i>
          <span>CLI 활용법</span>
        </button>
      </nav>
      <div className="tb-tools">
        <AIChatbot onNav={onNav} guideSignal={cliGuideSignal} />
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

// ---- Site CLI · Codex Cloud execution + GitHub delivery tracking ----
const SITE_CODEX_REPO = "bizdevelopment1-max/ai";
const SITE_CODEX_API = `https://api.github.com/repos/${SITE_CODEX_REPO}`;
const SITE_CODEX_WEB = `https://github.com/${SITE_CODEX_REPO}`;
const SITE_CODEX_CLOUD = "https://chatgpt.com/codex/cloud";
const SITE_CODEX_ENVIRONMENTS = "https://chatgpt.com/codex/settings/environments";
const SITE_CODEX_REVIEW = "https://chatgpt.com/codex/settings/code-review";
const SITE_CODEX_RESULT_MARKER = "<!-- site-codex-result:v1 -->";
const SITE_CODEX_COMMANDS = [
  ["/help", "전체 명령과 키보드 사용법"],
  ["/guide", "Codex Cloud → Pull Request → 검증 사용 순서"],
  ["/examples", "복사해서 바로 실행할 수 있는 예시"],
  ["/search <키워드>", "사이트 전체 근거 검색"],
  ["/company <기업명>", "기업 개요·수익 모델·전략 검색"],
  ["/market <키워드>", "시장·소비자 조사 검색"],
  ["/cloud <요청>", "실행문 복사 후 Codex Cloud 바로 열기"],
  ["/ask <질문>", "Codex Cloud에서 저장소 분석"],
  ["/edit <요청>", "Codex Cloud에서 수정·검증·PR 생성"],
  ["/issue <요청>", "선택 사항 · 공개 GitHub 요청 기록 생성"],
  ["/env <환경 ID>", "터미널용 Cloud 환경 ID 저장"],
  ["/tasks", "터미널용 최근 Cloud 작업 조회 명령"],
  ["/status", "최근 Pull Request와 Actions 상태 확인"],
  ["/sync <요청 ID>", "GitHub 요청 등록 상태 확인"],
  ["/open <섹션명>", "대시보드 섹션 이동"],
  ["/connect", "Codex Cloud·GitHub 연결 안내"],
  ["/doctor", "GitHub Cloud 브리지 상태"],
  ["/repo", "GitHub 저장소 바로가기"],
  ["/issues", "Site Codex 요청 Issue 목록"],
  ["/prs", "Pull Request 검토 화면"],
  ["/actions", "자동 검증 Actions 화면"],
  ["/export", "현재 작업 기록 저장"],
  ["/clear", "콘솔 기록 정리"],
];

const SITE_CODEX_QUICK_COMMANDS = [
  ["/guide", "처음 사용"],
  ["/search ", "사이트 검색"],
  ["/cloud ", "Cloud 작업"],
  ["/edit ", "수정·PR"],
  ["/status", "배포 상태"],
];

const SITE_CODEX_GUIDE_STEPS = [
  ["1", "요청 입력", "수정은 /cloud 또는 /edit, 분석은 /ask 뒤에 요청을 입력하고 Enter 실행"],
  ["2", "Cloud 열기", "연결된 Codex Cloud 화면이 즉시 열리고 저장소·기준 브랜치·검증 조건이 포함된 실행문이 복사됨"],
  ["3", "작업 실행", "Codex Cloud에서 연결된 환경을 선택하고 복사된 실행문을 붙여넣어 작업 시작"],
  ["4", "변경 검토", "작업 결과의 파일 차이와 검증 결과를 확인한 뒤 main 대상 Pull Request 생성"],
  ["5", "상태 확인", "사이트 CLI에서 /status를 실행해 최근 Pull Request와 Actions 결과 확인"],
];

const siteCliGuidePayload = () => ({
  role: "assistant",
  label: "CLI QUICK START",
  text: "상단 입력창에서 명령을 바로 실행 · Cloud 작업 화면과 실행문을 함께 준비하고 변경은 Pull Request 승인 후 적용",
  steps: SITE_CODEX_GUIDE_STEPS,
  examples: SITE_CODEX_EXAMPLES,
  links: SITE_CODEX_LINKS.map(([, label, url]) => [label, url]),
});

const SITE_CODEX_EXAMPLES = [
  "/search 온디바이스 AI 수익화",
  "/company Apple",
  "/market AI 스마트폰 출하량",
  "/ask 현재 수집 자동화의 빈 스트림 원인을 분석해줘",
  "/cloud 최신 데이터 검증률을 높이고 검증 결과를 시각화해줘",
  "/edit Apple 카드 호버 대비를 수정하고 자동화 검사를 추가해줘",
  "/status",
];

const SITE_CODEX_GITHUB_PAGES = {
  repo: ["GITHUB REPOSITORY", SITE_CODEX_WEB],
  issues: ["SITE CODEX ISSUES", `${SITE_CODEX_WEB}/issues?q=is%3Aissue+label%3Asite-codex`],
  prs: ["PULL REQUESTS", `${SITE_CODEX_WEB}/pulls`],
  actions: ["SITE CODEX ACTIONS", `${SITE_CODEX_WEB}/actions/workflows/site-codex.yml`],
};

function completeSiteCliCommand(value) {
  const raw = String(value || "");
  if (!raw.startsWith("/") || /\s/.test(raw)) return raw;
  const commands = SITE_CODEX_COMMANDS.map(([syntax]) => syntax.split(" ")[0]);
  const matches = commands.filter(command => command.startsWith(raw.toLowerCase()));
  return matches.length === 1 ? `${matches[0]} ` : raw;
}

const SITE_CODEX_LINKS = [
  ["01", "Codex Cloud 작업 화면", SITE_CODEX_CLOUD],
  ["02", "연결 환경 확인", SITE_CODEX_ENVIRONMENTS],
  ["03", "Pull Request 리뷰 설정", SITE_CODEX_REVIEW],
];

function siteCliText(value, limit = 2600) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).slice(0, limit);
  try { return JSON.stringify(value).slice(0, limit); } catch { return ""; }
}

function buildSiteCliIndex() {
  const live = window.__DASH_LIVE_DOCS || {};
  const docs = [];
  const add = (kind, title, text, nav, url, source) => {
    const body = siteCliText(text).replace(/\s+/g, " ").trim();
    if (!title || !body) return;
    docs.push({ id: `${kind}-${docs.length}`, kind, title: String(title), text: body, nav, url, source });
  };
  (live.companies || []).forEach(company => add(
    "기업",
    company.name,
    [company.unit, company.note, company.vp, company.direction, siteCliText(company.profile),
      siteCliText(company.live?.latest)].filter(Boolean).join(" · "),
    company.cat,
    company.url,
    company.domain,
  ));
  (live.insights?.cards || []).forEach(item => add("전략", item.axisLabel || item.headline, item, "overview", item.evidence?.[0]?.url, item.evidence?.[0]?.source));
  (live.articles || []).forEach(item => add(
    "기사", item.title, [item.co, item.summary, item.tag, item.date].filter(Boolean).join(" · "),
    "articles", item.url, item.source,
  ));
  (live.research?.feed || []).forEach(item => add(
    "리서치", item.titleKo || item.title, item.summary || item.desc, "ib", item.url, item.source || item.house,
  ));
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
    `연결된 GitHub 저장소 ${SITE_CODEX_REPO}에서 아래 요청을 처리해 주세요.`,
    `요청 ID: ${requestId}`,
    `작업 유형: ${mode === "edit" ? "구현" : "분석"}`,
    "기준 브랜치: main",
    "",
    mode === "edit"
      ? "새 브랜치에서 필요한 범위만 구현하고 브라우저 번들 빌드, 자동화 검사, 부서 적합성 검사를 실행한 뒤 main 대상 Pull Request로 제안해 주세요."
      : "파일을 변경하지 말고 코드와 데이터 근거를 확인해 한국어로 답변해 주세요.",
    "기존 공개 URL과 데이터 구조를 유지하고, 실패한 검증은 숨기지 말고 보고해 주세요.",
    "비밀정보·브라우저 세션·로컬 인증 파일을 요청하거나 출력하지 마세요.",
    "",
    "사용자 요청:",
    prompt,
  ].join("\n");
}

function siteCodexTerminalCommand(cloudPrompt, environmentId = "<ENV_ID>") {
  const safePrompt = String(cloudPrompt || "").replace(/^'@$/gm, "' @");
  const safeEnvironment = String(environmentId || "<ENV_ID>").replace(/[^a-zA-Z0-9_-]/g, "") || "<ENV_ID>";
  return [
    "$codexTask = @'",
    safePrompt,
    "'@",
    `codex cloud exec --env '${safeEnvironment}' --attempts 1 $codexTask`,
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

function AIChatbot({ onNav, guideSignal = 0 }) {
  const [launcher, setLauncher] = useState("");
  const [visible, setVisible] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState("Codex Cloud 작업 대기");
  const [githubPanelOpen, setGithubPanelOpen] = useState(false);
  const [githubState, setGithubState] = useState({ state: "idle", conclusion: "" });
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [log, setLog] = useState([{
    id: "boot", role: "system", label: "READY",
    text: "처음 사용하면 /guide · Cloud 작업은 /cloud · 사이트 내부 검색은 /search · 전달 상태는 /status",
    commands: SITE_CODEX_QUICK_COMMANDS,
  }]);
  const launcherRef = useRef(null);
  const terminalInputRef = useRef(null);
  const outputRef = useRef(null);
  const pollTimerRef = useRef(null);
  const guideSignalRef = useRef(0);

  const append = entry => setLog(current => [
    ...current,
    { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, ...entry },
  ]);

  useEffect(() => {
    if (!guideSignal || guideSignalRef.current === guideSignal) return;
    guideSignalRef.current = guideSignal;
    setVisible(true);
    append(siteCliGuidePayload());
    setTimeout(() => terminalInputRef.current?.focus(), 40);
  }, [guideSignal]);

  const chooseCommand = command => {
    setInput(command);
    setTimeout(() => terminalInputRef.current?.focus(), 0);
  };

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
        label: "CLOUD DELIVERY CHECK",
        text: `공개 GitHub API와 PR 검증 워크플로 확인 · 최근 상태 ${next.conclusion} · Codex Cloud 연결 상태는 작업 화면에서 확인`,
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
        if (current.state === "registered") setActivity(`Codex Cloud 실행문 준비 · Issue #${current.issue.number}`);
        if (current.state === "cloud-ready") {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setBusy(false);
          setActivity("Codex Cloud 실행 준비 완료");
          append({
            role: "assistant",
            label: "CODEX CLOUD",
            text: `GitHub Issue #${current.issue.number} 등록 완료 · 실행문을 복사해 Codex Cloud에서 작업 시작 · 수정 요청은 Pull Request로 검토`,
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
      text: `${mode === "edit" ? "수정" : "질의"} 요청 ${requestId}\n1. 열린 GitHub 화면에서 Submit new issue 클릭\n2. cloud-ready 댓글 확인\n3. ${copied ? "복사된 실행문을" : "실행문 복사 버튼을 누르고"} Codex Cloud에 붙여넣기\n4. 수정 요청은 Pull Request와 Actions 결과 검토 후 병합`,
      links: [
        ["GitHub 요청 열기", url],
        ["Codex Cloud 열기", SITE_CODEX_CLOUD],
      ],
      copyValue: cloudPrompt,
    });
    pollGithubRequest(requestId);
  };

  const startCodexCloudTask = async (prompt, mode = "edit") => {
    const requestId = siteCodexRequestId();
    const cloudPrompt = siteCodexCloudPrompt(prompt, mode, requestId);
    const environmentId = localStorage.getItem("site-codex-environment") || "ENV_ID";
    const cliCommand = siteCodexTerminalCommand(cloudPrompt, environmentId);
    localStorage.setItem("site-codex-last-request", requestId);
    localStorage.setItem(`site-codex-prompt-${requestId}`, cloudPrompt);

    window.open(SITE_CODEX_CLOUD, "_blank", "noopener,noreferrer");
    let copied = false;
    try {
      await navigator.clipboard?.writeText(cloudPrompt);
      copied = true;
    } catch {}

    setActivity("Codex Cloud 작업 화면 열림");
    append({
      role: "assistant",
      label: "CODEX CLOUD TASK",
      text: `${mode === "edit" ? "수정" : "분석"} 작업 ${requestId}\n${copied ? "실행문 복사 완료" : "아래 실행문 복사 필요"} · 열린 Codex Cloud에서 ${SITE_CODEX_REPO} 환경을 선택하고 붙여넣어 실행\n완료 후 파일 차이와 검증 결과를 확인하고 수정 작업은 main 대상 Pull Request로 제안`,
      links: [
        ["Codex Cloud 다시 열기", SITE_CODEX_CLOUD],
        ["연결 환경 확인", SITE_CODEX_ENVIRONMENTS],
      ],
      copyValue: cloudPrompt,
      cliValue: cliCommand,
    });
  };

  const checkLatestDelivery = async () => {
    setBusy(true);
    setActivity("Pull Request와 Actions 확인");
    try {
      const headers = { Accept: "application/vnd.github+json" };
      const [pullResponse, runResponse] = await Promise.all([
        fetch(`${SITE_CODEX_API}/pulls?state=all&sort=updated&direction=desc&per_page=1`, { cache: "no-store", headers }),
        fetch(`${SITE_CODEX_API}/actions/workflows/site-codex.yml/runs?per_page=1`, { cache: "no-store", headers }),
      ]);
      if (!pullResponse.ok || !runResponse.ok) throw new Error(`GitHub API ${pullResponse.status}/${runResponse.status}`);
      const [pulls, runs] = await Promise.all([pullResponse.json(), runResponse.json()]);
      const pull = pulls[0];
      const run = runs.workflow_runs?.[0];
      const pullState = pull ? `PR #${pull.number} · ${pull.state}${pull.merged_at ? " · merged" : ""} · ${pull.head?.ref || "브랜치 확인"}` : "Pull Request 없음";
      const runState = run ? `${run.name} · ${run.conclusion || run.status}` : "Actions 실행 이력 없음";
      append({
        role: "assistant",
        label: "DELIVERY STATUS",
        text: `${pullState}\n${runState}`,
        links: [
          [pull ? `PR #${pull.number} 열기` : "Pull Request 목록", pull?.html_url || `${SITE_CODEX_WEB}/pulls`],
          ["Actions 열기", run?.html_url || `${SITE_CODEX_WEB}/actions`],
        ],
      });
      setActivity("전달 상태 확인 완료");
    } catch (error) {
      append({ role: "error", label: "DELIVERY STATUS", text: `${error.message} · GitHub Pull Request와 Actions 화면에서 직접 확인` });
      setActivity("전달 상태 확인 실패");
    } finally {
      setBusy(false);
    }
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
    let command = commandMatch ? commandMatch[1].toLowerCase() : "ask";
    const args = commandMatch ? commandMatch[2].trim() : raw;
    if (!commandMatch && ["help", "도움말", "?"].includes(raw.toLowerCase())) command = "help";

    if (command === "help") {
      append({ role: "system", label: "COMMANDS", text: "명령을 선택하거나 직접 입력 · Tab 자동완성 · ↑/↓ 이전 명령 · Enter 실행 · Shift+Enter 줄바꿈", commands: SITE_CODEX_COMMANDS });
      return;
    }
    if (command === "guide") {
      append(siteCliGuidePayload());
      return;
    }
    if (command === "examples") {
      append({ role: "system", label: "RUNNABLE EXAMPLES", text: "예시를 선택하면 입력창에 채워짐 · 내용 확인 후 Enter로 실행", examples: SITE_CODEX_EXAMPLES });
      return;
    }
    if (command === "clear") { setLog([]); return; }
    if (command === "export") { exportSession(); append({ role: "system", label: "EXPORT", text: "Markdown 작업 기록 저장" }); return; }
    if (command === "connect") { setGithubPanelOpen(true); checkGithubBridge(true); return; }
    if (command === "doctor") {
      await checkGithubBridge(true);
      return;
    }
    if (command === "status") {
      await checkLatestDelivery();
      return;
    }
    if (command === "env") {
      if (!args) {
        const saved = localStorage.getItem("site-codex-environment");
        append({ role: saved ? "assistant" : "system", label: "CLOUD ENV", text: saved ? `저장된 환경 ID · ${saved}` : "환경 ID 미설정 · Codex Cloud 설정에서 환경 ID를 확인한 뒤 /env <환경 ID> 실행" });
        return;
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(args)) {
        append({ role: "error", label: "CLOUD ENV", text: "환경 ID는 영문·숫자·하이픈·밑줄만 입력 가능" });
        return;
      }
      localStorage.setItem("site-codex-environment", args);
      append({ role: "assistant", label: "CLOUD ENV", text: `터미널 명령용 환경 ID 저장 · ${args}\n민감정보가 아닌 환경 식별자만 이 브라우저에 저장됨` });
      return;
    }
    if (command === "tasks") {
      const environmentId = localStorage.getItem("site-codex-environment") || "ENV_ID";
      const cliValue = `codex cloud list --env '${environmentId}' --limit 10`;
      append({
        role: "assistant",
        label: "CODEX CLI",
        text: `${environmentId === "ENV_ID" ? "/env <환경 ID>를 먼저 실행하면 " : ""}터미널에서 최근 Codex Cloud 작업 10개 조회`,
        links: [["Codex Cloud 열기", SITE_CODEX_CLOUD]],
        cliValue,
      });
      return;
    }
    if (SITE_CODEX_GITHUB_PAGES[command]) {
      const [label, url] = SITE_CODEX_GITHUB_PAGES[command];
      append({ role: "assistant", label, text: `${SITE_CODEX_REPO} GitHub 화면`, url, actionLabel: "GitHub에서 열기" });
      return;
    }
    if (command === "open") { openSection(args); return; }
    if (command === "sync") {
      const requestId = args || localStorage.getItem("site-codex-last-request");
      if (!requestId) append({ role: "error", label: "SYNC", text: "요청 ID 또는 Issue 번호 입력 필요" });
      else pollGithubRequest(requestId);
      return;
    }
    if (!["search", "company", "market", "ask", "edit", "cloud", "issue"].includes(command)) {
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

    if (command === "issue") {
      const approved = window.confirm("공개 GitHub Issue에 요청을 기록합니다\n\n비밀정보나 개인정보가 포함되지 않았는지 확인해 주세요\n\nIssue 작성 화면을 열까요");
      if (!approved) {
        append({ role: "system", label: "ISSUE CANCEL", text: "GitHub 요청 기록 취소" });
        return;
      }
      await submitGithubRequest(args, "edit");
      return;
    }

    const mode = command === "ask" ? "ask" : "edit";
    if (mode === "edit") {
      const approved = window.confirm("연결된 Codex Cloud에서 새 브랜치 작업을 준비합니다\n\n실행문을 복사하고 Cloud 작업 화면을 열며, 결과는 main 대상 Pull Request로 제안합니다\n\n계속할까요");
      if (!approved) {
        append({ role: "system", label: "CLOUD CANCEL", text: "Codex Cloud 작업 준비 취소 · 저장소 변경 없음" });
        return;
      }
    }
    await startCodexCloudTask(args, mode);
  };

  const onTerminalKey = event => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); execute(input); return; }
    if (event.key === "Tab") {
      const completed = completeSiteCliCommand(input);
      if (completed !== input) { event.preventDefault(); setInput(completed); }
      return;
    }
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
          onKeyDown={event => {
            if (event.key === "Tab") {
              const completed = completeSiteCliCommand(launcher);
              if (completed !== launcher) { event.preventDefault(); setLauncher(completed); }
            }
            if (event.key === "Enter") { event.preventDefault(); launcher.trim() ? execute(launcher) : setVisible(true); }
          }}
          placeholder="/cloud 요청 · /search · /status"
          name="site-cli-command"
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
                <div><b>SITE CODEX</b><small>CODEX CLOUD · GITHUB · PULL REQUEST</small></div>
              </div>
              <div className="site-cli-status">
                <span>SITE INDEX</span>
                <span className={githubState.state === "ready" ? "is-on" : ""}>GITHUB API</span>
                <span>PR REVIEW</span>
              </div>
              <button className="site-cli-close" onClick={() => setVisible(false)} title="닫기"><Icon name="x" size={17} sw={2} /></button>
            </header>

            <div className="site-cli-flow" aria-hidden="true">
              <span>SITE REQUEST</span><i /><span>CODEX CLOUD</span><i /><span>BRANCH + PR</span><i /><span>ACTIONS</span>
            </div>

            <div className="site-cli-output" ref={outputRef} data-preserve-copy="true">
              {log.map(item => (
                <article key={item.id} className={`site-cli-line ${item.role}`}>
                  <div className="site-cli-line-head">
                    <span>{item.label}</span>
                    {item.role !== "user" && item.text && <button onClick={() => copyText(item.text)} title="복사"><Icon name="copy" size={12} /></button>}
                  </div>
                  {item.text && <pre data-preserve-copy="true">{item.text}</pre>}
                  {(item.url || item.links?.length > 0 || item.copyValue || item.cliValue) && (
                    <div className="site-cli-link-row">
                      {item.url && <a className="site-cli-link" href={item.url} target="_blank" rel="noreferrer">{item.actionLabel || "GitHub에서 열기"} ↗</a>}
                      {item.links?.map(([label, url]) => <a key={`${label}-${url}`} className="site-cli-link" href={url} target="_blank" rel="noreferrer">{label} ↗</a>)}
                      {item.copyValue && <button className="site-cli-link" onClick={() => copyText(item.copyValue)}><Icon name="copy" size={11} /> 실행문 복사</button>}
                      {item.cliValue && <button className="site-cli-link" onClick={() => copyText(item.cliValue)}><Icon name="copy" size={11} /> CLI 명령 복사</button>}
                    </div>
                  )}
                  {item.commands && (
                    <div className="site-cli-command-grid">
                      {item.commands.map(([cmd, desc]) => <button key={cmd} onClick={() => chooseCommand(cmd.endsWith(" ") ? cmd : `${cmd.split(" ")[0]} `)}><code>{cmd}</code><span>{desc}</span></button>)}
                    </div>
                  )}
                  {item.steps?.length > 0 && (
                    <ol className="site-cli-steps">
                      {item.steps.map(([step, title, desc]) => <li key={step}><span>{step}</span><div><b>{title}</b><p>{desc}</p></div></li>)}
                    </ol>
                  )}
                  {item.examples?.length > 0 && (
                    <div className="site-cli-examples">
                      {item.examples.map(example => <button key={example} onClick={() => chooseCommand(example)}><code>{example}</code><span>입력</span></button>)}
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
                <div className="site-cli-config-title"><b>CODEX CLOUD · CONNECTED REPOSITORY</b><span>연결된 저장소 환경에서 작업 · Actions Secret 없이 실행</span></div>
                <div className={`site-cli-github-card ${githubState.state === "ready" ? "is-ready" : ""}`}>
                  <b>{githubState.state === "ready" ? "GITHUB DELIVERY ONLINE" : "DELIVERY CONNECTION"}</b>
                  <span>Codex Cloud는 작업 실행 · Pull Request는 변경 검토 · Actions는 자동 검증</span>
                </div>
                <div className="site-cli-github-links">
                  {SITE_CODEX_LINKS.map(([step, label, url]) => <a key={url} href={url} target="_blank" rel="noreferrer"><span>{step}</span><b>{label}</b><Icon name="ext" size={12} /></a>)}
                </div>
                <p>연결된 Codex Cloud 환경을 사용 · 사이트는 로그인 세션이나 API 키에 접근하지 않음 · /cloud 실행 시 작업 화면을 열고 실행문을 복사 · 수정 결과는 main 직접 반영 없이 Pull Request로 제안 · /issue는 공개 기록이 필요할 때만 선택</p>
                <div className="site-cli-config-actions">
                  <button onClick={() => setGithubPanelOpen(false)}>닫기</button>
                  <button className="primary" onClick={() => checkGithubBridge(true)}>브리지 확인</button>
                </div>
              </div>
            )}

            <nav className="site-cli-shortcuts" aria-label="CLI 빠른 명령">
              <span>QUICK</span>
              {SITE_CODEX_QUICK_COMMANDS.map(([command, label]) => (
                <button key={command} onClick={() => chooseCommand(command)}><code>{command.trim()}</code><em>{label}</em></button>
              ))}
            </nav>

            <footer className="site-cli-input-row">
              <span>github-codex&nbsp;$</span>
              <textarea
                ref={terminalInputRef}
                value={input}
                onChange={event => setInput(event.target.value)}
                onKeyDown={onTerminalKey}
                placeholder="/cloud 요청으로 시작 · Tab 자동완성 · ↑/↓ 명령 기록"
                name="site-cli-terminal-command"
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
