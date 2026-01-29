# Valerix Microservices Platform

A robust, cloud-native microservices architecture for e-commerce order processing with advanced resilience patterns, observability, and chaos engineering capabilities.

## 🏗️ Architecture Overview

This project implements a microservices-based e-commerce platform for Valerix, breaking down a monolithic system into independently scalable services with comprehensive DevOps practices.

### Core Services
- **Order Service**: Handles order creation, validation, and coordination
- **Inventory Service**: Manages stock levels and inventory updates

### Key Features
-  **Resilience Patterns**: Circuit breakers, timeouts, retry logic with exponential backoff
-  **Fault Tolerance**: Idempotency support, transaction outbox pattern
-  **Observability**: Health checks, Prometheus metrics, Grafana dashboards, distributed tracing
-  **Chaos Engineering**: Automated testing with simulated latency and failures
-  **Cloud-Ready**: Containerized with Docker, orchestrated with Kubernetes
-  **CI/CD**: Automated testing and deployment pipeline

## 📁 Project Structure

```
valerix-microservices/
├── services/                 # Microservices
│   ├── order-service/       # Order processing service
│   └── inventory-service/   # Inventory management service
├── infrastructure/          # Infrastructure as Code
│   ├── docker/             # Docker configurations
│   ├── kubernetes/         # K8s manifests
│   ├── prometheus/         # Monitoring config
│   └── grafana/            # Dashboard definitions
├── chaos-testing/          # Chaos engineering tests
├── load-testing/           # Performance tests
├── ui/                     # Simple monitoring UI
├── docs/                   # Documentation
└── scripts/                # Utility scripts
```

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+
- Git

### Local Development Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd valerix-microservices
```

2. **Start infrastructure services**
```bash
cd infrastructure/docker
docker-compose up -d
```

This starts:
- PostgreSQL (Order DB on port 5432)
- PostgreSQL (Inventory DB on port 5433)
- Redis (port 6379)
- RabbitMQ (port 5672, management UI on 15672)
- Prometheus (port 9090)
- Grafana (port 3001)

3. **Set up Order Service**
```bash
cd services/order-service
cp .env.example .env
npm install
npm run dev
```

4. **Set up Inventory Service** (in a new terminal)
```bash
cd services/inventory-service
cp .env.example .env
npm install
npm run dev
```

5. **Verify services are running**
```bash
# Check Order Service health
curl http://localhost:3000/health

# Check Inventory Service health
curl http://localhost:3002/health
```

## 🧪 Testing

### Unit Tests
```bash
# Order Service
cd services/order-service
npm test

# Inventory Service
cd services/inventory-service
npm test
```

### Load Testing
```bash
cd load-testing
k6 run k6-scripts/load-test.js
```

### Chaos Testing
```bash
cd chaos-testing
./scenarios/run-gremlin-latency.sh
```

## 📊 Monitoring

- **Grafana Dashboard**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **RabbitMQ Management**: http://localhost:15672 (valerix/valerixpass)

## 🏥 Health Checks

All services expose deep health check endpoints that verify downstream dependencies:

```bash
# Order Service health
GET http://localhost:3000/health

# Response
{
  "status": "UP",
  "services": {
    "database": "UP",
    "inventory_service": "UP",
    "message_queue": "UP"
  },
  "timestamp": "2026-01-29T09:00:00Z"
}
```

## 🔄 API Endpoints

### Order Service

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders` | Create new order |
| GET | `/api/orders/:id` | Get order details |
| GET | `/api/orders` | List orders |
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |

### Inventory Service

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory/:productId` | Get product stock |
| POST | `/api/inventory/update` | Update inventory |
| POST | `/api/inventory/reserve` | Reserve stock |
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |

## 🛡️ Resilience Features

### Circuit Breaker
Order Service uses circuit breaker when calling Inventory Service:
- **Failure Threshold**: 5 failures in 10 seconds
- **Open Duration**: 30 seconds
- **Recovery**: 2 consecutive successes

### Timeout Configuration
- **Connection Timeout**: 2 seconds
- **Read Timeout**: 5 seconds
- **Total Request Timeout**: 7 seconds

### Retry Logic
- **Max Attempts**: 3
- **Initial Delay**: 1 second
- **Backoff Multiplier**: 2

### Idempotency
All order creation requests require an `idempotency_key` to prevent duplicate processing.

## 🔧 Configuration

Environment variables are managed through `.env` files in each service directory. See `.env.example` for all available options.

### Key Configuration Options

**Order Service**:
- `DATABASE_URL`: PostgreSQL connection string
- `INVENTORY_SERVICE_URL`: Inventory service endpoint
- `CIRCUIT_BREAKER_THRESHOLD`: Circuit breaker failure threshold
- `RETRY_MAX_ATTEMPTS`: Maximum retry attempts

**Inventory Service**:
- `DATABASE_URL`: PostgreSQL connection string
- `GREMLIN_ENABLED`: Enable chaos latency simulation
- `GREMLIN_LATENCY_MS`: Simulated latency in milliseconds

## Deployment

### Docker
```bash
# Build images
docker-compose build

# Run all services
docker-compose up -d
```

### Kubernetes
```bash
# Apply configurations
kubectl apply -f infrastructure/kubernetes/

# Check deployments
kubectl get pods
```

## Performance Benchmarks

Expected performance metrics:
- **Response Time**: p95 < 500ms, p99 < 1000ms
- **Throughput**: 100+ orders/second
- **Availability**: 99.9%
- **Error Rate**: < 0.1%

## Chaos Engineering

The system includes built-in chaos testing scenarios:

1. **Gremlin Latency**: Simulates 3-second delays in Inventory Service
2. **Service Crash**: Tests recovery from unexpected service failures
3. **Network Partition**: Simulates network failures between services
4. **Database Failure**: Tests database connectivity issues

## Documentation

- [Architecture Overview](docs/architecture/overview.md)
- [API Documentation](docs/api/README.md)
- [Deployment Guide](docs/deployment.md)
- [Troubleshooting](docs/runbooks/troubleshooting.md)
- [Solution Guideline](../brain/66320942-754d-46d8-aaf9-d5bb4918dad9/solution_guideline.md)

## Technology Stack

- **Backend**: Node.js, Express.js
- **Databases**: PostgreSQL 15, Redis 7
- **Message Queue**: RabbitMQ
- **Monitoring**: Prometheus, Grafana
- **Containerization**: Docker, Kubernetes
- **Testing**: Jest, Supertest, k6, Toxiproxy
- **Resilience**: Opossum (circuit breaker), async-retry

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Team

Built for the BUET DevOps Challenge - Valerix E-Commerce Platform Migration

---

**Status**: Phase 1 - Foundation Setup (In Progress)
