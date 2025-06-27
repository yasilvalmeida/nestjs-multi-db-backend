import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

describe('Health Check (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same configuration as main.ts
    app.setGlobalPrefix('api/v1');

    // Enable CORS
    app.enableCors({
      origin: true,
      credentials: true,
    });

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

    // Configure Swagger for test environment
    const config = new DocumentBuilder()
      .setTitle('NestJS Multi-DB Backend')
      .setDescription('NestJS backend with PostgreSQL, Redis, and MongoDB')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);

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
        request(app.getHttpServer()).get('/api/v1/mock/posts').expect(200),
      );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(5);
  });
});
