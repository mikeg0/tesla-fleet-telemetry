# Tesla Fleet Telemetry - AWS CDK Infrastructure

This directory contains the complete AWS CDK infrastructure as code for deploying the Tesla Fleet Telemetry project to AWS.

## Architecture Overview

The infrastructure is split into multiple stacks for better organization and reusability:

- **Auth Stack**: Cognito User Pool with Tesla OAuth integration
- **Database Stack**: DynamoDB tables for users, vehicles, and telemetry data
- **API Stack**: API Gateway, Lambda functions, and ECS Fargate for the telemetry service
- **Frontend Stack**: S3 bucket, CloudFront distribution, and Route 53 configuration
- **Main Stack**: Additional resources like Kinesis streams, S3 data storage, and CI/CD roles

## Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **Node.js** (v16 or later) and npm
3. **Docker** for building and pushing container images
4. **Tesla Developer Account** with OAuth application credentials
5. **Domain Name** (optional, but recommended for production)

## Quick Start

### 1. Set Environment Variables

```bash
export TESLA_CLIENT_ID="your_tesla_client_id"
export TESLA_CLIENT_SECRET="your_tesla_client_secret"
export DOMAIN_NAME="your-domain.com"  # Optional
export AWS_DEFAULT_REGION="us-east-1"
```

### 2. Verify AWS Profile

The deployment script automatically uses the `bonsai` profile. Verify it's configured:

```bash
# Quick verification (recommended)
./verify-profile.sh

# Manual verification
aws configure list-profiles
aws sts get-caller-identity --profile bonsai
```

### 3. Deploy Everything

```bash
cd iac
./deploy.sh
```

This script will:
- Install CDK dependencies
- Deploy all infrastructure stacks
- Build and push the Docker image
- Build and deploy the frontend
- Display deployment information

## Manual Deployment Steps

If you prefer to deploy manually:

### 1. Install Dependencies

```bash
cd iac
npm install
```

### 2. Bootstrap CDK (First Time Only)

```bash
# Bootstrap using the bonsai profile
cdk bootstrap --profile bonsai
```

### 3. Deploy Infrastructure

```bash
# Deploy using the bonsai profile
cdk deploy --all --profile bonsai
```

### 4. Build and Push Docker Image

```bash
# Get ECR repository URI using bonsai profile
ECR_URI=$(aws cloudformation describe-stacks \
  --profile bonsai \
  --stack-name TeslaFleetTelemetryApi \
  --query 'Stacks[0].Outputs[?OutputKey==`EcrRepositoryUri`].OutputValue' \
  --output text)

# Login to ECR using bonsai profile
aws ecr get-login-password --profile bonsai --region $AWS_DEFAULT_REGION | \
  docker login --username AWS --password-stdin $ECR_URI

# Build and push
docker build -t tesla-fleet-telemetry:latest ..
docker tag tesla-fleet-telemetry:latest $ECR_URI:latest
docker push $ECR_URI:latest
```

### 5. Deploy Frontend

```bash
# Get required values from CDK outputs using bonsai profile
WEBSITE_BUCKET=$(aws cloudformation describe-stacks \
  --profile bonsai \
  --stack-name TeslaFleetTelemetryFrontend \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucketName`].OutputValue' \
  --output text)

API_URL=$(aws cloudformation describe-stacks \
  --profile bonsai \
  --stack-name TeslaFleetTelemetryApi \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --profile bonsai \
  --stack-name TeslaFleetTelemetryAuth \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --profile bonsai \
  --stack-name TeslaFleetTelemetryAuth \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text)

# Create .env file
cd ../frontend
cat > .env << EOF
VITE_AWS_REGION=$AWS_DEFAULT_REGION
VITE_COGNITO_USER_POOL_ID=$USER_POOL_ID
VITE_COGNITO_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_COGNITO_DOMAIN=track-my-tessie.auth.$AWS_DEFAULT_REGION.amazoncognito.com
VITE_API_URL=$API_URL
VITE_MAP_STYLE_URL=https://maps.geo.$AWS_DEFAULT_REGION.amazonaws.com/maps/v0/maps/ExampleMap/style-descriptor
EOF

# Build and deploy using bonsai profile
npm ci
npm run build
aws s3 sync dist/ s3://$WEBSITE_BUCKET --delete --profile bonsai
```

## Stack Details

### Auth Stack (`TeslaFleetTelemetryAuth`)

- **Cognito User Pool**: Manages user authentication
- **Tesla OIDC Provider**: Integrates with Tesla OAuth
- **User Pool Client**: Web application client
- **Custom Attributes**: Stores Tesla user ID and vehicle IDs

### Database Stack (`TeslaFleetTelemetryDatabase`)

- **Users Table**: Stores user information and Tesla associations
- **Vehicles Table**: Stores vehicle data with user associations
- **Telemetry Table**: Stores recent telemetry data with TTL
- **GSIs**: Optimized for common query patterns

### API Stack (`TeslaFleetTelemetryApi`)

- **ECR Repository**: Stores Docker images
- **ECS Fargate**: Runs the telemetry service
- **Application Load Balancer**: Routes traffic to ECS
- **API Gateway**: REST API with Cognito authorization
- **Lambda Functions**: API handlers for user operations

### Frontend Stack (`TeslaFleetTelemetryFrontend`)

- **S3 Bucket**: Hosts static website files
- **CloudFront Distribution**: CDN with custom domain
- **Route 53**: DNS management
- **SSL Certificate**: ACM certificate for HTTPS

### Main Stack (`TeslaFleetTelemetryMain`)

- **S3 Data Bucket**: Long-term telemetry data storage
- **Kinesis Stream**: Real-time data ingestion
- **Kinesis Firehose**: Data delivery to S3
- **CloudWatch Logs**: Application logging
- **IAM Roles**: Service and CI/CD permissions

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TESLA_CLIENT_ID` | Tesla OAuth client ID | Yes |
| `TESLA_CLIENT_SECRET` | Tesla OAuth client secret | Yes |
| `DOMAIN_NAME` | Custom domain for the application | No |
| `AWS_DEFAULT_REGION` | AWS region for deployment | No |

### Tesla OAuth Configuration

After deployment, configure your Tesla Developer Application:

1. **Callback URL**: `https://your-domain.com/auth/callback`
2. **Scopes**: `openid email profile offline_access`
3. **Cognito Domain**: Use the output from the Auth stack

## Monitoring and Logging

- **CloudWatch Logs**: Application logs in `/aws/tesla-fleet-telemetry/application`
- **CloudWatch Metrics**: ECS service metrics
- **S3 Access Logs**: Frontend bucket access logs
- **CloudFront Logs**: CDN access logs

## Cost Optimization

- **DynamoDB**: Pay-per-request billing for unpredictable workloads
- **ECS Fargate**: Pay only for resources used
- **S3 Lifecycle**: Automatic data archival to reduce costs
- **CloudFront**: Free tier includes 1TB of data transfer

## Security

- **VPC**: Isolated network for ECS services
- **IAM**: Least privilege access policies
- **HTTPS**: SSL/TLS encryption everywhere
- **Cognito**: Secure user authentication
- **S3**: Encrypted storage with access controls

## Scaling

- **ECS Fargate**: Auto-scaling based on CPU/memory
- **DynamoDB**: Automatic scaling with on-demand billing
- **Kinesis**: Add shards for higher throughput
- **CloudFront**: Global CDN for frontend

## Troubleshooting

### Common Issues

1. **CDK Bootstrap Required**
   ```bash
   cdk bootstrap
   ```

2. **Docker Build Fails**
   - Ensure Docker is running
   - Check available disk space
   - Verify Dockerfile syntax

3. **ECR Login Fails**
   ```bash
   aws ecr get-login-password --profile bonsai --region $AWS_DEFAULT_REGION | \
     docker login --username AWS --password-stdin $ECR_URI
   ```

4. **Frontend Build Fails**
   - Check Node.js version (v16+)
   - Clear npm cache: `npm cache clean --force`
   - Delete node_modules and reinstall

### Useful Commands

```bash
# View stack outputs using bonsai profile
cdk list --profile bonsai
cdk outputs --profile bonsai

# Destroy all stacks using bonsai profile
cdk destroy --all --profile bonsai

# View CloudFormation events using bonsai profile
aws cloudformation describe-stack-events --profile bonsai --stack-name TeslaFleetTelemetryAuth

# Check ECS service status using bonsai profile
aws ecs describe-services --profile bonsai --cluster tesla-fleet-telemetry --services tesla-fleet-telemetry
```

## Updates and Maintenance

### Updating the Application

1. **Update Docker Image**:
   ```bash
   docker build -t tesla-fleet-telemetry:latest ..
   docker tag tesla-fleet-telemetry:latest $ECR_URI:latest
   docker push $ECR_URI:latest
   ```

2. **Update ECS Service**:
   ```bash
   aws ecs update-service --profile bonsai --cluster tesla-fleet-telemetry --service tesla-fleet-telemetry --force-new-deployment
   ```

3. **Update Frontend**:
   ```bash
   cd ../frontend
   npm run build
   aws s3 sync dist/ s3://$WEBSITE_BUCKET --delete --profile bonsai
   aws cloudfront create-invalidation --profile bonsai --distribution-id $DISTRIBUTION_ID --paths "/*"
   ```

### Infrastructure Updates

```bash
# Update CDK code and deploy using bonsai profile
cd iac
npm run build
cdk deploy --all --profile bonsai
```

## Support

For issues with the infrastructure:
1. Check CloudWatch logs
2. Review CloudFormation events
3. Verify IAM permissions
4. Check service quotas and limits

For Tesla-specific issues:
1. Verify OAuth configuration
2. Check Tesla API documentation
3. Ensure vehicle firmware is compatible