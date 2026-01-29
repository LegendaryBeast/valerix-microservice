const db = require('../utils/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const config = require('../config');
const { updateInventory } = require('./inventoryClient');
const { metrics } = require('../middleware/metrics');

class OrderService {
    /**
     * Check if request is idempotent
     */
    async checkIdempotency(idempotencyKey) {
        try {
            const result = await db.query(
                'SELECT response_status, response_payload FROM idempotency_log WHERE idempotency_key = $1',
                [idempotencyKey]
            );

            if (result.rows.length > 0) {
                logger.info('Idempotent request detected', { idempotencyKey });
                return result.rows[0];
            }

            return null;
        } catch (error) {
            logger.error('Error checking idempotency', {
                error: error.message,
                idempotencyKey,
            });
            throw error;
        }
    }

    /**
     * Store idempotency record
     */
    async storeIdempotency(idempotencyKey, requestHash, responseStatus, responsePayload) {
        try {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + config.idempotency.ttlHours);

            await db.query(
                `INSERT INTO idempotency_log (idempotency_key, request_hash, response_status, response_payload, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (idempotency_key) DO NOTHING`,
                [idempotencyKey, requestHash, responseStatus, JSON.stringify(responsePayload), expiresAt]
            );

            logger.debug('Stored idempotency record', { idempotencyKey });
        } catch (error) {
            logger.error('Error storing idempotency', {
                error: error.message,
                idempotencyKey,
            });
            // Don't throw - this is not critical
        }
    }

    /**
     * Create a new order
     */
    async createOrder(orderData) {
        const startTime = Date.now();
        const {
            customerId,
            items,
            idempotencyKey = uuidv4(),
        } = orderData;

        // Create request hash for idempotency
        const requestHash = crypto
            .createHash('sha256')
            .update(JSON.stringify({ customerId, items }))
            .digest('hex');

        try {
            // Check idempotency
            const existingResponse = await this.checkIdempotency(idempotencyKey);
            if (existingResponse) {
                logger.info('Returning cached response for idempotent request', {
                    idempotencyKey,
                });
                return JSON.parse(existingResponse.response_payload);
            }

            // Validate order data
            if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
                throw new Error('Invalid order data: customerId and items are required');
            }

            // Calculate total amount
            const totalAmount = items.reduce((sum, item) => {
                if (!item.productId || !item.quantity || !item.price) {
                    throw new Error('Invalid item: productId, quantity, and price are required');
                }
                return sum + item.quantity * item.price;
            }, 0);

            // Begin transaction
            const client = await db.getClient();

            try {
                await client.query('BEGIN');

                // Insert order
                const orderResult = await client.query(
                    `INSERT INTO orders (customer_id, total_amount, status, idempotency_key)
           VALUES ($1, $2, $3, $4)
           RETURNING order_id, customer_id, total_amount, status, created_at`,
                    [customerId, totalAmount, 'PENDING', idempotencyKey]
                );

                const order = orderResult.rows[0];

                // Insert order items
                const itemPromises = items.map(item =>
                    client.query(
                        `INSERT INTO order_items (order_id, product_id, quantity, price)
             VALUES ($1, $2, $3, $4)`,
                        [order.order_id, item.productId, item.quantity, item.price]
                    )
                );

                await Promise.all(itemPromises);

                // Insert into outbox for event publishing
                await client.query(
                    `INSERT INTO outbox (event_type, aggregate_id, payload)
           VALUES ($1, $2, $3)`,
                    ['ORDER_CREATED', order.order_id, JSON.stringify(order)]
                );

                await client.query('COMMIT');

                logger.info('Order created successfully', {
                    orderId: order.order_id,
                    customerId,
                    totalAmount,
                });

                // Update metrics
                metrics.orderCreatedCounter.inc({ status: 'success' });

                // Try to update inventory (asynchronous, non-blocking)
                this.updateInventoryAsync(order.order_id, items).catch(error => {
                    logger.error('Failed to update inventory', {
                        orderId: order.order_id,
                        error: error.message,
                    });
                    // Update order status to PENDING_INVENTORY
                    this.updateOrderStatus(order.order_id, 'PENDING_INVENTORY').catch(err => {
                        logger.error('Failed to update order status', {
                            orderId: order.order_id,
                            error: err.message,
                        });
                    });
                });

                // Prepare response
                const response = {
                    orderId: order.order_id,
                    customerId: order.customer_id,
                    totalAmount: parseFloat(order.total_amount),
                    status: order.status,
                    items,
                    createdAt: order.created_at,
                };

                // Store idempotency
                await this.storeIdempotency(idempotencyKey, requestHash, 201, response);

                // Track processing duration
                const duration = (Date.now() - startTime) / 1000;
                metrics.orderProcessingDuration.observe(duration);

                return response;
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            logger.error('Error creating order', {
                error: error.message,
                customerId,
            });

            metrics.orderCreatedCounter.inc({ status: 'failure' });

            throw error;
        }
    }

    /**
     * Update inventory asynchronously
     */
    async updateInventoryAsync(orderId, items) {
        try {
            const inventoryUpdates = items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                orderId,
            }));

            await updateInventory({ orderId, items: inventoryUpdates });

            logger.info('Inventory updated successfully', { orderId });

            // Update order status to CONFIRMED
            await this.updateOrderStatus(orderId, 'CONFIRMED');
        } catch (error) {
            logger.error('Error updating inventory', {
                orderId,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Update order status
     */
    async updateOrderStatus(orderId, status) {
        try {
            await db.query(
                'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2',
                [status, orderId]
            );

            logger.info('Order status updated', { orderId, status });
        } catch (error) {
            logger.error('Error updating order status', {
                orderId,
                status,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Get order by ID
     */
    async getOrder(orderId) {
        try {
            const result = await db.query(
                `SELECT o.*, 
          json_agg(json_build_object(
            'productId', oi.product_id,
            'quantity', oi.quantity,
            'price', oi.price
          )) as items
         FROM orders o
         LEFT JOIN order_items oi ON o.order_id = oi.order_id
         WHERE o.order_id = $1
         GROUP BY o.order_id`,
                [orderId]
            );

            if (result.rows.length === 0) {
                throw new Error('Order not found');
            }

            const order = result.rows[0];
            return {
                orderId: order.order_id,
                customerId: order.customer_id,
                totalAmount: parseFloat(order.total_amount),
                status: order.status,
                items: order.items,
                createdAt: order.created_at,
                updatedAt: order.updated_at,
            };
        } catch (error) {
            logger.error('Error getting order', { orderId, error: error.message });
            throw error;
        }
    }

    /**
     * List orders
     */
    async listOrders(customerId, limit = 10, offset = 0) {
        try {
            const params = [limit, offset];
            let query = `
        SELECT order_id, customer_id, total_amount, status, created_at, updated_at
        FROM orders
      `;

            if (customerId) {
                query += ' WHERE customer_id = $3';
                params.push(customerId);
            }

            query += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';

            const result = await db.query(query, params);

            return result.rows.map(order => ({
                orderId: order.order_id,
                customerId: order.customer_id,
                totalAmount: parseFloat(order.total_amount),
                status: order.status,
                createdAt: order.created_at,
                updatedAt: order.updated_at,
            }));
        } catch (error) {
            logger.error('Error listing orders', { error: error.message });
            throw error;
        }
    }
}

module.exports = new OrderService();
