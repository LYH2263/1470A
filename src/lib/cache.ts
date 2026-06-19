interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class InMemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 60 * 1000;

  set<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data, expiresAt });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  clearPattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

export const cache = new InMemoryCache();

export const CACHE_KEYS = {
  SYSTEM_STATUS: 'system:status',
  ANNOUNCEMENTS_ACTIVE: 'announcements:active',
  MAINTENANCE_MODE: 'maintenance:mode',
} as const;

export const CACHE_TTL = {
  SHORT: 10 * 1000,
  MEDIUM: 60 * 1000,
  LONG: 5 * 60 * 1000,
} as const;
