const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');
const { metricsMiddleware, register } = require('./middleware/metrics');
const { healthCheck, livenessProbe, readinessProbe } = require('./middleware/health');
const orderRoutes = require('./routes/orders');

// Create Express app
const app = express();

// Trust proxy (for rate limiting behind load balancer)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS
app.use(cors());

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
});
app.use('/api/', limiter);

// Metrics middleware
app.use(metricsMiddleware);

// Request logging middleware
app.use((req, res, next) => {
    logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
    });
    next();
});

// Health check endpoints
app.get('/health', healthCheck);
app.get('/health/live', livenessProbe);
app.get('/health/ready', readinessProbe);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (error) {
        logger.error('Error generating metrics', { error: error.message });
        res.status(500).end();
    }
});

// API routes
app.use('/api/orders', orderRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'Valerix Order Service',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/health',
            metrics: '/metrics',
            api: '/api/orders',
        },
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
    });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
    });

    res.status(500).json({
        error: 'Internal Server Error',
        message: config.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : err.message,
    });
});

// Start server
const PORT = config.PORT;

const server = app.listen(PORT, () => {
    logger.info(`Order Service started on port ${PORT}`, {
        env: config.NODE_ENV,
        port: PORT,
    });

    // Start outbox poller for reliable event publishing
    const OutboxPoller = require('./services/outboxPoller');
    const outboxPoller = new OutboxPoller(5000); // Poll every 5 seconds
    outboxPoller.start();

    // Store poller instance for graceful shutdown
    app.locals.outboxPoller = outboxPoller;
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}, starting graceful shutdown`);

    server.close(async () => {
        logger.info('HTTP server closed');

        // Stop outbox poller
        if (app.locals.outboxPoller) {
            app.locals.outboxPoller.stop();
        }

        // Close message publisher (RabbitMQ)
        try {
            const messagePublisher = require('./services/messagePublisher');
            await messagePublisher.close();
            logger.info('RabbitMQ connection closed');
        } catch (error) {
            logger.error('Error closing RabbitMQ connection', {
                error: error.message,
            });
        }

        // Close Redis cache
        try {
            const cache = require('./utils/cache');
            await cache.disconnect();
            logger.info('Redis connection closed');
        } catch (error) {
            logger.error('Error closing Redis connection', {
                error: error.message,
            });
        }

        // Close database connections
        try {
            const db = require('./utils/database');
            await db.pool.end();
            logger.info('Database connections closed');
        } catch (error) {
            logger.error('Error closing database connections', {
                error: error.message,
            });
        }

        process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
    });
    gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', {
        reason,
        promise,
    });
});

module.exports = app;
