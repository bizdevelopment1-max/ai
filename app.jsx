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
  const [crawled, setCrawled] = uS(null);
  uE(() => {
    let alive = true;
    fetch("news.json", { cache: "no-store" })
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
  const articles = useMemo(() => {
    const base = (D.ARTICLES || []).map(reclassCo);
    if (!crawled || !crawled.length) return base;
    const seen = new Set(base.map(a => (a.co || "") + "|" + a.title));
    const extra = crawled.map(reclassCo).filter(a => a && a.title && !seen.has((a.co || "") + "|" + a.title));
    return [...extra, ...base];
  }, [crawled]);

  // real daily stock prices + market cap (stocks.json, refreshed daily by GitHub Action)
  const [stockData, setStockData] = uS(null);
  uE(() => {
    let alive = true;
    fetch("stocks.json", { cache: "no-store" })
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
    overview: uR(null), articles: uR(null), native: uR(null), bigtech: uR(null), startup: uR(null),
    charts: uR(null), monthly: uR(null), insights: uR(null), signals: uR(null), dynamics: uR(null), bizmodel: uR(null), reports: uR(null), stocks: uR(null),
  };

  uE(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);

  const navTo = id => {
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
      let cur = "overview";
      for (const id of Object.keys(refs)) {
        const el = refs[id].current;
        if (el && el.offsetTop <= y) cur = id;
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
  const renderTime = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

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
            {/* Overview — market-level only */}
            <section ref={refs.overview} data-screen-label="Overview">
              <div className="ov-head">
                <h2 className="ov-title">Executive Summary</h2>
              </div>
              <KpiStrip kpis={D.KPIS} />
              <OverviewCharts data={D} cats={cats} theme={chartTheme} />
            </section>

            <ArticleFeed articles={articles} cats={cats} sectionRef={refs.articles} filter={feedFilter} onFilter={setFeedFilter} query={query} />

            <CompanyBoard cat={cats[0]} companies={D.COMPANIES} density={t.density} sectionRef={refs.native} query={query} onSelect={setSelected} />
            <CompanyBoard cat={cats[1]} companies={D.COMPANIES} density={t.density} sectionRef={refs.bigtech} query={query} onSelect={setSelected} />
            <CompanyBoard cat={cats[2]} companies={D.COMPANIES} density={t.density} sectionRef={refs.startup} query={query} onSelect={setSelected} />

            <ChartsBoard data={D} cats={cats} theme={chartTheme} sectionRef={refs.charts} />

            <MonthlyTrendsBoard data={D} cats={cats} theme={chartTheme} sectionRef={refs.monthly} />

            <InsightsBoard insights={D.INSIGHTS} sectionRef={refs.insights} />

            <SignalBoard data={D} theme={chartTheme} sectionRef={refs.signals} />

            <DynamicsBoard companies={D.COMPANIES} cats={cats} sectionRef={refs.dynamics} />

            <BizModelBoard companies={D.COMPANIES} cats={cats} sectionRef={refs.bizmodel} theme={chartTheme} />

            <ReportsBoard reports={D.REPORTS} sectionRef={refs.reports} query={query} />

            <StockBoard stocks={D.STOCKS} stockData={stockData} cats={cats} sectionRef={refs.stocks} theme={chartTheme} />

            <footer className="foot">
              <span>AI Intelligence Dashboard</span>
              <span className="foot-update">자료 기준일: 2026-06-17 · 최종 팩트체크: 2026-06-17 · 렌더링: {renderTime}</span>
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
function softTint(hex, dark) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  if (dark) return `rgba(${r},${g},${b},0.18)`;
  const mix = (c) => Math.round(c + (255 - c) * 0.88);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
