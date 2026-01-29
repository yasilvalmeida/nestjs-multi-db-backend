# NestJS Multi-Database Backend

A production-ready NestJS boilerplate demonstrating multi-database architecture with PostgreSQL, Redis, MongoDB, and PocketBase. Features JWT authentication, RBAC, comprehensive logging, and 100% test coverage. Designed for fintech, analytics platforms, or any application requiring scalable, observable infrastructure.

---

## 1. Project Overview

### The Problem

Modern applications often need multiple database technologies:
- Relational data requires PostgreSQL for ACID compliance
- Caching and rate limiting need Redis for speed
- Logging and analytics benefit from MongoDB's flexibility
- Real-time sync may require specialized solutions like PocketBase

Setting up this multi-database architecture with proper authentication, testing, and observability is complex and time-consuming.

### The Solution

This boilerplate provides a fully configured NestJS backend with four database integrations, JWT authentication, role-based access control, and production-ready observability. Everything is containerized with Docker Compose for easy local development and deployment.

### Why It Matters

- **Multi-database ready**: PostgreSQL, Redis, MongoDB, PocketBase all configured
- **100% test coverage**: 59 tests across 6 suites, all passing
- **Production patterns**: Rate limiting, logging, health checks, graceful shutdown
- **Developer experience**: Swagger docs, admin UIs, hot reloading
- **Security**: JWT auth, RBAC, input validation

---

## 2. Real-World Use Cases

| Industry | Application |
|----------|-------------|
| **Fintech** | Transaction processing (PostgreSQL) with real-time cache (Redis) and audit logs (MongoDB) |
| **Analytics Platforms** | Structured data + flexible event logging + real-time sync |
| **E-Commerce** | User data + session caching + activity tracking |
| **Healthcare** | Patient records + cache layer + compliance logging |
| **SaaS Products** | Multi-tenant data + rate limiting + usage analytics |
| **IoT Platforms** | Device registry + real-time state + time-series logs |

---

## 3. Core Features

| Feature | Business Value |
|---------|----------------|
| **Multi-Database Architecture** | Right database for each use case—no compromises |
| **JWT Authentication** | Secure, stateless authentication with refresh tokens |
| **Role-Based Access Control** | Admin and user roles with permission enforcement |
| **Redis Rate Limiting** | Protect APIs from abuse, control costs |
| **MongoDB Logging** | Flexible, queryable application logs |
| **PocketBase Sync** | Real-time data synchronization option |
| **100% Test Coverage** | Confidence in code quality and reliability |
| **Docker Ready** | Consistent environments from dev to production |

---

## 4. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      NestJS Application                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Auth Module  │    │ Users Module │    │External APIs │       │
│  │              │    │              │    │              │       │
│  │ • JWT Auth   │    │ • CRUD Ops   │    │ • Caching    │       │
│  │ • Refresh    │    │ • RBAC       │    │ • Rate Limit │       │
│  │ • Register   │    │ • Activation │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│           │                   │                   │              │
│           └───────────────────┼───────────────────┘              │
│                               │                                  │
└───────────────────────────────┼──────────────────────────────────┘
                                │
    ┌───────────────────────────┼───────────────────────────┐
    │                           │                           │
┌───▼───┐   ┌───────┐   ┌───────▼───────┐   ┌──────────────┐
│Postgre│   │ Redis │   │   MongoDB     │   │  PocketBase  │
│  SQL  │   │       │   │               │   │              │
│       │   │       │   │               │   │              │
│Users  │   │Cache  │   │Logs           │   │Real-time     │
│Data   │   │Rate   │   │Events         │   │Sync          │
│       │   │Limit  │   │               │   │              │
└───────┘   └───────┘   └───────────────┘   └──────────────┘
```

---

## 5. Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | NestJS 10 | Modular, scalable Node.js framework |
| **Language** | TypeScript | Type safety and DX |
| **Primary DB** | PostgreSQL + Prisma | Relational data with ORM |
| **Cache** | Redis | Session cache, rate limiting |
| **Logs** | MongoDB | Flexible application logging |
| **Real-time** | PocketBase | Optional real-time sync |
| **Auth** | JWT + Passport | Secure authentication |
| **Docs** | Swagger/OpenAPI | Interactive API documentation |
| **Testing** | Jest | Unit and E2E tests |
| **DevOps** | Docker Compose | Local development environment |

---

## 6. How the System Works

### Authentication Flow

```
Register/Login → Validate Credentials → Generate JWT → Secure Endpoints
```

1. **Register**: Create user with hashed password in PostgreSQL
2. **Login**: Validate credentials, return JWT token
3. **Request**: Include JWT in Authorization header
4. **Verify**: Passport validates token, attaches user to request
5. **Authorize**: RBAC guards check role permissions

### Multi-Database Usage

```
Request → NestJS Controller → Service Layer → Appropriate Database
```

| Operation | Database | Reason |
|-----------|----------|--------|
| User CRUD | PostgreSQL | ACID compliance, relations |
| Session Cache | Redis | Speed, TTL support |
| Request Logs | MongoDB | Flexible schema, analytics |
| Real-time Sync | PocketBase | WebSocket support |

### Rate Limiting

```
Request → Redis Check → Allow/Deny → Log Event
```

---

## 7. Setup & Run

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm or yarn

### Quick Start

```bash
# Clone repository
git clone https://github.com/your-org/nestjs-multi-db-backend.git
cd nestjs-multi-db-backend

# Install dependencies
npm install

# Start databases
docker-compose up -d postgres redis mongodb pocketbase

# Run Prisma migrations
npx prisma generate
npx prisma migrate dev --name init

# Start development server
npm run start:dev
```

### Access Points

| Service | URL | Description |
|---------|-----|-------------|
| **API** | http://localhost:3000 | NestJS application |
| **Swagger** | http://localhost:3000/docs | API documentation |
| **pgAdmin** | http://localhost:5050 | PostgreSQL admin |
| **Redis Commander** | http://localhost:8082 | Redis admin |
| **Mongo Express** | http://localhost:8081 | MongoDB admin |
| **PocketBase** | http://localhost:8090/_/ | PocketBase admin |

### Docker Services

| Service | Port | Default Credentials |
|---------|------|---------------------|
| PostgreSQL | 5432 | (see .env) |
| Redis | 6379 | — |
| MongoDB | 27017 | admin / admin |
| PocketBase | 8090 | — |
| pgAdmin | 5050 | admin@nestjs.com / admin |

---

## 8. API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/register` | Create new user |
| `POST` | `/api/v1/auth/login` | Login and receive JWT |
| `GET` | `/api/v1/auth/profile` | Get current user (JWT required) |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/users` | List users (JWT + RBAC) |
| `POST` | `/api/v1/users` | Create user (Admin) |
| `PATCH` | `/api/v1/users/:id` | Update user (Admin) |
| `DELETE` | `/api/v1/users/:id` | Delete user (Admin) |

### Health & Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health check |
| `GET` | `/docs` | Swagger documentation |

---

## 9. Scalability & Production Readiness

### Current Architecture Strengths

| Aspect | Implementation |
|--------|----------------|
| **Modularity** | NestJS modules enable clean separation |
| **Database Strategy** | Right database for each use case |
| **Testing** | 100% coverage with 59 tests |
| **Observability** | Health checks, structured logging |
| **Security** | JWT, RBAC, input validation |

### Test Coverage

```
✓ Test Suites: 6 passed (100%)
✓ Tests: 59 passed (100%)

Suites:
- Auth (12 tests)
- External API & caching (14 tests)
- User CRUD & activation (19 tests)
- Logging (3 tests)
- Health & docs (7 tests)
- Bootstrap (4 tests)
```

### Production Enhancements (Recommended)

| Enhancement | Purpose |
|-------------|---------|
| **Load Balancer** | Distribute traffic across instances |
| **Redis Cluster** | High availability for cache |
| **MongoDB Replica Set** | Redundancy for logs |
| **Prometheus/Grafana** | Metrics and monitoring |
| **Sentry** | Error tracking |
| **CI/CD Pipeline** | Automated testing and deployment |

---

## 10. Environment Configuration

```env
# Core
NODE_ENV=development
PORT=3000

# PostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/nestjs_db

# MongoDB
MONGODB_URI=mongodb://localhost:27017/nestjs_logs

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=super-secret
JWT_EXPIRES_IN=24h
```

---

## Project Structure

```
nestjs-multi-db-backend/
├── src/
│   ├── auth/              # Authentication module
│   ├── users/             # User management module
│   ├── external-api/      # External API with caching
│   ├── logging/           # MongoDB logging service
│   ├── health/            # Health check endpoints
│   └── main.ts            # Application bootstrap
├── prisma/
│   └── schema.prisma      # Database schema
├── test/
│   └── *.spec.ts          # Test files
├── docker-compose.yml     # Development environment
└── package.json
```

---

## Scripts

```bash
npm run start:dev    # Development with hot reload
npm run start:prod   # Production mode
npm run test         # Unit tests
npm run test:e2e     # End-to-end tests
npm run test:cov     # Coverage report
```

---

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Write code and tests
4. Ensure all tests pass: `npm run test:e2e`
5. Submit pull request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

*Enterprise-grade multi-database architecture for modern applications.*
