const db = require('../utils/database');
const logger = require('../utils/logger');
const config = require('../config');

class InventoryService {
    /**
     * Get product inventory
     */
    async getInventory(productId) {
        try {
            const result = await db.query(
                `SELECT product_id, product_name, stock_level, reserved_stock, 
                (stock_level - reserved_stock) as available_stock, 
                last_updated, version
         FROM inventory
         WHERE product_id = $1`,
                [productId]
            );

            if (result.rows.length === 0) {
                throw new Error('Product not found');
            }

            const product = result.rows[0];
            return {
                productId: product.product_id,
                productName: product.product_name,
                stockLevel: product.stock_level,
                reservedStock: product.reserved_stock,
                availableStock: product.available_stock,
                lastUpdated: product.last_updated,
                version: product.version,
            };
        } catch (error) {
            logger.error('Error getting inventory', {
                productId,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Update inventory (deduct stock when order is shipped)
     */
    async updateInventory(updateData) {
        const { orderId, items } = updateData;
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            for (const item of items) {
                const { productId, quantity } = item;

                // Get current inventory with row lock
                const inventoryResult = await client.query(
                    'SELECT product_id, stock_level, reserved_stock, version FROM inventory WHERE product_id = $1 FOR UPDATE',
                    [productId]
                );

                if (inventoryResult.rows.length === 0) {
                    throw new Error(`Product ${productId} not found`);
                }

                const currentInventory = inventoryResult.rows[0];
                const previousStock = currentInventory.stock_level;
                const newStock = previousStock - quantity;

                if (newStock < 0) {
                    throw new Error(`Insufficient stock for product ${productId}. Available: ${previousStock}, Requested: ${quantity}`);
                }

                // Update inventory
                let updateQuery;
                let updateParams;

                if (config.optimisticLocking.enabled) {
                    // With optimistic locking
                    updateQuery = `
            UPDATE inventory 
            SET stock_level = $1, version = version + 1
            WHERE product_id = $2 AND version = $3
            RETURNING product_id
          `;
                    updateParams = [newStock, productId, currentInventory.version];
                } else {
                    // Without optimistic locking
                    updateQuery = `
            UPDATE inventory 
            SET stock_level = $1
            WHERE product_id = $2
            RETURNING product_id
          `;
                    updateParams = [newStock, productId];
                }

                const updateResult = await client.query(updateQuery, updateParams);

                if (updateResult.rowCount === 0) {
                    throw new Error(`Inventory update conflict for product ${productId}. Please retry.`);
                }

                // Log transaction
                await client.query(
                    `INSERT INTO inventory_transactions 
           (product_id, transaction_type, quantity, order_id, previous_stock, new_stock)
           VALUES ($1, $2, $3, $4, $5, $6)`,
                    [productId, 'DEDUCT', quantity, orderId, previousStock, newStock]
                );

                logger.info('Inventory updated', {
                    productId,
                    orderId,
                    previousStock,
                    newStock,
                    quantity,
                });
            }

            await client.query('COMMIT');

            return {
                success: true,
                orderId,
                message: 'Inventory updated successfully',
            };
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error updating inventory', {
                orderId,
                error: error.message,
            });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Reserve stock (for order creation)
     */
    async reserveStock(productId, quantity, orderId) {
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            const result = await client.query(
                `SELECT product_id, stock_level, reserved_stock FROM inventory 
         WHERE product_id = $1 FOR UPDATE`,
                [productId]
            );

            if (result.rows.length === 0) {
                throw new Error(`Product ${productId} not found`);
            }

            const inventory = result.rows[0];
            const availableStock = inventory.stock_level - inventory.reserved_stock;

            if (availableStock < quantity) {
                throw new Error(`Insufficient stock for product ${productId}`);
            }

            // Update reserved stock
            await client.query(
                `UPDATE inventory SET reserved_stock = reserved_stock + $1 WHERE product_id = $2`,
                [quantity, productId]
            );

            // Log transaction
            await client.query(
                `INSERT INTO inventory_transactions 
         (product_id, transaction_type, quantity, order_id, previous_stock, new_stock)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [productId, 'RESERVE', quantity, orderId, inventory.stock_level, inventory.stock_level]
            );

            await client.query('COMMIT');

            logger.info('Stock reserved', { productId, quantity, orderId });

            return { success: true };
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error reserving stock', {
                productId,
                quantity,
                orderId,
                error: error.message,
            });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Restock inventory
     */
    async restockInventory(productId, quantity) {
        try {
            const result = await db.query(
                `SELECT stock_level FROM inventory WHERE product_id = $1`,
                [productId]
            );

            if (result.rows.length === 0) {
                throw new Error(`Product ${productId} not found`);
            }

            const previousStock = result.rows[0].stock_level;
            const newStock = previousStock + quantity;

            await db.query(
                `UPDATE inventory SET stock_level = $1 WHERE product_id = $2`,
                [newStock, productId]
            );

            // Log transaction
            await db.query(
                `INSERT INTO inventory_transactions 
         (product_id, transaction_type, quantity, previous_stock, new_stock)
         VALUES ($1, $2, $3, $4, $5)`,
                [productId, 'RESTOCK', quantity, previousStock, newStock]
            );

            logger.info('Inventory restocked', {
                productId,
                quantity,
                previousStock,
                newStock,
            });

            return {
                success: true,
                productId,
                newStock,
            };
        } catch (error) {
            logger.error('Error restocking inventory', {
                productId,
                quantity,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * List all inventory
     */
    async listInventory(limit = 50, offset = 0) {
        try {
            const result = await db.query(
                `SELECT product_id, product_name, stock_level, reserved_stock,
                (stock_level - reserved_stock) as available_stock,
                last_updated
         FROM inventory
         ORDER BY product_name
         LIMIT $1 OFFSET $2`,
                [limit, offset]
            );

            return result.rows.map(row => ({
                productId: row.product_id,
                productName: row.product_name,
                stockLevel: row.stock_level,
                reservedStock: row.reserved_stock,
                availableStock: row.available_stock,
                lastUpdated: row.last_updated,
            }));
        } catch (error) {
            logger.error('Error listing inventory', { error: error.message });
            throw error;
        }
    }
}

module.exports = new InventoryService();
