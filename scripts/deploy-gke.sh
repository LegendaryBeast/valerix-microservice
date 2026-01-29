#!/bin/bash
set -e

echo "🚀 Valerix Microservices - GKE Deployment Script"
echo "================================================"

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    exit 1
fi

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud not found. Please install Google Cloud SDK first."
    exit 1
fi

echo ""
echo "📋 Current Configuration:"
echo "  Project: $(gcloud config get-value project)"
echo "  Current Context: $(kubectl config current-context)"
echo ""

read -p "Continue with this configuration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

cd "$(dirname "$0")/../infrastructure/kubernetes"

echo ""
echo "1️⃣  Creating namespace..."
kubectl apply -f namespace/namespace.yaml

echo ""
echo "2️⃣  Creating secrets..."
if [ ! -f secrets.yaml ]; then
    echo "⚠️  secrets.yaml not found, using example (NOT RECOMMENDED FOR PRODUCTION)"
    cp secrets.yaml.example secrets.yaml
fi
kubectl apply -f secrets.yaml

echo ""
echo "3️⃣  Deploying databases..."
kubectl apply -f databases/

echo ""
echo "⏳ Waiting for databases to be ready (this may take 2-3 minutes)..."
kubectl wait --for=condition=ready pod -l app=order-db -n valerix --timeout=300s || echo "Order DB not ready yet"
kubectl wait --for=condition=ready pod -l app=inventory-db -n valerix --timeout=300s || echo "Inventory DB not ready yet"
kubectl wait --for=condition=ready pod -l app=redis -n valerix --timeout=300s || echo "Redis not ready yet"
kubectl wait --for=condition=ready pod -l app=rabbitmq -n valerix --timeout=300s || echo "RabbitMQ not ready yet"

echo ""
echo "4️⃣  Deploying microservices..."
kubectl apply -f services/

echo ""
echo "⏳ Waiting for services to be ready..."
kubectl rollout status deployment/order-service -n valerix
kubectl rollout status deployment/inventory-service -n valerix

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Current status:"
kubectl get pods -n valerix
echo ""
kubectl get services -n valerix

echo ""
echo "🔗 Getting service URLs..."
ORDER_IP=$(kubectl get service order-service -n valerix -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")

if [ "$ORDER_IP" != "pending" ]; then
    echo ""
    echo "✅ Order Service is available at: http://$ORDER_IP:3000"
    echo ""
    echo "Test endpoints:"
    echo "  Health: curl http://$ORDER_IP:3000/health"
    echo "  Orders: curl http://$ORDER_IP:3000/api/orders"
else
    echo ""
    echo "⏳ LoadBalancer IP is still pending. Run this to check:"
    echo "   kubectl get service order-service -n valerix"
fi

echo ""
echo "📝 To view logs:"
echo "  kubectl logs -f deployment/order-service -n valerix"
echo "  kubectl logs -f deployment/inventory-service -n valerix"

echo ""
echo "Done! 🎉"
