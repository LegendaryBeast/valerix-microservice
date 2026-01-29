#!/bin/bash
# Test Order Creation

echo "==================================="
echo "Testing Order Creation API"
echo "==================================="
echo ""

# Generate unique idempotency key
IDEMPOTENCY_KEY="test-order-$(date +%s)"

echo "Creating new order..."
response=$(curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "test-customer-001",
    "items": [
      {
        "productId": "product_abc",
        "quantity": 2,
        "price": 149.99
      }
    ],
    "idempotencyKey": "'$IDEMPOTENCY_KEY'"
  }')

echo "$response" | jq '.'

order_id=$(echo "$response" | jq -r '.orderId')
echo ""
echo "✅ Order created successfully!"
echo "Order ID: $order_id"
echo "Idempotency Key: $IDEMPOTENCY_KEY"
