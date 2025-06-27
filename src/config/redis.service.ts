import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;

  constructor(private configService: ConfigService) {
    this.client = createClient({
      socket: {
        host: this.configService.get<string>('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
      },
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis client error:', error);
    });

    this.client.on('connect', () => {
      this.logger.log('✅ Connected to Redis');
    });

    this.client.on('disconnect', () => {
      this.logger.log('📴 Disconnected from Redis');
    });
  }

  async onModuleInit() {
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.error('❌ Failed to connect to Redis', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.client.disconnect();
  }

  getClient(): RedisClientType {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async flushAll(): Promise<void> {
    await this.client.flushAll();
  }
}
