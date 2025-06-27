import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/config/prisma.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { LogsService } from '../src/logs/logs.service';

describe('Logs (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let logsService: LogsService;
  let accessToken: string;

  const testUser = {
    email: 'test@example.com',
    username: 'testuser',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same configuration as main.ts
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    logsService = moduleFixture.get<LogsService>(LogsService);

    await app.init();
  });

  beforeEach(async () => {
    // Clean up databases
    await prismaService.user.deleteMany();

    // Clean up MongoDB logs - this might fail if MongoDB is not available
    try {
      await (logsService as any).logModel.deleteMany({});
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.warn('Could not clean MongoDB logs:', errorMessage);
    }

    // Register and login to get access token
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser);

    accessToken = registerResponse.body.data.access_token;
  });

  afterAll(async () => {
    await prismaService.user.deleteMany();
    try {
      await (logsService as any).logModel.deleteMany({});
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.warn('Could not clean MongoDB logs:', errorMessage);
    }
    await prismaService.$disconnect();
    await app.close();
  });

  describe('/logs (POST)', () => {
    const testLog = {
      level: 'info',
      message: 'Test log message',
      service: 'test-service',
      userId: 'test-user-id',
    };

    it('should create a new log entry', () => {
      return request(app.getHttpServer())
        .post('/api/v1/logs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(testLog)
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.level).toBe(testLog.level);
          expect(res.body.data.message).toBe(testLog.message);
          expect(res.body.data.service).toBe(testLog.service);
        });
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .post('/api/v1/logs')
        .send(testLog)
        .expect(401);
    });

    it('should fail with invalid log data', () => {
      return request(app.getHttpServer())
        .post('/api/v1/logs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ invalidField: 'test' })
        .expect(400);
    });
  });

  describe('/logs (GET)', () => {
    beforeEach(async () => {
      // Create some test logs
      const testLogs = [
        {
          level: 'info',
          message: 'First test log',
          service: 'test-service',
        },
        {
          level: 'error',
          message: 'Error test log',
          service: 'error-service',
        },
        {
          level: 'warn',
          message: 'Warning test log',
          service: 'test-service',
        },
      ];

      try {
        for (const log of testLogs) {
          await request(app.getHttpServer())
            .post('/api/v1/logs')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(log);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.warn('Could not create test logs:', errorMessage);
      }
    });

    it('should get logs list with authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/logs')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.logs).toBeInstanceOf(Array);
          expect(res.body.data.total).toBeDefined();
          expect(res.body.data.page).toBeDefined();
          expect(res.body.data.totalPages).toBeDefined();
        });
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer()).get('/api/v1/logs').expect(401);
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/api/v1/logs?page=1&limit=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.page).toBe(1);
        });
    });

    it('should support filtering by level', () => {
      return request(app.getHttpServer())
        .get('/api/v1/logs?level=error')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.logs).toBeInstanceOf(Array);
        });
    });

    it('should support filtering by service', () => {
      return request(app.getHttpServer())
        .get('/api/v1/logs?service=test-service')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.logs).toBeInstanceOf(Array);
        });
    });

    it('should support search functionality', () => {
      return request(app.getHttpServer())
        .get('/api/v1/logs?search=test')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.logs).toBeInstanceOf(Array);
        });
    });
  });

  describe('/logs/statistics (GET)', () => {
    it('should get log statistics', () => {
      return request(app.getHttpServer())
        .get('/api/v1/logs/statistics')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.total).toBeDefined();
          expect(res.body.data.byLevel).toBeDefined();
          expect(res.body.data.recent24h).toBeDefined();
          expect(res.body.data.topServices).toBeDefined();
        });
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/logs/statistics')
        .expect(401);
    });
  });

  describe('/logs/cleanup/:days (DELETE)', () => {
    it('should cleanup old logs', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/logs/cleanup/30')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(typeof res.body.data).toBe('number');
        });
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/logs/cleanup/30')
        .expect(401);
    });

    it('should validate days parameter', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/logs/cleanup/invalid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });
});
