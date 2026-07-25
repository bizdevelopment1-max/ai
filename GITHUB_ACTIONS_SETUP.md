# GitHub Actions setup

No AI-model API secret is required. The daily workflow uses only public RSS/HTTP sources and repository write permission.

1. In GitHub Actions, enable workflow write permission for the repository.
2. Run **Daily AI News & Stocks Crawl** manually once after deployment if an immediate refresh is needed.
3. Inspect the action artifact `pipeline-audit-*` and the published `quality.json` / `collection-health.json` when a run is partial.

Do not add model API keys for this pipeline: generated summaries are intentionally disabled.
