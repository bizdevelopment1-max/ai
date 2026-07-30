# AI Intelligence Dashboard

GitHub Pages dashboard: <https://bizdevelopment1-max.github.io/ai/>

## Mobile AI strategy model

The company universe is organized as a seven-layer mobile AI software-and-services value chain: experience and vertical services, agents and orchestration, service platform and monetization, data/context/trust, models and on-device intelligence, developer/deployment tooling, and edge/cloud runtime.

Each company has one current control layer plus adjacent expansion layers. The strategy view combines that placement with 30-day source-backed activity, an own/orchestrate/partner/source posture, Where-to-Play/How-to-Win choices, and a three-horizon execution roadmap.

The main company and startup cards use a shared consulting portfolio structure: portfolio decision, strategic move, signal strength, and evidence status. Detailed profile facts, business-model evidence, organization, executive activity, and sources appear only after selection so the main and detail views stay MECE.

`scripts/crawl-companies.mjs` normalizes every tracked company into the same company-profile and organization schema. Public-company financials and officers are refreshed from Yahoo Finance when available; private-company baseline facts are paired with daily news, executive mentions, business-model signals, coverage scores, and visible provenance. `LINKEDIN_PROFILES` is the single verified-person source: only direct `/in/` profiles are rendered, never LinkedIn search-result URLs.

## Reliable collection policy

The news feed is collected from Google News RSS (`en-US`) and an allowlisted set of direct publisher RSS feeds. Each displayed card links to the source and contains a cleaned source excerpt, not a generated translation or summary. The pipeline makes zero generative-model API calls.

`config/news-policy.json` is the single, versioned location for display exclusions and the source-excerpt policy. Existing evidence is retained in `history.json`; unverified or legacy entries are marked limited and excluded from the main feed rather than deleted.

`config/global-source-policy.json` separately governs non-news collection: market intelligence, consumer surveys, institution research, and startup discovery rotate through global regional and language-specific RSS locales. This wider policy never changes the English-authoritative restriction of the daily article feed.

The Data Trust Center exposes the quality report, collection health, and model-call health. Every workflow run also archives these records for 90 days.
