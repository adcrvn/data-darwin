#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGION=${AWS_REGION:-"us-east-2"}
REPOSITORY_NAME="smarthome-radar-api"
IMAGE_TAG=${1:-"latest"}

echo -e "${GREEN}Building and pushing Docker image...${NC}"

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Get ECR repository URL
REPOSITORY_URL="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPOSITORY_NAME"

echo -e "${YELLOW}Repository: $REPOSITORY_URL${NC}"
echo -e "${YELLOW}Image Tag: $IMAGE_TAG${NC}"

# Login to ECR
echo -e "${YELLOW}Logging in to ECR...${NC}"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

# Build Docker image for linux/amd64 (EC2 platform)
echo -e "${YELLOW}Building Docker image for linux/amd64...${NC}"
# Get script directory and navigate to project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../.."
cd "$PROJECT_ROOT"
docker build --platform linux/amd64 -t "$REPOSITORY_NAME:$IMAGE_TAG" .

# Tag image for ECR
docker tag "$REPOSITORY_NAME:$IMAGE_TAG" "$REPOSITORY_URL:$IMAGE_TAG"

# Also tag as latest if not already
if [ "$IMAGE_TAG" != "latest" ]; then
    docker tag "$REPOSITORY_NAME:$IMAGE_TAG" "$REPOSITORY_URL:latest"
fi

# Push to ECR
echo -e "${YELLOW}Pushing to ECR...${NC}"
docker push "$REPOSITORY_URL:$IMAGE_TAG"

if [ "$IMAGE_TAG" != "latest" ]; then
    docker push "$REPOSITORY_URL:latest"
fi

echo -e "${GREEN}Successfully pushed image to ECR!${NC}"
echo -e "${YELLOW}Image: $REPOSITORY_URL:$IMAGE_TAG${NC}"

# Trigger instance refresh in ASG
echo ""
read -p "Do you want to trigger an ASG instance refresh to deploy the new image? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ASG_NAME="smarthome-radar-asg"
    echo -e "${YELLOW}Triggering instance refresh for ASG: $ASG_NAME${NC}"

    aws autoscaling start-instance-refresh \
        --auto-scaling-group-name "$ASG_NAME" \
        --preferences '{"MinHealthyPercentage": 0}' \
        --region "$REGION"

    echo -e "${GREEN}Instance refresh triggered!${NC}"
    echo -e "${YELLOW}Monitor progress with:${NC}"
    echo "  aws autoscaling describe-instance-refreshes --auto-scaling-group-name $ASG_NAME --region $REGION"
fi
