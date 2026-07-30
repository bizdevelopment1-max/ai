/**
 * Company identity and official-source registry.
 *
 * Aliases are join keys, not facts. Official pages are fetched on every
 * automation run and are only treated as verified when the page is reachable
 * and the executive's full name is present in the returned source.
 */
export const COMPANY_SOURCES = {
  "OpenAI": {
    aliases: ["OpenAI"],
    official: ["https://openai.com/about/", "https://openai.com/our-structure/"],
    updates: [
      {
        date: "2026-07-22",
        url: "https://openai.com/index/introducing-openai-presence/",
        titleKo: "OpenAI Presence 출시 — 프로덕션 에이전트 운영 계층 확장",
        summaryKo: "기업 에이전트의 신뢰성·평가·통제·지속 개선을 묶어 운영하는 배포 전문 서비스를 제품화.",
      },
      {
        date: "2026-06-28",
        url: "https://openai.com/index/hp-frontier-partnership/",
        titleKo: "HP, OpenAI Frontier 파일럿을 전사 확산 단계로 확대",
        summaryKo: "소규모 파일럿에서 검증한 업무 방식을 조직 전반으로 확장하는 엔터프라이즈 전환 사례.",
      },
      {
        date: "2026-06-21",
        url: "https://openai.com/index/samsung-electronics-chatgpt-codex-deployment/",
        titleKo: "삼성전자, 한국 전 임직원과 글로벌 DX 조직에 ChatGPT·Codex 배포",
        summaryKo: "대규모 제조·디바이스 기업의 전사 업무와 개발 워크플로에 ChatGPT Enterprise와 Codex를 배포.",
      },
      {
        date: "2026-06-01",
        url: "https://openai.com/index/openai-frontier-models-and-codex-are-now-available-on-aws/",
        titleKo: "OpenAI 프런티어 모델·Codex, AWS에서 정식 제공",
        summaryKo: "AWS 고객이 기존 클라우드 운영 환경에서 OpenAI 모델과 Codex를 조달·배포할 수 있도록 유통 경로를 확대.",
      },
      {
        date: "2026-05-18",
        url: "https://openai.com/index/dell-codex-enterprise-partnership/",
        titleKo: "OpenAI·Dell, 하이브리드·온프레미스 Codex 배포 협력",
        summaryKo: "민감 데이터와 핵심 시스템이 있는 기업 내부 환경까지 Codex 배포 범위를 확장.",
      },
      {
        date: "2026-05-11",
        url: "https://openai.com/index/openai-launches-the-deployment-company/",
        titleKo: "OpenAI Deployment Company 출범",
        summaryKo: "Forward Deployed Engineer가 기업 현장에 들어가 데이터·도구·업무 흐름을 AI 운영 시스템으로 전환.",
      },
    ],
  },
  "Anthropic": {
    aliases: ["Anthropic"],
    official: ["https://www.anthropic.com/company"],
    updates: [
      {
        date: "2026-05-04",
        url: "https://www.anthropic.com/news/enterprise-ai-services-company",
        titleKo: "Anthropic, 금융 파트너와 엔터프라이즈 AI 서비스 회사 설립",
        summaryKo: "Blackstone·Hellman & Friedman·Goldman Sachs와 중견기업 현장에 Applied AI 인력을 투입하는 서비스 회사를 구축.",
      },
    ],
  },
  "Google DeepMind": {
    aliases: ["Google DeepMind", "DeepMind"],
    official: ["https://deepmind.google/about/"],
  },
  "Microsoft": {
    aliases: ["Microsoft"],
    official: ["https://news.microsoft.com/source/leadership/"],
  },
  "NVIDIA": {
    aliases: ["NVIDIA"],
    official: [
      "https://www.nvidia.com/en-us/about-nvidia/corporate-management-team/jensen-huang/",
      "https://www.nvidia.com/en-eu/about-nvidia/governance/management-team/colette-kress/",
      "https://www.nvidia.com/en-us/research/bill-dally/",
    ],
  },
  "Apple": {
    aliases: ["Apple"],
    official: ["https://www.apple.com/", "https://www.apple.com/leadership/"],
  },
  "Amazon": {
    aliases: ["Amazon", "AWS", "Amazon Web Services"],
    official: ["https://www.aboutamazon.com/about-us", "https://aws.amazon.com/executive-insights/"],
  },
  "Meta AI": {
    aliases: ["Meta AI", "Meta Platforms", "Meta"],
    official: ["https://about.meta.com/media-gallery/executives/"],
  },
  "Mistral AI": {
    aliases: ["Mistral AI", "Mistral"],
    official: ["https://mistral.ai/company/"],
  },
  "Perplexity": {
    aliases: ["Perplexity AI", "Perplexity"],
    official: ["https://www.perplexity.ai/about"],
  },
  "Cohere": {
    aliases: ["Cohere"],
    official: ["https://cohere.com/about"],
  },
  "Hugging Face": {
    aliases: ["Hugging Face"],
    official: ["https://huggingface.co/about"],
  },
  "Databricks": {
    aliases: ["Databricks"],
    official: ["https://www.databricks.com/company/leadership"],
  },
  "SpaceX (xAI, Cursor)": {
    aliases: ["xAI", "SpaceX"],
    official: ["https://x.ai/company", "https://www.spacex.com/"],
  },
  "Cursor": {
    aliases: ["Cursor", "Anysphere"],
    official: ["https://www.cursor.com/"],
  },
  "DeepSeek": {
    aliases: ["DeepSeek"],
    official: ["https://www.deepseek.com/"],
  },
  "Scale AI": {
    aliases: ["Scale AI"],
    official: ["https://scale.com/about"],
  },
  "Together AI": {
    aliases: ["Together AI", "Together Computer"],
    official: ["https://www.together.ai/about"],
  },
  "Glean": {
    aliases: ["Glean"],
    official: ["https://www.glean.com/about"],
  },
  "Sierra AI": {
    aliases: ["Sierra AI", "Sierra"],
    official: ["https://sierra.ai/about"],
  },
  "Writer": {
    aliases: ["Writer AI", "Writer.com"],
    official: ["https://writer.com/about/"],
  },
  "Harvey": {
    aliases: ["Harvey AI", "Harvey"],
    official: ["https://www.harvey.ai/about"],
  },
  "Abridge": {
    aliases: ["Abridge"],
    official: ["https://www.abridge.com/about"],
  },
  "Replit": {
    aliases: ["Replit"],
    official: ["https://replit.com/about"],
  },
  "Lovable": {
    aliases: ["Lovable"],
    official: ["https://lovable.dev/about"],
  },
  "Midjourney": {
    aliases: ["Midjourney"],
    official: ["https://www.midjourney.com/home"],
  },
  "Stability AI": {
    aliases: ["Stability AI"],
    official: ["https://stability.ai/about"],
  },
  "Runway": {
    aliases: ["Runway AI", "Runway"],
    official: ["https://runwayml.com/about"],
  },
  "Kling AI": {
    aliases: ["Kling AI", "Kuaishou Kling"],
    official: ["https://klingai.com/"],
  },
  "Hailuo (MiniMax)": {
    aliases: ["Hailuo AI", "MiniMax"],
    official: ["https://www.minimax.io/"],
  },
  "Synthesia": {
    aliases: ["Synthesia"],
    official: ["https://www.synthesia.io/about"],
  },
  "Suno": {
    aliases: ["Suno AI", "Suno"],
    official: ["https://suno.com/about"],
  },
  "ElevenLabs": {
    aliases: ["ElevenLabs"],
    official: ["https://elevenlabs.io/about"],
  },
};

const escaped = value => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const bound = value => {
  const text = String(value || "").trim();
  const left = /^[A-Za-z0-9]/.test(text) ? "\\b" : "";
  const right = /[A-Za-z0-9]$/.test(text) ? "\\b" : "";
  return `${left}${escaped(text)}${right}`;
};

export function aliasesFor(name) {
  const simple = String(name || "").replace(/\s*\(.*\)\s*$/, "").trim();
  return [...new Set([...(COMPANY_SOURCES[name]?.aliases || []), simple].filter(Boolean))];
}

export function companyRegex(name) {
  const aliases = aliasesFor(name);
  return aliases.length ? new RegExp(aliases.map(bound).join("|"), "i") : null;
}

export function articleFocusScore(name, article) {
  const re = companyRegex(name);
  if (!re || !article) return 0;
  const title = String(article.titleEn || article.title || "");
  const lede = [
    article.descEn,
    article.summary,
    ...(Array.isArray(article.summaryLinesEn) ? article.summaryLinesEn.slice(0, 2) : []),
    ...(Array.isArray(article.sourceContent?.paragraphs) ? article.sourceContent.paragraphs.slice(0, 2) : []),
  ].filter(Boolean).join(" ");
  return (re.test(title) ? 3 : 0)
    + (re.test(lede) ? 2 : 0)
    + (String(article.co || "") === name ? 1 : 0);
}

export function articleFocusedOnCompany(name, article) {
  return articleFocusScore(name, article) >= 2;
}

export function executiveTier(role) {
  const value = String(role || "");
  if (/founder|co-founder|chair|board/i.test(value)) return "founder-board";
  if (/chief executive|\bceo\b|president/i.test(value)) return "ceo";
  if (/chief (technology|scientist|product)|\bcto\b|\bcpo\b|research|engineering|technology|product|AI\b/i.test(value)) return "product-technology";
  if (/chief financial|\bcfo\b|finance|legal|counsel|people|human resources|operations|\bcoo\b|commercial|marketing|revenue/i.test(value)) return "corporate-functions";
  return "executive-team";
}
