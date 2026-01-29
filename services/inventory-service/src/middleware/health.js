const db = require('../utils/database');
const logger = require('../utils/logger');

/**
 * Health check middleware
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

        // Check Redis (OPTIONAL - not configured yet)
        healthStatus.services.redis = 'NOT_CONFIGURED';

        // Determine overall status
        if (hasCriticalFailure) {
            healthStatus.status = 'DOWN';
        } else if (hasOptionalFailure) {
            healthStatus.status = 'DEGRADED';
        } else {
            healthStatus.status = 'UP';
        }

        // Return 200 for UP and DEGRADED, 503 only for DOWN
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
 * Liveness probe
 */
const livenessProbe = (req, res) => {
    res.status(200).json({ status: 'ALIVE' });
};

/**
 * Readiness probe
 */
const readinessProbe = async (req, res) => {
    try {
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
