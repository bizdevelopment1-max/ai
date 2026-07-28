#!/usr/bin/env node
/*
 * Append-only market intelligence crawler.
 * Keeps the existing six-axis market map intact, then adds only new,
 * RSS discovery observations to market.json.records. RSS content is retained
 * as a discovery ledger only; a separate source-page pass must resolve and
 * extract the publisher page before a record is allowed onto the site.
 */
import { readFile, writeFile } from "node:fs/promises";
import { appendRecords, ensureMarketDatabase, hasSurveyEvidence } from "./market-db.mjs";
import { googleNewsUrl, rotatingLocales } from "./global-sources.mjs";
import { isExcludedText } from "./news-policy.mjs";

const UA = "Mozilla/5.0 (compatible; AI-Intelligence-Market-DB/1.0)";
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const decode = raw => String(raw || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tag = (xml, name) => (xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i")) || [])[1] || "";
const cleanTitle = title => decode(title).replace(/\s+-\s+[^-]{2,}$/, "").trim();

const QUERIES = [
  { id: "ai-phone", group: "core", verticalId: "core-0", topic: "생성형 AI폰 시장·출하", query: "generative AI smartphone market size forecast shipments" },
  { id: "device-ai", group: "core", verticalId: "core-1", topic: "온디바이스 AI·AI PC", query: "on-device AI AI PC market size forecast" },
  { id: "agents", group: "assistant", verticalId: "assistant-0", topic: "AI 에이전트·어시스턴트", query: "AI agent consumer adoption market size survey" },
  { id: "consumer-phone", group: "assistant", verticalId: "assistant-0", topic: "AI 스마트폰 소비자 조사", query: "generative AI smartphone consumer survey respondents adoption" },
  { id: "wearables", group: "wearxr", verticalId: "wearxr-1", topic: "스마트글라스·웨어러블", query: "smart glasses wearable AI consumer survey shipments forecast" },
  { id: "creative", group: "creative", verticalId: "creative-0", topic: "생성형 콘텐츠·카메라", query: "generative AI content creation consumer survey market size" },
  { id: "service", group: "service", verticalId: "service-0", topic: "AI 서비스 플랫폼", query: "AI healthcare smart home fintech consumer survey market size" },
  { id: "trust", group: "trust", verticalId: "trust-0", topic: "AI 신뢰·보안 소비자 조사", query: "AI privacy trust consumer survey respondents" },
  // ── DB 확장(신사업 시장 사이즈 + 소비자 조사) — 41개 버티컬 커버리지 확대, 계속 누적 ──
  { id: "ai-health", group: "service", verticalId: "service-0", topic: "AI 헬스케어 시장·조사", query: "AI healthcare diagnosis market size forecast consumer survey" },
  { id: "ai-fintech", group: "service", verticalId: "service-2", topic: "AI 핀테크·결제 시장", query: "AI fintech mobile payment market size forecast adoption survey" },
  { id: "ai-edu", group: "service", verticalId: "service-3", topic: "AI 에듀테크 시장", query: "AI education edtech market size forecast learner survey" },
  { id: "ai-mentalhealth", group: "service", verticalId: "service-38", topic: "AI 멘탈헬스·웰빙", query: "AI mental health wellness app market size forecast users survey" },
  { id: "ai-weather", group: "service", verticalId: "service-30", topic: "AI 날씨·환경 예보", query: "AI weather forecasting app market size forecast adoption" },
  { id: "ai-companion", group: "assistant", verticalId: "assistant-2", topic: "AI 컴패니언·챗봇 조사", query: "AI companion chatbot consumer adoption survey market size" },
  { id: "ai-translation", group: "assistant", verticalId: "assistant-4", topic: "AI 통역·번역 시장", query: "AI translation interpretation market size forecast users" },
  { id: "ai-travel", group: "assistant", verticalId: "assistant-39", topic: "AI 여행 어시스턴트", query: "AI travel assistant market size forecast traveler survey" },
  { id: "ai-caption", group: "assistant", verticalId: "assistant-37", topic: "AI 실시간 자막·접근성", query: "AI live captioning accessibility market size forecast" },
  { id: "ai-earbuds", group: "wearxr", verticalId: "wearxr-35", topic: "AI 이어버드·히어러블", query: "AI earbuds hearables market size forecast shipments consumer survey" },
  { id: "ai-pet", group: "wearxr", verticalId: "wearxr-40", topic: "AI 반려동물 웨어러블", query: "AI pet health wearable market size forecast adoption" },
  { id: "ai-robotics", group: "wearxr", verticalId: "wearxr-0", topic: "휴머노이드·물리 AI 시장", query: "humanoid robot physical AI market size forecast shipments" },
  { id: "ai-scanner", group: "creative", verticalId: "creative-29", topic: "AI 문서 스캐너·OCR", query: "AI document scanner OCR app market size forecast users" },
  { id: "ai-carkey", group: "trust", verticalId: "trust-36", topic: "스마트폰 디지털 차키", query: "smartphone digital car key UWB NFC market size forecast adoption" },
  { id: "ai-scam", group: "trust", verticalId: "trust-32", topic: "AI 스팸·스캠 통화 탐지", query: "AI spam scam call detection market size forecast consumer survey" },
  { id: "ai-deepfake", group: "trust", verticalId: "trust-1", topic: "딥페이크 탐지 시장", query: "deepfake detection market size forecast enterprise survey" },
  { id: "ai-wtp", group: "assistant", verticalId: "assistant-0", topic: "AI 구독 지불의사 조사", query: "consumers willing to pay AI features subscription survey percent" },
  { id: "ai-enterprise", group: "assistant", verticalId: "assistant-0", topic: "기업 AI 도입 조사", query: "enterprise generative AI adoption survey ROI market size" },
  // ── 1차 리서치·조사기관 앵커 쿼리 — 발행사 원문(리포트) 직접 발굴 확대 ──
  { id: "src-idc", group: "core", verticalId: "core-0", topic: "IDC AI 시장 전망", query: "IDC AI market spending forecast billion worldwide" },
  { id: "src-gartner", group: "assistant", verticalId: "assistant-0", topic: "Gartner AI 예측", query: "Gartner generative AI forecast market billion adoption" },
  { id: "src-counterpoint", group: "core", verticalId: "core-0", topic: "Counterpoint AI폰 출하", query: "Counterpoint generative AI smartphone shipments forecast units" },
  { id: "src-canalys", group: "core", verticalId: "core-1", topic: "Canalys AI PC 출하", query: "Canalys AI PC smartphone shipments forecast units" },
  { id: "src-statista", group: "service", verticalId: "service-0", topic: "Statista AI 시장·이용", query: "Statista artificial intelligence market revenue users forecast" },
  { id: "src-grandview", group: "service", verticalId: "service-0", topic: "Grand View 시장규모", query: "Grand View Research AI market size CAGR forecast" },
  { id: "src-mordor", group: "wearxr", verticalId: "wearxr-1", topic: "Mordor 웨어러블·XR", query: "Mordor Intelligence AI wearable AR VR market size forecast" },
  { id: "src-precedence", group: "service", verticalId: "service-38", topic: "Precedence 신사업 시장", query: "Precedence Research AI application market size 2030 forecast" },
  { id: "src-omdia", group: "core", verticalId: "core-2", topic: "Omdia AI 반도체·엣지", query: "Omdia AI edge chipset market forecast shipments" },
  { id: "src-pew", group: "trust", verticalId: "trust-0", topic: "Pew AI 인식 조사", query: "Pew Research survey Americans artificial intelligence percent" },
  { id: "src-deloitte", group: "assistant", verticalId: "assistant-0", topic: "Deloitte AI 소비자 조사", query: "Deloitte digital consumer survey generative AI adoption percent" },
  { id: "src-mck", group: "service", verticalId: "service-0", topic: "McKinsey AI 도입 조사", query: "McKinsey state of AI survey adoption organizations percent" },
  // ── 모델사 수직통합 신사업(자회사·분사로 버티컬 AI 서비스 구축) — 시장규모·비즈니스모델 발굴 ──
  { id: "labs-vertical", group: "assistant", verticalId: "assistant-0", topic: "모델사 버티컬 AI 서비스 신사업", query: "OpenAI Anthropic new business vertical AI service subsidiary revenue" },
  { id: "labs-appstack", group: "assistant", verticalId: "assistant-0", topic: "파운데이션 랩 애플리케이션 진출", query: "foundation model company vertical integration application layer market" },
  { id: "labs-spinoff", group: "service", verticalId: "service-0", topic: "AI 랩 자회사·분사 서비스", query: "AI lab subsidiary spinoff consumer enterprise service launch" },
  { id: "ai-native-saas", group: "service", verticalId: "service-0", topic: "AI 네이티브 버티컬 SaaS 시장", query: "AI native vertical SaaS application market size forecast" },
  { id: "labs-consumer", group: "assistant", verticalId: "assistant-0", topic: "모델사 소비자 앱·구독 매출", query: "OpenAI ChatGPT consumer app subscription revenue market" },
  // ── 엔터프라이즈 AI 서비스·컨설팅·구축(Forward-Deployed) 신사업 — 딜·시장·모델 발굴 ──
  { id: "ode-anthropic", group: "service", verticalId: "service-0", topic: "Ode with Anthropic 엔터프라이즈 서비스", query: "Ode with Anthropic enterprise AI services Blackstone joint venture revenue" },
  { id: "openai-deployco", group: "service", verticalId: "service-0", topic: "OpenAI Deployment Company", query: "OpenAI Deployment Company TPG Tomoro enterprise AI valuation" },
  { id: "fde-model", group: "service", verticalId: "service-0", topic: "포워드 디플로이드 엔지니어 모델", query: "forward deployed engineer enterprise AI services market Palantir model" },
  { id: "ent-agentic", group: "service", verticalId: "service-0", topic: "엔터프라이즈 에이전틱 AI 시장", query: "enterprise agentic AI market size forecast deployment implementation" },
  { id: "ai-consulting", group: "service", verticalId: "service-0", topic: "AI 컨설팅·구축 서비스 시장", query: "AI consulting implementation services market size Accenture forecast" },
  { id: "ai-services-si", group: "service", verticalId: "service-0", topic: "AI 도입 SI·파트너 생태계", query: "enterprise Claude deployment system integrator Wipro Cognizant partner" },
];

const quantified = text => {
  const found = [
    ...String(text || "").matchAll(/(?:US\$|USD|\$|EUR|€|GBP|£|JPY|CNY|CN¥|¥|KRW|₩|INR|₹|BRL|R\$)\s?\d[\d,.]*(?:\s?(?:trillion|billion|million|trn|bn|mn|T|B|M|조|억|만|억엔|億元|亿|万))?/gi),
    ...String(text || "").matchAll(/\b\d+(?:\.\d+)?\s?(?:%|％)/g),
    ...String(text || "").matchAll(/\b\d[\d,.]*(?:\s?(?:million|billion|bn|mn|thousand|m|b))\s+(?:users|consumers|respondents|shipments|units|adults|people)/gi),
    ...String(text || "").matchAll(/\b\d[\d,.]*(?:명|대|만명|만 대|억명|억 대|조원|억원|만 원|万人|万台|億人|億台|万人|台|億|万)/g),
  ].map(match => match[0].replace(/\s+/g, " ").trim());
  return [...new Set(found)].slice(0, 4);
};

const kindOf = record => hasSurveyEvidence(record)
  ? "consumer-survey"
  : /\b(?:shipments?|units?)\b|출하|판매량|台|出荷|出货/i.test(`${record.title || ""} ${record.evidence || ""}`) ? "shipment" : "market-observation";

async function rss(query, locale) {
  const url = googleNewsUrl(query, locale, 14);
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  if (!response.ok) throw new Error(`Google News RSS ${response.status} for ${query} (${locale.id})`);
  const xml = await response.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 8).map(match => {
    const item = match[1];
    const published = new Date(tag(item, "pubDate"));
    return {
      title: cleanTitle(tag(item, "title")),
      sourceUrl: decode(tag(item, "link")),
      sourceName: decode(tag(item, "source")) || "Google News",
      publishedAt: Number.isNaN(published.getTime()) ? today() : published.toISOString().slice(0, 10),
      evidence: decode(tag(item, "description")),
      region: locale.region,
      language: locale.language,
      locale: locale.id,
    };
  }).filter(item => item.title && item.sourceUrl);
}

async function main() {
  let data;
  try {
    data = JSON.parse(await readFile("market.json", "utf8"));
  } catch {
    throw new Error("market.json is missing or invalid; run seed-markets.mjs before refreshing signals");
  }

  const startedAt = now();
  const migration = ensureMarketDatabase(data, startedAt);
  const ageHours = data.database?.lastCrawledAt ? (Date.now() - Date.parse(data.database.lastCrawledAt)) / 3_600_000 : 999;
  if (ageHours < 20 && process.env.MARKET_FORCE !== "1") {
    if (migration.changed) {
      data.generatedAt = startedAt;
      await writeFile("market.json", JSON.stringify(data, null, 2) + "\n");
    }
    console.log(`[market-db] crawl is fresh (${ageHours.toFixed(1)}h); preserved ${data.records.length} append-only records`);
    return;
  }

  let fetched = 0;
  let failures = 0;
  const candidates = [];
  const latestByVertical = new Map();
  const locales = rotatingLocales();
  for (const config of QUERIES) {
    for (const locale of locales) {
      try {
        const rows = await rss(config.query, locale);
        fetched += rows.length;
        for (const row of rows) {
          const combined = `${row.title} ${row.evidence}`;
          if (isExcludedText(`${combined} ${row.sourceName}`)) continue;
          const values = quantified(combined).map((value, index) => ({ label: index === 0 ? "공개 수치" : "추가 수치", value }));
          if (!values.length) continue;
          const record = {
            type: kindOf(row),
            group: config.group,
            verticalId: config.verticalId,
            topic: config.topic,
            title: row.title,
            metricLabel: config.topic,
            // These values are discovery hints from the RSS title/snippet.
            // They must never be rendered as source facts. The source-page
            // refresher replaces them with sourceQuantifiedLines only after
            // extracting the linked publisher page.
            values,
            scope: `발견 경로 ${row.region} · ${row.language} RSS · 발행사 원문 확인 전`,
            sourceName: row.sourceName,
            sourceUrl: row.sourceUrl,
            publishedAt: row.publishedAt,
            evidence: row.evidence.slice(0, 900),
            rssEvidence: row.evidence.slice(0, 900),
            displayEligible: false,
            provenance: {
              status: "pending-source-page",
              evidenceCount: 0,
              evidenceType: "rss-discovery-only",
              checkedAt: startedAt,
              issues: ["publisher-page-extraction-required"],
            },
            origin: "rss-quantitative-crawl",
            sourceScope: "global-localized-rss",
            sourceRegion: row.region,
            sourceLanguage: row.language,
            sourceLocale: row.locale,
          };
          candidates.push(record);
          if (!latestByVertical.has(config.verticalId)) latestByVertical.set(config.verticalId, row);
        }
      } catch (error) {
        failures++;
        console.error(`[market-db] ${config.id}/${locale.id}: ${error.message}`);
      }
      // 쿼리 확대(8→26)에 따른 요청 페이싱 — Google News RSS 레이트리밋 회피(직렬 ~4req/s 이하)
      await new Promise(resolve => setTimeout(resolve, Number(process.env.MARKET_PACE_MS) || 250));
    }
  }

  if (!fetched && failures === QUERIES.length * locales.length) throw new Error("All global market-data sources failed; refusing to mark the database refreshed");
  const added = appendRecords(data, candidates, startedAt);
  for (const item of data.items || []) {
    const latest = latestByVertical.get(item.id);
    if (latest) item.latest = { title: latest.title, url: latest.sourceUrl, source: latest.sourceName, date: latest.publishedAt };
  }
  data.database = {
    ...(data.database || {}),
    recordCount: data.records.length,
    lastCrawledAt: startedAt,
    lastCrawl: { queries: QUERIES.length, locales: locales.map(locale => ({ id: locale.id, region: locale.region, language: locale.language })), rssRows: fetched, appended: added, failures },
  };
  data.freshAt = startedAt;
  data.generatedAt = startedAt;
  await writeFile("market.json", JSON.stringify(data, null, 2) + "\n");
  console.log(`[market-db] appended ${added} discovery records awaiting publisher-page extraction; retained ${data.records.length}; RSS rows ${fetched}/${QUERIES.length * locales.length} global query streams`);
}

main().catch(error => { console.error(error); process.exit(1); });
