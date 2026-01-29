# GCP CI/CD Setup Instructions

## Your Configuration
- **Project ID**: `devops-practice-485713`
- **GKE Cluster**: `devops-practice`
- **Zone**: `asia-south1-c`
- **GitHub Repo**: `LegendaryBeast/valerix-microservice`

---

## Option 1: Setup Using Google Cloud Shell (Recommended)

### Step 1: Open Google Cloud Shell
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the **Activate Cloud Shell** button (top right, terminal icon)
3. A terminal will open at the bottom of the page

### Step 2: Run Setup Commands

Copy and paste these commands **one by one** into Cloud Shell:

```bash
# Set your project
export PROJECT_ID="devops-practice-485713"
export GKE_CLUSTER_NAME="devops-practice"
export GKE_ZONE="asia-south1-c"
export GITHUB_REPO_OWNER="LegendaryBeast"
export GITHUB_REPO_NAME="valerix-microservice"

# Set active project
gcloud config set project $PROJECT_ID

# Get project number (save this output!)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
echo "Project Number: $PROJECT_NUMBER"

# Enable required APIs
gcloud services enable container.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable compute.googleapis.com
gcloud services enable iamcredentials.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com

# Create service account for GitHub Actions
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Service Account" \
  --project=$PROJECT_ID

# Grant permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/container.developer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"

# Create Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" \
  --location="global" \
  --display-name="GitHub Actions Pool" \
  --project=$PROJECT_ID

# Create Workload Identity Provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner=='${GITHUB_REPO_OWNER}'" \
  --project=$PROJECT_ID

# Allow GitHub Actions to impersonate service account
gcloud iam service-accounts add-iam-policy-binding \
  github-actions@${PROJECT_ID}.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}" \
  --project=$PROJECT_ID

# Display the values you need for GitHub Secrets
echo "=========================================="
echo "GitHub Secrets Configuration"
echo "=========================================="
echo ""
echo "GCP_PROJECT_ID:"
echo "$PROJECT_ID"
echo ""
echo "GKE_CLUSTER_NAME:"
echo "$GKE_CLUSTER_NAME"
echo ""
echo "GKE_ZONE:"
echo "$GKE_ZONE"
echo ""
echo "WIF_PROVIDER:"
echo "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
echo ""
echo "WIF_SERVICE_ACCOUNT:"
echo "github-actions@${PROJECT_ID}.iam.gserviceaccount.com"
echo ""
```

### Step 3: Save the Output

The last command will display your GitHub secrets. **Copy these values** - you'll need them in the next step.

---

## Step 4: Add GitHub Secrets

### 4.1 Navigate to GitHub Secrets Page

Go to: [https://github.com/LegendaryBeast/valerix-microservice/settings/secrets/actions](https://github.com/LegendaryBeast/valerix-microservice/settings/secrets/actions)

### 4.2 Add Each Secret

Click **"New repository secret"** for each of the following:

#### Secret 1: `GCP_PROJECT_ID`
```
devops-practice-485713
```

#### Secret 2: `GKE_CLUSTER_NAME`
```
devops-practice
```

#### Secret 3: `GKE_ZONE`
```
asia-south1-c
```

#### Secret 4: `WIF_PROVIDER`
```
projects/YOUR_PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```
**Note**: Replace `YOUR_PROJECT_NUMBER` with the actual project number from Step 2 output

#### Secret 5: `WIF_SERVICE_ACCOUNT`
```
github-actions@devops-practice-485713.iam.gserviceaccount.com
```

---

## Option 2: Manual Setup via GCP Console

If you prefer using the GCP Console UI instead of Cloud Shell:

### 1. Enable APIs
- Go to **APIs & Services** → **Library**
- Enable:
  - Kubernetes Engine API
  - Artifact Registry API
  - IAM API
  - Cloud Resource Manager API

### 2. Create Service Account
- Go to **IAM & Admin** → **Service Accounts**
- Click **Create Service Account**
- Name: `github-actions`
- Grant roles:
  - Kubernetes Engine Developer
  - Storage Object Viewer

### 3. Create Workload Identity Pool
- Go to **IAM & Admin** → **Workload Identity Federation**
- Click **Create Pool**
- Name: `github-pool`
- Enable pool
- Add OIDC provider:
  - Provider type: OIDC
  - Name: `github-provider`
  - Issuer URL: `https://token.actions.githubusercontent.com`
  - Audience: Default
  - Attribute mapping:
    - `google.subject` = `assertion.sub`
    - `attribute.repository` = `assertion.repository`
    - `attribute.repository_owner` = `assertion.repository_owner`
  - Attribute condition: `assertion.repository_owner == 'LegendaryBeast'`

### 4. Grant Service Account Access
- In the Workload Identity Pool, click on `github-provider`
- Click **Grant Access**
- Select service account: `github-actions@devops-practice-485713.iam.gserviceaccount.com`
- Add condition for repository: `LegendaryBeast/valerix-microservice`

---

## Step 5: Verify Cluster Access

Run this in Cloud Shell to make sure your cluster is accessible:

```bash
gcloud container clusters get-credentials devops-practice \
  --zone=asia-south1-c \
  --project=devops-practice-485713

kubectl get nodes
```

---

## Step 6: Test CI/CD Pipeline

Once GitHub secrets are configured:

```bash
# Make a small change to trigger CI/CD
git commit --allow-empty -m "Test CI/CD pipeline"
git push origin main
```

Then monitor:
- **GitHub Actions**: https://github.com/LegendaryBeast/valerix-microservice/actions
- **Kubernetes Pods**: `kubectl get pods -n valerix -w`

---

## Troubleshooting

### Issue: "Service account already exists"
This is fine - the setup script handles this automatically. Continue with the next steps.

### Issue: "Permission denied" when running gcloud commands
Make sure you have Owner or Editor role on the GCP project.

### Issue: GitHub Actions fails with "authentication failed"
1. Double-check all GitHub secrets are correctly copied (no extra spaces)
2. Verify the WIF_PROVIDER path includes the correct project number
3. Ensure the service account email is exactly: `github-actions@devops-practice-485713.iam.gserviceaccount.com`

### Issue: Can't find project number
Run in Cloud Shell:
```bash
gcloud projects describe devops-practice-485713 --format='value(projectNumber)'
```

---

## Quick Reference

**GitHub Repository Settings:**
https://github.com/LegendaryBeast/valerix-microservice/settings/secrets/actions

**Google Cloud Console:**
https://console.cloud.google.com/kubernetes/list?project=devops-practice-485713

**GitHub Actions:**
https://github.com/LegendaryBeast/valerix-microservice/actions

---

**Need Help?** Refer to the [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) for detailed deployment instructions.
