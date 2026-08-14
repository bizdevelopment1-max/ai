# AI Intelligence Dashboard

GitHub Pages dashboard: <https://bizdevelopment1-max.github.io/ai/>

## Local Codex CLI

The public GitHub Pages build remains static. Actual Codex questions and workspace edits run only through the loopback bridge at `http://127.0.0.1:4510` so the CLI process and ChatGPT authentication are never exposed to the public web.

Windows setup:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-site-codex.ps1
.\Start-Site-Codex.cmd
```

The installer adds the official `@openai/codex` package pinned in `package.json`, checks `codex login status`, and starts ChatGPT login when needed. `/ask` runs `codex exec` in a read-only sandbox. `/edit` requires a browser confirmation and then runs in a workspace-write sandbox. The bridge binds only to `127.0.0.1` and accepts same-origin requests.

## Mobile AI strategy model

The company universe is organized as a seven-layer mobile AI software-and-services value chain: experience and vertical services, agents and orchestration, service platform and monetization, data/context/trust, models and on-device intelligence, developer/deployment tooling, and edge/cloud runtime.

Each company has one current control layer plus adjacent expansion layers. The strategy view combines that placement with 30-day source-backed activity, an own/orchestrate/partner/source posture, Where-to-Play/How-to-Win choices, and a three-horizon execution roadmap.

The main company and startup cards use a shared consulting structure: current business, revenue model, business direction, recent execution, headcount, and source count. Detailed profile facts, performance, investment direction, new business-model expansion, organization, executive background, bilingual executive quotes, core practices, and linked evidence appear after selection so the main and detail views stay MECE.

`scripts/crawl-companies.mjs` normalizes every tracked company into the same company-profile and organization schema. Public-company financials and up to 12 officers are refreshed from Yahoo Finance when available; private-company baseline facts are paired with daily news, executive mentions, business-model evidence, coverage scores, and visible provenance. `scripts/build-company-intelligence.mjs` converts publisher-page evidence into source-linked business-model and strategy analysis, using GitHub Models only when the workflow token is available and falling back to extractive synthesis. `LINKEDIN_PROFILES` is the single verified-person source: only direct `/in/` profiles are rendered, never LinkedIn search-result URLs.

The startup ledger includes the complete a16z Top 100 Gen AI Consumer Apps 6th Edition lists (50 web products and 50 mobile apps) and gives those products the same business-model detail structure as every other company. The list is refreshed weekly from the official institution page and each product's linked page metadata.

## Reliable collection policy

The news feed is collected from Google News RSS (`en-US`) and an allowlisted set of direct publisher RSS feeds. Each displayed article card links to the source and contains a cleaned source excerpt. Company-level strategic synthesis is a separate layer: it is restricted to stored publisher evidence IDs, preserves source links, and never replaces the article fact layer.

`config/news-policy.json` is the single, versioned location for display exclusions and the source-excerpt policy. Existing evidence is retained in `history.json`; unverified or legacy entries are marked limited and excluded from the main feed rather than deleted.

`config/global-source-policy.json` separately governs non-news collection: market intelligence, consumer surveys, institution research, and startup discovery rotate through global regional and language-specific RSS locales. This wider policy never changes the English-authoritative restriction of the daily article feed.

The Data Trust Center exposes the quality report, collection health, and model-call health. Every workflow run also archives these records for 90 days.
