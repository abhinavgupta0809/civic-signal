// CivicSignal background service worker (MV3).
// - Owns the local API URL.
// - Caches results per URL in memory for the worker's lifetime.
// - Translates network/backend errors into a friendly shape for the popup.

const API_URL = "http://localhost:3000/api/analyze";

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

  let res;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, domain }),
    });
  } catch (err) {
    console.error("[CivicSignal] network error", err);
    return {
      ok: false,
      error:
        "Cannot reach local backend at " +
        API_URL +
        ". Make sure `npm run dev` is running.",
    };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return {
      ok: false,
      error: `Backend returned a non-JSON response (HTTP ${res.status}).`,
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: data?.error || `Backend returned HTTP ${res.status}.`,
    };
  }

  if (url) cache.set(url, data);
  return { ok: true, result: data };
}
