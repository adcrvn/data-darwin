#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="smarthome-radar"
REGION="us-east-2"
ENV_FILE="/Users/hugosamayoa/Development/CRVN/data-darwin/.env"

echo -e "${GREEN}Setting up SSM Parameters from .env file...${NC}"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: .env file not found at $ENV_FILE${NC}"
    exit 1
fi

# Function to create SSM parameter
create_parameter() {
    local key=$1
    local value=$2
    local param_name="/$PROJECT_NAME/$key"

    if [ -z "$value" ]; then
        echo -e "${YELLOW}Skipping empty value for $key${NC}"
        return
    fi

    # Determine if parameter should be SecureString
    local param_type="String"
    if [[ $key == *"KEY"* ]] || [[ $key == *"SECRET"* ]] || [[ $key == *"PASSWORD"* ]] || [[ $key == *"URL"* ]]; then
        param_type="SecureString"
    fi

    echo -e "${YELLOW}Creating parameter: $param_name (Type: $param_type)${NC}"

    aws ssm put-parameter \
        --name "$param_name" \
        --value "$value" \
        --type "$param_type" \
        --region "$REGION" \
        --overwrite \
        2>/dev/null && echo -e "${GREEN}✓ Created $param_name${NC}" || echo -e "${RED}✗ Failed to create $param_name${NC}"
}

# Parse .env file and create parameters
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue

    # Remove quotes from value
    value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")

    create_parameter "$key" "$value"
done < "$ENV_FILE"

echo -e "${GREEN}SSM Parameters setup complete!${NC}"
echo ""
echo -e "${YELLOW}To view parameters:${NC}"
echo "  aws ssm get-parameters-by-path --path /$PROJECT_NAME --region $REGION"
