#!/bin/bash
# EC2 User Data Script for Finance Manager
# This script runs automatically when the EC2 instance launches

set -e

# Update system
yum update -y

# Install required packages
yum install -y nodejs npm nginx git postgresql postgresql-devel unzip wget

# Install PM2 globally
npm install -g pm2

# Create application directory
mkdir -p /var/app
chown ec2-user:ec2-user /var/app

# Configure nginx as reverse proxy
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

    # Basic settings
    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;  # Allow large file uploads

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

        # Handle static files
        location /css/ {
            alias /var/app/public/css/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        location /js/ {
            alias /var/app/public/js/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Proxy to Node.js application
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

            # Timeout settings
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
EOF

# Create log directories
mkdir -p /var/log/pm2
chown ec2-user:ec2-user /var/log/pm2

# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U amazon-cloudwatch-agent.rpm

# Create CloudWatch config
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'EOF'
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/pm2/*.log",
            "log_group_name": "/ec2/finance-manager",
            "log_stream_name": "{instance_id}"
          },
          {
            "file_path": "/var/log/nginx/error.log",
            "log_group_name": "/ec2/finance-manager",
            "log_stream_name": "{instance_id}-nginx-error"
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

# Start services
systemctl enable nginx
systemctl start nginx

# Create a simple placeholder index.html
mkdir -p /var/app/public
cat > /var/app/public/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Finance Manager - Setting Up...</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 20px auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <h1>🚀 Finance Manager</h1>
    <p>Application is being deployed...</p>
    <div class="spinner"></div>
    <p><small>Check back in a few minutes</small></p>
</body>
</html>
EOF

# Set proper permissions
chown -R ec2-user:ec2-user /var/app

# Create environment file template
cat > /var/app/.env.example << 'EOF'
# Database Configuration
DB_HOST=your-rds-endpoint.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=your-secure-password
DB_NAME=financedb

# Application Configuration
NODE_ENV=production
PORT=3000

# AWS Configuration
AWS_REGION=us-east-1
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/finance-processor-queue
S3_BUCKET_NAME=finance-manager-uploads-YOUR_ACCOUNT_ID
USE_SQS=true

# Security (generate random strings)
SESSION_SECRET=your-random-session-secret-here
EOF

# Signal completion
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

echo "✅ EC2 instance setup completed!" > /var/log/user-data.log
date >> /var/log/user-data.log