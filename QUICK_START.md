# Quick Start Guide - Valerix Microservices

Get up and running in **5 minutes**! 🚀

## ⚡ Local Development (Fastest)

### Step 1: Start Infrastructure (2 minutes)

```bash
cd infrastructure/docker
docker-compose up -d
```

**✅ This starts:** PostgreSQL, Redis, RabbitMQ, Prometheus, Grafana

### Step 2: Start Order Service (1 minute)

```bash
cd services/order-service
cp .env.example .env
npm install
npm run dev
```

**✅ Service running at:** http://localhost:3000

### Step 3: Start Inventory Service (1 minute)

Open new terminal:

```bash
cd services/inventory-service
cp .env.example .env
npm install
npm run dev
```

**✅ Service running at:** http://localhost:3002

### Step 4: Test It! (1 minute)

```bash
# Check health
curl http://localhost:3000/health

# Create an order
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST001",
    "items": [{"product_id": "PROD001", "quantity": 2, "price": 99.99}],
    "idempotency_key": "test-123"
  }'

# View Grafana dashboard
open http://localhost:3001
# Login: admin / admin
```

**✅ Done!** You now have a full microservices system running locally.

---

## 🐳 Docker Deployment

### One Command Deployment

```bash
cd infrastructure/docker
docker-compose up -d
```

**Access:**
- Order Service: http://localhost:3000
- Inventory Service: http://localhost:3002
- Grafana: http://localhost:3001
- Prometheus: http://localhost:9090
- RabbitMQ: http://localhost:15672 (valerix / valerixpass)

---

## ☸️ Kubernetes Deployment (Minikube)

```bash
# Start minikube
minikube start --cpus=4 --memory=8192

# Build images
eval $(minikube docker-env)
docker build -t order-service:latest services/order-service/
docker build -t inventory-service:latest services/inventory-service/

# Deploy
kubectl apply -f infrastructure/kubernetes/namespace/
kubectl apply -f infrastructure/kubernetes/secrets.yaml.example
kubectl apply -f infrastructure/kubernetes/databases/
kubectl apply -f infrastructure/kubernetes/services/

# Check status
kubectl get pods -n valerix

# Access services
kubectl port-forward service/order-service 3000:3000 -n valerix
```

---

## ☁️ GKE Production Deployment

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md#4-production-gke-deployment) for full instructions.

**Quick Steps:**
1. Create GCP project and enable APIs
2. Create GKE cluster
3. Configure GitHub secrets
4. Push to main branch → Auto-deploy via CI/CD

---

## 🧪 Testing

```bash
# Run unit tests
cd services/order-service && npm test
cd services/inventory-service && npm test

# Load testing
cd load-testing && k6 run k6-scripts/load-test.js

# Chaos testing
cd chaos-testing && ./scenarios/run-gremlin-latency.sh
```

---

## 📊 Monitoring

| Service | URL | Login |
|---------|-----|-------|
| Grafana | http://localhost:3001 | admin / admin |
| Prometheus | http://localhost:9090 | - |
| RabbitMQ | http://localhost:15672 | valerix / valerixpass |

---

## 🔍 API Endpoints

### Order Service (Port 3000)

```bash
# Create order
POST /api/orders

# Get order
GET /api/orders/:id

# List orders
GET /api/orders

# Health check
GET /health

# Metrics
GET /metrics
```

### Inventory Service (Port 3002)

```bash
# Get stock
GET /api/inventory/:productId

# Update inventory
POST /api/inventory/update

# Reserve stock
POST /api/inventory/reserve

# Health check
GET /health

# Metrics
GET /metrics
```

---

## 🆘 Troubleshooting

### Service won't start?

```bash
# Check if ports are in use
lsof -i :3000
lsof -i :3002

# Kill process
kill -9 <PID>

# Restart Docker services
docker-compose restart
```

### Database connection error?

```bash
# Check Docker services
docker-compose ps

# Restart databases
docker-compose restart order-db inventory-db

# View logs
docker-compose logs order-db
```

### Tests failing?

```bash
# Install dependencies
npm install

# Check Node version (should be 18+)
node --version

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## 📚 Need More Details?

- **Full Deployment Guide**: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **GKE Setup**: [docs/GKE_DEPLOYMENT.md](docs/GKE_DEPLOYMENT.md)
- **Architecture**: [README.md](README.md)

---

**Time to first successful request: ~5 minutes** ⚡

Happy coding! 🎉
