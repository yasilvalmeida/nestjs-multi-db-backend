import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/config/prisma.service';

describe('API Integration (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();
  });

  beforeEach(async () => {
    // Clean up database
    await prismaService.user.deleteMany();

    // Register and login to get access token for protected routes
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser);

    accessToken = registerResponse.body.data.access_token;
  });

  afterAll(async () => {
    await prismaService.user.deleteMany();
    await prismaService.$disconnect();
    await app.close();
  });

  describe('/api/posts (GET)', () => {
    it('should get posts from external API', () => {
      return request(app.getHttpServer())
        .get('/api/v1/api/posts')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeInstanceOf(Array);
          if (res.body.data.length > 0) {
            expect(res.body.data[0]).toHaveProperty('id');
            expect(res.body.data[0]).toHaveProperty('title');
            expect(res.body.data[0]).toHaveProperty('body');
            expect(res.body.data[0]).toHaveProperty('userId');
          }
        });
    }, 10000); // Increased timeout for external API call

    it('should support cache parameter', () => {
      return request(app.getHttpServer())
        .get('/api/v1/api/posts?cache=false')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeInstanceOf(Array);
        });
    }, 10000);

    it('should work without authentication (public route)', () => {
      return request(app.getHttpServer()).get('/api/v1/api/posts').expect(200);
    }, 10000);
  });

  describe('/api/posts/:id (GET)', () => {
    it('should get a specific post by id', () => {
      return request(app.getHttpServer())
        .get('/api/v1/api/posts/1')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('id', 1);
          expect(res.body.data).toHaveProperty('title');
          expect(res.body.data).toHaveProperty('body');
          expect(res.body.data).toHaveProperty('userId');
        });
    }, 10000);

    it('should handle non-existent post', () => {
      return request(app.getHttpServer())
        .get('/api/v1/api/posts/999999')
        .expect(404);
    }, 10000);

    it('should validate post id parameter', () => {
      return request(app.getHttpServer())
        .get('/api/v1/api/posts/invalid')
        .expect(400);
    });
  });

  describe('/api/users (GET)', () => {
    it('should get users from external API with authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/api/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeInstanceOf(Array);
          if (res.body.data.length > 0) {
            expect(res.body.data[0]).toHaveProperty('id');
            expect(res.body.data[0]).toHaveProperty('name');
            expect(res.body.data[0]).toHaveProperty('username');
            expect(res.body.data[0]).toHaveProperty('email');
          }
        });
    }, 10000);

    it('should fail without authentication', () => {
      return request(app.getHttpServer()).get('/api/v1/api/users').expect(401);
    });
  });

  describe('/api/mock/posts (GET)', () => {
    it('should get mock posts data', () => {
      return request(app.getHttpServer())
        .get('/api/v1/api/mock/posts')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.data).toHaveLength(3);
          expect(res.body.data[0]).toHaveProperty('id');
          expect(res.body.data[0]).toHaveProperty('title');
          expect(res.body.data[0]).toHaveProperty('body');
          expect(res.body.data[0]).toHaveProperty('userId');
        });
    });

    it('should work without authentication (public route)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/api/mock/posts')
        .expect(200);
    });
  });

  describe('/api/mock/users (GET)', () => {
    it('should get mock users data', () => {
      return request(app.getHttpServer())
        .get('/api/v1/api/mock/users')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.data).toHaveLength(2);
          expect(res.body.data[0]).toHaveProperty('id');
          expect(res.body.data[0]).toHaveProperty('name');
          expect(res.body.data[0]).toHaveProperty('username');
          expect(res.body.data[0]).toHaveProperty('email');
        });
    });

    it('should work without authentication (public route)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/api/mock/users')
        .expect(200);
    });
  });
});
