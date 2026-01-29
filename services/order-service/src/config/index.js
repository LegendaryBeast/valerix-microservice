require('dotenv').config();

module.exports = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,

  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://orderuser:orderpass@localhost:5432/orderdb',
    poolMin: parseInt(process.env.DATABASE_POOL_MIN, 10) || 2,
    poolMax: parseInt(process.env.DATABASE_POOL_MAX, 10) || 20,
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: parseInt(process.env.REDIS_TTL, 10) || 3600,
  },

  // RabbitMQ
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://valerix:valerixpass@localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE || 'valerix-events',
    queue: process.env.RABBITMQ_QUEUE || 'order-events',
  },

  // Inventory Service
  inventoryService: {
    url: process.env.INVENTORY_SERVICE_URL || 'http://localhost:3002',
    timeout: parseInt(process.env.INVENTORY_SERVICE_TIMEOUT, 10) || 5000,
  },

  // Circuit Breaker
  circuitBreaker: {
    threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD, 10) || 5,
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT, 10) || 30000,
    resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT, 10) || 30000,
    volumeThreshold: parseInt(process.env.CIRCUIT_BREAKER_VOLUME_THRESHOLD, 10) || 10,
  },

  // Retry
  retry: {
    maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS, 10) || 3,
    initialDelay: parseInt(process.env.RETRY_INITIAL_DELAY, 10) || 1000,
    maxDelay: parseInt(process.env.RETRY_MAX_DELAY, 10) || 10000,
    backoffMultiplier: parseInt(process.env.RETRY_BACKOFF_MULTIPLIER, 10) || 2,
  },

  // Timeout
  timeout: {
    connect: parseInt(process.env.HTTP_CONNECT_TIMEOUT, 10) || 2000,
    read: parseInt(process.env.HTTP_READ_TIMEOUT, 10) || 5000,
    total: parseInt(process.env.HTTP_TOTAL_TIMEOUT, 10) || 7000,
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

  // Idempotency
  idempotency: {
    ttlHours: parseInt(process.env.IDEMPOTENCY_TTL_HOURS, 10) || 24,
  },

  // Health Check
  healthCheck: {
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT, 10) || 3000,
  },
};
