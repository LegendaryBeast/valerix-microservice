# GitHub Secrets Quick Reference

## 🔐 GitHub Secrets to Add

Add these at: https://github.com/LegendaryBeast/valerix-microservice/settings/secrets/actions

---

### 1️⃣ GCP_PROJECT_ID
```
devops-practice-485713
```

---

### 2️⃣ GKE_CLUSTER_NAME
```
devops-practice
```

---

### 3️⃣ GKE_ZONE
```
asia-south1-c
```

---

### 4️⃣ WIF_PROVIDER
```
projects/YOUR_PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

**⚠️ IMPORTANT**: Replace `YOUR_PROJECT_NUMBER` with your actual project number.

**To get your project number**, run this in [Google Cloud Shell](https://shell.cloud.google.com):
```bash
gcloud projects describe devops-practice-485713 --format='value(projectNumber)'
```

---

### 5️⃣ WIF_SERVICE_ACCOUNT
```
github-actions@devops-practice-485713.iam.gserviceaccount.com
```

---

## 📋 Setup Checklist

- [ ] Run setup commands in Google Cloud Shell (see [GCP_CICD_SETUP.md](GCP_CICD_SETUP.md))
- [ ] Get project number from Cloud Shell output
- [ ] Add all 5 secrets to GitHub
- [ ] Verify WIF_PROVIDER has correct project number
- [ ] Test by pushing to main branch
- [ ] Monitor deployment in GitHub Actions

---

## 🧪 Test Your Setup

After adding secrets:

```bash
# Trigger CI/CD pipeline
git commit --allow-empty -m "Test GKE deployment"
git push origin main
```

Watch the deployment:
- **GitHub Actions**: https://github.com/LegendaryBeast/valerix-microservice/actions
- **View Pods**: Run `kubectl get pods -n valerix -w` after connecting to cluster

---

## ✅ Expected Result

All 3 jobs should pass:
1. ✅ Run Tests
2. ✅ Build and Push Docker Images
3. ✅ Deploy to GKE

---

## 🆘 Common Issues

### Secret not working?
- Make sure there are no extra spaces before/after the value
- Secret names are case-sensitive
- GitHub requires you to re-enter secrets to update them

### Can't find project number?
Cloud Shell command:
```bash
gcloud projects describe devops-practice-485713 --format='value(projectNumber)'
```

Or find it in GCP Console → IAM & Admin → Settings

### WIF_PROVIDER format check
Should look like: `projects/123456789012/locations/global/workloadIdentityPools/github-pool/providers/github-provider`

The number after `projects/` is your project number (not project ID!)

---

**Full Setup Guide**: [GCP_CICD_SETUP.md](GCP_CICD_SETUP.md)
