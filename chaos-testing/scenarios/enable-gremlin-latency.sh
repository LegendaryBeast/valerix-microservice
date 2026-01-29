#!/bin/bash
# Enable Gremlin Latency in Inventory Service

echo "================================================================"
echo "Enabling Gremlin Latency Simulation"
echo "================================================================"
echo ""

ENV_FILE="services/inventory-service/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error: $ENV_FILE not found"
  echo "Please create .env file from .env.example"
  exit 1
fi

echo "Updating $ENV_FILE..."

# Update or add gremlin settings
if grep -q "GREMLIN_ENABLED" "$ENV_FILE"; then
  sed -i '' 's/GREMLIN_ENABLED=.*/GREMLIN_ENABLED=true/' "$ENV_FILE"
  sed -i '' 's/GREMLIN_LATENCY_MS=.*/GREMLIN_LATENCY_MS=3000/' "$ENV_FILE"
  sed -i '' 's/GREMLIN_PROBABILITY=.*/GREMLIN_PROBABILITY=1.0/' "$ENV_FILE"
else
  echo "" >> "$ENV_FILE"
  echo "# Chaos Testing - Gremlin Latency" >> "$ENV_FILE"
  echo "GREMLIN_ENABLED=true" >> "$ENV_FILE"
  echo "GREMLIN_LATENCY_MS=3000" >> "$ENV_FILE"
  echo "GREMLIN_PROBABILITY=1.0" >> "$ENV_FILE"
fi

echo "✅ Gremlin latency enabled!"
echo ""
echo "Settings:"
echo "  - Enabled: true"
echo "  - Latency: 3000ms (3 seconds)"
echo "  - Probability: 100% (every request)"
echo ""
echo "⚠️  RESTART Inventory Service for changes to take effect!"
echo ""
echo "Test with:"
echo "  time curl http://localhost:3002/api/inventory/product_abc"
echo ""
echo "Expected: Response should take ~3 seconds"
