#!/bin/bash
# Test Idempotency - Same request sent twice should return same response

echo "==================================="
echo "Testing Idempotency"
echo "==================================="
echo ""

# Use fixed idempotency key
IDEMPOTENCY_KEY="idempotency-test-fixed-key"

echo "Sending first request..."
response1=$(curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-idempotency-test",
    "items": [
      {
        "productId": "product_xyz",
        "quantity": 1,
        "price": 99.99
      }
    ],
    "idempotencyKey": "'$IDEMPOTENCY_KEY'"
  }')

order_id1=$(echo "$response1" | jq -r '.orderId')
echo "First request - Order ID: $order_id1"

echo ""
echo "Waiting 2 seconds..."
sleep 2

echo "Sending EXACT SAME request (testing idempotency)..."
response2=$(curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-idempotency-test",
    "items": [
      {
        "productId": "product_xyz",
        "quantity": 1,
        "price": 99.99
      }
    ],
    "idempotencyKey": "'$IDEMPOTENCY_KEY'"
  }')

order_id2=$(echo "$response2" | jq -r '.orderId')
echo "Second request - Order ID: $order_id2"

echo ""
if [ "$order_id1" == "$order_id2" ]; then
  echo "✅ PASS: Idempotency working! Same Order ID returned: $order_id1"
else
  echo "❌ FAIL: Different Order IDs returned!"
  echo "First:  $order_id1"
  echo "Second: $order_id2"
fi
