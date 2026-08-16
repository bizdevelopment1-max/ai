# AI Intelligence Dashboard

GitHub Pages dashboard: <https://bizdevelopment1-max.github.io/ai/>

Data contracts, retention, lineage, SLOs, and external storage activation: [`DATA_PLATFORM.md`](DATA_PLATFORM.md)

## Continuous content updates

The site has one automated content contract in
[`config/site-content-registry.json`](config/site-content-registry.json).
Business facts are collected into cumulative ledgers, verified, then exposed
only through generated public views. Run `npm run update:site` for the full
pipeline, `npm run update:site:recovery` for source recovery, or
`npm run update:site:publish` to rebuild and validate the site from existing
data. Every run produces `automation-status.json`; the public
`site-content-manifest.json` records freshness, counts and checksums for each
visible section.

## ChatGPT Pro · GitHub Codex Cloud

GitHub Pages의 Site CLI는 `/ask`와 `/edit` 요청을 GitHub Issue로 기록하고 ChatGPT Pro 계정의 Codex Cloud 실행문을 생성한다. 최초 1회 `https://chatgpt.com/codex`에서 Pro 계정으로 로그인하고 `bizdevelopment1-max/ai` 저장소 환경을 연결한 뒤, 복사된 실행문을 Codex Cloud에 붙여넣어 작업한다.

Pro 구독 인증은 ChatGPT에서 처리하며 GitHub Actions Secret, OpenAI API 키, Codex access token, 로컬 PC, 시작 명령, 루프백 서버를 사용하지 않는다. 질문은 저장소를 변경하지 않는 분석 요청으로 전달하고 수정은 새 브랜치와 Pull Request로 제안한다. `.github/workflows/site-codex.yml`은 Issue 요청을 등록하고 Pull Request의 브라우저 번들·자동화 계약·전략 범위 검증만 수행한다.

이 저장소는 공개 저장소이므로 Site CLI 요청과 안내 댓글도 공개된다. API 키, 비밀번호, 브라우저 세션, `auth.json`, 개인정보를 요청에 포함하지 않는다.

## Mobile AI strategy model

The company universe is organized as a seven-layer mobile AI software-and-services value chain: experience and vertical services, agents and orchestration, service platform and monetization, data/context/trust, models and on-device intelligence, developer/deployment tooling, and edge/cloud runtime.

Each company has one current control layer plus adjacent expansion layers. The strategy view combines that placement with 30-day source-backed activity, an own/orchestrate/partner/source posture, Where-to-Play/How-to-Win choices, and a three-horizon execution roadmap.

The main company and startup cards use a shared consulting structure: current business, revenue model, business direction, recent execution, headcount, and source count. Detailed profile facts, performance, investment direction, new business-model expansion, organization, executive background, bilingual executive quotes, core practices, and linked evidence appear after selection so the main and detail views stay MECE.

`scripts/crawl-companies.mjs` normalizes every tracked company into the same company-profile and organization schema. Public-company financials and up to 12 officers are refreshed from market sources when available; private-company facts are paired with daily news, executive mentions, business-model evidence, coverage scores, and visible provenance. `scripts/build-company-intelligence.mjs` converts publisher-page evidence into source-linked business-model and strategy analysis, using GitHub Models only when the workflow token is available and falling back to extractive synthesis. Previously verified direct `/in/` profiles are retained in the cumulative company ledger and refreshed from official structured data; search-result URLs are never rendered.

The browser bundle contains only identity, taxonomy, and decision-framework configuration from `config/dashboard-taxonomy.json`. Mutable company facts, scores, prices, news, opportunities, and strategy statements are generated from cumulative ledgers. `scripts/build-public-data.mjs` materializes bounded public views, including `strategy-view.json`, on every automated refresh, while raw observations remain in append-only history and source-ledger partitions.

Decision candidates are generated as a claim-linked staging view. Each score stores its rubric version, deterministic scorer, eight weighted dimensions and evidence IDs; every signal and opportunity carries 16 independent taxonomy axes. Automated runs may advance candidates to `verified`, but `scripts/validate-publication-policy.mjs` prevents `published` state without a reviewer, approval, complete citations, the configured verified-claim ratio and a passing storage migration gate.

The startup ledger includes the complete a16z Top 100 Gen AI Consumer Apps 6th Edition lists (50 web products and 50 mobile apps) and gives those products the same business-model detail structure as every other company. The list is refreshed weekly from the official institution page and each product's linked page metadata.

## Reliable collection policy

The news feed combines regional Google News discovery with allowlisted publisher feeds and the executable first-party registry in `config/official-source-registry.json`. The registry collector polls validated RSS/Atom feeds, sitemaps, and public research, model, repository, and app-chart APIs before the news build. Each displayed article card links to the publisher page and contains a cleaned source excerpt. Company-level strategic synthesis is a separate layer: it is restricted to stored publisher evidence IDs, preserves source links, and never replaces the article fact layer.

Direct-source collection is layered: official RSS/Atom first, official sitemap second, and an allowlisted official HTML index or public API when a stable feed is unavailable. Named-company Google News gaps are recovered from that registry and recorded as `recovered-by-official-fallback`; broad topic queries are non-critical discovery streams and may be `quiet` without creating a false outage. A stream that is reachable but has no recent matching item is distinct from a network or parser failure.

When an allowlisted first-party endpoint rejects cloud-runner traffic, the collector records the rejected endpoint and switches to its configured Google News query. Those observations are explicitly downgraded to `reported / google-news-fallback`; they are never mislabeled as official evidence. Runtime and retry limits are configured per source so a blocked endpoint cannot consume the complete collection SLA.

Public connectors run without credentials for Xiaomi Discover, Coinbase AgentKit releases, arXiv, Hugging Face, GitHub repository search, and the App Store chart. SEC EDGAR, USPTO Open Data, Sensor Tower, and Appfigures adapters activate only when their repository secrets are present. WIPO PATENTSCOPE remains explicitly license-gated because its machine service requires a separate service agreement. Connector state is reported as `executed`, `credential-gated`, `licensed-connector-required`, or `failed`; missing commercial credentials never masquerade as a successful collection.

The `SEC_USER_AGENT` Actions secret must contain a real application identity and monitored contact email accepted by the regulator. A GitHub no-reply address is intentionally not substituted; when the secret is absent, the submissions connector stays `credential-gated` rather than creating a false failure. Staging runs retain all failed quality-check IDs and continue producing diagnostic artifacts, while the same IDs propagate into the decision publication gate and block any approved public snapshot until resolved.

`config/news-policy.json` is the single, versioned location for display exclusions and the source-excerpt policy. Existing evidence is retained in `history.json`; unverified or legacy entries are marked limited and excluded from the main feed rather than deleted. Direct-source changes are stored separately in append-only monthly JSONL partitions under `source-ledger/`, while `source-snapshot.json` remains the bounded current working set.

`config/global-source-policy.json` separately governs non-news collection: market intelligence, consumer surveys, institution research, and startup discovery rotate through global regional and language-specific RSS locales. This wider policy never changes the English-authoritative restriction of the daily article feed.

The Data Trust Center exposes the quality report, collection health, and model-call health. Every workflow run also archives these records for 90 days. Routine refreshes resume a persistent staging branch and update a single review PR, so unapproved observations continue accumulating without bypassing the one-person approval gate; raw ledgers are never loaded by the browser.
