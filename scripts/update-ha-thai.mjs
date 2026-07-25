#!/usr/bin/env node
/**
 * Retired compatibility entrypoint.
 *
 * This task formerly asked a generative model to rewrite one article and to
 * invent related links. Manual recovery now runs crawl-news.mjs, which only
 * collects publisher/RSS records before the evidence gate publishes them.
 */
console.log("[source-only] update-ha-thai.mjs is retired; run crawl-news.mjs for a verifiable refresh.");
