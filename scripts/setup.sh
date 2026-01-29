#!/bin/bash

# Valerix Microservices - Quick Setup Script

set -e

echo "======================================"
echo "Valerix Microservices Setup"
echo "======================================"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ All prerequisites are installed"
echo ""

# Create .env files from examples
echo "Creating .env files..."
cp services/order-service/.env.example services/order-service/.env
cp services/inventory-service/.env.example services/inventory-service/.env
echo "✅ Environment files created"
echo ""

# Start infrastructure services
echo "Starting infrastructure services (PostgreSQL, Redis, Rabbit MQ, Prometheus, Grafana)..."
cd infrastructure/docker
docker-compose up -d
cd ../..

echo "⏳ Waiting for databases to be ready..."
sleep 10

echo "✅ Infrastructure services started"
echo ""

# Install Order Service dependencies
echo "Installing Order Service dependencies..."
cd services/order-service
npm install
cd ../..
echo "✅ Order Service dependencies installed"
echo ""

# Install Inventory Service dependencies
echo "Installing Inventory Service dependencies..."
cd services/inventory-service
npm install
cd ../..
echo "✅ Inventory Service dependencies installed"
echo ""

echo "======================================"
echo "✅ Setup Complete!"
echo "======================================"
echo ""
echo "Infrastructure Services:"
echo "  - PostgreSQL (Order DB):    localhost:5432"
echo "  - PostgreSQL (Inventory DB): localhost:5433"
echo "  - Redis:                    localhost:6379"
echo "  - RabbitMQ:                 localhost:5672"
echo "  - RabbitMQ Management UI:   http://localhost:15672 (valerix/valerixpass)"
echo "  - Prometheus:               http://localhost:9090"
echo "  - Grafana:                  http://localhost:3001 (admin/admin)"
echo ""
echo "To start the services:"
echo "  Order Service:     cd services/order-service && npm run dev"
echo "  Inventory Service: cd services/inventory-service && npm run dev"
echo ""
echo "To stop infrastructure:"
echo "  cd infrastructure/docker && docker-compose down"
echo ""
