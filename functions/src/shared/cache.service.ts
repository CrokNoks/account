import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Simple in-memory cache service for performance optimization
 * Provides LRU-like caching with TTL support
 */
@Injectable()
export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly logger = new Logger(CacheService.name);
  private readonly maxSize = 1000;
  private readonly defaultTTL = 300000; // 5 minutes in milliseconds

  /**
   * Get cached data
   * @param key - Cache key
   * @returns Cached data or null if expired/not found
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.logger.debug(`Cache expired for key: ${key}`);
      return null;
    }

    this.logger.debug(`Cache hit for key: ${key}`);
    return entry.data as T;
  }

  /**
   * Set data in cache
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time to live in milliseconds (optional)
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // Implement simple LRU by removing oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.logger.debug(`Cache evicted key: ${firstKey}`);
      }
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    };

    this.cache.set(key, entry);
    this.logger.debug(`Cache set for key: ${key}`);
  }

  /**
   * Delete cached data
   * @param key - Cache key to delete
   */
  delete(key: string): boolean {
    this.logger.debug(`Cache delete for key: ${key}`);
    return this.cache.delete(key);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
    this.logger.debug('Cache cleared');
  }

  /**
   * Get or set pattern - common caching pattern
   * @param key - Cache key
   * @param factory - Function to generate data if not cached
   * @param ttl - Optional TTL
   * @returns Data from cache or factory
   */
  async getOrSet<T>(
    key: string, 
    factory: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await factory();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Generate cache key from components
   * @param parts - Parts of the cache key
   * @returns Combined cache key
   */
  static generateKey(...parts: string[]): string {
    return parts.join(':');
  }

  /**
   * Invalidate cache entries by pattern
   * @param pattern - Pattern to match (simple string match)
   */
  invalidatePattern(pattern: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.logger.debug(`Cache invalidated for key: ${key}`);
    });
  }
}