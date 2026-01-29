#!/bin/bash
# Disable Gremlin Latency

echo "================================================================"
echo "Disabling Gremlin Latency Simulation"
echo "================================================================"
echo ""

ENV_FILE="services/inventory-service/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error: $ENV_FILE not found"
  exit 1
fi

echo "Updating $ENV_FILE..."

# Disable gremlin
sed -i '' 's/GREMLIN_ENABLED=.*/GREMLIN_ENABLED=false/' "$ENV_FILE"

echo "✅ Gremlin latency disabled!"
echo ""
echo "⚠️  RESTART Inventory Service for changes to take effect!"
