import NodeCache from 'node-cache';
import { config } from '../config/env';

/**
 * Lightweight in-memory cache to avoid hammering the GitHub API
 * (and our DB) when the same username is analyzed repeatedly in a
 * short window. Not distributed — fine for a single-instance service;
 * swap for Redis if this needs to scale horizontally.
 */
const cache = new NodeCache({
  stdTTL: config.cache.ttlSeconds,
  checkperiod: 60,
});

export const cacheService = {
  get<T>(key: string): T | undefined {
    return cache.get<T>(key);
  },
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    if (ttlSeconds !== undefined) {
      cache.set(key, value, ttlSeconds);
    } else {
      cache.set(key, value);
    }
  },
  del(key: string): void {
    cache.del(key);
  },
  flush(): void {
    cache.flushAll();
  },
};
