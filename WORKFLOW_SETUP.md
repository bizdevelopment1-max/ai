# Workflow operation

The dashboard is a source-first pipeline:

1. Crawl Google News RSS (`en-US`) and direct publisher feeds.
2. Preserve a cleaned source excerpt, its link, collection timestamp, and stream health.
3. Verify provenance and write a cumulative history ledger without deleting prior evidence.
4. Publish only `source-backed` excerpts in the main article feed. Rule-based interpretation remains source-linked and distinct from source excerpts.

No external AI API, SDK, or model key is part of the workflow. Configure content scope in [`config/news-policy.json`](config/news-policy.json), then run `npm run test:automation` before committing workflow changes.
