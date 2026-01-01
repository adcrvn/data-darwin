#!/bin/bash

# Test binary packet upload to radar data API
# Usage: ./test-packet-upload.sh [packet_file] [api_url]

PACKET_FILE="${1:-test-data/packet_1_sensor.bin}"
API_URL="${2:-https://darwin-data-collection.vercel.app/api/radar-data}"

echo "Testing binary packet upload..."
echo "Packet file: $PACKET_FILE"
echo "API URL: $API_URL"
echo "---"

# Check if packet file exists
if [ ! -f "$PACKET_FILE" ]; then
    echo "Error: Packet file not found: $PACKET_FILE"
    exit 1
fi

# Display packet file info
echo "Packet size: $(wc -c < "$PACKET_FILE") bytes"
echo ""

# Send the request
echo "Sending request..."
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_URL" \
    -H "Content-Type: application/octet-stream" \
    --data-binary "@$PACKET_FILE")

# Extract HTTP code
http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_CODE:/d')

# Display response
echo "Response Code: $http_code"
echo "Response Body:"
echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"

# Check if successful
if [ "$http_code" = "200" ]; then
    echo ""
    echo "✅ Success! Packet uploaded successfully."
else
    echo ""
    echo "❌ Failed with HTTP code: $http_code"
    exit 1
fi
