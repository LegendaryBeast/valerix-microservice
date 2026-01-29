#!/bin/bash
# Test Circuit Breaker

echo "================================================================"
echo "Testing Circuit Breaker Pattern"
echo "================================================================"
echo ""
echo "NOTE: This test requires Inventory Service to be STOPPED"
echo "Please stop the Inventory Service (Ctrl+C in its terminal)"
echo ""
read -p "Press ENTER when Inventory Service is stopped..."

echo ""
echo "Sending 10 requests to trigger circuit breaker..."
echo "Circuit should OPEN after ~5 failures"
echo ""

for i in {1..10}; do
  echo "Request $i..."
  start_time=$(date +%s%3N)
  
  response=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/orders \
    -H "Content-Type: application/json" \
    -d '{
      "customerId": "test-circuit-breaker",
      "items": [{"productId": "product_def", "quantity": 1, "price": 50}],
      "idempotencyKey": "cb-test-'$i'-'$(date +%s)'"
    }')
  
  end_time=$(date +%s%3N)
  duration=$((end_time - start_time))
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  order_id=$(echo "$body" | jq -r '.orderId // "N/A"')
  status=$(echo "$body" | jq -r '.status // "N/A"')
  
  echo "  Response time: ${duration}ms | HTTP: $http_code | Order: $order_id | Status: $status"
  
  # After request 5, circuit should start opening
  if [ $i -eq 6 ]; then
    echo ""
    echo "⚡ Circuit should be OPENING now - responses should fail faster!"
    echo ""
  fi
  
  sleep 1
done

echo ""
echo "================================================================"
echo "Circuit Breaker Test Complete"
echo "================================================================"
echo ""
echo "Observations:"
echo "- First ~5 requests: Normal timeouts (~5-7 seconds)"
echo "- After 5 failures: Circuit OPENS, requests fail fast (~0ms)"
echo "- Orders may still be created with PENDING_INVENTORY status"
echo ""
echo "✅ If later requests failed faster, circuit breaker is working!"
