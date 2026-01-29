const amqp = require('amqplib');
const config = require('../config');
const logger = require('../utils/logger');

class MessagePublisher {
    constructor() {
        this.connection = null;
        this.channel = null;
        this.connecting = false;
    }

    async connect() {
        if (this.connection && this.channel) {
            return this.channel;
        }

        if (this.connecting) {
            // Wait for existing connection attempt
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.connect();
        }

        try {
            this.connecting = true;
            logger.info('Connecting to RabbitMQ...', { url: config.rabbitmq.url });

            this.connection = await amqp.connect(config.rabbitmq.url);
            this.channel = await this.connection.createChannel();

            // Handle channel errors
            this.channel.on('error', (err) => {
                logger.error('RabbitMQ channel error', { error: err.message });
                this.channel = null;
            });

            // Create exchange
            await this.channel.assertExchange(config.rabbitmq.exchange, 'topic', {
                durable: true,
            });

            logger.info('Connected to RabbitMQ successfully');

            // Handle connection errors
            this.connection.on('error', (err) => {
                logger.error('RabbitMQ connection error', { error: err.message });
            });

            this.connection.on('close', () => {
                logger.warn('RabbitMQ connection closed, will reconnect on next publish');
                this.connection = null;
                this.channel = null;
            });

            this.connecting = false;
            return this.channel;
        } catch (error) {
            this.connecting = false;
            logger.error('Failed to connect to RabbitMQ', { error: error.message });
            // Don't throw - allow service to continue without messaging
            return null;
        }
    }

    async publishEvent(eventType, data) {
        try {
            const channel = await this.connect();

            if (!channel) {
                logger.warn('Cannot publish event - RabbitMQ not available', { eventType });
                return false;
            }

            const message = {
                eventType,
                data,
                timestamp: new Date().toISOString(),
            };

            const routingKey = `order.${eventType.toLowerCase().replace(/_/g, '.')}`;

            channel.publish(
                config.rabbitmq.exchange,
                routingKey,
                Buffer.from(JSON.stringify(message)),
                { persistent: true }
            );

            logger.info('Event published to RabbitMQ', { eventType, routingKey });
            return true;
        } catch (error) {
            logger.error('Failed to publish event', {
                eventType,
                error: error.message,
            });
            // Don't throw - messaging failure shouldn't break the service
            return false;
        }
    }

    async close() {
        try {
            if (this.channel) {
                await this.channel.close();
            }
            if (this.connection) {
                await this.connection.close();
            }
            logger.info('RabbitMQ connection closed');
        } catch (error) {
            logger.error('Error closing RabbitMQ connection', { error: error.message });
        }
    }

    async healthCheck() {
        try {
            // Check if we have a valid connection and channel
            if (!this.connection || !this.channel) {
                return { status: 'DOWN', message: 'Not connected' };
            }

            return { status: 'UP' };
        } catch (error) {
            return { status: 'DOWN', message: error.message };
        }
    }
}

module.exports = new MessagePublisher();
