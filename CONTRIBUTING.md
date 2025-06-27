# Contributing to NestJS Multi-DB Backend

Thank you for your interest in contributing to this project! This guide will help you get started.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher, v20+ recommended)
- Docker and Docker Compose
- npm or yarn
- Git

### Setup Development Environment

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/your-username/nestjs-multi-db-backend.git
   cd nestjs-multi-db-backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

4. **Start databases with Docker**

   ```bash
   npm run docker:up
   ```

5. **Set up the database**

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

6. **Start the development server**
   ```bash
   npm run start:dev
   ```

## 🧪 Testing

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests (requires databases to be running)
npm run test:e2e

# Test coverage
npm run test:cov

# Watch mode
npm run test:watch
```

### Test Database Setup

For e2e tests, make sure you have test databases:

- PostgreSQL: `nestjs_test_db`
- MongoDB: `nestjs_test_logs`
- Redis: default instance

The tests will automatically clean up data between runs.

## 📝 Code Style

### ESLint and Prettier

```bash
# Lint code
npm run lint

# Format code
npm run format
```

### Coding Standards

- Use TypeScript with strict mode
- Follow NestJS conventions and best practices
- Write comprehensive tests for new features
- Use descriptive variable and function names
- Add JSDoc comments for public APIs
- Follow the existing project structure

### Commit Messages

We follow [Conventional Commits](https://conventionalcommits.org/):

```
feat: add new authentication middleware
fix: resolve database connection issue
docs: update API documentation
test: add e2e tests for user module
refactor: improve error handling
```

## 🏗️ Project Structure

```
src/
├── auth/           # Authentication module
├── users/          # User management
├── api/            # External API integration
├── logs/           # Logging system
├── cache/          # Caching service
├── config/         # Configuration modules
└── common/         # Shared utilities
```

## 🔄 Development Workflow

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**

   - Write code following the project conventions
   - Add or update tests as needed
   - Update documentation if necessary

3. **Test your changes**

   ```bash
   npm run test
   npm run test:e2e
   npm run lint
   ```

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

## 📋 Pull Request Guidelines

### Before Submitting

- [ ] Tests pass locally
- [ ] Code follows the style guidelines
- [ ] Documentation is updated
- [ ] No TypeScript errors
- [ ] No linting errors

### PR Description

Please include:

- Description of the changes
- Related issue numbers
- Breaking changes (if any)
- Screenshots (if applicable)

### Review Process

1. All tests must pass
2. At least one maintainer approval
3. All comments addressed
4. No merge conflicts

## 🐛 Bug Reports

When reporting bugs, please include:

- Operating system and version
- Node.js version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Error messages and stack traces

## 💡 Feature Requests

For new features:

- Check if it aligns with project goals
- Provide clear use cases
- Consider implementation complexity
- Discuss in an issue before implementing

## 📚 Documentation

Help improve documentation by:

- Fixing typos and unclear explanations
- Adding examples and use cases
- Updating API documentation
- Improving setup instructions

## 🆘 Getting Help

- Open an issue for bugs or feature requests
- Check existing issues and discussions
- Join our community discussions

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing! 🎉
