const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');

/**
 * SQS Service for managing queue operations
 * Handles sending messages to and receiving messages from AWS SQS
 */
class SQSService {
    constructor() {
        // Initialize SQS client with AWS credentials from environment
        this.client = new SQSClient({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
        
        this.queueUrl = process.env.AWS_SQS_QUEUE_URL;
        
        if (!this.queueUrl) {
            console.warn('AWS_SQS_QUEUE_URL not configured. SQS functionality will be limited.');
        }
    }

    /**
     * Send a message to the SQS queue
     * @param {Object} messageBody - The message payload to send
     * @param {Object} options - Optional parameters (DelaySeconds, MessageAttributes, etc.)
     * @returns {Promise<Object>} - Response from SQS with MessageId
     */
    async sendMessage(messageBody, options = {}) {
        try {
            const params = {
                QueueUrl: this.queueUrl,
                MessageBody: JSON.stringify(messageBody),
                ...options
            };

            const command = new SendMessageCommand(params);
            const response = await this.client.send(command);
            
            console.log('Message sent to SQS:', response.MessageId);
            return {
                success: true,
                messageId: response.MessageId,
                sequenceNumber: response.SequenceNumber
            };
        } catch (error) {
            console.error('Error sending message to SQS:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Receive messages from the SQS queue
     * @param {Object} options - Optional parameters (MaxNumberOfMessages, WaitTimeSeconds, etc.)
     * @returns {Promise<Array>} - Array of messages from the queue
     */
    async receiveMessages(options = {}) {
        try {
            const params = {
                QueueUrl: this.queueUrl,
                MaxNumberOfMessages: options.maxMessages || 1,
                WaitTimeSeconds: options.waitTime || 10, // Long polling
                VisibilityTimeout: options.visibilityTimeout || 300, // 5 minutes default
                ...options
            };

            const command = new ReceiveMessageCommand(params);
            const response = await this.client.send(command);
            
            return response.Messages || [];
        } catch (error) {
            console.error('Error receiving messages from SQS:', error);
            throw error;
        }
    }

    /**
     * Delete a message from the queue after successful processing
     * @param {string} receiptHandle - The receipt handle of the message to delete
     * @returns {Promise<boolean>} - Success status
     */
    async deleteMessage(receiptHandle) {
        try {
            const params = {
                QueueUrl: this.queueUrl,
                ReceiptHandle: receiptHandle
            };

            const command = new DeleteMessageCommand(params);
            await this.client.send(command);
            
            console.log('Message deleted from SQS');
            return true;
        } catch (error) {
            console.error('Error deleting message from SQS:', error);
            return false;
        }
    }

    /**
     * Get queue attributes (ApproximateNumberOfMessages, etc.)
     * @returns {Promise<Object>} - Queue attributes
     */
    async getQueueAttributes() {
        try {
            const params = {
                QueueUrl: this.queueUrl,
                AttributeNames: ['All']
            };

            const command = new GetQueueAttributesCommand(params);
            const response = await this.client.send(command);
            
            return response.Attributes;
        } catch (error) {
            console.error('Error getting queue attributes:', error);
            throw error;
        }
    }

    /**
     * Send a PDF processing job to the queue
     * @param {Object} jobData - Job data containing filePath, date, userId
     * @returns {Promise<Object>} - Response with messageId
     */
    async sendPDFProcessingJob(jobData) {
        const messageBody = {
            type: 'PDF_PROCESSING',
            timestamp: new Date().toISOString(),
            data: jobData
        };

        // Add message attributes for filtering/monitoring
        const messageAttributes = {
            JobType: {
                DataType: 'String',
                StringValue: 'PDF_PROCESSING'
            },
            UserId: {
                DataType: 'String',
                StringValue: jobData.userId
            }
        };

        return await this.sendMessage(messageBody, { MessageAttributes: messageAttributes });
    }
}

module.exports = SQSService;
