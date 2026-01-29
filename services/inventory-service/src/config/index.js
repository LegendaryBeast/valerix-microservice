require('dotenv').config();

module.exports = {
    // Server
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT, 10) || 3002,

    // Database
    database: {
        url: process.env.DATABASE_URL || 'postgresql://inventoryuser:inventorypass@localhost:5433/inventorydb',
        poolMin: parseInt(process.env.DATABASE_POOL_MIN, 10) || 2,
        poolMax: parseInt(process.env.DATABASE_POOL_MAX, 10) || 20,
    },

    // Redis
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        ttl: parseInt(process.env.REDIS_TTL, 10) || 3600,
    },

    // Gremlin (Chaos Testing)
    gremlin: {
        enabled: process.env.GREMLIN_ENABLED === 'true',
        latencyMs: parseInt(process.env.GREMLIN_LATENCY_MS, 10) || 3000,
        probability: parseFloat(process.env.GREMLIN_PROBABILITY) || 0.2,
        pattern: process.env.GREMLIN_PATTERN || 'deterministic',
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'json',
    },

    // Metrics
    metrics: {
        enabled: process.env.METRICS_ENABLED === 'true',
    },

    // Health Check
    healthCheck: {
        timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT, 10) || 3000,
    },

    // Optimistic Locking
    optimisticLocking: {
        enabled: process.env.ENABLE_OPTIMISTIC_LOCKING === 'true',
    },

    // Cache
    cache: {
        enabled: process.env.CACHE_ENABLED === 'true',
        ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS, 10) || 300,
    },
};
