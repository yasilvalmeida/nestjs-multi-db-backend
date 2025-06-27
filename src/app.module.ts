import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { MongooseModule } from '@nestjs/mongoose';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

// Configuration
import { DatabaseModule } from './config/database.module';
import { RedisModule } from './config/redis.module';
import { CacheModule } from './cache/cache.module';

// Tech stack modules
import { OpenAIModule } from './openai/openai.module';
import { PocketBaseModule } from './pocketbase/pocketbase.module';

// Feature modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ApiModule } from './api/api.module';
import { LogsModule } from './logs/logs.module';
import { BookmakersModule } from './bookmakers/bookmakers.module';

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
          }),
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

    // MongoDB for logging
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/nestjs_logs',
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
    }),

    // Database and cache modules
    DatabaseModule,
    RedisModule,
    CacheModule,

    // Tech stack modules
    OpenAIModule,
    PocketBaseModule,

    // Feature modules
    AuthModule,
    UsersModule,
    ApiModule,
    LogsModule,
    BookmakersModule,
  ],
})
export class AppModule {}
