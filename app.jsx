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
function LazySection({ id, active, sectionRef, height = 420, priority = false, children }) {
  const innerRef = uR(null);
  // Observe well before the board reaches the viewport. Idle prewarming
  // remains sequential, while the generous margin protects fast scrolling.
  const nearViewport = useInView(sectionRef, 4200);
  const sectionIndex = Math.max(0, NAV_SECTION_IDS.indexOf(id));
  const [ready, setReady] = uS(priority || active === id);
  uE(() => {
    if (priority || nearViewport || active === id) {
      setReady(true);
      return undefined;
    }
    if (ready) return undefined;

    // Preserve the first paint for the video and strategy board, then warm
    // every remaining board in document order while the browser is idle.
    let idleHandle = 0;
    const timer = window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        idleHandle = window.requestIdleCallback(() => setReady(true), { timeout: 900 });
      } else {
        setReady(true);
      }
    }, 120 + sectionIndex * 90);
    return () => {
      window.clearTimeout(timer);
      if (idleHandle && "cancelIdleCallback" in window) window.cancelIdleCallback(idleHandle);
    };
  }, [nearViewport, active, id, priority, ready, sectionIndex]);
  return (
    <div ref={sectionRef} className={"board-gate" + (ready ? " is-ready" : " is-pending")}
      style={{ "--gate-height": `${height}px` }} data-section={id} data-active={active === id ? "true" : "false"}>
      {ready
        ? React.cloneElement(children, { sectionRef: innerRef })
        : <div className="board-gate-placeholder" aria-hidden="true" />}
    </div>
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
  const refsStore = uR(null);
  if (!refsStore.current) {
    refsStore.current = Object.fromEntries(NAV_SECTION_IDS.map(id => [id, React.createRef()]));
  }
  const refs = refsStore.current;
  const strategyInView = useInView(refs.strategy);
  const infraInView = useInView(refs.infra);
  const modelInView = useInView(refs.model);
  const dataInView = useInView(refs.data);
  const trustInView = useInView(refs.trust);
  const serviceInView = useInView(refs.service);
  const agentInView = useInView(refs.agent);
  const appInView = useInView(refs.app);
  const startupInView = useInView(refs.sanalysis);
  const companySectionActive = ["strategy", "app", "agent", "service", "trust", "model", "data", "infra", "sanalysis"].includes(active);
  const companyInView = strategyInView || infraInView || modelInView || dataInView || trustInView || serviceInView || agentInView || appInView || startupInView || companySectionActive;
  const needsCompanyData = companyInView || active === "overview" || !!selected;
  const articlesInView = useInView(refs.articles);
  const signalsInView = useInView(refs.signals);
  const newbizInView = useInView(refs.newbiz);
  const stocksInView = useInView(refs.stocks);
  const auditInView = useInView(refs.audit);

  const D = window.DASH;
  const dark = t.dark;
  const [dataVersion, setDataVersion] = uS("");
  const [dataGeneratedAt, setDataGeneratedAt] = uS("");
  const dataUrl = file => `${file}?v=${encodeURIComponent(dataVersion || "bootstrap")}`;
  const needsNews = articlesInView || companyInView || signalsInView || newbizInView
    || ["overview", "articles", "signals", "newbiz"].includes(active);

  // A tiny version manifest is the only uncacheable request. Every sizeable
  // data file is immutable for that version and can therefore be CDN-cached.
  uE(() => {
    let alive = true;
    fetch("data-version.json", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive) { setDataVersion(j?.version || j?.generatedAt || "bootstrap"); setDataGeneratedAt(j?.generatedAt || ""); } })
      .catch(() => { if (alive) setDataVersion("bootstrap"); });
    return () => { alive = false; };
  }, []);

  // crawler output: news.json (refreshed daily by GitHub Action). No static-news fallback:
  // if provenance cannot be loaded, the feed stays empty rather than showing unverified claims.
  // 캐시버스터: GitHub Pages CDN(edge)은 URL 기준 캐시 → 분 단위 쿼리스트링으로 항상 최신 파일을 받게 함
  const [crawled, setCrawled] = uS([]);
  const [fullNewsLoaded, setFullNewsLoaded] = uS(false);
  const fullNewsLoadedRef = uR(false);
  uE(() => {
    if (!dataVersion || !needsNews) return;
    let alive = true;
    // The first two screens need only the newest, source-backed evidence.
    // Load that compact payload first; the complete cumulative ledger is
    // warmed below without blocking the video or consulting framework.
    fetch(dataUrl("executive-news-view.json"), { cache: "force-cache" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (alive && !fullNewsLoadedRef.current) setCrawled(j && Array.isArray(j.articles) ? j.articles : []);
      })
      .catch(() => { if (alive && !fullNewsLoadedRef.current) setCrawled([]); });
    return () => { alive = false; };
  }, [dataVersion, needsNews]);
  uE(() => {
    if (!dataVersion || fullNewsLoaded) return;
    let alive = true;
    let idleHandle = 0;
    const loadFullNews = () => fetch(dataUrl("news-view.json"), { cache: "force-cache" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (!alive || !Array.isArray(j?.articles)) return;
        fullNewsLoadedRef.current = true;
        setCrawled(j.articles);
        setFullNewsLoaded(true);
      }).catch(() => {});
    const timer = window.setTimeout(() => {
      if ("requestIdleCallback" in window) idleHandle = window.requestIdleCallback(loadFullNews, { timeout: 1400 });
      else loadFullNews();
    }, 650);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      if (idleHandle && "cancelIdleCallback" in window) window.cancelIdleCallback(idleHandle);
    };
  }, [dataVersion, fullNewsLoaded]);
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

  // 매일 갱신되는 '오늘의 톱라인' 인사이트. 근거 데이터가 없으면 빈 상태를 유지한다.
  const [insights, setInsights] = uS({ cards: [], engine: "rules" });
  uE(() => {
    if (!dataVersion) return;
    let alive = true;
    fetch(dataUrl("insights.json"), { cache: "force-cache" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        const cards = (j && j.cards || []).filter(card => card.provenance?.status === "evidence-linked");
        if (alive) setInsights({ ...(j || {}), cards });
      })
      .catch(() => { if (alive) setInsights({ cards: [], engine: "rules" }); });
    return () => { alive = false; };
  }, [dataVersion]);

  // 증권사 리서치(research.json)·기업 라이브(companies.json)·데이터 감사(audit.json)
  const [research, setResearch] = uS(null);
  const [coLive, setCoLive] = uS(null);
  const [companyNews, setCompanyNews] = uS({});
  const [audit, setAudit] = uS(null);
  const [quality, setQuality] = uS(null);
  const [llmHealth, setLlmHealth] = uS(null);
  const [collectionHealth, setCollectionHealth] = uS(null);
  const [startupsX, setStartupsX] = uS(null);
  const [monet, setMonet] = uS(null);
  uE(() => {
    if (!dataVersion) return;
    let alive = true;
    fetch(dataUrl("research-view.json"), { cache: "force-cache" }).then(r => (r.ok ? r.json() : null))
      .then(j => {
        const feed = (j && j.feed || []).filter(item => item.displayEligible !== false && item.provenance?.status === "source-backed");
        if (alive && feed.length) setResearch({ ...j, onepager: null, feed });
      }).catch(() => {});
    return () => { alive = false; };
  }, [dataVersion]);

  // Lower sections do not compete with the first viewport. The largest live
  // files are requested only when their respective section is near the reader.
  uE(() => {
    if (!needsCompanyData || !dataVersion) return;
    let alive = true;
    fetch(dataUrl("companies.json"), { cache: "force-cache" }).then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j && j.companies) setCoLive(j.companies); }).catch(() => {});
    return () => { alive = false; };
  }, [needsCompanyData, dataVersion]);

  // Company articles and startup monetization are detail payloads. They are
  // warmed only for the startup view or an opened company, rather than
  // competing with the executive first screen.
  const needsCompanyExtras = startupInView || active === "sanalysis" || !!selected;
  uE(() => {
    if (!needsCompanyExtras || !dataVersion) return;
    let alive = true;
    fetch(dataUrl("company-news.json"), { cache: "force-cache" }).then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j && j.companies) setCompanyNews(j.companies); }).catch(() => {});
    fetch(dataUrl("monetization.json"), { cache: "force-cache" }).then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j && Array.isArray(j.companies)) setMonet(j); }).catch(() => {});
    fetch(dataUrl("startups.json"), { cache: "force-cache" }).then(r => { if (r.ok) return r.json(); return null; })
      .then(j => { if (alive && j && (j.large || j.small)) {
        const m = {};
        (j.large || []).filter(x => x.provenance?.status === "source-backed").forEach(x => { m[x.name] = { overview: x.businessModel, insight: x.partnership, label: x.label, tier: "large" }; });
        (j.small || []).filter(x => x.provenance?.status === "source-backed").forEach(x => { m[x.name] = { overview: x.overview, insight: x.acqAngle, label: x.label, tier: "small" }; });
        setStartupsX(m);
      } }).catch(() => {});
    return () => { alive = false; };
  }, [needsCompanyExtras, dataVersion]);

  uE(() => {
    if (!(auditInView || active === "audit") || !dataVersion) return;
    let alive = true;
    fetch(dataUrl("audit.json"), { cache: "force-cache" }).then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j && j.checks) setAudit(j); }).catch(() => {});
    fetch(dataUrl("quality.json"), { cache: "force-cache" }).then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j && j.checks) setQuality(j); }).catch(() => {});
    fetch(dataUrl("llm-health.json"), { cache: "force-cache" }).then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j) setLlmHealth(j); }).catch(() => {});
    fetch(dataUrl("collection-health.json"), { cache: "force-cache" }).then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j) setCollectionHealth(j); }).catch(() => {});
    return () => { alive = false; };
  }, [auditInView, active, dataVersion]);
  // 지역 기업은 이름·분류만 정적 레지스트리에 두고, 공개 원문/공식 페이지로
  // 확인된 사업 내용만 화면에 합성한다. 고정된 중국 전략·인물·수치 서술은
  // 라이브 근거가 없으면 렌더링하지 않는다.
  const companiesLive = useMemo(() => (D.COMPANIES || []).map(c => {
    const lv = coLive && coLive[c.name];
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
    const merged = { ...c, valuation: "—", valAsof: "", metric: "원문 기사", value: "—", metricAsof: "", funding: "—" };
    merged.profile = sourceGated ? (lv?.profile || null) : ((lv && lv.profile) || (D.COMPANY_PROFILES || {})[c.name] || null); // 정규화 개요: 라이브 변동값 우선
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
      merged.org = (lv && lv.organization) || (D.COMPANY_ORG || {})[c.name] || null; // 정규화 조직: live officers + 큐레이션 배경
    }
    merged.invest = (D.COMPANY_INVEST || {})[c.name] || null;      // AI SW·서비스 투자 포트폴리오·전략 맵
    // 메인 카드도 상세 팝업과 같은 최신 원문 합성 결과를 우선한다.
    // 정적 레지스트리는 회사명·분류·도메인만 담당하고, 사업/수익/방향은
    // daily pipeline의 source-grounded intelligence가 매 실행마다 교체한다.
    const intel = lv && lv.intelligence;
    if (intel) {
      merged.intelligence = intel;
      const groundedSummary = section => section?.groundingStatus === "source-grounded" ? (section.summary || "") : "";
      merged.note = groundedSummary(intel.currentBusiness) || (sourceGated ? "" : merged.note);
      merged.vp = groundedSummary(intel.revenueModel) || (sourceGated ? "" : merged.vp);
      merged.direction = groundedSummary(intel.strategyDirection) || (sourceGated ? "" : merged.direction);
    }
    // 원문 기반 수익모델·사업 방향(monetization.json) — 원문 링크 신호 + 밸류체인 legend
    merged.monetize = monet
      ? { entry: (monet.companies || []).find(x => x.name === c.name) || null, models: monet.models || [], directions: monet.directions || [] }
      : null;
    if (lv) { merged.live = lv; if (lv.cap && lv.capAsof) { merged.valuation = lv.cap.replace(/ \(시나리오\)/, ""); merged.valAsof = lv.capAsof.slice(2, 7).replace("-", "."); } }
    if (strat) merged.strategy = strat;
    return merged;
  }).filter(Boolean), [coLive, startupsX, monet]);
  uE(() => {
    if (!selected || !coLive) return;
    const hydrated = companiesLive.find(company => company.name === selected.name);
    if (hydrated && hydrated.live !== selected.live) setSelected(hydrated);
  }, [coLive, companiesLive, selected?.name]);
  // real daily stock prices + market cap (stocks.json, refreshed daily by GitHub Action)
  const [stockData, setStockData] = uS(null);
  const [nvidiaInvestments, setNvidiaInvestments] = uS(null);
  uE(() => {
    if (!(stocksInView || active === "stocks") || !dataVersion) return;
    let alive = true;
    Promise.all([
      // 주가 파일은 최신 거래일이 핵심이므로 서비스워커·브라우저의 오래된 응답을 재사용하지 않는다.
      fetch(dataUrl("stocks.json"), { cache: "no-store" }).then(r => (r.ok ? r.json() : null)),
      fetch(dataUrl("nvidia-investments.json"), { cache: "force-cache" }).then(r => (r.ok ? r.json() : null)),
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

  // 상장사 원래 시장 업종(칩·메모리·하이퍼스케일러 등) — 상세 보조 분류에 사용
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
  const navAlignFrameRef = uR(0);
  const navAlignTokenRef = uR(0);
  const NAV_SCROLL_OFFSET = 14;

  const sectionTop = (sc, el) => (
    sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top
  );

  uE(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);

  // A reload must begin with the video brief rather than a browser-restored
  // position inside the nested dashboard scroller.
  uE(() => {
    const previous = "scrollRestoration" in window.history ? window.history.scrollRestoration : "auto";
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    const resetToVideo = () => {
      if (window.location.hash || !scrollRef.current) return;
      scrollRef.current.scrollTo({ top: 0, behavior: "auto" });
      setActive("overview");
    };
    const frame = window.requestAnimationFrame(resetToVideo);
    window.addEventListener("pageshow", resetToVideo);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pageshow", resetToVideo);
      if ("scrollRestoration" in window.history) window.history.scrollRestoration = previous;
    };
  }, []);

  // 일부 Q&A는 통합·이동된 섹션을 가리킴: dynamics→overview(경쟁구도가 ES로 이동), insights→reports
  const NAV_ALIAS = { dynamics: "overview", insights: "ib", reports: "ib", bizmodel: "newbiz", native: "model", bigtech: "infra", startup: "app" };
  const navTo = rawId => {
    const id = NAV_ALIAS[rawId] || rawId;
    if (!NAV_SECTION_IDS.includes(id)) return;
    setActive(id);
    const el = refs[id] && refs[id].current;
    const sc = scrollRef.current;
    if (!el || !sc) return;
    navIntentRef.current = id;
    window.__DASH_NAV_TARGET = id;
    navAlignTokenRef.current += 1;
    const token = navAlignTokenRef.current;
    window.cancelAnimationFrame(navAlignFrameRef.current);
    const destination = Math.max(0, sectionTop(sc, el) - NAV_SCROLL_OFFSET);
    const isDistant = Math.abs(destination - sc.scrollTop) > sc.clientHeight * 1.5;
    sc.classList.toggle("nav-aligning", isDistant);
    // A long smooth traversal would activate every intermediate board and
    // download its payload. Jump long distances; retain smooth motion locally.
    sc.scrollTo({ top: destination, behavior: isDistant ? "auto" : "smooth" });
    // Lazy boards can become several times taller than their placeholders.
    // Follow the requested section until every board above it has settled,
    // otherwise late layout growth leaves the right panel and left tab out of sync.
    const startedAt = performance.now();
    let stableFrames = 0;
    const targetIndex = NAV_SECTION_IDS.indexOf(id);
    const minimumSettleMs = targetIndex > 4 ? 1800 : targetIndex > 1 ? 1100 : 450;
    const followTarget = now => {
      if (token !== navAlignTokenRef.current || !scrollRef.current) return;
      const container = scrollRef.current;
      const target = refs[id]?.current;
      if (!target) return;
      const waitingAbove = NAV_SECTION_IDS.slice(0, targetIndex)
        .some(sectionId => refs[sectionId]?.current?.classList.contains("is-pending"));
      const delta = sectionTop(container, target) - NAV_SCROLL_OFFSET - container.scrollTop;
      // Let a short local smooth-scroll finish before taking over alignment.
      if (isDistant || now - startedAt > 360) {
        container.classList.add("nav-aligning");
        if (Math.abs(delta) > 1) container.scrollTop = Math.max(0, container.scrollTop + delta);
        stableFrames = Math.abs(delta) <= 1 && !waitingAbove ? stableFrames + 1 : 0;
      }
      if ((stableFrames >= 12 && now - startedAt > minimumSettleMs) || now - startedAt > 6500) {
        navIntentRef.current = null;
        if (window.__DASH_NAV_TARGET === id) window.__DASH_NAV_TARGET = "";
        container.classList.remove("nav-aligning");
        navAlignFrameRef.current = 0;
        return;
      }
      navAlignFrameRef.current = window.requestAnimationFrame(followTarget);
    };
    navAlignFrameRef.current = window.requestAnimationFrame(followTarget);
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
        const y = sc.scrollTop + Math.min(164, Math.max(NAV_SCROLL_OFFSET + 1, sc.clientHeight * .23));
        let cur = "overview", best = -1;
        for (const id of NAV_SECTION_IDS) {
          const el = refs[id].current;
          if (!el) continue;
          const top = sectionTop(sc, el);
          if (top <= y && top > best) { best = top; cur = id; }
        }
        if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) cur = NAV_SECTION_IDS[NAV_SECTION_IDS.length - 1];
        setActive(previous => previous === cur ? previous : cur);
        frame = 0;
      });
    };
    sc.addEventListener("scroll", onScroll, { passive: true });
    const cancelProgrammaticAlignment = event => {
      if (!event.isTrusted || !navIntentRef.current) return;
      navAlignTokenRef.current += 1;
      window.cancelAnimationFrame(navAlignFrameRef.current);
      navAlignFrameRef.current = 0;
      navIntentRef.current = null;
      window.__DASH_NAV_TARGET = "";
      sc.classList.remove("nav-aligning");
    };
    sc.addEventListener("wheel", cancelProgrammaticAlignment, { passive: true });
    sc.addEventListener("touchstart", cancelProgrammaticAlignment, { passive: true });
    sc.addEventListener("pointerdown", cancelProgrammaticAlignment, { passive: true });
    const sizeObserver = "ResizeObserver" in window ? new ResizeObserver(onScroll) : null;
    const flow = sc.querySelector(".main-inner");
    if (flow) sizeObserver?.observe(flow);
    onScroll();
    return () => {
      sc.removeEventListener("scroll", onScroll);
      sc.removeEventListener("wheel", cancelProgrammaticAlignment);
      sc.removeEventListener("touchstart", cancelProgrammaticAlignment);
      sc.removeEventListener("pointerdown", cancelProgrammaticAlignment);
      sizeObserver?.disconnect();
      cancelAnimationFrame(frame);
      navAlignTokenRef.current += 1;
      window.cancelAnimationFrame(navAlignFrameRef.current);
      sc.classList.remove("nav-aligning");
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
  const now = new Date();
  const p2 = n => String(n).padStart(2, "0");
  const renderTime = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}`;

  return (
    <div className={"app d-" + t.density}>
      <Sidebar
        active={active} onNav={id => {
          navTo(id);
          if (window.matchMedia && window.matchMedia("(max-width: 820px)").matches) setSidebarOpen(false);
        }} brand={brand}
        onLogo={() => navTo("overview")} onBgClick={onSidebarBg} collapsed={collapsed}
        articleCount={articleCount} companies={D.COMPANIES} cats={cats} onSelectCompany={c => {
          setSelected(c);
          if (window.matchMedia && window.matchMedia("(max-width: 820px)").matches) setSidebarOpen(false);
        }}
        open={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)}
      />

      <div className="shell">
        <TopBar dark={dark} onTheme={() => setTweak("dark", !dark)}
          onMenuToggle={() => setSidebarOpen(o => !o)} onColorCycle={cycleColor} onNav={navTo} generatedAt={dataGeneratedAt} />

        <main className="main" ref={scrollRef}>
          <div className="main-inner">
            {/* ── 1. 첫 화면: 관계 지도 + 영상 브리핑 ── */}
            <section ref={refs.overview} className="nav-section-anchor first-video-screen" data-section="overview" data-screen-label="AI Memory Video Brief">
              <div className="ov-head">
                <div className="ov-heading-copy">
                  <span>EXECUTIVE SIGNAL ROOM · SOURCE-BACKED</span>
                  <h2 className="ov-title">AI 메모리 산업 브리핑</h2>
                  <p>공개 근거를 고객 Pain point와 메모리 실행 안건으로 연결</p>
                </div>
                <ol className="ov-consulting-flow" aria-label="브리핑 의사결정 흐름">
                  <li><em>01</em><b>Signal</b><span>시장·고객</span></li>
                  <li><em>02</em><b>Pain Point</b><span>워크로드 병목</span></li>
                  <li><em>03</em><b>Memory Fit</b><span>제품·기술</span></li>
                  <li><em>04</em><b>Decision</b><span>실행 게이트</span></li>
                </ol>
              </div>
              <ESCompetitiveMap companies={companiesLive} cats={cats} articles={articles} active={active === "overview"} />
            </section>

            {/* ── 2. 전략 컨설팅: 영상 다음에 바로 노출 ── */}
            <LazySection id="strategy" active={active} sectionRef={refs.strategy} height={1320} priority>
              <MemoryStrategyBoard companies={companiesLive} articles={articles} generatedAt={dataGeneratedAt} onNav={navTo} />
            </LazySection>

            {/* ── 3. 리서치·시장 DB ── */}
            <LazySection id="ib" active={active} sectionRef={refs.ib} height={980}>
              <IBInsightBoard research={research} reports={[]} sectionRef={refs.ib} />
            </LazySection>

            <LazySection id="opportunity" active={active} sectionRef={refs.opportunity} height={1080}>
              <div className="opportunity-stack">
                <ExecToplines items={D.TOPLINE} insights={insights} onNav={navTo} />
                <MobileAIBusinessBoard dataVersion={dataVersion} />
              </div>
            </LazySection>

            <LazySection id="articles" active={active} sectionRef={refs.articles} height={840}>
              <ArticleFeed articles={articles} cats={cats} filter={feedFilter} onFilter={setFeedFilter} query={query} />
            </LazySection>

            {/* ── 2. AI 수요 → 메모리 기회 밸류체인 ── */}
            <LazySection id="app" active={active} sectionRef={refs.app} height={740}>
              <ValueChainBoard layerId="app" companies={companiesLive} onSelect={setSelected} sectionRef={refs.app} />
            </LazySection>
            <LazySection id="agent" active={active} sectionRef={refs.agent} height={660}>
              <ValueChainBoard layerId="agent" companies={companiesLive} onSelect={setSelected} sectionRef={refs.agent} />
            </LazySection>
            <LazySection id="service" active={active} sectionRef={refs.service} height={660}>
              <ValueChainBoard layerId="service" companies={companiesLive} onSelect={setSelected} sectionRef={refs.service} />
            </LazySection>
            <LazySection id="trust" active={active} sectionRef={refs.trust} height={620}>
              <ValueChainBoard layerId="trust" companies={companiesLive} onSelect={setSelected} sectionRef={refs.trust} />
            </LazySection>
            <LazySection id="model" active={active} sectionRef={refs.model} height={620}>
              <ValueChainBoard layerId="model" companies={companiesLive} onSelect={setSelected} sectionRef={refs.model} />
            </LazySection>
            <LazySection id="data" active={active} sectionRef={refs.data} height={520}>
              <ValueChainBoard layerId="data" companies={companiesLive} onSelect={setSelected} sectionRef={refs.data} />
            </LazySection>
            <LazySection id="infra" active={active} sectionRef={refs.infra} height={620}>
              <ValueChainBoard layerId="infra" companies={companiesLive} onSelect={setSelected} sectionRef={refs.infra} />
            </LazySection>
            <LazySection id="sanalysis" active={active} sectionRef={refs.sanalysis} height={620}>
              <StartupScopeBoard dataVersion={dataVersion} companies={companiesLive} coLive={coLive} monet={monet} onSelect={setSelected} />
            </LazySection>

            {/* ── 3. 심층 분석 ── */}
            <LazySection id="signals" active={active} sectionRef={refs.signals} height={900}>
              <SignalBoard articles={articles} dataVersion={dataVersion} />
            </LazySection>

            <LazySection id="newbiz" active={active} sectionRef={refs.newbiz} height={900}>
              <NewBizBoard articles={articles} dataVersion={dataVersion} />
            </LazySection>

            <LazySection id="survey" active={active} sectionRef={refs.survey} height={620}>
              <MarketBoard dataVersion={dataVersion} mode="survey" sectionRef={refs.survey} />
            </LazySection>
            <LazySection id="market" active={active} sectionRef={refs.market} height={780}>
              <MarketBoard dataVersion={dataVersion} mode="market" sectionRef={refs.market} />
            </LazySection>
            <LazySection id="stocks" active={active} sectionRef={refs.stocks} height={820}>
              <StockBoard stocks={D.STOCKS} stockData={stockData} nvidiaInvestments={nvidiaInvestments}
                cats={cats} groups={stockGroups} theme={chartTheme} dataVersion={dataVersion} />
            </LazySection>

            <LazySection id="audit" active={active} sectionRef={refs.audit} height={520}>
              <AuditPanel audit={audit} quality={quality} llmHealth={llmHealth} collectionHealth={collectionHealth} />
            </LazySection>

            <footer className="foot">
              <span>AI Memory Strategy Intelligence</span>
              <span className="foot-update">최종 업데이트: {renderTime}</span>
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
// ---- 데이터 감사 패널: audit-agent.mjs 산출물(audit.json) 표시 ----
function AuditPanel({ audit, quality, llmHealth, collectionHealth, sectionRef }) {
  const [open, setOpen] = uS(false);
  // Keep a measurable target in the document so the audit JSON can be loaded
  // lazily before the panel itself has content to render.
  if (!audit) return <div className="audit-wrap" ref={sectionRef} style={{ minHeight: 1 }} aria-hidden="true" />;
  const C = { ok: "#16A34A", warn: "#EA580C", fail: "#D23B3B" };
  return (
    <div className="audit-wrap" ref={sectionRef}>
      <button className="audit-chip" onClick={() => setOpen(o => !o)} title="데이터 파이프라인 감사 상태">
        <i style={{ background: C[audit.overall] || "#8A93A4" }} />
        데이터 신뢰센터 {audit.overall === "ok" ? "정상" : audit.overall === "warn" ? "주의" : "실패"} · {audit.summary}
      </button>
      {open && (
        <div className="audit-panel">
          {quality && (
            <div className="audit-trust">
              <b>근거 검증 정책</b>
              <p>{quality.policy}</p>
              <div className="audit-metrics">
                <span>현재 기사 <b>{quality.metrics.currentArticles}</b></span>
                <span>누적 기사 <b>{quality.metrics.accumulatedArticles}</b></span>
                <span>원문 근거 <b>{quality.metrics.sourceBackedArticles}</b></span>
                <span>원문 발췌 <b>{quality.metrics.sourceExcerptArticles || 0}</b></span>
                <span>한글 표시 <b>{quality.metrics.localizedArticles || 0}</b></span>
                <span>영문 폴백 <b>{quality.metrics.localizedFallbackArticles || 0}</b></span>
                <span>제한 비율 <b>{((quality.metrics.limitedRate || 0) * 100).toFixed(1)}%</b></span>
                <span>최신 주가 <b>{quality.metrics.freshStocks}/{quality.metrics.totalStocks}</b></span>
              </div>
            </div>
          )}
          {llmHealth && <div className="audit-policy-state"><b>요약 엔진</b> {llmHealth.summaryEngine === "source-excerpt" ? "원문 발췌 · 외부 AI API 0회" : "상태 확인 필요"}</div>}
          {collectionHealth && <div className="audit-policy-state"><b>수집 상태</b> {collectionHealth.status === "ok" ? "정상" : "부분 수집"} · 실패 {(collectionHealth.failedStreams || []).length} · 빈 스트림 {(collectionHealth.emptyStreams || []).length}</div>}
          {audit.checks.map(c => (
            <div className="audit-row" key={`${c.file}-${c.tab}`}>
              <i style={{ background: C[c.status] || "#8A93A4" }} />
              <b>{c.tab}</b>
              <span className="audit-meta">{c.items}건 · {c.ageDays}일 전{c.engine ? ` · ${c.engine}` : ""}</span>
              {c.issues.length > 0 && <span className="audit-issues">{c.issues.join(" / ")}</span>}
            </div>
          ))}
          <p className="audit-note">매 수집 후 최신성·커버리지·출처 연결·수치 근거를 자동 검사하며, 핵심 검증 실패 시 배포하지 않습니다.</p>
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
