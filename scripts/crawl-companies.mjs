#!/usr/bin/env node
/* ============================================================
   crawl-companies.mjs — 기업 탭 라이브 데이터 생성기
   입력: news.json + stocks.json  →  출력: companies.json

   기업(뉴스 co 필드 기준)별로:
   - mentions7 / mentions30: 최근 7·30일 언급 기사 수(주목도)
   - latest: 최신 기사 {title, url, date, source}
   - cap / capAsof: 상장사는 stocks.json 실시세 시총 연동
   하드코딩 없음 — 전부 크롤 산출물에서 유도. 매일 실행.
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";

// 기업명 → 상장 티커(시총 연동용 매핑 — 데이터가 아니라 조인 키)
const TICKER_OF = {
  "NVIDIA": "NVDA", "Microsoft": "MSFT", "Amazon": "AMZN", "Apple": "AAPL",
  "Google DeepMind": "GOOGL", "Meta AI": "META", "SpaceX (xAI, Cursor)": "SPCX",
  "SK hynix": "SKHY", "Oracle": "ORCL", "AMD": "AMD", "Broadcom": "AVGO",
  "TSMC": "TSM", "Micron": "MU", "CoreWeave": "CRWV", "Applied Digital": "APLD",
};

const days = d => { const t = new Date(String(d) + "T00:00:00Z").getTime(); return isNaN(t) ? 999 : (Date.now() - t) / 86400000; };

async function main() {
  let articles = [], stocks = {};
  try { articles = JSON.parse(await readFile("news.json", "utf8")).articles || []; } catch {}
  try { stocks = JSON.parse(await readFile("stocks.json", "utf8")).stocks || {}; } catch {}

  const byCo = {};
  for (const a of articles) {
    const co = (a.co || "").trim();
    if (!co) continue;
    (byCo[co] = byCo[co] || []).push(a);
  }

  const companies = {};
  for (const [co, arts] of Object.entries(byCo)) {
    arts.sort((x, y) => (x.date < y.date ? 1 : -1));
    const latest = arts[0];
    companies[co] = {
      mentions7: arts.filter(a => days(a.date) <= 7).length,
      mentions30: arts.filter(a => days(a.date) <= 30).length,
      latest: { title: latest.title, url: latest.url, date: latest.date, source: latest.source },
    };
    const tk = TICKER_OF[co];
    if (tk && stocks[tk] && stocks[tk].marketCap) {
      companies[co].cap = stocks[tk].marketCap;
      companies[co].capAsof = stocks[tk].asOf;
      companies[co].ticker = tk;
    }
  }
  // 뉴스 co에 없는 상장사도 시총은 제공(티커 역방향)
  for (const [co, tk] of Object.entries(TICKER_OF)) {
    if (!companies[co] && stocks[tk] && stocks[tk].marketCap) {
      companies[co] = { mentions7: 0, mentions30: 0, latest: null, cap: stocks[tk].marketCap, capAsof: stocks[tk].asOf, ticker: tk };
    }
  }

  const out = { generatedAt: new Date().toISOString(), companies };
  await writeFile("companies.json", JSON.stringify(out) + "\n");
  console.log(`Wrote companies.json — ${Object.keys(companies).length} companies (live mentions + market caps)`);
}

main().catch(e => { console.error(e); process.exit(0); });
