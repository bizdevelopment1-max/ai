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

// Keep a stable wrapper for navigation and mount each heavy board before it
// reaches the viewport. Once mounted it stays warm, so later navigation is
// immediate without paying the full DOM cost during first paint.
function LazySection({ id, active, sectionRef, height = 420, children }) {
  const innerRef = uR(null);
  const nearViewport = useInView(sectionRef, 120);
  const [ready, setReady] = uS(active === id);
  uE(() => {
    if (active === id) { setReady(true); return undefined; }
    if (!nearViewport || ready) return undefined;
    // Let the first screen paint before a below-fold consulting board expands
    // the DOM. Direct navigation still mounts the requested board immediately.
    const timer = window.setTimeout(() => setReady(true), 1200);
    return () => window.clearTimeout(timer);
  }, [nearViewport, active, id, ready]);
  return (
    <div ref={sectionRef} className={"board-gate" + (ready ? " is-ready" : " is-pending")}
      style={{ "--gate-height": `${height}px` }} data-section={id} data-active={active === id ? "true" : "false"}>
      {ready
        ? React.cloneElement(children, { sectionRef: innerRef })
        : <div className="board-gate-placeholder" aria-hidden="true" />}
    </div>
  );
}

// A single navigation destination can contain several mutually exclusive
// evidence boards. Each child keeps its own visibility ref so data loading and
// chart animation still happen only when that board approaches the viewport.
function SectionStack({ sectionRef, title, eyebrow, description, bodyClassName = "", children }) {
  const items = React.Children.toArray(children);
  const childRefs = uR([]);
  if (childRefs.current.length !== items.length) {
    childRefs.current = items.map((_, index) => childRefs.current[index] || React.createRef());
  }
  return (
    <section className="section-stack" ref={sectionRef} aria-label={title || undefined}>
      {title && <header className="section-stack-head">
        <span>{eyebrow}</span>
        <div><h2>{title}</h2><p>{description}</p></div>
      </header>}
      <div className={`section-stack-body${bodyClassName ? ` ${bodyClassName}` : ""}`}>
        {items.map((child, index) => React.cloneElement(child, { sectionRef: childRefs.current[index] }))}
      </div>
    </section>
  );
}

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
  const [navCategory, setNavCategory] = uS({ section: "", id: "" });
  const refs = {
    overview: uR(null), strategy: uR(null), opportunity: uR(null), valuechain: uR(null),
    newbiz: uR(null), signals: uR(null), sanalysis: uR(null), evidence: uR(null), validation: uR(null),
  };
  const startupInView = useInView(refs.sanalysis);
  const strategyInView = useInView(refs.strategy);
  const needsFullCompanyData = startupInView || active === "sanalysis" || !!selected;
  const articlesInView = useInView(refs.evidence);
  const signalsInView = useInView(refs.signals);
  const newbizInView = useInView(refs.newbiz);
  const stocksInView = useInView(refs.validation);

  const D = window.DASH;
  const dark = t.dark;
  const [dataVersion, setDataVersion] = uS("");
  const [dataGeneratedAt, setDataGeneratedAt] = uS("");
  const dataUrl = file => `${file}?v=${encodeURIComponent(dataVersion || "bootstrap")}`;
  const needsFullNews = articlesInView || signalsInView || newbizInView
    || ["evidence", "signals", "newbiz"].includes(active);

  // A tiny version manifest is the only uncacheable request. Every sizeable
  // data file is immutable for that version and can therefore be CDN-cached.
  uE(() => {
    let alive = true;
    loadJson("data-version.json", { cache: "no-store" })
      .then(j => { if (alive) { setDataVersion(j?.version || j?.generatedAt || "bootstrap"); setDataGeneratedAt(j?.generatedAt || ""); } })
      .catch(() => { if (alive) setDataVersion("bootstrap"); });
    return () => { alive = false; };
  }, []);

  // crawler output: news.json (refreshed daily by GitHub Action). No static-news fallback:
  // if provenance cannot be loaded, the feed stays empty rather than showing unverified claims.
  // 캐시버스터: GitHub Pages CDN(edge)은 URL 기준 캐시 → 분 단위 쿼리스트링으로 항상 최신 파일을 받게 함
  const [crawled, setCrawled] = uS([]);
  const [coOverview, setCoOverview] = uS(null);
  const [insights, setInsights] = uS({ cards: [], engine: "rules" });
  const [strategyView, setStrategyView] = uS(null);
  uE(() => {
    let alive = true;
    // Start the first-screen payload in parallel with data-version.json. It is
    // deliberately revalidated by URL, removing one network round trip from
    // the critical path while still showing the newest published snapshot.
    loadJson("overview-view.json", { cache: "no-store" })
      .then(j => {
        if (!alive || !j) return;
        setCrawled(Array.isArray(j.articles) ? j.articles : []);
        setCoOverview(j.companies || {});
        setInsights(j.insights || { cards: [], engine: "rules" });
      })
      .catch(() => {
        if (!alive) return;
        setCrawled([]);
        setCoOverview({});
        setInsights({ cards: [], engine: "rules" });
      });
    return () => { alive = false; };
  }, []);

  // Strategy facts are a generated view, not component copy. Load it only
  // when the section approaches the viewport or is directly requested.
  uE(() => {
    if (!dataVersion || !(strategyInView || active === "strategy")) return;
    let alive = true;
    loadJson(dataUrl("strategy-view.json"))
      .then(value => { if (alive && value?.sourceMode === "generated-from-verified-ledgers") setStrategyView(value); })
      .catch(() => { if (alive) setStrategyView(null); });
    return () => { alive = false; };
  }, [dataVersion, strategyInView, active]);

  // The complete evidence ledger is needed only by evidence-heavy views. The
  // overview and strategy screen stay on the generated compact snapshot.
  uE(() => {
    if (!dataVersion || !needsFullNews) return;
    let alive = true;
    loadJson(dataUrl("news-view.json"))
      .then(j => { if (alive) setCrawled(Array.isArray(j?.articles) ? j.articles : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [dataVersion, needsFullNews]);
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
  // 검증된 원문 페이지 발췌만 표시한다. news.json은 최신분과 과거분을
  // 누적 보존하므로, 화면은 같은 원문 기반 형식을 모두 표시한다.
  const articles = useMemo(() => {
    return crawled.map(reclassCo)
      .filter(a => a && a.title && a.summary && a.displayEligible !== false
        && a.summaryMode === "source-content-extractive" && a.provenance?.status === "source-backed");
  }, [crawled]);

  // 증권사 리서치(research.json)·기업 라이브(companies.json)
  const [research, setResearch] = uS(null);
  const [coLive, setCoLive] = uS(null);
  const [companyNews, setCompanyNews] = uS({});
  const [startupsX, setStartupsX] = uS(null);
  const [startupCatalog, setStartupCatalog] = uS([]);
  const [monet, setMonet] = uS(null);
  uE(() => {
    if (!dataVersion || !(articlesInView || active === "evidence")) return;
    let alive = true;
    loadJson(dataUrl("research-view.json"))
      .then(j => {
        const feed = (j && j.feed || []).filter(item => item.displayEligible !== false && item.provenance?.status === "source-backed");
        if (alive && feed.length) setResearch({ ...j, onepager: null, feed });
      }).catch(() => {});
    return () => { alive = false; };
  }, [dataVersion, articlesInView, active]);

  // Lower sections do not compete with the first viewport. The largest live
  // files are requested only when their respective section is near the reader.
  uE(() => {
    if (!needsFullCompanyData || !dataVersion) return;
    let alive = true;
    loadJson(dataUrl("companies.json"))
      .then(j => { if (alive && j && j.companies) setCoLive(j.companies); }).catch(() => {});
    return () => { alive = false; };
  }, [needsFullCompanyData, dataVersion]);

  // Company articles and startup monetization are detail payloads. They are
  // warmed only for the startup view or an opened company, rather than
  // competing with the executive first screen.
  const needsCompanyExtras = startupInView || active === "sanalysis" || !!selected;
  uE(() => {
    if (!needsCompanyExtras || !dataVersion) return;
    let alive = true;
    loadJson(dataUrl("company-news.json"))
      .then(j => { if (alive && j && j.companies) setCompanyNews(j.companies); }).catch(() => {});
    loadJson(dataUrl("monetization.json"))
      .then(j => { if (alive && j && Array.isArray(j.companies)) setMonet(j); }).catch(() => {});
    loadJson(dataUrl("startups.json"))
      .then(j => { if (alive && j && (j.large || j.small)) {
        const m = {};
        (j.large || []).filter(x => x.provenance?.status === "source-backed").forEach(x => { m[x.name] = { overview: x.businessModel, insight: x.partnership, label: x.label, tier: "large" }; });
        (j.small || []).filter(x => x.provenance?.status === "source-backed").forEach(x => { m[x.name] = { overview: x.overview, insight: x.acqAngle, label: x.label, tier: "small" }; });
        setStartupsX(m);
        setStartupCatalog([
          ...(j.large || []).map(item => ({ ...item, portfolioTier: "large" })),
          ...(j.small || []).map(item => ({ ...item, portfolioTier: "small" })),
          ...(j.institutional || []).map(item => ({ ...item, portfolioTier: "institutional" })),
        ]);
      } }).catch(() => {});
    return () => { alive = false; };
  }, [needsCompanyExtras, dataVersion]);

  // 지역 기업은 이름·분류만 정적 레지스트리에 두고, 공개 원문/공식 페이지로
  // 확인된 사업 내용만 화면에 합성한다. 고정된 중국 전략·인물·수치 서술은
  // 라이브 근거가 없으면 렌더링하지 않는다.
  const companiesLive = useMemo(() => (D.COMPANIES || []).map(c => {
    const companyData = coLive || coOverview || {};
    const lv = companyData[c.name];
    const strat = startupsX && (startupsX[c.name] || startupsX[c.name.replace(/\s*\(.*\)/, "")]);
    const sourceGated = new Set(["DeepSeek", "Kling AI", "Hailuo (MiniMax)"]).has(c.name);
    const sections = lv?.intelligence
      ? [lv.intelligence.currentBusiness, lv.intelligence.revenueModel, lv.intelligence.strategyDirection, lv.intelligence.investmentDirection]
      : [];
    const hasSourceEvidence = sections.some(section =>
      section?.groundingStatus === "source-grounded" &&
      Array.isArray(section.evidence) && section.evidence.some(item => /^https?:\/\//.test(item?.url || ""))
    );
    if (sourceGated && !hasSourceEvidence) return null;
    // Legacy hand-entered valuation, funding and KPI values stay in the
    // append-only ledger but do not reach the public company map.
    const merged = {
      name: c.name,
      cat: c.cat,
      group: c.group,
      domain: c.domain,
      unit: c.unit,
      url: c.url,
      valuation: "—",
      valAsof: "",
      metric: "원문 기사",
      value: "—",
      metricAsof: "",
      funding: "—",
      trend: 0,
      note: "",
      vp: "",
      direction: "",
      sources: [],
    };
    merged.profile = lv?.profile || null;
    const ly = (D.COMPANY_LAYER || {})[c.name];                    // AI 밸류체인 계층·버티컬
    merged.layer = ly ? ly.layer : null;
    merged.vchainVertical = ly ? ly.vertical : "";
    merged.adjacentLayers = ly && Array.isArray(ly.adjacent) ? ly.adjacent : [];
    merged.mobileFit = ly ? ly.fit || "medium" : "medium";
    if (sourceGated) {
      const organization = lv?.organization;
      const verifiedPeople = (organization?.executiveTeam || []).filter(person =>
        person?.verification === "verified" && /^https?:\/\//.test(person?.verificationUrl || "")
      );
      const officialPages = (organization?.officialPages || []).filter(page =>
        page?.status === "reachable" && /^https?:\/\//.test(page?.resolvedUrl || page?.url || "")
      );
      merged.org = organization ? { mission: "", leadership: [], officers: verifiedPeople, executiveTeam: verifiedPeople, officialPages, sourceMode: "official-only" } : null;
    } else {
      merged.org = lv?.organization || null;
    }
    merged.invest = null;
    // 메인 카드도 상세 팝업과 같은 최신 원문 합성 결과를 우선한다.
    // 정적 레지스트리는 회사명·분류·도메인만 담당하고, 사업/수익/방향은
    // daily pipeline의 source-grounded intelligence가 매 실행마다 교체한다.
    const intel = lv && lv.intelligence;
    if (intel) {
      merged.intelligence = intel;
      const groundedSummary = section => section?.groundingStatus === "source-grounded" ? (section.summary || "") : "";
      merged.note = groundedSummary(intel.currentBusiness);
      merged.vp = groundedSummary(intel.revenueModel);
      merged.direction = groundedSummary(intel.strategyDirection);
    }
    // 원문 기반 수익모델·사업 방향(monetization.json) — 원문 링크 신호 + 밸류체인 legend
    merged.monetize = monet
      ? { entry: (monet.companies || []).find(x => x.name === c.name) || null, models: monet.models || [], directions: monet.directions || [] }
      : null;
    if (lv) { merged.live = lv; if (lv.cap && lv.capAsof) { merged.valuation = lv.cap.replace(/ \(시나리오\)/, ""); merged.valAsof = lv.capAsof.slice(2, 7).replace("-", "."); } }
    if (strat) merged.strategy = strat;
    return merged;
  }).filter(Boolean), [coLive, coOverview, startupsX, monet]);

  // The site CLI searches the same generated records currently rendered by
  // the dashboard, so its answers advance with the crawler instead of a
  // separately maintained static index.
  uE(() => {
    window.__DASH_LIVE_DOCS = { companies: companiesLive, articles, insights, research };
    return () => { delete window.__DASH_LIVE_DOCS; };
  }, [companiesLive, articles, insights, research]);

  // 좌측 내비게이션과 본문이 동일한 분류 원장을 사용한다. 밸류체인은
  // 7개 계층, 파트너 후보는 공개 근거가 있는 분류 전체를 노출한다.
  const sectionCategories = useMemo(() => {
    const valuechain = (D.VALUE_CHAIN || []).map(layer => ({
      ...layer,
      companies: companiesLive
        .filter(company => company.layer === layer.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
    const taxonomy = D.STARTUP_TAXONOMY || [];
    const trackedNames = new Set(companiesLive.map(company => company.name.replace(/\s*\(.*\)/, "")));
    const seen = new Set();
    const classify = startup => {
      if (startup.cat && taxonomy.some(category => category.id === startup.cat)) return startup.cat;
      const vertical = String(startup.vertical || "").toLowerCase();
      return taxonomy.find(category => (category.match || []).some(term => vertical.includes(String(term).toLowerCase())))?.id || "";
    };
    const candidates = startupCatalog.filter(startup => {
      if (!startup?.name || seen.has(startup.name)) return false;
      if (trackedNames.has(startup.name.replace(/\s*\(.*\)/, ""))) return false;
      const status = startup.provenance?.status;
      if (status !== "source-backed" && status !== "source-linked") return false;
      seen.add(startup.name);
      return true;
    });
    const sanalysis = taxonomy.map(category => ({
      ...category,
      companies: candidates.filter(startup => classify(startup) === category.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
    return { valuechain, sanalysis };
  }, [companiesLive, startupCatalog]);
  uE(() => {
    if (!selected || !coLive) return;
    const hydrated = companiesLive.find(company => company.name === selected.name);
    if (hydrated && hydrated.live !== selected.live) setSelected(hydrated);
  }, [coLive, companiesLive, selected?.name]);
  // real daily stock prices + market cap (stocks.json, refreshed daily by GitHub Action)
  const [stockData, setStockData] = uS(null);
  const [nvidiaInvestments, setNvidiaInvestments] = uS(null);
  uE(() => {
    if (!(stocksInView || active === "validation") || !dataVersion) return;
    let alive = true;
    Promise.all([
      // 주가 파일은 최신 거래일이 핵심이므로 서비스워커·브라우저의 오래된 응답을 재사용하지 않는다.
      loadJson(dataUrl("stocks.json"), { cache: "no-store" }),
      loadJson(dataUrl("nvidia-investments.json")),
    ])
      .then(([stocksPayload, investmentPayload]) => {
        if (!alive) return;
        if (stocksPayload?.stocks) setStockData({ ...stocksPayload.stocks, __generatedAt: stocksPayload.generatedAt });
        if (Array.isArray(investmentPayload?.portfolio)) setNvidiaInvestments(investmentPayload);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [stocksInView, active, dataVersion]);

  // category objects with tweakable accents
  const cats = useMemo(() => D.CATEGORIES.map(c => ({
    ...c,
    accent: c.id === "native" ? t.colNative : c.id === "bigtech" ? t.colBigtech : t.colStartup,
    accentSoft: softTint(c.id === "native" ? t.colNative : c.id === "bigtech" ? t.colBigtech : t.colStartup, dark),
  })), [t.colNative, t.colBigtech, t.colStartup, dark]);

  // 상장사 원래 시장 업종(칩·클라우드·소프트웨어·디바이스 등) — 상세 보조 분류에 사용
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

  // section scroll container
  const scrollRef = uR(null);
  const navIntentRef = uR(null);
  const navSettleTimersRef = uR([]);
  const NAV_SCROLL_OFFSET = 14;

  const sectionTop = (sc, el) => (
    sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top
  );

  uE(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);

  // 기존 북마크와 자동 생성 카드의 세부 ID를 MECE 상위 섹션으로 연결.
  const NAV_ALIAS = {
    dynamics: "overview", bizmodel: "newbiz",
    native: "valuechain", bigtech: "valuechain", startup: "valuechain",
    app: "valuechain", agent: "valuechain", service: "valuechain", trust: "valuechain",
    model: "valuechain", data: "valuechain", infra: "valuechain",
    insights: "evidence", reports: "evidence", ib: "evidence", articles: "evidence",
    survey: "validation", market: "validation", stocks: "validation",
  };
  const navTo = rawId => {
    const id = NAV_ALIAS[rawId] || rawId;
    if (!NAV_SECTION_IDS.includes(id)) return;
    setActive(id);
    const el = refs[id] && refs[id].current;
    const sc = scrollRef.current;
    if (!el || !sc) return;
    navIntentRef.current = id;
    window.__DASH_NAV_TARGET = id;
    navSettleTimersRef.current.forEach(timer => window.clearTimeout(timer));
    navSettleTimersRef.current = [];
    const destination = Math.max(0, sectionTop(sc, el) - NAV_SCROLL_OFFSET);
    const isDistant = Math.abs(destination - sc.scrollTop) > sc.clientHeight * 1.5;
    // A long smooth traversal would activate every intermediate board and
    // download its payload. Jump long distances; retain smooth motion locally.
    sc.scrollTo({ top: destination, behavior: isDistant ? "auto" : "smooth" });
    const realign = () => {
      const target = refs[id]?.current;
      if (target && scrollRef.current) {
        const container = scrollRef.current;
        container.scrollTo({ top: Math.max(0, sectionTop(container, target) - NAV_SCROLL_OFFSET), behavior: "auto" });
      }
    };
    const settleDelays = isDistant ? [0, 140, 360, 760, 1400, 2400, 3600] : [520, 1100];
    navSettleTimersRef.current = settleDelays.map((delay, index) => window.setTimeout(() => {
      realign();
      if (index === settleDelays.length - 1) {
        navIntentRef.current = null;
        if (window.__DASH_NAV_TARGET === id) window.__DASH_NAV_TARGET = "";
      }
    }, delay));
  };

  // scroll-spy
  uE(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        if (navIntentRef.current) {
          setActive(previous => previous === navIntentRef.current ? previous : navIntentRef.current);
          frame = 0;
          return;
        }
        const y = sc.scrollTop + NAV_SCROLL_OFFSET + 1;
        let cur = "overview", best = -1;
        for (const id of NAV_SECTION_IDS) {
          const el = refs[id].current;
          if (!el) continue;
          const top = sectionTop(sc, el);
          if (top <= y && top > best) { best = top; cur = id; }
        }
        setActive(previous => previous === cur ? previous : cur);
        frame = 0;
      });
    };
    sc.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      sc.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      navSettleTimersRef.current.forEach(timer => window.clearTimeout(timer));
      window.__DASH_NAV_TARGET = "";
    };
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
  const verifiedUpdateTime = dataGeneratedAt
    ? new Date(dataGeneratedAt).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    })
    : "확인 중";

  const handleSectionNav = id => {
    setNavCategory({ section: id, id: "" });
    navTo(id);
  };
  const handleCategoryNav = (section, categoryId) => {
    setNavCategory({ section, id: categoryId });
    navTo(section);
  };
  const handleSidebarCompany = (company, context = {}) => {
    if (context.section === "sanalysis") {
      const tracked = companiesLive.find(item => item.name === company.name || item.name.replace(/\s*\(.*\)/, "") === company.name);
      if (tracked) {
        setSelected(tracked);
      } else {
        const live = (coLive && coLive[company.name]) || {};
        const profile = live.profile || company.profile || {};
        const organization = live.organization || company.organization || null;
        const evidence = [company.latest, ...(company.history || []), ...(company.sourceLinks || [])]
          .filter(item => item && /^https?:\/\//.test(String(item.url || "")))
          .slice(0, 10);
        setSelected({
          name: company.name,
          domain: company.domain || profile.officialWebsite || "",
          cat: "startup",
          unit: company.vertical || "AI 소프트웨어·서비스",
          note: company.currentBusiness || company.businessModel || company.overview || company.description || "",
          direction: company.partnership || company.acqAngle || company.latest?.title || "",
          layer: "app",
          vchainVertical: company.vertical || "",
          profile,
          org: organization,
          portfolioTier: company.portfolioTier || "",
          coverage: live.coverage || company.coverage || null,
          live: {
            ...live,
            profile,
            organization,
            coverage: live.coverage || company.coverage || null,
            latest: live.latest || company.latest || null,
          },
          sources: evidence.map(item => ({
            tier: "reported",
            label: item.label || item.title || `${company.name} 원문`,
            asOf: item.date || "",
            url: item.url,
          })),
        });
      }
    } else {
      setSelected(company);
    }
    if (context.section && context.category) setNavCategory({ section: context.section, id: context.category });
    if (window.matchMedia && window.matchMedia("(max-width: 820px)").matches) setSidebarOpen(false);
  };

  return (
    <div className={"app d-" + t.density}>
      <Sidebar
        active={active}
        activeCategory={navCategory.section === active ? navCategory.id : ""}
        onNav={handleSectionNav} onCategory={handleCategoryNav} brand={brand}
        onLogo={() => handleSectionNav("overview")} onBgClick={onSidebarBg} collapsed={collapsed}
        articleCount={articleCount} companies={companiesLive} sectionCategories={sectionCategories}
        onSelectCompany={handleSidebarCompany}
        open={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)}
      />

      <div className="shell">
        <TopBar dark={dark} onTheme={() => setTweak("dark", !dark)}
          onMenuToggle={() => setSidebarOpen(o => !o)} onColorCycle={cycleColor} onNav={navTo} generatedAt={dataGeneratedAt} />

        <main className="main" ref={scrollRef}>
          <div className="main-inner">
            {/* ── 1. 첫 화면: 관계 지도 + 영상 브리핑 ── */}
            <section ref={refs.overview} className="nav-section-anchor first-video-screen" data-section="overview" data-screen-label="Mobile AI Video Brief">
              <ESCompetitiveMap companies={companiesLive} cats={cats} articles={articles} active={active === "overview"} dataVersion={dataVersion} />
            </section>

            {/* ── 2. 전략 컨설팅: 영상 다음에 바로 노출 ── */}
            <LazySection id="strategy" active={active} sectionRef={refs.strategy} height={1320}>
              <MobileStrategyBoard companies={companiesLive} articles={articles} strategyData={strategyView}
                generatedAt={dataGeneratedAt} onNav={navTo} />
            </LazySection>

            {/* ── 3. 기회 DB: 브리프 → 정량 기회 ── */}
            <LazySection id="opportunity" active={active} sectionRef={refs.opportunity} height={1080}>
              <SectionStack bodyClassName="opportunity-stack">
                <ExecToplines items={[]} insights={insights} onNav={navTo} />
                <MobileAIBusinessBoard dataVersion={dataVersion} />
              </SectionStack>
            </LazySection>

            <LazySection id="valuechain" active={active} sectionRef={refs.valuechain} height={4500}>
              <SectionStack title="AI 밸류체인" eyebrow="CONTROL POINTS"
                description="고객 경험에서 모델·런타임까지 7개 계층을 중복 없이 연결">
                {(D.VALUE_CHAIN || [])
                  .filter(layer => navCategory.section !== "valuechain" || !navCategory.id || layer.id === navCategory.id)
                  .map(layer => <ValueChainBoard key={layer.id} layerId={layer.id} companies={companiesLive} onSelect={setSelected} />)}
              </SectionStack>
            </LazySection>

            <LazySection id="newbiz" active={active} sectionRef={refs.newbiz} height={900}>
              <NewBizBoard articles={articles} dataVersion={dataVersion} />
            </LazySection>

            {/* ── 5. 생태계·기술: 변화 신호 → 실행 후보 ── */}
            <LazySection id="signals" active={active} sectionRef={refs.signals} height={900}>
              <SignalBoard articles={articles} dataVersion={dataVersion} />
            </LazySection>

            <LazySection id="sanalysis" active={active} sectionRef={refs.sanalysis} height={620}>
              <StartupScopeBoard dataVersion={dataVersion} companies={companiesLive} coLive={coLive} monet={monet}
                activeCategory={navCategory.section === "sanalysis" ? navCategory.id : ""}
                onCategoryChange={categoryId => setNavCategory({ section: "sanalysis", id: categoryId })}
                onSelect={setSelected} />
            </LazySection>

            {/* ── 6. 시장 검증: 관찰 근거 → 사업성 검증 ── */}
            <LazySection id="evidence" active={active} sectionRef={refs.evidence} height={1800}>
              <SectionStack title="시장·고객 근거" eyebrow="EVIDENCE"
                description="기관 리서치와 산업·고객 원문 신호를 한 근거 축으로 통합">
                <IBInsightBoard research={research} reports={[]} />
                <ArticleFeed articles={articles} cats={cats} filter={feedFilter} onFilter={setFeedFilter} query={query} />
              </SectionStack>
            </LazySection>

            <LazySection id="validation" active={active} sectionRef={refs.validation} height={2400}>
              <SectionStack title="수요·시장·재무 검증" eyebrow="VALIDATION"
                description="수요 조사·시장 규모·상장사 지표를 분리해 사업성을 단계적으로 확인">
                <MarketBoard dataVersion={dataVersion} mode="survey" />
                <MarketBoard dataVersion={dataVersion} mode="market" />
                <StockBoard stocks={D.STOCKS} stockData={stockData} nvidiaInvestments={nvidiaInvestments}
                  cats={cats} groups={stockGroups} theme={chartTheme} dataVersion={dataVersion} />
              </SectionStack>
            </LazySection>

            <footer className="foot">
              <span>Mobile AI Business Intelligence</span>
              <span className="foot-update">데이터 생성 시각: {verifiedUpdateTime}</span>
              <span>원출처: Bloomberg · TechCrunch · The Information · Pitchbook · Crunchbase · 각 기업 공식 발표</span>
            </footer>
          </div>
        </main>
      </div>

      <CompanyDetail company={selected} cats={cats} companyNews={companyNews} generatedAt={dataGeneratedAt}
        articles={articles} companies={companiesLive} onClose={() => setSelected(null)} />

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
