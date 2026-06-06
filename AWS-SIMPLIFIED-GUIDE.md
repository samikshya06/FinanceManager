# Simplified AWS Deployment Guide - Finance Manager

## Simplified Architecture (No Containers, No ALB)

```
┌─────────────────┐
│   Route 53      │  (DNS - free tier eligible)
│  (Domain)       │
└────────┬────────┘
         │
┌────────▼────────────────────┐
│   CloudFront CDN             │  (Free tier: 1GB/month)
│ (Cache & HTTPS)              │
└────────┬─────────────────────┘
         │
┌────────▼──────────────────────────┐
│   EC2 Instance (t3.micro)         │  (~$8-10/month)
│ - Node.js app                     │
│ - Nginx reverse proxy             │
│ - PM2 process manager             │
└────────┬──────────────────────────┘
         │
    ┌────┴────┐
    │          │
┌───▼──┐  ┌───▼──┐
│ RDS  │  │ SQS  │  (~$15/month + $1/month)
│Postgre│  │Queue│
└──────┘  └──────┘
    │          │
    └────┬─────┘
         │
    ┌────▼──────────────┐
    │   S3 Bucket       │  (~$1/month)
    │ (File uploads)    │
    └───────────────────┘
         │
    ┌────▼──────────────┐
    │   CloudWatch      │  (~$5/month)
    │ (Logs & Monitoring)
    └───────────────────┘
```


## Simplified AWS Services Required

| Service | Purpose | Free Tier | Estimated Cost |
|---------|---------|-----------|-----------------|
| **Route 53** | DNS & Domain | 12 months free* | $0.50/month |
| **CloudFront** | CDN & HTTPS | 1GB/month free | $0 |
| **EC2 t3.micro** | Application server | 750 hrs/month | $8-10/month |
| **RDS PostgreSQL** | Database | db.t3.micro free | $0-15/month |
| **SQS** | Message queuing | 1M requests free | $0.40/month |
| **S3** | File storage | 5GB free | $0.50/month |
| **CloudWatch** | Monitoring | Limited free | $3-5/month |
| **ACM** | SSL certificates | Always free | $0 |
| **IAM** | Access control | Always free | $0 |

**Total Estimated Cost: $15-35/month** (vs $25-50 with containers)

---

## Simplified Deployment Steps

### Phase 1: EC2 Instance Setup

#### 1.1 Launch EC2 Instance
```bash
# Via AWS Console or CLI
aws ec2 run-instances \
  --image-id ami-0abcdef1234567890 \  # Amazon Linux 2 AMI
  --instance-type t3.micro \
  --key-name your-key-pair \
  --security-groups finance-manager-sg \
  --subnet-id subnet-xxxxx \
  --associate-public-ip-address \
  --user-data file://ec2-user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=finance-manager}]'
```

#### 1.2 User Data Script (ec2-user-data.sh)
```bash
#!/bin/bash
yum update -y
yum install -y nodejs npm nginx git postgresql postgresql-devel

# Install PM2 globally
npm install -g pm2

# Configure nginx
cat > /etc/nginx/nginx.conf << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    server {
        listen 80;
        server_name _;

        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
EOF

# Start nginx
systemctl enable nginx
systemctl start nginx

# Create app directory
mkdir -p /var/app
chown ec2-user:ec2-user /var/app
```

#### 1.3 Security Group for EC2
- **Inbound Rules:**
  - HTTP (80) from anywhere (0.0.0.0/0)
  - HTTPS (443) from anywhere (0.0.0.0/0)
  - SSH (22) from your IP only

### Phase 2: Database Setup (RDS)

#### 2.1 Create RDS Instance
```bash
aws rds create-db-instance \
  --db-instance-identifier finance-manager-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password YourSecurePassword123! \
  --allocated-storage 20 \
  --publicly-accessible false \
  --vpc-security-group-ids sg-xxxxx \
  --db-subnet-group-name your-private-subnet-group \
  --backup-retention-period 7 \
  --region us-east-1
```

#### 2.2 Store Credentials in AWS Secrets Manager
```bash
aws secretsmanager create-secret \
  --name prod/finance-manager/db \
  --secret-string '{
    "username": "admin",
    "password": "YourSecurePassword123!",
    "host": "your-db-endpoint.rds.amazonaws.com",
    "port": 5432,
    "database": "financedb"
  }'
```

### Phase 3: Application Deployment

#### 3.1 Deploy Application to EC2
```bash
# On your local machine
scp -i your-key.pem -r . ec2-user@your-ec2-ip:/tmp/finance-manager

# On EC2 instance
sudo mv /tmp/finance-manager /var/app/
cd /var/app
npm install --production

# Create .env file
cat > .env << EOF
NODE_ENV=production
PORT=3000
DB_HOST=your-db-endpoint.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=YourSecurePassword123!
DB_NAME=financedb
AWS_REGION=us-east-1
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/finance-processor-queue
S3_BUCKET_NAME=finance-manager-uploads-123456789012
USE_SQS=true
EOF
```

#### 3.2 Create PM2 Ecosystem File
Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'finance-manager',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/pm2/finance-manager-error.log',
    out_file: '/var/log/pm2/finance-manager-out.log',
    log_file: '/var/log/pm2/finance-manager.log'
  }, {
    name: 'finance-worker',
    script: 'worker.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/var/log/pm2/finance-worker-error.log',
    out_file: '/var/log/pm2/finance-worker-out.log',
    log_file: '/var/log/pm2/finance-worker.log'
  }]
};
```

#### 3.3 Start Application with PM2
```bash
# On EC2 instance
cd /var/app
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Phase 4: SQS & S3 Setup

#### 4.1 Create SQS Queue
```bash
aws sqs create-queue \
  --queue-name finance-processor-queue \
  --attributes VisibilityTimeout=300,MessageRetentionPeriod=1209600 \
  --region us-east-1
```

#### 4.2 Create S3 Bucket
```bash
aws s3 mb s3://finance-manager-uploads-123456789012 \
  --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket finance-manager-uploads-123456789012 \
  --versioning-configuration Status=Enabled
```

### Phase 5: SSL & CDN

#### 5.1 Request SSL Certificate (ACM)
```bash
aws acm request-certificate \
  --domain-name yourdomain.com \
  --validation-method DNS \
  --region us-east-1
```

#### 5.2 Create CloudFront Distribution
- **Origin**: Your EC2 instance public IP
- **Viewer Protocol Policy**: Redirect HTTP to HTTPS
- **SSL Certificate**: Your ACM certificate
- **Cache Behavior**: Default (cache static assets)

### Phase 6: Monitoring Setup

#### 6.1 CloudWatch Agent Installation
```bash
# On EC2 instance
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
sudo rpm -U amazon-cloudwatch-agent.rpm

# Create config
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << EOF
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/pm2/*.log",
            "log_group_name": "/ec2/finance-manager",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  },
  "metrics": {
    "metrics_collected": {
      "mem": {
        "measurement": [
          "mem_used_percent"
        ]
      },
      "disk": {
        "measurement": [
          "disk_used_percent"
        ],
        "resources": [
          "/"
        ]
      }
    }
  }
}
EOF

# Start agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
  -s
```

#### 6.2 Create CloudWatch Alarms
- EC2 CPU > 80%
- EC2 Memory > 80%
- RDS CPU > 80%
- SQS queue depth > 100 messages

---

## Deployment Script (deploy.sh)

```bash
#!/bin/bash
set -e

echo "🚀 Deploying Finance Manager to AWS..."

# Variables
EC2_HOST="your-ec2-public-ip"
KEY_FILE="your-key.pem"
APP_DIR="/var/app"

# Build and package app
echo "📦 Building application..."
npm install --production
zip -r finance-manager.zip . -x node_modules/\* .git/\*

# Upload to EC2
echo "📤 Uploading to EC2..."
scp -i $KEY_FILE finance-manager.zip ec2-user@$EC2_HOST:/tmp/

# Deploy on EC2
ssh -i $KEY_FILE ec2-user@$EC2_HOST << EOF
  echo "🔄 Deploying on EC2..."
  cd $APP_DIR
  pm2 stop all
  unzip -o /tmp/finance-manager.zip -d $APP_DIR
  npm install --production
  pm2 start ecosystem.config.js
  pm2 save
  echo "✅ Deployment complete!"
EOF

echo "🎉 Application deployed successfully!"
echo "🌐 Access at: http://$EC2_HOST"
```



## Quick Start Commands

```bash
# 1. Launch EC2
aws ec2 run-instances --image-id ami-0abcdef --instance-type t3.micro --key-name mykey

# 2. Create RDS
aws rds create-db-instance --db-instance-identifier finance-db --db-instance-class db.t3.micro --engine postgres

# 3. Create SQS
aws sqs create-queue --queue-name finance-processor-queue

# 4. Create S3
aws s3 mb s3://finance-uploads-$(aws sts get-caller-identity --query Account --output text)

# 5. Deploy app
./deploy.sh
```

---
