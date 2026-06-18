/* ============================================================
   boards.jsx — content sections (AI Intelligence Dashboard)
   ============================================================ */

// ---- Real publication date (not the crawl date) ----------------
// Prefers an explicit a.pub, then a dated URL (/YYYY/MM/DD/), then the
// first YYYY.MM.DD found in the summary, falling back to a.date.
function pubOf(a) {
  if (a && a.pub) return a.pub;
  const pad = (s) => String(s).padStart(2, "0");
  let m = (a && a.url || "").match(/\/(20\d\d)\/(\d{1,2})\/(\d{1,2})(?:\/|$|\?)/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = (a && a.summary || "").match(/(20\d\d)[.\-](\d{1,2})[.\-](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  return (a && a.date) || "";
}
function fmtPubKo(ds) {
  if (!ds) return "";
  const [y, m, d] = ds.split("-").map(Number);
  return y === 2026 ? `${m}/${d}` : `'${String(y).slice(2)}.${m}.${d}`;
}

// ---- Company logo (real favicon, falls back to initial) ---------
function CoLogo({ name, domain, accent }) {
  const [failed, setFailed] = React.useState(false);
  if (!domain || failed) {
    return <span className="ct-logo" style={{ background: accent }}>{name[0]}</span>;
  }
  return (
    <span className="ct-logo ct-logo-img">
      <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        alt={name} loading="lazy" onError={() => setFailed(true)} />
    </span>
  );
}

// ---- Category company board (dense table) ----------------------
function CompanyBoard({ cat, companies, density, sectionRef, query, onSelect }) {
  const inView = useInView(sectionRef);
  const prog = useProgress(inView, 1000);
  const rows = companies.filter(c => c.cat === cat.id)
    .filter(c => !query || (c.name + c.unit + c.note).toLowerCase().includes(query.toLowerCase()));
  const open = c => onSelect && onSelect(c);
  return (
    <section className="board" ref={sectionRef} data-screen-label={cat.en}>
     <AnimCtx.Provider value={inView}>
      <div className="board-head" style={{ "--accent": cat.accent }}>
        <span className="board-tab" style={{ background: cat.accent }} />
        <div className="board-titles">
          <h2>{cat.ko} <span className="board-en">{cat.en}</span></h2>
          <p>{cat.desc} · 업체명 클릭 시 상세 정보</p>
        </div>
        <div className="board-count" style={{ color: cat.accent, background: cat.accentSoft }}>{rows.length} 社</div>
      </div>

      <div className={"ctable d-" + density}>
        <div className="ct-head">
          <span>기업</span>
          <span>세그먼트</span>
          <span className="num">밸류에이션</span>
          <span className="num">핵심지표</span>
          <span className="num">추이</span>
          <span>코멘트</span>
        </div>
        {rows.map((c, i) => {
          const local = staggerP(prog, i, rows.length);
          return (
          <div className="ct-row" key={i}
            style={{ "--accent": cat.accent, opacity: 0.1 + 0.9 * local, transform: `translateY(${(1 - local) * 12}px)` }}>
            <span className="ct-name" role="button" tabIndex={0} title={c.name + " 상세 보기"}
              onClick={() => open(c)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(c); } }}>
              <CoLogo name={c.name} domain={c.domain} accent={cat.accent} />
              <b>{c.name}</b>
              <Icon name="chevron" size={12} />
            </span>
            <span className="ct-seg">{c.unit}</span>
            <span className="num ct-valcell" title={c.valAsof ? `출처: '${c.valAsof} 기준` : ""}>
              <AnimatedNumber className="ct-val" value={c.valuation} />
              {c.valAsof && c.valAsof !== "—" && <em className="ct-asof">'{c.valAsof} 기준</em>}
            </span>
            <span className="num" title={c.metricAsof ? `출처: '${c.metricAsof} 기준` : ""}>
              <em className="ct-metric">{c.metric}</em>
              <AnimatedNumber className="ct-mval" value={c.value} />
              {c.metricAsof && c.metricAsof !== "—" && <em className="ct-asof">'{c.metricAsof} 기준</em>}
            </span>
            <span className="num ct-trend" title={c.trendBasis || "YoY 또는 밸류 변화율"}>
              <Trend v={c.trend} small animate />
              <TrendBar v={c.trend} />
            </span>
            <span className="ct-note"><BoldSummary text={c.note} /></span>
          </div>
          );
        })}
      </div>
     </AnimCtx.Provider>
    </section>
  );
}

// ---- Company detail modal (overview + all info + related news) --
function CompanyDetail({ company, cats, articles, onClose }) {
  React.useEffect(() => {
    if (!company) return;
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [company]);
  if (!company) return null;
  const c = company;
  const cat = (cats.find(x => x.id === c.cat) || {});
  const token = c.name.split(" (")[0].toLowerCase();
  // related news: same category, name-mentioning articles surfaced first
  const rel = (articles || [])
    .filter(a => a.cat === c.cat)
    .sort((a, b) => {
      const am = (a.title + a.summary).toLowerCase().includes(token) ? 0 : 1;
      const bm = (b.title + b.summary).toLowerCase().includes(token) ? 0 : 1;
      return am - bm || (a.date < b.date ? 1 : -1);
    })
    .slice(0, 6);
  return (
    <div className="cd-overlay" onClick={onClose}>
     <AnimCtx.Provider value={true}>
      <div className="cd-modal" onClick={e => e.stopPropagation()} style={{ "--accent": cat.accent }}>
        <button className="cd-close" onClick={onClose} aria-label="닫기"><Icon name="x" size={16} sw={2} /></button>

        <div className="cd-head">
          <CoLogo name={c.name} domain={c.domain} accent={cat.accent} />
          <div className="cd-head-txt">
            <h3>{c.name}</h3>
            <div className="cd-sub">
              <span className="cd-cat" style={{ color: cat.accent, background: cat.accentSoft }}>{cat.ko}</span>
              <span>{c.unit}</span>
            </div>
          </div>
          <div className="cd-trend">
            <Trend v={c.trend} animate />
            <TrendBar v={c.trend} />
          </div>
        </div>

        <div className="cd-stats">
          <div className="cd-stat">
            <em>밸류에이션</em>
            <b><AnimatedNumber value={c.valuation} /></b>
            {c.valAsof && c.valAsof !== "—" && <span>'{c.valAsof} 기준</span>}
          </div>
          <div className="cd-stat">
            <em>{c.metric}</em>
            <b><AnimatedNumber value={c.value} /></b>
            {c.metricAsof && c.metricAsof !== "—" && <span>'{c.metricAsof} 기준</span>}
          </div>
          <div className="cd-stat">
            <em>펀딩 단계</em>
            <b>{c.funding}</b>
          </div>
          <div className="cd-stat">
            <em>분기 추이</em>
            <b><Trend v={c.trend} animate /></b>
          </div>
        </div>

        <div className="cd-section">
          <h4>개요</h4>
          <p>{c.note}</p>
        </div>

        {c.vp && (
          <div className="cd-section">
            <h4>밸류 프로포지션 <em>Value Proposition</em></h4>
            <p className="cd-vp" style={{ borderColor: cat.accent }}>{c.vp}</p>
          </div>
        )}

        {c.direction && (
          <div className="cd-section">
            <h4>방향성 · 추구 가치 <em>Direction</em></h4>
            <p>{c.direction}</p>
          </div>
        )}

        <div className="cd-section">
          <h4>관련 뉴스 <em>{rel.length}건</em></h4>
          <div className="cd-news">
            {rel.length === 0 && <span className="cd-empty">관련 기사가 없습니다</span>}
            {rel.map((a, i) => (
              <a key={i} className="cd-art" href={a.url} target="_blank" rel="noopener">
                <span className="cd-art-dot" style={{ background: cat.accent }} />
                <span className="cd-art-body">
                  <span className="cd-art-meta"><em>{a.source}</em><span className="cd-art-date">{fmtPubKo(pubOf(a))}</span><span className="cd-art-tag" style={{ color: cat.accent, background: cat.accentSoft }}>{a.tag}</span></span>
                  <span className="cd-art-title">{a.title}</span>
                  {a.summary && <span className="cd-art-sum"><BoldSummary text={a.summary} /></span>}
                </span>
              </a>
            ))}
          </div>
        </div>

        {c.sources && c.sources.length > 0 && (
          <div className="cd-section">
            <h4>출처 <em>{c.sources.length}건 · 텍스트 복사 가능</em></h4>
            <div className="cd-sources">
              {c.sources.map((s, i) => (
                <div key={i} className="cd-src-item" onClick={e => { const t = e.currentTarget.querySelector('.cd-src-text'); if (t) { navigator.clipboard.writeText(t.textContent); } }}>
                  <span className="cd-src-text">{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <a className="cd-source" href={c.url} target="_blank" rel="noopener">
          공식 출처 보기 <Icon name="ext" size={13} />
        </a>
      </div>
     </AnimCtx.Provider>
    </div>
  );
}

// ---- Bold key numbers helper (accent bold + yellow marker) -----
// highlight numbers/currency inside one line of text
function hlNums(text, keyBase) {
  const parts = String(text).split(/(\$[\d,.]+[BMK]?(?:\+|~)?|\d+\.?\d*%|\+\d+\.?\d*%|-\d+\.?\d*%)/g);
  return parts.map((part, i) =>
    /^\$|^\d+\.?\d*%$|^[+-]\d+\.?\d*%$/.test(part)
      ? <b key={keyBase + "-" + i} className="num-hl">{part}</b>
      : part
  );
}

// Render a feed summary as up to 3 개조식 lines (제목 한글 + 3줄 요약 정책).
function BoldSummary({ text }) {
  if (!text) return null;
  const clean = String(text).replace(/<[^>]+>/g, "");          // strip stray HTML (e.g. <font color>)
  const lines = clean.split(/\n+/).map(l => l.trim()).filter(Boolean).slice(0, 3);   // 최대 3줄
  if (lines.length <= 1) return <>{hlNums(clean, "s")}</>;
  return lines.map((line, i) => (
    <span className="art-sum-line" key={i}>{hlNums(line.replace(/^[·\-•]\s*/, ""), "l" + i)}</span>
  ));
}

// ---- Article feed: category filter → company dropdown, deletable rows ----
function ArticleFeed({ articles, cats, sectionRef, filter, onFilter, query }) {
  const catMap = Object.fromEntries(cats.map(c => [c.id, c]));
  const [co, setCo] = React.useState("all");          // company filter within category
  const keyOf = a => a.url || ((a.co || "") + "|" + a.date + "|" + a.title);
  // deleted articles persist in localStorage so ✕'d items never come back (across reloads/crawls)
  const LS_KEY = "aiDashDeletedArticles";
  const [deleted, setDeleted] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
  });
  const removeArticle = (a) => setDeleted(d => {
    const next = { ...d, [keyOf(a)]: 1 };
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
    return next;
  });

  // reset company filter whenever the category changes
  React.useEffect(() => { setCo("all"); }, [filter]);

  // companies available in the active category (from articles that have a `co`),
  // sorted to match the company cards & sidebar (규모 큰 순 = COMPANY_ORDER)
  const coList = React.useMemo(() => {
    const order = (window.DASH && window.DASH.COMPANY_ORDER) || [];
    const seen = [];
    articles.forEach(a => {
      if (filter !== "all" && a.cat !== filter) return;
      if (a.co && !seen.includes(a.co)) seen.push(a.co);
    });
    return seen.sort((x, y) => {
      const ix = order.indexOf(x), iy = order.indexOf(y);
      return (ix === -1 ? 1e9 : ix) - (iy === -1 ? 1e9 : iy);   // 로스터에 없는 co는 맨 뒤
    });
  }, [articles, filter]);

  // de-dupe by key (drops duplicate content from crawl + static merge)
  const deduped = React.useMemo(() => {
    const seen = new Set(); const out = [];
    articles.forEach(a => { const k = keyOf(a); if (!seen.has(k)) { seen.add(k); out.push(a); } });
    return out;
  }, [articles]);

  const filtered = deduped
    .filter(a => filter === "all" || a.cat === filter)
    .filter(a => co === "all" || a.co === co)
    .filter(a => !deleted[keyOf(a)])
    .filter(a => !query || a.title.toLowerCase().includes(query.toLowerCase()) || a.source.toLowerCase().includes(query.toLowerCase()) || (a.co || "").toLowerCase().includes(query.toLowerCase()));

  const sorted = [...filtered].sort((a, b) => pubOf(b).localeCompare(pubOf(a)));
  const activeCat = filter !== "all" ? catMap[filter] : null;

  return (
    <section className="board feed" ref={sectionRef} data-screen-label="Daily Articles">
      <div className="board-head">
        <span className="board-tab" style={{ background: "var(--ink)" }} />
        <div className="board-titles">
          <h2>데일리 기사 피드 <span className="board-en">Daily Articles · 업체별 외신 큐레이션</span></h2>
          <p>카테고리 선택 → 업체 선택 시 해당 기업 기사만 표시 · 매일 오전 7시 자동 갱신 · ✕로 기사 삭제</p>
        </div>
        <div className="feed-filters">
          <button className={filter === "all" ? "on" : ""} onClick={() => onFilter("all")}>전체</button>
          {cats.map(c => (
            <button key={c.id} className={filter === c.id ? "on" : ""} onClick={() => onFilter(c.id)}
              style={filter === c.id ? { background: c.accent, borderColor: c.accent, color: "#fff" } : { "--accent": c.accent }}>
              {c.ko}
            </button>
          ))}
        </div>
      </div>

      {(filter !== "all" || co !== "all") && (
        <div className="feed-codrop" style={{ "--accent": activeCat ? activeCat.accent : "var(--ink)" }}>
          <span className="fc-label">{activeCat ? activeCat.ko : "전체"} · 업체 선택</span>
          <select className="fc-select" value={co} onChange={e => setCo(e.target.value)}>
            <option value="all">전체 업체</option>
            {coList.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          {co !== "all" && <button className="fc-clear" onClick={() => setCo("all")}>✕ 업체 해제</button>}
        </div>
      )}

      <div className="feed-body">
        {sorted.length === 0 && <div className="feed-empty">표시할 기사가 없습니다.</div>}
        <div className="feed-list">
          {sorted.map((a, i) => {
            const c = catMap[a.cat] || {};
            return (
              <div className="art" key={keyOf(a)}>
                <span className="art-cat" style={{ background: c.accent }} />
                <a className="art-body" href={a.url} target="_blank" rel="noopener">
                  <span className="art-meta">
                    <em className="art-src">{a.source}</em>
                    {a.co && <span className="art-co" style={{ color: c.accent, borderColor: c.accent }}>{a.co}</span>}
                    <span className="art-tag" style={{ color: c.accent, background: c.accentSoft }}>{a.tag}</span>
                    <span className="art-date">{fmtPubKo(pubOf(a))} 발표</span>
                  </span>
                  <span className="art-title">{a.title}</span>
                  {a.summary && <span className="art-summary"><BoldSummary text={a.summary} /></span>}
                </a>
                <button className="art-del" title="이 기사 삭제(다시 표시 안 함)" aria-label="기사 삭제"
                  onClick={() => removeArticle(a)}>
                  <Icon name="x" size={13} sw={2.2} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---- Insights board (10선) ------------------------------------
function InsightsBoard({ insights, sectionRef }) {
  const inView = useInView(sectionRef);
  const prog = useProgress(inView, 1300);
  return (
    <section className="board" ref={sectionRef} data-screen-label="Key Insights">
     <AnimCtx.Provider value={inView}>
      <div className="board-head">
        <span className="board-tab" style={{ background: "var(--accent)" }} />
        <div className="board-titles">
          <h2>핵심 인사이트 <span className="board-en">Key Insights · 2026.06</span></h2>
          <p>AI 시장 핵심 동향 · IDC · Gartner · Stanford HAI · 공식 발표</p>
        </div>
      </div>
      <div className="insight-grid">
        {insights.map((ins, i) => {
          const local = staggerP(prog, i, insights.length);
          return (
            <div className="insight-card" key={i} style={{ opacity: local, transform: `translateY(${(1 - local) * 16}px)` }}>
              <div className="insight-icon"><Icon name={ins.icon || "spark"} size={18} /></div>
              <div className="insight-body">
                <div className="insight-title">{ins.title}</div>
                <div className="insight-desc"><BoldSummary text={ins.desc} /></div>
                {ins.src && <div className="insight-src">{ins.src}</div>}
              </div>
            </div>
          );
        })}
      </div>
     </AnimCtx.Provider>
    </section>
  );
}

// ---- Charts section --------------------------------------------
function ChartsBoard({ data, cats, theme, sectionRef }) {
  const inView = useInView(sectionRef);
  const catColor = id => (cats.find(c => c.id === id) || {}).accent || theme.ink;
  return (
    <section className="board" ref={sectionRef} data-screen-label="Quant Charts">
     <AnimCtx.Provider value={inView}>
      <div className="board-head">
        <span className="board-tab" style={{ background: "var(--ink)" }} />
        <div className="board-titles">
          <h2>정량 분석 <span className="board-en">Company Quant · AI 기업별 지표</span></h2>
          <p>기업별 밸류에이션 · 사용자 · 가격 · 매출 정량 비교 (AI 시장 규모·점유율은 상단 오버뷰 참조)</p>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <div className="cc-head"><h3>AI 펀딩 현황</h3><span title="Crunchbase · PitchBook · TechCrunch 공시 기준">$B · 공시 기준</span></div>
          <HBarChart data={data.FUNDING} colorOf={d => catColor(d.cat)} ink={theme.ink} muted={theme.muted} grid={theme.grid} unit="B" valuePrefix="$" />
        </div>

        <div className="chart-card">
          <div className="cc-head"><h3>AI 앱 사용자 수</h3><span title="각 기업 공시 · SimilarWeb · IR 기준">주요 앱·플랫폼 · M(백만) · 공시 기준</span></div>
          <HBarChart data={data.USERS} colorOf={d => catColor(d.cat)} ink={theme.ink} muted={theme.muted} grid={theme.grid} unit="M" />
        </div>

        <div className="chart-card">
          <div className="cc-head"><h3>AI 서비스 가격</h3><span>$/mo · 2026.06</span></div>
          <HBarChart data={data.BAND_PRICE} colorOf={d => catColor(d.cat)} ink={theme.ink} muted={theme.muted} grid={theme.grid} unit="" valuePrefix="$" />
        </div>

        <div className="chart-card">
          <div className="cc-head"><h3>AI 매출</h3><span title="OpenAI · Google · Microsoft · Anthropic 공시/추정 기준">$B · 연환산 · 공시 기준</span></div>
          <HBarChart data={data.REVENUE} colorOf={d => catColor(d.cat)} ink={theme.ink} muted={theme.muted} grid={theme.grid} unit="B" valuePrefix="$" />
        </div>

      </div>
     </AnimCtx.Provider>
    </section>
  );
}

// ---- Value Proposition board (3 categories × company VP cards) ---
function VPBoard({ companies, cats, sectionRef, onSelect, query }) {
  const inView = useInView(sectionRef);
  const prog = useProgress(inView, 1300);
  return (
    <section className="board" ref={sectionRef} data-screen-label="Value Proposition">
     <AnimCtx.Provider value={inView}>
      <div className="board-head">
        <span className="board-tab" style={{ background: "var(--accent)" }} />
        <div className="board-titles">
          <h2>Value Proposition <span className="board-en">Value Proposition · Direction</span></h2>
          <p>3대 카테고리 기업별 핵심 가치 제안과 방향성 · 업체명 클릭 시 상세 정보</p>
        </div>
      </div>
      {cats.map(cat => {
        const rows = companies.filter(c => c.cat === cat.id && c.vp)
          .filter(c => !query || (c.name + c.vp + (c.direction || "")).toLowerCase().includes(query.toLowerCase()));
        if (rows.length === 0) return null;
        return (
          <div className="vp-group" key={cat.id} style={{ "--accent": cat.accent }}>
            <div className="vp-cat">
              <span className="vp-cat-dot" style={{ background: cat.accent }} />
              <b style={{ color: cat.accent }}>{cat.ko}</b>
              <em>{cat.en}</em>
            </div>
            <div className="vp-grid">
              {rows.map((c, i) => {
                const local = staggerP(prog, i, rows.length);
                return (
                  <div className="vp-card" key={c.name}
                    style={{ opacity: local, transform: `translateY(${(1 - local) * 14}px)` }}>
                    <div className="vp-head">
                      <CoLogo name={c.name} domain={c.domain} accent={cat.accent} />
                      <b className="vp-name" role="button" tabIndex={0} title={c.name + " 상세 보기"}
                        onClick={() => onSelect && onSelect(c)}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect && onSelect(c); } }}>{c.name}</b>
                      <Trend v={c.trend} small animate />
                    </div>
                    <div className="vp-prop">{c.vp}</div>
                    {c.direction && <div className="vp-dir"><Icon name="target" size={12} sw={1.8} /><span>{c.direction}</span></div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
     </AnimCtx.Provider>
    </section>
  );
}

// ---- Reports list ----------------------------------------------
function ReportsBoard({ reports, sectionRef, query }) {
  const inView = useInView(sectionRef);
  const prog = useProgress(inView, 1200);
  const rows = reports.filter(r => !query || (r.title + r.house).toLowerCase().includes(query.toLowerCase()));
  const fmtDate = ds => {
    const y = ds.slice(2, 4), m = +ds.slice(5, 7), d = +ds.slice(8, 10);
    return `'${y}.${m}.${String(d).padStart(2, "0")}`;
  };
  return (
    <section className="board" ref={sectionRef} data-screen-label="Research Reports">
     <AnimCtx.Provider value={inView}>
      <div className="board-head">
        <span className="board-tab" style={{ background: "var(--ink)" }} />
        <div className="board-titles">
          <h2>리서치 리포트 <span className="board-en">AI Market Research</span></h2>
          <p>증권사·시장기관 AI 리포트 정량 요약 · 클릭 시 원문 이동</p>
        </div>
      </div>
      <div className="report-list">
        {rows.map((r, i) => {
          const local = staggerP(prog, i, rows.length);
          return (
            <div className="report-card" key={i} style={{ opacity: local, transform: `translateY(${(1 - local) * 12}px)` }}>
              <a className="report" href={r.url} target="_blank" rel="noopener">
                <span className={"rep-type " + (r.type === "Securities" ? "sec" : r.type === "Regulatory" ? "reg" : "mkt")}>{r.type === "Securities" ? "증권사" : r.type === "Regulatory" ? "규제" : "시장조사"}</span>
                <span className="rep-house">{r.house}</span>
                <span className="rep-title">{r.title}</span>
                <span className="rep-figure"><AnimatedNumber value={r.figure} /></span>
                <span className={"rep-rating r-" + r.rating.replace(/\s/g, "").toLowerCase()}>{r.rating}</span>
                {r.verified === false && <span className="rep-unverified" title={r.verifyNote || "원문 미확인"}>Unverified</span>}
                <span className="rep-date">{fmtDate(r.date)}</span>
                <Icon name="ext" size={12} />
              </a>
              {r.bullets && r.bullets.length > 0 && (
                <div className="rep-bullets">
                  {r.bullets.map((b, bi) => (
                    <div key={bi} className="rep-bullet">· {b}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
     </AnimCtx.Provider>
    </section>
  );
}

// ---- Stock board: listed AI companies, daily price, 1Y/5Y, inflection notes ----
function StockBoard({ stocks, stockData, cats, sectionRef, theme }) {
  const inView = useInView(sectionRef);
  const catMap = Object.fromEntries((cats || []).map(c => [c.id, c]));
  const [ticker, setTicker] = React.useState((stocks[0] || {}).ticker);
  const [years, setYears] = React.useState(1);
  const sel = stocks.find(s => s.ticker === ticker) || stocks[0];
  const accent = (catMap[sel.cat] || {}).accent || theme.accent;
  const real = (stockData && stockData[sel.ticker]) || null;
  const mcap = sel.private ? sel.mcap : (real && real.marketCap);
  const updated = stockData && stockData.__generatedAt;
  return (
    <section className="board" ref={sectionRef} data-screen-label="Stock Prices">
     <AnimCtx.Provider value={inView}>
      <div className="board-head" style={{ "--accent": accent }}>
        <span className="board-tab" style={{ background: accent }} />
        <div className="board-titles">
          <h2>주가 차트 <span className="board-en">Listed AI Stocks · 실시간 일별 주가</span></h2>
          <p>상장 AI 기업 실제 일별 종가(매일 자동 크롤링) · 시가총액 표시 · 마우스 호버 시 종가 · 변곡점(●)에 상승/하락 사유</p>
        </div>
        {!sel.private && (
          <div className="stock-range">
            <button className={years === 1 ? "on" : ""} onClick={() => setYears(1)}>1년</button>
            <button className={years === 5 ? "on" : ""} onClick={() => setYears(5)}>5년</button>
          </div>
        )}
      </div>

      <div className="stock-tabs">
        {stocks.map(s => {
          const ac = (catMap[s.cat] || {}).accent || theme.accent;
          const on = s.ticker === ticker;
          return (
            <button key={s.ticker} className={"stock-tab" + (on ? " on" : "")}
              style={on ? { borderColor: ac, color: ac, background: (catMap[s.cat] || {}).accentSoft } : null}
              onClick={() => setTicker(s.ticker)}>
              <img src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=32`} alt="" loading="lazy" />
              <b>{s.ticker}</b>
              <em>{s.name.replace(/\s*\(.*\)/, "")}</em>
            </button>
          );
        })}
      </div>

      <div className="stock-panel" style={{ "--accent": accent }}>
        <div className="stock-panel-head">
          <span className="sp-name">{sel.name}</span>
          <span className="sp-tk">{sel.ticker}</span>
          <span className="sp-cat" style={{ color: accent, background: (catMap[sel.cat] || {}).accentSoft }}>{(catMap[sel.cat] || {}).ko}</span>
          {mcap && <span className="sp-mcap">시가총액 <b>{mcap}</b></span>}
        </div>

        {sel.private ? (
          <div className="stock-private">
            <p className="stock-note">{sel.note}</p>
            {(sel.events || []).length > 0 && (
              <div className="stock-events">
                {sel.events.map((e, k) => (
                  <div key={k} className={"se-item " + (e.dir === "up" ? "up" : "down")}>
                    <span className="se-dot" />
                    <span className="se-date">{e.date}</span>
                    <span className="se-label">{e.dir === "up" ? "▲" : "▼"} {e.label}</span>
                    <span className="se-reason">{e.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : real && real.points ? (
          <StockChart stock={sel} rawPoints={real.points} years={years} marketCap={real.marketCap}
            asOf={real.asOf} accent={accent} ink={theme.ink} muted={theme.muted} grid={theme.grid} />
        ) : (
          <div className="stock-pending">
            <p className="stock-empty">{sel.note || "실제 일별 주가는 매일 자동 크롤링되어 표시됩니다. 첫 갱신을 기다리는 중입니다."}</p>
            {(sel.events || []).length > 0 && (
              <div className="stock-events">
                {sel.events.slice().reverse().map((e, k) => (
                  <div key={k} className={"se-item " + (e.dir === "up" ? "up" : "down")}>
                    <span className="se-dot" />
                    <span className="se-date">{e.date}</span>
                    <span className="se-label">{e.dir === "up" ? "▲" : "▼"} {e.label}</span>
                    <span className="se-reason">{e.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {updated && <p className="stock-updated">데이터 갱신: {String(updated).slice(0, 10)} · 출처 Stooq · 시총=종가×발행주식수(근사)</p>}
      </div>
     </AnimCtx.Provider>
    </section>
  );
}

// ---- Overview Charts (market-level donut + bar + area, no company names) ----
function OverviewCharts({ data, cats, theme }) {
  const ref = React.useRef(null);
  const inView = useInView(ref);
  const catColor = id => (cats.find(c => c.id === id) || {}).accent || theme.ink;
  return (
    <AnimCtx.Provider value={inView}>
      <div className="ov-charts" ref={ref}>
        <div className="ov-chart-card">
          <div className="cc-head"><h3>AI 시장 규모 & 성장률</h3><span title="IDC '26.01 Worldwide AI Spending Guide">$B · YoY% · IDC</span></div>
          <MarketGrowthChart data={data.MARKET_GROWTH} accent={theme.accent} ink={theme.ink} grid={theme.grid} muted={theme.muted} />
        </div>
        <div className="ov-chart-card">
          <div className="cc-head"><h3>AI 시장 점유율</h3><span title="Statista · IDC · 각사 공시 기준">세그먼트별 · IDC / Statista</span></div>
          <DonutChart data={data.SHARE} colorOf={d => catColor(d.cat)} ink={theme.ink} muted={theme.muted} centerLabel="$390.9B" centerSub="글로벌 AI 시장(2025)" />
        </div>
        <div className="ov-chart-card">
          <div className="cc-head"><h3>AI 시장 버티컬별</h3><span title="Grand View Research · IDC · Statista 산업별 AI 채택">산업별 비중 · 2025</span></div>
          <DonutChart data={data.MARKET_VERTICAL} colorOf={d => catColor(d.cat)} ink={theme.ink} muted={theme.muted} centerLabel="8개" centerSub="주요 버티컬" />
        </div>
        <div className="ov-chart-card">
          <div className="cc-head"><h3>AI 주요 딜</h3><span title="Crunchbase · PitchBook 기준">2025~2026 주요 투자</span></div>
          <DonutChart data={data.AI_DEALS} colorOf={d => catColor(d.cat)} ink={theme.ink} muted={theme.muted} centerLabel="$97B" centerSub="AI 총 투자 (추정)" />
        </div>
        <div className="ov-chart-card">
          <div className="cc-head"><h3>AI 펀딩 트렌드</h3><span title="Crunchbase 분기별 AI 벤처 펀딩">$B · 분기별 집계</span></div>
          <HBarChart data={data.FUNDING_TREND} colorOf={d => catColor(d.cat)} ink={theme.ink} muted={theme.muted} grid={theme.grid} unit="B" valuePrefix="$" />
        </div>
      </div>
    </AnimCtx.Provider>
  );
}

// ---- Dynamics Board (competitive landscape visualization) ------
// ---- Knowledge Graph (interactive force-directed) ----
// 경쟁 다이내믹스 전용 — 같은 시장을 두고 다투는 라이벌 구도만 표시
const COMPETE_EDGES = [
  { from: "OpenAI", to: "Anthropic", type: "경쟁", label: "LLM 플랫폼 경쟁" },
  { from: "OpenAI", to: "Google DeepMind", type: "경쟁", label: "AGI·검색 경쟁" },
  { from: "OpenAI", to: "Meta AI", type: "경쟁", label: "오픈소스 vs 클로즈드" },
  { from: "OpenAI", to: "DeepSeek", type: "경쟁", label: "비용·효율 경쟁" },
  { from: "Anthropic", to: "Google DeepMind", type: "경쟁", label: "프런티어 모델 경쟁" },
  { from: "Anthropic", to: "DeepSeek", type: "경쟁", label: "가격·효율 경쟁" },
  { from: "Perplexity", to: "Google DeepMind", type: "경쟁", label: "AI 검색 경쟁" },
  { from: "Microsoft", to: "Amazon", type: "경쟁", label: "AI 클라우드 경쟁" },
  { from: "Microsoft", to: "Google DeepMind", type: "경쟁", label: "Copilot vs Gemini" },
  { from: "Cohere", to: "OpenAI", type: "경쟁", label: "엔터프라이즈 LLM 경쟁" },
  { from: "Mistral AI", to: "Meta AI", type: "경쟁", label: "오픈 가중치 모델 경쟁" },
  { from: "Runway", to: "OpenAI", type: "경쟁", label: "영상 생성(Sora) 경쟁" },
  { from: "Glean", to: "Microsoft", type: "경쟁", label: "엔터프라이즈 검색 vs Copilot" },
  { from: "ElevenLabs", to: "OpenAI", type: "경쟁", label: "음성 AI 경쟁" },
  { from: "Harvey", to: "Microsoft", type: "경쟁", label: "법률 AI vs Copilot" },
];

// 비즈니스 모델 전용 — 실제 '돈의 흐름'(투자·인수·매출·파트너십). 경쟁 관계는 제외
const MONEY_EDGES = [
  { from: "Microsoft", to: "OpenAI", type: "투자", label: "투자 $13B+ (Azure 크레딧)" },
  { from: "Amazon", to: "Anthropic", type: "투자", label: "투자 기존 $8B+즉시 $5B(최대 $20B 추가)" },
  { from: "NVIDIA", to: "Perplexity", type: "투자", label: "전략 투자(NVIDIA)" },
  { from: "NVIDIA", to: "ElevenLabs", type: "투자", label: "전략 투자(NVIDIA)" },
  { from: "NVIDIA", to: "Mistral AI", type: "투자", label: "전략 투자(NVIDIA)" },
  { from: "OpenAI", to: "NVIDIA", type: "매출", label: "GPU 구매 → NVIDIA 매출" },
  { from: "Microsoft", to: "NVIDIA", type: "매출", label: "GPU 구매 → NVIDIA 매출" },
  { from: "Amazon", to: "NVIDIA", type: "매출", label: "GPU 구매 → NVIDIA 매출" },
  { from: "Meta AI", to: "NVIDIA", type: "매출", label: "GPU 구매 → NVIDIA 매출" },
  { from: "Anthropic", to: "Amazon", type: "매출", label: "AWS 클라우드 $100B 약정" },
  { from: "OpenAI", to: "Microsoft", type: "매출", label: "Azure 컴퓨트 비용" },
  { from: "OpenAI", to: "Scale AI", type: "매출", label: "데이터·평가 구매" },
  { from: "Anthropic", to: "Scale AI", type: "매출", label: "데이터·평가 구매" },
  { from: "Apple", to: "OpenAI", type: "파트너십", label: "Siri 통합 파트너십" },
  { from: "Mistral AI", to: "Microsoft", type: "파트너십", label: "Azure 배포 파트너십" },
  { from: "Cohere", to: "Amazon", type: "파트너십", label: "AWS·소버린 배포" },
];

function KnowledgeGraph({ companies, cats, catMap, progress, mode }) {
  const canvasRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const [hovered, setHovered] = React.useState(null);
  const [selected, setSelected] = React.useState(null);
  const [tooltip, setTooltip] = React.useState(null);
  const nodesRef = React.useRef([]);
  const edgesRef = React.useRef([]);
  const dragRef = React.useRef(null);
  const frameRef = React.useRef(null);
  const mouseRef = React.useRef({ x: 0, y: 0 });

  const edgeColors = { "경쟁": "#FF4D4D", "투자": "#00C2A8", "매출": "#F59E0B", "파트너십": "#2D6BFF", "인수": "#C026D3", "생태계": "#FFB02E", "모회사": "#6366F1", "계열사": "#8B5CF6" };
  const edgeDash = { "경쟁": [], "투자": [6, 4], "파트너십": [3, 3], "생태계": [8, 3], "인수": [2, 2], "모회사": [], "계열사": [4, 4], "GPU 공급": [6, 2], "서비스": [3, 3], "API 공급": [5, 3], "데이터": [4, 4], "클라우드": [6, 4], "독점": [2, 4] };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const W = container.offsetWidth;
    const H = Math.min(520, Math.max(380, W * 0.5));
    canvas.width = W * 2; canvas.height = H * 2;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);

    const valScale = (c) => {
      const v = parseFloat(String(c.valuation).replace(/[^0-9.]/g, "")) || 1;
      return Math.max(18, Math.min(42, 14 + Math.sqrt(v) * 4));
    };

    if (nodesRef.current.length === 0) {
      const cx = W / 2, cy = H / 2;
      nodesRef.current = companies.map((c, i) => {
        const angle = (i / companies.length) * Math.PI * 2;
        const radius = 120 + Math.random() * 60;
        return {
          id: c.name, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius,
          vx: 0, vy: 0, r: valScale(c), co: c,
          cat: catMap[c.cat], fixed: false,
        };
      });
      const EDGE_SET = mode === "dynamics" ? COMPETE_EDGES : MONEY_EDGES;
      edgesRef.current = EDGE_SET.filter(e =>
        nodesRef.current.some(n => n.id === e.from) && nodesRef.current.some(n => n.id === e.to)
      );
    }
    const nodes = nodesRef.current;
    const edges = edgesRef.current;

    const dark = document.documentElement.dataset.theme === "dark";
    const bg = dark ? "#0E1525" : "#FAFBFE";
    const gridC = dark ? "#1E2636" : "#EAEDF3";
    const textC = dark ? "#E8ECF4" : "#0E1525";
    const mutedC = dark ? "#6F7B90" : "#8A93A4";

    function tick() {
      const damp = 0.88;
      for (const n of nodes) {
        if (n.fixed) continue;
        let fx = 0, fy = 0;
        for (const m of nodes) {
          if (m === n) continue;
          let dx = n.x - m.x, dy = n.y - m.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          let repel = 2800 / (dist * dist);
          fx += (dx / dist) * repel;
          fy += (dy / dist) * repel;
        }
        for (const e of edges) {
          let other = null;
          if (e.from === n.id) other = nodes.find(m => m.id === e.to);
          if (e.to === n.id) other = nodes.find(m => m.id === e.from);
          if (!other) continue;
          let dx = other.x - n.x, dy = other.y - n.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          let attract = (dist - 140) * 0.008;
          fx += (dx / dist) * attract;
          fy += (dy / dist) * attract;
        }
        let dx = W / 2 - n.x, dy = H / 2 - n.y;
        fx += dx * 0.0008;
        fy += dy * 0.0008;
        n.vx = (n.vx + fx) * damp;
        n.vy = (n.vy + fy) * damp;
        n.x = Math.max(n.r + 4, Math.min(W - n.r - 4, n.x + n.vx));
        n.y = Math.max(n.r + 4, Math.min(H - n.r - 4, n.y + n.vy));
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      for (let x = 40; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.strokeStyle = gridC; ctx.lineWidth = 0.5; ctx.stroke(); }
      for (let y = 40; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      for (const e of edges) {
        const a = nodes.find(n => n.id === e.from), b = nodes.find(n => n.id === e.to);
        if (!a || !b) continue;
        const isHl = hovered && (e.from === hovered || e.to === hovered);
        const isSel = selected && (e.from === selected || e.to === selected);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = (isHl || isSel) ? edgeColors[e.type] || "#888" : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)");
        ctx.lineWidth = (isHl || isSel) ? 2.5 : 1;
        ctx.setLineDash((isHl || isSel) ? (edgeDash[e.type] || []) : []);
        ctx.stroke(); ctx.setLineDash([]);
        if (isHl || isSel) {
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          ctx.font = "bold 9px sans-serif"; ctx.fillStyle = edgeColors[e.type] || "#888"; ctx.textAlign = "center";
          ctx.fillText(e.label, mx, my - 5);
        }
      }

      for (const n of nodes) {
        const isH = n.id === hovered;
        const isS = n.id === selected;
        const accent = n.cat ? n.cat.accent : "#888";
        const connected = isH || isS ? edges.some(e => e.from === n.id || e.to === n.id) : false;
        const faded = (hovered || selected) && !isH && !isS && !edges.some(e =>
          (e.from === (hovered || selected) && e.to === n.id) || (e.to === (hovered || selected) && e.from === n.id)
        );
        ctx.globalAlpha = faded ? 0.2 : 1;
        if (isH || isS) {
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 6, 0, Math.PI * 2);
          ctx.fillStyle = accent + "18"; ctx.fill();
          ctx.strokeStyle = accent + "50"; ctx.lineWidth = 1.5; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(n.x - n.r * 0.3, n.y - n.r * 0.3, n.r * 0.1, n.x, n.y, n.r);
        g.addColorStop(0, accent + "DD"); g.addColorStop(1, accent);
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = isH || isS ? "#fff" : accent + "60"; ctx.lineWidth = isH || isS ? 2.5 : 1; ctx.stroke();
        ctx.font = `bold ${Math.max(9, n.r * 0.42)}px sans-serif`;
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const label = n.id.length > 10 ? n.id.slice(0, 9) + "…" : n.id;
        ctx.fillText(label, n.x, n.y);
        ctx.globalAlpha = 1;
      }

      const legendItems = Object.entries(edgeColors);
      ctx.font = "bold 10px sans-serif"; ctx.textBaseline = "top";
      legendItems.forEach(([type, color], i) => {
        const lx = 12, ly = H - 14 - (legendItems.length - 1 - i) * 16;
        ctx.beginPath(); ctx.arc(lx, ly + 4, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
        ctx.fillStyle = mutedC; ctx.textAlign = "left"; ctx.fillText(type, lx + 10, ly);
      });
    }

    function animate() {
      tick(); draw();
      frameRef.current = requestAnimationFrame(animate);
    }
    animate();

    const getNode = (x, y) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (x - rect.left), my = (y - rect.top);
      mouseRef.current = { x: mx, y: my };
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const dx = mx - n.x, dy = my - n.y;
        if (dx * dx + dy * dy < (n.r + 4) * (n.r + 4)) return n;
      }
      return null;
    };

    const onMove = (e) => {
      const pt = e.touches ? e.touches[0] : e;
      const n = getNode(pt.clientX, pt.clientY);
      if (dragRef.current) {
        const rect = canvas.getBoundingClientRect();
        dragRef.current.x = pt.clientX - rect.left;
        dragRef.current.y = pt.clientY - rect.top;
        dragRef.current.vx = 0; dragRef.current.vy = 0;
      }
      setHovered(n ? n.id : null);
      canvas.style.cursor = n ? "grab" : "default";
      if (n) {
        const rect = canvas.getBoundingClientRect();
        setTooltip({ x: pt.clientX - rect.left, y: pt.clientY - rect.top, co: n.co });
      } else { setTooltip(null); }
    };
    const onDown = (e) => {
      const pt = e.touches ? e.touches[0] : e;
      const n = getNode(pt.clientX, pt.clientY);
      if (n) { dragRef.current = n; n.fixed = true; canvas.style.cursor = "grabbing"; setSelected(n.id); e.preventDefault(); }
    };
    const onUp = () => { if (dragRef.current) { dragRef.current.fixed = false; dragRef.current = null; canvas.style.cursor = "default"; } };

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("mouseleave", () => { setHovered(null); setTooltip(null); onUp(); });
    canvas.addEventListener("touchmove", onMove, { passive: false });
    canvas.addEventListener("touchstart", onDown, { passive: false });
    canvas.addEventListener("touchend", onUp);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("touchmove", onMove);
      canvas.removeEventListener("touchstart", onDown);
      canvas.removeEventListener("touchend", onUp);
    };
  }, [companies, cats, hovered, selected]);

  const selCo = selected ? companies.find(c => c.name === selected) : null;
  const selEdges = selected ? (mode === "dynamics" ? COMPETE_EDGES : MONEY_EDGES).filter(e => e.from === selected || e.to === selected) : [];

  return (
    <div className="kg-wrap" style={{ opacity: Math.min(1, progress * 2) }}>
      <div className="kg-container" ref={containerRef}>
        <canvas ref={canvasRef} className="kg-canvas" />
        {tooltip && (
          <div className="kg-tooltip" style={{ left: tooltip.x, top: tooltip.y - 10 }}>
            <b>{tooltip.co.name}</b>
            <span>{tooltip.co.unit}</span>
            <span>{tooltip.co.valuation}</span>
          </div>
        )}
      </div>
      {selCo && (
        <div className="kg-detail" onClick={() => setSelected(null)}>
          <div className="kg-detail-head">
            <b>{selCo.name}</b>
            <span className="kg-detail-cat">{catMap[selCo.cat] ? catMap[selCo.cat].ko : selCo.cat}</span>
            <span className="kg-detail-val">{selCo.valuation}</span>
          </div>
          <p className="kg-detail-note">{selCo.note}</p>
          {selEdges.length > 0 && (
            <div className="kg-detail-edges">
              <em>관계 네트워크</em>
              {selEdges.map((e, i) => (
                <span key={i} className="kg-edge-tag" style={{ borderColor: edgeColors[e.type] || "#888", color: edgeColors[e.type] || "#888" }}>
                  <b>{e.type}</b> {e.from === selected ? e.to : e.from} — {e.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="kg-hint">노드를 드래그하여 이동 · 클릭하여 상세 관계 보기 · 범례: 원 크기 = 밸류에이션</div>
    </div>
  );
}

function DynamicsBoard({ companies, cats, sectionRef }) {
  const inView = useInView(sectionRef);
  const dynProg = useProgress(inView, 1400);
  const catMap = Object.fromEntries(cats.map(c => [c.id, c]));

  return (
    <section className="board" ref={sectionRef} data-screen-label="Competitive Map">
     <AnimCtx.Provider value={inView}>
      <div className="board-head">
        <span className="board-tab" style={{ background: "var(--accent)" }} />
        <div className="board-titles">
          <h2>AI 경쟁 다이내믹스 <span className="board-en">Competitive Dynamics · Rivalry Map</span></h2>
          <p>같은 시장을 두고 다투는 AI 기업 간 <b>경쟁 관계</b>만 인터랙티브 그래프로 표시 (붉은 선=경쟁)</p>
        </div>
      </div>
      <KnowledgeGraph companies={companies} cats={cats} catMap={catMap} progress={dynProg} mode="dynamics" />
     </AnimCtx.Provider>
    </section>
  );
}

// ---- Biz Model Board (monetization / revenue model per company) ----
function BizModelBoard({ companies, cats, sectionRef, theme }) {
  const inView = useInView(sectionRef);
  const bizProg = useProgress(inView, 1400);
  const catMap = Object.fromEntries(cats.map(c => [c.id, c]));
  const models = window.DASH.BIZ_MODELS || [];

  return (
    <section className="board" ref={sectionRef} data-screen-label="Biz Model">
     <AnimCtx.Provider value={inView}>
      <div className="board-head">
        <span className="board-tab" style={{ background: "var(--accent)" }} />
        <div className="board-titles">
          <h2>AI 비즈니스 모델 <span className="board-en">Money Flow · Who Pays Whom</span></h2>
          <p>투자·인수·GPU/클라우드/데이터 <b>매출</b> 등 실제 '돈의 흐름'을 그래프로 표시 (초록=투자, 주황=매출, 파랑=파트너십 · 경쟁 관계 제외)</p>
        </div>
      </div>
      <KnowledgeGraph companies={companies} cats={cats} catMap={catMap} progress={bizProg} mode="bizmodel" />
      <div className="biz-grid">
        {models.map((m, i) => {
          const local = staggerP(bizProg, i, models.length);
          const cat = catMap[m.cat];
          const co = companies.find(c => c.name.startsWith(m.name.split(" (")[0]));
          return (
            <div className="biz-card" key={i} style={{
              opacity: local, transform: `translateY(${(1 - local) * 18}px)`,
              "--biz-accent": cat ? cat.accent : "var(--accent)",
            }}>
              <div className="biz-card-head">
                {co && <CoLogo name={co.name} domain={co.domain} accent={cat ? cat.accent : "var(--accent)"} />}
                <div className="biz-card-titles">
                  <b className="biz-name">{m.name}</b>
                  <span className="biz-model-tag" style={{ background: cat ? cat.accent : "var(--accent)", color: "#fff" }}>{m.model}</span>
                </div>
              </div>
              <div className="biz-metrics">
                <div className="biz-metric"><em>가격</em><b>{m.pricing}</b></div>
                <div className="biz-metric"><em>매출</em><b><AnimatedNumber value={m.revenue} /></b></div>
                <div className="biz-metric"><em>ARPU</em><b>{m.arpu}</b></div>
                <div className="biz-metric"><em>리텐션</em><b>{m.retention}</b></div>
              </div>
              <div className="biz-sub-row"><em>구독 구조</em><span>{m.sub}</span></div>
              <div className="biz-moat"><em>경쟁 해자</em><span>{m.moat}</span></div>
              <div className="biz-strategy"><em>전략</em><span>{m.strategy}</span></div>
              {m.src && <div className="biz-src">{m.src}</div>}
            </div>
          );
        })}
      </div>
     </AnimCtx.Provider>
    </section>
  );
}

// ---- Monthly Trends Board (downloads + revenue by month) ----
function MonthlyTrendsBoard({ data, cats, theme, sectionRef }) {
  const inView = useInView(sectionRef);
  const [selectedApp, setSelectedApp] = React.useState("all");
  const [tab, setTab] = React.useState("downloads");

  const appMonthly = data.APP_MONTHLY || [];
  const revMonthly = data.REVENUE_MONTHLY || [];
  const months = appMonthly.map(m => m.month);
  const revMonths = revMonthly.map(m => m.month);

  const allAppNames = appMonthly.length > 0 ? appMonthly[0].apps.map(a => a.name) : [];
  const allRevNames = revMonthly.length > 0 ? revMonthly[0].data.map(d => d.name) : [];

  const appColors = ["#1428A0", "#7A38D6", "#0E8F6E", "#D23B3B", "#F59E0B", "#0891B2", "#2D6BFF", "#C026D3"];

  const buildDownloadSeries = () => {
    const names = selectedApp === "all" ? allAppNames.slice(0, 6) : [selectedApp];
    return names.map(name => ({
      name,
      values: months.map((_m, mi) => {
        const app = appMonthly[mi].apps.find(a => a.name === name);
        return app ? app.ios + app.android : 0;
      }),
      srcs: months.map((_m, mi) => {
        const app = appMonthly[mi].apps.find(a => a.name === name);
        return app ? app.src : "";
      }),
    }));
  };

  const buildRevenueSeries = () => {
    const names = selectedApp === "all" ? allRevNames.slice(0, 6) : allRevNames.filter(n => n === selectedApp || selectedApp === "all");
    return names.map(name => ({
      name,
      values: revMonths.map((_m, mi) => {
        const d = revMonthly[mi].data.find(r => r.name === name);
        return d ? d.value : 0;
      }),
      srcs: revMonths.map((_m, mi) => {
        const d = revMonthly[mi].data.find(r => r.name === name);
        return d ? d.src : "";
      }),
    }));
  };

  // iOS(아이폰) vs Android 비교 — '전체'면 전 앱 합계, 특정 앱이면 그 앱의 두 플랫폼
  // 색상은 항상 iOS=파랑 / Android=초록으로 고정해 명확히 구분한다.
  const PLATFORM_COLORS = ["#2D6BFF", "#16A34A"];
  const buildPlatformSeries = () => {
    const label = selectedApp === "all" ? "전체" : selectedApp;
    const pick = (mi, plat) => {
      if (selectedApp === "all") {
        return appMonthly[mi].apps.reduce((s, a) => s + (a[plat] || 0), 0);
      }
      const app = appMonthly[mi].apps.find(a => a.name === selectedApp);
      return app ? (app[plat] || 0) : 0;
    };
    const src = selectedApp === "all" ? "SensorTower 추정 (전 앱 합계)" : "SensorTower 추정";
    return [
      { name: `${label} · iOS(아이폰)`, values: months.map((_m, mi) => pick(mi, "ios")), srcs: months.map(() => src) },
      { name: `${label} · Android`, values: months.map((_m, mi) => pick(mi, "android")), srcs: months.map(() => src) },
    ];
  };

  return (
    <section className="board" ref={sectionRef} data-screen-label="Monthly Trends">
     <AnimCtx.Provider value={inView}>
      <div className="board-head">
        <span className="board-tab" style={{ background: "var(--accent)" }} />
        <div className="board-titles">
          <h2>AI 월별 추이 <span className="board-en">Monthly Trends · Downloads & Revenue</span></h2>
          <p>AI 앱 다운로드(추정) · 매출 월별 추이 · 유료 데이터/공시/내부 추정 혼재</p>
        </div>
        <div className="feed-filters">
          <button className={tab === "downloads" ? "on" : ""} onClick={() => setTab("downloads")}>AI 앱 월별(합산)</button>
          <button className={tab === "platform" ? "on" : ""} onClick={() => setTab("platform")}>iOS vs Android</button>
          <button className={tab === "revenue" ? "on" : ""} onClick={() => setTab("revenue")}>AI 월별 매출</button>
        </div>
      </div>

      <div className="monthly-app-filter">
        <button className={selectedApp === "all" ? "monthly-btn on" : "monthly-btn"} onClick={() => setSelectedApp("all")}>전체</button>
        {(tab === "revenue" ? allRevNames : allAppNames).map(name => {
          const dom = appDomain(name);
          return (
            <button key={name} className={selectedApp === name ? "monthly-btn on" : "monthly-btn"} onClick={() => setSelectedApp(name)}>
              {dom && <img className="monthly-btn-logo" src={`https://www.google.com/s2/favicons?domain=${dom}&sz=32`} alt="" loading="lazy" />}
              {name}
            </button>
          );
        })}
      </div>

      <div className="chart-grid">
        {tab === "downloads" && (
          <div className="chart-card wide" style={{ gridColumn: "1 / -1" }}>
            <div className="cc-head"><h3>AI 앱 월별 다운로드 추이 (Modeled Estimate)</h3><span>M(백만) · iOS+Android 합산 · SensorTower 유료 데이터 기반 · 공개 검증 불가(Paid dataset / not publicly verifiable)</span></div>
            <MonthlyLineChart series={buildDownloadSeries()} months={months} colors={appColors} ink={theme.ink} muted={theme.muted} grid={theme.grid} unit="M" companies={data.COMPANIES} />
          </div>
        )}
        {tab === "platform" && (
          <div className="chart-card wide" style={{ gridColumn: "1 / -1" }}>
            <div className="cc-head"><h3>iOS(아이폰) vs Android 다운로드 비교</h3><span>M(백만) · <b style={{ color: "#2D6BFF" }}>파랑=iOS</b> / <b style={{ color: "#16A34A" }}>초록=Android</b> · 위 버튼에서 앱 선택(전체=합계) · SensorTower 추정</span></div>
            <MonthlyLineChart series={buildPlatformSeries()} months={months} colors={PLATFORM_COLORS} ink={theme.ink} muted={theme.muted} grid={theme.grid} unit="M" companies={data.COMPANIES} />
          </div>
        )}
        {tab === "revenue" && (
          <div className="chart-card wide" style={{ gridColumn: "1 / -1" }}>
            <div className="cc-head"><h3>AI 월별 매출 추이 (Reported / ARR / Run-rate / Estimate 혼재)</h3><span>$M · 공시 매출, ARR 배분, 런레이트, 내부 추정이 혼재됨 — 데이터 성격은 각 포인트 소스 참조</span></div>
            <MonthlyLineChart series={buildRevenueSeries()} months={revMonths} colors={appColors} ink={theme.ink} muted={theme.muted} grid={theme.grid} unit="M" valuePrefix="$" companies={data.COMPANIES} />
          </div>
        )}
      </div>
     </AnimCtx.Provider>
    </section>
  );
}

// ---- Signals board: capability-reliability gap · adoption funnel · fact-check layer ----
function CapRelChart({ data, theme }) {
  const W = 520, H = 210, padL = 36, padR = 14, padT = 18, padB = 30;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = data.length;
  const x = i => padL + (iw * i) / (n - 1 || 1);
  const y = v => padT + ih - (ih * v) / 100;
  const capPts = data.map((d, i) => `${x(i)},${y(d.cap)}`).join(" ");
  const relPts = data.map((d, i) => `${x(i)},${y(d.rel)}`).join(" ");
  const gapArea = `${data.map((d, i) => `${x(i)},${y(d.cap)}`).join(" ")} ${[...data].reverse().map((d, i) => `${x(n - 1 - i)},${y(d.rel)}`).join(" ")}`;
  const [tip, setTip] = React.useState(null);
  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        {[0, 25, 50, 75, 100].map(t => (
          <g key={t}>
            <line x1={padL} x2={padL + iw} y1={y(t)} y2={y(t)} stroke={theme.grid} strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill={theme.muted}>{t}</text>
          </g>
        ))}
        <polygon points={gapArea} fill="#F59E0B" opacity="0.14" />
        <polyline points={capPts} fill="none" stroke="#2D6BFF" strokeWidth="2.6" strokeLinejoin="round" />
        <polyline points={relPts} fill="none" stroke="#16A34A" strokeWidth="2.6" strokeLinejoin="round" strokeDasharray="5 3" />
        {data.map((d, i) => (
          <g key={i}>
            <text x={x(i)} y={H - 16} textAnchor="middle" fontSize="8.5" fill={theme.muted}>{d.period}</text>
            <circle cx={x(i)} cy={y(d.cap)} r="3" fill="#fff" stroke="#2D6BFF" strokeWidth="1.6" />
            <circle cx={x(i)} cy={y(d.rel)} r="3" fill="#fff" stroke="#16A34A" strokeWidth="1.6" />
            <rect x={x(i) - 16} y={padT} width="32" height={ih} fill="transparent" style={{ cursor: "pointer" }}
              onMouseEnter={e => setTip({ x: e.clientX, y: e.clientY, d })} onMouseMove={e => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : t)} />
            <text x={x(i)} y={y(d.cap) - 7} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#2D6BFF">{d.cap}</text>
            <text x={x(i)} y={y(d.rel) + 13} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#16A34A">{d.rel}</text>
          </g>
        ))}
      </svg>
      <div className="caprel-legend">
        <span><i style={{ background: "#2D6BFF" }} /> 성능(capability)</span>
        <span><i style={{ background: "#16A34A" }} /> 신뢰성(자율 성공률)</span>
        <span><i style={{ background: "#F59E0B" }} /> 격차(gap)</span>
      </div>
      {tip && <div className="chart-tip" style={{ left: Math.min(tip.x + 16, window.innerWidth - 260), top: tip.y + 18 }}>
        <b>{tip.d.period}</b> · 성능 {tip.d.cap} / 신뢰성 {tip.d.rel} (격차 {tip.d.cap - tip.d.rel}p)<br /><em>{tip.d.note} — {tip.d.src}</em>
      </div>}
    </div>
  );
}

const FC_GRADE = { A: { c: "#16A34A", t: "공식" }, B: { c: "#2D6BFF", t: "보도" }, C: { c: "#D97706", t: "추정" } };
function FactCheckLayer({ data }) {
  return (
    <div className="factcheck">
      <div className="fc-head-row">
        <span>지표</span><span>값</span><span>등급</span><span>유형</span><span>검증일 · 출처</span>
      </div>
      {data.map((d, i) => {
        const g = FC_GRADE[d.grade] || FC_GRADE.C;
        return (
          <div className="fc-row" key={i}>
            <span className="fc-item">{d.item}</span>
            <span className="fc-value">{d.value}</span>
            <span className="fc-grade"><b style={{ background: g.c }}>{d.grade}</b></span>
            <span className="fc-type" style={{ color: g.c, borderColor: g.c }}>{d.type}</span>
            <span className="fc-src"><time>{d.verified}</time> · {d.src}</span>
          </div>
        );
      })}
    </div>
  );
}

function SignalBoard({ data, theme, sectionRef }) {
  const inView = useInView(sectionRef);
  return (
    <section className="board" ref={sectionRef} data-screen-label="Reliability & Adoption">
     <AnimCtx.Provider value={inView}>
      <div className="board-head">
        <span className="board-tab" style={{ background: "var(--accent)" }} />
        <div className="board-titles">
          <h2>신뢰성 · 도입 · 검증 <span className="board-en">Reliability · Adoption · Fact-Check</span></h2>
          <p>'AI 대세' 단정 대신 — 성능↔신뢰성 격차, 파일럿→스케일 퍼널, 수치별 검증 레이어</p>
        </div>
      </div>
      <div className="chart-grid">
        <div className="chart-card wide" style={{ gridColumn: "1 / -1" }}>
          <div className="cc-head"><h3>① Capability–Reliability Gap</h3><span>성능은 오르지만 자율 신뢰성은 지연 · Stanford HAI AI Index 2026</span></div>
          <CapRelChart data={data.CAP_REL} theme={theme} />
        </div>
        <div className="chart-card wide" style={{ gridColumn: "1 / -1" }}>
          <div className="cc-head"><h3>② 팩트체크 레이어</h3><span>수치별 등급(A 공식/B 보도/C 추정)·유형·검증일·출처</span></div>
          <FactCheckLayer data={data.FACTCHECK} />
        </div>
      </div>
     </AnimCtx.Provider>
    </section>
  );
}

Object.assign(window, { BoldSummary, CoLogo, CompanyBoard, CompanyDetail, ArticleFeed, InsightsBoard, ChartsBoard, VPBoard, ReportsBoard, DynamicsBoard, OverviewCharts, BizModelBoard, MonthlyTrendsBoard, SignalBoard });
