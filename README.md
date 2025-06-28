# nestjs-multi-db-backend

![Build](https://img.shields.io/github/actions/workflow/status/yasilvalmeida/nestjs-multi-db-backend/ci.yml?branch=main)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)
![Docker](https://img.shields.io/badge/docker-ready-blue)

A production-ready NestJS boilerplate que demonstra **multi-database support** (PostgreSQL + Redis + MongoDB + PocketBase), autenticação JWT, documentação Swagger e **100 % de cobertura de testes**. Ideal para fintech, analytics ou qualquer plataforma que exija escalabilidade, segurança e observabilidade robusta.

---

## 🚀 Highlights

| Categoria            | Recursos principais                                                                                             |
|----------------------|------------------------------------------------------------------------------------------------------------------|
| **Arquitetura**      | Modular, micro-services friendly, Docker-ready com health checks                                                 |
| **Databases**        | PostgreSQL (Prisma), Redis (cache/rate-limit), MongoDB (logs), PocketBase (sync em tempo real)                   |
| **Security**         | JWT Auth, RBAC, proteção rate-limit Redis, validação de entrada                                                  |
| **Dev Experience**   | Swagger/OpenAPI 3.0, ESLint/Prettier, Husky hooks, request/response logger                                       |
| **Observability**    | Logs em MongoDB, health endpoints, métricas de performance e graceful shutdown                                   |
| **Testes**           | E2E + unitários (Jest) – **59 testes, 100 % sucesso**                                                            |
| **CI/CD**            | GitHub Actions (lint → test → build), Docker Compose para dev/local                                              |

---

## 🖼️ Arquitetura de Alto Nível

```mermaid
flowchart LR
  Client[Frontend / Insomnia / Swagger] --> NestJS

  subgraph NestJS API
    Auth[Auth Module] --> PG[(PostgreSQL)]
    Users[Users Module] --> PG
    Cache[Redis Service] -.-> NestJS
    PB[PocketBase Sync] -.-> NestJS
    Logs[MongoDB Logging] -.-> NestJS
  end
```

---

## 📈 Test Coverage

```
✓ Test Suites: 6 passed (100 %)
✓ Tests:       59 passed (100 %)
```

### Suites

- Auth (12)
- External API & caching (14)
- User CRUD & activation (19)
- Logging (3)
- Health & docs (7)
- Bootstrap (4)

---

## 🛠️ Quick Start

```bash
git clone https://github.com/yasilvalmeida/nestjs-multi-db-backend.git
cd nestjs-multi-db-backend
npm install

# Start databases & services
docker-compose up -d postgres redis mongodb pocketbase

# Prisma migrations
npx prisma generate
npx prisma migrate dev --name init

# Run dev server
npm run start:dev
```

- App: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`

---

## 🐳 Docker Services

| Service      | Port | Admin UI                                    | Default Creds          |
|--------------|------|---------------------------------------------|------------------------|
| PostgreSQL   | 5432 | pgAdmin → `http://localhost:5050`           | `admin@nestjs.com` / `admin` |
| Redis        | 6379 | Redis Commander → `http://localhost:8082`   | –                      |
| MongoDB      | 27017| Mongo Express → `http://localhost:8081`     | `admin / admin`        |
| PocketBase   | 8090 | `http://localhost:8090/_/`                  | –                      |

---

## 🔐 Main API Endpoints

### Auth

| Method | Path                      | Description                |
|--------|---------------------------|----------------------------|
| POST   | `/api/v1/auth/register`   | Create new user            |
| POST   | `/api/v1/auth/login`      | Login & receive JWT        |
| GET    | `/api/v1/auth/profile`    | Get own profile *(JWT)*    |

### Users

| Method | Path                      | Description                |
|--------|---------------------------|----------------------------|
| GET    | `/api/v1/users`           | List users *(JWT & RBAC)*  |
| POST   | `/api/v1/users`           | Create user *(Admin)*      |
| PATCH  | `/api/v1/users/:id`       | Update user *(Admin)*      |
| DELETE | `/api/v1/users/:id`       | Delete user *(Admin)*      |

*(Demais endpoints no Swagger)*

---

## ⚙️ Environment

```bash
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

## 🧪 Running Tests

```bash
npm run test         # unit
npm run test:e2e     # end-to-end
npm run test:cov     # coverage report
```

---

## 🤝 Contributing

1. Fork  
2. `git checkout -b feature/my-feature`  
3. Write code + tests  
4. `npm run test:e2e` (all green)  
5. PR 🚀

---

## 📄 License

MIT © 2025 Yasser Silveira Vaz d Almeida
