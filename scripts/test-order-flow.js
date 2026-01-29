const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const ORDER_SERVICE_URL = 'http://localhost:3000/api/orders';
const INVENTORY_SERVICE_URL = 'http://localhost:3002/api/inventory';

// Test Data
const customerId = 'test-customer-' + Math.floor(Math.random() * 1000);
const productId = 'prod-101'; // Assuming this product exists or will be created
// const productId = 'prod-101'; // Assuming this product exists or will be created
const quantity = 1;

async function runTest() {
    try {
        console.log('🚀 Starting End-to-End Order Flow Test...');

        // 0. Ensure Product Exists
        console.log('\n🔍 Checking Inventory...');
        let productId = 'prod-101';
        let amount = 100;

        try {
            const inventoryResponse = await axios.get(INVENTORY_SERVICE_URL);
            if (inventoryResponse.data && inventoryResponse.data.length > 0) {
                productId = inventoryResponse.data[0].productId;
                console.log(`✅ Found existing product: ${productId}`);
            } else {
                console.log('⚠️ No products found. Restocking new product...');
                await axios.post(`${INVENTORY_SERVICE_URL}/restock`, {
                    productId: 'prod-101',
                    quantity: 100
                });
                console.log('✅ Restocked prod-101');
            }
        } catch (error) {
            console.log('⚠️ Inventory check failed, attempting strict restock for prod-101');
            try {
                await axios.post(`${INVENTORY_SERVICE_URL}/restock`, {
                    productId: 'prod-101',
                    quantity: 100
                });
            } catch (e) {
                console.error('❌ Failed to prepare product:', e.message);
                // Proceeding anyway, might fail if product doesn't exist
            }
        }

        // 1. Create Order
        console.log('\n📦 Creating Order...');
        const orderPayload = {
            customerId,
            items: [
                {
                    productId,
                    quantity,
                    price: 100
                }
            ],
            idempotencyKey: uuidv4()
        };

        const createResponse = await axios.post(ORDER_SERVICE_URL, orderPayload);
        const orderId = createResponse.data.orderId;
        console.log(`✅ Order Created: ${orderId}`);
        console.log(`Initial Status: ${createResponse.data.status}`);

        // 2. Poll for Status Change
        console.log('\n⏳ Polling for Order Confirmation...');
        let confirmed = false;
        let attempts = 0;
        const maxAttempts = 20;

        while (!confirmed && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
            const orderResponse = await axios.get(`${ORDER_SERVICE_URL}/${orderId}`);
            const status = orderResponse.data.status;

            console.log(`Attempt ${attempts + 1}: Status is ${status}`);

            if (status === 'CONFIRMED') {
                confirmed = true;
                console.log('🎉 Order Confirmed!');
            } else if (status === 'FAILED' || status === 'CANCELLED') {
                console.error('❌ Order Failed or Cancelled');
                process.exit(1);
            }

            attempts++;
        }

        if (!confirmed) {
            console.error('❌ Timeout waiting for order confirmation');
            process.exit(1);
        }

        console.log('\n✅ End-to-End Test Passed Successfully!');

    } catch (error) {
        console.error('\n❌ Test Failed:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

runTest();
