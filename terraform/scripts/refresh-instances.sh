#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGION=${AWS_REGION:-"us-east-2"}
ASG_NAME="smarthome-radar-asg"
AUTO_APPROVE=${1:-"false"}

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  ASG Instance Refresh Tool${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check if ASG exists
echo -e "${YELLOW}Checking if ASG exists...${NC}"
if ! aws autoscaling describe-auto-scaling-groups \
    --auto-scaling-group-names "$ASG_NAME" \
    --region "$REGION" \
    --query 'AutoScalingGroups[0]' \
    --output text &> /dev/null; then
    echo -e "${RED}Error: Auto Scaling Group '$ASG_NAME' not found in region $REGION${NC}"
    echo -e "${YELLOW}Available ASGs:${NC}"
    aws autoscaling describe-auto-scaling-groups \
        --region "$REGION" \
        --query 'AutoScalingGroups[].AutoScalingGroupName' \
        --output table
    exit 1
fi

# Get current ASG info
echo -e "${GREEN}✓ Found ASG: $ASG_NAME${NC}"
echo ""

ASG_INFO=$(aws autoscaling describe-auto-scaling-groups \
    --auto-scaling-group-names "$ASG_NAME" \
    --region "$REGION" \
    --query 'AutoScalingGroups[0]')

DESIRED_CAPACITY=$(echo "$ASG_INFO" | jq -r '.DesiredCapacity')
MIN_SIZE=$(echo "$ASG_INFO" | jq -r '.MinSize')
MAX_SIZE=$(echo "$ASG_INFO" | jq -r '.MaxSize')
INSTANCE_COUNT=$(echo "$ASG_INFO" | jq -r '.Instances | length')

echo -e "${YELLOW}Current ASG Configuration:${NC}"
echo "  Desired Capacity: $DESIRED_CAPACITY"
echo "  Min Size: $MIN_SIZE"
echo "  Max Size: $MAX_SIZE"
echo "  Current Instances: $INSTANCE_COUNT"
echo ""

# Check for active instance refreshes
echo -e "${YELLOW}Checking for active instance refreshes...${NC}"
ACTIVE_REFRESH=$(aws autoscaling describe-instance-refreshes \
    --auto-scaling-group-name "$ASG_NAME" \
    --region "$REGION" \
    --query 'InstanceRefreshes[?Status==`InProgress` || Status==`Pending`] | [0]' \
    --output json)

if [ "$ACTIVE_REFRESH" != "null" ]; then
    REFRESH_ID=$(echo "$ACTIVE_REFRESH" | jq -r '.InstanceRefreshId')
    REFRESH_STATUS=$(echo "$ACTIVE_REFRESH" | jq -r '.Status')
    REFRESH_PROGRESS=$(echo "$ACTIVE_REFRESH" | jq -r '.PercentageComplete // 0')

    echo -e "${YELLOW}⚠ Active instance refresh found!${NC}"
    echo "  Refresh ID: $REFRESH_ID"
    echo "  Status: $REFRESH_STATUS"
    echo "  Progress: $REFRESH_PROGRESS%"
    echo ""
    read -p "Do you want to cancel it and start a new one? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Cancelling active refresh...${NC}"
        aws autoscaling cancel-instance-refresh \
            --auto-scaling-group-name "$ASG_NAME" \
            --region "$REGION"
        echo -e "${GREEN}✓ Cancelled${NC}"
        echo ""
        sleep 2
    else
        echo -e "${YELLOW}Exiting without changes${NC}"
        exit 0
    fi
fi

# Explain what will happen
echo -e "${BLUE}What will happen:${NC}"
echo "  1. Terraform will launch new EC2 instance(s)"
echo "  2. New instances will pull latest Docker image from ECR"
echo "  3. New instances will fetch latest SSM parameters"
echo "  4. Old instances will be terminated after new ones are healthy"
echo ""
echo -e "${YELLOW}Use cases:${NC}"
echo "  • After updating SSM parameters (env variables)"
echo "  • After pushing new Docker image to ECR"
echo "  • To apply new user-data script changes"
echo "  • To recover from unhealthy instances"
echo ""

# Confirm
if [ "$AUTO_APPROVE" != "--yes" ] && [ "$AUTO_APPROVE" != "-y" ]; then
    read -p "Trigger instance refresh for ASG '$ASG_NAME'? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Cancelled${NC}"
        exit 0
    fi
else
    echo -e "${GREEN}Auto-approving instance refresh...${NC}"
fi

# Start instance refresh
echo -e "${YELLOW}Starting instance refresh...${NC}"
REFRESH_OUTPUT=$(aws autoscaling start-instance-refresh \
    --auto-scaling-group-name "$ASG_NAME" \
    --preferences '{"MinHealthyPercentage": 0, "InstanceWarmup": 60}' \
    --region "$REGION" \
    --output json)

REFRESH_ID=$(echo "$REFRESH_OUTPUT" | jq -r '.InstanceRefreshId')

echo -e "${GREEN}✓ Instance refresh started!${NC}"
echo -e "${BLUE}Refresh ID: $REFRESH_ID${NC}"
echo ""

# Ask if user wants to monitor progress
read -p "Do you want to monitor the refresh progress? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Monitoring instance refresh (press Ctrl+C to stop monitoring)...${NC}"
    echo ""

    while true; do
        REFRESH_STATUS=$(aws autoscaling describe-instance-refreshes \
            --auto-scaling-group-name "$ASG_NAME" \
            --instance-refresh-ids "$REFRESH_ID" \
            --region "$REGION" \
            --query 'InstanceRefreshes[0]' \
            --output json)

        STATUS=$(echo "$REFRESH_STATUS" | jq -r '.Status')
        PROGRESS=$(echo "$REFRESH_STATUS" | jq -r '.PercentageComplete // 0')
        INSTANCES_TO_UPDATE=$(echo "$REFRESH_STATUS" | jq -r '.InstancesToUpdate // 0')

        echo -ne "\r${BLUE}Status: $STATUS | Progress: $PROGRESS% | Instances remaining: $INSTANCES_TO_UPDATE${NC}"

        if [ "$STATUS" = "Successful" ]; then
            echo ""
            echo -e "${GREEN}✓ Instance refresh completed successfully!${NC}"
            break
        elif [ "$STATUS" = "Failed" ] || [ "$STATUS" = "Cancelled" ]; then
            echo ""
            echo -e "${RED}✗ Instance refresh $STATUS${NC}"
            echo ""
            echo -e "${YELLOW}Status details:${NC}"
            echo "$REFRESH_STATUS" | jq -r '.StatusReason // "No additional information"'
            exit 1
        fi

        sleep 5
    done
else
    echo ""
    echo -e "${YELLOW}Monitor progress manually with:${NC}"
    echo "  aws autoscaling describe-instance-refreshes \\"
    echo "    --auto-scaling-group-name $ASG_NAME \\"
    echo "    --region $REGION"
    echo ""
    echo -e "${YELLOW}Or check CloudWatch Logs:${NC}"
    echo "  aws logs tail /aws/ec2/smarthome-radar --follow --region $REGION"
fi

echo ""
echo -e "${GREEN}Done!${NC}"
