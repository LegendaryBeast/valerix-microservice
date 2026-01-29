const client = require('prom-client');
const config = require('../config');

// Create a Registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Custom metrics

// HTTP request duration histogram
const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

// HTTP request counter
const httpRequestCounter = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
});

// Inventory operations counter
const inventoryOperationCounter = new client.Counter({
    name: 'inventory_operations_total',
    help: 'Total number of inventory operations',
    labelNames: ['operation', 'status'], // operation: reserve, release, check
});

// Stock level gauge
const stockLevelGauge = new client.Gauge({
    name: 'inventory_stock_level',
    help: 'Current stock level for products',
    labelNames: ['product_id'],
});

// Inventory operation duration
const inventoryOperationDuration = new client.Histogram({
    name: 'inventory_operation_duration_seconds',
    help: 'Duration of inventory operations in seconds',
    labelNames: ['operation'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// Database connection pool gauge
const dbPoolSize = new client.Gauge({
    name: 'db_pool_size',
    help: 'Number of connections in the database pool',
    labelNames: ['state'], // 'idle', 'active'
});

// Register custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestCounter);
register.registerMetric(inventoryOperationCounter);
register.registerMetric(stockLevelGauge);
register.registerMetric(inventoryOperationDuration);
register.registerMetric(dbPoolSize);

// Middleware to track HTTP requests
const metricsMiddleware = (req, res, next) => {
    // Skip metrics for the metrics endpoint itself
    if (req.path === '/metrics') {
        return next();
    }

    const start = Date.now();

    // Capture response
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route ? req.route.path : req.path;

        httpRequestDuration.observe(
            { method: req.method, route, status_code: res.statusCode },
            duration
        );

        httpRequestCounter.inc({
            method: req.method,
            route,
            status_code: res.statusCode,
        });
    });

    next();
};

module.exports = {
    register,
    metricsMiddleware,
    metrics: {
        httpRequestDuration,
        httpRequestCounter,
        inventoryOperationCounter,
        stockLevelGauge,
        inventoryOperationDuration,
        dbPoolSize,
    },
};
