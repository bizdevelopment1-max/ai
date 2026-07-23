/* ============================================================
   app.jsx — state, theming, nav, tweaks
   ============================================================ */
const { useState: uS, useRef: uR, useEffect: uE, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "density": "regular",
  "sidebar": "#4322A8",
  "colNative": "#7A38D6",
  "colBigtech": "#1428A0",
  "colStartup": "#0E8F6E"
}/*EDITMODE-END*/;

// concrete palettes for SVG charts
const PALETTE = {
  light: { ink: "#0E1525", muted: "#8A93A4", grid: "#EAEDF3" },
  dark: { ink: "#E8ECF4", muted: "#6F7B90", grid: "#1E2636" },
};

const COLOR_PRESETS = [
  { sidebar: "#4322A8", colNative: "#7A38D6", colBigtech: "#1428A0", colStartup: "#0E8F6E" },
  { sidebar: "#0B1F4D", colNative: "#9333EA", colBigtech: "#0F62FE", colStartup: "#0A9D8E" },
  { sidebar: "#1428A0", colNative: "#C026D3", colBigtech: "#2D6BFF", colStartup: "#16A34A" },
  { sidebar: "#0A6E63", colNative: "#6D28D9", colBigtech: "#1668E3", colStartup: "#0891B2" },
  { sidebar: "#10131C", colNative: "#7A38D6", colBigtech: "#1428A0", colStartup: "#0E8F6E" },
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [brandIdx, setBrandIdx] = uS(0);
  const [colorIdx, setColorIdx] = uS(0);
  const [active, setActive] = uS("overview");
  const [query, setQuery] = uS("");
  const [feedFilter, setFeedFilter] = uS("all");
  const [selected, setSelected] = uS(null);
  const [sidebarOpen, setSidebarOpen] = uS(false);
  const [collapsed, setCollapsed] = uS(false);

  const D = window.DASH;
  const dark = t.dark;

  // crawler output: news.json (refreshed daily ~07:00 by GitHub Action) merged over static ARTICLES
  // 캐시버스터: GitHub Pages CDN(edge)은 URL 기준 캐시 → 분 단위 쿼리스트링으로 항상 최신 파일을 받게 함
  const cb = () => `?t=${Math.floor(Date.now() / 60000)}`;   // 1분 단위 — 매일 갱신분 즉시 반영
  const [crawled, setCrawled] = uS(null);
  uE(() => {
    let alive = true;
    fetch("news.json" + cb(), { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j && Array.isArray(j.articles)) setCrawled(j.articles); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  // device-topic articles (co "AI 노트북"/"AI 폰")을 제목 기준으로 실제 업체에 재분류, 매칭 없으면 co 제거
  const DEVICE_CO_MAP = [
    [/iphone|ipad|siri|apple intelligence|\bapple\b|macbook|\bm[0-9] |vision pro/i, "Apple"],
    [/copilot\+|surface|windows|\bmicrosoft\b|\bms\b/i, "Microsoft"],
    [/nvidia|geforce|\brtx\b|n1x|\bgb10\b|project digits|jetson/i, "NVIDIA"],
    [/pixel|gemini|\bgoogle\b|android|tensor/i, "Google DeepMind"],
    [/\bmeta\b|llama|ray-ban|quest/i, "Meta AI"],
  ];
  const reclassCo = (a) => {
    if (a.co !== "AI 노트북" && a.co !== "AI 폰") return a;
    const hit = DEVICE_CO_MAP.find(([re]) => re.test(a.title || ""));
    return { ...a, co: hit ? hit[1] : "" };   // 매칭되는 업체로, 없으면 업체 미지정(드롭다운 미노출)
  };
  // 데일리 기사: 제목+요약이 있으면 표시(크롤러가 한글 번역 우선, 번역 불가 시 영문 폴백)
  // 화면 노출 금지어 최종 방어선 — 크롤 데이터에 섞여 들어와도 렌더 전 차단
  const BANNED_RE = /삼성|samsung|갤럭시|galaxy|\bMX\b/i;
  const articles = useMemo(() => {
    const base = (D.ARTICLES || []).map(reclassCo);
    if (!crawled || !crawled.length) return base;
    const seen = new Set(base.map(a => (a.co || "") + "|" + a.title));
    const extra = crawled.map(reclassCo)
      .filter(a => a && a.title && a.summary && !seen.has((a.co || "") + "|" + a.title))
      .filter(a => !BANNED_RE.test((a.title || "") + " " + (a.summary || "")));
    return [...extra, ...base];
  }, [crawled]);

  // 매일 갱신되는 '오늘의 톱라인' 인사이트(insights.json, 규칙 기반). 없으면 정적 TOPLINE 폴백.
  const [insights, setInsights] = uS(null);
  uE(() => {
    let alive = true;
    fetch("insights.json" + cb(), { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j && Array.isArray(j.cards) && j.cards.length) setInsights(j); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // 매일 자동 생성되는 모닝 브리핑(briefing.json) + 주간 스타트업 레이더(radar.json)
  const [briefing, setBriefing] = uS(null);
  // 증권사 리서치(research.json)·기업 라이브(companies.json)·데이터 감사(audit.json)
  const [research, setResearch] = uS(null);
  const [coLive, setCoLive] = uS(null);
  const [audit, setAudit] = uS(null);
  const [startupsX, setStartupsX] = uS(null);
  uE(() => {
    let alive = true;
    fetch("research.json" + cb(), { cache: "no-store" }).then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j && (j.onepager || (j.feed || []).length)) setResearch(j); }).catch(() => {});
    fetch("companies.json" + cb(), { cache: "no-store" }).then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j && j.companies) setCoLive(j.companies); }).catch(() => {});
    fetch("audit.json" + cb(), { cache: "no-store" }).then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j && j.checks) setAudit(j); }).catch(() => {});
    fetch("startups.json" + cb(), { cache: "no-store" }).then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j && (j.large || j.small)) {
        const m = {};
        (j.large || []).forEach(x => { m[x.name] = { overview: x.businessModel, insight: x.partnership, label: x.label, tier: "large" }; });
        (j.small || []).forEach(x => { m[x.name] = { overview: x.overview, insight: x.acqAngle, label: x.label, tier: "small" }; });
        setStartupsX(m);
      } }).catch(() => {});
    return () => { alive = false; };
  }, []);
  // COMPANIES에 라이브 데이터(최신 기사·언급량·실시세 시총) 병합
  const companiesLive = useMemo(() => (D.COMPANIES || []).map(c => {
    const lv = coLive && coLive[c.name];
    const strat = startupsX && (startupsX[c.name] || startupsX[c.name.replace(/\s*\(.*\)/, "")]);
    if (!lv && !strat) return c;
    const merged = { ...c };
    if (lv) { merged.live = lv; if (lv.cap && lv.capAsof) { merged.valuation = lv.cap.replace(/ \(시나리오\)/, ""); merged.valAsof = lv.capAsof.slice(2, 7).replace("-", "."); } }
    if (strat) merged.strategy = strat;
    return merged;
  }), [coLive, startupsX]);
  uE(() => {
    let alive = true;
    fetch("briefing.json" + cb(), { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j && Array.isArray(j.days) && j.days.length) setBriefing(j); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // real daily stock prices + market cap (stocks.json, refreshed daily by GitHub Action)
  const [stockData, setStockData] = uS(null);
  uE(() => {
    let alive = true;
    fetch("stocks.json" + cb(), { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j && j.stocks) setStockData({ ...j.stocks, __generatedAt: j.generatedAt }); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // category objects with tweakable accents
  const cats = useMemo(() => D.CATEGORIES.map(c => ({
    ...c,
    accent: c.id === "native" ? t.colNative : c.id === "bigtech" ? t.colBigtech : t.colStartup,
    accentSoft: softTint(c.id === "native" ? t.colNative : c.id === "bigtech" ? t.colBigtech : t.colStartup, dark),
  })), [t.colNative, t.colBigtech, t.colStartup, dark]);

  // AI 밸류체인 주가 카테고리(칩·메모리·하이퍼스케일러 등) — 고정 accent + 다크모드 soft tint
  const stockGroups = useMemo(() => (D.STOCK_GROUPS || []).map(g => ({
    ...g,
    accentSoft: softTint(g.accent, dark),
  })), [dark]);

  // sidebar brand: explicit cycle overrides tweak default
  const brand = brandIdx === 0
    ? { name: (BRANDS.find(b => b.bg === t.sidebar) || BRANDS[0]).name, bg: t.sidebar }
    : BRANDS[brandIdx];

  // theme for charts
  const pal = dark ? PALETTE.dark : PALETTE.light;
  const chartTheme = { ...pal, accent: t.colNative };

  // section refs
  const scrollRef = uR(null);
  const refs = {
    ib: uR(null), overview: uR(null), briefing: uR(null), articles: uR(null), native: uR(null), bigtech: uR(null), startup: uR(null),
    sanalysis: uR(null), charts: uR(null), monthly: uR(null), signals: uR(null), bizmodel: uR(null), reports: uR(null), stocks: uR(null), market: uR(null),
  };

  uE(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);

  // 일부 Q&A는 통합·이동된 섹션을 가리킴: dynamics→overview(경쟁구도가 ES로 이동), insights→reports
  const NAV_ALIAS = { dynamics: "overview", insights: "ib", reports: "ib" };
  const navTo = rawId => {
    const id = NAV_ALIAS[rawId] || rawId;
    setActive(id);
    const el = refs[id] && refs[id].current;
    const sc = scrollRef.current;
    if (el && sc) sc.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" });
  };

  // scroll-spy
  uE(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const onScroll = () => {
      const y = sc.scrollTop + 80;
      let cur = "overview", best = -1;
      for (const id of Object.keys(refs)) {
        const el = refs[id].current;
        if (el && el.offsetTop <= y && el.offsetTop > best) { best = el.offsetTop; cur = id; }
      }
      setActive(cur);
    };
    sc.addEventListener("scroll", onScroll, { passive: true });
    return () => sc.removeEventListener("scroll", onScroll);
  }, []);

  // board fold/unfold: click a board header (not its buttons) to collapse the card
  uE(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const onClick = (e) => {
      const head = e.target.closest(".board-head");
      if (!head || e.target.closest("button, a, input")) return;
      const board = head.closest(".board");
      if (board) board.classList.toggle("folded");
    };
    sc.addEventListener("click", onClick);
    return () => sc.removeEventListener("click", onClick);
  }, []);

  const cycleBrand = () => {
    setBrandIdx(p => (p + 1) % BRANDS.length);
  };

  const cycleColor = () => {
    const next = (colorIdx + 1) % COLOR_PRESETS.length;
    setColorIdx(next);
    const p = COLOR_PRESETS[next];
    setTweak("sidebar", p.sidebar);
    setTweak("colNative", p.colNative);
    setTweak("colBigtech", p.colBigtech);
    setTweak("colStartup", p.colStartup);
    setBrandIdx(0);
  };

  // random next palette (used when the sidebar is folded by an empty-area click)
  const randomColor = () => {
    let next = colorIdx;
    if (COLOR_PRESETS.length > 1) { while (next === colorIdx) next = Math.floor(Math.random() * COLOR_PRESETS.length); }
    setColorIdx(next);
    const p = COLOR_PRESETS[next];
    setTweak("sidebar", p.sidebar);
    setTweak("colNative", p.colNative);
    setTweak("colBigtech", p.colBigtech);
    setTweak("colStartup", p.colStartup);
    setBrandIdx(0);
  };

  // empty-area click: fold/unfold the bar AND shift to the next random color
  const onSidebarBg = () => {
    randomColor();
    if (window.matchMedia && window.matchMedia("(max-width: 820px)").matches) {
      setSidebarOpen(false);
    } else {
      setCollapsed(c => !c);
    }
  };

  const latestArticleDate = articles.reduce((m, a) => (a.date > m ? a.date : m), "");
  const articleCount = articles.filter(a => a.date === latestArticleDate).length;
  const now = new Date();
  const p2 = n => String(n).padStart(2, "0");
  const renderTime = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}`;

  return (
    <div className={"app d-" + t.density}>
      <Sidebar
        active={active} onNav={id => { navTo(id); }} brand={brand}
        onLogo={() => navTo("overview")} onBgClick={onSidebarBg} collapsed={collapsed}
        articleCount={articleCount} companies={D.COMPANIES} cats={cats} onSelectCompany={c => { setSelected(c); }}
        open={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)}
      />

      <div className="shell">
        <TopBar dark={dark} onTheme={() => setTweak("dark", !dark)}
          onMenuToggle={() => setSidebarOpen(o => !o)} onColorCycle={cycleColor} onNav={navTo} />

        <main className="main" ref={scrollRef}>
          <div className="main-inner">
            {/* ── 0. 증권사 인사이트(IB Research 1페이저 + 기관 피드) ── */}
            <IBInsightBoard research={research} reports={D.REPORTS} sectionRef={refs.ib} />

            {/* ── 1. 개요 ── */}
            <section ref={refs.overview} data-screen-label="Overview">
              <div className="ov-head">
                <h2 className="ov-title">Executive Summary</h2>
              </div>
              <ExecToplines items={D.TOPLINE} insights={insights} onNav={navTo} />
              <ESCompetitiveMap companies={D.COMPANIES} cats={cats} articles={articles} />
            </section>

            <BriefingBoard briefing={briefing} sectionRef={refs.briefing} />

            <ArticleFeed articles={articles} cats={cats} sectionRef={refs.articles} filter={feedFilter} onFilter={setFeedFilter} query={query} />

            {/* ── 2. 기업 동향 ── */}
            <CompanyBoard cat={cats[0]} companies={companiesLive} density={t.density} sectionRef={refs.native} query={query} onSelect={setSelected} />
            <CompanyBoard cat={cats[1]} companies={companiesLive} density={t.density} sectionRef={refs.bigtech} query={query} onSelect={setSelected} />
            <CompanyBoard cat={cats[2]} companies={companiesLive} density={t.density} sectionRef={refs.startup} query={query} onSelect={setSelected} />
            <StartupScopeBoard sectionRef={refs.sanalysis} />

            {/* ── 3. 심층 분석 (수익화 모델 최상단) ── */}
            <BizModelBoard companies={D.COMPANIES} cats={cats} sectionRef={refs.bizmodel} theme={chartTheme} />
            <SignalBoard data={D} theme={chartTheme} sectionRef={refs.signals} />

            {/* ── 4. 정량 데이터 ── */}
            <ChartsBoard data={D} cats={cats} theme={chartTheme} sectionRef={refs.charts} />
            <MonthlyTrendsBoard data={D} cats={cats} theme={chartTheme} sectionRef={refs.monthly} />
            <StockBoard stocks={D.STOCKS} stockData={stockData} cats={cats} groups={stockGroups} sectionRef={refs.stocks} theme={chartTheme} />
            <MarketBoard sectionRef={refs.market} />

            <AuditPanel audit={audit} />

            <footer className="foot">
              <span>AI Intelligence Dashboard</span>
              <span className="foot-update">최종 업데이트: {renderTime}</span>
              <span>원출처: Bloomberg · TechCrunch · The Information · Pitchbook · Crunchbase · 각 기업 공식 발표</span>
            </footer>
          </div>
        </main>
      </div>

      <CompanyDetail company={selected} cats={cats} articles={articles} onClose={() => setSelected(null)} />

      {/* Color change via palette button in TopBar */}
    </div>
  );
}

// soft tint of a hex color for chips/backgrounds
// ---- 데이터 감사 패널: audit-agent.mjs 산출물(audit.json) 표시 ----
function AuditPanel({ audit }) {
  const [open, setOpen] = uS(false);
  if (!audit) return null;
  const C = { ok: "#16A34A", warn: "#EA580C", fail: "#D23B3B" };
  return (
    <div className="audit-wrap">
      <button className="audit-chip" onClick={() => setOpen(o => !o)} title="데이터 파이프라인 감사 상태">
        <i style={{ background: C[audit.overall] || "#8A93A4" }} />
        데이터 감사 {audit.overall === "ok" ? "정상" : audit.overall === "warn" ? "주의" : "실패"} · {audit.summary}
      </button>
      {open && (
        <div className="audit-panel">
          {audit.checks.map(c => (
            <div className="audit-row" key={c.file}>
              <i style={{ background: C[c.status] || "#8A93A4" }} />
              <b>{c.tab}</b>
              <span className="audit-meta">{c.items}건 · {c.ageDays}일 전{c.engine ? ` · ${c.engine}` : ""}</span>
              {c.issues.length > 0 && <span className="audit-issues">{c.issues.join(" / ")}</span>}
            </div>
          ))}
          <p className="audit-note">감사 에이전트(audit-agent.mjs)가 매 크롤 후 자동 검사 — 신선도·커버리지·엔진·중복·금지어</p>
        </div>
      )}
    </div>
  );
}

function softTint(hex, dark) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  if (dark) return `rgba(${r},${g},${b},0.18)`;
  const mix = (c) => Math.round(c + (255 - c) * 0.88);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
