import { ConfigModule } from '@nestjs/config';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  'postgresql://postgres:password@localhost:5432/nestjs_test_db?schema=public';
process.env.MONGODB_URI = 'mongodb://localhost:27017/nestjs_test_logs';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.THROTTLE_TTL = '60';
process.env.THROTTLE_LIMIT = '100';
process.env.LOG_LEVEL = 'error';

// Extend Jest timeout for e2e tests
jest.setTimeout(30000);
