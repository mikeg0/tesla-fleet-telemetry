#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "Verifying 'bonsai' AWS profile configuration..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if bonsai profile exists
if ! aws configure list-profiles | grep -q "^bonsai$"; then
    print_error "AWS profile 'bonsai' not found."
    echo "Available profiles:"
    aws configure list-profiles
    echo
    echo "To configure the bonsai profile, run:"
    echo "  aws configure --profile bonsai"
    exit 1
fi

print_status "Profile 'bonsai' found."

# Test profile credentials
echo "Testing profile credentials..."
if ! ACCOUNT_ID=$(aws sts get-caller-identity --profile bonsai --query Account --output text 2>/dev/null); then
    print_error "Failed to authenticate with 'bonsai' profile."
    echo "Please check your credentials and run:"
    echo "  aws configure --profile bonsai"
    exit 1
fi

USER_ARN=$(aws sts get-caller-identity --profile bonsai --query Arn --output text)
REGION=$(aws configure get region --profile bonsai || echo "Not set")

print_status "✅ Profile 'bonsai' is properly configured!"
echo
echo "=== Profile Information ==="
echo "Account ID: $ACCOUNT_ID"
echo "User/Role:  $USER_ARN"
echo "Region:     $REGION"
echo

if [ "$REGION" = "Not set" ]; then
    print_warning "No default region set for bonsai profile."
    echo "You may want to set it:"
    echo "  aws configure set region us-east-1 --profile bonsai"
fi

echo "=== Next Steps ==="
echo "1. Set your environment variables:"
echo "   export TESLA_CLIENT_ID=\"your_client_id\""
echo "   export TESLA_CLIENT_SECRET=\"your_client_secret\""
echo "   export DOMAIN_NAME=\"your-domain.com\""
echo
echo "2. Run the deployment:"
echo "   ./deploy.sh"
echo