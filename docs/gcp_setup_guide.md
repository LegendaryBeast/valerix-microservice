# GCP Setup - Interactive Guide

## Step 1: Install Google Cloud SDK ✓

Check if gcloud is installed (I'll verify this automatically).

If not installed, install it:
```bash
# macOS (using Homebrew)
brew install --cask google-cloud-sdk

# Or download from: https://cloud.google.com/sdk/docs/install
```

---

## Step 2: Login to Google Cloud

Run this command and follow the browser login:
```bash
gcloud auth login
```

This will:
1. Open your browser
2. Ask you to select your Google account
3. Grant permissions to gcloud CLI

---

## Step 3: Create/Select GCP Project

### Option A: Create New Project
```bash
# Create a new project (choose a unique project ID)
gcloud projects create valerix-prod-001 --name="Valerix Microservices"

# Set as default project
gcloud config set project valerix-prod-001
```

### Option B: Use Existing Project
```bash
# List your projects
gcloud projects list

# Set existing project
gcloud config set project YOUR-PROJECT-ID
```

**IMPORTANT**: Save your Project ID - you'll need it later!

---

## Step 4: Enable Billing

You must enable billing to use GKE (but you get $300 free credits for 90 days).

1. Go to: https://console.cloud.google.com/billing
2. Link a billing account to your project
3. Verify billing is enabled:
```bash
gcloud beta billing projects describe $(gcloud config get-value project) --format="get(billingEnabled)"
```

Should return: `True`

---

## Step 5: Enable Required APIs

```bash
# Set your project (replace with your actual project ID)
export PROJECT_ID=$(gcloud config get-value project)

# Enable required APIs (takes 2-3 minutes)
gcloud services enable container.googleapis.com \
  compute.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com

# Verify APIs are enabled
gcloud services list --enabled | grep -E "(container|compute|iam)"
```

---

## Step 6: Create GKE Cluster

**IMPORTANT**: Choose your configuration:

### Recommended (Cost-effective for learning)
```bash
gcloud container clusters create valerix-cluster \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type e2-small \
  --disk-size 20 \
  --disk-type pd-standard \
  --enable-autoscaling \
  --min-nodes 2 \
  --max-nodes 5 \
  --enable-autorepair \
  --enable-autoupgrade

# This takes 3-5 minutes
```

### Production (More powerful, higher cost)
```bash
gcloud container clusters create valerix-cluster \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type e2-medium \
  --disk-size 30 \
  --enable-autoscaling \
  --min-nodes 3 \
  --max-nodes 10
```

**Cost Estimate**:
- e2-small: ~$50/month
- e2-medium: ~$100/month
- (Covered by $300 free credits)

---

## Step 7: Get Cluster Credentials

```bash
# Get credentials to access your cluster
gcloud container clusters get-credentials valerix-cluster \
  --zone us-central1-a

# Verify connection
kubectl cluster-info
kubectl get nodes
```

You should see 3 nodes in Ready state!

---

## Step 8: Create Service Account for GitHub Actions

```bash
# Get your project number
export PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Service Account" \
  --description="Service account for GitHub Actions CI/CD"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:github-actions@$(gcloud config get-value project).iam.gserviceaccount.com" \
  --role="roles/container.developer"

gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:github-actions@$(gcloud config get-value project).iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Create Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Create Workload Identity Provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository_owner=='LegendaryBeast'"

# Allow GitHub to impersonate service account
gcloud iam service-accounts add-iam-policy-binding \
  "github-actions@$(gcloud config get-value project).iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/LegendaryBeast/valerix-microservice"
```

---

## Step 9: Get Values for GitHub Secrets

Run these commands and save the output:

```bash
echo "=== GitHub Secrets Values ==="
echo ""
echo "GCP_PROJECT_ID:"
gcloud config get-value project
echo ""
echo "GKE_CLUSTER_NAME:"
echo "valerix-cluster"
echo ""
echo "GKE_ZONE:"
echo "us-central1-a"
echo ""
echo "WIF_PROVIDER:"
echo "projects/$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
echo ""
echo "WIF_SERVICE_ACCOUNT:"
echo "github-actions@$(gcloud config get-value project).iam.gserviceaccount.com"
echo ""
echo "==========================="
```

---

## Step 10: Configure GitHub Secrets

1. Go to: https://github.com/LegendaryBeast/valerix-microservice/settings/secrets/actions
2. Click "New repository secret"
3. Add each secret:

| Secret Name | Value (from Step 9) |
|-------------|---------------------|
| `GCP_PROJECT_ID` | Your project ID |
| `GKE_CLUSTER_NAME` | valerix-cluster |
| `GKE_ZONE` | us-central1-a |
| `WIF_PROVIDER` | projects/PROJECT_NUMBER/... |
| `WIF_SERVICE_ACCOUNT` | github-actions@PROJECT_ID.iam.gserviceaccount.com |

---

## Step 11: Create GitHub Personal Access Token

For pushing Docker images to GitHub Container Registry:

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name: "GKE Docker Push"
4. Scopes: Select `write:packages`, `read:packages`, `delete:packages`
5. Click "Generate token"
6. **SAVE THE TOKEN** - you'll need it later

---

## Step 12: Test Local Deployment

Before using GitHub Actions, test locally:

```bash
# Make sure you're in the project directory
cd /Users/tanzimhasanprappo/Desktop/BUET\ DevOps/valerix-microservices

# Run the deployment script
./scripts/deploy-gke.sh
```

---

## Troubleshooting

**"Quota exceeded" error?**
- Request quota increase in GCP Console
- Or use smaller machine types (e2-micro for testing)

**"Permission denied" error?**
- Make sure billing is enabled
- Verify service account has correct permissions

**Cluster creation takes too long?**
- Normal! Can take 3-5 minutes
- Check status: `gcloud container clusters list`

---

## Next Steps After Setup

Once GCP is configured, every push to main will:
1. ✅ Run tests
2. ✅ Build Docker images
3. ✅ Push to ghcr.io
4. ✅ Deploy to GKE
5. ✅ Verify deployment

**Check deployment**: https://github.com/LegendaryBeast/valerix-microservice/actions
