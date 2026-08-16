export const CRAWLER_USER_AGENT = process.env.CRAWLER_USER_AGENT
  || "AI-Intelligence-EvidenceBot/1.0 (+https://bizdevelopment1-max.github.io/ai/How/; contact: bizdevelopment1-max@users.noreply.github.com)";

export const crawlerHeaders = (extra = {}) => ({
  "User-Agent": CRAWLER_USER_AGENT,
  ...extra,
});
