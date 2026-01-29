const Redis = require('ioredis');
const config = require('../config');
const logger = require('./logger');

class CacheService {
    constructor() {
        this.client = null;
        this.isConnected = false;

        if (config.redis.url) {
            try {
                this.client = new Redis(config.redis.url, {
                    retryStrategy: (times) => {
                        if (times > 3) {
                            logger.error('Redis connection failed after 3 retries');
                            return null; // Stop retrying
                        }
                        const delay = Math.min(times * 100, 3000);
                        logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
                        return delay;
                    },
                    maxRetriesPerRequest: 3,
                    enableReadyCheck: true,
                    lazyConnect: true,
                });

                this.client.on('error', (err) => {
                    this.isConnected = false;
                    logger.error('Redis error', { error: err.message });
                });

                this.client.on('connect', () => {
                    this.isConnected = true;
                    logger.info('Redis connected');
                });

                this.client.on('ready', () => {
                    this.isConnected = true;
                    logger.info('Redis ready');
                });

                this.client.on('close', () => {
                    this.isConnected = false;
                    logger.warn('Redis connection closed');
                });

                // Attempt initial connection
                this.client.connect().catch(err => {
                    logger.warn('Redis initial connection failed, will retry on first use', {
                        error: err.message,
                    });
                });
            } catch (error) {
                logger.error('Failed to initialize Redis client', { error: error.message });
                this.client = null;
            }
        } else {
            logger.warn('Redis not configured (REDIS_URL missing), caching disabled');
        }
    }

    async get(key) {
        if (!this.client) {
            logger.debug('Cache get skipped - Redis not configured', { key });
            return null;
        }

        try {
            const value = await this.client.get(key);
            if (value) {
                logger.debug('Cache hit', { key });
                return JSON.parse(value);
            }
            logger.debug('Cache miss', { key });
            return null;
        } catch (error) {
            logger.error('Cache get error', { key, error: error.message });
            return null; // Fail gracefully
        }
    }

    async set(key, value, ttl = config.redis.ttl) {
        if (!this.client) {
            logger.debug('Cache set skipped - Redis not configured', { key });
            return false;
        }

        try {
            await this.client.setex(key, ttl, JSON.stringify(value));
            logger.debug('Cache set', { key, ttl });
            return true;
        } catch (error) {
            logger.error('Cache set error', { key, error: error.message });
            return false; // Fail gracefully
        }
    }

    async delete(key) {
        if (!this.client) {
            return false;
        }

        try {
            await this.client.del(key);
            logger.debug('Cache delete', { key });
            return true;
        } catch (error) {
            logger.error('Cache delete error', { key, error: error.message });
            return false;
        }
    }

    async deletePattern(pattern) {
        if (!this.client) {
            return 0;
        }

        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(...keys);
                logger.info('Cache pattern deleted', { pattern, count: keys.length });
                return keys.length;
            }
            return 0;
        } catch (error) {
            logger.error('Cache pattern delete error', { pattern, error: error.message });
            return 0;
        }
    }

    async clear() {
        if (!this.client) {
            return false;
        }

        try {
            await this.client.flushall();
            logger.info('Cache cleared');
            return true;
        } catch (error) {
            logger.error('Cache clear error', { error: error.message });
            return false;
        }
    }

    async healthCheck() {
        if (!this.client) {
            return { status: 'NOT_CONFIGURED' };
        }

        try {
            const pong = await this.client.ping();
            if (pong === 'PONG') {
                return { status: 'UP', connected: this.isConnected };
            }
            return { status: 'DOWN', message: 'Unexpected ping response' };
        } catch (error) {
            return { status: 'DOWN', message: error.message };
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.quit();
            logger.info('Redis disconnected');
        }
    }
}

module.exports = new CacheService();
