/* ============================================================
   boards.jsx — content sections (AI Intelligence Dashboard)
   ============================================================ */

// 삭제 확인 비밀번호 — 평문으로 소스에 노출하지 않기 위해 base64로만 비교(atob("MA==")="0").
function canDelete(pw) { try { return atob("MA==") === String(pw == null ? "" : pw); } catch { return false; } }

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

// Public data is UTF-8, but a publisher can still return text that was decoded
// with the wrong charset. Never let those byte artifacts reach a visible card.
const MALFORMED_DISPLAY_ENCODING = /\uFFFD|(?:Ã.|Â.|â[€™“”¦])|(?:ðŸ)|(?:\?[가-힣]){2,}|(?:(?:ì|ë|í|ê)[\u0080-\u00BF].){2,}/;
function safeDisplayString(value, fallback = "") {
  const text = String(value || "").normalize("NFC").replace(/\s+/g, " ").trim();
  return !text || MALFORMED_DISPLAY_ENCODING.test(text) ? fallback : text;
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

const meceTextKey = value => String(value || "").toLocaleLowerCase()
  .replace(/\s+/g, " ").replace(/[^\p{L}\p{N}]+/gu, "");
const meceTextTokens = value => new Set(String(value || "").toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ").split(/\s+/).filter(token => token.length >= 2));
function meceTextSimilarity(left, right) {
  const a = meceTextTokens(left), b = meceTextTokens(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap++;
  return overlap / Math.min(a.size, b.size);
}
function isRepeatedMECEText(left, right) {
  const a = meceTextKey(left), b = meceTextKey(right);
  if (!a || !b) return false;
  return a === b || (Math.min(a.length, b.length) >= 24 && (a.includes(b) || b.includes(a)))
    || meceTextSimilarity(left, right) >= .82;
}
function uniqueMECEValues(values, occupied = []) {
  const accepted = [...occupied].filter(Boolean);
  return (values || []).map(value => String(value || "").replace(/\s+/g, " ").trim()).filter(value => {
    if (!value || accepted.some(previous => isRepeatedMECEText(previous, value))) return false;
    accepted.push(value);
    return true;
  });
}

const companyIdentityRoot = value => String(value || "").normalize("NFKC").toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ").split(/\s+/)
  .filter(word => word && !/^(?:ai|app|apps|inc|llc|ltd|limited|corp|corporation|company|co|opco|pbc|plc|platform|platforms|technology|technologies|labs|lab)$/.test(word))
  .join("");
const companyIdentityHost = value => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try { return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
};
function sameCompanyRecord(left, right) {
  const leftDomains = [left?.domain, left?.profile?.officialWebsite].map(companyIdentityHost).filter(Boolean);
  const rightDomains = [right?.domain, right?.profile?.officialWebsite].map(companyIdentityHost).filter(Boolean);
  if (leftDomains.some(a => rightDomains.some(b => a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)))) return true;
  const roots = record => [record?.name, record?.publisher, record?.operator, record?.profile?.operator, record?.profile?.legalName]
    .map(companyIdentityRoot).filter(value => value.length >= 4);
  const a = roots(left), b = roots(right);
  const extensions = ["cloud", "deepmind", "labs", "notebook", "research", "studio", "systems", "technologies"];
  const compatible = (x, y) => {
    if (x === y) return true;
    if (Math.min(x.length, y.length) < 5) return false;
    const [shorter, longer] = x.length <= y.length ? [x, y] : [y, x];
    if (!longer.startsWith(shorter)) return false;
    const extension = longer.slice(shorter.length);
    return extensions.some(token => extension.startsWith(token));
  };
  return a.some(x => b.some(y => compatible(x, y)));
}
function claimUniqueCompanies(rows, occupied) {
  return (rows || []).filter(record => {
    if ((occupied || []).some(existing => sameCompanyRecord(record, existing))) return false;
    occupied.push(record);
    return true;
  });
}

// A stable, factual data architecture replaces transient loading/empty copy.
// It explains how the next crawler snapshot becomes a publishable card without
// claiming that an unsupported fact exists.
function SourcePipeline({ kind = "company" }) {
  const flows = {
    company: [
      ["01 · SOURCE", "공식 회사·제품·실적 원문"],
      ["02 · EXTRACT", "사업·수익·실행 문장 추출"],
      ["03 · VERIFY", "회사명·수치·URL 대조"],
      ["04 · PUBLISH", "MECE 전략 카드 반영"],
    ],
    signal: [
      ["01 · SOURCE", "기업 발표·발행사 본문"],
      ["02 · EXTRACT", "제품·계약·제휴 행동 추출"],
      ["03 · LOCALIZE", "한국어 핵심 3줄 정규화"],
      ["04 · CLASSIFY", "SW·서비스 계층 분류"],
    ],
    market: [
      ["01 · SOURCE", "시장조사·기업·공시 원문"],
      ["02 · EXTRACT", "수치·정의·기준연도 추출"],
      ["03 · VERIFY", "통화·단위·예측기간 대조"],
      ["04 · PUBLISH", "MECE 시장 카드 반영"],
    ],
    startup: [
      ["01 · UNIVERSE", "a16z·공식 제품 페이지"],
      ["02 · EXTRACT", "사업·수익·방향 분해"],
      ["03 · VERIFY", "운영사·원문 URL 대조"],
      ["04 · COMPARE", "동일 전략 카드로 비교"],
    ],
  };
  const rows = flows[kind] || flows.company;
  return (
    <div className="source-pipeline" aria-label="크롤링 기반 업데이트 구조">
      {rows.map((row, index) => (
        <React.Fragment key={row[0]}>
          <div><em>{row[0]}</em><b>{row[1]}</b></div>
          {index < rows.length - 1 && <i aria-hidden="true" />}
        </React.Fragment>
      ))}
    </div>
  );
}

// Main-page decision architecture: each startup is read with the same
// consulting sequence before the user drills into company-specific evidence.
// The rail describes the analysis lens, so it does not duplicate card content.
function ConsultingDecisionRail({ accent = "#0E8F6E" }) {
  const steps = [
    ["01", "FACT BASE", "기업·창업자·제품"],
    ["02", "REVENUE ENGINE", "구독·사용량·거래·광고"],
    ["03", "STRATEGY VECTOR", "제품·고객·채널 확장"],
    ["04", "EXECUTIVE MAP", "CEO·CTO·핵심 임원"],
  ];
  return (
    <div className="consult-decision-rail" style={{ "--accent": accent }}
      aria-label="스타트업 전략 분석 프레임">
      {steps.map((step, index) => (
        <React.Fragment key={step[0]}>
          <div>
            <em>{step[0]}</em>
            <span>{step[1]}</span>
            <b>{step[2]}</b>
          </div>
          {index < steps.length - 1 && <i aria-hidden="true" />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ---- Category company board (dense table) ----------------------
function CompanyBoard({ cat, companies, density, sectionRef, query, onSelect }) {
  const inView = useInView(sectionRef);
  const prog = useProgress(inView, 1000);
  // 스타트업 행 삭제(비밀번호) — localStorage 영구 보존
  const CO_LS = "aiDashDeletedCompanies";
  const [delCos, setDelCos] = React.useState(() => { try { return JSON.parse(localStorage.getItem(CO_LS) || "{}"); } catch { return {}; } });
  const [coPending, setCoPending] = React.useState(null);
  const [coPw, setCoPw] = React.useState("");
  const [coPwErr, setCoPwErr] = React.useState(false);
  const confirmCoDel = (name) => {
    if (!canDelete(coPw)) { setCoPwErr(true); return; }
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

// ---- 단말 AI 전략 프레임 — Where to Play / How to Win / Execution ----
function MobileStrategyBoard({ companies, onNav, sectionRef }) {
  const inView = useInView(sectionRef);
  const layers = window.DASH.VALUE_CHAIN || [];
  const strategy = window.DASH.MOBILE_STRATEGY || { choices: [], horizons: [] };
  const participates = (c, id) => c.layer === id || (c.adjacentLayers || []).includes(id);
  const layerRows = id => (companies || []).filter(c => participates(c, id));
  const layerStats = layers.map(layer => {
    const rows = layerRows(layer.id);
    const primary = rows.filter(c => c.layer === layer.id).length;
    const mentions = rows.reduce((sum, c) => sum + Number(c.live?.mentions30 || 0), 0);
    const top = [...rows].sort((a, b) => Number(b.live?.mentions30 || 0) - Number(a.live?.mentions30 || 0))[0];
    return { ...layer, rows, primary, mentions, top };
  });
  const maxMomentum = Math.max(1, ...layerStats.map(l => l.mentions));
  const companyCount = new Set((companies || []).map(company => company.name)).size;
  const signalCount = (companies || []).reduce((sum, company) => sum + Number(company.live?.mentions30 || 0), 0);
  const leadLayer = [...layerStats].sort((a, b) => b.mentions - a.mentions)[0] || {};
  const finalHorizon = (strategy.horizons || [])[Math.max(0, (strategy.horizons || []).length - 1)] || {};
  return (
    <section className="board msf" ref={sectionRef} data-screen-label="Mobile AI Strategy Framework">
      <AnimCtx.Provider value={inView}>
        <div className="board-head" style={{ "--accent": "#1428A0" }}>
          <span className="board-tab" style={{ background: "#1428A0" }} />
          <div className="board-titles">
            <h2>단말 AI 전략 프레임 <span className="board-en">Where to Play · How to Win · Execution</span></h2>
            <p>휴대폰 사업자가 <b>어디를 직접 보유하고, 어디를 오케스트레이션하며, 어디를 파트너·조달할지</b>를 7개 SW·서비스 계층으로 정리</p>
          </div>
          <div className="board-count msf-live">LIVE · 30일 신호</div>
        </div>

        <div className="msf-exec-architecture">
          <div className="msf-strategy-house">
            <div className="msf-house-roof">
              <span>NORTH STAR</span>
              <p>{strategy.northStar}</p>
            </div>
            <div className="msf-house-pillars">
              {(strategy.choices || []).slice(0, 4).map((choice, index) => (
                <div key={choice.no}>
                  <em>0{index + 1}</em>
                  <b>{choice.title}</b>
                  <span>{choice.where}</span>
                </div>
              ))}
            </div>
            <div className="msf-house-foundation">
              <em>FOUNDATION</em>
              <b>단말 · OS · 계정 · 결제 · 개인 컨텍스트</b>
            </div>
          </div>

          <div className="msf-exec-synthesis">
            <div className="msf-synthesis-head">
              <span>EXECUTIVE SYNTHESIS</span>
              <b>시장 근거에서 실행 우선순위까지</b>
            </div>
            <div className="msf-synthesis-flow">
              <div><em>01 · UNIVERSE</em><b>{companyCount}개사</b><span>SW·서비스 밸류체인</span></div>
              <i aria-hidden="true" />
              <div><em>02 · MOMENTUM</em><b>{leadLayer.ko || layerStats[0]?.ko}</b><span>{leadLayer.mentions || 0}건 · 상위 계층</span></div>
              <i aria-hidden="true" />
              <div><em>03 · CHOICE</em><b>{(strategy.choices || []).length}개 플레이</b><span>Where to Play / Win</span></div>
              <i aria-hidden="true" />
              <div><em>04 · END STATE</em><b>{finalHorizon.title || "플랫폼 확장"}</b><span>{signalCount}건 · 30일 근거</span></div>
            </div>
            <p>직접 보유할 통제점과 파트너 조달 영역을 분리하고, 반복 매출이 발생하는 서비스 계층에 자본과 실행 조직을 집중합니다.</p>
          </div>
        </div>

        <div className="msf-section-head">
          <div><em>01</em><h3>밸류체인 통제 전략</h3></div>
          <p>고객 접점에서 백엔드로 갈수록 ‘직접 보유’에서 ‘선택 조달’로 자본 배분을 전환</p>
        </div>
        <div className="msf-chain">
          {layerStats.map((l, i) => (
            <button className="msf-layer" key={l.id} onClick={() => onNav && onNav(l.id)}
              style={{ "--lc": l.accent, "--momentum": `${Math.max(8, 100 * l.mentions / maxMomentum)}%` }}>
              <span className="msf-layer-no">L{i + 1}</span>
              <span className="msf-layer-role">{l.stanceKo}</span>
              <b>{l.ko}</b>
              <span className="msf-layer-control">{l.controlPoint}</span>
              <span className="msf-layer-meter"><i /></span>
              <span className="msf-layer-stats"><em>{l.primary}개 핵심사</em><em>{l.mentions}건·30일</em></span>
              {l.top && <span className="msf-layer-top">Top signal · {l.top.name}</span>}
            </button>
          ))}
        </div>

        <div className="msf-section-head">
          <div><em>02</em><h3>Where to Play / How to Win</h3></div>
          <p>단말·OS·계정·결제·개인 컨텍스트를 재사용할 수 있는 4개 우선 플레이</p>
        </div>
        <div className="msf-choices">
          {(strategy.choices || []).map(c => (
            <div className="msf-choice" key={c.no}>
              <div className="msf-choice-top"><span>{c.no}</span><b>{c.title}</b></div>
              <dl>
                <div><dt>WHERE</dt><dd>{c.where}</dd></div>
                <div><dt>WIN</dt><dd>{c.win}</dd></div>
                <div><dt>KPI</dt><dd>{c.kpi}</dd></div>
              </dl>
            </div>
          ))}
        </div>

        <div className="msf-section-head">
          <div><em>03</em><h3>레이어별 의사결정 기준</h3></div>
          <p>통제점·수익원·리스크를 한 화면에서 비교하고 투자 우선순위를 결정</p>
        </div>
        <div className="msf-matrix">
          <div className="msf-mrow msf-mhead"><span>계층 / 역할</span><span>통제점</span><span>수익 구조</span><span>단말 사업자 Action</span><span>핵심 리스크</span></div>
          {layers.map(l => (
            <div className="msf-mrow" key={l.id} style={{ "--lc": l.accent }}>
              <span className="msf-mname"><i /> <b>{l.ko}</b><em>{l.stanceKo}</em></span>
              <span>{l.controlPoint}</span><span>{l.economics}</span><span className="msf-maction">{l.operatorMove}</span><span>{l.risk}</span>
            </div>
          ))}
        </div>

        <div className="msf-section-head">
          <div><em>04</em><h3>실행 로드맵</h3></div>
          <p>기준선 확보 · 통제점 제품화 · 플랫폼 확장</p>
        </div>
        <div className="msf-horizons">
          {(strategy.horizons || []).map((h, i) => (
            <div className="msf-horizon" key={h.id}>
              <span>{h.label}</span><h4>{h.title}</h4>
              <ul>{(h.actions || []).map((a, j) => <li key={j}>{a}</li>)}</ul>
              {i < strategy.horizons.length - 1 && <i className="msf-harr" aria-hidden="true" />}
            </div>
          ))}
        </div>
      </AnimCtx.Provider>
    </section>
  );
}

// ---- 공통 기업 인텔리전스 카드 ----
// 메인에서 회사의 사업·수익모델·전략 방향·최근 실행을 바로 비교하고,
// 상세 팝업은 근거·조직·실적·발언을 더 깊게 제공한다.
function StrategyPortfolioCard({
  company, accent, eyebrow, badge, business, revenueModel, direction, execution,
  headcount, sourceCount, institution, onSelect, accessory,
}) {
  const c = company || {};
  const intel = c.live?.intelligence || c.intelligence || {};
  const profile = c.live?.profile || c.profile || {};
  const compact = (value, size = 126) => {
    const text = safeDisplayString(value);
    return text.length > size ? `${text.slice(0, size - 1)}…` : text;
  };
  const occupiedCopy = [];
  const distinct = value => {
    const text = compact(value);
    if (!text || occupiedCopy.some(previous => isRepeatedMECEText(previous, text))) return "";
    occupiedCopy.push(text);
    return text;
  };
  const currentBusiness = distinct(business || intel.currentBusiness?.summary || c.note || profile.business?.[0] || c.unit);
  const money = distinct(revenueModel || intel.revenueModel?.summary || c.revenue);
  const future = distinct(direction || intel.strategyDirection?.summary || c.direction);
  const latestExecution = distinct(execution || intel.corePractices?.[0]?.insight || intel.corePractices?.[0]?.title
    || c.live?.latest?.title || c.latest?.title);
  const rawPeople = headcount || c.live?.employees || profile.headcount || "";
  const people = !headcount && c.live?.employeesAsof && rawPeople
    ? `${rawPeople} · '${String(c.live.employeesAsof).slice(2, 4)}`
    : rawPeople;
  const evidenceRows = [
    ...(intel.currentBusiness?.evidence || []),
    ...(intel.revenueModel?.evidence || []),
    ...(intel.strategyDirection?.evidence || []),
  ];
  const evidenceN = Number.isFinite(sourceCount) ? sourceCount : new Set(evidenceRows.map(item => item.url).filter(Boolean)).size;
  const organization = c.live?.organization || c.organization || c.org || {};
  const leaderRows = Array.isArray(organization.executiveTeam) && organization.executiveTeam.length
    ? organization.executiveTeam : organization.leadership || [];
  const leadership = leaderRows.slice(0, 2).map(person => person.name).filter(Boolean).join(" · ");
  const activate = () => onSelect && onSelect(c);
  return (
    <div className="sp-card" role="button" tabIndex="0" onClick={activate}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } }}
      style={{ "--accent": accent || "#2D6BFF" }} aria-label={`${c.name} 전략 상세 보기`}>
      <div className="sp-card-head">
        <CoLogo name={c.name} domain={c.domain} accent={accent} />
        <span className="sp-card-company">
          <em>{eyebrow}</em>
          <b>{c.name}</b>
        </span>
        {badge && <span className="sp-card-badge">{badge}</span>}
        {accessory}
      </div>
      {(institution || c.live?.portfolioReference?.institution?.name) && (
        <div className="sp-card-institution">{institution || `${c.live.portfolioReference.institution.name} 선정 · 대표 카드에 통합`}</div>
      )}
      <div className="sp-card-logic" aria-hidden="true">
        <span>BUSINESS</span><i /><span>ECONOMICS</span><i /><span>DIRECTION</span>
      </div>
      <div className="sp-card-intel">
        {currentBusiness && <div className="business">
          <span>현재 사업</span>
          <b>{currentBusiness}</b>
        </div>}
        {money && <div className="economics">
          <span>Biz Model</span>
          <b>{money}</b>
        </div>}
        {future && <div className="direction">
          <span>사업 방향</span>
          <b>{future}</b>
        </div>}
        {latestExecution && <div className="execution">
          <span>최근 실행</span>
          <b>{latestExecution}</b>
        </div>}
      </div>
      <div className="sp-card-foot">
        {leadership && <span><em>창업·경영진</em>{leadership}</span>}
        {people && <span><em>인력</em>{people}</span>}
        {evidenceN > 0 && <span><em>원문 근거</em>{evidenceN}건</span>}
        <b>실적·조직·발언·원문 <i aria-hidden="true" /></b>
      </div>
    </div>
  );
}

// ---- AI 밸류체인 계층 보드 — 회사별 대표 계층 한 곳에만 표시 ----
function ValueChainBoard({ layerId, companies, onSelect, sectionRef }) {
  const inView = useInView(sectionRef);
  const layer = (window.DASH.VALUE_CHAIN || []).find(l => l.id === layerId) || {};
  const [vertical, setVertical] = React.useState("all");
  const fitRank = { high: 3, medium: 2, low: 1 };
  const rows = (companies || []).filter(c => c.layer === layerId)
    .sort((a, b) => {
      const ap = a.layer === layerId ? 1 : 0, bp = b.layer === layerId ? 1 : 0;
      return bp - ap || (fitRank[b.mobileFit] || 0) - (fitRank[a.mobileFit] || 0)
        || Number(b.live?.mentions30 || 0) - Number(a.live?.mentions30 || 0)
        || a.name.localeCompare(b.name);
    });
  const counts = {};
  rows.forEach(c => { const v = c.vchainVertical || "기타"; counts[v] = (counts[v] || 0) + 1; });
  const vkeys = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  const visibleRows = vertical === "all" ? rows : rows.filter(c => (c.vchainVertical || "기타") === vertical);
  const primaryCount = rows.filter(c => c.layer === layerId).length;
  const adjacentCount = (companies || []).filter(c => c.layer !== layerId && (c.adjacentLayers || []).includes(layerId)).length;
  return (
    <section className="board" ref={sectionRef} data-screen-label={layer.en}>
      <AnimCtx.Provider value={inView}>
        <div className="board-head" style={{ "--accent": layer.accent }}>
          <span className="board-tab" style={{ background: layer.accent }} />
          <div className="board-titles">
            <h2>{layer.ko} <span className="board-en">{layer.en}</span></h2>
            <p>{layer.desc}</p>
            <div className="vc-thesis">
              <span>{layer.stanceKo}</span><b>통제점</b> {layer.controlPoint}<i>·</i><b>단말 Action</b> {layer.operatorMove}
            </div>
          </div>
          <div className="board-count" style={{ color: layer.accent, background: layer.accentSoft }}>
            {primaryCount}개사 · 단일 배치{adjacentCount > 0 ? ` · 인접 ${adjacentCount}개 상세` : ""}
          </div>
        </div>
        <div className="vc-filter-bar" aria-label={`${layer.ko} 세부 영역 필터`}>
          <button className={vertical === "all" ? "on" : ""} onClick={() => setVertical("all")}>전체 <em>{rows.length}</em></button>
          {vkeys.map(v => <button key={v} className={vertical === v ? "on" : ""} onClick={() => setVertical(v)}>{v} <em>{counts[v]}</em></button>)}
        </div>
        <div className="vc-logic-map" aria-label={`${layer.ko} 전략 논리`}>
          <div><em>01 · CONTROL POINT</em><b>{layer.controlPoint}</b><span>어디를 통제할 것인가</span></div>
          <i aria-hidden="true" />
          <div><em>02 · ECONOMICS</em><b>{layer.economics}</b><span>어떻게 반복 수익을 만드는가</span></div>
          <i aria-hidden="true" />
          <div><em>03 · OPERATOR MOVE</em><b>{layer.operatorMove}</b><span>단말 사업자가 무엇을 실행할 것인가</span></div>
          <i aria-hidden="true" />
          <div className="risk"><em>04 · GUARDRAIL</em><b>{layer.risk}</b><span>투자 전 확인할 핵심 리스크</span></div>
        </div>
        <div className="vc-portfolio-grid">
          {visibleRows.map(c => (
            <StrategyPortfolioCard key={c.name} company={c} accent={layer.accent}
              eyebrow={c.vchainVertical || "기타"}
              badge="대표 계층"
              onSelect={onSelect} />
          ))}
          {rows.length === 0 && <SourcePipeline kind="company" />}
        </div>
      </AnimCtx.Provider>
    </section>
  );
}

// ---- Company detail modal (overview + all info + related news) --
function CompanyDetail({ company, cats, articles, generatedAt, onClose }) {
  React.useEffect(() => {
    if (!company) return;
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [company]);
  if (!company) return null;
  const c = company;
  const cat = (cats.find(x => x.id === c.cat) || {});
  const layer = (window.DASH.VALUE_CHAIN || []).find(l => l.id === c.layer) || {};
  const accent = layer.accent || cat.accent || "#2D6BFF";
  const intelligence = c.live?.intelligence || c.intelligence || {};
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
      <div className="cd-modal" onClick={e => e.stopPropagation()} style={{ "--accent": accent }}>
        <button className="cd-close" onClick={onClose} aria-label="닫기"><Icon name="x" size={16} sw={2} /></button>

        <div className="cd-head">
          <CoLogo name={c.name} domain={c.domain} accent={accent} />
          <div className="cd-head-txt">
            <h3>{c.name}</h3>
            <div className="cd-sub">
              <span className="cd-cat" style={{ color: cat.accent, background: cat.accentSoft }}>{cat.ko}</span>
              {layer.ko && <span className="cd-layer" style={{ color: accent, borderColor: accent }}>{layer.ko}</span>}
              <span>{c.unit}</span>
              {(c.live?.updatedAt || generatedAt) && <span className="cd-refresh">DATA {String(c.live?.updatedAt || generatedAt).slice(0, 10)}</span>}
              {c.dataStatus && <span className="cd-data-status">{c.dataStatus}</span>}
            </div>
          </div>
        </div>

        {(() => {
          const empty = v => !v || v === "—" || String(v).trim() === "";
          const stats = [];
          if (!empty(c.valuation)) stats.push({ k: "밸류에이션", v: c.valuation, asof: c.valAsof });
          if (!empty(c.value) && c.metric && c.metric !== "원문 기사") stats.push({ k: c.metric, v: c.value, asof: c.metricAsof });
          if (!empty(c.funding)) stats.push({ k: "펀딩 단계", v: c.funding });
          return stats.length ? (
            <div className="cd-stats">
              {stats.map((s, i) => (
                <div className="cd-stat" key={i}>
                  <em>{s.k}</em><b>{s.v}</b>
                  {s.asof && s.asof !== "—" && <span>'{s.asof} 기준</span>}
                </div>
              ))}
            </div>
          ) : null;
        })()}

        {c.profile && (() => {
          const p = c.profile, lv = c.live || {};
          // 변동 항목은 크롤 값 우선(최신·출처 기반), 없으면 정적 폴백
          const ceo = lv.ceo || p.ceo;
          const hq = lv.hq || p.hq;
           const emp = lv.employees || p.headcount || "";
           const holders = lv.topHolders || p.shareholders;
          const empAsof = lv.employees && lv.employeesAsof ? ` ('${String(lv.employeesAsof).slice(2)} 기준)` : "";
          const capAsof = lv.cap && lv.capAsof ? ` ('${String(lv.capAsof).slice(2, 7)} 기준)` : "";
          const live = !!(lv.ceo || lv.hq || lv.employees || lv.revenueQ || lv.topHolders || lv.cap);
          const rows = [
            ["설립", p.founded],
            ["법인·운영사", p.operator || p.legalName],
            ["경영진", ceo],
            ["본사", hq],
            ["섹터", lv.sector || p.sector || ""],
             ["인력", emp ? emp + empAsof : ""],
            ["시가총액", lv.cap ? lv.cap + capAsof : ""],
            ["주주", holders],
          ].filter(r => r[1]);
          const fin = lv.revenueQ
            ? `매출 ${lv.revenueQ}${lv.netIncomeQ ? ` · 순이익 ${lv.netIncomeQ}` : ""}${lv.quarterEnd ? ` (${lv.quarterEnd} 분기)` : ""}`
            : "";
          const profileCoverage = (lv.coverage && lv.coverage.profile) || (c.coverage && c.coverage.profile);
          const profileSources = [...new Set([
            p.officialWebsite,
            ...(p.sourceUrls || []),
          ].filter(url => /^https?:\/\//i.test(String(url || ""))))].slice(0, 6);
          const businessRows = uniqueMECEValues(Array.isArray(p.business) ? p.business : []);
          const noteSummary = uniqueMECEValues([c.note], businessRows)[0] || "";
          return (
            <div className="cd-section cd-profile">
              <h4>기업 개요 <em>Company Profile</em>
                <b className="cd-prof-live">{live ? "LIVE · 공시/시장" : "기준정보 · 뉴스 기반"}</b>
                {profileCoverage && <b className="cd-coverage">커버리지 {profileCoverage.score}%</b>}
              </h4>
              <div className="cd-prof-grid">
                {rows.map(([k, v], i) => (
                  <div className="cd-prof-row" key={i}><em>{k}</em><span>{v}</span></div>
                ))}
              </div>
               {lv.employeesSourceUrl && (
                 <a className="cd-prof-source" href={lv.employeesSourceUrl} target="_blank" rel="noopener">
                   {lv.employeesStale ? `과거 보고값 ${lv.employeesLastReported || ""} (${lv.employeesAsof || "기준일 미상"}) · 현행값으로 사용하지 않음` : `인력 출처 · ${lv.employeesSource || "공개 데이터"}`}
                 </a>
               )}
              {profileSources.length > 0 && (
                <div className="cd-prof-sources">
                  <em>기업 개요 근거</em>
                  {profileSources.map((url, index) => (
                    <a key={url} href={url} target="_blank" rel="noopener">
                      {index === 0 ? "공식 홈페이지" : `공식·구조화 원문 ${index + 1}`}
                    </a>
                  ))}
                </div>
              )}
              {businessRows.length > 0 && (
                <div className="cd-prof-biz"><em>주요사업</em><ul>{businessRows.map((b, i) => <li key={i}>{b}</li>)}</ul></div>
              )}
              {noteSummary && (
                <div className="cd-profile-summary"><em>사업 설명</em><p>{bulletText(noteSummary)}</p></div>
              )}
              {fin && <div className="cd-prof-fin"><em>경영 실적</em><span>{fin}</span><i>실적 발표 주기로 자동 갱신</i></div>}
            </div>
          );
        })()}

        {(() => {
          const sections = [
            { key: "currentBusiness", no: "01", ko: "현재 비즈니스", en: "Current Business", fallback: c.note || c.vp || c.unit },
            { key: "revenueModel", no: "02", ko: "수익 모델", en: "Revenue Engine", fallback: c.vp },
            { key: "strategyDirection", no: "03", ko: "앞으로의 사업 방향", en: "Strategic Direction", fallback: c.direction },
            { key: "investmentDirection", no: "04", ko: "투자·제휴 방향", en: "Investment Direction", fallback: "" },
          ];
          const occupied = [];
          const visibleSections = sections.map(section => {
            const item = intelligence[section.key] || {};
            const candidates = [item.summary || section.fallback, ...(item.details || [])];
            const summary = uniqueMECEValues(candidates, occupied)[0] || "";
            if (!summary) return null;
            occupied.push(summary);
            const details = uniqueMECEValues(item.details || [], occupied);
            occupied.push(...details);
            return { ...section, item: { ...item, details }, summary };
          }).filter(Boolean);
          const hasIntel = visibleSections.length > 0;
          if (!hasIntel) return null;
          return (
             <div className="cd-section cd-strategy-frame">
               <h4>비즈니스 모델·전략 분석 <em>Business · Economics · Direction · Capital</em>
                 <b className="cd-prof-live">{String(intelligence.engine || "").startsWith("github-models:") ? "AI · 원문 근거 종합" : "원문 추출 종합"}</b>
               </h4>
               <div className="cd-mece-route" aria-label="MECE 기업 전략 분석 흐름">
                 {(intelligence.meceFramework || [
                   { key: "currentBusiness", label: "사업 범위", question: "무엇을 제공하는가" },
                   { key: "revenueModel", label: "수익 엔진", question: "어떻게 돈을 버는가" },
                   { key: "strategyDirection", label: "성장 방향", question: "어디로 확장하는가" },
                   { key: "investmentDirection", label: "자본 배분", question: "무엇에 투자하는가" },
                 ]).filter(step => visibleSections.some(section => section.key === step.key)).map((step, index, rows) => (
                   <React.Fragment key={step.key}>
                     <span><em>{String(index + 1).padStart(2, "0")}</em><b>{step.label}</b><small>{step.question}</small></span>
                     {index < rows.length - 1 && <i aria-hidden="true" />}
                   </React.Fragment>
                 ))}
               </div>
               <div className="cd-sf-grid cd-intelligence-grid">
                {visibleSections.map((section, sectionIndex) => (
                  <React.Fragment key={section.key}>
                     <div className={`cd-sf-card ${section.key}`} key={section.key}>
                       <em>{section.no} · {section.ko} <i>{section.en}</i>
                         {section.item.confidence && <span className={`cd-grounding ${section.item.confidence}`}>{section.item.confidence === "high" ? "근거 충분" : section.item.confidence === "medium" ? "근거 확인" : "공개정보 제한"}</span>}
                       </em>
                      <b>{section.summary}</b>
                      {Array.isArray(section.item.details) && section.item.details.length > 0 && (
                        <ul>{section.item.details.slice(0, 4).map((detail, index) => <li key={index}>{detail}</li>)}</ul>
                      )}
                      {Array.isArray(section.item.evidence) && section.item.evidence.length > 0 && (
                        <div className="cd-intel-sources">
                          {section.item.evidence.slice(0, 3).map((source, index) => (
                            <a key={index} href={source.url} target="_blank" rel="noopener">
                              {source.date ? `${String(source.date).slice(2)} · ` : ""}{source.source || "원문"}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    {sectionIndex < visibleSections.length - 1 && <i className="cd-sf-link" aria-hidden="true" />}
                  </React.Fragment>
                ))}
              </div>
               <div className="cd-sf-evidence">
                 <span><b>갱신 주기</b>뉴스·실적 발표 후 자동 재분석</span>
                 <span><b>근거 범위</b>{intelligence.evidenceWindow || "공식 발표·원문 기사·시장 데이터"}</span>
                 <span><b>검증</b>{intelligence.groundingStatus ? "숫자·출처 URL 자동 대조" : "원문 링크 대조"}</span>
                 {(intelligence.generatedAt || c.live?.updatedAt || generatedAt) && (
                   <span><b>생성일</b>{String(intelligence.generatedAt || c.live?.updatedAt || generatedAt).slice(0, 10)}</span>
                 )}
               </div>
            </div>
          );
        })()}

        {Array.isArray(c.live?.strategicVentures || c.strategicVentures) && (c.live?.strategicVentures || c.strategicVentures).length > 0 && (
          <div className="cd-section cd-venture-section">
            <h4>신규 비즈니스 모델 확장 <em>New Business Model Expansion</em><b className="cd-prof-live">SOURCE-BACKED</b></h4>
            <div className="cd-venture-list">
              {(c.live?.strategicVentures || c.strategicVentures).map(venture => (
                <article className="cd-venture-card" key={venture.id}>
                  <div className="cd-venture-head">
                    <div><em>{venture.announcedAt}</em><h5>{venture.title}</h5></div>
                    <span>{venture.structure}</span>
                  </div>
                  <div className="cd-venture-facts">
                    <div><em>자본·지배구조</em><b>{venture.capital}</b><p>{venture.ownership}</p></div>
                    <div><em>운영 모델</em><b>{venture.operatingModel}</b><p>{venture.expansion}</p></div>
                    <div><em>고객·유통망</em><b>{venture.targetCustomers}</b><p>{(venture.partners || []).join(" · ")}</p></div>
                    <div className="implication"><em>단말 사업자 시사점</em><b>{venture.handsetImplication}</b></div>
                  </div>
                  <div className="cd-venture-sources">
                    {(venture.sources || []).map((source, index) => (
                      <a key={index} href={source.url} target="_blank" rel="noopener">{source.publisher} · {source.date} 원문</a>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            {(c.live?.strategicVentureComparison || c.strategicVentureComparison) && (() => {
              const comparison = c.live?.strategicVentureComparison || c.strategicVentureComparison;
              return (
                <div className="cd-venture-comparison">
                  <em>핵심 인사이트</em>
                  <b>{comparison.title}</b>
                  <p>{comparison.insight}</p>
                  <strong>{comparison.operatorMove}</strong>
                  {comparison.market && (
                    <a href={comparison.market.source?.url} target="_blank" rel="noopener">
                      AI 컨설팅 시장 2025 {comparison.market.value2025} · 2030 {comparison.market.forecast2030} · CAGR {comparison.market.cagr}
                    </a>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {Array.isArray(intelligence.newBusinessModels) && intelligence.newBusinessModels.length > 0 && (
          <div className="cd-section">
            <h4>AI 신규 수익모델 <em>Emerging AI Business Models</em><b className="cd-prof-live">CRAWL · SYNTHESIS</b></h4>
            <div className="cd-newbm-grid">
              {intelligence.newBusinessModels.map((model, index) => (
                <article className="cd-newbm-card" key={index}>
                  <em>MODEL {String(index + 1).padStart(2, "0")}</em>
                  <h5>{model.title}</h5>
                  <p>{model.model}</p>
                  {model.implication && <strong>{model.implication}</strong>}
                  {model.evidence?.url && (
                    <a href={model.evidence.url} target="_blank" rel="noopener">
                      {model.evidence.source || "원문"}{model.evidence.date ? ` · ${model.evidence.date}` : ""}
                    </a>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}

        {(() => {
          const M = c.monetize || {};
          const entry = M.entry;
          const modelMeta = id => (M.models || []).find(m => m.id === id) || { ko: id, accent: cat.accent };
          const dirMeta = id => (M.directions || []).find(d => d.id === id) || { ko: id, accent: cat.accent };
          // 원문 확인(한국어 3줄) 기사 인덱스 — 표시 게이트
          const srcIdx = new Map();
          (articles || []).forEach(a => {
            const loc = a?.localization, k = signalSourceKey(a?.url);
            if (k && loc?.status === "accepted" && loc?.displayLanguage === "ko"
              && Array.isArray(loc.summaryLines) && loc.summaryLines.length === 3) srcIdx.set(k, a);
          });
          const resolve = (arr, n) => {
            const seen = new Set(), out = [];
            for (const s of (arr || [])) {
              const src = srcIdx.get(signalSourceKey(s.url));
              if (!src) continue;
              const d = displayFeedText(src);
              if (!d.translated || !d.title) continue;
              const k = signalSourceKey(s.url);
              if (seen.has(k)) continue; seen.add(k);
              out.push({ ...s, koTitle: d.title });
              if (out.length >= n) break;
            }
            return out;
          };
          const monetize = entry ? resolve(entry.monetize, 3) : [];
          const direction = entry ? resolve(entry.direction, 3) : [];
          const mix = {}; monetize.forEach(s => { if (s.model) mix[s.model] = (mix[s.model] || 0) + 1; });
          const modelMix = Object.entries(mix).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n }));
          const hasCrawl = monetize.length || direction.length;
          if (!hasCrawl) return null;
          return (
            <div className="cd-section">
              <h4>수익화·사업 변화 근거 <em>Economics & Strategic Evidence</em><b className="cd-prof-live">LIVE · 크롤</b></h4>
              {modelMix.length > 0 && (
                <div className="cd-bd-mix"><em>수익 모델(크롤)</em>
                  <div className="mplay-mix">{modelMix.map(m => { const mm = modelMeta(m.id); return <span className="mplay-model" key={m.id} style={{ "--c": mm.accent }} title={mm.ko}>{mm.ko}<i>{m.n}</i></span>; })}</div>
                </div>
              )}
              {monetize.length > 0 && (
                <div className="cd-bd-sec">
                  <h5>돈 버는 방식 — 크롤 신호</h5>
                  {monetize.map((s, i) => { const mm = modelMeta(s.model); return (
                    <a className="mplay-sig" key={"m" + i} href={s.url} target="_blank" rel="noopener">
                      <span className="mplay-tag" style={{ "--c": mm.accent }}>{mm.ko}</span>
                      <span className="mplay-txt">{s.koTitle}</span>
                      <em>{s.source}{s.date ? " · " + String(s.date).slice(5) : ""}</em>
                    </a>
                  ); })}
                </div>
              )}
              {direction.length > 0 && (
                <div className="cd-bd-sec">
                  <h5>앞으로의 투자·사업 방향 — 크롤 신호</h5>
                  {direction.map((s, i) => { const dm = dirMeta(s.kind); return (
                    <a className="mplay-sig" key={"d" + i} href={s.url} target="_blank" rel="noopener">
                      <span className="mplay-tag dir" style={{ "--c": dm.accent }}>{dm.ko}</span>
                      <span className="mplay-txt">{s.koTitle}</span>
                      <em>{s.source}{s.date ? " · " + String(s.date).slice(5) : ""}</em>
                    </a>
                  ); })}
                </div>
              )}
              {hasCrawl ? <p className="cd-cp-note">수익모델·사업 방향 신호는 매일 크롤 기사에서 자동 분류·누적 · 원문 확인(한국어 3줄) 기사만 표시</p> : null}
            </div>
          );
        })()}

        {(c.org || c.live?.organization || (c.live && c.live.officers && c.live.officers.length)) && (() => {
          const org = c.org || c.live?.organization || {};
          const live = c.live || {};
          const curated = Array.isArray(org.leadership) ? org.leadership : [];
          const filingOfficers = (live.officers && live.officers.length ? live.officers : org.officers || [])
            .map(officer => ({ ...officer, role: officer.role || officer.title || "Executive" }));
          const personKey = name => String(name || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
          const curatedByName = new Map(curated.map(person => [personKey(person.name), person]));
          const seen = new Set();
          const roster = [];
          const normalizedTeam = Array.isArray(org.executiveTeam) ? org.executiveTeam : [];
          normalizedTeam.forEach(person => {
            const key = personKey(person.name);
            if (!key || seen.has(key)) return;
            seen.add(key);
            roster.push(person);
          });
          filingOfficers.forEach(officer => {
            const key = personKey(officer.name);
            const background = curatedByName.get(key) || {};
            if (!key || seen.has(key)) return;
            seen.add(key);
            roster.push({ ...background, ...officer, role: officer.role || background.role });
          });
          curated.forEach(person => {
            const key = personKey(person.name);
            if (!key || seen.has(key)) return;
            seen.add(key);
            roster.push(person);
          });
          const tierOf = person => person.tier || (
            /founder|co-founder|chair|board/i.test(String(person.role || "")) ? "founder-board"
              : /chief executive|\bceo\b|president/i.test(String(person.role || "")) ? "ceo"
                : /chief (technology|scientist|product)|\bcto\b|\bcpo\b|research|engineering|technology|product|AI\b/i.test(String(person.role || "")) ? "product-technology"
                  : /chief financial|\bcfo\b|finance|legal|counsel|people|operations|\bcoo\b|commercial|marketing|revenue/i.test(String(person.role || "")) ? "corporate-functions"
                    : "executive-team"
          );
          const leadIndex = roster.findIndex(person => tierOf(person) === "ceo")
            >= 0 ? roster.findIndex(person => tierOf(person) === "ceo")
            : roster.findIndex(person => /founder|co-founder|chief executive|\bceo\b|chair/i.test(String(person.role || "")));
          const lead = roster[leadIndex >= 0 ? leadIndex : 0];
          const reports = roster.filter(person => person !== lead).slice(0, 17);
          const tierMeta = [
            ["founder-board", "창업자·이사회", "Founder & Board"],
            ["product-technology", "제품·기술", "Product & Technology"],
            ["corporate-functions", "재무·운영·사업", "Corporate Functions"],
            ["executive-team", "기타 임원", "Executive Team"],
          ];
          const tierGroups = tierMeta.map(([key, ko, en]) => ({
            key, ko, en, people: reports.filter(person => tierOf(person) === key),
          })).filter(group => group.people.length);
          const crawlQuotes = Array.isArray(intelligence.executiveQuotes) ? intelligence.executiveQuotes.map(quote => ({
            who: quote.speaker, role: quote.role, date: quote.date,
            quoteEn: quote.quoteOriginal, quoteKo: quote.quoteKo,
            source: quote.source, url: quote.evidenceUrl,
          })) : [];
          const interviewRows = [...crawlQuotes, ...(org.interviews || [])].filter((item, index, rows) =>
            rows.findIndex(other => `${other.who}|${other.quoteEn || other.quoteKo}` === `${item.who}|${item.quoteEn || item.quoteKo}`) === index).slice(0, 6);
          // 검증된 직접 프로필 URL만 연결한다. 검색 결과 페이지는 상세 링크로 사용하지 않는다.
          const D = window.DASH || {};
          const directProfiles = D.LINKEDIN_PROFILES || {};
          const liName = name => String(name).split("(")[0].split("·")[0].replace(/[^\p{L}\p{N}\s.'-]/gu, "").trim();
          const liOf = p => {
            if (!p) return "";
            return p.li || directProfiles[p.name] || directProfiles[liName(p.name)] || "";
          };
          const coLink = c.profile?.linkedin || c.live?.profile?.linkedin || "";
          const NodeBg = ({ p }) => (
            <React.Fragment>
              {(p.edu || p.education || p.career || p.bg) && <dl className="cd-org-background">
                {(p.edu || p.education) && <div><dt>학교·전공</dt><dd>{p.edu || p.education}</dd></div>}
                {(p.career || p.bg) && <div><dt>주요 경력</dt><dd>{p.career || p.bg}</dd></div>}
              </dl>}
              <div className="cd-org-verification">
                <span className={p.verification === "official-role-match" || p.sourceType === "market-filing" ? "verified" : "curated"}>
                  {p.verification === "official-role-match" ? "공식 직함 확인" : p.verification === "knowledge-graph-domain-match" ? "공식 도메인 일치 지식그래프" : p.verification === "official-page-name-match" ? "공식 페이지 이름 일치" : p.sourceType === "market-filing" ? "시장·공시 원장" : "큐레이션 검토"}
                </span>
                {p.verificationUrl && <a href={p.verificationUrl} target="_blank" rel="noopener">근거</a>}
              </div>
            </React.Fragment>
          );
          const orgCoverage = (live.coverage && live.coverage.organization) || (c.coverage && c.coverage.organization);
          return (
            <React.Fragment>
              {org.mission && (
                <div className="cd-section cd-mission">
                  <h4>미션 <em>Mission</em></h4>
                  <p className="cd-mission-txt">{org.mission}</p>
                </div>
              )}
              {roster.length > 0 && (
                <div className="cd-section">
                  <h4>상세 조직도 <em>Founders · CEO · CTO · Executive Team</em><b className="cd-prof-live">{filingOfficers.length ? "LIVE 공시 + 리더십 이력" : "창업·리더십"}</b>
                    {orgCoverage && <b className="cd-coverage">커버리지 {orgCoverage.score}%</b>}
                    {coLink && <a className="cd-org-colink" href={coLink} target="_blank" rel="noopener" title="회사 LinkedIn 페이지">회사 LinkedIn</a>}
                  </h4>
                  <div className="cd-org cd-org-architecture">
                    {lead && (
                      <div className="cd-org-node lead">
                        <em className="cd-org-tier-label">CEO · EXECUTIVE LEAD</em>
                        <b>{lead.name}</b><span className="cd-org-role">{lead.role}</span>
                        <NodeBg p={lead} />
                        {liOf(lead) && <a className="cd-org-li" href={liOf(lead)} target="_blank" rel="noopener" title={`${lead.name} LinkedIn 프로필`}>LinkedIn</a>}
                      </div>
                    )}
                    {tierGroups.length > 0 && <span className="cd-org-conn" aria-hidden="true" />}
                    {tierGroups.length > 0 && (
                      <div className="cd-org-tier-groups">
                        {tierGroups.map(group => (
                          <section className="cd-org-tier" key={group.key}>
                            <header><em>{group.en}</em><b>{group.ko}</b><span>{group.people.length}명</span></header>
                            <div className="cd-org-reports">
                              {group.people.map((p, i) => (
                                <div className="cd-org-node" key={`${group.key}-${i}`}>
                                  <b>{p.name}</b><span className="cd-org-role">{p.role}</span>
                                  <NodeBg p={p} />
                                  {liOf(p) && <a className="cd-org-li" href={liOf(p)} target="_blank" rel="noopener" title={`${p.name} LinkedIn 프로필`}>LinkedIn</a>}
                                </div>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="cd-org-note">CEO 아래 창업자·이사회, 제품·기술, 재무·운영·사업 기능으로 임원 레벨을 분리 · 최대 18명 표시 · 공식 페이지·시장 원장과 큐레이션 이력을 구분 · <b>검증된 LinkedIn 직접 프로필만 연결</b></p>
                </div>
              )}
              {interviewRows.length > 0 && (
                <div className="cd-section">
                  <h4>경영진 발언·인터뷰 <em>Executive Quotes · Korean + Original</em>
                    {crawlQuotes.length > 0 && <b className="cd-prof-live">LIVE · 원문 발언 추출</b>}
                  </h4>
                  <div className="cd-itv">
                    {interviewRows.map((it, i) => (
                      <div className="cd-itv-item" key={i}>
                        <div className="cd-itv-who">
                          <b>{it.who}</b>{it.role && <span className="cd-itv-role">{it.role}</span>}
                          {it.date && <span className="cd-itv-date">{it.date}</span>}
                        </div>
                        <p className="cd-itv-ko">{it.quoteKo || it.insight}</p>
                        {it.quoteEn && <p className="cd-itv-en">“{it.quoteEn}”</p>}
                        {it.url && <a className="cd-itv-src" href={it.url} target="_blank" rel="noopener">{it.source ? it.source + " · " : ""}원문 보기 <Icon name="ext" size={10} /></a>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })()}

        {c.live && Array.isArray(c.live.execNews) && c.live.execNews.length > 0 && (
          <div className="cd-section">
            <h4>경영진 발언·기사 <em>Executive Mentions</em><b className="cd-prof-live">LIVE · 크롤</b></h4>
            <div className="cd-exn">
              {c.live.execNews.map((e, i) => (
                <a className="cd-exn-item" key={i} href={e.url} target="_blank" rel="noopener">
                  <div className="cd-exn-top"><b>{e.who}</b><span>{e.date}{e.source ? " · " + e.source : ""}</span></div>
                  {e.titleKo && <p className="cd-exn-ko">{e.titleKo}</p>}
                  <p className="cd-exn-en">{e.titleEn}</p>
                </a>
              ))}
            </div>
            <p className="cd-cp-note">경영진 이름이 등장한 크롤 기사 — 한글(가능 시)·원문 병기 · 클릭 시 원문 · 매일 자동 갱신</p>
          </div>
        )}

        {((Array.isArray(intelligence.corePractices) && intelligence.corePractices.length > 0)
          || (c.live && Array.isArray(c.live.practices) && c.live.practices.length > 0)) && (() => {
          const sourcePractices = Array.isArray(intelligence.corePractices) ? intelligence.corePractices : [];
          const practiceCopy = [];
          const ps = (sourcePractices.length ? sourcePractices : c.live.practices).filter(practice => {
            const text = `${practice.title || practice.ko || ""} ${practice.insight || ""}`.trim();
            if (!text || practiceCopy.some(previous => isRepeatedMECEText(previous, text))) return false;
            practiceCopy.push(text);
            return true;
          });
          const max = Math.max(...ps.map(p => p.count || 1), 1);
          return (
            <div className="cd-section">
              <h4>핵심 활동 분석 <em>Core Practices</em><b className="cd-prof-live">{sourcePractices.length ? "AI · 원문 종합" : "LIVE · 뉴스 기반"}</b></h4>
              <div className="cd-cp">
                {ps.map((p, i) => (
                  <div className="cd-cp-row" key={i}>
                    <div className="cd-cp-top"><b>{p.title || p.ko}</b>{p.count && <span className="cd-cp-n">{p.count}건</span>}</div>
                    {p.count && <div className="cd-cp-bar"><i style={{ width: (12 + 88 * p.count / max) + "%", background: cat.accent }} /></div>}
                    {p.insight && <p className="cd-cp-insight">{p.insight}</p>}
                    {(p.evidence?.url || p.latest?.url) && (
                      <a className="cd-cp-latest" href={p.evidence?.url || p.latest.url} target="_blank" rel="noopener">
                        {(p.evidence?.date || p.latest?.date) && <em>{String(p.evidence?.date || p.latest.date).slice(5)}</em>}
                        {String(p.evidence?.title || p.latest?.title || "원문 보기").slice(0, 90)}
                      </a>
                    )}
                  </div>
                ))}
              </div>
              <p className="cd-cp-note">공식 발표와 원문 기사에서 확인된 최근 실행을 기업별로 종합 · 새 원문이 수집되면 AI가 내용과 근거 링크를 함께 갱신</p>
            </div>
          );
        })()}

        {c.invest && Array.isArray(c.invest.portfolio) && c.invest.portfolio.length > 0 && (() => {
          const VC = window.DASH.VALUE_CHAIN || [];
          const meta = id => VC.find(l => l.id === id) || { ko: id, accent: cat.accent };
          const byLayer = {};
          c.invest.portfolio.forEach(p => { (byLayer[p.layer] = byLayer[p.layer] || []).push(p); });
          const order = VC.map(l => l.id).filter(id => byLayer[id]);
          const inv = c.invest;
          return (
            <div className="cd-section">
              <h4>투자 포트폴리오·전략 맵 <em>AI Investment Map</em></h4>
              {inv.strategy && <p className="cd-inv-strat">{inv.strategy}</p>}
              <div className="cd-inv-map">
                {order.map(id => {
                  const m = meta(id);
                  return (
                    <div className="cd-inv-col" key={id} style={{ "--accent": m.accent }}>
                      <div className="cd-inv-lhead"><span className="cd-inv-dot" style={{ background: m.accent }} /><b>{m.ko}</b><em>{byLayer[id].length}</em></div>
                      <div className="cd-inv-cards">
                        {byLayer[id].map((p, i) => (
                          <div className="cd-inv-card" key={i}>
                            <b>{p.name}</b>
                            {p.note && <span>{p.note}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="cd-cp-note">
                자사 컴퓨트·클라우드·앱으로 이어지는 밸류체인 계층별 지분 투자 맵. 지분·라운드는 공시·보도 기반 큐레이션이며, 최신 자본 활동은 위 ‘핵심 활동 분석’(크롤)이 보완.
                {inv.source && inv.source.url && (
                  <> · <a href={inv.source.url} target="_blank" rel="noopener">{inv.source.label || "출처"} <Icon name="ext" size={10} /></a></>
                )}
              </p>
            </div>
          );
        })()}

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
  const rawLines = Array.isArray(loc?.summaryLines) && loc.summaryLines.length >= 1
    ? loc.summaryLines
    : (item?.summaryLinesKo || (item?.sum ? [item.sum] : null));
  const lines = Array.isArray(rawLines)
    ? rawLines.map(line => safeDisplayString(line)).filter(Boolean)
    : null;
  const roles = Array.isArray(loc?.summaryRoles) && loc.summaryRoles.length
    ? loc.summaryRoles
    : (Array.isArray(item?.summaryRoles) ? item.summaryRoles : []);
  const localizedTitle = safeDisplayString(loc?.title || item?.titleKo);
  const originalTitle = safeDisplayString(item?.title);
  return {
    title: localizedTitle || originalTitle,
    summary: lines?.length ? lines.join("\n") : safeDisplayString(item?.summary || item?.desc),
    lines: lines || [],
    roles,
    translated: !!localizedTitle && loc?.status === "accepted" && loc?.displayLanguage === "ko",
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

  // 기사 삭제는 비밀번호 입력 시에만 동작(평문 미노출). 틀리면 삭제하지 않고 안내만 표시.
  const [pendingDel, setPendingDel] = React.useState(null);  // 비밀번호 입력 대기 중인 기사 key
  const [pwInput, setPwInput] = React.useState("");
  const [pwErr, setPwErr] = React.useState(false);
  const [selKey, setSelKey] = React.useState(null);   // 클릭 선택된 기사(외곽선 박스)
  const askDelete = (a) => { setPendingDel(keyOf(a)); setPwInput(""); setPwErr(false); };
  const cancelDelete = () => { setPendingDel(null); setPwInput(""); setPwErr(false); };
  const confirmDelete = (a) => {
    if (canDelete(pwInput)) { removeArticle(a); cancelDelete(); }
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
        {sorted.length === 0 && <SourcePipeline kind="signal" />}
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
          <p>3대 카테고리 기업별 핵심 가치 제안과 방향성</p>
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

// ---- Stock board: global AI + semiconductor value chains and China A-shares ----
function StockRegionPanel({ title, eyebrow, description, stocks, stockData, cats, groups, theme, defaultView = "group" }) {
  const catMap = Object.fromEntries((cats || []).map(c => [c.id, c]));
  const groupMap = Object.fromEntries((groups || []).map(g => [g.id, g]));
  const [ticker, setTicker] = React.useState((stocks[0] || {}).ticker);
  const [years, setYears] = React.useState(1);
  const [groupFilter, setGroupFilter] = React.useState("all");
  const [view, setView] = React.useState(defaultView);
  const ranges = [
    { value: 1 / 12, label: "1개월" },
    { value: 0.5, label: "6개월" },
    { value: 1, label: "1년" },
    { value: 5, label: "5년" },
    { value: 0, label: "전체" },
  ];
  const rangeLabel = (ranges.find(r => r.value === years) || ranges[2]).label;
  if (!stocks.length) return null;
  const sel = stocks.find(s => s.ticker === ticker) || stocks[0];
  const selGroup = groupMap[sel.group];
  const accent = (selGroup || catMap[sel.cat] || {}).accent || theme.accent;
  const real = (stockData && stockData[sel.ticker]) || null;
  const mcap = sel.private ? sel.mcap : (real && real.marketCap);
  const visibleStocks = groupFilter === "all" ? stocks : stocks.filter(s => s.group === groupFilter);
  const latestDates = stocks.map(stock => stockData?.[stock.ticker]?.asOf).filter(Boolean).sort();
  const latestDate = latestDates.at(-1) || "";
  const exchanges = [...new Set(stocks.map(stock => stock.exchange || stockData?.[stock.ticker]?.exchange).filter(Boolean))];

  return (
    <article className="stock-region" style={{ "--accent": accent }}>
      <div className="stock-region-head">
        <div>
          <span className="stock-region-eyebrow">{eyebrow}</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <div className="stock-region-metrics">
          <span><b>{stocks.length}</b>개 상장사</span>
          <span><b>{groups.length}</b>개 밸류체인</span>
          {latestDate && <span>기준 <b>{latestDate}</b></span>}
        </div>
      </div>

      <div className="stock-toolbar">
        <div className="stock-view-toggle">
          <button className={view === "group" ? "on" : ""} onClick={() => setView("group")}>밸류체인 그룹 트렌드</button>
          <button className={view === "single" ? "on" : ""} onClick={() => setView("single")}>개별 종목</button>
        </div>
        <div className="stock-range">
          {ranges.map(r => (
            <button key={r.label} className={years === r.value ? "on" : ""} onClick={() => setYears(r.value)}>{r.label}</button>
          ))}
        </div>
      </div>

      {view === "group" ? (
        <div className="stock-panel" style={{ "--accent": accent }}>
          <div className="stock-panel-head">
            <span className="sp-name">밸류체인 업종별 상대 추이</span>
            <span className="sp-cat" style={{ color: accent, background: (selGroup || {}).accentSoft }}>{rangeLabel} · 시작=100</span>
            <span className="sp-source">{exchanges.join(" · ")}</span>
          </div>
          <GroupTrendChart groups={groups} stocks={stocks} stockData={stockData} years={years} theme={theme} />
          <p className="stock-updated">조정종가 우선 · 그룹별 구성 종목을 기간 시작 100으로 재환산한 동일가중 추이 · 관측 기간이 부족한 신규 종목은 개별 시세에서 확인</p>
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
              <em>{s.exchange || s.name.replace(/\s*\(.*\)/, "")}</em>
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
          {real && <span className="sp-source">데이터 {String(real.source || "public feed").replace("yahoo-api", "Yahoo Finance").replace("yahoo-web", "Yahoo Finance")}</span>}
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
            asOf={real.asOf} currency={real.currency || "$"} accent={accent} ink={theme.ink} muted={theme.muted} grid={theme.grid} />
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
        <p className="stock-updated">Yahoo Finance 조정종가 우선 · Stooq·Nasdaq·StockAnalysis 공개 피드 폴백 · 기간 선택·크로스헤어 제공</p>
      </div>
      </React.Fragment>
      )}
    </article>
  );
}

function StockBoard({ stocks, stockData, cats, groups, sectionRef, theme, dataVersion }) {
  const inView = useInView(sectionRef);
  const STOCK_LAYER = window.DASH.STOCK_LAYER || {};
  const VC = window.DASH.VALUE_CHAIN || [];
  const generatedAt = stockData?.__generatedAt ? new Date(stockData.__generatedAt).toLocaleString("ko-KR") : "";

  // 변곡점 자동 설명(뉴스 크롤 근거) 로드 — 화면 진입 시 1회
  const [autoEv, setAutoEv] = React.useState(null);
  React.useEffect(() => {
    if (!inView || autoEv || !dataVersion) return;
    fetch(`stock-events.json?v=${encodeURIComponent(dataVersion)}`, { cache: "force-cache" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j && j.events) setAutoEv(j.events); })
      .catch(() => {});
  }, [inView, autoEv, dataVersion]);

  // 대시보드 리스트(밸류체인 기업)에 있는 상장사만 + 밸류체인 계층으로 그룹핑
  // + 에디토리얼 변곡점 설명(과거)과 뉴스 기반 자동 설명(최근)을 날짜별 병합(에디토리얼 우선)
  const dashStocks = (stocks || [])
    .filter(s => STOCK_LAYER[s.ticker])
    .map(s => {
      const merged = new Map();
      ((autoEv && autoEv[s.ticker]) || []).forEach(e => merged.set(e.date, e));
      (s.events || []).forEach(e => merged.set(e.date, e));   // 같은 날짜는 에디토리얼이 덮어씀
      const events = [...merged.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
      return { ...s, group: STOCK_LAYER[s.ticker], region: undefined, events };
    });
  const layers = VC.filter(l => dashStocks.some(s => s.group === l.id));

  return (
    <section className="board stock-board-rich" ref={sectionRef} data-screen-label="Stock Prices">
     <AnimCtx.Provider value={inView}>
      <div className="board-head stock-master-head" style={{ "--accent": theme.accent }}>
        <span className="board-tab" style={{ background: theme.accent }} />
        <div className="board-titles">
          <h2>주가 차트 <span className="board-en">Dashboard Companies · by AI Value Chain</span></h2>
          <p>대시보드 기업 리스트의 상장사만 · AI 밸류체인 계층별 그룹 비교 · 변곡점(급등·급락)은 뉴스 기반으로 '왜 올랐/빠졌는지' 자동 설명</p>
        </div>
        {generatedAt && <span className="stock-generated">마지막 수집<br /><b>{generatedAt}</b></span>}
      </div>

      <div className="stock-region-stack">
        <StockRegionPanel
          title="AI 밸류체인 상장사"
          eyebrow="DASHBOARD LISTED EQUITIES"
          description="대시보드 기업 리스트에 있는 상장사를 인프라·컴퓨트 / 파운데이션 모델 / 애플리케이션 등 밸류체인 계층으로 묶어 실제 일별 시세로 비교"
          stocks={dashStocks}
          stockData={stockData}
          cats={cats}
          groups={layers}
          theme={theme}
        />
      </div>
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
      metric: `$${market2026?.size || 540}B / $${market2030?.size || 1812}B`,
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
  { from: "NVIDIA", to: "OpenAI", type: "매출", label: "GPU 공급 · 매출" },
  { from: "NVIDIA", to: "Anthropic", type: "매출", label: "GPU 공급 · 매출" },
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
  { from: "OpenAI", to: "NVIDIA", type: "매출", label: "GPU 구매 · NVIDIA 매출" },
  { from: "Microsoft", to: "NVIDIA", type: "매출", label: "GPU 구매 · NVIDIA 매출" },
  { from: "Amazon", to: "NVIDIA", type: "매출", label: "GPU 구매 · NVIDIA 매출" },
  { from: "Meta AI", to: "NVIDIA", type: "매출", label: "GPU 구매 · NVIDIA 매출" },
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
                    <span>연결 기사 원문</span><b aria-hidden="true" />
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
  { name: "Microsoft", flow: ["기업 사용자", "M365·Copilot 구독($30/월)", "Azure AI 클라우드 과금", "AI 런레이트 $37B"], note: "오피스 번들 락인으로 좌석당 추가 과금과 클라우드 종량제를 결합" },
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
                {i < f.flow.length - 1 && <span className="btf-arr" aria-hidden="true" />}
              </React.Fragment>
            ))}
          </div>
          <p className="btf-note">{f.note}</p>
        </div>
      ))}
    </div>
  );
}

// 수직통합(모델사 자회사·합작) 신사업 트렌드 — 실사례 + 복제 경로. cats 의존 없이 재사용.
const VI_ACCENT = { native: "#7A38D6", datacenter: "#0891B2", device: "#16A34A", software: "#DB2777" };

// 두 플래그십 딜(OpenAI DeployCo / Anthropic JV) 상세 — 구조·수치·파트너·모델·기사·인사이트.
const NEWBIZ_DEALS = [
  {
    id: "openai-deployco", name: "OpenAI Deployment Company", accent: "#7A38D6",
    date: "2026.05.11", badge: "과반 지배 자회사",
    metrics: [
      ["조달·밸류", "40억달러+ 조달 · 법인가치 약 140억달러"],
      ["소유 구조", "OpenAI 과반 소유·지배(슈퍼보팅 주식) · 델라웨어 법인"],
      ["재무 투자자(19)", "TPG(주도) · Advent · Bain Capital · Brookfield · Dragoneer · SoftBank"],
      ["컨설팅 공동투자자", "McKinsey · Bain & Company · Capgemini(경쟁자에서 co-investor로 전환)"],
      ["수익 보장", "PE 백커에 5년간 연 17.5% 우선 수익 보장(우선주)"],
      ["창립 인수", "Tomoro(Edinburgh) 인수 · FDE ~150명 · 12개월 매출 10배"],
      ["Tomoro 고객", "Mattel · Red Bull · Tesco · NBA"],
      ["타깃 산업", "헬스케어 · 물류 · 제조 · 금융 · 리테일"],
    ],
    facts: [
      "모델 판매가 아니라 도입·구축·운영을 대행 — OpenAI 엔지니어가 기업 내부에 상주해 프로덕션 AI 시스템을 직접 구축",
      "PE 백커의 포트폴리오사를 전속 유통망(captive channel)으로 확보 — 대규모 영업 없이 수백 개 기업에 배포 경로 확보",
      "McKinsey·Bain·Capgemini를 경쟁자가 아닌 공동투자자로 편입해 컨설팅 채널까지 흡수",
    ],
    insight: "모델 커모디티화에 대비해 마진이 남는 '배포·서비스' 계층을 직접 장악. PE 자금으로 자본 리스크를 분산하고, 백커의 포트폴리오사를 captive 유통망으로 쓰는 무거운(지배형) 수직통합.",
    articles: [
      { t: "OpenAI Launches $4B Deployment Company With TPG, Buys Tomoro", s: "Let's Data Science", u: "https://letsdatascience.com/blog/openai-deployment-company-4b-tpg-tomoro-may-11-2026" },
      { t: "OpenAI Deployment Company: $4B Enterprise AI Push", s: "Digital Applied", u: "https://www.digitalapplied.com/blog/openai-deployment-company-4b-enterprise-push" },
      { t: "OpenAI Finalizes ~$14B Venture With PE Firms to Deploy AI", s: "Bloomberg", u: "https://www.bloomberg.com/news/articles/2026-05-04/openai-finalizes-10-billion-joint-venture-with-pe-firms-to-deploy-ai" },
      { t: "OpenAI Launches $4B Deployment Venture, Recruits McKinsey·Capgemini", s: "TechTimes", u: "https://www.techtimes.com/articles/316726/20260516/openai-launches-4-billion-enterprise-ai-deployment-venture-recruits-mckinsey-capgemini.htm" },
    ],
  },
  {
    id: "anthropic-jv", name: "Anthropic Enterprise AI Services Company", accent: "#DB2777",
    date: "2026.05.04", badge: "소수지분 합작(JV)",
    metrics: [
      ["공식 확인", "Anthropic·Blackstone·H&F·Goldman Sachs 공동 설립 발표"],
      ["자본·소유 구조", "세부 금액·지분율은 공식 발표와 제3자 보도를 구분해 확인"],
      ["창립 파트너", "Blackstone · Hellman & Friedman · Goldman Sachs"],
      ["추가 백커", "Apollo · General Atlantic · GIC · Leonard Green · Sequoia"],
      ["인력", "Anthropic Applied AI 인력과 신설 회사 엔지니어가 공동 작업"],
      ["FDE 명칭·딜리버리", "Applied AI Engineer가 고객사에 상주해 밑바닥부터 커스텀 AI 시스템 구축"],
      ["타깃 산업", "금융·헬스케어·법률·정부 등 규제 산업(PE 보유 중견기업)"],
    ],
    facts: [
      "핵심 주장: '엔터프라이즈 AI의 가치는 모델이 아니라 구현(implementation)에 있다' — Claude를 핵심 업무에 직접 이식",
      "목표는 라이선스 판매가 아니라 '핵심 비즈니스 프로세스 재설계 + 프로덕션 시스템 구축' — PoC에서 실서비스로 전환",
      "Wipro·Cognizant·ServiceNow·phData 등 SI 파트너가 Claude FDE를 대량 훈련·공급해 배포 인력을 확장",
      "Anthropic은 5월 4일, OpenAI는 5월 11일 발표했으며 지배구조는 소수지분과 과반 지배로 정반대",
    ],
    insight: "자본·지배는 덜 쥐고 파트너십으로 확장하는 가벼운 수직통합. 안전성 브랜드 + 규제산업 침투 + SI 파트너 FDE 풀로 배포를 스케일 — OpenAI보다 자본 부담이 작은 구조.",
    articles: [
      { t: "Anthropic and Blackstone's $1.5B JV 'Ode' bets AI value lives in implementation, not models", s: "MarketScale", u: "https://www.marketscale.com/industries/software-and-technology/anthropic-and-blackstones-15b-joint-venture-ode-bets-enterprise-ai-value-lives-in-implementation-not-models" },
      { t: "Building a new enterprise AI services company (공식 발표)", s: "Anthropic", u: "https://www.anthropic.com/news/enterprise-ai-services-company" },
      { t: "Anthropic teams with Goldman, Blackstone on $1.5B AI venture targeting PE-owned firms", s: "CNBC", u: "https://www.cnbc.com/2026/05/04/anthropic-goldman-blackstone-ai-venture.html" },
      { t: "Anthropic's Applied AI Engineers: The Forward-Deployed Function Behind Claude", s: "Perspective AI", u: "https://getperspective.ai/blog/anthropic-applied-ai-engineers-forward-deployed-claude-enterprise" },
      { t: "Anthropic takes shot at consulting industry in JV with Wall Street giants", s: "Fortune", u: "https://fortune.com/2026/05/04/anthropic-claude-consulting-industry-joint-venture-blackstone-goldman-sachs/" },
    ],
  },
];

function NewBizDeepDive() {
  return (
    <div className="nbz-deep">
      <div className="nbz-deep-head">
        <h3>배포·AI서비스 딜 — 모델사가 'AI 서비스 회사'를 직접 세운다</h3>
        <p>Anthropic은 2026년 5월 4일, OpenAI는 5월 11일 엔터프라이즈 AI 배포 회사를 각각 발표했다. <b>7일 간격</b>의 두 발표는 현장 배포를 수익화한다는 공통점과 지배 구조의 차이를 함께 보여준다.</p>
      </div>
      <div className="nbz-deals">
        {NEWBIZ_DEALS.map(d => (
          <div className="nbz-deal" key={d.id} style={{ "--dc": d.accent }}>
            <div className="nbz-deal-head">
              <span className="nbz-badge">{d.badge}</span>
              <span className="nbz-date">{d.date}</span>
            </div>
            <h4 className="nbz-name">{d.name}</h4>
            <div className="nbz-metrics">
              {d.metrics.map(([k, v], i) => (
                <div className="nbz-metric" key={i}><em>{k}</em><span>{v}</span></div>
              ))}
            </div>
            <ul className="nbz-facts">
              {d.facts.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
            <p className="nbz-insight"><b>인사이트</b> {d.insight}</p>
            <div className="nbz-arts">
              <em>관련 기사</em>
              <ul>
                {d.articles.map((a, i) => (
                  <li key={i}><a href={a.u} target="_blank" rel="noopener">{a.t}</a><span>{a.s}</span></li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
      <div className="nbz-market">
        <div className="nbz-market-row">
          <span className="nbz-market-k">AI 컨설팅·서비스 시장</span>
          <span className="nbz-market-v">2030년 <b>약 195억달러</b>(CAGR 21.4%) · 2032년 <b>491억달러</b>(CAGR 24.1%) · 2033년 <b>2,150억달러</b> 전망</span>
        </div>
        <p className="nbz-market-note">기존 강자 Accenture·Deloitte·McKinsey·BCG·Palantir가 장악하던 도입·구축 시장을, 모델사가 <b>포워드 디플로이드 엔지니어</b> 모델로 직접 파고드는 구도. 출처: <a href="https://www.globenewswire.com/de/news-release/2025/08/06/3128409/0/en/AI-Consulting-Services-Market-Size-to-Hit-USD-49-11-Billion-by-2032-Driven-by-Enterprise-AI-Adoption-Custom-Strategy-and-Regulatory-Demand-SNS-Insider.html" target="_blank" rel="noopener">SNS Insider</a> · <a href="https://www.fortunebusinessinsights.com/ai-consulting-services-market-111179" target="_blank" rel="noopener">Fortune Business Insights</a></p>
      </div>
      <div className="nbz-take">
        <div className="nbz-take-col">
          <em>공통점</em>
          <ul>
            <li>7일 간격으로 발표 · Wall Street·PE 자본 동원</li>
            <li>Palantir式 포워드 디플로이드 엔지니어 — 고객사 상주</li>
            <li>백커의 포트폴리오사를 전속 유통망으로 확보</li>
            <li>모델에서 서비스까지 수직통합해 도입·운영 마진 장악</li>
          </ul>
        </div>
        <div className="nbz-take-col">
          <em>차이</em>
          <ul>
            <li>OpenAI = 과반 지배 · 법인가치 ~140억달러 · 연 17.5% 수익 보장 · 무거운 수직통합</li>
            <li>Anthropic 신설 서비스 회사 = 금융 파트너 유통망 + Applied AI 인력의 파트너십형</li>
            <li>OpenAI는 컨설팅사까지 co-investor로 흡수 / Anthropic은 컨설팅과 직접 경쟁</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// AI 컨설팅·엔터프라이즈 구축 신사업 — 시장 계층·FDE 경제학·경쟁 지형·수요 실증·과금 모델·진입 플레이북.
const ACB_LAYERS = [
  { k: "엔터프라이즈 에이전틱 AI", v: "$6.8B(2025) / $46B(2030)", g: "CAGR 47%", src: "MarketsandMarkets", u: "https://www.marketsandmarkets.com/Market-Reports/enterprise-agentic-ai-market-219711254.html" },
  { k: "AI 컨설팅·서비스", v: "$49B(2032) · $215B(2033)", g: "CAGR ~24%", src: "SNS Insider", u: "https://www.globenewswire.com/de/news-release/2025/08/06/3128409/0/en/AI-Consulting-Services-Market-Size-to-Hit-USD-49-11-Billion-by-2032-Driven-by-Enterprise-AI-Adoption-Custom-Strategy-and-Regulatory-Demand-SNS-Insider.html" },
  { k: "배포 모델 구성", v: "Ready-to-deploy(최대 점유)·Build-your-own(최고 성장)·SI", g: "커스텀 수요 급증", src: "Grand View", u: "https://www.grandviewresearch.com/industry-analysis/enterprise-agentic-ai-market-report" },
];
const ACB_CAMPS = [
  { name: "모델사 — OpenAI·Anthropic", accent: "#7A38D6", pts: ["FDE로 배포계층 직접 진입", "PE 백커의 포트폴리오사를 전속 유통망으로", "모델 마진 + 서비스 마진 동시 확보"] },
  { name: "전통 SI·컨설팅 — Accenture·Deloitte·McKinsey·BCG", accent: "#0891B2", pts: ["대규모 인력·기존 고객 관계가 해자", "AI·데이터 인력 7.7만명(2년새 2배)", "리스크: 인재 유출(이직률 14%)·서비스 마진 압박"] },
  { name: "Palantir — FDE 원조", accent: "#DB2777", pts: ["FDE 플레이북 원조 · 플랫폼으로 재사용", "정부 앵커 + 상업 옵셔널리티", "FDE 모델로 640% 주가 수익 실적"] },
];
const ACB_PROOF = [
  ["누적 AI 부킹", "$11.5B"], ["누적 AI 매출", "$4.8B"], ["Q1 FY26 부킹", "$2.2B · +76%"],
  ["Q1 FY26 매출", "$1.1B · +120%"], ["대형딜 AI 침투", "80%"], ["AI·데이터 인력", "77,000명"],
];
const ACB_BMODELS = [
  ["임베디드 FDE(포워드 디플로이드)", "선투자 배포비로 무제한·확장 토큰/소비 annuity 확보", "OpenAI DeployCo · Anthropic JV · Palantir", "온디바이스·기업 fleet에 상주 엔지니어 조직"],
  ["아웃컴·성과 기반", "ROI·절감액 연동 성공보수", "에이전트 전환율 4~7배 · 비용 70%↓ · ROI 171%", "검증 쉬운 버티컬부터 성공보수형 도입"],
  ["Ready-to-deploy 에이전트", "구독·시트·사용량(반복 매출)", "CS·영업·데이터 자동화 기성 에이전트", "단말 기본 탑재 에이전트를 구독화"],
  ["Build-your-own 플랫폼", "플랫폼 라이선스 + 사용량", "도메인 특화 커스텀 에이전트(최고 성장)", "파트너·기업이 온디바이스 에이전트 제작"],
  ["SI·구축 프로젝트", "프로젝트 피 + 유지보수 리테이너", "Accenture·Deloitte·McKinsey", "기기 fleet AI 전환 구축 수주"],
];

function AIConsultingBuildSection() {
  return (
    <div className="acb">
      <div className="acb-head">
        <h3>AI 컨설팅·엔터프라이즈 구축 시장 — 규모·경쟁·과금</h3>
        <p>모델은 커모디티화되고, 돈은 '기업이 AI를 실제로 돌리게 만드는' 도입·구축·운영(deployment) 계층으로 이동한다. 계층별 시장 규모·경쟁 지형·수요 실증·과금 구조.</p>
      </div>

      <div className="acb-grid3">
        {ACB_LAYERS.map((l, i) => (
          <div className="acb-card acb-layer" key={i}>
            <em className="acb-layer-k">{l.k}</em>
            <b className="acb-layer-v">{l.v}</b>
            <span className="acb-layer-g">{l.g}</span>
            <a className="acb-src" href={l.u} target="_blank" rel="noopener">{l.src}</a>
          </div>
        ))}
      </div>

      <div className="acb-camps">
        {ACB_CAMPS.map((c, i) => (
          <div className="acb-card acb-camp" key={i} style={{ "--dc": c.accent }}>
            <b className="acb-camp-name">{c.name}</b>
            <ul>{c.pts.map((p, j) => <li key={j}>{p}</li>)}</ul>
          </div>
        ))}
      </div>

      <div className="acb-proof">
        <div className="acb-proof-head"><b>수요 실증 — Accenture AI 지표</b><span>서비스 계층에 실제 돈이 흐른다는 증거(FY2026)</span></div>
        <div className="acb-proof-grid">
          {ACB_PROOF.map(([k, v], i) => (
            <div className="acb-proof-cell" key={i}><span>{k}</span><b>{v}</b></div>
          ))}
        </div>
        <p className="acb-proof-note">출처: <a href="https://www.ciodive.com/news/accenture-generative-ai-revenue-skills-training-data-modernization/761161/" target="_blank" rel="noopener">CIO Dive</a> · <a href="https://phemex.com/academy/accenture-acn-stock-2026" target="_blank" rel="noopener">Accenture FY26 실적</a> — 에이전틱 AI ROI 171%·비용 70%↓·전환율 4~7배(<a href="https://www.marketsandmarkets.com/Market-Reports/enterprise-agentic-ai-market-219711254.html" target="_blank" rel="noopener">MarketsandMarkets</a>)</p>
      </div>

      <div className="pricing-tracker acb-bm">
        <div className="pt-head"><h3>서비스 신사업 과금 모델 — 어떻게 돈을 버나</h3><span>도입·구축·운영을 수익화하는 5가지 구조와 단말 제조사 적용</span></div>
        <div className="pt-table">
          <div className="pt-row pt-hrow"><span>모델</span><span>과금 구조</span><span>대표 사례</span><span>단말 제조사 적용</span></div>
          {ACB_BMODELS.map((r, i) => (
            <div className="pt-row" key={i}>
              <span className="pt-model"><i style={{ background: VI_ACCENT.native }} />{r[0]}</span>
              <span className="pt-players">{r[1]}</span>
              <span className="pt-price">{r[2]}</span>
              <span className="pt-note">{r[3]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Forward-Deployed AI 모델 — 핵심 비즈니스 프로세스 재설계 + 프로덕션 시스템 구축을 목표로 하는 딜리버리 모델.
const FDA_STEPS = [
  { n: "01", k: "발굴 Discovery", d: "고객사와 인터뷰·현장 관찰로 진짜 병목과 고가치 프로세스를 식별" },
  { n: "02", k: "프로세스 재설계", d: "지식 노동의 흐름을 에이전트 중심으로 재구성 — 단순 자동화가 아닌 워크플로 재설계" },
  { n: "03", k: "구축 Build", d: "프롬프트·evals·가드레일 설계, 도메인 데이터로 커스텀 에이전트 개발" },
  { n: "04", k: "프로덕션 배포", d: "multi-week 스프린트로 상주하며 실서비스에 투입, 안전성·거버넌스 검증" },
  { n: "05", k: "운영·확장", d: "성과 측정·지속 개선, 인접 프로세스로 확장 — 소비·성과 기반으로 매출 증가" },
];
const FDA_NAMING = [
  ["Anthropic", "Applied AI Engineer", "안전성·리서치 문화 반영 · 규제산업(금융·헬스·법률·정부) 집중 · SI 파트너 FDE 풀로 확장", "#DB2777"],
  ["OpenAI", "Forward-Deployed Engineer / Deployment Co.", "과반 지배 자회사(법인가치 ~140억달러) · Tomoro 인수로 ~150명 · PE 포트폴리오 전속 유통", "#7A38D6"],
  ["Palantir", "Forward-Deployed Engineer(원조)", "정부 앵커 + 상업 확장 · 플랫폼(Foundry/AIP)으로 학습을 제품에 재사용", "#0891B2"],
];
const FDA_PARTNERS = [
  ["Wipro", "Applied AI CoE — Claude FDE 글로벌 인력풀 구축"],
  ["Cognizant", "Claude 도입 가속 · 대규모 엔터프라이즈 배포"],
  ["ServiceNow", "Claude로 업무 앱 구축 · 산업별 신뢰 AI 적용"],
  ["phData", "Claude 엔터프라이즈 배포 전문 파트너"],
];

function ForwardDeployedAIModel() {
  return (
    <div className="fda">
      <div className="fda-head">
        <h3>Forward-Deployed AI 모델 — 핵심 프로세스 재설계 + 프로덕션 시스템 구축</h3>
        <p>모델사·Palantir가 공유하는 배포 모델의 본질: 라이선스를 파는 게 아니라, 엔지니어가 고객사에 상주해 <b>핵심 비즈니스 프로세스를 재설계</b>하고 <b>실제 프로덕션 시스템을 구축</b>한다. 가치는 라이선스 수가 아니라 워크플로 재설계에서 나온다.</p>
      </div>

      <div className="fda-flow">
        {FDA_STEPS.map((s, i) => (
          <div className="fda-step" key={s.n}>
            <span className="fda-step-n">{s.n}</span>
            <b className="fda-step-k">{s.k}</b>
            <span className="fda-step-d">{s.d}</span>
            {i < FDA_STEPS.length - 1 && <span className="fda-arrow" aria-hidden="true" />}
          </div>
        ))}
      </div>

      <div className="acb-fde">
        <div className="acb-fde-head"><b>FDE 유닛 이코노믹스 — 왜 상주 비용이 정당화되나</b><span>선투자 배포비를 반복 소비 매출로 회수</span></div>
        <ul className="acb-fde-list">
          <li><em>위치</em>FDE는 로드맵 상류(upstream)에서 <b>내부 구축</b>, 컨설턴트는 계약 하류(downstream) — 제품 발굴 메커니즘도 겸함</li>
          <li><em>수익원</em>선투자 배포비용이 <b>좌석 구독이 아니라 무제한·확장되는 토큰/소비 annuity</b>를 산다 — 엔지니어가 소비를 극대화</li>
          <li><em>마진</em>Anthropic 추론 마진 <b>~70%</b>(전년 38% 대비 상승) — 고마진 반복 소비가 상주 비용을 정당화. 단 전문서비스가 매출 <b>18~20%</b>면 마진 희석 리스크</li>
          <li><em>실적</em>Palantir는 FDE 모델로 <b>640% 주가 수익</b> · 배포 학습을 플랫폼에 재사용해 다음 고객 비용을 절감</li>
        </ul>
      </div>

      <div className="pricing-tracker fda-naming">
        <div className="pt-head"><h3>3사 Forward-Deployed 직군 — 같은 모델, 다른 프레이밍</h3><span>명칭·전략 차이 · 본질은 '상주 구축'으로 동일</span></div>
        <div className="pt-table">
          <div className="pt-row pt-hrow fda-name-row"><span>주체</span><span>직군 명칭</span><span>전략 특징</span></div>
          {FDA_NAMING.map((r, i) => (
            <div className="pt-row fda-name-row" key={i}>
              <span className="pt-model"><i style={{ background: r[3] }} />{r[0]}</span>
              <span className="pt-players" style={{ color: r[3], fontWeight: 800 }}>{r[1]}</span>
              <span className="pt-note">{r[2]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="fda-partners">
        <div className="fda-partners-head"><b>파트너 FDE 생태계 — 배포 인력의 대량 확장</b><span>SI·컨설팅 파트너가 Claude FDE를 훈련·공급해 상주 배포를 스케일아웃</span></div>
        <div className="fda-partners-grid">
          {FDA_PARTNERS.map((p, i) => (
            <div className="fda-partner" key={i}><b>{p[0]}</b><span>{p[1]}</span></div>
          ))}
        </div>
        <p className="fda-partners-note">출처: <a href="https://getperspective.ai/blog/anthropic-applied-ai-engineers-forward-deployed-claude-enterprise" target="_blank" rel="noopener">Perspective AI</a> · <a href="https://www.wipro.com/newsroom/press-releases/2026/wipro-advances-enterprise-ai-leadership-with-an-applied-ai-center-of-excellence-for-claude-models-powered-by-anthropic/" target="_blank" rel="noopener">Wipro</a> · <a href="https://www.phdata.io/partners/anthropic/" target="_blank" rel="noopener">phData</a> · <a href="https://www.mindstudio.ai/blog/palantir-forward-deployed-engineer-model-anthropic-openai" target="_blank" rel="noopener">MindStudio</a></p>
      </div>
    </div>
  );
}

function VerticalIntegrationTables() {
  const paths = [
    { who: "파운데이션 모델사", how: "자회사·분사(spin-off)로 앱·소비자/기업 서비스를 모델 위에 직접 구축", asset: "최신 모델·추론 원가·연구 인재", impl: "가장 빠르게 앱 계층까지 장악 — 단말은 이 계층에 종속되지 않도록 자체 서비스 축 필요", tone: "native" },
    { who: "클라우드·플랫폼", how: "모델 호스팅 + 버티컬 SaaS를 사내/합작으로 병행(멀티모델 중립)", asset: "컴퓨트·유통·기업 고객 계약", impl: "인프라는 빌려 쓰되, 사용자 접점·과금은 단말이 직접 소유해야 마진 확보", tone: "datacenter" },
    { who: "단말 제조사(우리)", how: "온디바이스 AI + 버티컬 서비스를 자회사·조인트벤처로 분리 구축(오픈모델·파트너 모델 병용)", asset: "단말·OS·유통·결제·개인 컨텍스트 데이터", impl: "역방향 통합(단말에서 서비스로): 배포·과금 채널이 이미 있어 모델만 조달하면 수직통합 성립", tone: "device" },
    { who: "버티컬 SaaS·스타트업", how: "특정 도메인(법률·의료·CS)에 파운데이션 모델을 얹어 성과기반 과금", asset: "도메인 데이터·워크플로 락인", impl: "인수·지분투자·번들 탑재로 단말 서비스 포트폴리오를 빠르게 확장하는 통로", tone: "software" },
  ];
  return (
    <React.Fragment>
      <div className="pricing-tracker">
        <div className="pt-head"><h3>수직통합 복제 경로 — 모델사의 '자체 서비스화'를 누가 어떻게 따라 하나</h3><span>OpenAI·Anthropic의 자회사·분사형 버티컬 AI 서비스 진입에 대응하는 4개 주체별 진입 방식</span></div>
        <div className="pt-table">
          <div className="pt-row pt-hrow"><span>주체 유형</span><span>복제 방식</span><span>핵심 자산·해자</span><span>단말 제조사 시사점</span></div>
          {paths.map((r, i) => {
            const ac = VI_ACCENT[r.tone] || "var(--accent)";
            return (
              <div className="pt-row" key={i}>
                <span className="pt-model"><i style={{ background: ac }} />{r.who}</span>
                <span className="pt-players">{r.how}</span>
                <span className="pt-price">{r.asset}</span>
                <span className="pt-note">{r.impl}</span>
              </div>
            );
          })}
        </div>
        <p className="pt-foot"><b>핵심:</b> 모델사는 모델에서 앱으로 내려오고, 단말 제조사는 단말에서 서비스로 올라가는 <b>역방향 수직통합</b>이 가능하다. 파운데이션 모델을 직접 만들 필요 없이 <b>오픈모델·파트너 모델을 조달</b>하고, 이미 보유한 <b>배포·결제 채널과 온디바이스 개인 컨텍스트</b>를 해자로 삼아 <b>자회사·합작</b> 구조로 리스크를 격리하며 버티컬 AI 서비스를 신사업화할 수 있다.</p>
      </div>
    </React.Fragment>
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
        <h3 className="btf-h">빅테크 머니 플로우 <em>고객 · 제공가치 · 과금 · 회수 구조</em></h3>
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
      <VerticalIntegrationTables />
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
          <b>핵심 변화 (Δ {revMonths[0]} / {revMonths[revMonths.length - 1]}):</b>
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
  const confirmDel = (id) => { if (!canDelete(pw)) { setPwErr(true); return; } setDel(d => { const x = { ...d, [id]: 1 }; try { localStorage.setItem(DEL_LS, JSON.stringify(x)); } catch {} return x; }); setPend(null); setPw(""); setPwErr(false); };
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
  const seenSourceKeys = new Set();
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
    .filter(Boolean)
    // 같은 기사가 URL 표기 차이(끝 슬래시·쿼리 등)로 중복 저장되어도 한 번만 노출 — 정규화 키로 MECE 보장
    .filter(it => {
      const key = signalSourceKey(it.url);
      if (seenSourceKeys.has(key)) return false;
      seenSourceKeys.add(key);
      return true;
    });
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

      {!data || !sourceReady || items.length === 0 ? (
        <SourcePipeline kind="signal" />
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

// AI 수익화 플레이북 — 기업별 ①수익모델 ②BM 신호 ③투자·사업 방향을 크롤 기사로 누적.
// monetization.json(crawl-monetization.mjs) 소비. 표시는 원문 확인(한국어 3줄) 기사만.
function MonetizationPlaybook({ articles, dataVersion }) {
  const ref = React.useRef(null);
  const inView = useInView(ref);
  const [data, setData] = React.useState(null);
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    if (!inView || loaded || !dataVersion) return;
    setLoaded(true);
    fetch(`monetization.json?v=${encodeURIComponent(dataVersion)}`, { cache: "force-cache" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j && Array.isArray(j.companies)) setData(j); })
      .catch(() => {});
  }, [inView, loaded, dataVersion]);

  // 원문 확인(한국어 3줄) 기사 인덱스 — SignalInfographic과 동일 게이트
  const srcByUrl = React.useMemo(() => {
    const idx = new Map();
    (articles || []).forEach(a => {
      const loc = a?.localization, key = signalSourceKey(a?.url);
      if (key && loc?.status === "accepted" && loc?.displayLanguage === "ko"
        && Array.isArray(loc.summaryLines) && loc.summaryLines.length === 3) idx.set(key, a);
    });
    return idx;
  }, [articles]);

  const VC = window.DASH.VALUE_CHAIN || [];
  const models = (data && data.models) || [];
  const directions = (data && data.directions) || [];
  const professionalAccents = {
    vertical: "#66558C", subscription: "#397A68", usage: "#3E648D",
    ads: "#A56A35", hardware: "#6E607D", outcome: "#8B5366", enterprise: "#287A78",
    ma: "#6E607D", invest: "#397A68", expand: "#3E648D", partner: "#A56A35",
  };
  const modelMeta = id => {
    const meta = models.find(m => m.id === id) || { ko: id };
    return { ...meta, accent: professionalAccents[id] || "#647487" };
  };
  const dirMeta = id => {
    const meta = directions.find(d => d.id === id) || { ko: id };
    return { ...meta, accent: professionalAccents[id] || "#647487" };
  };
  const layerMeta = id => VC.find(l => l.id === id) || { ko: id, accent: "#8A93A4" };

  const resolve = sig => {
    const src = srcByUrl.get(signalSourceKey(sig.url));
    if (!src) return null;
    const disp = displayFeedText(src);
    if (!disp.translated || !disp.title) return null;
    return { ...sig, koTitle: disp.title };
  };
  const companies = ((data && data.companies) || []).map(c => {
    const seen = new Set();
    const uniq = arr => (arr || []).map(resolve).filter(Boolean).filter(s => {
      const k = signalSourceKey(s.url); if (seen.has(k)) return false; seen.add(k); return true;
    });
    const monetize = uniq(c.monetize).slice(0, 3);
    const direction = uniq(c.direction).slice(0, 3);
    const mix = {}; monetize.forEach(s => { if (s.model) mix[s.model] = (mix[s.model] || 0) + 1; });
    const modelMix = Object.entries(mix).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n }));
    return { ...c, monetize, direction, modelMix };
  }).filter(c => c.monetize.length || c.direction.length);
  const evidenceCount = new Set(companies.flatMap(company =>
    [...company.monetize, ...company.direction].map(signal => signal.url).filter(Boolean)
  )).size;

  const sourceReady = Array.isArray(articles) && articles.length > 0;
  // 돈 버는 모델(비즈니스 모델)별 그룹핑 — 밸류체인이 아니라 수익모델 기준.
  const MODEL_DESC = {
    vertical: "모델사가 자회사·분사로 서비스에 직접 진입 — 배포·AI서비스(수직통합)",
    subscription: "월정액·좌석당 구독(SaaS) — 반복 매출",
    usage: "사용량·API·토큰당 종량 과금",
    ads: "광고·거래 수수료·커머스 중개",
    hardware: "기기·단말 판매·번들",
    outcome: "해결 건당·성과(아웃컴) 기반 과금",
    enterprise: "엔터프라이즈 라이선스·기업 계약·소버린",
  };
  const withPrimary = companies.map(c => ({ ...c, primaryModel: (c.modelMix[0] && c.modelMix[0].id) || null }));
  const byModel = {};
  withPrimary.forEach(c => { const k = c.primaryModel || "_dir"; (byModel[k] = byModel[k] || []).push(c); });
  const modelOrder = models.map(m => m.id).filter(id => byModel[id]);
  if (byModel["_dir"]) modelOrder.push("_dir");

  return (
    <div className="mplay" ref={ref}>
      <div className="infra-sig-head">
        <div className="isg-titles">
          <h3>AI 비즈니스 모델 — 돈 버는 방식별 업체 <em>기사 기반 자동 누적 · 매일 갱신</em></h3>
          <p>밸류체인이 아니라 <b>돈 버는 모델(비즈니스 모델)</b> 기준으로 분류 — 각 모델을 하는 업체와 그들이 실제로 하는 것(크롤 신호). <b>배포·AI서비스(수직통합)</b>도 그 중 하나. 원문 확인(한국어 3줄) 기사만 누적</p>
        </div>
        <span className="isg-total">기업 <b>{companies.length}</b></span>
      </div>
      {(!data || !sourceReady || companies.length === 0) ? (
        <SourcePipeline kind="signal" />
      ) : (
        <React.Fragment>
          <div className="mplay-framework" aria-label="AI 비즈니스 모델 분석 구조">
            <div className="mplay-framework-head">
              <span>STRATEGY EVIDENCE ARCHITECTURE</span>
              <b>원문 근거를 수익 구조와 사업 방향으로 연결</b>
              <p>동일 기사는 한 번만 반영하고, 기업별 수익모델과 실행 방향을 분리해 비교</p>
            </div>
            <div className="mplay-framework-flow">
              <div style={{ "--step": "0" }}><em>01</em><span>FACT BASE</span><b>원문 기사</b><small>{evidenceCount}건 고유 근거</small></div>
              <i aria-hidden="true" />
              <div style={{ "--step": "1" }}><em>02</em><span>REVENUE ENGINE</span><b>수익 구조</b><small>{models.length}개 과금 모델</small></div>
              <i aria-hidden="true" />
              <div style={{ "--step": "2" }}><em>03</em><span>EXECUTION VECTOR</span><b>사업 실행</b><small>{directions.length}개 실행 유형</small></div>
              <i aria-hidden="true" />
              <div style={{ "--step": "3" }}><em>04</em><span>COMPANY VIEW</span><b>기업 전략</b><small>{companies.length}개사 비교</small></div>
            </div>
          </div>
          <div className="mplay-legend">
            {models.map(m => {
              const meta = modelMeta(m.id);
              return <span key={m.id} className="mplay-lg"><i style={{ background: meta.accent }} />{m.ko}</span>;
            })}
          </div>
          {modelOrder.map(mid => {
            const isDir = mid === "_dir";
            const mm = isDir ? { ko: "사업 실행", accent: "#8A93A4" } : modelMeta(mid);
            const desc = isDir ? "투자·제품·제휴 실행" : (MODEL_DESC[mid] || "");
            return (
              <div className="mplay-layer" key={mid} style={{ "--accent": mm.accent }}>
                <div className="mplay-lhead"><span className="mplay-ldot" style={{ background: mm.accent }} /><b>{mm.ko}</b>{desc && <em className="mplay-ldesc">{desc}</em>}<span className="mplay-ln">{byModel[mid].length}개사</span></div>
                <div className="mplay-grid">
                  {byModel[mid].map(c => (
                    <div className="mplay-card" key={c.name}>
                      <div className="mplay-c-head"><b>{c.name}</b><span className="mplay-vert">{c.vchainVertical || c.vertical}</span></div>
                      {c.modelMix.length > 0 && (
                        <div className="mplay-mix">
                          {c.modelMix.map(m => { const mm = modelMeta(m.id); return <span key={m.id} className="mplay-model" style={{ "--c": mm.accent }} title={mm.ko}>{mm.ko}<i>{m.n}</i></span>; })}
                        </div>
                      )}
                      {c.monetize.length > 0 && (
                        <div className="mplay-sec">
                          <h5>돈 버는 방식</h5>
                          {c.monetize.map((s, i) => { const mm = modelMeta(s.model); return (
                            <a className="mplay-sig" key={"m" + i} href={s.url} target="_blank" rel="noopener">
                              <span className="mplay-tag" style={{ "--c": mm.accent }}>{mm.ko}</span>
                              <span className="mplay-txt">{s.koTitle}</span>
                              <em>{s.source}{s.date ? " · " + String(s.date).slice(5) : ""}</em>
                            </a>
                          ); })}
                        </div>
                      )}
                      {c.direction.length > 0 && (
                        <div className="mplay-sec">
                          <h5>투자·사업 방향</h5>
                          {c.direction.map((s, i) => { const dm = dirMeta(s.kind); return (
                            <a className="mplay-sig" key={"d" + i} href={s.url} target="_blank" rel="noopener">
                              <span className="mplay-tag dir" style={{ "--c": dm.accent }}>{dm.ko}</span>
                              <span className="mplay-txt">{s.koTitle}</span>
                              <em>{s.source}{s.date ? " · " + String(s.date).slice(5) : ""}</em>
                            </a>
                          ); })}
                        </div>
                      )}
                    </div>
                  ))}
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
    <section className="board signal-source-board" ref={sectionRef} data-screen-label="AI SW and services tech signals">
      <AnimCtx.Provider value={inView}>
        <div className="board-head">
          <span className="board-tab" style={{ background: "#315C4A" }} />
          <div className="board-titles">
            <h2>AI SW·서비스 기술 시그널 <span className="board-en">AI Software & Services · 휴대폰 신사업 관점</span></h2>
            <p>반도체·데이터센터 하드웨어가 아니라 <b>단말에 올릴 만한 AI SW·서비스</b> — 온디바이스·에이전트·멀티모달 기능·OS/앱 통합·AI 서비스(수익화) 신호를 원문 확인 기사에서 누적</p>
          </div>
        </div>
        <SignalInfographic file="infra-view.json" delKey="aiDashDeletedInfra" articles={articles}
          dataVersion={dataVersion} title="AI SW·서비스 기술 신호" sub="온디바이스·에이전트·멀티모달·OS 통합·AI 서비스 — 원문 문장으로 확인된 카드만 표시" />
      </AnimCtx.Provider>
    </section>
  );
}

// AI 신사업 발굴 — 수직통합 실사례·플래그십 딜·Forward-Deployed AI 모델·컨설팅/구축 시장을 한 탭에 모음.
function NewBizBoard({ sectionRef, articles, dataVersion }) {
  const inView = useInView(sectionRef);
  return (
    <section className="board signal-source-board" ref={sectionRef} data-screen-label="AI New Business">
      <AnimCtx.Provider value={inView}>
        <div className="board-head" style={{ "--accent": "#16A34A" }}>
          <span className="board-tab" style={{ background: "#16A34A" }} />
          <div className="board-titles">
            <h2>AI 비즈니스 모델 <span className="board-en">AI Business Models · How Companies Make Money</span></h2>
            <p>AI로 돈 버는 비즈니스 모델 <b>전체</b> — 각 업체가 실제로 하는 것을 크롤 기사로 정리·매일 갱신. 아래 <b>배포·AI서비스(수직통합)</b>는 그 중 <b>한 가지 예시</b>.</p>
          </div>
        </div>

        {/* 1) AI 비즈니스 모델 전체 — 기업별 수익모델·활동 + 7개 수익화 유형(모두 크롤 기반) */}
        <MonetizationPlaybook articles={articles} dataVersion={dataVersion} />
        <SignalInfographic file="bizmodel-view.json" delKey="aiDashDeletedBiz" articles={articles}
          dataVersion={dataVersion} title="수익화 유형별 신호 — 7개 비즈니스 모델" sub="수직통합·구독·사용량·광고/커머스·하드웨어·성과기반·엔터프라이즈 — 원문 확인 카드만 누적 표시" />

        {/* 2) 한 단계 아래 — 비즈니스 모델 심화 예시: 배포·AI서비스(수직통합) */}
        <div className="nb-example-head">
          <span className="nb-example-badge">예시 · 밸류체인 L5</span>
          <div>
            <h3>배포·AI서비스(수직통합) <em>Deployment & Services</em></h3>
            <p>위 비즈니스 모델 중 하나 — 모델사가 자회사·합작으로 서비스에 직접 진입하는 수직통합 딜·Forward-Deployed AI 모델·컨설팅/구축 시장·단말 제조사 진입 전략</p>
          </div>
        </div>
        <NewBizDeepDive />
        <ForwardDeployedAIModel />
        <AIConsultingBuildSection />
        <VerticalIntegrationTables />
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
      fact: `${capexPrev.year || "직전"} ${capexPrev.size ? `$${capexPrev.size}B` : "—"} · ${capexNow.year || "최신"} ${capexNow.size ? `$${capexNow.size}B` : "—"} · ${capexNow.growth ? `성장률 ${capexNow.growth}%` : ""}`,
      insight: "전력·부지·메모리 조달이 투자 집행을 따라가는지 공급 제약을 별도 점검",
      src: capexNow.src,
    },
    {
      no: "02", label: "MEMORY", metric: hbmNow.size ? `$${hbmNow.size}B` : "—",
      fact: `${hbmNow.year || "최신"} ${hbmNow.size ? `$${hbmNow.size}B` : "—"} · ${hbmNext.year || "다음"} ${hbmNext.size ? `$${hbmNext.size}B` : "—"} · ${hbmNow.growth ? `성장률 ${hbmNow.growth}%` : ""}`,
      insight: "메모리 확보 시점이 모델 배포와 서버 증설의 선행 지표인지 확인",
      src: hbmNow.src,
    },
    {
      no: "03", label: "COMPUTE", metric: chipNow.custom != null ? `${chipNow.custom}%` : "—",
      fact: `${chipNow.period || "최신"} 커스텀 실리콘 ${chipNow.custom ?? "—"}% · ${chipNext.period || "다음"} ${chipNext.custom ?? "—"}%`,
      insight: "GPU 단일 조달이 아닌 멀티실리콘 호환성과 소프트웨어 이식성을 검토",
      src: chipNow.src,
    },
    {
      no: "04", label: "NETWORK", metric: opticalNext.pen != null ? `${opticalNext.pen}%` : "—",
      fact: `${opticalNow.year || "최신"} 침투율 ${opticalNow.pen ?? "—"}% · ${opticalNext.year || "전망"} ${opticalNext.pen ?? "—"}%`,
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
    if (!canDelete(rPw)) { setRPwErr(true); return; }
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
  const LABEL_COLOR = { "파트너십 기회": "#16A34A", "인수 후보": "#C026D3", "경쟁 위협": "#D23B3B", "시장 신호": "#2D6BFF", "공급망": "#EA580C", "규제": "#7A38D6", "사업 모델 검토": "#8A93A4" };
  return (
    <section className="board" ref={sectionRef} data-screen-label="Morning Briefing">
     <AnimCtx.Provider value={inView}>
      <div className="board-head" style={{ "--accent": "#2D6BFF" }}>
        <span className="board-tab" style={{ background: "#2D6BFF" }} />
        <div className="board-titles">
          <h2>모닝 브리핑 <span className="board-en">Weekly Synthesis · Signal · Insight · Action</span></h2>
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
  const LABEL_COLOR = { "파트너십 기회": "#16A34A", "인수 후보": "#C026D3", "사업 모델 검토": "#8A93A4" };
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
    if (!canDelete(pw)) { setPwErr(true); return; }
    setDelEs(d => { const n = { ...d, [k]: 1 }; try { localStorage.setItem(LS, JSON.stringify(n)); } catch {} return n; });
    setPend(null); setPw(""); setPwErr(false);
  };
  const usingLive = !!insights;
  const cards = (usingLive
    ? insights.cards.map(c => ({ tag: c.axisLabel, tone: c.tone, nav: c.nav, now: c.headline, cause: c.rootCause, decision: c.soWhat, action: c.action, evidence: c.evidence || [], digest: c.signalDigest || "", keywords: c.themeKeywords || [], signals: c.signals || [], score: c.score, scoreBasis: c.scoreBasis, live: c.live, updatedAt: c.updatedAt }))
    : (items || []).map(t => ({ tag: t.tag, tone: t.tone, nav: t.nav, now: t.now, cause: t.cause, decision: t.decision, action: t.action, evidence: [], digest: "", keywords: [], signals: [], score: null })))
    .filter(c => !delEs[c.tag]);
  if (!cards.length) return null;
  // 엔진 provenance 배지 — 사용자가 자동/규칙/시드 생성 여부를 즉시 판별
  const eng = (insights && insights.engine) || (usingLive ? "rules" : "seed");
  const ENGINE_BADGE = {
    "llm": { ko: "LLM 자동 생성", cls: "llm" }, "llm-gh": { ko: "LLM 자동 생성", cls: "llm" },
    "crawl-synthesis": { ko: "크롤 인사이트 종합", cls: "llm" },
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
          <p>매일 크롤한 원문 근거(복수 출처·반복 신호·추출 수치)를 종합해 사업적 의미와 다음 실행으로 구조화 — 고정 문구가 아닌 크롤 결과에 따라 갱신</p>
        </div>
        <div className="es-brief-note" title="상대 중요도 0~100 = 최신성 × 출처신뢰도 × 주제적합도">
          <strong>Evidence-led</strong>
          <span>{eb.ko} · 상대 중요도 기준</span>
        </div>
      </header>
      <div className="es-framework-key" aria-label="전략 브리프 읽는 순서">
        <span><b>01</b> FACT <em>원문 근거</em></span>
        <i className="es-key-arr" aria-hidden="true" />
        <span><b>02</b> IMPLICATION <em>사업 의미</em></span>
        <i className="es-key-arr" aria-hidden="true" />
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
                : (t.live === false && <span className="es-score base" title={t.scoreBasis || "화면 비노출 큐레이션 기준선"}>기준선</span>)}
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
              {t.digest && <div className="es-digest" title="당일 크롤 근거에서 집계 — 근거 건수·반복 신호·추출 수치(매일 갱신)">{t.digest}</div>}
              {t.evidence.length > 0 && (
                <div className="es-ev-row">
                  {t.evidence.slice(0, 3).map((e, k) => (
                    <a className="tl-ev-chip" key={k} href={e.url} target="_blank" rel="noopener">
                      <Icon name="news" size={10} /> {e.source}{e.date ? ` · ${fmtMonthDay(e.date)}` : ""}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <span className="es-arr" aria-hidden="true" />
            <div className="es-cell es-ins">
              {t.keywords && t.keywords.length > 0 && (
                <div className="es-kw-row">{t.keywords.map((k, j) => <span className="es-kw" key={j}>{k}</span>)}</div>
              )}
              {hlKey(t.decision)}
            </div>
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
function MarketBoard({ sectionRef, dataVersion, mode = "market" }) {
  const inView = useInView(sectionRef);
  const isSurvey = mode === "survey";
  const [data, setData] = React.useState(null);
  const [loaded, setLoaded] = React.useState(false);
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
  // 소비자 조사 / 시장 2개 축으로 분리(탭 자체가 필터). 크롤 누적 데이터를 type으로 나눠 표시.
  const scoped = records.filter(record => isSurvey ? record.type === "consumer-survey" : record.type !== "consumer-survey");
  const sourceCount = new Set(scoped.map(record => record.sourceUrl)).size;
  const quantityCount = scoped.reduce((count, record) => count + new Set(record.sourceQuantities || []).size, 0);
  const shownRecords = scoped.slice()
    .sort((a, b) => String(b.publishedAt || b.collectedAt || "").localeCompare(String(a.publishedAt || a.collectedAt || "")));
  const TYPE_LABEL = { "consumer-survey": "소비자 조사", "market-estimate": "시장 기준선", shipment: "출하량", "market-observation": "정량 관측" };

  return (
    <section className="board" ref={sectionRef} data-screen-label="AI New Business Markets">
     <AnimCtx.Provider value={inView}>
      <div className="board-head">
        <span className="board-tab" style={{ background: isSurvey ? "#DB2777" : "#0891B2" }} />
        <div className="board-titles">
          <h2>{isSurvey ? "AI 관련 소비자 조사 결과" : "AI 관련 시장"} <span className="board-en">{isSurvey ? "AI Consumer Surveys" : "AI Market Map"} · 휴대폰 사업 관점</span></h2>
          <p>{isSurvey ? "지불의사·수용도·인식 등 소비자 조사만 — 원문 확인 후 누적" : "시장 규모·예측·출하 등 정량 시장 데이터만 — 원문 확인 후 누적"}</p>
        </div>
      </div>

      {!data ? (
        <SourcePipeline kind="market" />
      ) : (
        <React.Fragment>
          <div className="mkt-db-summary">
            <div><em>원문 검증 레코드</em><b>{scoped.length}</b><span>발행사 본문 추출 후에만 표시</span></div>
            <div><em>원문 링크</em><b>{sourceCount}</b><span>카드 제목과 하단 링크에서 원문 이동</span></div>
            <div><em>추출 정량 수치</em><b>{quantityCount}</b><span>원문에 나온 수치와 근거 문장 전체 표시</span></div>
          </div>

          <div className="mkt-db-head">
            <div>
              <h3>{isSurvey ? "AI 소비자 조사 데이터베이스" : "AI 시장 정량 데이터베이스"}</h3>
              <p>검색 제목·스니펫은 화면에서 제외 · 발행사 원문에서 확인된 3줄 핵심과 정량 근거만 표시 · 크롤로 계속 누적(기존 삭제 없음)</p>
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
            {!shownRecords.length && <SourcePipeline kind="market" />}
          </div>

          {!isSurvey && <div className="mkt-baseline-head"><b>6개 MECE 버티컬 기준선</b><em>기존 시장규모·예측·CAGR 데이터는 보존되며, 상단 누적 DB에 새 수치가 추가됩니다.</em></div>}
          {!isSurvey && (data.groups || []).map(g => {
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
                        {hasCurrent && hasForecast && <span className="mkt-arr" aria-hidden="true" />}
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
function StartupScopeBoard({ sectionRef, dataVersion, companies, coLive, monet, onSelect }) {
  const inView = useInView(sectionRef);
  // 업체명 클릭 → 다른 기업과 동일한 상세 모달. 추적 기업이면 전체 프로필, 아니면 크롤 라이브 데이터로 강화.
  // 밸류체인 기업·스타트업 모두 companies.json(핵심활동·경영진 발언)·monetization.json(수익모델·사업방향)에서
  // 같은 방식으로 채워지므로, 표시 레벨(정보 깊이)이 통일된다.
  const openStartup = (s, portfolioTier = "") => {
    if (!onSelect) return;
    const match = (companies || []).find(c => c.name === s.name || c.name.replace(/\s*\(.*\)/, "") === s.name);
    if (match) {
      const startupLive = (coLive && coLive[s.name]) || {};
      onSelect({
        ...match,
        profile: s.profile || match.profile,
        org: s.organization || match.org,
        coverage: s.coverage || match.coverage,
        live: {
          ...startupLive,
          ...(match.live || {}),
          profile: match.live?.profile || startupLive.profile || s.profile || match.profile,
          organization: match.live?.organization || startupLive.organization || s.organization || match.org,
          coverage: match.live?.coverage || startupLive.coverage || s.coverage || match.coverage,
        },
      });
      return;
    }
    const institutionSource = s.institution?.url ? [{
      title: s.institution.title, url: s.institution.url, date: s.institution.publishedAt, source: s.institution.name,
    }] : [];
    const productSources = (s.sourceLinks || []).map(source => ({
      title: `${s.name} · ${source.label}`, url: source.url, date: s.institution?.publishedAt || "", source: s.institution?.name || "제품 원문",
    }));
    const profileSources = (s.profile?.sourceUrls || []).map((url, index) => ({
      title: `${s.name} · 기업 개요 근거 ${index + 1}`, url, date: s.profile?.sourceAsOf || "", source: "Official / structured source",
    }));
    const organizationSources = (s.organization?.officialPages || []).map(source => ({
      title: source.title || `${s.name} · 조직·경영진 근거`, url: source.url, date: source.checkedAt || "", source: "Official / structured source",
    }));
    const hist = [s.latest, ...(s.history || []), ...institutionSource, ...productSources, ...profileSources, ...organizationSources]
      .filter(h => h && /^https?:\/\//.test(String(h.url || "")));
    const D = window.DASH || {};
    // 추적 대상이 아니어도 조직도·기업개요 큐레이션이 있으면 붙여 상세를 강화(다른 기업과 동일 뷰)
    const org = s.organization || (D.COMPANY_ORG || {})[s.name] || null;
    const curatedProfile = (D.COMPANY_PROFILES || {})[s.name] || null;
    const bm = s.currentBusiness || s.businessModel || s.overview || s.description || "";
    const institutionBacked = s.provenance?.status === "source-backed";
    const fallbackProfile = {
      founded: s.publisher ? `제품 운영사 · ${s.publisher}` : "",
      ceo: "",
      hq: "",
      headcount: s.headcount || "",
      business: institutionBacked ? [bm].filter(Boolean) : [],
    };
    const verifiedStartupProfile = Object.fromEntries(Object.entries(s.profile || {}).filter(([, value]) =>
      Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && String(value).trim() !== ""));
    const profile = { ...fallbackProfile, ...(curatedProfile || {}), ...verifiedStartupProfile };
    const profileHasSource = [profile.officialWebsite, ...(profile.sourceUrls || [])]
      .some(url => /^https?:\/\//i.test(String(url || "")));
    if (!Array.isArray(profile.business)) profile.business = [];
    if (!profile.business.length && institutionBacked) profile.business = [bm].filter(Boolean);
    const sourceBoundBusiness = profileHasSource ? profile.business[0] || "" : institutionBacked ? bm : "";
    const actionSource = hist.find(item => item?.url && /launch|release|expand|partner|acquir|invest|deploy|introduc|출시|공개|확장|제휴|투자|인수/i
      .test(String(item.title || item.localization?.title || "")));
    const startupIntelligence = s.intelligence || {
      engine: "source-bound-startup-fallback",
      generatedAt: data?.generatedAt || "",
      evidenceWindow: s.institution ? `${s.institution.name} 선정 원문 + 공식 제품·회사 페이지` : "공식 회사 페이지 + 회사명이 확인된 최신 원문",
      currentBusiness: { summary: sourceBoundBusiness, details: [], evidence: hist.slice(0, 2) },
      revenueModel: { summary: "", details: [], evidence: [] },
      strategyDirection: {
        summary: actionSource ? actionSource.localization?.title || actionSource.title || "" : "",
        details: [],
        evidence: actionSource ? [actionSource] : [],
      },
      investmentDirection: { summary: "", details: [], evidence: [] },
      corePractices: [],
      newBusinessModels: [],
      executiveQuotes: [],
      groundingStatus: "source-reference-checked",
    };
    const lv = (coLive && coLive[s.name]) || null;    // crawl-companies.mjs 라이브 데이터(멘션·핵심활동·경영진 발언)
    onSelect({
      name: s.name, domain: s.domain, cat: "startup", unit: s.vertical || "AI 스타트업",
      note: sourceBoundBusiness || s.vertical || "AI 소프트웨어·서비스",
      vp: sourceBoundBusiness, direction: actionSource ? actionSource.localization?.title || actionSource.title || "" : "",
      layer: "app", vchainVertical: s.vertical || "", profile, org,
      portfolioTier,
      institution: s.institution || null,
      coverage: s.coverage || lv?.coverage || null,
      live: lv
        ? {
          ...lv,
          profile: lv.profile || profile,
          organization: lv.organization || org,
          coverage: lv.coverage || s.coverage || null,
          intelligence: lv.intelligence || startupIntelligence,
          latest: lv.latest || s.latest || null,
        }
        : {
          profile,
          organization: org,
          coverage: s.coverage || null,
          intelligence: startupIntelligence,
          latest: s.latest || null,
          mentions7: 0,
          mentions30: 0,
        },
      monetize: monet ? { entry: (monet.companies || []).find(x => x.name === s.name) || null, models: monet.models || [], directions: monet.directions || [] } : null,
      sources: hist.slice(0, 10).map(h => ({ tier: "reported", label: String(h.title || "관련 기사"), asOf: h.date || "", url: h.url })),
    });
  };
  const [data, setData] = React.useState(null);
  const [loaded, setLoaded] = React.useState(false);
  const [tier, setTier] = React.useState("all");
  const [catFilter, setCatFilter] = React.useState("");
  // 단말 신사업 관점 분류 체계 — cat 우선, 없으면 vertical 키워드로 폴백 매핑
  const TAX = window.DASH.STARTUP_TAXONOMY || [];
  const catOf = (s) => {
    if (s.cat && TAX.some(t => t.id === s.cat)) return s.cat;
    const v = String(s.vertical || "").toLowerCase();
    const hit = TAX.find(t => (t.match || []).some(m => v.includes(String(m).toLowerCase())));
    return hit ? hit.id : "";
  };
  const catMeta = id => TAX.find(t => t.id === id) || null;
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
  const confirmDel = (n) => { if (!canDelete(pw)) { setPwErr(true); return; } setDel(d => { const x = { ...d, [n]: 1 }; try { localStorage.setItem(DEL_LS, JSON.stringify(x)); } catch {} return x; }); setPend(null); setPw(""); setPwErr(false); };
  const reset = () => { setDel({}); try { localStorage.removeItem(DEL_LS); } catch {} };
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
    <button className="ct-del" title="삭제(비밀번호)" onClick={e => { e.stopPropagation(); setPend(name); setPw(""); setPwErr(false); }}><Icon name="x" size={12} sw={2.2} /></button>
  ));
  const startupTerms = (name) => String(name || "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").split(/\s+/)
    .filter(term => term.length >= 4 && !["labs", "music", "technologies"].includes(term));
  const startupTitle = (entry, startup) => {
    const original = String(entry?.title || "").trim();
    const localized = entry?.localization?.status === "accepted" ? String(entry.localization.title || "").trim() : "";
    const anchor = startupTerms(startup?.name)[0];
    // A machine-translated headline that turns a company name into a common
    // noun is less useful than the source headline.  Keep that link in its
    // original language rather than publishing a misleading Korean label.
    if (localized && anchor && original.toLowerCase().includes(anchor) && !localized.toLowerCase().includes(anchor)) return original;
    return localized || original;
  };
  const sourceMatchesStartup = (startup, entry) => {
    const title = String(entry?.title || "").toLowerCase();
    return startupTerms(startup?.name).some(term => title.includes(term));
  };
  const SourceHistory = ({ it }) => {
    const seenUrl = new Set();
    const seenTitle = new Set();
    const entries = [it.latest, ...(it.history || [])]
      .filter(entry => /^https?:\/\//.test(String(entry?.url || "")))
      .filter(entry => sourceMatchesStartup(it, entry))
      .filter(entry => {
        const urlKey = String(entry.url).replace(/[?#].*$/, "");
        const titleKey = startupTitle(entry, it).toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
        if (seenUrl.has(urlKey) || (titleKey && seenTitle.has(titleKey))) return false;
        seenUrl.add(urlKey);
        if (titleKey) seenTitle.add(titleKey);
        return true;
      })
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 4);
    return entries.map((entry, index) => (
      <a className="mkt-latest" key={`${entry.url}-${index}`} href={entry.url} target="_blank" rel="noopener">
        <Icon name="news" size={10} /> {entry.date ? `${fmtMonthDay(entry.date)} · ` : ""}{startupTitle(entry, it).slice(0, 72)}
      </a>
    ));
  };

  // Startup records are publishable when a reader can follow at least one
  // retained source link.  Unlike the market-number board, the startup board
  // deliberately keeps source-linked company coverage visible; unsupported
  // funding, valuation and acquisition claims stay out of those cards below.
  const hasLinkedEvidence = (s) => {
    const status = s?.provenance?.status;
    const entries = [s?.latest, ...(s?.history || [])];
    return (status === "source-backed" || status === "source-linked")
      && entries.some(entry => /^https?:\/\//.test(String(entry?.url || "")) && sourceMatchesStartup(s, entry));
  };
  // Defense in depth: even an older cached snapshot is partitioned here.
  // A tracked value-chain company owns its primary card; startup classes then
  // claim the remaining companies in large → small → a16z-only order.
  const claimedCompanies = [...(companies || [])];
  const largePool = claimUniqueCompanies(((data && data.large) || []).filter(hasLinkedEvidence), claimedCompanies);
  const smallPool = claimUniqueCompanies(((data && data.small) || []).filter(hasLinkedEvidence), claimedCompanies);
  const institutionalPool = claimUniqueCompanies(((data && data.institutional) || [])
    .filter(s => s?.provenance?.status === "source-backed"), claimedCompanies);
  const visibleAll = [...largePool, ...smallPool, ...institutionalPool].filter(s => !del[s.name]);
  const catCounts = {};
  visibleAll.forEach(s => { const cid = catOf(s); if (cid) catCounts[cid] = (catCounts[cid] || 0) + 1; });
  const passCat = s => !catFilter || catOf(s) === catFilter;
  const large = largePool.filter(s => !del[s.name] && passCat(s));
  const small = smallPool.filter(s => !del[s.name] && passCat(s));
  const institutional = institutionalPool.filter(s => !del[s.name] && passCat(s));
  const hasA16z = s => !!(s.a16z || s.institution || (s.cohorts || []).length);
  const a16zPortfolio = [...largePool, ...smallPool, ...institutionalPool]
    .filter(hasA16z).filter(s => !del[s.name] && passCat(s));
  const trackedA16z = (data?.companyRegistry?.trackedReferences || [])
    .filter(reference => reference.a16z)
    .map(reference => ({ ...reference, cat: reference.category, displaySection: "tracked" }))
    .filter(reference => !del[reference.name] && passCat(reference));
  const a16zLabel = s => {
    const cohorts = s.a16z?.cohorts || s.cohorts || [];
    const cohort = cohorts.includes("web") && cohorts.includes("mobile") ? "WEB + MOBILE"
      : cohorts.includes("mobile") ? "MOBILE" : "WEB";
    return `a16z · 6th Edition · ${cohort}`;
  };
  const renderStartupCard = (s, portfolioClass, a16zView = false) => {
    const meta = catMeta(catOf(s));
    const live = (coLive && coLive[s.name]) || {};
    const institutionBacked = s.provenance?.status === "source-backed";
    const company = {
      name: s.name,
      domain: s.domain,
      note: institutionBacked ? s.currentBusiness || s.description || "" : "",
      revenue: institutionBacked ? s.revenueModel || "" : "",
      profile: live.profile || s.profile,
      organization: live.organization || s.organization,
      coverage: live.coverage || s.coverage,
      live: { ...live, profile: live.profile || s.profile, organization: live.organization || s.organization },
    };
    const labels = {
      large: `대형 · ${(meta && meta.ko) || s.vertical || "AI 스타트업"}`,
      small: `초기 · ${(meta && meta.ko) || s.vertical || "AI 스타트업"}`,
      institutional: `a16z 전용 · ${(meta && meta.ko) || s.vertical || "소비자 AI"}`,
    };
    return <StrategyPortfolioCard key={`${a16zView ? "a16z" : portfolioClass}-${s.canonicalId || s.name}`}
      company={company}
      accent={(meta && meta.accent) || (a16zView ? "#7A38D6" : "#0E8F6E")}
      eyebrow={a16zView ? `a16z · ${(meta && meta.ko) || s.vertical || "소비자 AI"}` : labels[portfolioClass]}
      badge={a16zView ? (s.a16z?.cohorts || s.cohorts || []).join(" + ").toUpperCase() || "A16Z"
        : portfolioClass === "large" ? "GROWTH" : portfolioClass === "small" ? "EARLY" : "A16Z ONLY"}
      institution={hasA16z(s) ? a16zLabel(s) : ""}
      execution={s.latest?.localization?.title || s.latest?.title || (institutionBacked ? s.description || s.pageTitle : "")}
      headcount={s.headcount || s.profile?.headcount || ""}
      sourceCount={new Set([...(s.history || []), ...(s.sourceLinks || [])].map(source => source?.url).filter(Boolean)).size}
      onSelect={() => openStartup(s, s.displaySection || portfolioClass)}
      accessory={<DelUI name={s.name} />} />;
  };

  return (
    <section className="board" ref={sectionRef} data-screen-label="Startup Analysis">
     <AnimCtx.Provider value={inView}>
      <div className="board-head" style={{ "--accent": "#0E8F6E" }}>
        <span className="board-tab" style={{ background: "#0E8F6E" }} />
        <div className="board-titles">
          <h2>스타트업 분석 <span className="board-en">Startup Analysis · 단말(스마트폰) 신사업 관점 · AI SW·서비스·에이전트</span></h2>
          <p>기업별 <b>현재 사업·수익모델·사업 방향</b>을 원문에서 종합하고, a16z Web·Mobile 선정 제품은 운영사별 한 카드로 통합해 비교.</p>
        </div>
        <div className="mkt-tools">
          <button className={tier === "all" ? "on" : ""} onClick={() => setTier("all")}>전체 {large.length + small.length + institutional.length}</button>
          <button className={tier === "large" ? "on" : ""} onClick={() => setTier("large")}>대형 {large.length}</button>
          <button className={tier === "small" ? "on" : ""} onClick={() => setTier("small")}>소형·초기 {small.length}</button>
          <button className={tier === "a16z" ? "on" : ""} onClick={() => setTier("a16z")}>a16z 선정 운영사 {a16zPortfolio.length + trackedA16z.length}</button>
          {Object.keys(del).length > 0 && <button onClick={reset} title="삭제 초기화">초기화</button>}
        </div>
      </div>

      <ConsultingDecisionRail />

      {/* 분류 기준 — 단말 신사업 관점(직결/제휴/확장 3단계) */}
      {TAX.length > 0 && (
        <div className="su-tax">
          <div className="su-tax-head">
            <b>분류 기준 <em>단말 신사업 적합도</em></b>
            {catFilter && <button className="su-tax-clear" onClick={() => setCatFilter("")}>필터 해제 ✕</button>}
          </div>
          {[["직결", "단말 직결 — 온디바이스·기본앱"], ["제휴", "서비스·B2B 제휴"], ["감시", "기술·인프라 사업 확장"]].map(([tierId, tierLabel]) => (
            <div className="su-tax-tier" key={tierId}>
              <span className="su-tax-tlabel" data-tier={tierId}>{tierLabel}</span>
              <div className="su-tax-cats">
                {TAX.filter(t => t.tier === tierId).map(t => {
                  const n = catCounts[t.id] || 0;
                  return (
                    <button key={t.id} disabled={n === 0} className={"su-tax-cat" + (catFilter === t.id ? " on" : "") + (n === 0 ? " empty" : "")} style={{ "--c": t.accent }}
                      title={`${t.desc}\n▸ 단말 관점: ${t.handset}`}
                      onClick={() => n > 0 && setCatFilter(catFilter === t.id ? "" : t.id)}>
                      <i style={{ background: t.accent }} />{t.ko}<em>{n}</em>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!data ? (
        <SourcePipeline kind="startup" />
      ) : !(large.length || small.length || institutional.length) ? (
        catFilter ? (
          <div className="mkt-empty">
            <b>‘{catMeta(catFilter)?.ko}’ 필터</b>
            <span>a16z·공식 제품 페이지 전체 비교로 전환</span>
            <button className="su-tax-clear" onClick={() => setCatFilter("")}>전체 보기</button>
          </div>
        ) : (
          <SourcePipeline kind="startup" />
        )
      ) : (
        <>
        {(tier === "all" || tier === "large") && (
        <div className="mkt-group">
          <div className="mkt-group-head"><b>대형 업체 — 사업·수익·제휴 방향</b><em>현재 사업과 돈 버는 방식, 최근 실행을 메인에서 비교 · 실적·조직·발언은 클릭 후 상세</em></div>
          <div className="startup-portfolio-grid">
            {large.map(s => renderStartupCard(s, "large"))}
          </div>
        </div>
        )}
        {(tier === "all" || tier === "small") && (
        <div className="mkt-group">
          <div className="mkt-group-head"><b>소형·초기 업체 — 사업모델·투자 방향</b><em>제품·수익 구조·성장 방향을 메인에서 비교 · 창업자·경영진·원문은 클릭 후 상세</em></div>
          <div className="startup-portfolio-grid">
            {small.map(s => renderStartupCard(s, "small"))}
          </div>
        </div>
        )}
        {tier === "all" && institutional.length > 0 && (
        <div className="mkt-group">
          <div className="mkt-group-head">
            <b>a16z 전용 운영사 — 다른 포트폴리오와 중복 제거</b>
            <em>대형·초기·밸류체인에 이미 배치된 업체는 제외 · Web·Mobile 제품은 대표 운영사 한 곳에 통합</em>
            {data.institutionalSource?.url && <a href={data.institutionalSource.url} target="_blank" rel="noopener">a16z 원문</a>}
          </div>
          <div className="startup-portfolio-grid a16z-portfolio-grid">
            {institutional.map(s => renderStartupCard(s, "institutional"))}
          </div>
        </div>
        )}
        {tier === "a16z" && a16zPortfolio.length > 0 && (
        <div className="mkt-group">
          <div className="mkt-group-head">
            <b>a16z 선정 운영사 — 기업 단위 통합 목록</b>
            <em>Web 50 + Mobile 50 원문 제품을 운영사 기준으로 합산 · 같은 업체는 한 카드에서 제품·코호트를 함께 표시</em>
            {data.institutionalSource?.url && <a href={data.institutionalSource.url} target="_blank" rel="noopener">a16z 원문</a>}
          </div>
          {trackedA16z.length > 0 && (
            <div className="tax-tabs">
              <span>밸류체인 대표 카드에 통합된 {trackedA16z.length}개사</span>
              {trackedA16z.map(reference => (
                <button key={`tracked-a16z-${reference.canonicalId}`} onClick={() => openStartup(reference, "tracked")}>
                  {reference.name} · 상세
                </button>
              ))}
            </div>
          )}
          <div className="startup-portfolio-grid a16z-portfolio-grid">
            {a16zPortfolio.map(s => renderStartupCard(s, s.displaySection || (institutional.includes(s) ? "institutional" : "small"), true))}
          </div>
        </div>
        )}
        </>
      )}
     </AnimCtx.Provider>
    </section>
  );
}

Object.assign(window, { BoldSummary, MarketBoard, StartupScopeBoard, CoLogo, CompanyBoard, MobileStrategyBoard, ValueChainBoard, CompanyDetail, ArticleFeed, InsightsBoard, ChartsBoard, VPBoard, ReportsBoard, ESCompetitiveMap, OverviewCharts, BizModelBoard, MonthlyTrendsBoard, SignalBoard, NewBizBoard, ExecToplines, BriefingBoard, RadarBoard, IBInsightBoard });
