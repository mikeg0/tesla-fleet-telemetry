#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required environment variables are set
check_env_vars() {
    print_status "Checking environment variables..."

    if [ -z "$TESLA_CLIENT_ID" ]; then
        print_error "TESLA_CLIENT_ID environment variable is required"
        exit 1
    fi

    if [ -z "$TESLA_CLIENT_SECRET" ]; then
        print_error "TESLA_CLIENT_SECRET environment variable is required"
        exit 1
    fi

    if [ -z "$DOMAIN_NAME" ]; then
        print_warning "DOMAIN_NAME not set, using default: tesla-fleet.example.com"
        export DOMAIN_NAME="tesla-fleet.example.com"
    fi

    print_status "Environment variables validated"
}

# Install dependencies
install_dependencies() {
    print_status "Installing CDK dependencies..."
    npm install
    print_status "Dependencies installed"
}

# Build the application
build_application() {
    print_status "Building the application..."

    # Build the Go application
    cd ..
    make build
    cd iac

    print_status "Application built successfully"
}

# Build and push Docker image
build_and_push_image() {
    print_status "Building and pushing Docker image..."

    # Get ECR repository URI from CDK outputs
    ECR_URI=$(aws cloudformation describe-stacks \
        --stack-name TeslaFleetTelemetryApi \
        --query 'Stacks[0].Outputs[?OutputKey==`EcrRepositoryUri`].OutputValue' \
        --output text 2>/dev/null || echo "")

    if [ -z "$ECR_URI" ]; then
        print_warning "ECR repository not found, will be created during deployment"
        return
    fi

    # Login to ECR
    aws ecr get-login-password --region $AWS_DEFAULT_REGION | \
        docker login --username AWS --password-stdin $ECR_URI

    # Build and tag image
    docker build -t tesla-fleet-telemetry:latest ..
    docker tag tesla-fleet-telemetry:latest $ECR_URI:latest

    # Push image
    docker push $ECR_URI:latest

    print_status "Docker image pushed successfully"
}

# Deploy infrastructure
deploy_infrastructure() {
    print_status "Deploying infrastructure with CDK..."

    # Bootstrap CDK (if needed)
    cdk bootstrap

    # Deploy all stacks
    cdk deploy --all --require-approval never

    print_status "Infrastructure deployed successfully"
}

# Build and deploy frontend
deploy_frontend() {
    print_status "Building and deploying frontend..."

    # Get outputs from CDK
    WEBSITE_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name TeslaFleetTelemetryFrontend \
        --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucketName`].OutputValue' \
        --output text)

    CLOUDFRONT_DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
        --stack-name TeslaFleetTelemetryFrontend \
        --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
        --output text)

    API_URL=$(aws cloudformation describe-stacks \
        --stack-name TeslaFleetTelemetryApi \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
        --output text)

    USER_POOL_ID=$(aws cloudformation describe-stacks \
        --stack-name TeslaFleetTelemetryAuth \
        --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
        --output text)

    USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
        --stack-name TeslaFleetTelemetryAuth \
        --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
        --output text)

    COGNITO_DOMAIN=$(aws cloudformation describe-stacks \
        --stack-name TeslaFleetTelemetryAuth \
        --query 'Stacks[0].Outputs[?OutputKey==`UserPoolDomain`].OutputValue' \
        --output text)

    # Create .env file for frontend
    cd ../frontend
    cat > .env << EOF
VITE_AWS_REGION=$AWS_DEFAULT_REGION
VITE_COGNITO_USER_POOL_ID=$USER_POOL_ID
VITE_COGNITO_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_COGNITO_DOMAIN=$COGNITO_DOMAIN.auth.$AWS_DEFAULT_REGION.amazoncognito.com
VITE_API_URL=$API_URL
VITE_MAP_STYLE_URL=https://maps.geo.$AWS_DEFAULT_REGION.amazonaws.com/maps/v0/maps/ExampleMap/style-descriptor
EOF

    # Build frontend
    npm ci
    npm run build

    # Deploy to S3
    aws s3 sync dist/ s3://$WEBSITE_BUCKET --delete

    # Invalidate CloudFront cache
    aws cloudfront create-invalidation \
        --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
        --paths "/*"

    cd ../iac

    print_status "Frontend deployed successfully"
}

# Display deployment information
show_deployment_info() {
    print_status "Deployment completed successfully!"
    echo
    echo "=== Deployment Information ==="
    echo

    # Get outputs
    WEBSITE_URL=$(aws cloudformation describe-stacks \
        --stack-name TeslaFleetTelemetryFrontend \
        --query 'Stacks[0].Outputs[?OutputKey==`WebsiteUrl`].OutputValue' \
        --output text)

    API_URL=$(aws cloudformation describe-stacks \
        --stack-name TeslaFleetTelemetryApi \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
        --output text)

    TELEMETRY_SERVICE_URL=$(aws cloudformation describe-stacks \
        --stack-name TeslaFleetTelemetryApi \
        --query 'Stacks[0].Outputs[?OutputKey==`TelemetryServiceUrl`].OutputValue' \
        --output text)

    echo "Frontend URL: $WEBSITE_URL"
    echo "API Gateway URL: $API_URL"
    echo "Telemetry Service URL: $TELEMETRY_SERVICE_URL"
    echo
    echo "=== Next Steps ==="
    echo "1. Configure your Tesla Developer Application with the callback URL: $WEBSITE_URL/auth/callback"
    echo "2. Update your Tesla OAuth configuration with the Cognito domain"
    echo "3. Configure your vehicles with the telemetry service URL: $TELEMETRY_SERVICE_URL"
    echo "4. Test the application by visiting: $WEBSITE_URL"
    echo
}

# Main deployment function
main() {
    print_status "Starting Tesla Fleet Telemetry deployment..."

    check_env_vars
    install_dependencies
    deploy_infrastructure
    build_and_push_image
    deploy_frontend
    show_deployment_info

    print_status "Deployment completed!"
}

# Run main function
main "$@"