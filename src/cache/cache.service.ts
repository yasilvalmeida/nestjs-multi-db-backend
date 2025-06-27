import {
  Injectable,
  Logger,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.cacheManager.get<T>(key);
      if (data) {
        this.logger.debug(`Cache hit for key: ${key}`);
      } else {
        this.logger.debug(`Cache miss for key: ${key}`);
      }
      return data || null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting cache for key ${key}:`, errorMessage);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.cacheManager.set(key, value, ttl * 1000);
      } else {
        await this.cacheManager.set(key, value);
      }
      this.logger.debug(`Cache set for key: ${key}, TTL: ${ttl || 'default'}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error setting cache for key ${key}:`, errorMessage);
      throw new InternalServerErrorException('Cache operation failed');
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache deleted for key: ${key}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error deleting cache for key ${key}:`, errorMessage);
    }
  }

  async wrap<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
    try {
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      const result = await fn();
      await this.set(key, result, ttl);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error in cache wrap for key ${key}:`, errorMessage);
      // Return fresh data even if cache fails
      return await fn();
    }
  }

  async reset(): Promise<void> {
    try {
      // Use store property to access reset if available
      const store = (this.cacheManager as any).store;
      if (store && typeof store.reset === 'function') {
        await store.reset();
      } else if (typeof (this.cacheManager as any).reset === 'function') {
        await (this.cacheManager as any).reset();
      } else {
        this.logger.warn('Cache reset method not available');
        return;
      }
      this.logger.log('Cache reset successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Error resetting cache:', errorMessage);
    }
  }

  // Retry logic for cache operations
  async withRetry<T>(
    operation: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000,
  ): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `Cache operation failed (attempt ${i + 1}/${retries}):`,
          errorMessage,
        );

        if (i === retries - 1) {
          throw error;
        }

        await this.sleep(delay * Math.pow(2, i)); // Exponential backoff
      }
    }
    throw new Error('Max retries exceeded');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
