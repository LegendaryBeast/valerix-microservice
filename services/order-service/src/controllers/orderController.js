const orderService = require('../services/orderService');
const logger = require('../utils/logger');

class OrderController {
    /**
     * Create a new order
     */
    async createOrder(req, res) {
        try {
            const { customerId, items, idempotencyKey } = req.body;

            // Validate required fields
            if (!customerId || !items) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'customerId and items are required',
                });
            }

            const order = await orderService.createOrder({
                customerId,
                items,
                idempotencyKey,
            });

            logger.info('Order created via API', { orderId: order.orderId });

            return res.status(201).json(order);
        } catch (error) {
            logger.error('Error in createOrder controller', {
                error: error.message,
            });

            if (error.message.includes('Invalid')) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: error.message,
                });
            }

            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to create order. Please try again later.',
            });
        }
    }

    /**
     * Get order by ID
     */
    async getOrder(req, res) {
        try {
            const { orderId } = req.params;

            const order = await orderService.getOrder(orderId);

            return res.status(200).json(order);
        } catch (error) {
            logger.error('Error in getOrder controller', {
                error: error.message,
                orderId: req.params.orderId,
            });

            if (error.message.includes('not found')) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Order not found',
                });
            }

            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to retrieve order',
            });
        }
    }

    /**
     * List orders
     */
    async listOrders(req, res) {
        try {
            const { customerId, limit = 10, offset = 0 } = req.query;

            const orders = await orderService.listOrders(
                customerId,
                parseInt(limit, 10),
                parseInt(offset, 10)
            );

            return res.status(200).json({
                orders,
                limit: parseInt(limit, 10),
                offset: parseInt(offset, 10),
                count: orders.length,
            });
        } catch (error) {
            logger.error('Error in listOrders controller', {
                error: error.message,
            });

            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to list orders',
            });
        }
    }
}

module.exports = new OrderController();
