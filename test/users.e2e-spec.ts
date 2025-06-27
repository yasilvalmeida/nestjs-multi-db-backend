import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/config/prisma.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let accessToken: string;
  let userId: string;

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

    await app.init();
  });

  beforeEach(async () => {
    // Clean up database
    await prismaService.user.deleteMany();

    // Register and login to get access token
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser);

    accessToken = registerResponse.body.data.access_token;
    userId = registerResponse.body.data.user.id;
  });

  afterAll(async () => {
    await prismaService.user.deleteMany();
    await prismaService.$disconnect();
    await app.close();
  });

  describe('/users (GET)', () => {
    it('should get users list with authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.data).toBeInstanceOf(Array);
          expect(res.body.data.meta).toBeDefined();
          expect(res.body.data.meta.total).toBeGreaterThan(0);
        });
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer()).get('/api/v1/users').expect(401);
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users?page=1&limit=5')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.meta.page).toBe(1);
          expect(res.body.data.meta.limit).toBe(5);
        });
    });
  });

  describe('/users/:id (GET)', () => {
    it('should get user by id', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.id).toBe(userId);
          expect(res.body.data.email).toBe(testUser.email);
        });
    });

    it('should fail with invalid user id', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users/invalid-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeNull(); // User not found returns null
        });
    });
  });

  describe('/users (POST)', () => {
    const newUser = {
      email: 'newuser@example.com',
      username: 'newuser',
      password: 'password123',
      firstName: 'New',
      lastName: 'User',
    };

    it('should create a new user', () => {
      return request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(newUser)
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.email).toBe(newUser.email);
          expect(res.body.data.username).toBe(newUser.username);
          expect(res.body.data.password).toBeDefined(); // Raw password in response
        });
    });

    it('should fail with invalid email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...newUser, email: 'invalid-email' })
        .expect(400);
    });

    it('should fail with duplicate email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...newUser, email: testUser.email })
        .expect(409);
    });
  });

  describe('/users/:id (PATCH)', () => {
    it('should update user', () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      return request(app.getHttpServer())
        .patch(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.firstName).toBe(updateData.firstName);
          expect(res.body.data.lastName).toBe(updateData.lastName);
        });
    });

    it('should fail with invalid user id', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/users/invalid-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ firstName: 'Test' })
        .expect(404); // User not found
    });
  });

  describe('/users/:id/deactivate (PATCH)', () => {
    it('should deactivate user', () => {
      return request(app.getHttpServer())
        .patch(`/api/v1/users/${userId}/deactivate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.isActive).toBe(false);
        });
    });
  });

  describe('/users/:id/activate (PATCH)', () => {
    it('should activate user', async () => {
      // Create a second user for activation test
      const secondUser = {
        email: 'second@example.com',
        username: 'seconduser',
        password: 'password123',
        firstName: 'Second',
        lastName: 'User',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(secondUser)
        .expect(201);

      const secondUserId = createResponse.body.data.id;

      // First deactivate the second user
      await request(app.getHttpServer())
        .patch(`/api/v1/users/${secondUserId}/deactivate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Then activate the second user (using the original user's token)
      return request(app.getHttpServer())
        .patch(`/api/v1/users/${secondUserId}/activate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.isActive).toBe(true);
        });
    });
  });

  describe('/users/:id (DELETE)', () => {
    it('should delete user', () => {
      return request(app.getHttpServer())
        .delete(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should fail with invalid user id', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/users/invalid-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404); // User not found
    });
  });
});
