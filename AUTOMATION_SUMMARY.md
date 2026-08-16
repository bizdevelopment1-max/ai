# Source-only automation

The dashboard refreshes on a six-hour cadence (KST 06:30, 12:30, 18:30, 00:30).

- Discovery: Google News RSS, direct publisher feeds, first-party feeds and sitemaps, plus executable public APIs in `config/official-source-registry.json`.
- Direct-source collector: `scripts/collect-source-registry.mjs` polls every active registry source, reports failures, and never treats credential-gated connectors as healthy executions.
- Cumulative storage: new and revised observations are appended to monthly `source-ledger/events-YYYY-MM.jsonl` partitions. Run metadata is appended separately; `source-snapshot.json` holds only the current 120-day working set.
- Summary cards: cleaned publisher/RSS excerpts only; no generative-model API or translation API call.
- Verification: `verify-pipeline.mjs` checks URL, publication date, publisher snippet, numeric consistency, direct-source execution coverage, and records limited items without deleting history.
- Publication: automation updates one cumulative `automation/data-staging` branch and one review PR. It never auto-merges. The public bundle contains the latest verified snapshot and does not download raw ledgers.
- Transparency: collection, quality, audit, model-call and source-registry reports are retained as GitHub Actions artifacts for 90 days.

The display/exclusion policy is in [`config/news-policy.json`](config/news-policy.json). Change that file rather than adding hidden front-end filters.
