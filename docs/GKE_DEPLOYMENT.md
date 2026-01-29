# GKE Deployment Guide

## Prerequisites

Before deploying to Google Kubernetes Engine, you need to set up the following:

### 1. Google Cloud Account & Project

**Action Required**: Create/Select GCP Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Note your **Project ID** (e.g., `valerix-prod-12345`)
4. Enable billing on your project (you get $300 free credit for 90 days)

### 2. Enable Required APIs

Run these commands in [Google Cloud Shell](https://shell.cloud.google.com):

```bash
# Set your project ID
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable container.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable compute.googleapis.com
```

### 3. Create GKE Cluster

**Option A: Using gcloud CLI** (Recommended)

```bash
# Create a 3-node cluster (adjust zone as needed)
gcloud container clusters create valerix-cluster \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type e2-small \
  --disk-size 20 \
  --enable-autoscaling \
  --min-nodes 2 \
  --max-nodes 5

# Get credentials
gcloud container clusters get-credentials valerix-cluster --zone us-central1-a
```

**Option B: Using GCP Console**
1. Navigate to Kubernetes Engine → Clusters
2. Click "Create Cluster"
3. Choose "Standard" cluster
4. Configure:
   - Name: `valerix-cluster`
   - Zone: `us-central1-a`
   - Node pool: 3 nodes, e2-small
5. Click "Create"

---

## GitHub Actions Setup

### Required GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

**You need to create these 4 secrets:**

#### 1. `GCP_PROJECT_ID`
- Value: Your Google Cloud Project ID
- Example: `valerix-prod-12345`

#### 2. `GKE_CLUSTER_NAME`
- Value: `valerix-cluster`

#### 3. `GKE_ZONE`
- Value: `us-central1-a` (or the zone you chose)

#### 4. Workload Identity Federation (Recommended Approach)

**Setup Steps**:

```bash
# 1. Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Service Account"

# 2. Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/container.developer"

# 3. Create Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# 4. Create Workload Identity Provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository_owner=='YOUR-GITHUB-USERNAME'"

# 5. Allow GitHub Actions to impersonate service account
gcloud iam service-accounts add-iam-policy-binding \
  github-actions@${PROJECT_ID}.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR-GITHUB-USERNAME/valerix-microservice"

# 6. Get the values for GitHub secrets
echo "WIF_PROVIDER: projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
echo "WIF_SERVICE_ACCOUNT: github-actions@${PROJECT_ID}.iam.gserviceaccount.com"
```

**Replace**:
- `YOUR-GITHUB-USERNAME` with `LegendaryBeast`
- `PROJECT_NUMBER` with your project number (find it in GCP Console)

Then add these GitHub secrets:
- `WIF_PROVIDER`: The provider path from above
- `WIF_SERVICE_ACCOUNT`: The service account email

---

## Database Passwords

**IMPORTANT SECURITY NOTE**: The example secrets file contains default passwords. 

**Before deploying to production**:

1. Create a secure `secrets.yaml` (not committed to git):

```bash
cd infrastructure/kubernetes

# Copy the example
cp secrets.yaml.example secrets.yaml

# Generate strong passwords
ORDER_DB_PASS=$(openssl rand -base64 32)
INVENTORY_DB_PASS=$(openssl rand -base64 32)
RABBITMQ_PASS=$(openssl rand -base64 32)

# Update secrets.yaml with these passwords
sed -i '' "s/orderpass123/$ORDER_DB_PASS/g" secrets.yaml
sed -i '' "s/inventorypass123/$INVENTORY_DB_PASS/g" secrets.yaml
sed -i '' "s/valerixpass123/$RABBITMQ_PASS/g" secrets.yaml
```

2. Update service deployments to use the same passwords:
   - Edit `services/order-service.yaml`
   - Edit `services/inventory-service.yaml`
   - Update DATABASE_URL and RABBITMQ_URL with new passwords

---

## Manual Deployment (First Time)

Once your GKE cluster is ready and GitHub secrets are configured:

### 1. Build and Push Docker Images Locally

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Build and push order-service
cd services/order-service
docker build -t ghcr.io/legendarybeast/order-service:latest .
docker push ghcr.io/legendarybeast/order-service:latest

# Build and push inventory-service
cd ../inventory-service
docker build -t ghcr.io/legendarybeast/inventory-service:latest .
docker push ghcr.io/legendarybeast/inventory-service:latest
```

### 2. Deploy to Kubernetes

```bash
cd ../../infrastructure/kubernetes

# Apply everything in order
kubectl apply -f namespace/namespace.yaml
kubectl apply -f secrets.yaml
kubectl apply -f databases/
kubectl apply -f services/

# Wait for deployments
kubectl wait --for=condition=ready pod -l app=order-db -n valerix --timeout=300s
kubectl wait --for=condition=ready pod -l app=inventory-db -n valerix --timeout=300s

# Check status
kubectl get pods -n valerix
kubectl get services -n valerix
```

### 3. Get Service URLs

```bash
# Get the LoadBalancer IP for order-service
kubectl get service order-service -n valerix

# Test the service
ORDER_IP=$(kubectl get service order-service -n valerix -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
curl http://$ORDER_IP:3000/health
```

---

## Automated Deployment (After Initial Setup)

Once GitHub Actions is configured, deployment is automatic:

1. **On Pull Request**: Runs tests
2. **On Push to Main**: 
   - Runs tests
   - Builds Docker images
   - Pushes to GitHub Container Registry  
   - Deploys to GKE
   - Verifies deployment

Simply push code to main branch:

```bash
git add .
git commit -m "Deploy to GKE"
git push origin main
```

Check deployment progress:
- GitHub → Actions tab
- Or run: `kubectl get pods -n valerix -w`

---

## Cost Estimates

**GKE Cluster (3 e2-small nodes)**:
- Compute: ~$50/month
- Storage (30GB SSD): ~$6/month
- Load Balancer: ~$18/month
- **Total: ~$74/month**

**Free Tier**: Google provides $300 credit for 90 days for new users.

---

## Monitoring & Troubleshooting

```bash
# View pod logs
kubectl logs -f deployment/order-service -n valerix
kubectl logs -f deployment/inventory-service -n valerix

# Describe pod for errors
kubectl describe pod <pod-name> -n valerix

# Execute into pod
kubectl exec -it <pod-name> -n valerix -- /bin/sh

# Check service health
kubectl port-forward service/order-service 3000:3000 -n valerix
curl http://localhost:3000/health
```

---

## Next Steps

After deployment:
1. ✅ Test endpoints using the LoadBalancer IP
2. ✅ Set up monitoring (Prometheus/Grafana)
3. ✅ Configure domain name and SSL certificate
4. ✅ Set up automated backups for databases
5. ✅ Implement proper secrets management (Google Secret Manager)

---

## Credentials Checklist

**You will need to provide:**

- [x] Google Cloud Project ID
- [x] GKE Cluster Name (after creating cluster)
- [x] GKE Zone
- [x] GitHub Personal Access Token (for ghcr.io)
- [x] Workload Identity Provider (after setting up)
- [x] Workload Identity Service Account (after setting up)

**I'll help you with each step!**
