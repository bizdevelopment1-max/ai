#!/usr/bin/env node
/**
 * NVIDIA 투자 포트폴리오 공개 뷰.
 *
 * 변하지 않는 거래 기준선은 각 거래를 직접 뒷받침하는 원문으로 고정하고,
 * daily-news 파이프라인이 확보한 source-backed 기사 가운데 투자대상별 최신
 * 근거를 결합한다. 화면은 이 파일만 읽으므로 추론 문구와 원문 사실을 분리한다.
 */
import { readFile, writeFile } from "node:fs/promises";
import { loadSuppressionRegistry } from "./suppression-registry.mjs";

const PORTFOLIO = [
  {
    id: "ssi",
    name: "Safe Superintelligence",
    shortName: "SSI",
    aliases: ["safe superintelligence", "sutskever", "ssi"],
    layer: "foundation",
    domain: "ssi.inc",
    transaction: "전략적 투자 · 금액 비공개",
    why: "Vera Rubin 시스템 접근과 장기 컴퓨트 협력을 통해 프런티어 연구소의 NVIDIA 플랫폼 채택을 확대합니다.",
    strategicFit: "최첨단 모델 학습 수요를 차세대 GPU·네트워킹·시스템 수요로 연결하는 앵커 파트너십입니다.",
    source: {
      label: "NVIDIA Investor Relations",
      url: "https://investor.nvidia.com/news/press-release-details/2026/Ilya-Sutskevers-Safe-Superintelligence-Inc--and-NVIDIA-Announce-Long-Term-Strategic-Partnership/default.aspx",
      date: "2026-07-27",
      type: "기업 공식 발표",
    },
  },
  {
    id: "coreweave",
    name: "CoreWeave",
    shortName: "CoreWeave",
    aliases: ["coreweave"],
    layer: "cloud",
    domain: "coreweave.com",
    transaction: "$2B 투자 · 5GW 확장 계획",
    why: "CoreWeave의 5GW AI 컴퓨트 확장 계획을 지원해 NVIDIA 플랫폼 기반 클라우드 용량을 확대합니다.",
    strategicFit: "GPU 판매를 넘어 클라우드 임대 계층의 수요 채널과 대규모 시스템 레퍼런스를 함께 확보합니다.",
    source: {
      label: "TechCrunch",
      url: "https://techcrunch.com/2026/01/26/nvidia-invests-2b-to-help-debt-ridden-coreweave-add-5gw-of-ai-compute/",
      date: "2026-01-26",
      type: "거래 보도",
    },
  },
  {
    id: "thinking-machines",
    name: "Thinking Machines Lab",
    shortName: "TML",
    aliases: ["thinking machines", "thinking machines lab"],
    layer: "foundation",
    domain: "thinkingmachines.ai",
    transaction: "전략적 투자 · 금액 비공개",
    why: "Vera Rubin 시스템을 기가와트 규모로 배포하고 맞춤형 프런티어 모델을 공동 최적화합니다.",
    strategicFit: "차세대 시스템의 대형 초기 고객과 모델 공동개발 레퍼런스를 동시에 확보합니다.",
    source: {
      label: "NVIDIA Blog",
      url: "https://blogs.nvidia.com/blog/nvidia-thinking-machines-lab/",
      date: "2026-03-10",
      type: "기업 공식 발표",
    },
  },
  {
    id: "together-ai",
    name: "Together AI",
    shortName: "Together",
    aliases: ["together ai"],
    layer: "cloud",
    domain: "together.ai",
    transaction: "$800M 라운드 참여",
    why: "오픈 모델의 학습·추론 클라우드를 확장하는 자금 조달에 참여했습니다.",
    strategicFit: "개발자와 기업의 오픈 모델 사용을 NVIDIA 기반 학습·서빙 수요로 전환하는 채널입니다.",
    source: {
      label: "TechCrunch",
      url: "https://techcrunch.com/2026/07/01/neocloud-together-ai-raises-800m-leaps-to-8-3b-valuation/",
      date: "2026-07-01",
      type: "거래 보도",
    },
  },
  {
    id: "mistral",
    name: "Mistral AI",
    shortName: "Mistral",
    aliases: ["mistral ai", "mistral"],
    layer: "foundation",
    domain: "mistral.ai",
    transaction: "반복 투자 · 최근 2025-09",
    why: "유럽 프런티어 모델 기업의 성장 라운드에 반복 참여해 모델 공급 생태계를 넓힙니다.",
    strategicFit: "지역별 프런티어 모델의 학습·추론을 NVIDIA 컴퓨트 스택과 연결합니다.",
    source: {
      label: "TechCrunch",
      url: "https://techcrunch.com/2026/01/02/nvidias-ai-empire-a-look-at-its-top-startup-investments/",
      date: "2026-01-02",
      type: "포트폴리오 분석",
    },
  },
  {
    id: "cohere",
    name: "Cohere",
    shortName: "Cohere",
    aliases: ["cohere"],
    layer: "foundation",
    domain: "cohere.com",
    transaction: "복수 라운드 참여",
    why: "기업용 언어모델 공급사의 복수 자금 조달 라운드에 참여했습니다.",
    strategicFit: "엔터프라이즈 AI 도입을 GPU 기반 추론 수요와 연결하는 애플리케이션 공급망 투자입니다.",
    source: {
      label: "TechCrunch",
      url: "https://techcrunch.com/2026/01/02/nvidias-ai-empire-a-look-at-its-top-startup-investments/",
      date: "2026-01-02",
      type: "포트폴리오 분석",
    },
  },
  {
    id: "perplexity",
    name: "Perplexity",
    shortName: "Perplexity",
    aliases: ["perplexity"],
    layer: "applications",
    domain: "perplexity.ai",
    transaction: "반복 투자 · 2023-11 이후",
    why: "AI 검색 서비스의 성장 단계에 반복 투자해 소비자 추론 사용량이 늘어나는 수요처를 지원합니다.",
    strategicFit: "모델 학습뿐 아니라 대규모 실시간 추론이 필요한 최종 애플리케이션까지 수요 기반을 확장합니다.",
    source: {
      label: "TechCrunch",
      url: "https://techcrunch.com/2026/01/02/nvidias-ai-empire-a-look-at-its-top-startup-investments/",
      date: "2026-01-02",
      type: "포트폴리오 분석",
    },
  },
  {
    id: "figure-ai",
    name: "Figure AI",
    shortName: "Figure",
    aliases: ["figure ai", "figure robotics"],
    layer: "applications",
    domain: "figure.ai",
    transaction: "휴머노이드 AI 투자 · 2024-02 시작",
    why: "휴머노이드 로보틱스의 개발·상용화를 추진하는 자금 조달에 참여했습니다.",
    strategicFit: "데이터센터 AI를 로봇의 학습·시뮬레이션·현장 추론으로 확장하는 피지컬 AI 수요처입니다.",
    source: {
      label: "TechCrunch",
      url: "https://techcrunch.com/2026/01/02/nvidias-ai-empire-a-look-at-its-top-startup-investments/",
      date: "2026-01-02",
      type: "포트폴리오 분석",
    },
  },
  {
    id: "naver",
    name: "Naver",
    shortName: "Naver",
    aliases: ["naver", "naver corp", "naver cloud"],
    layer: "cloud",
    domain: "navercorp.com",
    transaction: "$1B 지분 투자 · 신주 약 724만주 · 지분율 약 4.5%",
    why: "국가 단위 소버린 AI 데이터센터(세종) 증설에 신주 인수 방식으로 직접 투자해 NVIDIA 플랫폼 기반 컴퓨트 확장을 지원합니다.",
    strategicFit: "GPU 판매·임대를 넘어 지분 투자로 대형 AI 팩토리 프로젝트에 직접 결합해 장기 컴퓨트 수요를 고정하는 전략입니다.",
    source: {
      label: "GlobeNewswire (공식 보도자료)",
      url: "https://www.globenewswire.com/news-release/2026/07/27/3333489/0/en/NAVER-NVIDIA-and-Brookfield-to-Expand-Korea-s-National-AI-Factory-Infrastructure-Buildout.html",
      date: "2026-07-27",
      type: "기업 공식 발표",
    },
  },
];

const clean = value => String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
const escapeRe = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentions = (text, alias) => new RegExp(`(^|[^a-z0-9])${escapeRe(clean(alias))}([^a-z0-9]|$)`, "i").test(text);
const investmentTerms = /invest|investment|funding|financing|round|stake|equity|투자|지분|라운드/i;
const sourceBacked = article => article?.displayEligible !== false
  && article?.summaryMode === "source-content-extractive"
  && article?.provenance?.status === "source-backed"
  && /^https?:\/\//.test(article?.url || "");

let articles = [];
const suppression = await loadSuppressionRegistry();
try {
  const news = JSON.parse(await readFile("news.json", "utf8"));
  articles = (news.articles || []).filter(sourceBacked).filter(article => !suppression.matches(article, "article"));
} catch {}

const findLatestEvidence = company => articles
  .filter(article => {
    const text = clean([article.co, article.title, article.titleKo, article.summary].join(" "));
    return /\bnvidia\b/i.test(text)
      && company.aliases.some(alias => mentions(text, alias))
      && investmentTerms.test(text);
  })
  .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];

const portfolio = PORTFOLIO.map(company => {
  const latest = findLatestEvidence(company);
  const { aliases, ...publicCompany } = company;
  return {
    ...publicCompany,
    latestEvidence: latest ? {
      title: latest.titleKo || latest.title || "",
      date: latest.date || "",
      source: latest.source || "",
      url: latest.url,
      summary: latest.summary || "",
    } : null,
  };
});

const output = {
  generatedAt: new Date().toISOString(),
  company: "NVIDIA",
  scope: `직접 원문으로 확인 가능한 주요 AI SW·서비스·컴퓨트 투자 ${portfolio.length}개사`,
  methodology: "거래 기준선은 기업 공식 발표·거래 보도에 고정하고, 최신 동향은 daily-news 원문 추출 데이터에서 투자대상명과 투자 행위가 함께 확인된 기사만 결합합니다.",
  portfolio,
};

await writeFile("nvidia-investments.json", `${JSON.stringify(output)}\n`);
console.log(`[nvidia-investments] ${portfolio.length} source-backed companies · ${portfolio.filter(item => item.latestEvidence).length} latest crawl matches`);
