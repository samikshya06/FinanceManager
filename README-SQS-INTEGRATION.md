# AWS SQS Integration Guide

This document explains how to set up and use AWS SQS (Simple Queue Service) for asynchronous PDF processing in the Finance Manager application.

## 🎯 Overview

The application now supports **two processing modes**:

1. **Synchronous** (default): Upload → Process → Return results immediately
2. **Asynchronous with SQS**: Upload → Queue job → Return immediately → Process in background

## 📋 Prerequisites

- AWS Account with SQS access
- AWS IAM credentials (Access Key ID and Secret Access Key)
- Node.js and npm installed

## 🚀 Setup Instructions

### Step 1: Create an SQS Queue

#### Option A: Using AWS Console

1. Go to [AWS SQS Console](https://console.aws.amazon.com/sqs)
2. Click **Create queue**
3. Choose queue type:
   - **Standard Queue**: Best for high throughput, at-least-once delivery
   - **FIFO Queue**: Guaranteed order, exactly-once processing (recommended for finance data)
4. Configure queue settings:
   - **Name**: `finance-manager-pdf-processing` (or your preferred name)
   - **Visibility Timeout**: 300 seconds (5 minutes)
   - **Message Retention**: 4 days (default)
   - **Maximum Message Size**: 256 KB
   - **Receive Message Wait Time**: 20 seconds (enable long polling)
5. Configure Dead Letter Queue (DLQ):
   - Create another queue: `finance-manager-pdf-processing-dlq`
   - Set Maximum Receives: 3
6. Click **Create queue**
7. Copy the **Queue URL** from the queue details page

#### Option B: Using AWS CLI

```bash
# Create main queue
aws sqs create-queue \
  --queue-name finance-manager-pdf-processing \
  --attributes VisibilityTimeout=300,MessageRetentionPeriod=345600,ReceiveMessageWaitTimeSeconds=20

# Create Dead Letter Queue
aws sqs create-queue \
  --queue-name finance-manager-pdf-processing-dlq

# Get Queue URL
aws sqs get-queue-url --queue-name finance-manager-pdf-processing
```

### Step 2: Create IAM User with SQS Permissions

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam)
2. Create a new user: `finance-manager-sqs-user`
3. Attach the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:GetQueueUrl"
      ],
      "Resource": "arn:aws:sqs:*:YOUR_ACCOUNT_ID:finance-manager-*"
    }
  ]
}
```

4. Create **Access Keys** for the user
5. Save the **Access Key ID** and **Secret Access Key**

### Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your AWS credentials:
   ```env
   # Enable SQS processing
   USE_SQS=true
   
   # AWS Configuration
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_actual_access_key_id
   AWS_SECRET_ACCESS_KEY=your_actual_secret_access_key
   AWS_SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/finance-manager-pdf-processing
   ```

### Step 4: Install Dependencies

Dependencies are already installed, but if needed:
```bash
npm install
```

## 🏃 Running the Application

### Development Mode

#### Terminal 1: Start the API Server
```bash
npm start
```
This runs the Express server on `http://localhost:3000`

#### Terminal 2: Start the SQS Worker
```bash
npm run worker
```
This starts the background worker that processes jobs from the SQS queue

### Production Mode

Use a process manager like PM2:

```bash
# Install PM2
npm install -g pm2

# Start both server and worker
pm2 start server.js --name finance-api
pm2 start worker.js --name finance-worker

# Save configuration
pm2 save
pm2 startup
```

## 📊 How It Works

### With SQS Enabled (`USE_SQS=true`)

```
User Upload → API Server → SQS Queue → Worker → Database
                ↓
          Immediate Response
          (jobId, status: "queued")
```

1. User uploads PDF via `/api/upload`
2. Server validates file and sends message to SQS
3. Server returns immediately with `jobId` and `status: "queued"`
4. Worker polls SQS queue
5. Worker processes PDF, extracts transactions, categorizes
6. Worker saves to database and deletes message from queue

### Without SQS (`USE_SQS=false`)

```
User Upload → API Server → Process PDF → Database → Response
                                ↓
                        User waits for processing
```

Traditional synchronous processing (original behavior).

## 🧪 Testing

### Test SQS Integration

```bash
# Test sending a message
curl -X POST http://localhost:3000/api/upload \
  -F "pdfFile=@test-statement.pdf" \
  -F "userId=test123" \
  -F "month=11" \
  -F "year=2025"
```

**Expected Response with SQS:**
```json
{
  "success": true,
  "message": "Statement uploaded and queued for processing",
  "data": {
    "jobId": "abc123-def456-ghi789",
    "status": "queued",
    "stmt_id": "test123_November2025"
  }
}
```

Check worker logs to see processing:
```
📥 Received 1 message(s) from queue
⚙️  Processing Job: PDF_PROCESSING
   User ID: test123
   Statement: November2025
✅ Job completed successfully in 2.34s
```

## 🔍 Monitoring

### Check Queue Statistics

Add this endpoint to your server:

```javascript
app.get('/api/queue/stats', async (req, res) => {
    const attributes = await sqsService.getQueueAttributes();
    res.json({
        messagesAvailable: attributes.ApproximateNumberOfMessages,
        messagesInFlight: attributes.ApproximateNumberOfMessagesNotVisible,
        messagesDelayed: attributes.ApproximateNumberOfMessagesDelayed
    });
});
```

### Using AWS Console

- Monitor queue metrics in CloudWatch
- Check Dead Letter Queue for failed jobs
- View message details in SQS console

## 🚨 Troubleshooting

### Worker Not Receiving Messages

1. **Check AWS credentials:**
   ```bash
   aws sts get-caller-identity
   ```

2. **Verify queue URL:**
   ```bash
   aws sqs get-queue-url --queue-name finance-manager-pdf-processing
   ```

3. **Check IAM permissions** - ensure user has `sqs:ReceiveMessage`

### Messages Going to Dead Letter Queue

- Check worker logs for errors
- Review DLQ messages in AWS console
- Common causes: file not found, parsing errors, database connection issues

### High Processing Time

- Increase number of workers
- Optimize PDF parsing logic
- Use batch processing for multiple files

## 💰 Cost Estimation

### AWS SQS Pricing (as of 2026)

- **First 1 million requests/month**: FREE
- **Additional requests**: $0.40 per million

### Example Scenarios

**1,000 users, 50 uploads/day:**
- 1,500 messages/day × 30 days = 45,000 messages/month
- **Cost: $0** (under free tier)

**10,000 users, 500 uploads/day:**
- 15,000 messages/day × 30 days = 450,000 messages/month
- **Cost: $0** (under free tier)

**100,000 users, 5,000 uploads/day:**
- 150,000 messages/day × 30 days = 4.5M messages/month
- 3.5M paid messages × $0.40 / 1M = **$1.40/month**

## 🔄 Switching Between Modes

To switch back to synchronous processing:

1. Set `USE_SQS=false` in `.env`
2. Restart server
3. Stop worker (no longer needed)

To enable SQS:

1. Set `USE_SQS=true` in `.env`
2. Restart server
3. Start worker with `npm run worker`

## 🔐 Security Best Practices

1. **Never commit `.env` file** - it contains sensitive credentials
2. **Use IAM roles** instead of access keys when running on EC2/ECS
3. **Enable SQS encryption** at rest and in transit
4. **Rotate access keys** regularly
5. **Use VPC endpoints** for private SQS access
6. **Monitor with CloudWatch** for unusual activity

## 📚 Additional Resources

- [AWS SQS Documentation](https://docs.aws.amazon.com/sqs/)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sqs/)
- [SQS Best Practices](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-best-practices.html)

## 🆘 Support

For issues or questions, check:
- Worker logs: `npm run worker`
- Server logs: `npm start`
- AWS CloudWatch logs
- Dead Letter Queue in SQS console
