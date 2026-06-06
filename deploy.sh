#!/bin/bash
# Finance Manager AWS Deployment Script
# Usage: ./deploy.sh [environment]
# Example: ./deploy.sh prod

set -e

ENVIRONMENT=${1:-dev}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Deploying Finance Manager ($ENVIRONMENT) to AWS..."

# Configuration - Update these values
EC2_HOST="YOUR_EC2_PUBLIC_IP"  # Replace with your EC2 IP
EC2_USER="ec2-user"
KEY_FILE="your-key.pem"        # Your SSH key file
APP_NAME="finance-manager"
APP_DIR="/var/app/$APP_NAME"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."
    command -v node >/dev/null 2>&1 || { log_error "Node.js is required but not installed."; exit 1; }
    command -v npm >/dev/null 2>&1 || { log_error "npm is required but not installed."; exit 1; }
    command -v zip >/dev/null 2>&1 || { log_error "zip is required but not installed."; exit 1; }
    command -v scp >/dev/null 2>&1 || { log_error "scp is required but not installed."; exit 1; }
    command -v ssh >/dev/null 2>&1 || { log_error "ssh is required but not installed."; exit 1; }
}

prepare_app() {
    log_info "Preparing application for deployment..."

    # Install dependencies
    npm install --production

    # Run tests if they exist
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        log_info "Running tests..."
        npm test || { log_error "Tests failed. Aborting deployment."; exit 1; }
    fi

    # Create deployment package
    log_info "Creating deployment package..."
    rm -f $APP_NAME.zip

    # Exclude unnecessary files
    zip -r $APP_NAME.zip . \
        -x "*.git*" \
        -x "node_modules/*" \
        -x "*.log" \
        -x ".env*" \
        -x "tests/*" \
        -x "examples/*" \
        -x "*.md" \
        -x "deploy.sh" \
        -x "*.pem" \
        -x "*.key"

    log_info "Deployment package created: $APP_NAME.zip"
}

deploy_to_ec2() {
    log_info "Deploying to EC2 instance ($EC2_HOST)..."

    # Upload package
    log_info "Uploading application package..."
    scp -i $KEY_FILE -o StrictHostKeyChecking=no $APP_NAME.zip $EC2_USER@$EC2_HOST:/tmp/

    # Deploy on EC2
    log_info "Installing application on EC2..."
    ssh -i $KEY_FILE -o StrictHostKeyChecking=no $EC2_USER@$EC2_HOST << EOF
        set -e

        echo "Setting up application directory..."
        sudo mkdir -p $APP_DIR
        sudo chown $EC2_USER:$EC2_USER $APP_DIR

        echo "Stopping existing application..."
        pm2 stop $APP_NAME 2>/dev/null || true
        pm2 stop ${APP_NAME}-worker 2>/dev/null || true

        echo "Extracting new version..."
        cd $APP_DIR
        unzip -o /tmp/$APP_NAME.zip

        echo "Installing dependencies..."
        npm install --production

        echo "Starting application..."
        pm2 start ecosystem.config.js 2>/dev/null || {
            echo "Creating default PM2 config..."
            pm2 start server.js --name $APP_NAME
            pm2 start worker.js --name ${APP_NAME}-worker 2>/dev/null || echo "Worker not started (SQS not configured)"
        }

        echo "Saving PM2 configuration..."
        pm2 save

        echo "Checking application status..."
        pm2 list

        echo "Cleaning up..."
        rm /tmp/$APP_NAME.zip

        echo "✅ Deployment completed successfully!"
EOF

    if [ $? -eq 0 ]; then
        log_info "✅ Deployment completed successfully!"
        log_info "🌐 Application should be available at: http://$EC2_HOST"
        log_info "🔍 Check PM2 status: ssh -i $KEY_FILE $EC2_USER@$EC2_HOST 'pm2 list'"
        log_info "📝 View logs: ssh -i $KEY_FILE $EC2_USER@$EC2_HOST 'pm2 logs'"
    else
        log_error "❌ Deployment failed!"
        exit 1
    fi
}

rollback() {
    log_warn "Rolling back to previous version..."
    ssh -i $KEY_FILE -o StrictHostKeyChecking=no $EC2_USER@$EC2_HOST << EOF
        cd $APP_DIR
        pm2 stop $APP_NAME
        pm2 stop ${APP_NAME}-worker 2>/dev/null || true

        # If you have backup, restore it here
        # cp backup.zip . && unzip backup.zip

        pm2 start ecosystem.config.js
        pm2 save
EOF
}

show_usage() {
    echo "Usage: $0 [environment] [command]"
    echo ""
    echo "Environments:"
    echo "  dev      - Development environment (default)"
    echo "  staging  - Staging environment"
    echo "  prod     - Production environment"
    echo ""
    echo "Commands:"
    echo "  deploy   - Deploy application (default)"
    echo "  rollback - Rollback to previous version"
    echo ""
    echo "Examples:"
    echo "  $0                    # Deploy to dev"
    echo "  $0 prod               # Deploy to prod"
    echo "  $0 dev rollback       # Rollback dev environment"
    echo ""
    echo "Prerequisites:"
    echo "  1. Update EC2_HOST and KEY_FILE variables in this script"
    echo "  2. Ensure your SSH key has correct permissions: chmod 400 your-key.pem"
    echo "  3. EC2 instance should have Node.js, PM2, and nginx installed"
}

# Main script
case "${2:-deploy}" in
    "deploy")
        check_dependencies
        prepare_app
        deploy_to_ec2
        ;;
    "rollback")
        rollback
        ;;
    *)
        show_usage
        exit 1
        ;;
esac