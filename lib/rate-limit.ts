/**
 * In-memory rate limiting and a global daily budget kill-switch.
 *
 * This protects the Anthropic key when the app is hosted on a public URL:
 * every analysis spends real money, so we cap how often any single client can
 * trigger one and hard-stop the whole service once a daily budget of analyses
 * is reached.
 *
 * Storage is a process-local Map, which is the right fit for a single-process
 * deployment (Replit Reserved VM, `next start`, or one Node instance). If you
 * scale to multiple instances (e.g. Replit Autoscale with >1 machine), each
 * instance keeps its own counters, so effective limits multiply by instance
 * count — move these counters to a shared store (e.g. Upstash Redis) if that
 * matters. For a portfolio demo, in-memory is intentional and sufficient.
 *
 * All limits are tunable via env vars (see defaults below).
 */

const MINUTE = 60_000;
const DAY = 86_400_000;

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

/** Max analyses one IP may run per rolling minute. */
const IP_PER_MIN = envInt("RATE_IP_PER_MIN", 8);
/** Max analyses one IP may run per rolling day. */
const IP_PER_DAY = envInt("RATE_IP_PER_DAY", 40);
/** Hard cap on total analyses across all clients per day (budget kill-switch). */
const GLOBAL_PER_DAY = envInt("RATE_GLOBAL_PER_DAY", 500);

interface Counter {
  count: number;
  /** Epoch ms at which this window resets. */
  resetAt: number;
}

const perIpMinute = new Map<string, Counter>();
const perIpDay = new Map<string, Counter>();
let globalDay: Counter = { count: 0, resetAt: 0 };

/**
 * Increments a windowed counter and reports whether it stayed within `limit`.
 * A fresh window is started whenever the current one has expired.
 */
function bump(
  store: Map<string, Counter>,
  key: string,
  limit: number,
  windowMs: number,
  now: number
): { ok: boolean; retryAfter: number } {
  let c = store.get(key);
  if (!c || now >= c.resetAt) {
    c = { count: 0, resetAt: now + windowMs };
    store.set(key, c);
  }
  if (c.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((c.resetAt - now) / 1000)) };
  }
  c.count += 1;
  return { ok: true, retryAfter: 0 };
}

/**
 * Opportunistically drops expired entries so the Maps don't grow without
 * bound on a long-running server. Cheap and only runs when a Map gets large.
 */
function sweep(store: Map<string, Counter>, now: number): void {
  if (store.size < 5000) return;
  for (const [key, c] of store) {
    if (now >= c.resetAt) store.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** HTTP status to return when blocked. */
  status: number;
  /** User-facing message when blocked. */
  error: string;
  /** Seconds until the client may retry (for a Retry-After header). */
  retryAfter: number;
}

/**
 * Checks (and records) a single analysis request against all limits. Call this
 * immediately before the paid Claude call. The global budget is checked first
 * so a saturated day short-circuits everyone; then per-IP minute and day.
 */
export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const key = ip || "unknown";

  // Global daily budget (kill-switch).
  if (now >= globalDay.resetAt) {
    globalDay = { count: 0, resetAt: now + DAY };
  }
  if (globalDay.count >= GLOBAL_PER_DAY) {
    return {
      ok: false,
      status: 429,
      error:
        "CivicSignal has hit its daily analysis budget. Please try again tomorrow, or run it locally with your own API key.",
      retryAfter: Math.max(1, Math.ceil((globalDay.resetAt - now) / 1000)),
    };
  }

  sweep(perIpMinute, now);
  sweep(perIpDay, now);

  const minute = bump(perIpMinute, key, IP_PER_MIN, MINUTE, now);
  if (!minute.ok) {
    return {
      ok: false,
      status: 429,
      error: "You're analyzing a bit fast. Please wait a moment and try again.",
      retryAfter: minute.retryAfter,
    };
  }

  const day = bump(perIpDay, key, IP_PER_DAY, DAY, now);
  if (!day.ok) {
    return {
      ok: false,
      status: 429,
      error:
        "You've reached today's analysis limit for this tool. Please try again tomorrow.",
      retryAfter: day.retryAfter,
    };
  }

  // Only count against the global budget once a request clears per-IP checks.
  globalDay.count += 1;

  return { ok: true, status: 200, error: "", retryAfter: 0 };
}

/**
 * Extracts the client IP from proxy headers. Replit and most hosts set
 * `x-forwarded-for`.
 *
 * We take the LAST entry, not the first: each proxy appends the address it
 * received the connection from, so the last entry was written by our own
 * trusted proxy, while earlier entries can be freely spoofed by the client
 * to rotate identities and bypass per-IP limits.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",");
    const last = parts[parts.length - 1]?.trim();
    if (last) return last;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
