# Complete Deployment Guide - Valerix Microservices

This guide covers all deployment options for the Valerix microservices platform, from local development to production on Google Kubernetes Engine (GKE).

## 📋 Table of Contents

1. [Local Development Deployment](#1-local-development-deployment)
2. [Docker Compose Deployment](#2-docker-compose-deployment)
3. [Local Kubernetes Deployment (Minikube)](#3-local-kubernetes-deployment-minikube)
4. [Production GKE Deployment](#4-production-gke-deployment)
5. [CI/CD Pipeline Setup](#5-cicd-pipeline-setup)
6. [Monitoring Setup](#6-monitoring-setup)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Local Development Deployment

**Best for**: Active development and testing

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- RabbitMQ 3.9+

### Step-by-Step Setup

#### 1.1 Start Infrastructure Services

```bash
# Start databases and message queue with Docker Compose
cd infrastructure/docker
docker-compose up -d

# Verify services are running
docker-compose ps
```

This starts:
- PostgreSQL (Order DB) on port **5432**
- PostgreSQL (Inventory DB) on port **5433**  
- Redis on port **6379**
- RabbitMQ on port **5672** (Management UI: **15672**)
- Prometheus on port **9090**
- Grafana on port **3001**

#### 1.2 Setup Order Service

```bash
cd services/order-service

# Create environment file
cp .env.example .env

# Install dependencies
npm install

# Run database migrations (if any)
npm run migrate

# Start in development mode
npm run dev
```

Order Service will be available at: **http://localhost:3000**

#### 1.3 Setup Inventory Service

Open a new terminal:

```bash
cd services/inventory-service

# Create environment file
cp .env.example .env

# Install dependencies
npm install

# Run database migrations (if any)
npm run migrate

# Start in development mode
npm run dev
```

Inventory Service will be available at: **http://localhost:3002**

#### 1.4 Verify Setup

```bash
# Check Order Service health
curl http://localhost:3000/health

# Check Inventory Service health
curl http://localhost:3002/health

# Check RabbitMQ Management
open http://localhost:15672
# Login: valerix / valerixpass

# Check Grafana
open http://localhost:3001
# Login: admin / admin
```

#### 1.5 Test the System

```bash
# Create an order
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST001",
    "items": [
      {"product_id": "PROD001", "quantity": 2, "price": 99.99}
    ],
    "idempotency_key": "unique-key-123"
  }'

# Get order details
curl http://localhost:3000/api/orders/{order_id}
```

---

## 2. Docker Compose Deployment

**Best for**: Integration testing, staging environments, or simple production deployments

### 2.1 Build Docker Images

```bash
# Build all services
docker-compose -f infrastructure/docker/docker-compose.yml build

# Or build individually
cd services/order-service
docker build -t valerix/order-service:latest .

cd ../inventory-service
docker build -t valerix/inventory-service:latest .
```

### 2.2 Start All Services

```bash
cd infrastructure/docker
docker-compose up -d

# View logs
docker-compose logs -f order-service
docker-compose logs -f inventory-service

# Check status
docker-compose ps
```

### 2.3 Scale Services

```bash
# Scale order service to 3 instances
docker-compose up -d --scale order-service=3

# Scale inventory service to 2 instances
docker-compose up -d --scale inventory-service=2
```

### 2.4 Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

---

## 3. Local Kubernetes Deployment (Minikube)

**Best for**: Testing Kubernetes configurations locally before deploying to cloud

### 3.1 Prerequisites

```bash
# Install minikube (macOS)
brew install minikube

# Install kubectl
brew install kubectl

# Start minikube
minikube start --cpus=4 --memory=8192

# Enable required addons
minikube addons enable ingress
minikube addons enable metrics-server
```

### 3.2 Build and Load Images

```bash
# Use minikube's Docker daemon
eval $(minikube docker-env)

# Build images
cd services/order-service
docker build -t order-service:latest .

cd ../inventory-service
docker build -t inventory-service:latest .

# Verify images
docker images | grep -E 'order-service|inventory-service'
```

### 3.3 Deploy to Minikube

```bash
cd infrastructure/kubernetes

# Create namespace
kubectl apply -f namespace/namespace.yaml

# Create secrets
kubectl apply -f secrets.yaml.example

# Deploy databases
kubectl apply -f databases/

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=order-db -n valerix --timeout=300s
kubectl wait --for=condition=ready pod -l app=inventory-db -n valerix --timeout=300s

# Deploy services
kubectl apply -f services/

# Check deployment status
kubectl get pods -n valerix
kubectl get services -n valerix
```

### 3.4 Access Services

```bash
# Get minikube IP
minikube ip

# Port forward to access services locally
kubectl port-forward service/order-service 3000:3000 -n valerix
kubectl port-forward service/inventory-service 3002:3002 -n valerix

# Or use minikube service
minikube service order-service -n valerix
```

### 3.5 View Logs and Debug

```bash
# View pod logs
kubectl logs -f deployment/order-service -n valerix

# Describe pod
kubectl describe pod <pod-name> -n valerix

# Execute into pod
kubectl exec -it <pod-name> -n valerix -- /bin/sh

# View events
kubectl get events -n valerix --sort-by='.lastTimestamp'
```

---

## 4. Production GKE Deployment

**Best for**: Production workloads with high availability and scalability

### 4.1 Prerequisites

- Google Cloud account with billing enabled
- `gcloud` CLI installed
- GitHub account (for CI/CD)

### 4.2 Setup Google Cloud Project

```bash
# Login to Google Cloud
gcloud auth login

# Create a new project (or use existing)
export PROJECT_ID="valerix-prod-$(date +%s)"
gcloud projects create $PROJECT_ID --name="Valerix Production"

# Set as active project
gcloud config set project $PROJECT_ID

# Enable billing (do this in GCP Console)
# https://console.cloud.google.com/billing

# Enable required APIs
gcloud services enable container.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable compute.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com
```

### 4.3 Create GKE Cluster

```bash
# Create production-grade cluster
gcloud container clusters create valerix-cluster \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type e2-standard-2 \
  --disk-size 50 \
  --disk-type pd-ssd \
  --enable-autoscaling \
  --min-nodes 2 \
  --max-nodes 10 \
  --enable-autorepair \
  --enable-autoupgrade \
  --maintenance-window-start "2026-01-01T00:00:00Z" \
  --maintenance-window-duration 4h \
  --addons HorizontalPodAutoscaling,HttpLoadBalancing,GcePersistentDiskCsiDriver

# Get cluster credentials
gcloud container clusters get-credentials valerix-cluster --zone us-central1-a

# Verify connection
kubectl cluster-info
kubectl get nodes
```

### 4.4 Setup Container Registry Authentication

```bash
# GitHub Container Registry (ghcr.io)
# Create a GitHub Personal Access Token with 'write:packages' scope
# https://github.com/settings/tokens

# Create Kubernetes secret for pulling images
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GITHUB_TOKEN \
  --docker-email=YOUR_EMAIL \
  -n valerix
```

### 4.5 Deploy to GKE

```bash
cd infrastructure/kubernetes

# Create secure secrets (IMPORTANT: Use strong passwords!)
ORDER_DB_PASS=$(openssl rand -base64 32)
INVENTORY_DB_PASS=$(openssl rand -base64 32)
RABBITMQ_PASS=$(openssl rand -base64 32)

# Create secrets.yaml from template
cat > secrets.yaml <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: db-secrets
  namespace: valerix
type: Opaque
stringData:
  order-db-password: "$ORDER_DB_PASS"
  inventory-db-password: "$INVENTORY_DB_PASS"
  rabbitmq-password: "$RABBITMQ_PASS"
EOF

# Deploy everything
kubectl apply -f namespace/namespace.yaml
kubectl apply -f secrets.yaml
kubectl apply -f databases/
kubectl apply -f services/

# Wait for deployment
kubectl rollout status deployment/order-service -n valerix
kubectl rollout status deployment/inventory-service -n valerix

# Get service external IPs
kubectl get services -n valerix
```

### 4.6 Test Production Deployment

```bash
# Get the LoadBalancer IP
ORDER_IP=$(kubectl get service order-service -n valerix -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Test health endpoint
curl http://$ORDER_IP:3000/health

# Create a test order
curl -X POST http://$ORDER_IP:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST001",
    "items": [{"product_id": "PROD001", "quantity": 1, "price": 99.99}],
    "idempotency_key": "test-'$(date +%s)'"
  }'
```

---

## 5. CI/CD Pipeline Setup

### 5.1 Current Pipeline Status

✅ **Working Jobs:**
- Run Tests
- Build and Push Docker Images

⚠️ **Requires Configuration:**
- Deploy to GKE (needs GCP secrets)

### 5.2 GitHub Secrets Configuration

Go to: **GitHub Repository → Settings → Secrets and variables → Actions**

Add the following secrets:

#### For GKE Deployment (Option 1: Workload Identity Federation - Recommended)

```bash
# 1. Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Service Account" \
  --project=$PROJECT_ID

# 2. Grant permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/container.developer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# 3. Get project number
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

# 4. Create Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" \
  --location="global" \
  --display-name="GitHub Actions Pool" \
  --project=$PROJECT_ID

# 5. Create Workload Identity Provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository_owner=='LegendaryBeast'" \
  --project=$PROJECT_ID

# 6. Allow GitHub to impersonate service account
gcloud iam service-accounts add-iam-policy-binding \
  github-actions@${PROJECT_ID}.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/LegendaryBeast/valerix-microservice" \
  --project=$PROJECT_ID

# 7. Get values for GitHub secrets
echo "=== GitHub Secrets ==="
echo "GCP_PROJECT_ID: $PROJECT_ID"
echo "GKE_CLUSTER_NAME: valerix-cluster"
echo "GKE_ZONE: us-central1-a"
echo "WIF_PROVIDER: projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
echo "WIF_SERVICE_ACCOUNT: github-actions@${PROJECT_ID}.iam.gserviceaccount.com"
```

**Add these GitHub Secrets:**
| Secret Name | Value |
|------------|-------|
| `GCP_PROJECT_ID` | Your GCP project ID |
| `GKE_CLUSTER_NAME` | `valerix-cluster` |
| `GKE_ZONE` | `us-central1-a` |
| `WIF_PROVIDER` | Workload Identity Provider path |
| `WIF_SERVICE_ACCOUNT` | Service account email |

### 5.3 Trigger Deployment

Once secrets are configured:

```bash
# Make any code change
git add .
git commit -m "Trigger deployment"
git push origin main
```

**Pipeline will:**
1. ✅ Run unit tests
2. ✅ Build Docker images
3. ✅ Push to GitHub Container Registry
4. ✅ Deploy to GKE
5. ✅ Verify deployment

**Monitor progress:**
- GitHub → Actions tab
- Or: `kubectl get pods -n valerix -w`

---

## 6. Monitoring Setup

### 6.1 Access Grafana (Local)

```bash
# If running locally
open http://localhost:3001

# If on Kubernetes
kubectl port-forward service/grafana 3001:3000 -n valerix
open http://localhost:3001
```

**Login:** admin / admin

### 6.2 Available Dashboards

- **Microservices Overview**: System health, request rates, error rates
- **Order Service Metrics**: Order creation rate, success/failure ratio
- **Inventory Service Metrics**: Stock levels, reservation success
- **Infrastructure Metrics**: CPU, memory, network usage

### 6.3 Access Prometheus

```bash
# Local
open http://localhost:9090

# Kubernetes
kubectl port-forward service/prometheus 9090:9090 -n valerix
open http://localhost:9090
```

### 6.4 Key Metrics to Monitor

```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# Response time (p95)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Circuit breaker state
circuit_breaker_state{service="inventory"}
```

---

## 7. Troubleshooting

### 7.1 Common Issues and Solutions

#### Issue: Service won't start locally

```bash
# Check if ports are already in use
lsof -i :3000  # Order service
lsof -i :3002  # Inventory service

# Kill process if needed
kill -9 <PID>

# Check database connectivity
psql -h localhost -p 5432 -U valerix -d orderdb
```

#### Issue: Kubernetes pods in CrashLoopBackOff

```bash
# View pod logs
kubectl logs <pod-name> -n valerix

# Describe pod for events
kubectl describe pod <pod-name> -n valerix

# Common fixes:
# 1. Check database passwords match in secrets
# 2. Verify environment variables
# 3. Check resource limits
```

#### Issue: Can't pull Docker images on GKE

```bash
# Verify image pull secret
kubectl get secret ghcr-secret -n valerix

# If missing, recreate it
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=YOUR_USERNAME \
  --docker-password=YOUR_TOKEN \
  --docker-email=YOUR_EMAIL \
  -n valerix
```

#### Issue: CI/CD pipeline fails

```bash
# Check GitHub Actions logs
# Common issues:
# 1. Missing GitHub secrets
# 2. Insufficient GCP permissions
# 3. package-lock.json not committed

# Verify package-lock.json is tracked
git ls-files | grep package-lock.json

# If missing, remove from .gitignore and commit
git add services/*/package-lock.json
git commit -m "Add package-lock.json for CI/CD"
git push
```

#### Issue: High latency or timeouts

```bash
# Check circuit breaker status
curl http://localhost:3000/health

# View Prometheus metrics
# Check: circuit_breaker_state, http_request_duration_seconds

# Scale up services
kubectl scale deployment order-service --replicas=3 -n valerix
kubectl scale deployment inventory-service --replicas=2 -n valerix
```

### 7.2 Useful Commands

```bash
# View all resources in namespace
kubectl get all -n valerix

# View logs from all pods with label
kubectl logs -l app=order-service -n valerix --tail=100

# Restart deployment
kubectl rollout restart deployment/order-service -n valerix

# Port forward multiple services
kubectl port-forward service/order-service 3000:3000 -n valerix &
kubectl port-forward service/inventory-service 3002:3002 -n valerix &

# Delete and recreate a deployment
kubectl delete deployment order-service -n valerix
kubectl apply -f infrastructure/kubernetes/services/order-service.yaml
```

### 7.3 Health Check Endpoints

```bash
# Order Service
curl http://localhost:3000/health

# Expected response:
# {
#   "status": "UP",
#   "services": {
#     "database": "UP",
#     "inventory_service": "UP",
#     "message_queue": "UP"
#   }
# }

# Inventory Service
curl http://localhost:3002/health

# Prometheus metrics
curl http://localhost:3000/metrics
curl http://localhost:3002/metrics
```

---

## 🎯 Quick Reference

### Deployment Comparison

| Method | Best For | Complexity | Cost |
|--------|----------|------------|------|
| **Local Dev** | Development | ⭐ Low | Free |
| **Docker Compose** | Testing, Staging | ⭐⭐ Medium | Free - Low |
| **Minikube** | K8s Testing | ⭐⭐⭐ Medium | Free |
| **GKE** | Production | ⭐⭐⭐⭐ High | ~$74/mo |

### Port Reference

| Service | Port | Purpose |
|---------|------|---------|
| Order Service | 3000 | HTTP API |
| Inventory Service | 3002 | HTTP API |
| Grafana | 3001 | Monitoring UI |
| Prometheus | 9090 | Metrics |
| RabbitMQ Management | 15672 | Message Queue UI |
| PostgreSQL (Order) | 5432 | Database |
| PostgreSQL (Inventory) | 5433 | Database |
| Redis | 6379 | Cache |

### Environment Files

```bash
# Order Service (.env)
DATABASE_URL=postgresql://valerix:orderpass@localhost:5432/orderdb
INVENTORY_SERVICE_URL=http://localhost:3002
RABBITMQ_URL=amqp://valerix:valerixpass@localhost:5672
REDIS_URL=redis://localhost:6379

# Inventory Service (.env)
DATABASE_URL=postgresql://valerix:inventorypass@localhost:5433/inventorydb
RABBITMQ_URL=amqp://valerix:valerixpass@localhost:5672
REDIS_URL=redis://localhost:6379
```

---

## 📚 Additional Resources

- [GKE Deployment Guide](docs/GKE_DEPLOYMENT.md) - Detailed GKE setup
- [API Documentation](README.md#-api-endpoints) - Available endpoints
- [Monitoring Guide](README.md#-monitoring) - Grafana dashboards
- [Architecture Overview](README.md#️-architecture-overview) - System design

---

## 🆘 Getting Help

If you encounter issues:

1. Check the [Troubleshooting](#7-troubleshooting) section
2. View service logs: `kubectl logs -f deployment/order-service -n valerix`
3. Check health endpoints: `curl http://localhost:3000/health`
4. Review Grafana dashboards for system metrics
5. Examine GitHub Actions logs for CI/CD issues

**Common Support Scenarios:**
- Database connection issues → Check passwords and connection strings
- Image pull errors → Verify image registry credentials  
- Pod crashes → Check resource limits and environment variables
- CI/CD failures → Verify GitHub secrets are configured

---

**Last Updated:** January 29, 2026  
**Maintained by:** BUET DevOps Team
