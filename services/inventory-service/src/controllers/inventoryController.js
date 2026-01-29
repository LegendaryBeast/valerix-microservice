const inventoryService = require('../services/inventoryService');
const logger = require('../utils/logger');

class InventoryController {
    /**
     * Get inventory for a product
     */
    async getInventory(req, res) {
        try {
            const { productId } = req.params;

            const inventory = await inventoryService.getInventory(productId);

            return res.status(200).json(inventory);
        } catch (error) {
            logger.error('Error in getInventory controller', {
                error: error.message,
                productId: req.params.productId,
            });

            if (error.message.includes('not found')) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Product not found',
                });
            }

            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to retrieve inventory',
            });
        }
    }

    /**
     * Update inventory (deduct stock)
     */
    async updateInventory(req, res) {
        try {
            const { orderId, items } = req.body;

            if (!orderId || !items || !Array.isArray(items)) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'orderId and items array are required',
                });
            }

            const result = await inventoryService.updateInventory({ orderId, items });

            return res.status(200).json(result);
        } catch (error) {
            logger.error('Error in updateInventory controller', {
                error: error.message,
            });

            if (error.message.includes('Insufficient stock') || error.message.includes('not found')) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: error.message,
                });
            }

            if (error.message.includes('conflict')) {
                return res.status(409).json({
                    error: 'Conflict',
                    message: error.message,
                });
            }

            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to update inventory',
            });
        }
    }

    /**
     * Reserve stock
     */
    async reserveStock(req, res) {
        try {
            const { productId, quantity, orderId } = req.body;

            if (!productId || !quantity || !orderId) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'productId, quantity, and orderId are required',
                });
            }

            const result = await inventoryService.reserveStock(productId, quantity, orderId);

            return res.status(200).json(result);
        } catch (error) {
            logger.error('Error in reserveStock controller', {
                error: error.message,
            });

            if (error.message.includes('Insufficient stock') || error.message.includes('not found')) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: error.message,
                });
            }

            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to reserve stock',
            });
        }
    }

    /**
     * Restock inventory
     */
    async restockInventory(req, res) {
        try {
            const { productId, quantity } = req.body;

            if (!productId || !quantity) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'productId and quantity are required',
                });
            }

            const result = await inventoryService.restockInventory(productId, quantity);

            return res.status(200).json(result);
        } catch (error) {
            logger.error('Error in restockInventory controller', {
                error: error.message,
            });

            if (error.message.includes('not found')) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Product not found',
                });
            }

            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to restock inventory',
            });
        }
    }

    /**
     * List all inventory
     */
    async listInventory(req, res) {
        try {
            const { limit = 50, offset = 0 } = req.query;

            const inventory = await inventoryService.listInventory(
                parseInt(limit, 10),
                parseInt(offset, 10)
            );

            return res.status(200).json({
                inventory,
                limit: parseInt(limit, 10),
                offset: parseInt(offset, 10),
                count: inventory.length,
            });
        } catch (error) {
            logger.error('Error in listInventory controller', {
                error: error.message,
            });

            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to list inventory',
            });
        }
    }
}

module.exports = new InventoryController();
