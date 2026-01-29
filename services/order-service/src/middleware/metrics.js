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

// Order creation counter
const orderCreatedCounter = new client.Counter({
    name: 'orders_created_total',
    help: 'Total number of orders created',
    labelNames: ['status'],
});

// Order processing duration
const orderProcessingDuration = new client.Histogram({
    name: 'order_processing_duration_seconds',
    help: 'Duration of order processing in seconds',
    buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// Inventory service call duration
const inventoryServiceDuration = new client.Histogram({
    name: 'inventory_service_call_duration_seconds',
    help: 'Duration of inventory service calls in seconds',
    labelNames: ['status'],
    buckets: [0.1, 0.5, 1, 3, 5, 10],
});

// Circuit breaker status gauge
const circuitBreakerStatus = new client.Gauge({
    name: 'circuit_breaker_status',
    help: 'Circuit breaker status (0 = closed, 1 = open, 2 = half-open)',
    labelNames: ['service'],
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
register.registerMetric(orderCreatedCounter);
register.registerMetric(orderProcessingDuration);
register.registerMetric(inventoryServiceDuration);
register.registerMetric(circuitBreakerStatus);
register.registerMetric(dbPoolSize);

// Middleware to track HTTP requests
const metricsMiddleware = (req, res, next) => {
    if (!config.metrics.enabled) {
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
        orderCreatedCounter,
        orderProcessingDuration,
        inventoryServiceDuration,
        circuitBreakerStatus,
        dbPoolSize,
    },
};
