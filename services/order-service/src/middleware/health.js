const db = require('../utils/database');
const logger = require('../utils/logger');
const axios = require('axios');
const config = require('../config');

/**
 * Health check middleware
 * Returns deep health check status including all dependencies
 * Uses DEGRADED state for optional dependencies to prevent unnecessary restarts
 */
const healthCheck = async (req, res) => {
    const healthStatus = {
        status: 'UP',
        timestamp: new Date().toISOString(),
        services: {},
    };

    let hasCriticalFailure = false;
    let hasOptionalFailure = false;

    try {
        // Check database (CRITICAL - must be UP)
        try {
            const dbHealth = await db.healthCheck();
            healthStatus.services.database = dbHealth?.status || 'UNKNOWN';

            if (dbHealth?.status !== 'UP') {
                hasCriticalFailure = true;
                logger.error('Database health check failed - critical');
            }
        } catch (error) {
            healthStatus.services.database = 'DOWN';
            hasCriticalFailure = true;
            logger.error('Database health check failed', { error: error.message });
        }

        // Check Inventory Service (OPTIONAL - can be degraded)
        try {
            const inventoryResponse = await axios.get(
                `${config.inventoryService.url}/health`,
                { timeout: 1000 } // Aggressive 1s timeout
            );
            healthStatus.services.inventory_service =
                inventoryResponse.status === 200 ? 'UP' : 'DOWN';
        } catch (error) {
            healthStatus.services.inventory_service = 'DOWN';
            hasOptionalFailure = true;
            logger.warn('Inventory service health check failed (non-critical)', {
                error: error.message,
            });
        }

        // Check Redis (OPTIONAL - can be degraded)
        try {
            const cache = require('../utils/cache');
            const cacheHealth = await cache.healthCheck();
            healthStatus.services.redis = cacheHealth?.status || 'UNKNOWN';

            if (cacheHealth?.status === 'DOWN') {
                hasOptionalFailure = true;
            }
        } catch (error) {
            healthStatus.services.redis = 'DOWN';
            hasOptionalFailure = true;
            logger.warn('Redis health check failed (non-critical)', { error: error.message });
        }

        // Check RabbitMQ (OPTIONAL - can be degraded)
        try {
            const messagePublisher = require('../services/messagePublisher');
            const mqHealth = await messagePublisher.healthCheck();
            healthStatus.services.message_queue = mqHealth?.status || 'UNKNOWN';

            if (mqHealth?.status === 'DOWN') {
                hasOptionalFailure = true;
            }
        } catch (error) {
            healthStatus.services.message_queue = 'DOWN';
            hasOptionalFailure = true;
            logger.warn('RabbitMQ health check failed (non-critical)', { error: error.message });
        }

        // Determine overall status
        if (hasCriticalFailure) {
            healthStatus.status = 'DOWN';
        } else if (hasOptionalFailure) {
            healthStatus.status = 'DEGRADED';
        } else {
            healthStatus.status = 'UP';
        }

        // Return 200 for UP and DEGRADED, 503 only for DOWN
        // This prevents Kubernetes from restarting pods when optional dependencies fail
        const statusCode = healthStatus.status === 'DOWN' ? 503 : 200;
        return res.status(statusCode).json(healthStatus);
    } catch (error) {
        logger.error('Health check failed catastrophically', { error: error.message });
        return res.status(503).json({
            status: 'DOWN',
            timestamp: new Date().toISOString(),
            error: error.message,
        });
    }
};

/**
 * Liveness probe - simple check if service is alive
 */
const livenessProbe = (req, res) => {
    res.status(200).json({ status: 'ALIVE' });
};

/**
 * Readiness probe - check if service is ready to accept traffic
 */
const readinessProbe = async (req, res) => {
    try {
        // Check database connectivity
        await db.query('SELECT 1');
        res.status(200).json({ status: 'READY' });
    } catch (error) {
        logger.error('Readiness check failed', { error: error.message });
        res.status(503).json({ status: 'NOT_READY', error: error.message });
    }
};

module.exports = {
    healthCheck,
    livenessProbe,
    readinessProbe,
};
