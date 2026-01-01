#!/bin/bash

# Configuration
BASE_URL="http://localhost:3000"
API_UPLOAD="${BASE_URL}/api/bin-files/upload"
API_GET="${BASE_URL}/api/bin-files"

echo "======================================"
echo "Binary File Upload API Test"
echo "======================================"
echo ""

# Test 1: Upload a bin file
echo "Test 1: Uploading sample_packet_minimal.bin..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_UPLOAD" \
  -H "Content-Type: application/octet-stream" \
  -H "x-filename: test-upload.bin" \
  --data-binary @sample_packet_minimal.bin)

echo "$UPLOAD_RESPONSE" | jq '.'
echo ""

# Extract filename from response
UPLOADED_FILENAME=$(echo "$UPLOAD_RESPONSE" | jq -r '.data.fileName')
echo "Uploaded filename: $UPLOADED_FILENAME"
echo ""

# Test 2: Upload another file with custom name
echo "Test 2: Uploading sample_packet_living_room.bin with custom name..."
curl -s -X POST "$API_UPLOAD?filename=living-room-test.bin" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @sample_packet_living_room.bin | jq '.'
echo ""

# Test 3: Get latest file metadata
echo "Test 3: Getting latest file metadata..."
curl -s "$API_GET?latest=true" | jq '.'
echo ""

# Test 4: List all files
echo "Test 4: Listing all files (limit 10)..."
curl -s "$API_GET?limit=10" | jq '.'
echo ""

# Test 5: Download latest file
echo "Test 5: Downloading latest file..."
curl -s "$API_GET?latest=true&download=true" -o downloaded_latest.bin
if [ -f "downloaded_latest.bin" ]; then
    echo "✓ File downloaded successfully"
    ls -lh downloaded_latest.bin
else
    echo "✗ Download failed"
fi
echo ""

# Test 6: Download by specific filename (if we got one from Test 1)
if [ ! -z "$UPLOADED_FILENAME" ]; then
    echo "Test 6: Downloading by filename: $UPLOADED_FILENAME..."
    curl -s "$API_GET?name=$UPLOADED_FILENAME" -o "downloaded_$UPLOADED_FILENAME"
    if [ -f "downloaded_$UPLOADED_FILENAME" ]; then
        echo "✓ File downloaded successfully"
        ls -lh "downloaded_$UPLOADED_FILENAME"
    else
        echo "✗ Download failed"
    fi
    echo ""
fi

# Test 7: List with pagination
echo "Test 7: Testing pagination (limit=2, offset=0)..."
curl -s "$API_GET?limit=2&offset=0" | jq '.'
echo ""

echo "======================================"
echo "All tests completed!"
echo "======================================"
