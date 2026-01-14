#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Running Prisma database migrations...${NC}"

# Check if DATABASE_URL is set in .env
if [ ! -f "../.env" ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please create .env file with DATABASE_URL"
    exit 1
fi

# Source .env file
export $(cat ../.env | grep -v '^#' | xargs)

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL not found in .env${NC}"
    exit 1
fi

echo -e "${YELLOW}Database URL found, running migrations...${NC}"

# Run migrations from project root
cd ../..
npx prisma migrate deploy

echo -e "${GREEN}Database migrations completed successfully!${NC}"
