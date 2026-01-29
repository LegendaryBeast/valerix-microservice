const config = require('../config');
const logger = require('../utils/logger');

// Gremlin latency counter for deterministic pattern
let requestCount = 0;

/**
 * Gremlin Latency Middleware
 * Simulates service latency for chaos testing
 */
const gremlinMiddleware = async (req, res, next) => {
    if (!config.gremlin.enabled) {
        return next();
    }

    let shouldDelay = false;

    if (config.gremlin.pattern === 'deterministic') {
        // Deterministic pattern: every Nth request gets delayed
        requestCount++;
        const triggerFrequency = Math.floor(1 / config.gremlin.probability);
        shouldDelay = requestCount % triggerFrequency === 0;
    } else {
        // Random pattern: random probability-based delay
        shouldDelay = Math.random() < config.gremlin.probability;
    }

    if (shouldDelay) {
        logger.warn(`Gremlin latency triggered: ${config.gremlin.latencyMs}ms delay`, {
            path: req.path,
            method: req.method,
            pattern: config.gremlin.pattern,
            requestCount,
        });

        // Add delay
        await new Promise(resolve => setTimeout(resolve, config.gremlin.latencyMs));
    }

    next();
};

module.exports = gremlinMiddleware;
