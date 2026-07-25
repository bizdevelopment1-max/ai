# AI Intelligence Dashboard

GitHub Pages dashboard: <https://bizdevelopment1-max.github.io/ai/>

## Reliable collection policy

The news feed is collected from Google News RSS (`en-US`) and an allowlisted set of direct publisher RSS feeds. Each displayed card links to the source and contains a cleaned source excerpt, not a generated translation or summary. The pipeline makes zero generative-model API calls.

`config/news-policy.json` is the single, versioned location for display exclusions and the source-excerpt policy. Existing evidence is retained in `history.json`; unverified or legacy entries are marked limited and excluded from the main feed rather than deleted.

`config/global-source-policy.json` separately governs non-news collection: market intelligence, consumer surveys, institution research, and startup discovery rotate through global regional and language-specific RSS locales. This wider policy never changes the English-authoritative restriction of the daily article feed.

The Data Trust Center exposes the quality report, collection health, and model-call health. Every workflow run also archives these records for 90 days.
