# NestJS Multi-Database Backend

A comprehensive NestJS backend boilerplate with PostgreSQL (via Prisma), Redis (for caching), and MongoDB (for logging and archival data). This project includes authentication, API integration, rate limiting, retry logic, caching, and extensive logging capabilities.

## 🚀 Features

- **Multi-Database Support**: PostgreSQL, Redis, and MongoDB
- **Authentication**: JWT-based authentication with Passport.js
- **Rate Limiting**: Built-in rate limiting with Redis
- **Caching**: Redis-based caching with retry logic
- **API Integration**: External API calls with retry logic and caching
- **Comprehensive Logging**: MongoDB-based logging with Winston
- **Validation**: Request validation using class-validator
- **Documentation**: Swagger/OpenAPI documentation
- **Docker Support**: Docker Compose for easy development
- **Scalable Architecture**: Modular structure following NestJS best practices

## 📋 Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd nestjs-multi-db-backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the databases with Docker**

   ```bash
   npm run docker:up
   ```

5. **Generate Prisma client and run migrations**

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

6. **Start the application**

   ```bash
   # Development
   npm run start:dev

   # Production
   npm run build
   npm run start:prod
   ```

## 🐳 Docker Setup

The project includes a comprehensive Docker Compose setup with:

- **PostgreSQL**: Main database with pgAdmin interface
- **Redis**: Caching and session storage with Redis Commander
- **MongoDB**: Logging database with Mongo Express interface

### Admin Interfaces

After running `npm run docker:up`, you can access:

- **pgAdmin**: http://localhost:5050 (admin@nestjs.com / admin)
- **Redis Commander**: http://localhost:8082
- **Mongo Express**: http://localhost:8081 (admin / admin)

## 📖 API Documentation

Once the application is running, visit:

- **Swagger UI**: http://localhost:3000/docs

## 🏗️ Project Structure

```
src/
├── auth/                 # Authentication module
│   ├── dto/             # Data Transfer Objects
│   ├── strategies/      # Passport strategies
│   └── interfaces/      # TypeScript interfaces
├── users/               # User management module
├── api/                 # External API integration
├── logs/                # MongoDB logging module
├── cache/               # Redis caching service
├── config/              # Database and Redis configuration
├── common/              # Shared utilities
│   ├── decorators/      # Custom decorators
│   ├── guards/          # Authentication guards
│   ├── interceptors/    # Request/response interceptors
│   └── pipes/           # Validation pipes
└── main.ts              # Application entry point
```

## 🔧 Configuration

### Environment Variables

```bash
# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database - PostgreSQL
DATABASE_URL="postgresql://postgres:password@localhost:5432/nestjs_db?schema=public"

# Database - MongoDB
MONGODB_URI="mongodb://localhost:27017/nestjs_logs"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=10

# External API
EXTERNAL_API_BASE_URL=https://jsonplaceholder.typicode.com
EXTERNAL_API_TIMEOUT=5000
EXTERNAL_API_RETRY_ATTEMPTS=3
```

## 🔐 Authentication

The API uses JWT tokens for authentication. To get started:

1. **Register a new user**

   ```bash
   POST /api/v1/auth/register
   {
     "email": "user@example.com",
     "username": "testuser",
     "password": "password123",
     "firstName": "John",
     "lastName": "Doe"
   }
   ```

2. **Login**

   ```bash
   POST /api/v1/auth/login
   {
     "email": "user@example.com",
     "password": "password123"
   }
   ```

3. **Use the token in subsequent requests**
   ```bash
   Authorization: Bearer <your-jwt-token>
   ```

## 📊 API Endpoints

### Authentication

- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `GET /auth/profile` - Get user profile (protected)

### Users

- `GET /users` - Get all users (protected)
- `GET /users/:id` - Get user by ID (protected)
- `PATCH /users/:id` - Update user (protected)
- `DELETE /users/:id` - Delete user (protected)

### External API

- `GET /api/posts` - Get posts from external API (public)
- `GET /api/posts/:id` - Get specific post (public)
- `GET /api/users` - Get external users (protected)
- `GET /api/mock/posts` - Get mock posts (public)
- `GET /api/mock/users` - Get mock users (public)

### Logs

- `GET /logs` - Get logs with filtering (protected)
- `GET /logs/statistics` - Get log statistics (protected)
- `POST /logs` - Create log entry (protected)
- `DELETE /logs/cleanup/:days` - Delete old logs (protected)

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 🚦 Rate Limiting

The API includes rate limiting:

- **Default**: 10 requests per minute per IP
- **Configurable**: Via environment variables
- **Redis-backed**: Uses Redis for distributed rate limiting

## 💾 Caching

Redis caching is implemented with:

- **Automatic retry logic**: Exponential backoff for failed operations
- **TTL support**: Configurable time-to-live for cached data
- **Error handling**: Graceful degradation when cache is unavailable

## 📝 Logging

Comprehensive logging with:

- **File logging**: Error and combined logs
- **MongoDB storage**: Structured logging for analytics
- **Request logging**: Automatic HTTP request/response logging
- **Log levels**: Configurable log levels (error, warn, info, debug)

## 🔄 Development Scripts

```bash
# Development
npm run start:dev          # Start with hot reload
npm run start:debug        # Start with debug mode

# Database
npm run prisma:generate    # Generate Prisma client
npm run prisma:migrate     # Run database migrations
npm run prisma:studio      # Open Prisma Studio

# Docker
npm run docker:up          # Start all services
npm run docker:down        # Stop all services
npm run docker:logs        # View service logs

# Code Quality
npm run lint              # Run ESLint
npm run format            # Format code with Prettier
```

## 🏭 Production Deployment

1. **Set production environment variables**
2. **Build the application**
   ```bash
   npm run build
   ```
3. **Run migrations**
   ```bash
   npm run prisma:deploy
   ```
4. **Start the application**
   ```bash
   npm run start:prod
   ```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [Prisma](https://prisma.io/) - Type-safe database toolkit
- [Redis](https://redis.io/) - In-memory data structure store
- [MongoDB](https://mongodb.com/) - Document database
- [Passport](http://passportjs.org/) - Authentication middleware
