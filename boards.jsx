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
  // 스타트업 행 삭제(비밀번호 000) — localStorage 영구 보존
  const CO_LS = "aiDashDeletedCompanies";
  const [delCos, setDelCos] = React.useState(() => { try { return JSON.parse(localStorage.getItem(CO_LS) || "{}"); } catch { return {}; } });
  const [coPending, setCoPending] = React.useState(null);
  const [coPw, setCoPw] = React.useState("");
  const [coPwErr, setCoPwErr] = React.useState(false);
  const confirmCoDel = (name) => {
    if (coPw !== "000") { setCoPwErr(true); return; }
    setDelCos(d => { const n = { ...d, [name]: 1 }; try { localStorage.setItem(CO_LS, JSON.stringify(n)); } catch {} return n; });
    setCoPending(null); setCoPw(""); setCoPwErr(false);
  };
  const isStartup = cat.id === "startup";
  const sizeOf = (c) => { const m = String(c.valuation).replace(/[$,+~\s]/g, "").match(/([\d.]+)\s*([TBM])?/i); if (!m) return 0; const v = parseFloat(m[1]); const u = (m[2] || "B").toUpperCase(); return u === "T" ? v * 1000 : u === "M" ? v / 1000 : v; };
  const rows = companies.filter(c => c.cat === cat.id)
    .filter(c => !delCos[c.name])
    .filter(c => !query || (c.name + c.unit + c.note).toLowerCase().includes(query.toLowerCase()));
  const open = c => onSelect && onSelect(c);

  const Row = (c, i, total) => {
    const local = staggerP(prog, i, total);
    return (
      <div className="ct-row" key={c.name}
        style={{ "--accent": cat.accent, opacity: 0.1 + 0.9 * local, transform: `translateY(${(1 - local) * 12}px)` }}>
        <span className="ct-name" role="button" tabIndex={0} title={c.name + " 상세 보기"}
          onClick={() => open(c)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(c); } }}>
          <CoLogo name={c.name} domain={c.domain} accent={cat.accent} />
          <b>{c.name}</b>
          <Icon name="chevron" size={12} />
        </span>
        <span className="ct-seg">{c.rel && <em className="ct-rel" style={{ color: cat.accent, borderColor: cat.accent }}>{c.rel}</em>}{c.unit}</span>
        <span className="num ct-valcell" title={c.valAsof ? `출처: '${c.valAsof} 기준` : ""}>
          <AnimatedNumber className="ct-val" value={c.valuation} />
          {c.valAsof && c.valAsof !== "—" && <em className="ct-asof">'{c.valAsof} 기준</em>}
        </span>
        <span className="num" title={c.metricAsof ? `출처: '${c.metricAsof} 기준` : ""}>
          <em className="ct-metric">{c.metric}</em>
          <AnimatedNumber className="ct-mval" value={c.value} />
          {c.metricAsof && c.metricAsof !== "—" && <em className="ct-asof">'{c.metricAsof} 기준</em>}
        </span>
        <span className="ct-note">
          {isStartup && (coPending === c.name ? (
            <span className="art-del-pw" onClick={e => e.stopPropagation()}>
              <input type="password" inputMode="numeric" className={"art-pw-input" + (coPwErr ? " err" : "")} placeholder="비밀번호" value={coPw} autoFocus
                onChange={e => { setCoPw(e.target.value); setCoPwErr(false); }}
                onKeyDown={e => { if (e.key === "Enter") confirmCoDel(c.name); else if (e.key === "Escape") { setCoPending(null); setCoPw(""); setCoPwErr(false); } }} />
              <button className="art-pw-ok" onClick={() => confirmCoDel(c.name)}>삭제</button>
              <button className="art-pw-cancel" onClick={() => { setCoPending(null); setCoPw(""); setCoPwErr(false); }}><Icon name="x" size={12} sw={2.2} /></button>
              {coPwErr && <span className="art-pw-err">비밀번호가 틀렸습니다.</span>}
            </span>
          ) : (
            <button className="ct-del" title="이 스타트업 삭제(비밀번호 필요)" onClick={e => { e.stopPropagation(); setCoPending(c.name); setCoPw(""); setCoPwErr(false); }}>
              <Icon name="x" size={12} sw={2.2} />
            </button>
          ))}
          {c.strategy && (
            <span className="ct-strat">
              <em className="ct-strat-label">{c.strategy.label}</em>
              <em className="ct-strat-score" title="투자 매력도(1~5) — 주간 LLM 평가">투자 {c.strategy.invest}/5</em>
              <span className="ct-strat-txt"><b>투자:</b> {c.strategy.investNote} <b>협력:</b> {c.strategy.collab}</span>
            </span>
          )}
          {c.live && c.live.latest && (
            <a className="ct-live" href={c.live.latest.url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}>
              <Icon name="news" size={10} /> {c.live.latest.date && c.live.latest.date.slice(5)} {String(c.live.latest.title).slice(0, 46)}{String(c.live.latest.title).length > 46 ? "…" : ""}
              {c.live.mentions7 > 0 && <em>7일 {c.live.mentions7}건</em>}
            </a>
          )}
          <BoldSummary text={c.note} /></span>
      </div>
    );
  };

  // 카테고리별 그룹핑: 스타트업=a16z 버티컬(c.vertical=ko) / 빅테크=핵심지표 성격(c.group=id)
  const groupCfg = cat.id === "startup"
    ? { groups: window.DASH.STARTUP_VERTICALS || [], match: (c, g) => c.vertical === g.ko }
    : cat.id === "bigtech"
    ? { groups: window.DASH.BIGTECH_GROUPS || [], match: (c, g) => c.group === g.id }
    : null;
  let body;
  if (groupCfg && groupCfg.groups.length) {
    let idx = 0;
    body = groupCfg.groups.map(v => {
      const grp = rows.filter(c => groupCfg.match(c, v)).sort((a, b) => sizeOf(b) - sizeOf(a));
      if (!grp.length) return null;
      return (
        <React.Fragment key={v.id}>
          <div className="ct-vgroup" style={{ "--accent": cat.accent }}>
            <span className="ct-vg-name"><Icon name="grid" size={13} /> {v.ko} <em>{v.en}</em></span>
            <span className="ct-vg-desc">{v.desc}</span>
            <span className="ct-vg-count">{grp.length}</span>
          </div>
          {grp.map(c => Row(c, idx++, rows.length))}
        </React.Fragment>
      );
    });
  } else {
    body = rows.map((c, i) => Row(c, i, rows.length));
  }

  return (
    <section className="board" ref={sectionRef} data-screen-label={cat.en}>
     <AnimCtx.Provider value={inView}>
      <div className="board-head" style={{ "--accent": cat.accent }}>
        <span className="board-tab" style={{ background: cat.accent }} />
        <div className="board-titles">
          <h2>{cat.ko} <span className="board-en">{cat.en}</span></h2>
          <p>{isStartup ? "6개 카테고리로 분류 — 에이전틱 AI·코딩 / 검색·어시스턴트 / 크리에이티브 도구 / 인프라·파운데이션 / 지역 AI 플랫폼 / 엔터프라이즈 AI(별도 소스: CB Insights)" : cat.desc} · 업체명 클릭 시 상세 정보</p>
        </div>
        <div className="board-count" style={{ color: cat.accent, background: cat.accentSoft }}>{rows.length} 社</div>
      </div>

      <div className={"ctable d-" + density}>
        <div className="ct-head">
          <span>기업</span>
          <span>세그먼트</span>
          <span className="num">밸류에이션</span>
          <span className="num">핵심지표</span>
          <span>코멘트</span>
        </div>
        {body}
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
  const clean = String(text).replace(/<[^>]+>/g, "")           // strip stray HTML (e.g. <font color>)
    .replace(/2026[.\-](\d{1,2})[.\-](\d{1,2})/g, (_, m, d) => `${+m}/${+d}`);
  const lines = clean.split(/\n+/).map(l => l.trim()).filter(Boolean).slice(0, 3);   // 최대 3줄
  if (lines.length <= 1) return <>{hlNums(clean, "s")}</>;
  return lines.map((line, i) => (
    <span className="art-sum-line" key={i}>{hlNums(line.replace(/^[·\-•]\s*/, "").replace(/[.。]+\s*$/, ""), "l" + i)}</span>
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

  // 기사 삭제는 비밀번호('000') 입력 시에만 동작. 틀리면 삭제하지 않고 안내만 표시.
  const DEL_PW = "000";
  const [pendingDel, setPendingDel] = React.useState(null);  // 비밀번호 입력 대기 중인 기사 key
  const [pwInput, setPwInput] = React.useState("");
  const [pwErr, setPwErr] = React.useState(false);
  const [selKey, setSelKey] = React.useState(null);   // 클릭 선택된 기사(외곽선 박스)
  const askDelete = (a) => { setPendingDel(keyOf(a)); setPwInput(""); setPwErr(false); };
  const cancelDelete = () => { setPendingDel(null); setPwInput(""); setPwErr(false); };
  const confirmDelete = (a) => {
    if (pwInput === DEL_PW) { removeArticle(a); cancelDelete(); }
    else { setPwErr(true); }   // 비밀번호 불일치 — 삭제하지 않음
  };

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
          <p>✕로 불필요한 기사 삭제</p>
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
            const isSel = selKey === keyOf(a);
            return (
              <div className={"art" + (isSel ? " art-sel" : "")} key={keyOf(a)}
                onClick={() => setSelKey(isSel ? null : keyOf(a))}>
                <span className="art-cat" style={{ background: c.accent }} />
                <div className="art-body">
                  <span className="art-meta">
                    <em className="art-src">{a.source}</em>
                    {a.co && <span className="art-co" style={{ color: c.accent, borderColor: c.accent }}>{a.co}</span>}
                    <span className="art-tag" style={{ color: c.accent, background: c.accentSoft }}>{a.tag}</span>
                    <span className="art-date">{fmtPubKo(pubOf(a))} 발표</span>
                  </span>
                  <a className="art-title" href={a.url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}>{a.title}</a>
                  {a.summary && <span className="art-summary"><BoldSummary text={a.summary} /></span>}
                </div>
                {pendingDel === keyOf(a) ? (
                  <div className="art-del-pw" onClick={e => e.stopPropagation()}>
                    <input type="password" inputMode="numeric" className={"art-pw-input" + (pwErr ? " err" : "")}
                      placeholder="비밀번호" value={pwInput} autoFocus aria-label="삭제 비밀번호"
                      onChange={e => { setPwInput(e.target.value); setPwErr(false); }}
                      onKeyDown={e => { if (e.key === "Enter") confirmDelete(a); else if (e.key === "Escape") cancelDelete(); }} />
                    <button className="art-pw-ok" onClick={() => confirmDelete(a)} title="삭제 확인">삭제</button>
                    <button className="art-pw-cancel" onClick={cancelDelete} title="취소" aria-label="취소"><Icon name="x" size={12} sw={2.2} /></button>
                    {pwErr && <span className="art-pw-err">비밀번호가 틀렸습니다.</span>}
                  </div>
                ) : (
                  <button className="art-del" title="이 기사 삭제(비밀번호 필요)" aria-label="기사 삭제"
                    onClick={e => { e.stopPropagation(); askDelete(a); }}>
                    <Icon name="x" size={13} sw={2.2} />
                  </button>
                )}
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
          <h2>정량 분석 <span className="board-en">Quant Hub · 시장·기업 지표</span></h2>
          <p>핵심 KPI · AI 시장 규모·점유율·펀딩 · 기업별 밸류에이션·사용자·가격·매출 정량 비교</p>
        </div>
      </div>

      <KpiStrip kpis={data.KPIS} />
      <OverviewCharts data={data} cats={cats} theme={theme} />

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
          <div className="cc-head"><h3>AI 매출 — SW·서비스</h3><span title="모델·클라우드·앱 매출">$B · 연환산/ARR/run-rate · 공시·추정</span></div>
          <HBarChart data={data.REVENUE.filter(d => d.seg === "sw")} colorOf={d => catColor(d.cat)} ink={theme.ink} muted={theme.muted} grid={theme.grid} unit="B" valuePrefix="$" />
        </div>

        <div className="chart-card">
          <div className="cc-head"><h3>AI 매출 — HW(칩)</h3><span title="AI 가속기 하드웨어 매출 — 척도가 달라 SW와 분리">$B · 연매출 · 공시</span></div>
          <HBarChart data={data.REVENUE.filter(d => d.seg === "hw")} colorOf={d => catColor(d.cat)} ink={theme.ink} muted={theme.muted} grid={theme.grid} unit="B" valuePrefix="$" />
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
          <p>증권사·시장기관 AI 리포트 정량 요약 · 클릭 시 원문 이동 · <b>시사점:</b> 단말 AI 로드맵·BOM·교체수요 가정의 외부 검증 레퍼런스</p>
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
function StockBoard({ stocks, stockData, cats, groups, sectionRef, theme }) {
  const inView = useInView(sectionRef);
  const catMap = Object.fromEntries((cats || []).map(c => [c.id, c]));
  const groupMap = Object.fromEntries((groups || []).map(g => [g.id, g]));
  const [ticker, setTicker] = React.useState((stocks[0] || {}).ticker);
  const [years, setYears] = React.useState(1);
  const [groupFilter, setGroupFilter] = React.useState("all");
  const sel = stocks.find(s => s.ticker === ticker) || stocks[0];
  const selGroup = groupMap[sel.group];
  const accent = (selGroup || catMap[sel.cat] || {}).accent || theme.accent;
  const real = (stockData && stockData[sel.ticker]) || null;
  const mcap = sel.private ? sel.mcap : (real && real.marketCap);
  const visibleStocks = groupFilter === "all" ? stocks : stocks.filter(s => s.group === groupFilter);
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

      <div className="stock-group-filters">
        <button className={groupFilter === "all" ? "on" : ""} onClick={() => setGroupFilter("all")}>전체</button>
        {(groups || []).map(g => (
          <button key={g.id} className={groupFilter === g.id ? "on" : ""}
            style={groupFilter === g.id ? { borderColor: g.accent, color: g.accent, background: g.accentSoft } : null}
            onClick={() => {
              setGroupFilter(g.id);
              if (sel.group !== g.id) { const first = stocks.find(s => s.group === g.id); if (first) setTicker(first.ticker); }
            }}>
            {g.ko}
          </button>
        ))}
      </div>

      <div className="stock-tabs">
        {visibleStocks.map(s => {
          const ac = (groupMap[s.group] || catMap[s.cat] || {}).accent || theme.accent;
          const acSoft = (groupMap[s.group] || catMap[s.cat] || {}).accentSoft;
          const on = s.ticker === ticker;
          return (
            <button key={s.ticker} className={"stock-tab" + (on ? " on" : "")}
              style={on ? { borderColor: ac, color: ac, background: acSoft } : null}
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
          <span className="sp-cat" style={{ color: accent, background: (selGroup || {}).accentSoft }}>{(selGroup || {}).ko}</span>
          {mcap && <span className="sp-mcap">시가총액 <b>{mcap}</b></span>}
          {real && real.scenario && <span className="sp-scenario">시나리오(실시세 피드 미반영)</span>}
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
        <p className="stock-updated">출처: 일별 자동 크롤링(Stooq 등) · 시총 = 종가 × 발행주식수(근사)</p>
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
  // SpaceX(xAI·Grok·Cursor) 연관
  { from: "SpaceX (xAI, Cursor)", to: "OpenAI", type: "경쟁", label: "Grok·Cursor vs GPT·Codex" },
  { from: "SpaceX (xAI, Cursor)", to: "Anthropic", type: "경쟁", label: "Cursor vs Claude Code" },
  { from: "SpaceX (xAI, Cursor)", to: "Google DeepMind", type: "경쟁", label: "Grok vs Gemini" },
  // NVIDIA — 칩 경쟁(자체 실리콘) + 공급 허브
  { from: "NVIDIA", to: "Google DeepMind", type: "경쟁", label: "GPU vs 자체 TPU" },
  { from: "NVIDIA", to: "Amazon", type: "경쟁", label: "GPU vs Trainium" },
  { from: "NVIDIA", to: "OpenAI", type: "매출", label: "GPU 공급 → 매출" },
  { from: "NVIDIA", to: "Anthropic", type: "매출", label: "GPU 공급 → 매출" },
  // Apple — 단말 비서 경쟁 + 모델 파트너십
  { from: "Apple", to: "Google DeepMind", type: "파트너십", label: "Gemini 탑재 Siri" },
  { from: "Apple", to: "OpenAI", type: "파트너십", label: "Siri ChatGPT 연동" },
  { from: "Apple", to: "Anthropic", type: "파트너십", label: "Claude 아이폰 선택지" },
  // 빅테크–모델 핵심 자본 관계
  { from: "Microsoft", to: "OpenAI", type: "투자", label: "독점 파트너십·$13B 투자" },
  { from: "Amazon", to: "Anthropic", type: "투자", label: "투자 $13B+·AWS 약정" },
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

function KnowledgeGraph({ companies, cats, catMap, progress, mode, articleByCo }) {
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
          <p className="kg-detail-note">{hlKey(selCo.note)}</p>
          {articleByCo && articleByCo[selCo.name] && (
            <a className="kg-detail-article" href={articleByCo[selCo.name].url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}>
              <span className="kg-da-tag"><Icon name="news" size={11} /> 최신 기사</span>
              <span className="kg-da-title">{hlKey(articleByCo[selCo.name].title)}</span>
              <span className="kg-da-go">›</span>
            </a>
          )}
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

// ---- Executive Summary 내 '경쟁 구도' — 관계(엣지)가 있는 업체만, 노드→최신 기사 ----
function ESCompetitiveMap({ companies, cats, articles }) {
  const ref = React.useRef(null);
  const inView = useInView(ref);
  const prog = useProgress(inView, 1400);
  const catMap = Object.fromEntries(cats.map(c => [c.id, c]));

  // 연결 관계(COMPETE_EDGES)가 있는 업체만 노드로 표시 — 관계 없는 업체는 제외. + 업체별 최신 기사 매핑
  const { list, articleByCo } = React.useMemo(() => {
    const connected = new Set();
    COMPETE_EDGES.forEach(e => { connected.add(e.from); connected.add(e.to); });
    const list = companies.filter(c => connected.has(c.name));
    const names = list.map(c => c.name);
    const matchName = (co) => names.find(n => n === co || co.startsWith(n.split(" (")[0]) || n.startsWith(co.split(" (")[0]));
    const byName = {};
    (articles || []).forEach(a => {
      if (!a.co) return;
      const m = matchName(a.co);
      if (!m) return;
      if (!byName[m] || a.date > byName[m].date) byName[m] = { title: a.title, url: a.url, date: a.date };
    });
    return { list, articleByCo: byName };
  }, [companies, articles]);

  const graphKey = list.map(c => c.name).join("|");   // 목록이 바뀌면 그래프 재구성
  return (
    <div className="es-compmap" ref={ref}>
     <AnimCtx.Provider value={inView}>
      <div className="es-cm-head">
        <span className="es-cm-kicker"><em>Competitive Dynamics</em></span>
        <span className="es-cm-legend">
          <i style={{ background: "#FF4D4D" }} />경쟁
          <i style={{ background: "#2D6BFF" }} />파트너십
          <i style={{ background: "#00C2A8" }} />투자
          <i style={{ background: "#F59E0B" }} />공급
        </span>
      </div>
      <KnowledgeGraph key={graphKey} companies={list} cats={cats} catMap={catMap} progress={prog} mode="dynamics" articleByCo={articleByCo} />
     </AnimCtx.Provider>
    </div>
  );
}

// ---- Biz Model Board (monetization / revenue model per company) ----
const BIGTECH_FLOWS = [
  { name: "Microsoft", flow: ["기업 사용자", "M365·Copilot 구독($30/월)", "Azure AI 클라우드 과금", "AI 런레이트 $37B"], note: "오피스 번들 락인 → 좌석당 추가 과금 + 클라우드 종량제" },
  { name: "Google", flow: ["소비자·광고주", "검색·유튜브 광고", "Gemini 구독 + Cloud 과금", "광고가 AI 투자 재원"], note: "광고 본업이 AI 개발비를 조달 — AI로 광고 타기팅 강화 순환" },
  { name: "Apple", flow: ["단말 구매자", "프리미엄 하드웨어 마진", "서비스 구독(iCloud+ 등)", "AI는 단말 판매 촉진"], note: "AI 직접 과금 없이 교체수요·서비스 ARPU로 회수" },
  { name: "Amazon", flow: ["기업 고객", "AWS Bedrock 모델 호스팅", "컴퓨트·스토리지 종량제", "멀티모델 중립 수수료"], note: "어느 모델이 이겨도 클라우드 사용량으로 수익화" },
  { name: "NVIDIA", flow: ["하이퍼스케일러", "GPU·랙 판매($1.8억/랙)", "CUDA 생태계 락인", "컴퓨트 레이어 75% 점유"], note: "AI 골드러시의 '삽' — CapEx 사이클 최대 수혜" },
  { name: "Meta", flow: ["소비자 30억", "Llama 무료 배포", "AI 광고 최적화·전환율", "광고 매출로 회수"], note: "오픈소스로 생태계 장악 — 수익화는 본업(광고) 강화로" },
];
function BigtechFlowGrid() {
  return (
    <div className="btf-grid">
      {BIGTECH_FLOWS.map(f => (
        <div className="btf-card" key={f.name}>
          <b className="btf-name">{f.name}</b>
          <div className="btf-flow">
            {f.flow.map((s, i) => (
              <React.Fragment key={i}>
                <span className={"btf-step" + (i === f.flow.length - 1 ? " last" : "")}>{s}</span>
                {i < f.flow.length - 1 && <span className="btf-arr">→</span>}
              </React.Fragment>
            ))}
          </div>
          <p className="btf-note">{f.note}</p>
        </div>
      ))}
    </div>
  );
}

function BizModelBoard({ companies, cats, sectionRef, theme }) {
  const inView = useInView(sectionRef);
  const bizProg = useProgress(inView, 1400);
  const catMap = Object.fromEntries(cats.map(c => [c.id, c]));
  const models = window.DASH.BIZ_MODELS || [];
  // 돈의 흐름(MONEY_EDGES)에 등장하는 업체만 노드로 — 경쟁 관계는 제외, 자금/매출/파트너십만
  const moneyConnected = new Set();
  MONEY_EDGES.forEach(e => { moneyConnected.add(e.from); moneyConnected.add(e.to); });
  const moneyCos = companies.filter(c => moneyConnected.has(c.name));

  return (
    <section className="board" ref={sectionRef} data-screen-label="Biz Model">
     <AnimCtx.Provider value={inView}>
      <div className="board-head">
        <span className="board-tab" style={{ background: "var(--accent)" }} />
        <div className="board-titles">
          <h2>AI 비즈니스 모델 <span className="board-en">Money Flow · Who Pays Whom</span></h2>
          <p>투자·인수·GPU/클라우드/데이터 <b>매출</b> 등 실제 '돈의 흐름'을 그래프로 표시 (초록=투자, 주황=매출, 파랑=파트너십) · <b>시사점:</b> 온디바이스 AI 기능의 과금 모델(구독 유료화·단말 번들·커머스 수수료) 설계 참조</p>
        </div>
      <div className="btf-wrap">
        <h3 className="btf-h">빅테크 머니 플로우 <em>누가 → 무엇에 → 어떻게 지불하나</em></h3>
        <BigtechFlowGrid />
      </div>
      </div>
      <div className="pricing-tracker">
        <div className="pt-head"><h3>AI Monetization Tracker — 토큰 단가 & 단말 원가 영향</h3><span>$ / 100만 토큰 (입력 / 출력) · 온디바이스 대체 시 절감 관점</span></div>
        <div className="pt-table tk-table">
          <div className="pt-row tk-row pt-hrow"><span>티어</span><span>모델</span><span>입력/출력 단가</span><span>단말 원가 영향</span></div>
          {(window.DASH.TOKEN_PRICING || []).map((p, i) => {
            const ac = (catMap[p.tone] || {}).accent || "var(--accent)";
            const tierC = p.tier === "Flagship" ? "#D23B3B" : p.tier === "Mid" ? "#F59E0B" : "#16A34A";
            return (
              <div className="pt-row tk-row" key={i}>
                <span className="tk-tier" style={{ color: tierC, borderColor: tierC }}>{p.tier}</span>
                <span className="pt-model"><i style={{ background: ac }} />{p.model}</span>
                <span className="pt-price">{p.io}</span>
                <span className="pt-note">{p.cost}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pricing-tracker">
        <div className="pt-head"><h3>수익화 프라이싱 모델 — 누가 얼마에 파는가</h3><span>5종 과금 구조 · 온디바이스 AI 기능 과금 설계 참조</span></div>
        <div className="pt-table">
          <div className="pt-row pt-hrow"><span>모델</span><span>대표 업체</span><span>단가 구조</span><span>시사점</span></div>
          {(window.DASH.PRICING_MODELS || []).map((p, i) => {
            const ac = (catMap[p.tone] || {}).accent || "var(--accent)";
            return (
              <div className="pt-row" key={i}>
                <span className="pt-model"><i style={{ background: ac }} />{p.model}</span>
                <span className="pt-players">{p.players}</span>
                <span className="pt-price">{p.price}</span>
                <span className="pt-note">{p.note}</span>
              </div>
            );
          })}
        </div>
        <p className="pt-foot"><b>시사점:</b> 추론 단가가 무료에 수렴하면서 '구독' 단일 모델은 흔들리는 중 — 단말 제조사는 <b>구독 유료화·단말 가격 프리미엄·커머스 수수료·번들 크레딧</b>을 조합한 하이브리드 과금을 설계해야 한다. 성과 기반(outcome) 과금은 ROI 증명이 쉬운 버티컬부터 적용 가능.</p>
      </div>
      <div className="es-cm-head" style={{ marginTop: 18 }}>
        <span className="es-cm-kicker"><em>Money Flow · 돈의 흐름</em></span>
        <span className="es-cm-legend">
          <i style={{ background: "#00C2A8" }} />투자
          <i style={{ background: "#F59E0B" }} />매출
          <i style={{ background: "#2D6BFF" }} />파트너십
        </span>
      </div>
      <KnowledgeGraph companies={moneyCos} cats={cats} catMap={catMap} progress={bizProg} mode="bizmodel" />
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

// ---- Monthly Revenue Trends Board ----
// 앱 다운로드(SensorTower) 차트는 무료로 크롤링 가능한 실데이터 소스가 없어(유료 전용) 삭제함.
// 매출 추이는 공시/ARR·run-rate 기반 모델값이라 유지하되 성격을 명시한다.
function MonthlyTrendsBoard({ data, cats, theme, sectionRef }) {
  const inView = useInView(sectionRef);
  const [seg, setSeg] = React.useState("ai");          // ai=AI 부문 / total=기업 전체 매출
  const [selectedApp, setSelectedApp] = React.useState("all");
  React.useEffect(() => { setSelectedApp("all"); }, [seg]);

  const revMonthly = data.REVENUE_QUARTERLY || data.REVENUE_MONTHLY || [];
  const periodOf = m => m.q || m.month;
  const revMonths = revMonthly.map(periodOf);
  const hasSeg = revMonthly.length > 0 && revMonthly[0].data.some(d => d.seg);
  const segData = mi => (revMonthly[mi] ? revMonthly[mi].data : []).filter(d => !hasSeg || d.seg === seg);
  const allRevNames = revMonthly.length > 0 ? segData(0).map(d => d.name) : [];
  const appColors = ["#1428A0", "#7A38D6", "#0E8F6E", "#D23B3B", "#F59E0B", "#0891B2", "#2D6BFF", "#C026D3"];

  // 첫 분기 → 최신 분기 매출 변화율(Δ) — 추세 요약(뉴스 서술과 분리)
  const revDeltas = revMonthly.length >= 2 ? allRevNames.map(name => {
    const f = (segData(0).find(d => d.name === name) || {}).value || 0;
    const l = (segData(revMonthly.length - 1).find(d => d.name === name) || {}).value || 0;
    return { name, pct: f ? Math.round((l - f) / f * 100) : 0 };
  }).sort((a, b) => b.pct - a.pct) : [];

  const buildRevenueSeries = () => {
    const names = selectedApp === "all" ? allRevNames.slice(0, 7) : [selectedApp];
    return names.map(name => ({
      name,
      values: revMonths.map((_m, mi) => { const d = segData(mi).find(r => r.name === name); return d ? d.value : 0; }),
      srcs: revMonths.map((_m, mi) => { const d = segData(mi).find(r => r.name === name); return d ? d.src : ""; }),
    }));
  };

  return (
    <section className="board" ref={sectionRef} data-screen-label="Quarterly Revenue">
     <AnimCtx.Provider value={inView}>
      <div className="board-head">
        <span className="board-tab" style={{ background: "var(--accent)" }} />
        <div className="board-titles">
          <h2>AI 분기별 매출 추이 <span className="board-en">Quarterly Revenue Trends</span></h2>
          <p>분기 공시 기반 매출 추세 · <b>AI 부문</b>(NVIDIA DC·MS AI·클라우드·OpenAI·Anthropic) vs <b>전체 매출</b> 전환 · Google·Amazon은 AI 매출 비공개라 <b>클라우드 부문</b>으로 대체(AI 인프라 근사)</p>
        </div>
      </div>

      {hasSeg && (
        <div className="seg-toggle">
          <button className={seg === "ai" ? "seg-btn on" : "seg-btn"} onClick={() => setSeg("ai")}>AI 부문 매출</button>
          <button className={seg === "total" ? "seg-btn on" : "seg-btn"} onClick={() => setSeg("total")}>기업 전체 매출</button>
        </div>
      )}

      <div className="monthly-app-filter">
        <button className={selectedApp === "all" ? "monthly-btn on" : "monthly-btn"} onClick={() => setSelectedApp("all")}>전체</button>
        {allRevNames.map(name => {
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
        <div className="chart-card wide" style={{ gridColumn: "1 / -1" }}>
          <div className="cc-head"><h3>{seg === "ai" ? "AI 부문 분기 매출" : "기업 전체 분기 매출"} (공시 기반)</h3><span>$M · {seg === "ai" ? "NVIDIA DC·MS AI run-rate÷4·Google Cloud·AWS·OpenAI·Anthropic" : "각 사 분기 총매출 공시"} — 포인트별 소스 참조</span></div>
          <MonthlyLineChart series={buildRevenueSeries()} months={revMonths} colors={appColors} ink={theme.ink} muted={theme.muted} grid={theme.grid} unit="M" valuePrefix="$" companies={data.COMPANIES} />
        </div>
      </div>
      {revDeltas.length > 0 && (
        <div className="monthly-delta">
          <b>핵심 변화 (Δ {revMonths[0]}→{revMonths[revMonths.length - 1]}):</b>
          {revDeltas.slice(0, 3).map((d, i) => (
            <span className="md-item" key={i}>{d.name} <em className={d.pct >= 0 ? "up" : "down"}>{d.pct >= 0 ? "+" : ""}{d.pct}%</em></span>
          ))}
          <span className="md-read">— {seg === "ai" ? "AI 부문: 성장률 1위 Anthropic·절대 규모 1위 NVIDIA(DC). 클라우드(AWS·Google Cloud)는 AI 비중 큰 근사 지표." : "전체 매출: 절대 규모 Amazon·Alphabet, 성장률은 Meta·Microsoft."}</span>
        </div>
      )}
     </AnimCtx.Provider>
    </section>
  );
}

// ---- Signals board: capability-reliability gap · adoption funnel · fact-check layer ----
// 범용 2계열(%) 추이 차트 — 예: GPU vs 커스텀 실리콘 비중. keyA/keyB로 값 필드를 지정.
function ShareTrendChart({ data, theme, keyA, keyB, labelA, labelB, colorA = "#2D6BFF", colorB = "#16A34A" }) {
  const W = 520, H = 210, padL = 36, padR = 14, padT = 18, padB = 30;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = data.length;
  const x = i => padL + (iw * i) / (n - 1 || 1);
  const y = v => padT + ih - (ih * v) / 100;
  const aPts = data.map((d, i) => `${x(i)},${y(d[keyA])}`).join(" ");
  const bPts = data.map((d, i) => `${x(i)},${y(d[keyB])}`).join(" ");
  const gapArea = `${data.map((d, i) => `${x(i)},${y(d[keyA])}`).join(" ")} ${[...data].reverse().map((d, i) => `${x(n - 1 - i)},${y(d[keyB])}`).join(" ")}`;
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
        <polygon points={gapArea} fill={colorA} opacity="0.08" />
        <polyline points={aPts} fill="none" stroke={colorA} strokeWidth="2.6" strokeLinejoin="round" />
        <polyline points={bPts} fill="none" stroke={colorB} strokeWidth="2.6" strokeLinejoin="round" strokeDasharray="5 3" />
        {data.map((d, i) => (
          <g key={i}>
            <text x={x(i)} y={H - 16} textAnchor="middle" fontSize="8.5" fill={theme.muted}>{d.period}</text>
            <circle cx={x(i)} cy={y(d[keyA])} r="3" fill="#fff" stroke={colorA} strokeWidth="1.6" />
            <circle cx={x(i)} cy={y(d[keyB])} r="3" fill="#fff" stroke={colorB} strokeWidth="1.6" />
            <rect x={x(i) - 16} y={padT} width="32" height={ih} fill="transparent" style={{ cursor: "pointer" }}
              onMouseEnter={e => setTip({ x: e.clientX, y: e.clientY, d })} onMouseMove={e => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : t)} />
            <text x={x(i)} y={y(d[keyA]) - 7} textAnchor="middle" fontSize="8.5" fontWeight="800" fill={colorA}>{d[keyA]}</text>
            <text x={x(i)} y={y(d[keyB]) + 13} textAnchor="middle" fontSize="8.5" fontWeight="800" fill={colorB}>{d[keyB]}</text>
          </g>
        ))}
      </svg>
      <div className="caprel-legend">
        <span><i style={{ background: colorA }} /> {labelA}</span>
        <span><i style={{ background: colorB }} /> {labelB}</span>
      </div>
      {tip && <div className="chart-tip" style={{ left: Math.min(tip.x + 16, window.innerWidth - 260), top: tip.y + 18 }}>
        <b>{tip.d.period}</b> · {labelA} {tip.d[keyA]}% / {labelB} {tip.d[keyB]}%<br /><em>{tip.d.note} — {tip.d.src}</em>
      </div>}
    </div>
  );
}

// 단일 계열(%) 추이 차트 — 예: 광통신(CPO) 데이터센터 침투율
function PenetrationChart({ data, theme, unit = "%" }) {
  const W = 520, H = 210, padL = 30, padR = 14, padT = 18, padB = 30;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = data.length;
  const maxV = Math.max(...data.map(d => d.pen), 10);
  const x = i => padL + (iw * i) / (n - 1 || 1);
  const y = v => padT + ih - (ih * v) / (maxV * 1.15);
  const pts = data.map((d, i) => `${x(i)},${y(d.pen)}`).join(" ");
  const areaPts = `${padL},${padT + ih} ${pts} ${padL + iw},${padT + ih}`;
  const [tip, setTip] = React.useState(null);
  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        <polygon points={areaPts} fill="#7A38D6" opacity="0.12" />
        <polyline points={pts} fill="none" stroke="#7A38D6" strokeWidth="2.6" strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={i}>
            <text x={x(i)} y={H - 16} textAnchor="middle" fontSize="8.5" fill={theme.muted}>{d.year}</text>
            <circle cx={x(i)} cy={y(d.pen)} r="3" fill="#fff" stroke="#7A38D6" strokeWidth="1.6" />
            <rect x={x(i) - 16} y={padT} width="32" height={ih} fill="transparent" style={{ cursor: "pointer" }}
              onMouseEnter={e => setTip({ x: e.clientX, y: e.clientY, d })} onMouseMove={e => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : t)} />
            <text x={x(i)} y={y(d.pen) - 9} textAnchor="middle" fontSize="9" fontWeight="800" fill="#7A38D6">{d.pen}{unit}</text>
          </g>
        ))}
      </svg>
      {tip && <div className="chart-tip" style={{ left: Math.min(tip.x + 16, window.innerWidth - 260), top: tip.y + 18 }}>
        <b>{tip.d.year}</b> · 침투율 {tip.d.pen}{unit}<br /><em>{tip.d.note} — {tip.d.src}</em>
      </div>}
    </div>
  );
}

function SignalBoard({ data, theme, sectionRef }) {
  const inView = useInView(sectionRef);
  const strat = data.INFRA_STRATEGY || { hyperscaler: [], aiNative: [] };
  return (
    <section className="board" ref={sectionRef} data-screen-label="Infra & Future Tech">
     <AnimCtx.Provider value={inView}>
      <div className="board-head">
        <span className="board-tab" style={{ background: "var(--accent)" }} />
        <div className="board-titles">
          <h2>AI 인프라 & 미래 기술 <span className="board-en">Infra & Future Tech</span></h2>
          <p>하이퍼스케일러 CapEx·메모리·칩 믹스·광통신 — 경쟁 로드맵을 좌우하는 인프라 변수</p>
        </div>
      </div>
      <div className="chart-grid">
        <div className="chart-card">
          <div className="cc-head"><h3>하이퍼스케일러 데이터센터 CapEx</h3><span>$B · Big 5 합산 · Moody's / 각사 공시</span></div>
          <MarketGrowthChart data={data.DC_CAPEX} accent={theme.accent} ink={theme.ink} grid={theme.grid} muted={theme.muted} />
        </div>
        <div className="chart-card">
          <div className="cc-head"><h3>HBM(고대역폭메모리) 시장 규모</h3><span>$B · AI 가속기 공급망 최대 병목 · Gartner / BofA</span></div>
          <MarketGrowthChart data={data.HBM_MARKET} accent="#F59E0B" ink={theme.ink} grid={theme.grid} muted={theme.muted} />
        </div>
        <div className="chart-card">
          <div className="cc-head"><h3>AI 가속기 칩 믹스 변화</h3><span>GPU 범용 vs 커스텀 실리콘 비중(%)</span></div>
          <ShareTrendChart data={data.CHIP_MIX} theme={theme} keyA="gpu" keyB="custom" labelA="GPU(범용)" labelB="커스텀 실리콘" colorA="#2D6BFF" colorB="#16A34A" />
        </div>
        <div className="chart-card">
          <div className="cc-head"><h3>광통신(CPO) 데이터센터 침투율</h3><span>% · 차세대 인터커넥트 전환 · IDTechEx</span></div>
          <PenetrationChart data={data.OPTICAL_TREND} theme={theme} />
        </div>
      </div>
      <div className="infra-strategy">
        <div className="is-col">
          <em>하이퍼스케일러 — 자체 칩 + 인프라 임대 병행</em>
          {strat.hyperscaler.map((s, i) => (
            <div className="is-item" key={i}><b>{s.name}</b><span className="is-move">{s.move}</span><p>{s.note}</p></div>
          ))}
        </div>
        <div className="is-col">
          <em>AI 네이티브 — 멀티소싱·소프트웨어 레이어로 종속 탈피</em>
          {strat.aiNative.map((s, i) => (
            <div className="is-item" key={i}><b>{s.name}</b><span className="is-move">{s.move}</span><p>{s.note}</p></div>
          ))}
        </div>
      </div>
      <div className="signal-explain">
        <div className="sx-item">
          <em>왜 이 지표를 넣었나</em>
          <p>CapEx·메모리·칩·광통신은 <b>모델 성능이 아니라 인프라 공급</b>이 경쟁 속도를 좌우한다는 신호입니다. HBM·GPU가 병목이면 아무리 좋은 모델도 배포가 지연됩니다.</p>
        </div>
        <div className="sx-item">
          <em>어떻게 보면 되나</em>
          <p>CapEx·HBM 곡선이 가파를수록 <b>공급 부족·단가 상승</b> 리스크가 커집니다. 칩 믹스에서 커스텀 실리콘 비중 확대는 <b>GPU 단일 의존 완화</b>, 광통신 침투율은 <b>전력 병목의 다음 해법</b>을 뜻합니다.</p>
        </div>
        <div className="sx-item">
          <em>단말 관점 시사점</em>
          <p>인프라 병목·전환 시점은 <b>온디바이스 AI 로드맵의 외생 변수</b>입니다. 메모리·전력 제약이 클라우드 AI 단가에 반영되는 시점, 광통신 상용화로 지연시간이 줄어드는 시점을 <b>분기 단위로 추적</b>해야 합니다.</p>
        </div>
      </div>
     </AnimCtx.Provider>
    </section>
  );
}

// 핵심 수치·키워드 자동 강조(볼드+하이라이트). 숫자=강조색 / 긍정=녹색 / 리스크=노랑 / 전략어=보라.
const HL_NUM = /(\$[\d,.]+\s?[TBMK]?(?:\+|토큰)?|\d+\.?\d*%|\d+\.?\d*억\+?|[0-9]{2,}M\+?|OSWorld\s?\d+%?|\d+GB|\d{2,}만\+?|\d+위|\d+배)/g;
const KW_POS = ["무료", "1위", "신기록", "급증", "최고", "선두", "독점", "표준", "최초", "역대", "돌파", "추월"];
const KW_NEG = ["리스크", "손실", "소송", "논란", "우려", "규제", "적자", "지연", "실패", "쇼크", "둔화", "정체"];
const KW_KEY = ["온디바이스", "단말", "에이전트", "어시스턴트", "비서", "상장", "IPO", "프리미엄", "교체수요", "수익화", "구독"];
const KW_RE = new RegExp("(" + [...KW_POS, ...KW_NEG, ...KW_KEY].join("|") + ")");
function hlKey(text) {
  const segs = String(text || "").split(HL_NUM);
  return segs.map((p, i) => {
    if (/\d/.test(p) && /^\$|%$|억\+?$|M\+?$|GB$|^OSWorld|^\d|만\+?$|위$|배$/.test(p)) return <mark className="tl-hl" key={i}>{p}</mark>;
    return p.split(KW_RE).map((w, j) => {
      const k = i + "-" + j;
      if (KW_POS.includes(w)) return <b className="tl-kw tl-kw-pos" key={k}>{w}</b>;
      if (KW_NEG.includes(w)) return <b className="tl-kw tl-kw-neg" key={k}>{w}</b>;
      if (KW_KEY.includes(w)) return <b className="tl-kw tl-kw-key" key={k}>{w}</b>;
      return <React.Fragment key={k}>{w}</React.Fragment>;
    });
  });
}

// ---- Executive Top-line: 현상 → 의사결정 5초 브리핑 (Overview 최상단) ----
// ---- IB Research Briefing: 증권사 인사이트 1페이저(네이비/골드) + 기관 리서치 피드 ----
function IBInsightBoard({ research, reports, sectionRef }) {
  const inView = useInView(sectionRef);
  const op = research && research.onepager;
  // 삭제된 리포트/피드(비밀번호 000) — localStorage 영구 보존
  const R_LS = "aiDashDeletedReports";
  const [delR, setDelR] = React.useState(() => { try { return JSON.parse(localStorage.getItem(R_LS) || "{}"); } catch { return {}; } });
  const [rPending, setRPending] = React.useState(null);
  const [rPw, setRPw] = React.useState("");
  const [rPwErr, setRPwErr] = React.useState(false);
  const rKey = r => r.url || r.title;
  const cancelR = () => { setRPending(null); setRPw(""); setRPwErr(false); };
  const confirmR = (k) => {
    if (rPw !== "000") { setRPwErr(true); return; }
    setDelR(d => { const n = { ...d, [k]: 1 }; try { localStorage.setItem(R_LS, JSON.stringify(n)); } catch {} return n; });
    cancelR();
  };
  const DelBtn = ({ item }) => (rPending === rKey(item) ? (
    <span className="art-del-pw" onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
      <input type="password" inputMode="numeric" className={"art-pw-input" + (rPwErr ? " err" : "")} placeholder="비밀번호" value={rPw} autoFocus
        onChange={e => { setRPw(e.target.value); setRPwErr(false); }}
        onKeyDown={e => { if (e.key === "Enter") confirmR(rKey(item)); else if (e.key === "Escape") cancelR(); }} />
      <button className="art-pw-ok" onClick={e => { e.preventDefault(); confirmR(rKey(item)); }}>삭제</button>
      <button className="art-pw-cancel" onClick={e => { e.preventDefault(); cancelR(); }}><Icon name="x" size={12} sw={2.2} /></button>
      {rPwErr && <span className="art-pw-err">비밀번호가 틀렸습니다.</span>}
    </span>
  ) : (
    <button className="ct-del" title="삭제(비밀번호 필요)"
      onClick={e => { e.preventDefault(); e.stopPropagation(); setRPending(rKey(item)); setRPw(""); setRPwErr(false); }}>
      <Icon name="x" size={12} sw={2.2} />
    </button>
  ));
  const feed = ((research && research.feed) || []).filter(f => !delR[rKey(f)]);
  const reps = (reports || []).filter(r => !delR[rKey(r)]);
  const [showAll, setShowAll] = React.useState(false);
  if (!op && !feed.length && !reps.length) return null;
  const feedRows = showAll ? feed.slice(0, 20) : feed.slice(0, 8);
  return (
    <section className="board ib-board" ref={sectionRef} data-screen-label="IB Research">
     <AnimCtx.Provider value={inView}>
      {op && (
        <div className="ib-page">
          <div className="ib-topbar">
            <div>
              <div className="ib-eyebrow">IB Research Briefing</div>
              <h2 className="ib-title">{op.title}</h2>
            </div>
            <div className="ib-meta">
              <span><b>Source</b> {op.sourceLine}</span>
              <span><b>Date</b> {op.date}</span>
              <span><b>Scope</b> {op.scope}</span>
              {op.engine === "seed" && <span className="ib-seedtag">첫 자동 갱신 대기</span>}
            </div>
          </div>
          <div className="ib-thesis">
            <div className="ib-thesis-label">One-line Thesis</div>
            <div className="ib-thesis-text">{op.thesis}</div>
          </div>
          <div className="ib-grid">
            <div className="ib-col">
              <div className="ib-card">
                <h3 className="ib-h">1. 핵심 인사이트</h3>
                {(op.insights || []).map((ins, i) => (
                  <div className="ib-insight" key={i}>
                    <span className="ib-num">{i + 1}</span>
                    <div>
                      <h4>{ins.title}</h4>
                      <p>{ins.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="ib-col">
              {(op.metrics || []).length > 0 && (
                <div className="ib-card ib-soft">
                  <h3 className="ib-h">2. 핵심 지표</h3>
                  <div className="ib-metric-row">
                    {op.metrics.slice(0, 4).map((m, i) => (
                      <div className="ib-metric" key={i}><div className="ib-mk">{m.k}</div><div className="ib-mt">{m.t}</div></div>
                    ))}
                  </div>
                </div>
              )}
              {(op.areas || []).length > 0 && (
                <div className="ib-card">
                  <h3 className="ib-h">3. 영역별 분석</h3>
                  <div className="ib-tablewrap">
                    <table className="ib-table">
                      <thead><tr><th>영역</th><th>핵심 변화</th><th>승자 조건</th></tr></thead>
                      <tbody>{op.areas.map((a, i) => (<tr key={i}><td>{a.area}</td><td>{a.change}</td><td>{a.winner}</td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {(op.implications || []).length > 0 && (
                <div className="ib-card">
                  <h3 className="ib-h">4. 투자·전략 시사점</h3>
                  <ul className="ib-imp">
                    {op.implications.map((im, i) => (<li key={i}><span className="ib-pill">{im.pill}</span>{im.text}</li>))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <div className="ib-bottom">
            <h3>최종 결론</h3>
            <p>{op.conclusion}</p>
          </div>
          {op.watch && <div className="ib-foot">Watch: {op.watch}</div>}
        </div>
      )}

      {feed.length > 0 && (
        <div className="ib-feed">
          <div className="ib-feed-head">
            <h3>증권사·기관 리서치 피드 <em>매일 자동 크롤링 · Morgan Stanley·Goldman Sachs·JPMorgan·UBS·TrendForce·IDC·Gartner 등</em></h3>
            {feed.length > 8 && <button onClick={() => setShowAll(s => !s)}>{showAll ? "접기" : `전체 ${Math.min(feed.length, 20)}건`}</button>}
          </div>
          {feedRows.map((f, i) => (
            <a className="ib-feed-row" key={f.url || i} href={f.url} target="_blank" rel="noopener">
              <span className={"ib-house " + (f.type === "Securities" ? "sec" : "mkt")}>{f.house}</span>
              <span className="ib-feed-title">{f.titleKo || f.title}{f.sum && <em> — {f.sum}</em>}</span>
              <span className="ib-feed-meta">{f.source} · {f.date && f.date.slice(5)}</span>
              <Icon name="ext" size={11} />
              <DelBtn item={f} />
            </a>
          ))}
        </div>
      )}

      {reps.length > 0 && (
        <div className="ib-feed ib-reports">
          <div className="ib-feed-head">
            <h3>리서치 리포트 정량 요약 <em>증권사·시장기관 리포트 — 클릭 시 원문 · ✕로 삭제(비밀번호)</em></h3>
          </div>
          {reps.map((r, i) => (
            <a className="ib-feed-row" key={rKey(r)} href={r.url} target="_blank" rel="noopener">
              <span className={"ib-house " + (r.type === "Securities" ? "sec" : "mkt")}>{r.house}</span>
              <span className="ib-feed-title">{r.title}{r.bullets && r.bullets[0] && <em> — {r.bullets[0]}</em>}</span>
              <span className="ib-feed-meta">{r.figure} · {r.date && r.date.slice(2, 7).replace("-", ".")}</span>
              <Icon name="ext" size={11} />
              <DelBtn item={r} />
            </a>
          ))}
        </div>
      )}
     </AnimCtx.Provider>
    </section>
  );
}

// ---- Morning Briefing: 매일 Signal → Insight → Action 카드 + 날짜 아카이브 ----
function BriefingBoard({ briefing, sectionRef }) {
  const inView = useInView(sectionRef);
  const days = (briefing && briefing.days) || [];
  const [dayIdx, setDayIdx] = React.useState(0);
  if (!days.length) return null;
  const day = days[Math.min(dayIdx, days.length - 1)];
  const LABEL_COLOR = { "파트너십 기회": "#16A34A", "인수 후보": "#C026D3", "경쟁 위협": "#D23B3B", "시장 신호": "#2D6BFF", "공급망": "#EA580C", "규제": "#7A38D6", "모니터링": "#8A93A4" };
  return (
    <section className="board" ref={sectionRef} data-screen-label="Morning Briefing">
     <AnimCtx.Provider value={inView}>
      <div className="board-head" style={{ "--accent": "#2D6BFF" }}>
        <span className="board-tab" style={{ background: "#2D6BFF" }} />
        <div className="board-titles">
          <h2>모닝 브리핑 <span className="board-en">Weekly Synthesis · Signal → Insight → Action</span></h2>
          <p>글로벌 외신 기반 매일 자동 생성 · 신사업 기회 스코어(전략 정합성·시장 성장성·실행 가능성·경쟁 우위, 각 1~5) · 12점+ 즉시 검토</p>
        </div>
        <div className="brief-days">
          {days.slice(0, 7).map((d, i) => (
            <button key={d.date} className={i === dayIdx ? "on" : ""} onClick={() => setDayIdx(i)}>
              {i === 0 ? "오늘" : d.date.slice(5).replace("-", "/")}
            </button>
          ))}
        </div>
      </div>

      <div className="brief-headline">
        <Icon name="sun" size={16} /> <b>{day.headline}</b>
        <span className="brief-date">{day.date}{day.engine === "rules" ? " · 자동 요약" : ""}</span>
      </div>

      {(day.stats || []).length > 0 && (
        <div className="brief-stats">
          {day.stats.map((s, i) => (
            <div className="ib-metric" key={i}><div className="ib-mk">{s.k}</div><div className="ib-mt">{s.t}</div></div>
          ))}
        </div>
      )}

      <div className="brief-grid">
        {(day.items || []).map((it, i) => (
          <div key={i} className={"brief-card" + (it.urgent ? " urgent" : "")}>
            <div className="brief-labels">
              {(it.labels || []).map(l => (
                <span key={l} className="brief-label" style={{ "--lc": LABEL_COLOR[l] || "#2D6BFF" }}>{l}</span>
              ))}
              <span className={"brief-score" + (it.urgent ? " hot" : "")} title="전략 정합성·시장 성장성·실행 가능성·경쟁 우위 합계">
                {it.total}/20{it.urgent ? " ★" : ""}
              </span>
            </div>
            <p className="brief-row"><span className="brief-k sig">Signal</span><BoldSummary text={it.signal} /></p>
            <p className="brief-row"><span className="brief-k ins">Insight</span><BoldSummary text={it.insight} /></p>
            <p className="brief-row"><span className="brief-k act">Action</span><BoldSummary text={it.action} /></p>
            <div className="brief-axes">
              {[["정합성", it.scores.fit], ["성장성", it.scores.growth], ["실행", it.scores.exec], ["우위", it.scores.edge]].map(([k, v]) => (
                <span key={k} className="brief-axis">{k} <b>{v}</b></span>
              ))}
            </div>
            {(it.evidence || []).length > 0 && (
              <div className="brief-ev">
                {it.evidence.map((e, k) => (
                  <a key={k} href={e.url} target="_blank" rel="noopener" className="tl-ev-chip">
                    <Icon name="news" size={10} /> {e.source}{e.date ? ` · ${e.date.slice(5)}` : ""}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
     </AnimCtx.Provider>
    </section>
  );
}

// ---- Startup Radar: 주간 큐레이션 + 4축 스코어카드 + 월간 기회 메모 ----
function RadarBoard({ radar, sectionRef }) {
  const inView = useInView(sectionRef);
  const picks = (radar && radar.picks) || [];
  const memos = (radar && radar.memos) || [];
  const [sel, setSel] = React.useState(0);
  if (!picks.length) return null;
  const AXES = [["attach", "서비스 부착"], ["enterprise", "기업 확장성"], ["partner", "파트너십 용이"], ["acquire", "인수 용이"]];
  const LABEL_COLOR = { "파트너십 기회": "#16A34A", "인수 후보": "#C026D3", "모니터링": "#8A93A4" };
  const memo = memos[0];
  return (
    <section className="board" ref={sectionRef} data-screen-label="Startup Radar">
     <AnimCtx.Provider value={inView}>
      <div className="board-head" style={{ "--accent": "#0E8F6E" }}>
        <span className="board-tab" style={{ background: "#0E8F6E" }} />
        <div className="board-titles">
          <h2>스타트업 레이더 <span className="board-en">Weekly Startup Radar · 파트너십·인수 스코어카드</span></h2>
          <p>글로벌 스타트업(한국·중국 제외) 주간 큐레이션 · 4축 자동 스코어(서비스 부착·기업 확장성·파트너십 용이·인수 용이, 각 1~5) · 12점+ 즉시 검토{radar.weekOf ? ` · 기준 주: ${radar.weekOf}` : ""}</p>
        </div>
      </div>

      <div className="radar-grid">
        {picks.map((p, i) => (
          <div key={p.name} className={"radar-card" + (i === sel ? " sel" : "") + (p.urgent ? " urgent" : "")} onClick={() => setSel(i)}>
            <div className="radar-head">
              <img src={`https://www.google.com/s2/favicons?domain=${p.domain}&sz=32`} alt="" loading="lazy" />
              <b>{p.name}</b>
              <span className="radar-meta">{p.region} · {p.vertical}</span>
              <span className={"brief-score" + (p.urgent ? " hot" : "")}>{p.total}/20{p.urgent ? " ★" : ""}</span>
            </div>
            <div className="brief-labels">
              {(p.labels || []).map(l => (
                <span key={l} className="brief-label" style={{ "--lc": LABEL_COLOR[l] || "#2D6BFF" }}>{l}</span>
              ))}
            </div>
            <div className="radar-bars">
              {AXES.map(([k, ko]) => (
                <div key={k} className="radar-bar-row" title={`${ko} ${p.scores[k]}/5`}>
                  <span className="radar-bar-k">{ko}</span>
                  <span className="radar-bar-track"><i style={{ width: (p.scores[k] / 5) * 100 + "%" }} /></span>
                  <b>{p.scores[k]}</b>
                </div>
              ))}
            </div>
            <p className="radar-why"><BoldSummary text={p.why} /></p>
            {i === sel && <p className="radar-part"><span className="brief-k act">협력·인수 관점</span><BoldSummary text={p.partnership} /></p>}
            {(p.evidence || []).length > 0 && (
              <div className="brief-ev">
                {p.evidence.map((e, k) => (
                  <a key={k} href={e.url} target="_blank" rel="noopener" className="tl-ev-chip" onClick={ev => ev.stopPropagation()}>
                    <Icon name="news" size={10} /> {e.source}{e.date ? ` · ${e.date.slice(5)}` : ""}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {memo && (
        <div className="memo-card">
          <div className="memo-head">
            <Icon name="report" size={15} />
            <b>월간 기회 메모 초안 — {memo.title}</b>
            <span className="brief-date">{memo.month}</span>
          </div>
          <p className="brief-row"><span className="brief-k sig">논지</span><BoldSummary text={memo.thesis} /></p>
          <p className="brief-row"><span className="brief-k ins">사업 구조</span><BoldSummary text={memo.structure} /></p>
          {(memo.targets || []).length > 0 && <p className="brief-row"><span className="brief-k act">우선 대상</span>{memo.targets.join(" · ")}</p>}
          <div className="memo-cols">
            <div><em>리스크</em><ul>{(memo.risks || []).map((r, i) => <li key={i}>{r}</li>)}</ul></div>
            <div><em>다음 30일</em><ul>{(memo.next || []).map((r, i) => <li key={i}>{r}</li>)}</ul></div>
          </div>
        </div>
      )}
     </AnimCtx.Provider>
    </section>
  );
}

// insights.json(매일 규칙기반 갱신)이 있으면 그걸로, 없으면 정적 TOPLINE으로 폴백.
function ExecToplines({ items, insights, onNav }) {
  const TONE = { warn: "#D23B3B", signal: "#2D6BFF", revenue: "#16A34A", compete: "#C026D3" };
  const ICON = { warn: "target", signal: "pulse", revenue: "chart", compete: "brain" };
  const NAVLABEL = { bigtech: "빅테크 AI", bizmodel: "수익화 모델", signals: "인프라·미래기술", native: "AI 네이티브", overview: "경쟁 구도", ib: "증권사 인사이트" };
  // 삭제(비밀번호 000) — 축 태그 기준, localStorage 영구 보존
  const LS = "aiDashDeletedES";
  const [delEs, setDelEs] = React.useState(() => { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } });
  const [pend, setPend] = React.useState(null);
  const [pw, setPw] = React.useState("");
  const [pwErr, setPwErr] = React.useState(false);
  const confirmDel = (k) => {
    if (pw !== "000") { setPwErr(true); return; }
    setDelEs(d => { const n = { ...d, [k]: 1 }; try { localStorage.setItem(LS, JSON.stringify(n)); } catch {} return n; });
    setPend(null); setPw(""); setPwErr(false);
  };
  const cards = ((insights && insights.cards && insights.cards.length)
    ? insights.cards.map(c => ({ tag: c.axisLabel, tone: c.tone, nav: c.nav, now: c.headline, cause: c.rootCause, decision: c.soWhat, action: c.action, evidence: c.evidence || [], score: c.score, updatedAt: c.updatedAt }))
    : (items || []).map(t => ({ tag: t.tag, tone: t.tone, nav: t.nav, now: t.now, cause: t.cause, decision: t.decision, action: t.action, evidence: [], score: null })))
    .filter(c => !delEs[c.tag]);
  if (!cards.length) return null;
  return (
    <div className="es-info">
      <div className="es-info-head">
        <span className="es-col-h es-col-axis">전략 축</span>
        <span className="es-col-h">Signal <em>관측된 사실</em></span>
        <span className="es-col-h">Insight <em>왜 중요한가</em></span>
        <span className="es-col-h">Action <em>다음 실행</em></span>
      </div>
      {cards.map((t, i) => {
        const tone = TONE[t.tone] || "#2D6BFF";
        return (
          <div className="es-row" key={t.tag} style={{ "--tl": tone }}>
            <div className="es-axis">
              <span className="es-axis-ico"><Icon name={ICON[t.tone] || "spark"} size={15} /></span>
              <b>{t.tag}</b>
              {pend === t.tag ? (
                <span className="art-del-pw" onClick={e => e.stopPropagation()}>
                  <input type="password" inputMode="numeric" className={"art-pw-input" + (pwErr ? " err" : "")} placeholder="비밀번호" value={pw} autoFocus
                    onChange={e => { setPw(e.target.value); setPwErr(false); }}
                    onKeyDown={e => { if (e.key === "Enter") confirmDel(t.tag); else if (e.key === "Escape") { setPend(null); setPw(""); setPwErr(false); } }} />
                  <button className="art-pw-ok" onClick={() => confirmDel(t.tag)}>삭제</button>
                  <button className="art-pw-cancel" onClick={() => { setPend(null); setPw(""); setPwErr(false); }}><Icon name="x" size={12} sw={2.2} /></button>
                  {pwErr && <span className="art-pw-err">비밀번호 오류</span>}
                </span>
              ) : (
                <button className="ct-del" title="이 축 삭제(비밀번호 필요)" onClick={() => { setPend(t.tag); setPw(""); setPwErr(false); }}>
                  <Icon name="x" size={12} sw={2.2} />
                </button>
              )}
            </div>
            <div className="es-cell es-sig">{hlKey(t.now)}
              {t.evidence.slice(0, 1).map((e, k) => (
                <a className="tl-ev-chip" key={k} href={e.url} target="_blank" rel="noopener">
                  <Icon name="news" size={10} /> {e.source}{e.date ? ` · ${e.date.slice(5)}` : ""}
                </a>
              ))}
            </div>
            <span className="es-arr">→</span>
            <div className="es-cell es-ins">{hlKey(t.decision)}</div>
            <span className="es-arr">→</span>
            <div className="es-cell es-act">{hlKey(t.action || "")}
              {t.nav && <button className="tl-link" onClick={() => onNav && onNav(t.nav)}>{NAVLABEL[t.nav] || "상세"} ›</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ---- AI 신사업 시장 보드: lazy-load(inView 시에만 fetch), MECE 그룹, 플레인 텍스트, 삭제/숨김 ----
function MarketBoard({ sectionRef }) {
  const inView = useInView(sectionRef);
  const [data, setData] = React.useState(null);
  const [loaded, setLoaded] = React.useState(false);
  // 화면에 들어올 때 1회만 market.json 로드 — 초기 페이지 로드에 영향 없음
  React.useEffect(() => {
    if (!inView || loaded) return;
    setLoaded(true);
    fetch("market.json?t=" + Math.floor(Date.now() / 60000), { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j && j.items) setData(j); })
      .catch(() => {});
  }, [inView, loaded]);

  // 삭제(비번 000)·숨김 상태 — localStorage 영구 보존
  const DEL_LS = "aiDashDeletedMarkets", HIDE_LS = "aiDashHiddenMarkets";
  const [del, setDel] = React.useState(() => { try { return JSON.parse(localStorage.getItem(DEL_LS) || "{}"); } catch { return {}; } });
  const [hidden, setHidden] = React.useState(() => { try { return JSON.parse(localStorage.getItem(HIDE_LS) || "{}"); } catch { return {}; } });
  const [pend, setPend] = React.useState(null);
  const [pw, setPw] = React.useState("");
  const [pwErr, setPwErr] = React.useState(false);
  const [showHidden, setShowHidden] = React.useState(false);
  const saveDel = n => { setDel(d => { const x = { ...d, [n]: 1 }; try { localStorage.setItem(DEL_LS, JSON.stringify(x)); } catch {} return x; }); };
  const confirmDel = (id) => { if (pw !== "000") { setPwErr(true); return; } saveDel(id); setPend(null); setPw(""); setPwErr(false); };
  const toggleHide = (id) => setHidden(h => { const x = { ...h }; if (x[id]) delete x[id]; else x[id] = 1; try { localStorage.setItem(HIDE_LS, JSON.stringify(x)); } catch {} return x; });
  const resetAll = () => { setDel({}); setHidden({}); try { localStorage.removeItem(DEL_LS); localStorage.removeItem(HIDE_LS); } catch {} };

  return (
    <section className="board" ref={sectionRef} data-screen-label="AI New Business Markets">
     <AnimCtx.Provider value={inView}>
      <div className="board-head">
        <span className="board-tab" style={{ background: "#0891B2" }} />
        <div className="board-titles">
          <h2>AI 신사업 시장 <span className="board-en">AI New-Business Market Map · 휴대폰 사업 관점</span></h2>
          <p>단말 사업이 확장 가능한 AI 신사업 버티컬을 MECE 6개 축으로 정리 · 시장 규모·미래 예측·CAGR·출처·발표일·링크(플레인 텍스트) · 주간 자동 갱신 · ✕로 삭제(비번 000)·숨김</p>
        </div>
        <div className="mkt-tools">
          <button className={showHidden ? "on" : ""} onClick={() => setShowHidden(s => !s)} title="숨긴 항목 표시/재표시">숨김 {Object.keys(hidden).length}</button>
          <button onClick={resetAll} title="삭제·숨김 초기화(다시 크롤링 반영)">초기화</button>
        </div>
      </div>

      {!data ? (
        <div className="mkt-loading">{loaded ? "시장 데이터를 불러오는 중…" : "스크롤하면 로드됩니다"}</div>
      ) : (
        (data.groups || []).map(g => {
          const rows = (data.items || []).filter(it => it.group === g.id && !del[it.id] && (showHidden || !hidden[it.id]));
          if (!rows.length) return null;
          return (
            <div className="mkt-group" key={g.id}>
              <div className="mkt-group-head"><b>{g.ko}</b><em>{g.desc}</em></div>
              <div className="mkt-grid">
                {rows.map(it => (
                  <div className={"mkt-card" + (hidden[it.id] ? " hid" : "")} key={it.id}>
                    <div className="mkt-card-head">
                      <b className="mkt-name">{it.name}</b>
                      <span className="mkt-actions">
                        <button className="mkt-hide" title={hidden[it.id] ? "다시 표시" : "숨김"} onClick={() => toggleHide(it.id)}>
                          <Icon name={hidden[it.id] ? "dot" : "collapse"} size={12} sw={2} />
                        </button>
                        {pend === it.id ? null : (
                          <button className="ct-del" title="삭제(비번 000)" onClick={() => { setPend(it.id); setPw(""); setPwErr(false); }}><Icon name="x" size={12} sw={2.2} /></button>
                        )}
                      </span>
                    </div>
                    {pend === it.id && (
                      <div className="art-del-pw" onClick={e => e.stopPropagation()}>
                        <input type="password" inputMode="numeric" className={"art-pw-input" + (pwErr ? " err" : "")} placeholder="비밀번호" value={pw} autoFocus
                          onChange={e => { setPw(e.target.value); setPwErr(false); }}
                          onKeyDown={e => { if (e.key === "Enter") confirmDel(it.id); else if (e.key === "Escape") { setPend(null); setPw(""); setPwErr(false); } }} />
                        <button className="art-pw-ok" onClick={() => confirmDel(it.id)}>삭제</button>
                        <button className="art-pw-cancel" onClick={() => { setPend(null); setPw(""); setPwErr(false); }}><Icon name="x" size={12} sw={2.2} /></button>
                        {pwErr && <span className="art-pw-err">비밀번호가 틀렸습니다.</span>}
                      </div>
                    )}
                    <p className="mkt-def">{it.def}</p>
                    <div className="mkt-nums">
                      <span className="mkt-num"><em>현재</em>{it.size}</span>
                      <span className="mkt-arr">→</span>
                      <span className="mkt-num fut"><em>예측</em>{it.forecast}</span>
                      {it.cagr && it.cagr !== "—" && <span className="mkt-cagr">CAGR {it.cagr}</span>}
                    </div>
                    <div className="mkt-src">
                      <span>{it.source}{it.date && it.date !== "—" ? ` · ${it.date}` : ""}</span>
                      {it.url && <a href={it.url} target="_blank" rel="noopener">원문 <Icon name="ext" size={10} /></a>}
                    </div>
                    {(it.extra || []).length > 0 && (
                      <ul className="mkt-extra">
                        {it.extra.map((e, k) => (
                          <li key={k}>{e.url ? <a href={e.url} target="_blank" rel="noopener">{e.t}</a> : e.t}</li>
                        ))}
                      </ul>
                    )}
                    {it.latest && it.latest.url && (
                      <a className="mkt-latest" href={it.latest.url} target="_blank" rel="noopener">
                        <Icon name="news" size={10} /> 최신 {it.latest.date && it.latest.date.slice(5)} · {String(it.latest.title).slice(0, 50)}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
      <p className="mkt-foot">각 조사기관마다 세그먼트 정의·기준연도가 상이해 수치 편차가 큼 — 복수 기관 자료를 교차검증해 CAGR 추세 중심으로 활용 권장</p>
     </AnimCtx.Provider>
    </section>
  );
}

Object.assign(window, { BoldSummary, MarketBoard, CoLogo, CompanyBoard, CompanyDetail, ArticleFeed, InsightsBoard, ChartsBoard, VPBoard, ReportsBoard, ESCompetitiveMap, OverviewCharts, BizModelBoard, MonthlyTrendsBoard, SignalBoard, ExecToplines, BriefingBoard, RadarBoard, IBInsightBoard });
