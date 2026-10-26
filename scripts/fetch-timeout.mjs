// Preloaded into every pipeline stage (see scripts/update-site.mjs).
//
// Most collectors call fetch() without a signal. When a source stops
// responding instead of failing, such a call never settles, and the stage
// stalls until its 300s limit kills it, three times over. Every request
// without its own signal now gets a default timeout, so a stalled source
// fails fast and the collector's own error handling takes over.
const DEFAULT_TIMEOUT_MS = Math.max(1_000, Number(process.env.FETCH_DEFAULT_TIMEOUT_MS || 20_000));
const nativeFetch = globalThis.fetch;

if (typeof nativeFetch === "function" && !nativeFetch.__defaultTimeout) {
  const fetchWithTimeout = (input, init = {}) => {
    if (init?.signal) return nativeFetch(input, init);
    return nativeFetch(input, { ...init, signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) });
  };
  fetchWithTimeout.__defaultTimeout = DEFAULT_TIMEOUT_MS;
  globalThis.fetch = fetchWithTimeout;
}
