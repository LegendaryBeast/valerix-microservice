const db = require('../utils/database');
const messagePublisher = require('./messagePublisher');
const logger = require('../utils/logger');

class OutboxPoller {
    constructor(pollIntervalMs = 5000) {
        this.pollIntervalMs = pollIntervalMs;
        this.isPolling = false;
        this.timer = null;
    }

    start() {
        if (this.isPolling) {
            logger.warn('Outbox poller already running');
            return;
        }

        this.isPolling = true;
        logger.info('Starting outbox poller', { intervalMs: this.pollIntervalMs });
        this.poll();
    }

    async poll() {
        if (!this.isPolling) return;

        try {
            await this.processOutbox();
        } catch (error) {
            logger.error('Error processing outbox', { error: error.message, stack: error.stack });
        }

        // Schedule next poll
        this.timer = setTimeout(() => this.poll(), this.pollIntervalMs);
    }

    async processOutbox() {
        const client = await db.getClient();

        try {
            // Get unpublished events (oldest first, limit batch size)
            const result = await client.query(
                `SELECT event_id, event_type, aggregate_id, payload, created_at
         FROM outbox
         WHERE published = false
         ORDER BY created_at ASC
         LIMIT 10`
            );

            if (result.rows.length === 0) {
                logger.debug('No unpublished events in outbox');
                return;
            }

            logger.info(`Processing ${result.rows.length} outbox events`);

            let successCount = 0;
            let failureCount = 0;

            for (const event of result.rows) {
                try {
                    // Parse payload
                    const payload = typeof event.payload === 'string'
                        ? JSON.parse(event.payload)
                        : event.payload;

                    // Publish to RabbitMQ
                    const published = await messagePublisher.publishEvent(event.event_type, {
                        aggregateId: event.aggregate_id,
                        payload: payload,
                        createdAt: event.created_at,
                    });

                    if (published) {
                        // Mark as published
                        await client.query(
                            `UPDATE outbox 
               SET published = true, published_at = CURRENT_TIMESTAMP
               WHERE event_id = $1`,
                            [event.event_id]
                        );

                        successCount++;
                        logger.info('Outbox event published', {
                            eventId: event.event_id,
                            eventType: event.event_type,
                            aggregateId: event.aggregate_id,
                        });
                    } else {
                        failureCount++;
                        logger.warn('Failed to publish outbox event (will retry)', {
                            eventId: event.event_id,
                            eventType: event.event_type,
                        });
                    }
                } catch (error) {
                    failureCount++;
                    logger.error('Error processing outbox event', {
                        eventId: event.event_id,
                        eventType: event.event_type,
                        error: error.message,
                    });
                }
            }

            logger.info('Outbox processing complete', { successCount, failureCount });
        } catch (error) {
            logger.error('Fatal error in outbox processing', {
                error: error.message,
                stack: error.stack,
            });
        } finally {
            client.release();
        }
    }

    stop() {
        this.isPolling = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        logger.info('Outbox poller stopped');
    }
}

module.exports = OutboxPoller;
