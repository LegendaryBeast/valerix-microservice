const axios = require('axios');
const CircuitBreaker = require('opossum');
const retry = require('async-retry');
const config = require('../config');
const logger = require('../utils/logger');
const { metrics } = require('../middleware/metrics');

// Create axios instance with timeout configuration
const httpClient = axios.create({
    timeout: config.timeout.total,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for logging
httpClient.interceptors.request.use(
    (config) => {
        logger.debug('HTTP request', {
            method: config.method,
            url: config.url,
            data: config.data,
        });
        return config;
    },
    (error) => {
        logger.error('HTTP request error', { error: error.message });
        return Promise.reject(error);
    }
);

// Response interceptor for logging
httpClient.interceptors.response.use(
    (response) => {
        logger.debug('HTTP response', {
            status: response.status,
            url: response.config.url,
        });
        return response;
    },
    (error) => {
        logger.error('HTTP response error', {
            message: error.message,
            url: error.config?.url,
            status: error.response?.status,
        });
        return Promise.reject(error);
    }
);

// Circuit breaker options
const circuitBreakerOptions = {
    timeout: config.circuitBreaker.timeout,
    errorThresholdPercentage: 50,
    resetTimeout: config.circuitBreaker.resetTimeout,
    volumeThreshold: config.circuitBreaker.volumeThreshold,
    name: 'inventory-service',
};

// Inventory Service API call function
const callInventoryService = async (endpoint, data) => {
    const url = `${config.inventoryService.url}${endpoint}`;
    const start = Date.now();

    try {
        const response = await httpClient.post(url, data, {
            timeout: config.inventoryService.timeout,
        });

        const duration = (Date.now() - start) / 1000;
        metrics.inventoryServiceDuration.observe({ status: 'success' }, duration);

        return response.data;
    } catch (error) {
        const duration = (Date.now() - start) / 1000;
        metrics.inventoryServiceDuration.observe({ status: 'failure' }, duration);

        // Enhance error with more context
        if (error.code === 'ECONNABORTED') {
            throw new Error(`Inventory service timeout after ${config.inventoryService.timeout}ms`);
        }

        if (error.response) {
            throw new Error(
                `Inventory service error: ${error.response.status} - ${error.response.data?.message || error.message
                }`
            );
        }

        if (error.code === 'ECONNREFUSED') {
            throw new Error('Inventory service unavailable');
        }

        throw error;
    }
};

// Create circuit breaker
const inventoryCircuitBreaker = new CircuitBreaker(callInventoryService, circuitBreakerOptions);

// Circuit breaker event handlers
inventoryCircuitBreaker.on('open', () => {
    logger.warn('Circuit breaker opened for Inventory Service');
    metrics.circuitBreakerStatus.set({ service: 'inventory' }, 1);
});

inventoryCircuitBreaker.on('halfOpen', () => {
    logger.info('Circuit breaker half-open for Inventory Service');
    metrics.circuitBreakerStatus.set({ service: 'inventory' }, 2);
});

inventoryCircuitBreaker.on('close', () => {
    logger.info('Circuit breaker closed for Inventory Service');
    metrics.circuitBreakerStatus.set({ service: 'inventory' }, 0);
});

inventoryCircuitBreaker.on('timeout', () => {
    logger.warn('Circuit breaker timeout for Inventory Service');
});

inventoryCircuitBreaker.on('reject', () => {
    logger.warn('Circuit breaker rejected request to Inventory Service');
});

// Fallback handler
inventoryCircuitBreaker.fallback(() => {
    logger.error('Circuit breaker fallback triggered');
    throw new Error('Inventory Service is currently unavailable. Please try again later.');
});

/**
 * Update inventory with retry mechanism
 */
const updateInventory = async (orderData) => {
    try {
        // Retry configuration
        const retryOptions = {
            retries: config.retry.maxAttempts,
            factor: config.retry.backoffMultiplier,
            minTimeout: config.retry.initialDelay,
            maxTimeout: config.retry.maxDelay,
            onRetry: (error, attempt) => {
                logger.warn(`Retry attempt ${attempt} for inventory update`, {
                    error: error.message,
                    orderData,
                });
            },
        };

        // Call inventory service with circuit breaker and retry
        const result = await retry(async (bail) => {
            try {
                return await inventoryCircuitBreaker.fire('/api/inventory/update', orderData);
            } catch (error) {
                // Don't retry on 4xx errors
                if (error.response && error.response.status >= 400 && error.response.status < 500) {
                    bail(error);
                    return;
                }
                throw error;
            }
        }, retryOptions);

        return result;
    } catch (error) {
        logger.error('Failed to update inventory after retries', {
            error: error.message,
            orderData,
        });
        throw error;
    }
};

/**
 * Check inventory availability
 */
const checkInventory = async (productId) => {
    try {
        return await inventoryCircuitBreaker.fire(`/api/inventory/${productId}`, {});
    } catch (error) {
        logger.error('Failed to check inventory', {
            error: error.message,
            productId,
        });
        throw error;
    }
};

module.exports = {
    updateInventory,
    checkInventory,
    inventoryCircuitBreaker,
    httpClient,
};
