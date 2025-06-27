import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { MongooseModule } from '@nestjs/mongoose';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

// Configuration
import { DatabaseModule } from './config/database.module';
import { RedisModule } from './config/redis.module';

// Feature modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ApiModule } from './api/api.module';
import { LogsModule } from './logs/logs.module';
import { CacheService } from './cache/cache.service';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            ttl: parseInt(process.env.THROTTLE_TTL || '60') * 1000,
            limit: parseInt(process.env.THROTTLE_LIMIT || '10'),
          },
        ],
      }),
    }),

    // Winston Logger
    WinstonModule.forRootAsync({
      useFactory: () => ({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, stack }) => {
            return `${timestamp} [${level}]: ${message}${
              stack ? '\n' + stack : ''
            }`;
          })
        ),
        transports: [
          new winston.transports.Console(),
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
          }),
          new winston.transports.File({ filename: 'logs/combined.log' }),
        ],
      }),
    }),

    // Cache (Redis)
    CacheModule.registerAsync({
      useFactory: () => ({
        store: 'redis',
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        ttl: 300, // 5 minutes default TTL
      }),
    }),

    // MongoDB for logging
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/nestjs_logs',
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
    }),

    // Database modules
    DatabaseModule,
    RedisModule,

    // Feature modules
    AuthModule,
    UsersModule,
    ApiModule,
    LogsModule,
  ],
  providers: [CacheService],
})
export class AppModule {}
