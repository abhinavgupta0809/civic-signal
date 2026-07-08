import { extractFromHtml } from "@extractus/article-extractor";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Server-side article extraction from a user-supplied URL.
 *
 * A public endpoint that fetches arbitrary URLs is an SSRF risk, so this does
 * its OWN guarded fetch (protocol allow-list, DNS resolution + private-IP block
 * on every redirect hop, timeout, and a response-size cap) and only then hands
 * the HTML to the extractor. That keeps all network egress under our control
 * instead of delegating it to the library.
 */

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 2_000_000; // 2 MB of HTML is plenty for an article
const MAX_REDIRECTS = 3;
const MAX_CHARS = 6000; // matches the model input cap in lib/anthropic.ts
const MIN_USABLE_CHARS = 200;

/**
 * Browser-like request headers. A generic "bot" user-agent gets 403'd by many
 * mainstream publishers (Daily Mail, Bloomberg, etc.), so we mirror a normal
 * desktop Chrome request to retrieve the same public article HTML a reader
 * would see. This does not bypass paywalls or logins.
 */
const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  pragma: "no-cache",
  "sec-ch-ua": '"Chromium";v="125", "Google Chrome";v="125", "Not-A.Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
};

/** Thrown for user-fixable problems (bad URL, blocked host, no readable text). */
export class ExtractError extends Error {}

export interface ExtractedArticle {
  text: string;
  title: string;
  domain: string;
}

/** True for IPs we must never fetch (loopback, private, link-local, reserved). */
function isBlockedIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isBlockedIpv4(ip);
  if (v === 6) return isBlockedIpv6(ip);
  return true; // unparseable -> treat as blocked
}

function isBlockedIpv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0) return true; // 0.0.0.0/8 (this network / unspecified)
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 special-use
  if (a >= 224) return true; // multicast + reserved (224.0.0.0/3)
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  // IPv4-mapped/embedded (::ffff:1.2.3.4) — validate the embedded v4.
  const mapped = lower.match(/:((?:\d{1,3}\.){3}\d{1,3})$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  const head = lower.split(":")[0];
  if (head.startsWith("fe8") || head.startsWith("fe9") || head.startsWith("fea") || head.startsWith("feb"))
    return true; // fe80::/10 link-local
  if (head.startsWith("fc") || head.startsWith("fd")) return true; // fc00::/7 unique-local
  return false;
}

/** Rejects a URL whose host resolves to any non-public address. */
async function assertPublicHost(hostname: string): Promise<void> {
  // A literal IP host is checked directly; a name is resolved to all its IPs.
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new ExtractError("That address isn't allowed.");
    return;
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(hostname, { all: true });
  } catch {
    throw new ExtractError("Couldn't resolve that site's address.");
  }
  if (addrs.length === 0 || addrs.some((a) => isBlockedIp(a.address))) {
    throw new ExtractError("That address isn't allowed.");
  }
}

function parseAndValidate(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new ExtractError("That doesn't look like a valid URL. Include https://");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ExtractError("Only http and https links are supported.");
  }
  return url;
}

/** Reads a response body up to MAX_BYTES, aborting if it grows past the cap. */
async function readCapped(res: Response): Promise<string> {
  const len = Number(res.headers.get("content-length"));
  if (Number.isFinite(len) && len > MAX_BYTES) {
    throw new ExtractError("That page is too large to analyze.");
  }
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.length;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new ExtractError("That page is too large to analyze.");
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Fetches HTML with manual redirect handling so every hop is re-validated. */
async function guardedFetchHtml(startUrl: URL): Promise<{ html: string; finalUrl: URL }> {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        // Send browser-like headers. Many major news sites (Daily Mail,
        // Bloomberg, etc.) return 403 to obvious bot user-agents, so we present
        // as a normal desktop Chrome request to fetch the same public HTML a
        // reader's browser would get.
        headers: BROWSER_HEADERS,
      });
    } catch (err) {
      if (err instanceof ExtractError) throw err;
      throw new ExtractError("Couldn't reach that page. Try pasting the text instead.");
    } finally {
      clearTimeout(timer);
    }

    // Follow redirects ourselves, re-validating the destination each time.
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next = new URL(res.headers.get("location")!, url);
      if (next.protocol !== "http:" && next.protocol !== "https:") {
        throw new ExtractError("That link redirects somewhere unsupported.");
      }
      url = next;
      continue;
    }
    if (!res.ok) {
      throw new ExtractError(`That page returned an error (HTTP ${res.status}). Try pasting the text.`);
    }
    const ctype = res.headers.get("content-type") ?? "";
    if (ctype && !/(text\/html|xml|text\/plain)/i.test(ctype)) {
      throw new ExtractError("That link isn't an article page. Try pasting the text instead.");
    }
    return { html: await readCapped(res), finalUrl: url };
  }
  throw new ExtractError("That link redirected too many times.");
}

/** Collapses HTML to whitespace-normalized plain text. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * ESPN serves an empty HTTP 202 to non-browser clients, so scraping the page
 * is a dead end — but its public content API returns the full story JSON.
 * The story ID is digits extracted from the URL, so the API URL we build is
 * fixed-host and safe. Returns null when the URL isn't an ESPN story.
 */
async function fetchEspnStory(url: URL): Promise<ExtractedArticle | null> {
  if (!/(^|\.)espn\.com$/.test(url.hostname)) return null;
  const idMatch = url.pathname.match(/\/id\/(\d+)/);
  if (!idMatch) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(
      `https://now.core.api.espn.com/v1/sports/news/${idMatch[1]}`,
      { signal: controller.signal, headers: { accept: "application/json" } }
    );
  } catch {
    return null; // fall through to the generic path
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) return null;

  try {
    const data = (await res.json()) as {
      headlines?: Array<{ headline?: string; story?: string; description?: string }>;
    };
    const item = data.headlines?.[0];
    const story = item?.story || item?.description || "";
    const text = htmlToText(story).slice(0, MAX_CHARS);
    if (text.length < MIN_USABLE_CHARS) return null;
    return {
      text,
      title: item?.headline?.trim() ?? "",
      domain: "espn.com",
    };
  } catch {
    return null;
  }
}

/**
 * Fetches a URL and returns readable article text plus the source domain
 * (which enables MBFC grounding automatically). Throws ExtractError with a
 * user-facing message when the URL is invalid, blocked, or yields no article.
 */
export async function fetchArticle(rawUrl: string): Promise<ExtractedArticle> {
  const url = parseAndValidate(rawUrl);

  const espn = await fetchEspnStory(url);
  if (espn) return espn;

  const { html, finalUrl } = await guardedFetchHtml(url);

  let text = "";
  let title = "";
  try {
    const article = await extractFromHtml(html, finalUrl.href);
    if (article?.content) text = htmlToText(article.content);
    if (article?.title) title = article.title.trim();
  } catch {
    // fall through to the raw-HTML fallback below
  }

  // Fallback: if the extractor found little, strip the whole document.
  if (text.length < MIN_USABLE_CHARS) {
    const stripped = htmlToText(html);
    if (stripped.length > text.length) text = stripped;
  }

  text = text.slice(0, MAX_CHARS);
  if (text.length < MIN_USABLE_CHARS) {
    throw new ExtractError(
      "Couldn't pull enough readable text from that page (it may be paywalled or JavaScript-heavy). Paste the article text instead."
    );
  }

  return { text, title, domain: finalUrl.hostname.replace(/^www\./, "") };
}
