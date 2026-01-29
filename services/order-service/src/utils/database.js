const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

// Create PostgreSQL connection pool
const pool = new Pool({
    connectionString: config.database.url,
    min: config.database.poolMin,
    max: config.database.poolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Handle pool errors
pool.on('error', (err) => {
    logger.error('Unexpected error on idle database client', { error: err.message });
});

// Test connection
pool.on('connect', () => {
    logger.info('New database connection established');
});

// Helper function to execute queries
// Uses pool.query directly for automatic connection management
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        logger.debug('Executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        logger.error('Database query error', { text, error: error.message });
        throw error;
    }
};

// Helper function to get a client from the pool (for transactions)
// Returns the client directly without monkey-patching to avoid double-release issues
const getClient = async () => {
    return await pool.connect();
};

// Health check function
const healthCheck = async () => {
    try {
        const result = await pool.query('SELECT NOW()');
        return { status: 'UP', timestamp: result.rows[0].now };
    } catch (error) {
        logger.error('Database health check failed', { error: error.message });
        return { status: 'DOWN', error: error.message };
    }
};

module.exports = {
    query,
    getClient,
    pool,
    healthCheck,
};
