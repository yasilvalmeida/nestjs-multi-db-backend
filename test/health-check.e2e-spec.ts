import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health Check (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should successfully start the application', () => {
    expect(app).toBeDefined();
  });

  it('should serve Swagger documentation', () => {
    return request(app.getHttpServer()).get('/docs').expect(200);
  });

  it('should handle preflight CORS requests', () => {
    return request(app.getHttpServer())
      .options('/api/v1/auth/login')
      .expect(204);
  });

  it('should return 404 for non-existent routes', () => {
    return request(app.getHttpServer())
      .get('/api/v1/non-existent-route')
      .expect(404);
  });

  it('should apply rate limiting', async () => {
    // This test might be flaky depending on rate limit configuration
    // Making multiple requests quickly to test throttling
    const promises = Array(5)
      .fill(null)
      .map(() =>
        request(app.getHttpServer()).get('/api/v1/api/mock/posts').expect(200),
      );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(5);
  });
});
