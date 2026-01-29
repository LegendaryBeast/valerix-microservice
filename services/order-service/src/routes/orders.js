const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

/**
 * @route POST /api/orders
 * @desc Create a new order
 * @body { customerId, items, idempotencyKey }
 */
router.post('/', orderController.createOrder.bind(orderController));

/**
 * @route GET /api/orders/:orderId
 * @desc Get order by ID
 */
router.get('/:orderId', orderController.getOrder.bind(orderController));

/**
 * @route GET /api/orders
 * @desc List orders
 * @query { customerId, limit, offset }
 */
router.get('/', orderController.listOrders.bind(orderController));

module.exports = router;
