# Finance Manager

A Node.js application for managing finances with PDF statement upload and transaction parsing functionality.

Actual numbers are editted in the pictures below for confidentiality.

<img width="1116" height="722" alt="Screenshot 2026-06-05 211116" src="https://github.com/user-attachments/assets/b8d8694f-75f8-47ef-a463-5b977100dd9d" />

<img width="1404" height="912" alt="Screenshot 2026-06-05 210052" src="https://github.com/user-attachments/assets/0756374b-a2f9-4c49-8a2b-cf4c47384e10" />

<img width="1343" height="903" alt="Screenshot 2026-06-05 210649" src="https://github.com/user-attachments/assets/9783e017-05fc-4d8a-801c-8b1086f5a852" />


## Features
- Register using email password and login or login with google (used passport strategies and jwt token)
- PDF file upload service (upto 5 MB, PDF Only)
- Transaction extraction and categorization service
- RESTful API endpoint
- **AWS SQS Integration** for async processing (optional)
- **Database** Local PostgreSQl or AWS Dynamo DB (optional) if deploying in aws
- **Analytics** LLM Insights service using openAI and gpt-4o-mini(highly cost-efficient, and lightweight multimodal AI model)


## Installation

```bash
npm install
```

## Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Configure your environment variables in `.env`:
- Database settings
- AWS credentials (if using SQS or Dynamodb)
- Server port

## Usage

### Standard Mode (Synchronous Processing)

Start the server:

```bash
npm start
```

The server will run on `http://localhost:3000`

### AWS SQS Mode (Asynchronous Processing)

See [README-SQS-INTEGRATION.md](README-SQS-INTEGRATION.md) for complete setup guide.

1. Configure AWS credentials in `.env`
2. Set `USE_SQS=true`
3. Start the server: `npm start`
4. Start the worker: `npm run worker`

## AWS Deployment

### Simplified Deployment (Recommended for Learning)

For a cost-effective AWS deployment without containers:

1. **Launch EC2 instance** (t3.micro - free tier eligible)
2. **Setup RDS PostgreSQL** (free tier eligible)
3. **Configure SQS** for async processing
4. **Deploy application** using the provided scripts

**Cost**: ~$15-35/month | **Complexity**: Medium

See [AWS-SIMPLIFIED-GUIDE.md](AWS-SIMPLIFIED-GUIDE.md) for complete setup.

### Full Containerized Deployment

For production-ready deployment with auto-scaling:

- **ECS/Fargate** for container orchestration
- **Application Load Balancer** for traffic distribution
- **ECR** for container registry

**Cost**: ~$25-50/month | **Complexity**: High

See [AWS-DEPLOYMENT-GUIDE.md](AWS-DEPLOYMENT-GUIDE.md) for complete setup.

### Quick Deploy Script

```bash
# Update EC2_HOST and KEY_FILE in deploy.sh
chmod +x deploy.sh
./deploy.sh prod
```

## API Endpoints

### Upload PDF Statement
- **URL**: `/api/upload`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `pdfFile`: PDF file (max 5MB)
  - `userId`: User identifier
  - `month`: Statement month (1-12)
  - `year`: Statement year (e.g., 2025)

**Success Response (Synchronous):**
```json
{
  "success": true,
  "message": "Statement processed successfully",
  "data": {
    "stmt_id": "user123_November2025",
    "categories": {
      "savings": 1500.00,
      "shopping": 250.00,
      "bills": 800.00,
      "transfers": 200.00,
      "salary": 5000.00,
      "other": 100.00
    },
    "transactions": [...]
  }
}
```

**Success Response (With SQS):**
```json
{
  "success": true,
  "message": "Statement uploaded and queued for processing",
  "data": {
    "jobId": "abc123-def456",
    "status": "queued",
    "stmt_id": "user123_November2025"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "File size exceeds 5MB limit"
}
```

## Testing with cURL

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "pdfFile=@path/to/statement.pdf" \
  -F "userId=user123" \
  -F "month=11" \
  -F "year=2025"
```

## Project Structure

```
financeManager/
├── server.js                   # Main Express server
├── services/
│   ├── transactionParser.js   # PDF parsing and categorization
│   └── sqsService.js          # AWS SQS integration
|   |── worker.js              # SQS worker for async processing
|   ├── uploadAndProcessService.js # File upload and processing logic
├── models/                     # Database models
├── dbControllers/              # PostgreSQL controller
├── dynamoDBControllers/        # DynamoDB controller
├── public/                     # Frontend files
└── uploads/                    # Temporary file storage
```

## Documentation

- [Transaction Parser Guide](README-TRANSACTION-PARSER.md)
- [PDF Table Parsing Guide](README-PDF-TABLE-PARSING.md)
- **[AWS SQS Integration Guide](README-SQS-INTEGRATION.md)** ← New!

## Scripts

- `npm start` - Start the API server
- `npm run dev` - Start in development mode
- `npm run worker` - Start the SQS worker (for async processing)
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode

## License

ISC
