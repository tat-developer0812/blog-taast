const store = new Map<string, { timestamps: number[]; windowMs: number }>();

/**
 * Sliding-window rate limiter.
 * Stores individual request timestamps per key, alongside the window size.
 * Returns { success, remaining }.
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  const entry = store.get(key) ?? { timestamps: [], windowMs };

  // Evict timestamps outside the current window
  const active = entry.timestamps.filter((t) => t > windowStart);

  if (active.length < maxRequests) {
    active.push(now);
    store.set(key, { timestamps: active, windowMs });
    return { success: true, remaining: maxRequests - active.length };
  }

  store.set(key, { timestamps: active, windowMs });
  return { success: false, remaining: 0 };
}

// Periodic cleanup: remove entries whose timestamps are all stale to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    store.forEach((entry, key) => {
      const active = entry.timestamps.filter((t) => t > now - entry.windowMs);
      if (active.length === 0) {
        store.delete(key);
      } else {
        store.set(key, { timestamps: active, windowMs: entry.windowMs });
      }
    });
  }, 60_000);
}
