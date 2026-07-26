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
function fmtMonthDay(ds) {
  const [, month, day] = String(ds || "").split("-");
  return month && day ? `${Number(month)}/${Number(day)}` : "";
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

function CompanyNote({ text }) {
  const lines = bulletText(text).split(/\s+·\s+/).map(line => line.trim()).filter(Boolean);
  return lines.map((line, i) => (
    <span className="ct-note-line" key={i}>{hlBrief(line, "co-note-" + i)}</span>
  ));
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
          {c.live && c.live.latest && (
            <a className="ct-live" href={c.live.latest.url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}>
              <Icon name="news" size={10} /> {c.live.latest.date && c.live.latest.date.slice(5)} {String(c.live.latest.title).slice(0, 46)}{String(c.live.latest.title).length > 46 ? "…" : ""}
              {c.live.mentions7 > 0 && <em>7일 {c.live.mentions7}건</em>}
            </a>
          )}
          {isStartup && c.strategy ? (
            <span className="ct-strat">
              <em className="ct-strat-label" style={{ color: c.strategy.tier === "large" ? "#2D6BFF" : "#C026D3" }}>{c.strategy.tier === "large" ? "대형·파트너십" : "소형·인수/투자"} · {c.strategy.label}</em>
              <span className="ct-strat-txt"><b>개요:</b> {bulletText(c.strategy.overview)} <b>인사이트:</b> {bulletText(c.strategy.insight)}</span>
            </span>
          ) : <CompanyNote text={c.note} />}</span>
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
              {c.dataStatus && <span className="cd-data-status">{c.dataStatus}</span>}
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
          <p>{bulletText(c.note)}</p>
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
            {rel.map((a, i) => {
              const display = displayFeedText(a);
              return <a key={i} className="cd-art" href={a.url} target="_blank" rel="noopener">
                <span className="cd-art-dot" style={{ background: cat.accent }} />
                <span className="cd-art-body">
                  <span className="cd-art-meta"><em>{a.source}</em><span className="cd-art-date">{fmtPubKo(pubOf(a))}</span><span className="cd-art-tag" style={{ color: cat.accent, background: cat.accentSoft }}>{a.tag}</span></span>
                  <span className="cd-art-title">{display.title}</span>
                  {display.summary && <span className="cd-art-sum"><BoldSummary text={display.summary} /></span>}
                </span>
              </a>;
            })}
          </div>
        </div>

        {c.sources && c.sources.length > 0 && (
          <div className="cd-section">
            <h4>출처 <em>{c.sources.length}건 · 원문 이동</em></h4>
            <div className="cd-sources">
              {c.sources.map((item, i) => {
                const source = typeof item === "string" ? { label: item } : item;
                const tier = source.tier === "official" ? "공식" : source.tier === "estimate" ? "3자 추정" : "보도";
                const content = <>
                  <span className={"cd-src-tier tier-" + (source.tier || "reported")}>{tier}</span>
                  <span className="cd-src-text">{source.label || source.title || "출처"}</span>
                  {source.asOf && <span className="cd-src-asof">{source.asOf}</span>}
                  {source.url && <Icon name="ext" size={12} />}
                </>;
                return source.url ? (
                  <a key={i} className="cd-src-item cd-src-link" href={source.url} target="_blank" rel="noopener">
                    {content}
                  </a>
                ) : (
                  <div key={i} className="cd-src-item">{content}</div>
                );
              })}
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

// ---- Source briefing emphasis -------------------------------------------
// Highlight only complete, recognisable source terms (facts remain unchanged).
// A bare "AI" is deliberately excluded: it must never colour a fragment in
// ordinary English words such as "pair" or "training".
const BRIEF_KEYWORDS = /((?:\$[\d,.]+(?:[BMKT]|억|만|조)?|\d[\d,.]*(?:\.\d+)?(?:%|억|만|조|달러|TWh|TB|GB|nm|년)|AI\s*(?:서버|인프라|에이전트|모델|칩|수요|지출)|인공지능|생성\s*AI|HBM|DRAM|NAND|SSD|GPU|NPU|ARM|x86|CapEx|데이터\s*센터|클라우드|Morgan Stanley|Goldman Sachs|JPMorgan|Bank of America|Citi|Citigroup|TrendForce|IDC|Gartner|OpenAI|Anthropic|NVIDIA|Google|Microsoft|Amazon|Meta|Apple))/gi;
const NUMBER_TOKEN = /^(?:\$[\d,.]+(?:[BMKT]|억|만|조)?|\d[\d,.]*(?:\.\d+)?(?:%|억|만|조|달러|TWh|TB|GB|nm|년))$/i;
const BULLET_ENDINGS = [
  [/있지 않습니다$/, "있지 않음"], [/않습니다$/, "않음"], [/됩니다$/, "됨"],
  [/것으로 보(?:입니다|인다)$/, "것으로 전망"], [/보(?:입니다|인다)$/, "보임"],
  [/입니다$/, "임"], [/합니다$/, "함"], [/습니다$/, "음"],
  [/않는다$/, "않음"], [/된다$/, "됨"], [/한다$/, "함"], [/이다$/, "임"],
  [/있다$/, "있음"], [/없다$/, "없음"], [/본다$/, "판단"], [/과제다$/, "과제"],
  [/전제다$/, "전제"], [/됐다$/, "됨"], [/다$/, "음"],
];
// Display copy uses concise, non-sentence Korean. Source text and hashes stay
// untouched in the data set, so this is a visual writing rule only.
function bulletText(value) {
  const compact = String(value || "")
    .replace(/\b(\d{4})\.(\d{1,2})\.(\d{1,2})\b/g, "$1-$2-$3")
    .replace(/。/g, " · ")
    .replace(/([^0-9])\.(?=\s+)/g, "$1 ·")
    .replace(/([^0-9])\.(?=["”']?\s*$)/g, "$1");
  return compact.split(/\s+·\s+/).map(part => {
    let out = part.trim().replace(/[。.!?"”']+$/, "");
    for (const [ending, replacement] of BULLET_ENDINGS) {
      if (ending.test(out)) { out = out.replace(ending, replacement); break; }
    }
    return out;
  }).filter(Boolean).join(" · ");
}
function hlBrief(text, keyBase) {
  BRIEF_KEYWORDS.lastIndex = 0;
  const parts = String(text).split(BRIEF_KEYWORDS);
  return parts.map((part, i) => {
    if (!part) return null;
    if (NUMBER_TOKEN.test(part)) return <b key={keyBase + "-" + i} className="num-hl">{part}</b>;
    if (BRIEF_KEYWORDS.test(part)) { BRIEF_KEYWORDS.lastIndex = 0; return <b key={keyBase + "-" + i} className="term-hl">{part}</b>; }
    BRIEF_KEYWORDS.lastIndex = 0;
    return <React.Fragment key={keyBase + "-" + i}>{part}</React.Fragment>;
  });
}

// Render a feed summary as up to 3 개조식 lines (제목 한글 + 3줄 요약 정책).
const INSIGHT_ROLE_LABEL = { fact: "핵심 사실", change: "시장 변화", implication: "사업 의미", evidence: "추가 근거" };
function BoldSummary({ text, roles = [] }) {
  if (!text) return null;
  const clean = bulletText(
    String(text).replace(/<[^>]+>/g, "") // strip stray HTML (e.g. <font color>)
      .replace(/2026[.\-](\d{1,2})[.\-](\d{1,2})/g, (_, m, d) => `${+m}/${+d}`)
  );
  const lines = clean.split(/\n+/).map(l => l.trim()).filter(Boolean).slice(0, 3);   // 최대 3줄
  if (lines.length <= 1) return <span className="art-sum-line">{roles[0] && <i className="art-insight-role">{INSIGHT_ROLE_LABEL[roles[0]] || INSIGHT_ROLE_LABEL.evidence}</i>}{hlBrief(clean, "s")}</span>;
  return lines.map((line, i) => (
    <span className="art-sum-line" key={i}>
      {roles[i] && <i className="art-insight-role">{INSIGHT_ROLE_LABEL[roles[i]] || INSIGHT_ROLE_LABEL.evidence}</i>}
      {hlBrief(bulletText(line.replace(/^[·\-•]\s*/, "")), "l" + i)}
    </span>
  ));
}

// Korean is display-only localisation. The source title/excerpt remain intact
// for evidence verification; a failed quality gate deliberately shows English.
function displayFeedText(item) {
  const loc = item && item.localization;
  const lines = Array.isArray(loc?.summaryLines) && loc.summaryLines.length >= 1
    ? loc.summaryLines
    : (item?.summaryLinesKo || (item?.sum ? [item.sum] : null));
  const roles = Array.isArray(loc?.summaryRoles) && loc.summaryRoles.length
    ? loc.summaryRoles
    : (Array.isArray(item?.summaryRoles) ? item.summaryRoles : []);
  return {
    title: loc?.title || item?.titleKo || item?.title || "",
    summary: lines ? lines.join("\n") : (item?.summary || item?.desc || ""),
    lines: lines || [],
    roles,
    translated: loc?.status === "accepted" && loc?.displayLanguage === "ko",
    fallback: loc?.status === "fallback-english",
  };
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
    .filter(a => a.displayEligible !== false)
    .filter(a => filter === "all" || a.cat === filter)
    .filter(a => co === "all" || a.co === co)
    .filter(a => !deleted[keyOf(a)])
    .filter(a => {
      const display = displayFeedText(a);
      const haystack = `${a.title || ""} ${display.title || ""} ${a.source || ""} ${a.co || ""}`.toLowerCase();
      return !query || haystack.includes(query.toLowerCase());
    });

  const sorted = [...filtered].sort((a, b) => pubOf(b).localeCompare(pubOf(a)));
  const activeCat = filter !== "all" ? catMap[filter] : null;
  // 누적 기사가 늘어도 초기 렌더를 가볍게 — 30개씩 페이지네이션(필터 변경 시 리셋)
  const [visN, setVisN] = React.useState(30);
  React.useEffect(() => { setVisN(30); }, [filter, co, query]);
  const shown = sorted.slice(0, visN);

  return (
    <section className="board feed" ref={sectionRef} data-screen-label="Daily Articles">
      <div className="board-head">
        <span className="board-tab" style={{ background: "var(--ink)" }} />
        <div className="board-titles">
          <h2>데일리 기사 피드 <span className="board-en">Daily Articles · 업체별 외신 큐레이션</span></h2>
          <p>최신·과거 기사를 원문 링크와 함께 누적 표시합니다 · 한글 제목·원문 기반 3줄 브리핑 · ✕로 불필요한 기사 삭제</p>
        </div>
        <div className="feed-filters">
          <span className="feed-total" aria-live="polite">누적 {sorted.length}건</span>
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
          {shown.map((a, i) => {
            const c = catMap[a.cat] || {};
            const isSel = selKey === keyOf(a);
            const display = displayFeedText(a);
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
                    <span className="art-verify">{display.translated ? "원문 번역" : display.fallback ? "원문 영어" : "원문 발췌"}</span>
                  </span>
                  <a className="art-title" href={a.url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}>{hlBrief(display.title, "art-title")}</a>
                  {display.summary && <span className="art-summary"><BoldSummary text={display.summary} roles={display.roles} /></span>}
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
        {visN < sorted.length && (
          <button className="feed-more" onClick={() => setVisN(n => n + 30)}>
            더 보기 <em>{shown.length} / {sorted.length}건 (누적)</em>
          </button>
        )}
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

function QuantChartInsight({ lines }) {
  return (
    <div className="quant-chart-insight">
      <span>ANALYSIS · 동일 차트 수치</span>
      <ul>{lines.filter(Boolean).map((line, index) => <li key={index}>{line}</li>)}</ul>
    </div>
  );
}

// ---- Charts section --------------------------------------------
function ChartsBoard({ data, cats, theme, sectionRef }) {
  const inView = useInView(sectionRef);
  const catColor = id => (cats.find(c => c.id === id) || {}).accent || theme.ink;
  const money = value => value == null ? "—" : `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 })}B`;
  const unitM = value => value == null ? "—" : `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}M`;
  const sum = rows => rows.reduce((total, row) => total + (Number(row.value) || 0), 0);
  const top = rows => [...rows].sort((a, b) => b.value - a.value);
  const ratio = (part, total) => total > 0 ? Math.round(part / total * 100) : null;

  const fundingRows = top(data.FUNDING || []);
  const fundingPair = fundingRows.slice(0, 2);
  const fundingPairTotal = sum(fundingPair);
  const fundingTotal = sum(fundingRows);
  const fundingGap = fundingPair[0] && fundingPair[1] ? fundingPair[0].value - fundingPair[1].value : null;
  const userRows = top(data.USERS || []);
  const chatgpt = (data.USERS || []).find(row => row.name.startsWith("ChatGPT"));
  const gemini = (data.USERS || []).find(row => row.name.startsWith("Gemini"));
  const enterprise = (data.BAND_PRICE || []).find(row => row.name.startsWith("Enterprise"));
  const pro = (data.BAND_PRICE || []).find(row => row.name.startsWith("Pro"));
  const api = (data.BAND_PRICE || []).find(row => row.name.startsWith("API"));
  const swRows = top((data.REVENUE || []).filter(row => row.seg === "sw"));
  const swTopThree = swRows.slice(0, 3);
  const swTopThreeTotal = sum(swTopThree);
  const swTotal = sum(swRows);
  const hw = (data.REVENUE || []).find(row => row.seg === "hw");
  const priceMultiple = enterprise?.value && pro?.value ? (enterprise.value / pro.value).toFixed(1) : null;

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
        <div className="chart-card has-chart-insight">
          <div className="cc-head"><h3>AI 펀딩 현황</h3><span title="Crunchbase · PitchBook · TechCrunch 공시 기준">$B · 공시 기준</span></div>
          <HBarChart data={data.FUNDING} colorOf={d => catColor(d.cat)} ink={theme.ink} muted={theme.muted} grid={theme.grid} unit="B" valuePrefix="$" compact />
          <QuantChartInsight lines={[
            <>상위 2개 밸류 <mark>{money(fundingPairTotal)}</mark> · 표본 합계의 <mark>{ratio(fundingPairTotal, fundingTotal)}%</mark></>,
            fundingPair[0] && fundingPair[1] && <>{fundingPair[0].name} {money(fundingPair[0].value)} · {fundingPair[1].name} {money(fundingPair[1].value)} · 격차 <mark>{money(fundingGap)}</mark></>,
          ]} />
        </div>

        <div className="chart-card has-chart-insight">
          <div className="cc-head"><h3>AI 앱 사용자 수</h3><span title="각 기업 공시 · SimilarWeb · IR 기준">주요 앱·플랫폼 · M(백만) · 공시 기준</span></div>
          <HBarChart data={data.USERS} colorOf={d => catColor(d.cat)} ink={theme.ink} muted={theme.muted} grid={theme.grid} unit="M" compact />
          <QuantChartInsight lines={[
            userRows[0] && <>{userRows[0].name} <mark>{unitM(userRows[0].value)}</mark> · 차트 표본 내 최대</>,
            chatgpt && gemini && <>ChatGPT 주간 활성 · Gemini 앱 MAU 각 <mark>{unitM(chatgpt.value)}</mark> · 지표 정의가 달라 단순 합산 제외</>,
          ]} />
        </div>

        <div className="chart-card has-chart-insight">
          <div className="cc-head"><h3>AI 서비스 가격</h3><span>$/mo · 2026.06</span></div>
          <HBarChart data={data.BAND_PRICE} colorOf={d => catColor(d.cat)} ink={theme.ink} muted={theme.muted} grid={theme.grid} unit="" valuePrefix="$" compact />
          <QuantChartInsight lines={[
            enterprise && pro && <>기업 좌석 <mark>${enterprise.value}/월</mark> · 개인 구독 ${pro.value}/월 대비 <mark>{priceMultiple}배</mark></>,
            api && <>API 차트값 <mark>${api.value}/1M 토큰</mark> · 구독 요금과 과금 단위 별도</>,
          ]} />
        </div>

        <div className="chart-card has-chart-insight">
          <div className="cc-head"><h3>AI 매출 — SW·서비스</h3><span title="모델·클라우드·앱 매출">$B · 연환산/ARR/run-rate · 공시·추정</span></div>
          <HBarChart data={data.REVENUE.filter(d => d.seg === "sw")} colorOf={d => catColor(d.cat)} ink={theme.ink} muted={theme.muted} grid={theme.grid} unit="B" valuePrefix="$" compact />
          <QuantChartInsight lines={[
            <>상위 3개 <mark>{money(swTopThreeTotal)}</mark> · SW 표본 합계의 <mark>{ratio(swTopThreeTotal, swTotal)}%</mark></>,
            swTopThree.length === 3 && <>{swTopThree.map(row => `${row.name} ${money(row.value)}`).join(" · ")} · 연환산·ARR·run-rate 산식 혼재</>,
          ]} />
        </div>

        <div className="chart-card has-chart-insight">
          <div className="cc-head"><h3>AI 매출 — HW(칩)</h3><span title="AI 가속기 하드웨어 매출 — 척도가 달라 SW와 분리">$B · 연매출 · 공시</span></div>
          <HBarChart data={data.REVENUE.filter(d => d.seg === "hw")} colorOf={d => catColor(d.cat)} ink={theme.ink} muted={theme.muted} grid={theme.grid} unit="B" valuePrefix="$" compact />
          <QuantChartInsight lines={[
            hw && <>{hw.name} <mark>{money(hw.value)}</mark> · 차트상 유일한 하드웨어 연매출 항목</>,
            <>HW 연매출 · SW ARR·run-rate는 산식이 달라 <mark>직접 합산 제외</mark></>,
          ]} />
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
  const [view, setView] = React.useState("single");
  const ranges = [
    { value: 1 / 12, label: "1개월" },
    { value: 0.5, label: "6개월" },
    { value: 1, label: "1년" },
    { value: 5, label: "5년" },
    { value: 0, label: "전체" },
  ];
  const rangeLabel = (ranges.find(r => r.value === years) || ranges[2]).label;
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
          <p>상장 AI 기업 실제 일별 종가(매일 자동 크롤링) · 밸류체인 업종별 그룹 트렌드 비교 · 마우스 호버 시 종가 · 변곡점(●)에 상승/하락 사유</p>
        </div>
        {(view === "group" || !sel.private) && (
          <div className="stock-range">
            {ranges.map(r => (
              <button key={r.label} className={years === r.value ? "on" : ""} onClick={() => setYears(r.value)}>{r.label}</button>
            ))}
          </div>
        )}
      </div>

      <div className="stock-view-toggle">
        <button className={view === "single" ? "on" : ""} onClick={() => setView("single")}>개별 종목</button>
        <button className={view === "group" ? "on" : ""} onClick={() => setView("group")}>밸류체인 그룹 트렌드</button>
      </div>

      {view === "group" ? (
        <div className="stock-panel" style={{ "--accent": accent }}>
          <div className="stock-panel-head">
            <span className="sp-name">밸류체인 업종별 상대 추이</span>
            <span className="sp-cat" style={{ color: accent, background: (selGroup || {}).accentSoft }}>{rangeLabel} · 시작=100</span>
          </div>
          <GroupTrendChart groups={groups} stocks={stocks} stockData={stockData} years={years} theme={theme} />
          <p className="stock-updated">출처: Yahoo Finance 우선, Stooq·Nasdaq·StockAnalysis 교차 폴백 · 그룹 = 구성 종목 종가를 기간 시작 100으로 재환산 후 평균</p>
        </div>
      ) : (
      <React.Fragment>
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
          {real && !real.scenario && <span className="sp-source">데이터 {String(real.source || "public feed").replace("yahoo-api", "Yahoo Finance").replace("yahoo-web", "Yahoo Finance")}</span>}
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
        <p className="stock-updated">Yahoo Finance 차트 UX를 참고한 기간 선택·크로스헤어 · 시세는 Yahoo 우선 다중 공개 소스 · 시총 = 종가 × 발행주식수(근사)</p>
      </div>
      </React.Fragment>
      )}
     </AnimCtx.Provider>
    </section>
  );
}

function QuantInsightSlider({ data }) {
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const topFunding = (data.FUNDING || []).slice(0, 2);
  const fundingTrend = data.FUNDING_TREND || [];
  const marketGrowth = data.MARKET_GROWTH || [];
  const market2026 = marketGrowth.find(item => item.year === "2026E");
  const market2030 = marketGrowth.find(item => item.year === "2030E");
  const slides = [
    {
      image: "assets/quant-insight-capital.webp",
      eyebrow: "CAPITAL SIGNAL",
      metric: topFunding.map(item => `$${item.value}B`).join(" · "),
      title: "AI 기업가치는 상위 두 곳으로 집중",
      lines: [
        `${topFunding.map(item => item.name).join(" · ")} 기업가치 기준`,
        "기업가치와 매출·현금흐름은 별도 지표로 확인",
      ],
      source: "Series·공시·보도 기반 기업가치",
    },
    {
      image: "assets/quant-insight-device.webp",
      eyebrow: "DEVICE DECISION",
      metric: "메모리 · NPU · 전력",
      title: "온디바이스 AI는 사양 설계와 함께 검증",
      lines: [
        "기능 로드맵과 메모리·NPU 조건을 동시에 비교",
        "AI 탑재만으로 판매 증가를 단정하지 않음",
      ],
      source: "단말 사양·기능 로드맵 검토 기준",
    },
    {
      image: "assets/quant-insight-infra.webp",
      eyebrow: "MARKET SCALE",
      metric: `$${market2026?.size || 540}B → $${market2030?.size || 1812}B`,
      title: "AI 시장 성장의 병목은 인프라 실행력",
      lines: [
        `${market2026?.year || "2026E"}에서 ${market2030?.year || "2030E"}까지 시장 규모 전망`,
        "시장 정의와 전망 범위는 원문 기준으로 분리 확인",
      ],
      source: "Grand View Research 시장 전망 기준",
    },
  ];
  React.useEffect(() => {
    if (paused) return undefined;
    const timer = window.setInterval(() => setActive(index => (index + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  return (
    <article className="ov-chart-card quant-insight-card" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
      {slides.map((slide, index) => (
        <div className={"qis-slide" + (index === active ? " on" : "")} key={slide.image} aria-hidden={index !== active}>
          <img src={slide.image} alt="" loading={index === 0 ? "eager" : "lazy"} />
          <div className="qis-shade" />
          <div className="qis-copy">
            <span className="qis-eyebrow">{slide.eyebrow}</span>
            <strong>{slide.metric}</strong>
            <h3>{slide.title}</h3>
            <ul>{slide.lines.map(line => <li key={line}>{line}</li>)}</ul>
            <span className="qis-source">{slide.source}</span>
          </div>
        </div>
      ))}
      <div className="qis-controls" aria-label="핵심 인사이트 슬라이드 선택">
        {slides.map((slide, index) => <button key={slide.image} className={index === active ? "on" : ""} aria-label={`${index + 1}번째 인사이트`} aria-current={index === active ? "true" : undefined} onClick={() => setActive(index)} />)}
      </div>
    </article>
  );
}

function FundingTrendInsight({ data }) {
  const latest = data[0];
  const quarter = latest?.name.split(" ")[0];
  const sameQuarterLastYear = latest ? data.slice(1).find(item => item.name.split(" ")[0] === quarter) : null;
  const latestYear = Number(latest?.name.match(/\d{4}/)?.[0]);
  const previousYear = latestYear - 1;
  const sumYear = year => data
    .filter(item => item.name.endsWith(String(year)))
    .reduce((sum, item) => sum + item.value, 0);
  const currentTotal = sumYear(previousYear);
  const priorTotal = sumYear(previousYear - 1);
  const change = (now, before) => before > 0 ? Math.round((now / before - 1) * 100) : null;
  const yoy = latest && sameQuarterLastYear ? change(latest.value, sameQuarterLastYear.value) : null;
  const annualChange = currentTotal && priorTotal ? change(currentTotal, priorTotal) : null;
  const amount = value => `$${value.toFixed(1)}B`;

  if (!latest || !sameQuarterLastYear || yoy == null || annualChange == null) return null;

  return (
    <aside className="funding-trend-insight" aria-label="AI 펀딩 추세 해석">
      <span>READOUT · 분기별 집계</span>
      <p><b>분기 회복</b><mark>{latest.name} {amount(latest.value)}</mark> · 전년 동기 {amount(sameQuarterLastYear.value)} 대비 <mark>+{yoy}%</mark></p>
      <p><b>연간 확대</b><mark>{previousYear} 합계 {amount(currentTotal)}</mark> · {previousYear - 1} {amount(priorTotal)} 대비 <mark>+{annualChange}%</mark></p>
    </aside>
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
          <MarketGrowthChart data={data.MARKET_GROWTH} accent={theme.accent} ink={theme.ink} grid={theme.grid} muted={theme.muted} compact showCagr />
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
        <div className="ov-chart-card funding-trend-card">
          <div className="cc-head"><h3>AI 펀딩 트렌드</h3><span title="Crunchbase 분기별 AI 벤처 펀딩">$B · 분기별 집계</span></div>
          <HBarChart data={data.FUNDING_TREND} colorOf={d => catColor(d.cat)} ink={theme.ink} muted={theme.muted} grid={theme.grid} unit="B" valuePrefix="$" compact />
          <FundingTrendInsight data={data.FUNDING_TREND} />
        </div>
        <QuantInsightSlider data={data} />
      </div>
    </AnimCtx.Provider>
  );
}

function SourceOnlyQuantBoard({ sectionRef, onNav }) {
  const inView = useInView(sectionRef);
  return (
    <section className="board source-only-board" ref={sectionRef} data-screen-label="Verified Quantitative Analysis">
      <AnimCtx.Provider value={inView}>
        <div className="board-head">
          <span className="board-tab" style={{ background: "#173F5F" }} />
          <div className="board-titles">
            <h2>검증 정량 분석 <span className="board-en">Verified quantitative analysis</span></h2>
            <p>숫자·정의·기준 시점이 원문 본문에서 함께 추출된 기록만 공개합니다</p>
          </div>
        </div>
        <div className="source-only-intro">
          <article><span>01</span><b>발행사 본문</b><p>원문 페이지를 추출하고 링크가 유지되는지 확인</p></article>
          <article><span>02</span><b>정량 근거</b><p>수치가 포함된 원문 문장을 카드에 함께 표시</p></article>
          <article><span>03</span><b>해석 범위</b><p>예측값은 원문에 미래 기준 시점이 있을 때만 표시</p></article>
        </div>
        <div className="source-only-cta">
          <div><b>누적 정량·소비자 조사 데이터베이스</b><span>과거 기록은 보존하고 검증 완료 기록만 화면에 추가</span></div>
          <button onClick={() => onNav && onNav("market")}>원문 근거 데이터 보기 <span>▶</span></button>
        </div>
      </AnimCtx.Provider>
    </section>
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

function KnowledgeGraph({ companies, cats, catMap, progress, mode, articleByCo, onNodeSelect, initialSelected = null, compact = false, sourceOnly = false, active = true }) {
  const canvasRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const [hovered, setHovered] = React.useState(null);
  const [selected, setSelected] = React.useState(initialSelected);
  const [tooltip, setTooltip] = React.useState(null);
  const nodesRef = React.useRef([]);
  const edgesRef = React.useRef([]);
  const dragRef = React.useRef(null);
  const frameRef = React.useRef(null);
  const mouseRef = React.useRef({ x: 0, y: 0 });

  React.useEffect(() => {
    if (initialSelected) setSelected(initialSelected);
  }, [initialSelected]);

  const selectNode = React.useCallback((name) => {
    setSelected(name);
    if (onNodeSelect) onNodeSelect(name);
  }, [onNodeSelect]);

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
      const EDGE_SET = sourceOnly ? [] : (mode === "dynamics" ? COMPETE_EDGES : MONEY_EDGES);
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

      const legendItems = sourceOnly ? [] : Object.entries(edgeColors);
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
    if (active) animate(); else draw();

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
      if (n) { dragRef.current = n; n.fixed = true; canvas.style.cursor = "grabbing"; selectNode(n.id); e.preventDefault(); }
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
  }, [companies, cats, hovered, selected, selectNode, sourceOnly, active]);

  const selCo = selected ? companies.find(c => c.name === selected) : null;
  const selEdges = sourceOnly ? [] : (selected ? (mode === "dynamics" ? COMPETE_EDGES : MONEY_EDGES).filter(e => e.from === selected || e.to === selected) : []);

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
      {!compact && selCo && (
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
      <div className={`kg-hint${compact ? " kg-hint-compact" : ""}`}>{compact ? "왼쪽 원을 선택하면 오른쪽 영상 위에 업체 관계가 표시됩니다" : "노드를 드래그하여 이동 · 클릭하여 상세 관계 보기 · 범례: 원 크기 = 밸류에이션"}</div>
    </div>
  );
}

// ---- Executive Summary 내 '경쟁 구도' — 관계(엣지)가 있는 업체만, 노드→최신 기사 ----
const DYNAMICS_AXES = [
  { id: "competition", label: "경쟁", color: "#FF4D4D", types: ["경쟁"] },
  { id: "partnership", label: "파트너십", color: "#2D6BFF", types: ["파트너십"] },
  { id: "investment", label: "투자", color: "#00C2A8", types: ["투자"] },
  { id: "supply", label: "공급", color: "#F59E0B", types: ["매출"] },
];

function ESCompetitiveMap({ companies, cats, articles }) {
  const ref = React.useRef(null);
  const videoRef = React.useRef(null);
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
  const defaultCompany = list.some(c => c.name === "OpenAI") ? "OpenAI" : (list[0] ? list[0].name : null);
  const [activeCompany, setActiveCompany] = React.useState(defaultCompany);

  React.useEffect(() => {
    setActiveCompany(current => list.some(c => c.name === current) ? current : defaultCompany);
  }, [graphKey, defaultCompany]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    if (!inView) { video.pause(); return undefined; }
    const slowPlayback = () => {
      video.defaultPlaybackRate = 0.55;
      video.playbackRate = 0.55;
    };
    slowPlayback();
    const play = video.play();
    if (play?.catch) play.catch(() => {});
    video.addEventListener("loadedmetadata", slowPlayback);
    video.addEventListener("play", slowPlayback);
    return () => {
      video.removeEventListener("loadedmetadata", slowPlayback);
      video.removeEventListener("play", slowPlayback);
    };
  }, [inView]);

  const selectedCompany = list.find(c => c.name === activeCompany) || list[0] || null;
  const selectedArticle = selectedCompany ? articleByCo[selectedCompany.name] : null;
  const relationshipGroups = selectedCompany ? DYNAMICS_AXES.map(axis => ({
    ...axis,
    items: COMPETE_EDGES.filter(edge => axis.types.includes(edge.type) && (edge.from === selectedCompany.name || edge.to === selectedCompany.name))
      .map(edge => ({ company: edge.from === selectedCompany.name ? edge.to : edge.from, label: edge.label }))
      .slice(0, 3),
  })).filter(axis => axis.items.length > 0) : [];

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
      <div className="es-dynamics-grid">
        <div className="es-dynamics-map">
          <KnowledgeGraph
            key={graphKey}
            companies={list}
            cats={cats}
            catMap={catMap}
            progress={prog}
            mode="dynamics"
            articleByCo={articleByCo}
            initialSelected={activeCompany}
            onNodeSelect={setActiveCompany}
            compact
            active={inView}
          />
        </div>
        <aside className="dyn-video-panel" aria-live="polite">
          <video ref={videoRef} className="dyn-video" autoPlay muted loop playsInline preload="metadata" aria-label="AI 업계 경쟁 다이내믹스 영상">
            <source src="assets/competitive-dynamics.mp4" type="video/mp4" />
          </video>
          <div className="dyn-video-overlay">
            <div className="dyn-video-head">
              <span>AI INDUSTRY</span>
              <b>Competitive Dynamics</b>
              <div className="dyn-axis-list" aria-label="관계 축">
                {DYNAMICS_AXES.map(axis => <span key={axis.id} style={{ "--axis": axis.color }}><i />{axis.label}</span>)}
              </div>
            </div>
            {selectedCompany && (
              <div className="dyn-selected">
                <div className="dyn-selected-meta">
                  <span>{catMap[selectedCompany.cat] ? catMap[selectedCompany.cat].ko : selectedCompany.cat}</span>
                  <strong>{selectedCompany.name}</strong>
                  <em>{selectedCompany.valuation}</em>
                </div>
                <p>{hlKey(selectedCompany.note)}</p>
                {relationshipGroups.length > 0 && (
                  <div className="dyn-relationships">
                    {relationshipGroups.map(axis => (
                      <div key={axis.id} className="dyn-relationship" style={{ "--axis": axis.color }}>
                        <b>{axis.label}</b>
                        <div>{axis.items.map(item => <span key={`${item.company}-${item.label}`}><strong>{item.company}</strong>{item.label}</span>)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedArticle && (
                  <a className="dyn-source" href={selectedArticle.url} target="_blank" rel="noopener">
                    <span>연결 기사 원문</span><b>↗</b>
                  </a>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
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

function BizModelBoard({ companies, cats, sectionRef, theme, articles }) {
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
          <p>투자·인수·GPU/클라우드/데이터 <b>매출</b> 등 실제 '돈의 흐름'을 도식화 · 초록=투자 · 주황=매출 · 파랑=파트너십</p>
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
      <SignalInfographic file="bizmodel.json" delKey="aiDashDeletedBiz" articles={articles}
        title="AI 수익화 모델 시그널" />
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

// 시그널을 '핵심 리드 + 상세'로 분리 — 인포그래픽 카드의 워딩을 줄여 한눈에 파악.
// 첫 문장 경계(· / 마침표 / 대시)에서 리드를 끊고 나머지는 상세로.
function splitSignal(s) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  const cands = [t.indexOf(" · "), t.indexOf("· "), t.search(/[.。]\s/), t.indexOf(" — "), t.indexOf(" – ")].filter(i => i > 8);
  const idx = cands.length ? Math.min(...cands) : -1;
  const clean = x => String(x).replace(/^[\s·—–.,]+/, "").replace(/[.。·,\s]+$/, "").trim();
  if (idx > 0) return { lead: clean(t.slice(0, idx)), detail: clean(t.slice(idx)) };
  if (t.length > 72) return { lead: clean(t.slice(0, 66)) + "…", detail: clean(t) };
  return { lead: clean(t), detail: "" };
}

// ---- 기사 기반 누적 시그널 인포그래픽(범용): lazy-load, MECE 축, 리드+상세, X 삭제 ----
// file(json)·delKey(localStorage)·title·sub 를 받아 인프라/수익화 등 여러 보드에서 재사용.
function signalSourceKey(value) {
  try {
    const parsed = new URL(String(value || ""));
    parsed.hash = "";
    parsed.search = "";
    return parsed.href.replace(/\/$/, "");
  } catch {
    return String(value || "").replace(/[?#].*$/, "").replace(/\/$/, "");
  }
}

function SignalInfographic({ file, delKey, title, sub, articles, dataVersion }) {
  const ref = React.useRef(null);
  const inView = useInView(ref);
  const [data, setData] = React.useState(null);
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    if (!inView || loaded || !dataVersion) return;
    setLoaded(true);
    fetch(`${file}?v=${encodeURIComponent(dataVersion)}`, { cache: "force-cache" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j && j.items) setData(j); })
      .catch(() => {});
  }, [inView, loaded, dataVersion, file]);

  // 삭제(비밀번호)·localStorage 영구 보존 — 기사 누적이라 삭제 항목은 다시 안 나오게
  const DEL_LS = delKey;
  const [del, setDel] = React.useState(() => { try { return JSON.parse(localStorage.getItem(DEL_LS) || "{}"); } catch { return {}; } });
  const [pend, setPend] = React.useState(null);
  const [pw, setPw] = React.useState("");
  const [pwErr, setPwErr] = React.useState(false);
  const confirmDel = (id) => { if (pw !== "000") { setPwErr(true); return; } setDel(d => { const x = { ...d, [id]: 1 }; try { localStorage.setItem(DEL_LS, JSON.stringify(x)); } catch {} return x; }); setPend(null); setPw(""); setPwErr(false); };
  const resetAll = () => { setDel({}); try { localStorage.removeItem(DEL_LS); } catch {} };

  const groups = (data && data.groups) || [];
  const sourceByUrl = React.useMemo(() => {
    const sourceIndex = new Map();
    (articles || []).forEach(article => {
      const localization = article?.localization;
      const key = signalSourceKey(article?.url);
      if (key && localization?.status === "accepted" && localization?.displayLanguage === "ko"
        && Array.isArray(localization.summaryLines) && localization.summaryLines.length === 3) {
        sourceIndex.set(key, article);
      }
    });
    return sourceIndex;
  }, [articles]);
  // Only show a signal when the linked publisher page supports a Korean title
  // and exactly three translated source fragments. This prevents generic error
  // pages or unverified English excerpts from entering the card grid.
  const items = ((data && data.items) || [])
    .filter(it => it.provenance?.status === "evidence-linked" && !del[it.id])
    .map(it => {
      const source = sourceByUrl.get(signalSourceKey(it.url));
      if (!source) return null;
      const display = displayFeedText(source);
      const summaryLines = String(display.summary || "").split(/\n+/)
        .map(line => bulletText(line)).filter(Boolean).slice(0, 3);
      return display.translated && summaryLines.length === 3 ? { ...it, display, summaryLines } : null;
    })
    .filter(Boolean);
  const countOf = id => items.filter(it => it.group === id).length;
  const maxC = Math.max(1, ...groups.map(g => countOf(g.id)));
  const sourceReady = Array.isArray(articles) && articles.length > 0;

  return (
    <div className="infra-signals" ref={ref}>
      <div className="infra-sig-head">
        <div className="isg-titles">
          <h3>{title} <em>기사 기반 자동 누적 · 매일 갱신</em></h3>
          {sub && <p>{sub}</p>}
        </div>
        <div className="isg-tools">
          <span className="isg-total">누적 <b>{items.length}</b></span>
          <button onClick={resetAll} title="삭제 초기화(다시 누적 반영)">초기화</button>
        </div>
      </div>

      {!data || !sourceReady ? (
        <div className="mkt-loading">{loaded ? "원문 기반 한국어 3줄 요약을 불러오는 중…" : "스크롤하면 로드됩니다"}</div>
      ) : items.length === 0 ? (
        <div className="mkt-loading">표시할 시그널이 없습니다 · 초기화로 되돌릴 수 있습니다</div>
      ) : (
        <React.Fragment>
          {/* 상단 도식: 카테고리별 시그널 분포(미니 바) */}
          <div className="isg-distribution">
            {groups.map(g => {
              const c = countOf(g.id);
              return (
                <div className="isg-dist-col" key={g.id} title={g.desc}>
                  <span className="isg-dist-count" style={{ color: g.accent }}>{c}</span>
                  <span className="isg-dist-bar" style={{ height: (14 + (46 * c) / maxC) + "px", background: g.accent }} />
                  <span className="isg-dist-label">{g.ko}</span>
                </div>
              );
            })}
          </div>

          {/* 카테고리별 시그널 밴드(누적) */}
          {groups.map(g => {
            const rows = items.filter(it => it.group === g.id);
            if (!rows.length) return null;
            return (
              <div className="isg-band" key={g.id}>
                <div className="isg-band-head" style={{ "--gc": g.accent }}>
                  <span className="isg-band-dot" style={{ background: g.accent }} />
                  <b>{g.ko}</b><em>{g.desc}</em><span className="isg-band-n">{rows.length}</span>
                </div>
                <div className="isg-cards">
                  {rows.map(it => {
                    return (
                    <div className="isg-card" key={it.id} style={{ "--gc": g.accent }}>
                      <div className="isg-card-top">
                        {it.quant && <span className="isg-quant" style={{ color: g.accent, borderColor: g.accent, background: "color-mix(in srgb, " + g.accent + " 9%, transparent)" }}>{it.quant}</span>}
                        <span className="isg-src"><a href={it.url} target="_blank" rel="noopener">{it.source || "출처"}</a> · {String(it.date || "").slice(5)}</span>
                      </div>
                      <a className="isg-lead" href={it.url} target="_blank" rel="noopener" title={it.display.title}>{hlBrief(it.display.title, "isg-title-" + it.id)}</a>
                      <ul className="isg-summary">
                        {it.summaryLines.map((line, index) => <li key={index} title={line}>{hlBrief(line, "isg-line-" + it.id + "-" + index)}</li>)}
                      </ul>
                      {pend === it.id ? (
                        <div className="art-del-pw" onClick={e => e.stopPropagation()}>
                          <input type="password" inputMode="numeric" className={"art-pw-input" + (pwErr ? " err" : "")} placeholder="비밀번호" value={pw} autoFocus
                            onChange={e => { setPw(e.target.value); setPwErr(false); }}
                            onKeyDown={e => { if (e.key === "Enter") confirmDel(it.id); else if (e.key === "Escape") { setPend(null); setPw(""); setPwErr(false); } }} />
                          <button className="art-pw-ok" onClick={() => confirmDel(it.id)}>삭제</button>
                          <button className="art-pw-cancel" onClick={() => { setPend(null); setPw(""); setPwErr(false); }}><Icon name="x" size={12} sw={2.2} /></button>
                          {pwErr && <span className="art-pw-err">비밀번호가 틀렸습니다.</span>}
                        </div>
                      ) : (
                        <button className="ct-del" title="삭제(비밀번호)" onClick={() => { setPend(it.id); setPw(""); setPwErr(false); }}><Icon name="x" size={11} sw={2.2} /></button>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </React.Fragment>
      )}
    </div>
  );
}

function SignalBoard({ sectionRef, articles, dataVersion }) {
  const inView = useInView(sectionRef);
  return (
    <section className="board signal-source-board" ref={sectionRef} data-screen-label="Infra and future tech signals">
      <AnimCtx.Provider value={inView}>
        <div className="board-head">
          <span className="board-tab" style={{ background: "#315C4A" }} />
          <div className="board-titles">
            <h2>인프라·미래 기술 시그널 <span className="board-en">Source-backed infrastructure signals</span></h2>
            <p>원문 본문까지 확인된 기사에서만 컴퓨트·메모리·광통신·전력·아키텍처 신호를 누적합니다</p>
          </div>
        </div>
        <div className="source-only-intro signal-source-method">
          <article><span>01</span><b>사실</b><p>발행사 문장과 원문 링크가 남아 있는 신호만 수집</p></article>
          <article><span>02</span><b>정량</b><p>수치가 있으면 해당 원문 문장과 함께 표시</p></article>
          <article><span>03</span><b>해석</b><p>확인된 사실을 벗어나는 전망·관계 추정은 표시하지 않음</p></article>
        </div>
        <SignalInfographic file="infra-view.json" delKey="aiDashDeletedInfra" articles={articles}
          dataVersion={dataVersion} title="인프라·미래 기술 신호" sub="원문 문장으로 확인된 카드만 표시 · 확인 전 기록은 누적 ledger에 보존" />
      </AnimCtx.Provider>
    </section>
  );
}

function LegacySignalBoard({ data, theme, sectionRef, articles }) {
  const inView = useInView(sectionRef);
  const strat = data.INFRA_STRATEGY || { hyperscaler: [], aiNative: [] };
  const metricAt = (series, key, value) => (series || []).find(row => String(row[key]) === value) || (series || [])[0] || {};
  const capexNow = metricAt(data.DC_CAPEX, "year", "2026E");
  const capexPrev = metricAt(data.DC_CAPEX, "year", "2025");
  const hbmNow = metricAt(data.HBM_MARKET, "year", "2026E");
  const hbmNext = metricAt(data.HBM_MARKET, "year", "2027E");
  const chipNow = metricAt(data.CHIP_MIX, "period", "2026E");
  const chipNext = metricAt(data.CHIP_MIX, "period", "2027E");
  const opticalNow = metricAt(data.OPTICAL_TREND, "year", "2026");
  const opticalNext = metricAt(data.OPTICAL_TREND, "year", "2030E");
  const decisionReadouts = [
    {
      no: "01", label: "CAPEX", metric: capexNow.size ? `$${capexNow.size}B` : "—",
      fact: `${capexPrev.year || "직전"} ${capexPrev.size ? `$${capexPrev.size}B` : "—"} → ${capexNow.year || "최신"} ${capexNow.size ? `$${capexNow.size}B` : "—"} · ${capexNow.growth ? `성장률 ${capexNow.growth}%` : ""}`,
      insight: "전력·부지·메모리 조달이 투자 집행을 따라가는지 공급 제약을 별도 점검",
      src: capexNow.src,
    },
    {
      no: "02", label: "MEMORY", metric: hbmNow.size ? `$${hbmNow.size}B` : "—",
      fact: `${hbmNow.year || "최신"} ${hbmNow.size ? `$${hbmNow.size}B` : "—"} → ${hbmNext.year || "다음"} ${hbmNext.size ? `$${hbmNext.size}B` : "—"} · ${hbmNow.growth ? `성장률 ${hbmNow.growth}%` : ""}`,
      insight: "메모리 확보 시점이 모델 배포와 서버 증설의 선행 지표인지 확인",
      src: hbmNow.src,
    },
    {
      no: "03", label: "COMPUTE", metric: chipNow.custom != null ? `${chipNow.custom}%` : "—",
      fact: `${chipNow.period || "최신"} 커스텀 실리콘 ${chipNow.custom ?? "—"}% → ${chipNext.period || "다음"} ${chipNext.custom ?? "—"}%`,
      insight: "GPU 단일 조달이 아닌 멀티실리콘 호환성과 소프트웨어 이식성을 검토",
      src: chipNow.src,
    },
    {
      no: "04", label: "NETWORK", metric: opticalNext.pen != null ? `${opticalNext.pen}%` : "—",
      fact: `${opticalNow.year || "최신"} 침투율 ${opticalNow.pen ?? "—"}% → ${opticalNext.year || "전망"} ${opticalNext.pen ?? "—"}%`,
      insight: "광통신 전환 시점과 전력 효율 개선이 데이터센터 설계에 반영되는지 추적",
      src: opticalNext.src,
    },
  ];
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
      <div className="signal-quant-layout">
        <div className="chart-grid signal-chart-grid">
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
        <aside className="signal-reading" aria-label="인프라 수치 기반 시사점">
          <div className="signal-reading-head">
            <span>DECISION LENS</span>
            <h3>숫자가 말하는 다음 질문</h3>
            <p>그래프의 현재값·전망값을 분리해 해석</p>
          </div>
          <div className="signal-reading-list">
            {decisionReadouts.map(readout => (
              <article className="signal-reading-item" key={readout.label}>
                <div className="signal-reading-top"><span>{readout.no}</span><em>{readout.label}</em><strong>{readout.metric}</strong></div>
                <p className="signal-reading-fact">{readout.fact}</p>
                <p className="signal-reading-insight"><b>검토 항목</b>{readout.insight}</p>
                {readout.src && <small>{readout.src}</small>}
              </article>
            ))}
          </div>
        </aside>
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
      <SignalInfographic file="infra.json" delKey="aiDashDeletedInfra" articles={articles}
        title="인프라·미래기술 시그널" />
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
  const segs = bulletText(text).split(HL_NUM);
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
  const publishableBrief = brief => ["source-linked", "user-provided-source"].includes(brief?.provenance?.status);
  const op = ((research && research.pinned) || []).find(publishableBrief)
    || (research && publishableBrief(research.onepager) ? research.onepager : null);
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
  const feed = ((research && research.feed) || []).filter(f => f.displayEligible !== false && f.provenance?.status !== "reference-only" && !delR[rKey(f)]);
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
          </div>
          <div className="ib-thesis">
            <div className="ib-thesis-label">One-line Thesis</div>
            <div className="ib-thesis-text">{bulletText(op.thesis)}</div>
          </div>
        </div>
      )}

      {feed.length > 0 && (
        <div className="ib-feed">
          <div className="ib-feed-head">
            <h3>증권사·기관 리서치 피드 <em>원문 근거 기반 · 핵심 사실 · 시장 변화 · 사업 의미</em></h3>
            {feed.length > 8 && <button onClick={() => setShowAll(s => !s)}>{showAll ? "접기" : `전체 ${Math.min(feed.length, 20)}건`}</button>}
          </div>
          {feedRows.map((f, i) => {
            const display = displayFeedText(f);
            return <a className="ib-feed-row" key={f.url || i} href={f.url} target="_blank" rel="noopener">
              <span className={"ib-house " + (f.type === "Securities" ? "sec" : "mkt")}>{f.house}</span>
              <span className="ib-feed-title"><b>{hlBrief(display.title, "ib-title")}</b>{display.summary && <em><BoldSummary text={display.summary} roles={display.roles} /></em>}</span>
              <span className="ib-feed-meta">{f.source} · {f.date && f.date.slice(5)}</span>
              <Icon name="ext" size={11} />
              <DelBtn item={f} />
            </a>;
          })}
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
          <p>Source 기반 규칙 해석 · 신사업 기회 스코어(1~5)</p>
        </div>
        <div className="brief-days">
          {days.slice(0, 7).map((d, i) => (
            <button key={d.date} className={i === dayIdx ? "on" : ""} onClick={() => setDayIdx(i)}>
              {fmtMonthDay(d.date)}
            </button>
          ))}
        </div>
      </div>

      <div className="brief-headline">
        <Icon name="sun" size={16} /> <b>{day.headline}</b>
        <span className="brief-date">{fmtMonthDay(day.date)}</span>
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
            <p className="brief-row"><span className="brief-k sig">원문 사실</span><BoldSummary text={it.signal} /></p>
            <p className="brief-row"><span className="brief-k ins">AI 추론</span><BoldSummary text={it.insight} /></p>
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
                    <Icon name="news" size={10} /> {e.source}{e.date ? ` · ${fmtMonthDay(e.date)}` : ""}
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
                    <Icon name="news" size={10} /> {e.source}{e.date ? ` · ${fmtMonthDay(e.date)}` : ""}
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
  // 컨설팅 브리프는 축별 네온 색상 대신 절제된 우선순위 표식만 사용
  const TONE = { warn: "#8E3B31", signal: "#173F5F", revenue: "#315C4A", compete: "#655867" };
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
  const usingLive = !!insights;
  const cards = (usingLive
    ? insights.cards.map(c => ({ tag: c.axisLabel, tone: c.tone, nav: c.nav, now: c.headline, cause: c.rootCause, decision: c.soWhat, action: c.action, evidence: c.evidence || [], score: c.score, scoreBasis: c.scoreBasis, live: c.live, updatedAt: c.updatedAt }))
    : (items || []).map(t => ({ tag: t.tag, tone: t.tone, nav: t.nav, now: t.now, cause: t.cause, decision: t.decision, action: t.action, evidence: [], score: null })))
    .filter(c => !delEs[c.tag]);
  if (!cards.length) return null;
  // 엔진 provenance 배지 — 사용자가 자동/규칙/시드 생성 여부를 즉시 판별
  const eng = (insights && insights.engine) || (usingLive ? "rules" : "seed");
  const ENGINE_BADGE = {
    "llm": { ko: "LLM 자동 생성", cls: "llm" }, "llm-gh": { ko: "LLM 자동 생성", cls: "llm" },
    "rules": { ko: "규칙 기반 자동", cls: "rules" }, "seed": { ko: "시드(초기값)", cls: "seed" },
  };
  const eb = ENGINE_BADGE[eng] || ENGINE_BADGE.rules;
  const priorityMeta = (rawScore) => {
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));
    if (score >= 67) return { label: "P1", range: "67–100", meaning: "상위 우선순위" };
    if (score >= 34) return { label: "P2", range: "34–66", meaning: "중간 우선순위" };
    return { label: "P3", range: "0–33", meaning: "관찰 우선순위" };
  };
  const priorityHelp = (rawScore, basis) => {
    const meta = priorityMeta(rawScore);
    return `${meta.label} = ${meta.meaning} (${meta.range}점)\n점수 = 최신성 × 출처 신뢰도 × 주제 적합도\n당일 최고 카드 = 100으로 정규화한 상대 중요도\n${basis || ""}`.trim();
  };
  return (
    <section className="es-info" aria-label="전략 의사결정 브리프">
      <header className="es-brief-head">
        <div>
          <span className="es-brief-kicker">STRATEGIC DECISION BRIEF</span>
          <h3>핵심 신호를 의사결정으로 연결</h3>
          <p>확인 가능한 원문 근거를 사업적 의미와 다음 실행으로 구조화</p>
        </div>
        <div className="es-brief-note" title="상대 중요도 0~100 = 최신성 × 출처신뢰도 × 주제적합도">
          <strong>Evidence-led</strong>
          <span>{eb.ko} · 상대 중요도 기준</span>
        </div>
      </header>
      <div className="es-framework-key" aria-label="전략 브리프 읽는 순서">
        <span><b>01</b> FACT <em>원문 근거</em></span>
        <i aria-hidden="true">→</i>
        <span><b>02</b> IMPLICATION <em>사업 의미</em></span>
        <i aria-hidden="true">→</i>
        <span><b>03</b> DECISION <em>권고 실행</em></span>
      </div>
      <div className="es-info-head" aria-hidden="true">
        <span className="es-col-h es-col-axis">우선순위</span>
        <span className="es-col-h">01 Fact <em>원문 근거</em></span>
        <span className="es-col-h">02 Implication <em>사업 의미</em></span>
        <span className="es-col-h">03 Decision <em>권고 실행</em></span>
      </div>
      {cards.map((t, i) => {
        const tone = TONE[t.tone] || "#2D6BFF";
        const score = typeof t.score === "number" ? t.score : 0;
        const priority = priorityMeta(score);
        const scoreHelp = priorityHelp(score, t.scoreBasis);
        return (
          <div className="es-row" key={t.tag} style={{ "--tl": tone, "--score": `${Math.max(8, Math.min(100, score))}%` }}>
            <div className="es-axis">
              <span className="es-axis-ico"><Icon name={ICON[t.tone] || "spark"} size={14} /></span>
              <span className="es-axis-label">전략 축</span>
              <b>{t.tag}</b>
              {typeof t.score === "number"
                ? <span className="es-score" style={{ "--tl": tone }} title={scoreHelp} tabIndex="0" aria-label={scoreHelp}>
                    {priority.label} <em>{t.score}</em>
                    <span className="es-score-tip" role="tooltip"><b>{priority.label}</b> {priority.meaning} · {priority.range}점<br />점수 = 최신성 × 출처 신뢰도 × 주제 적합도<br />당일 최고 카드 = 100으로 정규화</span>
                  </span>
                : (t.live === false && <span className="es-score base" title={t.scoreBasis || "근거 기사 매칭 대기 — 큐레이션 기준선"}>기준선</span>)}
              {typeof t.score === "number" && <span className="es-score-note">상대 중요도 · 점수 근거 보기</span>}
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
                  <Icon name="news" size={10} /> {e.source}{e.date ? ` · ${fmtMonthDay(e.date)}` : ""}
                </a>
              ))}
            </div>
            <span className="es-arr" aria-hidden="true" />
            <div className="es-cell es-ins">{hlKey(t.decision)}</div>
            <span className="es-arr" aria-hidden="true" />
            <div className="es-cell es-act">{hlKey(t.action || "")}
              {t.nav && <button className="tl-link" onClick={() => onNav && onNav(t.nav)}>{NAVLABEL[t.nav] || "상세"} ›</button>}
            </div>
          </div>
        );
      })}
    </section>
  );
}


// ---- AI 신사업 시장 보드: lazy-load(inView 시에만 fetch), MECE 그룹, 플레인 텍스트, 삭제/숨김 ----
function MarketBoard({ sectionRef, dataVersion }) {
  const inView = useInView(sectionRef);
  const [data, setData] = React.useState(null);
  const [loaded, setLoaded] = React.useState(false);
  const [recordFilter, setRecordFilter] = React.useState("all");
  // 화면에 들어올 때 1회만 market.json 로드 — 초기 페이지 로드에 영향 없음
  React.useEffect(() => {
    if (!inView || loaded || !dataVersion) return;
    setLoaded(true);
    fetch(`market-view.json?v=${encodeURIComponent(dataVersion)}`, { cache: "force-cache" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j && Array.isArray(j.records)) setData(j); })
      .catch(() => {});
  }, [inView, loaded, dataVersion]);

  // RSS titles/snippets remain in market.json for the append-only discovery
  // ledger, but cannot enter this view. A visible card must have a resolved
  // publisher page, source-extracted text, and literal source quantities.
  const records = ((data && data.records) || []).filter(record => record.sourceUrl
    && record.displayEligible === true
    && record.provenance?.status === "source-backed"
    && Array.isArray(record.sourceQuantifiedLines) && record.sourceQuantifiedLines.length
    && Array.isArray(record.sourceQuantities) && record.sourceQuantities.length);
  const consumerRecords = records.filter(record => record.type === "consumer-survey");
  const sourceCount = new Set(records.map(record => record.sourceUrl)).size;
  const quantityCount = records.reduce((count, record) => count + new Set(record.sourceQuantities || []).size, 0);
  const shownRecords = records
    .filter(record => recordFilter === "all" || (recordFilter === "survey" ? record.type === "consumer-survey" : record.type !== "consumer-survey"))
    .sort((a, b) => String(b.publishedAt || b.collectedAt || "").localeCompare(String(a.publishedAt || a.collectedAt || "")));
  const TYPE_LABEL = { "consumer-survey": "소비자 조사", "market-estimate": "시장 기준선", shipment: "출하량", "market-observation": "정량 관측" };

  return (
    <section className="board" ref={sectionRef} data-screen-label="AI New Business Markets">
     <AnimCtx.Provider value={inView}>
      <div className="board-head">
        <span className="board-tab" style={{ background: "#0891B2" }} />
        <div className="board-titles">
          <h2>AI 신사업 시장 <span className="board-en">AI New-Business Market Map · 휴대폰 사업 관점</span></h2>
          <p>발행사 원문에서 직접 추출한 문장·정량 수치만 표시하는 append-only DB · RSS 발견 기록과 기존 6개 MECE 버티컬은 삭제하지 않고 보존</p>
        </div>
      </div>

      {!data ? (
        <div className="mkt-loading">{loaded ? "시장 데이터를 불러오는 중…" : "스크롤하면 로드됩니다"}</div>
      ) : (
        <React.Fragment>
          <div className="mkt-db-summary">
            <div><em>원문 검증 레코드</em><b>{records.length}</b><span>발행사 본문 추출 후에만 표시</span></div>
            <div><em>소비자 조사</em><b>{consumerRecords.length}</b><span>표본·국가·관측 시점은 원문 문장으로 확인</span></div>
            <div><em>원문 링크</em><b>{sourceCount}</b><span>카드 제목과 하단 링크에서 원문 이동</span></div>
            <div><em>추출 정량 수치</em><b>{quantityCount}</b><span>원문에 나온 수치와 근거 문장 전체 표시</span></div>
          </div>

          <div className="mkt-db-head">
            <div>
              <h3>정량·소비자 조사 데이터베이스</h3>
              <p>검색 제목·스니펫은 화면에서 제외 · 발행사 원문에서 확인된 3줄 핵심과 정량 근거만 표시 · 번역 품질 미달 시 영문 원문으로 표시</p>
            </div>
            <div className="mkt-tools">
              <button className={recordFilter === "all" ? "on" : ""} onClick={() => setRecordFilter("all")}>전체 {records.length}</button>
              <button className={recordFilter === "survey" ? "on" : ""} onClick={() => setRecordFilter("survey")}>소비자 조사 {consumerRecords.length}</button>
              <button className={recordFilter === "market" ? "on" : ""} onClick={() => setRecordFilter("market")}>시장·출하</button>
            </div>
          </div>
          <div className="mkt-record-grid">
            {shownRecords.map(record => {
              const localized = record.localization?.status === "accepted" || record.localization?.status === "fallback-english"
                ? record.localization : null;
              const title = localized?.title || record.titleEn || record.title;
              const insights = localized?.summaryLines?.length ? localized.summaryLines : (record.summaryLinesEn || []);
              return (
              <article className="mkt-record" key={record.id}>
                <div className="mkt-record-top">
                  <span className={"mkt-record-type type-" + record.type}>{TYPE_LABEL[record.type] || "정량 관측"}</span>
                  {record.sourceRegion && <span className="mkt-record-locale">{record.sourceRegion} · {record.sourceLanguage}</span>}
                </div>
                <a className="mkt-record-title" href={record.sourceUrl} target="_blank" rel="noopener">{title} <Icon name="ext" size={11} /></a>
                <div className="mkt-record-values">
                  {(record.sourceQuantities || []).map((value, index) => <span key={index}><em>원문 수치</em>{value}</span>)}
                </div>
                {insights.length > 0 && <ul className="mkt-record-insights">{insights.map((line, index) => <li key={index}>{line}</li>)}</ul>}
                <details className="mkt-record-quant-evidence" open>
                  <summary>원문 정량 근거 {record.sourceQuantifiedLines.length}개</summary>
                  <ul>{record.sourceQuantifiedLines.map((item, index) => <li key={index}>{item.line}</li>)}</ul>
                </details>
                <a className="mkt-record-source" href={record.sourceUrl} target="_blank" rel="noopener">원문 열기 · {record.sourceName} <Icon name="ext" size={10} /></a>
              </article>
              );
            })}
            {!shownRecords.length && <div className="mkt-loading">발행사 원문을 확인해 정량 근거를 추출 중입니다 · 검색 스니펫은 표시하지 않습니다</div>}
          </div>

          <div className="mkt-baseline-head"><b>6개 MECE 버티컬 기준선</b><em>기존 시장규모·예측·CAGR 데이터는 보존되며, 상단 누적 DB에 새 수치가 추가됩니다.</em></div>
          {(data.groups || []).map(g => {
            const rows = (data.items || []).filter(it => it.group === g.id && it.provenance?.status !== "reference-only");
            if (!rows.length) return null;
            return (
              <div className="mkt-group" key={g.id}>
                <div className="mkt-group-head"><b>{g.ko}</b><em>{g.desc}</em></div>
                <div className="mkt-grid">
                  {rows.map(it => {
                    // Never show a placeholder as a future market forecast.
                    // A current value and a future value are independently
                    // optional because some sources publish only one of them.
                    const numericValue = value => /\d/.test(String(value || "")) && !/^(?:—|-|n\/a|na)$/i.test(String(value || "").trim());
                    const hasCurrent = numericValue(it.size);
                    const hasForecast = numericValue(it.forecast);
                    const hasCagr = numericValue(it.cagr);
                    return (
                    <div className="mkt-card" key={it.id}>
                      <div className="mkt-card-head"><b className="mkt-name">{it.name}</b></div>
                      <p className="mkt-def">{it.def}</p>
                      {(hasCurrent || hasForecast || hasCagr) && <div className="mkt-nums">
                        {hasCurrent && <span className="mkt-num"><em>현재</em>{it.size}</span>}
                        {hasCurrent && hasForecast && <span className="mkt-arr">→</span>}
                        {hasForecast && <span className="mkt-num fut"><em>예측</em>{it.forecast}</span>}
                        {hasCagr && <span className="mkt-cagr">CAGR {it.cagr}</span>}
                      </div>}
                      <div className="mkt-src">
                        <span>{it.source}{it.date && it.date !== "—" ? ` · ${it.date}` : ""}</span>
                        {it.url && <a href={it.url} target="_blank" rel="noopener">원문 <Icon name="ext" size={10} /></a>}
                      </div>
                      {(it.extra || []).length > 0 && <ul className="mkt-extra">{it.extra.map((e, k) => <li key={k}>{e.url ? <a href={e.url} target="_blank" rel="noopener">{e.t}</a> : e.t}</li>)}</ul>}
                      {it.latest && it.latest.url && <a className="mkt-latest" href={it.latest.url} target="_blank" rel="noopener"><Icon name="news" size={10} /> 최신 {it.latest.date && it.latest.date.slice(5)} · {String(it.latest.title).slice(0, 50)}</a>}
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </React.Fragment>
      )}
      <p className="mkt-foot">누적 DB는 기존 레코드를 삭제·덮어쓰지 않습니다. 시장조사기관별 정의·표본·기준연도 차이로 수치가 다를 수 있으므로, 비교·의사결정 전 반드시 각 원문을 확인하세요.</p>
     </AnimCtx.Provider>
    </section>
  );
}


// ---- 스타트업 분석 보드(2계층·lazy-load): 대형=파트너십 / 소형=인수·투자 ----
function StartupScopeBoard({ sectionRef, dataVersion }) {
  const inView = useInView(sectionRef);
  const [data, setData] = React.useState(null);
  const [loaded, setLoaded] = React.useState(false);
  const [tier, setTier] = React.useState("large");
  React.useEffect(() => {
    if (!inView || loaded || !dataVersion) return;
    setLoaded(true);
    fetch(`startups.json?v=${encodeURIComponent(dataVersion)}`, { cache: "force-cache" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j && (j.large || j.small)) setData(j); })
      .catch(() => {});
  }, [inView, loaded, dataVersion]);

  const DEL_LS = "aiDashDeletedStartups";
  const [del, setDel] = React.useState(() => { try { return JSON.parse(localStorage.getItem(DEL_LS) || "{}"); } catch { return {}; } });
  const [pend, setPend] = React.useState(null);
  const [pw, setPw] = React.useState("");
  const [pwErr, setPwErr] = React.useState(false);
  const confirmDel = (n) => { if (pw !== "000") { setPwErr(true); return; } setDel(d => { const x = { ...d, [n]: 1 }; try { localStorage.setItem(DEL_LS, JSON.stringify(x)); } catch {} return x; }); setPend(null); setPw(""); setPwErr(false); };
  const reset = () => { setDel({}); try { localStorage.removeItem(DEL_LS); } catch {} };
  const LC = { "파트너십 기회": "#16A34A", "전략 제휴": "#2D6BFF", "탑재 후보": "#0891B2", "인수 후보": "#C026D3", "투자 검토": "#16A34A", "기술 감시": "#EA580C", "모니터링": "#8A93A4" };

  const DelUI = ({ name }) => (pend === name ? (
    <span className="art-del-pw" onClick={e => e.stopPropagation()}>
      <input type="password" inputMode="numeric" className={"art-pw-input" + (pwErr ? " err" : "")} placeholder="비밀번호" value={pw} autoFocus
        onChange={e => { setPw(e.target.value); setPwErr(false); }}
        onKeyDown={e => { if (e.key === "Enter") confirmDel(name); else if (e.key === "Escape") { setPend(null); setPw(""); setPwErr(false); } }} />
      <button className="art-pw-ok" onClick={() => confirmDel(name)}>삭제</button>
      <button className="art-pw-cancel" onClick={() => { setPend(null); setPw(""); setPwErr(false); }}><Icon name="x" size={12} sw={2.2} /></button>
      {pwErr && <span className="art-pw-err">비밀번호가 틀렸습니다.</span>}
    </span>
  ) : (
    <button className="ct-del" title="삭제(비밀번호)" onClick={() => { setPend(name); setPw(""); setPwErr(false); }}><Icon name="x" size={12} sw={2.2} /></button>
  ));
  const SourceHistory = ({ it }) => {
    const seen = new Set();
    const entries = [it.latest, ...(it.history || [])]
      .filter(entry => /^https?:\/\//.test(String(entry?.url || "")))
      .filter(entry => {
        const key = String(entry.url).replace(/[?#].*$/, "");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 4);
    return entries.map((entry, index) => (
      <a className="mkt-latest" key={`${entry.url}-${index}`} href={entry.url} target="_blank" rel="noopener">
        <Icon name="news" size={10} /> {entry.url === it.latest?.url ? "최신" : "과거"} {entry.date && entry.date.slice(5)} · {String(entry.title).slice(0, 56)}
      </a>
    ));
  };

  const large = ((data && data.large) || []).filter(s => s.provenance?.status === "source-backed" && !del[s.name]);
  const small = ((data && data.small) || []).filter(s => s.provenance?.status === "source-backed" && !del[s.name]);

  return (
    <section className="board" ref={sectionRef} data-screen-label="Startup Analysis">
     <AnimCtx.Provider value={inView}>
      <div className="board-head" style={{ "--accent": "#0E8F6E" }}>
        <span className="board-tab" style={{ background: "#0E8F6E" }} />
        <div className="board-titles">
          <h2>스타트업 분석 <span className="board-en">Startup Analysis · 대형=파트너십 / 소형=인수·투자 (레이더 통합)</span></h2>
          <p>글로벌 AI 스타트업(한국·중국 제외)을 규모별 MECE 2계층으로 분석 · 대형은 비즈니스 모델·수익 구조·파트너십, 소형은 개요·펀딩·인수/투자 관점 · 주간 자동 갱신 · ✕ 삭제(비밀번호)</p>
        </div>
        <div className="mkt-tools">
          <button className={tier === "large" ? "on" : ""} onClick={() => setTier("large")}>대형 {large.length}</button>
          <button className={tier === "small" ? "on" : ""} onClick={() => setTier("small")}>소형·초기 {small.length}</button>
          {Object.keys(del).length > 0 && <button onClick={reset} title="삭제 초기화">초기화</button>}
        </div>
      </div>

      {!data ? (
        <div className="mkt-loading">{loaded ? "스타트업 분석을 불러오는 중…" : "스크롤하면 로드됩니다"}</div>
      ) : !(large.length || small.length) ? (
        <div className="mkt-loading">원문 근거를 연결하는 중입니다 · 근거 없는 투자·인수 후보는 표시하지 않습니다</div>
      ) : tier === "large" ? (
        <div className="mkt-group">
          <div className="mkt-group-head"><b>대형 업체 — 파트너십 관점</b><em>비즈니스 모델·수익 구조를 참고해 탑재·제휴·공동개발 각도 분석</em></div>
          <div className="mkt-grid">
            {large.map(s => (
              <div className="mkt-card" key={s.name}>
                <div className="mkt-card-head">
                  <img className="su-fav" src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=32`} alt="" loading="lazy" />
                  <b className="mkt-name">{s.name}</b>
                  <span className="su-meta">{s.vertical} · {s.val}</span>
                  <DelUI name={s.name} />
                </div>
                <span className="brief-label" style={{ "--lc": LC[s.label] || "#2D6BFF" }}>{s.label}</span>
                <p className="su-row"><span className="brief-k sig">비즈니스 모델</span>{s.businessModel}</p>
                <p className="su-row"><span className="brief-k ins">수익</span>{s.revenue}</p>
                <p className="su-row"><span className="brief-k act">파트너십</span>{s.partnership}</p>
                <SourceHistory it={s} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mkt-group">
          <div className="mkt-group-head"><b>소형·초기 업체 — 인수·투자 관점</b><em>업체 개요·펀딩/밸류(정량)를 근거로 인수·전략 투자 각도 분석</em></div>
          <div className="mkt-grid">
            {small.map(s => (
              <div className="mkt-card" key={s.name}>
                <div className="mkt-card-head">
                  <img className="su-fav" src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=32`} alt="" loading="lazy" />
                  <b className="mkt-name">{s.name}</b>
                  <span className="su-meta">{s.vertical} · {s.stage}</span>
                  <DelUI name={s.name} />
                </div>
                <span className="brief-label" style={{ "--lc": LC[s.label] || "#2D6BFF" }}>{s.label}</span>
                <p className="su-row"><span className="brief-k sig">개요</span>{s.overview}</p>
                <p className="su-row"><span className="brief-k ins">펀딩</span>{s.funding}</p>
                <p className="su-row"><span className="brief-k act">인수·투자</span>{s.acqAngle}</p>
                <SourceHistory it={s} />
              </div>
            ))}
          </div>
        </div>
      )}
     </AnimCtx.Provider>
    </section>
  );
}

Object.assign(window, { BoldSummary, MarketBoard, StartupScopeBoard, CoLogo, CompanyBoard, CompanyDetail, ArticleFeed, InsightsBoard, ChartsBoard, VPBoard, ReportsBoard, ESCompetitiveMap, OverviewCharts, BizModelBoard, MonthlyTrendsBoard, SignalBoard, ExecToplines, BriefingBoard, RadarBoard, IBInsightBoard });
