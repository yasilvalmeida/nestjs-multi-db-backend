import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/config/prisma.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { Role } from '@prisma/client';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let adminAccessToken: string;
  let userAccessToken: string;
  let adminUserId: string;
  let regularUserId: string;

  const adminUser = {
    email: 'admin@example.com',
    username: 'adminuser',
    password: 'password123',
    firstName: 'Admin',
    lastName: 'User',
  };

  const regularUser = {
    email: 'regular@example.com',
    username: 'regularuser',
    password: 'password123',
    firstName: 'Regular',
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

    // Create admin user directly in database with ADMIN role
    const hashedPassword = await bcrypt.hash(adminUser.password, 12);
    const admin = await prismaService.user.create({
      data: {
        ...adminUser,
        password: hashedPassword,
        role: Role.ADMIN,
      },
    });
    adminUserId = admin.id;

    // Create regular user directly in database with USER role
    const regularHashedPassword = await bcrypt.hash(regularUser.password, 12);
    const regular = await prismaService.user.create({
      data: {
        ...regularUser,
        password: regularHashedPassword,
        role: Role.USER,
      },
    });
    regularUserId = regular.id;

    // Login as admin to get access token
    const adminLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminUser.email, password: adminUser.password });

    adminAccessToken = adminLoginResponse.body.data.access_token;

    // Login as regular user to get access token
    const userLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: regularUser.email, password: regularUser.password });

    userAccessToken = userLoginResponse.body.data.access_token;
  });

  afterAll(async () => {
    await prismaService.user.deleteMany();
    await prismaService.$disconnect();
    await app.close();
  });

  // =================== RBAC TESTS ===================

  describe('RBAC - Role-Based Access Control', () => {
    describe('Admin access', () => {
      it('should allow admin to list users', () => {
        return request(app.getHttpServer())
          .get('/api/v1/users')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.success).toBe(true);
            expect(res.body.data.data).toBeInstanceOf(Array);
          });
      });

      it('should allow admin to create users', () => {
        return request(app.getHttpServer())
          .post('/api/v1/users')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            email: 'newadmin@example.com',
            username: 'newadminuser',
            password: 'password123',
            firstName: 'New',
            lastName: 'Admin',
          })
          .expect(201);
      });

      it('should allow admin to update users', () => {
        return request(app.getHttpServer())
          .patch(`/api/v1/users/${regularUserId}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({ firstName: 'UpdatedName' })
          .expect(200);
      });

      it('should allow admin to delete users', async () => {
        // Create a user to delete
        const hashedPassword = await bcrypt.hash('password123', 12);
        const userToDelete = await prismaService.user.create({
          data: {
            email: 'delete@example.com',
            username: 'deleteuser',
            password: hashedPassword,
            firstName: 'Delete',
            lastName: 'Me',
            role: Role.USER,
          },
        });

        return request(app.getHttpServer())
          .delete(`/api/v1/users/${userToDelete.id}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);
      });
    });

    describe('Regular user access restrictions', () => {
      it('should deny regular user from listing users', () => {
        return request(app.getHttpServer())
          .get('/api/v1/users')
          .set('Authorization', `Bearer ${userAccessToken}`)
          .expect(403);
      });

      it('should deny regular user from creating users', () => {
        return request(app.getHttpServer())
          .post('/api/v1/users')
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({
            email: 'forbidden@example.com',
            username: 'forbiddenuser',
            password: 'password123',
            firstName: 'Forbidden',
            lastName: 'User',
          })
          .expect(403);
      });

      it('should deny regular user from updating other users', () => {
        return request(app.getHttpServer())
          .patch(`/api/v1/users/${adminUserId}`)
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({ firstName: 'Hacked' })
          .expect(403);
      });

      it('should deny regular user from deleting users', () => {
        return request(app.getHttpServer())
          .delete(`/api/v1/users/${adminUserId}`)
          .set('Authorization', `Bearer ${userAccessToken}`)
          .expect(403);
      });

      it('should deny regular user from deactivating users', () => {
        return request(app.getHttpServer())
          .patch(`/api/v1/users/${adminUserId}/deactivate`)
          .set('Authorization', `Bearer ${userAccessToken}`)
          .expect(403);
      });

      it('should deny regular user from activating users', () => {
        return request(app.getHttpServer())
          .patch(`/api/v1/users/${adminUserId}/activate`)
          .set('Authorization', `Bearer ${userAccessToken}`)
          .expect(403);
      });
    });

    describe('Unauthenticated access', () => {
      it('should deny unauthenticated access to users list', () => {
        return request(app.getHttpServer())
          .get('/api/v1/users')
          .expect(401);
      });

      it('should deny unauthenticated access to create user', () => {
        return request(app.getHttpServer())
          .post('/api/v1/users')
          .send({
            email: 'unauth@example.com',
            username: 'unauthuser',
            password: 'password123',
          })
          .expect(401);
      });
    });
  });

  // =================== EXISTING TESTS (with admin token) ===================

  describe('/users (GET)', () => {
    it('should get users list with admin authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.data).toBeInstanceOf(Array);
          expect(res.body.data.meta).toBeDefined();
          expect(res.body.data.meta.total).toBeGreaterThan(0);
        });
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users?page=1&limit=5')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.meta.page).toBe(1);
          expect(res.body.data.meta.limit).toBe(5);
        });
    });
  });

  describe('/users/:id (GET)', () => {
    it('should get user by id (admin)', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/users/${regularUserId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.id).toBe(regularUserId);
          expect(res.body.data.email).toBe(regularUser.email);
        });
    });

    it('should return null for invalid user id', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users/invalid-id')
        .set('Authorization', `Bearer ${adminAccessToken}`)
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

    it('should create a new user (admin)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(newUser)
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.email).toBe(newUser.email);
          expect(res.body.data.username).toBe(newUser.username);
        });
    });

    it('should fail with invalid email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ ...newUser, email: 'invalid-email' })
        .expect(400);
    });

    it('should fail with duplicate email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ ...newUser, email: adminUser.email, username: 'uniqueusername' })
        .expect(409);
    });
  });

  describe('/users/:id (PATCH)', () => {
    it('should update user (admin)', () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      return request(app.getHttpServer())
        .patch(`/api/v1/users/${regularUserId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
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
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ firstName: 'Test' })
        .expect(404); // User not found
    });
  });

  describe('/users/:id/deactivate (PATCH)', () => {
    it('should deactivate user (admin)', () => {
      return request(app.getHttpServer())
        .patch(`/api/v1/users/${regularUserId}/deactivate`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.isActive).toBe(false);
        });
    });
  });

  describe('/users/:id/activate (PATCH)', () => {
    it('should activate user (admin)', async () => {
      // First deactivate the user
      await request(app.getHttpServer())
        .patch(`/api/v1/users/${regularUserId}/deactivate`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      // Then activate the user
      return request(app.getHttpServer())
        .patch(`/api/v1/users/${regularUserId}/activate`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.isActive).toBe(true);
        });
    });
  });

  describe('/users/:id (DELETE)', () => {
    it('should delete user (admin)', async () => {
      // Create a user to delete
      const hashedPassword = await bcrypt.hash('password123', 12);
      const userToDelete = await prismaService.user.create({
        data: {
          email: 'todelete@example.com',
          username: 'todeleteuser',
          password: hashedPassword,
          firstName: 'To',
          lastName: 'Delete',
          role: Role.USER,
        },
      });

      return request(app.getHttpServer())
        .delete(`/api/v1/users/${userToDelete.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);
    });

    it('should fail with invalid user id', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/users/invalid-id')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404); // User not found
    });
  });
});
