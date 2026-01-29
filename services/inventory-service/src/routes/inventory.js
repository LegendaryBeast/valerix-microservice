const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

/**
 * @route GET /api/inventory
 * @desc List all inventory
 */
router.get('/', inventoryController.listInventory.bind(inventoryController));

/**
 * @route GET /api/inventory/:productId
 * @desc Get inventory for a specific product
 */
router.get('/:productId', inventoryController.getInventory.bind(inventoryController));

/**
 * @route POST /api/inventory/update
 * @desc Update inventory (deduct stock)
 * @body { orderId, items: [{ productId, quantity }] }
 */
router.post('/update', inventoryController.updateInventory.bind(inventoryController));

/**
 * @route POST /api/inventory/reserve
 * @desc Reserve stock for an order
 * @body { productId, quantity, orderId }
 */
router.post('/reserve', inventoryController.reserveStock.bind(inventoryController));

/**
 * @route POST /api/inventory/restock
 * @desc Restock inventory
 * @body { productId, quantity }
 */
router.post('/restock', inventoryController.restockInventory.bind(inventoryController));

module.exports = router;
