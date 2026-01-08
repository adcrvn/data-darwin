#!/bin/sh
set -e

echo "Starting SmartHome Radar API..."

# Run database migrations
echo "Running database migrations..."
if node ./node_modules/prisma/build/index.js migrate deploy --schema=./prisma/combined-schema.prisma; then
    echo "✓ Migrations completed successfully"
else
    echo "✗ Migrations failed"
    exit 1
fi

# Start the Next.js server
echo "Starting Next.js server..."
exec node server.js
