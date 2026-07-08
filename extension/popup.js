// CivicSignal popup.
// Flow: get active tab -> inject content.js -> read its return value
//   -> ask background to ANALYZE -> render result (or error state).
// First run (or a rejected key) routes to the settings state, where the
// user stores their own Anthropic API key in chrome.storage.local.

const KEY_STORAGE = "anthropicApiKey";

const SIGNAL_LABELS = {
  source_credibility: "Source credibility",
  claim_corroboration: "Claim corroboration",
  fact_check_match: "Fact-check match",
  manipulation_language: "Manipulation language",
};

const els = {
  loading: document.getElementById("state-loading"),
  loadingMsg: document.getElementById("loading-msg"),
  error: document.getElementById("state-error"),
  errorMsg: document.getElementById("error-msg"),
  result: document.getElementById("state-result"),
  retry: document.getElementById("retry-btn"),
  reanalyze: document.getElementById("reanalyze-btn"),
  copy: document.getElementById("copy-btn"),
  settings: document.getElementById("state-settings"),
  settingsBtn: document.getElementById("settings-btn"),
  keyInput: document.getElementById("key-input"),
  keyError: document.getElementById("key-error"),
  keySave: document.getElementById("key-save-btn"),
  keyClear: document.getElementById("key-clear-btn"),
  electionBanner: document.getElementById("election-banner"),
  scoreRing: document.getElementById("score-ring"),
  scoreValue: document.getElementById("score-value"),
  verdictBadge: document.getElementById("verdict-badge"),
  summary: document.getElementById("summary-text"),
  signals: document.getElementById("signal-bars"),
  claims: document.getElementById("claims-list"),
  meta: document.getElementById("meta"),
};

let lastResult = null;

document.addEventListener("DOMContentLoaded", async () => {
  els.retry.addEventListener("click", () => run({ force: true }));
  els.reanalyze.addEventListener("click", () => run({ force: true }));
  els.copy.addEventListener("click", copyJson);
  els.settingsBtn.addEventListener("click", () => openSettings());
  els.keySave.addEventListener("click", saveKey);
  els.keyClear.addEventListener("click", clearKey);
  els.keyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveKey();
  });

  // First run: no key yet -> go straight to settings instead of failing.
  const key = await getStoredKey();
  if (!key) {
    openSettings("Add your Anthropic API key to start analyzing.");
    return;
  }
  run({ force: false });
});

function setState(state) {
  els.loading.hidden = state !== "loading";
  els.error.hidden = state !== "error";
  els.result.hidden = state !== "result";
  els.settings.hidden = state !== "settings";
}

// --- API key management -----------------------------------------------------

async function getStoredKey() {
  try {
    const stored = await chrome.storage.local.get(KEY_STORAGE);
    const key = stored?.[KEY_STORAGE];
    return typeof key === "string" && key.trim() ? key.trim() : "";
  } catch {
    return "";
  }
}

function openSettings(notice) {
  els.keyError.hidden = !notice;
  els.keyError.textContent = notice || "";
  els.keyInput.value = "";
  setState("settings");
  els.keyInput.focus();
}

async function saveKey() {
  const key = els.keyInput.value.trim();
  if (!key.startsWith("sk-ant-") || key.length < 20) {
    els.keyError.textContent =
      'That doesn\'t look like an Anthropic key (it starts with "sk-ant-").';
    els.keyError.hidden = false;
    return;
  }
  await chrome.storage.local.set({ [KEY_STORAGE]: key });
  els.keyInput.value = "";
  // A new key invalidates cached "key rejected" states; re-run the analysis.
  chrome.runtime.sendMessage({ type: "CLEAR_CACHE" }).catch(() => {});
  run({ force: true });
}

async function clearKey() {
  await chrome.storage.local.remove(KEY_STORAGE);
  chrome.runtime.sendMessage({ type: "CLEAR_CACHE" }).catch(() => {});
  openSettings("Key removed. Add a key to analyze again.");
}

function showError(msg) {
  console.warn("[CivicSignal] popup error:", msg);
  els.errorMsg.textContent = msg;
  setState("error");
}

function setLoadingMsg(msg) {
  els.loadingMsg.textContent = msg;
}

async function run({ force }) {
  setLoadingMsg("Reading article...");
  setState("loading");

  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (err) {
    console.error("[CivicSignal] tabs.query failed", err);
    showError("Could not access the current tab.");
    return;
  }

  if (!tab || !tab.id) {
    showError("No active tab found.");
    return;
  }

  if (!/^https?:/i.test(tab.url || "")) {
    showError(
      "CivicSignal only works on regular web pages (http/https). Try opening a news article."
    );
    return;
  }

  let extracted;
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    extracted = result?.result;
    console.log("[CivicSignal] extracted", extracted);
  } catch (err) {
    console.error("[CivicSignal] executeScript failed", err);
    showError(
      "Couldn't read this page. Some pages (Chrome internal pages, the Web Store, etc.) block extensions."
    );
    return;
  }

  if (!extracted || !extracted.text || extracted.text.length < 40) {
    showError(
      "Couldn't find enough article text on this page. Try a news article tab."
    );
    return;
  }

  setLoadingMsg("Analyzing article...");

  let response;
  try {
    response = await chrome.runtime.sendMessage({
      type: "ANALYZE",
      payload: {
        text: extracted.text,
        domain: extracted.domain,
        url: extracted.url,
        force,
      },
    });
  } catch (err) {
    console.error("[CivicSignal] sendMessage failed", err);
    showError("Background service worker is not responding. Reload the extension.");
    return;
  }

  console.log("[CivicSignal] bg response", response);

  if (!response?.ok) {
    if (response?.needsKey) {
      openSettings(response.error);
      return;
    }
    showError(response?.error || "Analysis failed for an unknown reason.");
    return;
  }

  lastResult = response.result;
  render(response.result, { cached: !!response.cached, source: extracted });
  setState("result");
}

function scoreColor(score) {
  if (score >= 70) return "green";
  if (score >= 40) return "amber";
  return "red";
}

function signalColor(value) {
  const pct = (value / 25) * 100;
  if (pct >= 70) return "green";
  if (pct >= 40) return "amber";
  return "red";
}

function render(result, { cached, source }) {
  // Election banner
  els.electionBanner.hidden = !result.election_related;

  // Score
  const color = scoreColor(result.score ?? 0);
  els.scoreRing.classList.remove("green", "amber", "red");
  els.scoreRing.classList.add(color);
  els.scoreValue.textContent = String(result.score ?? 0);

  // Verdict
  els.verdictBadge.classList.remove("green", "amber", "red");
  els.verdictBadge.classList.add(color);
  els.verdictBadge.textContent = result.verdict || "Unverifiable";

  // Summary
  els.summary.textContent = result.summary || "";

  // Signals
  els.signals.innerHTML = "";
  const signals = result.signals || {};
  const explanations = result.signal_explanations || {};
  for (const key of Object.keys(SIGNAL_LABELS)) {
    const value = Number(signals[key] ?? 0);
    const pct = Math.max(0, Math.min(100, (value / 25) * 100));
    const mbfcVerified = key === "source_credibility" && result.mbfc;
    const row = document.createElement("div");
    row.className = "signal";
    row.innerHTML = `
      <div class="signal-head">
        <span class="signal-name"></span>
        <span class="signal-value"></span>
      </div>
      <div class="signal-track">
        <div class="signal-fill ${signalColor(value)}" style="width: ${pct}%"></div>
      </div>
    `;
    row.querySelector(".signal-name").textContent = mbfcVerified
      ? `${SIGNAL_LABELS[key]} · MBFC verified`
      : SIGNAL_LABELS[key];
    row.querySelector(".signal-value").textContent = `${value} / 25`;
    const why = typeof explanations[key] === "string" ? explanations[key].trim() : "";
    if (why) {
      const p = document.createElement("p");
      p.className = "signal-why";
      p.textContent = why;
      row.appendChild(p);
    }
    els.signals.appendChild(row);
  }

  // Claims
  els.claims.innerHTML = "";
  const claims = Array.isArray(result.claims) ? result.claims : [];
  if (claims.length === 0) {
    const li = document.createElement("li");
    li.className = "claim";
    li.innerHTML = `<p class="claim-text">No claims were extracted.</p>`;
    els.claims.appendChild(li);
  } else {
    const RELEVANCE_LABELS = {
      Central: "Core claim",
      Supporting: "Context",
      Peripheral: "Side note",
    };
    for (const c of claims) {
      const li = document.createElement("li");
      li.className = "claim";
      const pillColor =
        c.status === "Supported"
          ? "green"
          : c.status === "Disputed"
            ? "red"
            : "amber";
      li.innerHTML = `
        <span class="pill ${pillColor}"></span>
        <div class="claim-body">
          <p class="claim-text"></p>
        </div>
      `;
      li.querySelector(".pill").textContent = c.status || "Unverified";
      li.querySelector(".claim-text").textContent = c.claim || "";
      const body = li.querySelector(".claim-body");
      if (RELEVANCE_LABELS[c.relevance]) {
        const tag = document.createElement("span");
        tag.className = `relevance-tag ${String(c.relevance).toLowerCase()}`;
        tag.textContent = RELEVANCE_LABELS[c.relevance];
        body.appendChild(tag);
      }
      if (c.note) {
        const note = document.createElement("p");
        note.className = "claim-note";
        note.textContent = c.note;
        body.appendChild(note);
      }
      els.claims.appendChild(li);
    }
  }

  // Meta
  const parts = [];
  if (source?.domain) parts.push(source.domain);
  if (typeof result.article_accuracy === "number") {
    parts.push(`article accuracy ${result.article_accuracy}/100`);
  }
  if (result.mbfc) {
    parts.push(`${result.mbfc.name}: ${result.mbfc.factualReporting} factual (MBFC)`);
  }
  if (source?.length) parts.push(`${source.length.toLocaleString()} chars analyzed`);
  if (cached) parts.push("cached");
  els.meta.textContent = parts.join(" · ");
}

async function copyJson() {
  if (!lastResult) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(lastResult, null, 2));
    const original = els.copy.textContent;
    els.copy.textContent = "Copied!";
    setTimeout(() => {
      els.copy.textContent = original;
    }, 1200);
  } catch (err) {
    console.error("[CivicSignal] clipboard failed", err);
  }
}
