/**
 * Counts failed logins per key (an IP, a username) and locks the key for a
 * while after too many. In memory: there is one server process, and a restart
 * clearing the counters is acceptable.
 */
export class LoginThrottle {
  private failures = new Map<string, { count: number; first: number; lockedUntil: number }>();

  constructor(
    private readonly maxFailures = 5,
    private readonly windowMs = 15 * 60_000,
    private readonly lockMs = 15 * 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Milliseconds left on a lock for any of the keys, or 0. */
  lockedFor(...keys: string[]): number {
    const t = this.now();
    return Math.max(0, ...keys.map((k) => (this.failures.get(k)?.lockedUntil ?? 0) - t));
  }

  fail(...keys: string[]) {
    const t = this.now();
    for (const key of keys) {
      const entry = this.failures.get(key);
      if (!entry || t - entry.first > this.windowMs) {
        this.failures.set(key, { count: 1, first: t, lockedUntil: 0 });
        continue;
      }
      entry.count++;
      if (entry.count >= this.maxFailures) entry.lockedUntil = t + this.lockMs;
    }
    if (this.failures.size > 10_000) this.prune(t);
  }

  succeed(...keys: string[]) {
    for (const key of keys) this.failures.delete(key);
  }

  private prune(t: number) {
    for (const [key, entry] of this.failures) {
      if (entry.lockedUntil < t && t - entry.first > this.windowMs) this.failures.delete(key);
    }
  }
}

const globalForThrottle = globalThis as unknown as { __lectioThrottle?: LoginThrottle };
export const loginThrottle = (globalForThrottle.__lectioThrottle ??= new LoginThrottle());
