# 🚀 Deployment Guide

This guide covers how to deploy the NestJS Multi-Database Backend to various environments.

## 📋 Prerequisites

### Local Development

- Node.js v20+ (v18 will show warnings)
- Docker and Docker Compose
- npm or yarn
- Git

### Production

- Node.js v20+
- Docker (recommended) or direct database installations
- Reverse proxy (nginx, Apache, or cloud load balancer)
- SSL certificate
- Domain name

## 🐳 Docker Deployment (Recommended)

### Quick Start with Docker

1. **Clone and setup**

   ```bash
   git clone <your-repo-url>
   cd nestjs-multi-db-backend
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env with your production values
   ```

3. **Start all services**

   ```bash
   npm run docker:up
   ```

4. **Setup database**

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

5. **Start application**
   ```bash
   npm run start:prod
   ```

### Custom Docker Ports

If you have port conflicts, modify `docker-compose.yml`:

```yaml
# Example: Change PostgreSQL port
postgres:
  ports:
    - '5433:5432'  # Host:Container

# Then update .env
DATABASE_URL="postgresql://postgres:password@localhost:5433/nestjs_db?schema=public"
```

## 🌐 Production Deployment

### Environment Variables

Create `.env.production`:

```bash
# Application
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1

# Database URLs (use your production values)
DATABASE_URL="postgresql://user:password@your-db-host:5432/proddb"
MONGODB_URI="mongodb://your-mongo-host:27017/prodlogs"
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Security (CHANGE THESE!)
JWT_SECRET=your-super-secure-production-jwt-secret
JWT_REFRESH_SECRET=your-super-secure-refresh-secret

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=10

# Logging
LOG_LEVEL=warn
```

### Build and Deploy

```bash
# Build the application
npm run build

# Run database migrations
npm run prisma:deploy

# Start production server
npm run start:prod
```

## ☁️ Cloud Deployments

### AWS Deployment

#### Using ECS (Elastic Container Service)

1. **Create ECR repository**

   ```bash
   aws ecr create-repository --repository-name nestjs-multi-db
   ```

2. **Build and push Docker image**

   ```bash
   # Build image
   docker build -t nestjs-multi-db .

   # Tag for ECR
   docker tag nestjs-multi-db:latest 123456789.dkr.ecr.region.amazonaws.com/nestjs-multi-db:latest

   # Push to ECR
   docker push 123456789.dkr.ecr.region.amazonaws.com/nestjs-multi-db:latest
   ```

3. **Setup RDS (PostgreSQL)**

   - Create RDS PostgreSQL instance
   - Update DATABASE_URL in environment

4. **Setup ElastiCache (Redis)**

   - Create Redis cluster
   - Update REDIS_HOST in environment

5. **Setup DocumentDB (MongoDB)**
   - Create DocumentDB cluster
   - Update MONGODB_URI in environment

#### Using Elastic Beanstalk

1. **Install EB CLI**

   ```bash
   pip install awsebcli
   ```

2. **Initialize and deploy**
   ```bash
   eb init
   eb create production
   eb deploy
   ```

### Google Cloud Platform

#### Using Cloud Run

1. **Build and deploy**

   ```bash
   gcloud run deploy nestjs-multi-db \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

2. **Setup Cloud SQL (PostgreSQL)**
3. **Setup Memorystore (Redis)**
4. **Setup MongoDB Atlas**

### Microsoft Azure

#### Using Container Instances

1. **Create resource group**

   ```bash
   az group create --name nestjs-rg --location eastus
   ```

2. **Deploy container**
   ```bash
   az container create \
     --resource-group nestjs-rg \
     --name nestjs-multi-db \
     --image your-registry/nestjs-multi-db:latest \
     --dns-name-label nestjs-unique-name
   ```

## 🔧 Reverse Proxy Setup

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Apache Configuration

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
    ProxyPreserveHost On
</VirtualHost>
```

## 🛡️ Security Checklist

### Environment Security

- [ ] Change all default passwords
- [ ] Use strong JWT secrets (64+ characters)
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable request logging
- [ ] Use environment-specific configurations

### Database Security

- [ ] Use connection pooling
- [ ] Enable SSL for database connections
- [ ] Restrict database access by IP
- [ ] Regular database backups
- [ ] Monitor for suspicious activity

### Application Security

- [ ] Keep dependencies updated
- [ ] Enable helmet.js
- [ ] Validate all input data
- [ ] Implement proper error handling
- [ ] Use secrets management
- [ ] Enable audit logging

## 📊 Monitoring and Logging

### Health Checks

```bash
# Application health
curl http://your-domain.com/docs

# Database connectivity
npm run prisma:studio
```

### Log Monitoring

- **Application logs**: Check `logs/` directory
- **Database logs**: MongoDB `/logs` endpoint
- **Container logs**: `docker logs container-name`

### Performance Monitoring

Recommended tools:

- **APM**: New Relic, DataDog, or AWS X-Ray
- **Logs**: ELK Stack or Splunk
- **Metrics**: Prometheus + Grafana
- **Uptime**: Pingdom or UptimeRobot

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:e2e

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: |
          # Your deployment commands here
```

## 🚨 Troubleshooting

### Common Issues

1. **Port conflicts**

   - Change ports in `docker-compose.yml`
   - Update environment variables accordingly

2. **Database connection errors**

   - Check if databases are running
   - Verify connection strings
   - Check firewall rules

3. **Memory issues**

   - Increase Docker memory limits
   - Optimize database queries
   - Implement connection pooling

4. **Performance issues**
   - Enable Redis caching
   - Optimize database indexes
   - Use connection pooling
   - Monitor slow queries

### Debug Commands

```bash
# Check container status
docker ps

# View container logs
docker logs nestjs-postgres
docker logs nestjs-redis
docker logs nestjs-mongodb

# Check application logs
tail -f logs/combined.log

# Test database connections
npm run prisma:studio
```

## 📈 Scaling

### Horizontal Scaling

- Load balancer setup
- Multiple application instances
- Database read replicas
- Redis cluster
- CDN for static assets

### Vertical Scaling

- Increase server resources
- Optimize database configuration
- Tune Node.js memory settings
- Database connection pooling

## 🔄 Backup and Recovery

### Database Backups

```bash
# PostgreSQL backup
pg_dump -h localhost -U postgres nestjs_db > backup.sql

# MongoDB backup
mongodump --uri="mongodb://localhost:27017/nestjs_logs"

# Redis backup (automatic with AOF/RDB)
```

### Application Backups

- Source code: Git repository
- Configuration: Environment variables
- File uploads: S3 or equivalent
- Logs: Centralized logging

---

For additional help, check the [CONTRIBUTING.md](CONTRIBUTING.md) guide or open an issue in the repository.
