# CivicSignal — Chrome extension (standalone build)

Unofficial, unpublished Manifest V3 extension. It runs the full CivicSignal
credibility pipeline inside your browser and calls the Anthropic API directly
with **your own API key** — it does not use the hosted website or any other
server.

## Install (developer mode)

1. Get an Anthropic API key (`sk-ant-…`) at <https://console.anthropic.com/>
   and add a small amount of credit. Analyses run on Claude Haiku and cost a
   fraction of a cent each.
2. Open `chrome://extensions`, toggle **Developer mode** (top right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Click the CivicSignal toolbar icon — paste your key on the first-run
   screen and hit **Save key**.
5. Open any news article and click the icon to analyze the page.

## Your key stays local

- Stored in `chrome.storage.local` on your machine only.
- Sent exclusively to `https://api.anthropic.com` — the only origin in this
  extension's `host_permissions` (see `manifest.json`).
- Change or remove it any time via the ⚙ button in the popup.

Prefer not to use your own key? Use the hosted website instead — see the
[main README](../README.md).
