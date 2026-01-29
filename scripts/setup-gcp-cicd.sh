#!/bin/bash

# GCP CI/CD Setup Script for Valerix Microservices
# This script sets up Workload Identity Federation for GitHub Actions

set -e  # Exit on error

echo "=========================================="
echo "GCP CI/CD Setup for Valerix Microservices"
echo "=========================================="
echo ""

# Your GCP Configuration
export PROJECT_ID="devops-practice-485713"
export GKE_CLUSTER_NAME="devops-practice"
export GKE_ZONE="asia-south1-c"
export GITHUB_REPO_OWNER="LegendaryBeast"
export GITHUB_REPO_NAME="valerix-microservice"

echo "Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Cluster Name: $GKE_CLUSTER_NAME"
echo "  Zone: $GKE_ZONE"
echo "  GitHub Repo: $GITHUB_REPO_OWNER/$GITHUB_REPO_NAME"
echo ""

# Set active project
echo "Step 1: Setting active GCP project..."
gcloud config set project $PROJECT_ID

# Get project number
echo "Step 2: Getting project number..."
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
echo "  Project Number: $PROJECT_NUMBER"
echo ""

# Create service account for GitHub Actions
echo "Step 3: Creating service account for GitHub Actions..."
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Service Account" \
  --project=$PROJECT_ID \
  || echo "  Service account already exists, continuing..."
echo ""

# Grant necessary permissions to service account
echo "Step 4: Granting permissions to service account..."

# Container Developer (for GKE deployments)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/container.developer" \
  --condition=None

# Artifact Registry Writer (for pushing images)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer" \
  --condition=None

# Storage Object Viewer (for reading GKE configs)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer" \
  --condition=None

echo "  ✅ Permissions granted"
echo ""

# Create Workload Identity Pool
echo "Step 5: Creating Workload Identity Pool..."
gcloud iam workload-identity-pools create "github-pool" \
  --location="global" \
  --display-name="GitHub Actions Pool" \
  --project=$PROJECT_ID \
  || echo "  Pool already exists, continuing..."
echo ""

# Create Workload Identity Provider
echo "Step 6: Creating Workload Identity Provider (OIDC)..."
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner=='${GITHUB_REPO_OWNER}'" \
  --project=$PROJECT_ID \
  || echo "  Provider already exists, continuing..."
echo ""

# Allow GitHub Actions to impersonate the service account
echo "Step 7: Allowing GitHub Actions to impersonate service account..."
gcloud iam service-accounts add-iam-policy-binding \
  github-actions@${PROJECT_ID}.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}" \
  --project=$PROJECT_ID \
  --condition=None
echo "  ✅ Workload Identity binding created"
echo ""

# Get cluster credentials
echo "Step 8: Getting GKE cluster credentials..."
gcloud container clusters get-credentials $GKE_CLUSTER_NAME \
  --zone=$GKE_ZONE \
  --project=$PROJECT_ID
echo "  ✅ Cluster credentials configured"
echo ""

# Display GitHub Secrets
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "📋 Add these secrets to your GitHub repository:"
echo "   Go to: https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/settings/secrets/actions"
echo ""
echo "Secret Name: GCP_PROJECT_ID"
echo "Value: $PROJECT_ID"
echo ""
echo "Secret Name: GKE_CLUSTER_NAME"
echo "Value: $GKE_CLUSTER_NAME"
echo ""
echo "Secret Name: GKE_ZONE"
echo "Value: $GKE_ZONE"
echo ""
echo "Secret Name: WIF_PROVIDER"
echo "Value: projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
echo ""
echo "Secret Name: WIF_SERVICE_ACCOUNT"
echo "Value: github-actions@${PROJECT_ID}.iam.gserviceaccount.com"
echo ""
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Add the above secrets to GitHub"
echo "2. Push code to trigger CI/CD pipeline"
echo "3. Monitor deployment: kubectl get pods -n valerix -w"
echo ""
