# Source-only automation

The dashboard refreshes four times daily (KST 06:30, 12:30, 19:30, 00:30).

- News: Google News RSS (`en-US`) plus the configured publisher RSS allowlist.
- Summary cards: cleaned publisher/RSS excerpts only; no generative-model API or translation API call.
- Verification: `verify-pipeline.mjs` checks URL, publication date, publisher snippet, numeric consistency, and records limited items without deleting history.
- Transparency: `collection-health.json`, `quality.json`, `audit.json`, and `llm-health.json` are published with every run. Pipeline records are also retained as GitHub Actions artifacts for 90 days.

The display/exclusion policy is in [`config/news-policy.json`](config/news-policy.json). Change that file rather than adding hidden front-end filters.
