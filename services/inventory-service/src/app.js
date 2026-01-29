const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');
const { healthCheck, livenessProbe, readinessProbe } = require('./middleware/health');
const gremlinMiddleware = require('./middleware/gremlin');
const inventoryRoutes = require('./routes/inventory');

// Create Express app
const app = express();

// Trust proxy
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
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later',
});
app.use('/api/', limiter);

// Gremlin latency middleware (for chaos testing)
app.use(gremlinMiddleware);

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

// Metrics endpoint (placeholder)
app.get('/metrics', (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send('# Metrics endpoint - Prometheus client to be implemented\n');
});

// API routes
app.use('/api/inventory', inventoryRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'Valerix Inventory Service',
        version: '1.0.0',
        status: 'running',
        gremlinEnabled: config.gremlin.enabled,
        endpoints: {
            health: '/health',
            metrics: '/metrics',
            api: '/api/inventory',
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
    logger.info(`Inventory Service started on port ${PORT}`, {
        env: config.NODE_ENV,
        port: PORT,
        gremlinEnabled: config.gremlin.enabled,
    });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}, starting graceful shutdown`);

    server.close(async () => {
        logger.info('HTTP server closed');

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

    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
    });
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', {
        reason,
        promise,
    });
});

module.exports = app;
