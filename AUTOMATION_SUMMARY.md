# Source-only automation

## Unified site refresh

All visible sections are registered in `config/site-content-registry.json` and
updated through one entry point:

- `npm run update:site` runs the complete collection, normalization,
  verification, materialization, browser build and quality gates.
- `npm run update:site:recovery` reruns the source recovery subset and then the
  identical publication gates.
- `npm run update:site:publish` rebuilds and validates public views from the
  current ledgers without collecting from the network.

The runner writes `automation-status.json` for the current execution and
appends the complete stage record to
`source-ledger/pipeline-runs-YYYY-MM.jsonl`. `site-content-manifest.json`
reports record count, checksum, source timestamp and SLA state for every
browser dataset. Missing content is hidden; UI components do not substitute
mutable company, market or opportunity facts.

The dashboard refreshes on a six-hour cadence (KST 06:30, 12:30, 18:30, 00:30).

- Discovery: Google News RSS, direct publisher feeds, first-party feeds and sitemaps, plus executable public APIs in `config/official-source-registry.json`.
- Direct-source collector: `scripts/collect-source-registry.mjs` polls every active registry source, reports failures, and never treats credential-gated connectors as healthy executions.
- Cumulative storage: new and revised observations are appended to monthly `source-ledger/events-YYYY-MM.jsonl` partitions. Run metadata is appended separately; `source-snapshot.json` holds only the current 120-day working set.
- Summary cards: cleaned publisher/RSS excerpts only; no generative-model API or translation API call.
- Verification: `verify-pipeline.mjs` checks URL, publication date, publisher snippet, numeric consistency, direct-source execution coverage, and records limited items without deleting history.
- Publication: automation updates one cumulative `automation/data-staging` branch and one review PR. It never auto-merges. The public bundle contains the latest verified snapshot and does not download raw ledgers.
- Transparency: collection, quality, audit, model-call and source-registry reports are retained as GitHub Actions artifacts for 90 days.

The display/exclusion policy is in [`config/news-policy.json`](config/news-policy.json). Change that file rather than adding hidden front-end filters.
