// CivicSignal background service worker (MV3) — standalone build.
//
// This build does NOT depend on the hosted website. It runs the full analysis
// pipeline (extension/lib.js) inside the extension and calls the Anthropic
// API directly with the USER'S OWN key, read from chrome.storage.local.
// The key is sent only to api.anthropic.com and never to any other server.

import { AnalysisError, analyzeArticle } from "./lib.js";

const KEY_STORAGE = "anthropicApiKey";

// In-memory cache. Service workers can be torn down when idle, so this is
// "session-ish" not durable — that's fine for an MVP demo.
const cache = new Map();

console.log("[CivicSignal] background worker booted");

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log("[CivicSignal] bg received:", msg?.type);

  if (msg?.type === "ANALYZE") {
    handleAnalyze(msg.payload || {})
      .then(sendResponse)
      .catch((err) => {
        console.error("[CivicSignal] bg unhandled error", err);
        sendResponse({
          ok: false,
          needsKey: err instanceof AnalysisError && err.needsKey,
          error: err?.message || "Unknown analysis error.",
        });
      });
    return true; // keep channel open for async sendResponse
  }

  if (msg?.type === "CLEAR_CACHE") {
    cache.clear();
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

async function getStoredKey() {
  const stored = await chrome.storage.local.get(KEY_STORAGE);
  const key = stored?.[KEY_STORAGE];
  return typeof key === "string" && key.trim() ? key.trim() : "";
}

async function handleAnalyze({ text, domain, url, force }) {
  if (!text || text.trim().length < 40) {
    return {
      ok: false,
      error:
        "Couldn't find enough article text on this page. Try a news article tab.",
    };
  }

  if (!force && url && cache.has(url)) {
    console.log("[CivicSignal] cache hit for", url);
    return { ok: true, result: cache.get(url), cached: true };
  }

  const apiKey = await getStoredKey();

  let result;
  try {
    result = await analyzeArticle({ text, domain, apiKey });
  } catch (err) {
    if (err instanceof AnalysisError) {
      return { ok: false, needsKey: err.needsKey, error: err.message };
    }
    console.error("[CivicSignal] analysis error", err);
    return { ok: false, error: "Analysis failed unexpectedly. Try again." };
  }

  if (url) cache.set(url, result);
  return { ok: true, result };
}
