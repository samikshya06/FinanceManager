
require('dotenv').config();
const SQSService = require('./sqsService');
const { processStatement } = require('./uploadAndProcessService');
const fs = require('fs');

/**
 * SQS Worker - Polls messages from SQS and processes PDF statements
 * Runs continuously in the background
 */
class PDFProcessingWorker {
    constructor() {
        this.sqsService = new SQSService();
        this.isRunning = false;
        this.pollInterval = 1000; // 1 second between polls if no messages
    }

    /**
     * Start the worker to process messages from SQS
     */
    async start() {
        this.isRunning = true;
        console.log('🚀 PDF Processing Worker started');
        console.log(`📬 Polling SQS queue: ${process.env.AWS_SQS_QUEUE_URL}`);
        console.log('─'.repeat(60));

        while (this.isRunning) {
            try {
                await this.processMessages();
            } catch (error) {
                console.error('❌ Error in worker loop:', error);
                // Wait before retrying
                await this.sleep(5000);
            }
        }
    }

    /**
     * Stop the worker gracefully
     */
    stop() {
        console.log('🛑 Stopping worker...');
        this.isRunning = false;
    }

    /**
     * Poll for messages and process them
     */
    async processMessages() {
        try {
            // Receive messages from SQS (long polling)
            const messages = await this.sqsService.receiveMessages({
                maxMessages: 10, // Process up to 10 messages at once
                waitTime: 20, // Long polling for 20 seconds
                visibilityTimeout: 300 // 5 minutes to process
            });

            if (messages.length === 0) {
                // No messages, wait before next poll
                await this.sleep(this.pollInterval);
                return;
            }

            console.log(`📥 Received ${messages.length} message(s) from queue`);

            // Process each message
            for (const message of messages) {
                await this.handleMessage(message);
            }

        } catch (error) {
            console.error('❌ Error processing messages:', error);
        }
    }

    /**
     * Handle individual message
     * @param {Object} message - SQS message
     */
    async handleMessage(message) {
        const startTime = Date.now();
        let jobData;

        try {
            // Parse message body
            const messageBody = JSON.parse(message.Body);
            jobData = messageBody.data;

            console.log(`\n⚙️  Processing Job: ${messageBody.type}`);
            console.log(`   User ID: ${jobData.userId}`);
            console.log(`   Statement: ${jobData.date}`);
            console.log(`   File: ${jobData.filePath}`);

            // Verify file exists
            if (!fs.existsSync(jobData.filePath)) {
                throw new Error(`File not found: ${jobData.filePath}`);
            }

            // Process the PDF statement
            const result = await processStatement(
                jobData.filePath,
                jobData.date,
                jobData.userId
            );

            if (!result.success) {
                throw new Error(result.error);
            }

            // Success - delete message from queue
            await this.sqsService.deleteMessage(message.ReceiptHandle);

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ Job completed successfully in ${duration}s`);
            console.log(`   Statement ID: ${result.stmt_id}`);
            console.log(`   Transactions: ${result.transactions.length}`);
            console.log(`   Categories:`, Object.keys(result.categories).join(', '));

            // Optional: Clean up uploaded file after processing
            try {
                fs.unlinkSync(jobData.filePath);
                console.log(`   🗑️  Cleaned up file: ${jobData.filePath}`);
            } catch (cleanupError) {
                console.warn(`   ⚠️  Could not delete file: ${cleanupError.message}`);
            }

        } catch (error) {
            console.error(`❌ Job failed: ${error.message}`);
            
            // Check how many times this message has been received
            const receiveCount = parseInt(message.Attributes?.ApproximateReceiveCount || '0');
            
            if (receiveCount >= 3) {
                // Max retries reached - delete message to prevent infinite retries
                // In production, you should send this to a Dead Letter Queue (DLQ)
                console.error(`   ⚠️  Max retries (${receiveCount}) reached. Removing from queue.`);
                await this.sqsService.deleteMessage(message.ReceiptHandle);
                
                // TODO: Log to error tracking service (Sentry, CloudWatch, etc.)
            } else {
                console.log(`   🔄 Message will be retried (attempt ${receiveCount}/3)`);
                // Message will automatically become visible again after VisibilityTimeout
            }
        }

        console.log('─'.repeat(60));
    }

    /**
     * Sleep utility
     * @param {number} ms - Milliseconds to sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get queue statistics
     */
    async getQueueStats() {
        try {
            const attributes = await this.sqsService.getQueueAttributes();
            return {
                messagesAvailable: attributes.ApproximateNumberOfMessages || 0,
                messagesInFlight: attributes.ApproximateNumberOfMessagesNotVisible || 0,
                messagesDelayed: attributes.ApproximateNumberOfMessagesDelayed || 0
            };
        } catch (error) {
            console.error('Error getting queue stats:', error);
            return null;
        }
    }
}

// Start worker if this file is run directly
if (require.main === module) {
    const worker = new PDFProcessingWorker();

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n\n📊 Final Queue Statistics:');
        const stats = await worker.getQueueStats();
        if (stats) {
            console.log(`   Messages Available: ${stats.messagesAvailable}`);
            console.log(`   Messages In Flight: ${stats.messagesInFlight}`);
            console.log(`   Messages Delayed: ${stats.messagesDelayed}`);
        }
        worker.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        worker.stop();
        process.exit(0);
    });

    // Start the worker
    worker.start().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = PDFProcessingWorker;