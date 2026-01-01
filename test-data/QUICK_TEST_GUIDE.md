# Quick Test Guide - Binary Packet API

## 📦 Ready-to-Use Sample Packets

I've generated 4 sample binary packets that match your C code format:

### Files Generated
```
test-data/sample_packet_minimal.bin     (178 bytes) - Quick test
test-data/sample_packet_office.bin      (242 bytes) - 3 active targets
test-data/sample_packet_living_room.bin (370 bytes) - 2 active targets
test-data/sample_packet_bedroom.bin     (626 bytes) - Full CSI data
```

## 🚀 Test Commands

### Production API
```bash
curl -X POST https://darwin-data-collection.vercel.app/api/radar-data \
  -H "Content-Type: application/octet-stream" \
  --data-binary @test-data/sample_packet_minimal.bin
```

### Local Development
```bash
npm run dev

# In another terminal:
curl -X POST http://localhost:3000/api/radar-data \
  -H "Content-Type: application/octet-stream" \
  --data-binary @test-data/sample_packet_minimal.bin
```

### Using Test Script
```bash
./test-data/test-packet-upload.sh test-data/sample_packet_minimal.bin
```

## ✅ Expected Response

```json
{
  "success": true,
  "data": {
    "id": "unique-uuid",
    "version": 1,
    "rx_mac": "F0:F5:BD:01:56:01",
    "room_id": 1,
    "building_id": 0,
    "seq_number": "1",
    "csi_counter": "1",
    "timestamp_ms": "1702401234567",
    "rssi": -45,
    "channel": 6,
    "csi_len": 32,
    "radar_targets": {
      "0": [ /* LD2450 targets */ ],
      "1": [ /* RD03D targets */ ]
    },
    "csi_data": [[I, Q], [I, Q], ...],
    "created_at": "2025-12-12T..."
  }
}
```

## 🔧 Generate Custom Packets

```bash
# Edit generate-sample-packet.js to customize
node test-data/generate-sample-packet.js
```

## 📊 Packet Format Summary

```
Total: 114 bytes (header) + csi_len × 2 bytes (CSI data)

Header Structure:
├─ Magic: 0xDEADBEEF (4 bytes)
├─ Version: 1 (1 byte)
├─ Packet Length (2 bytes)
├─ MAC Address (6 bytes)
├─ Room ID (1 byte)
├─ Building ID (1 byte)
├─ Sequence Number (4 bytes)
├─ CSI Counter (4 bytes)
├─ Timestamp (8 bytes)
├─ RSSI (1 byte)
├─ Channel (1 byte)
├─ CSI Length (2 bytes)
├─ LD2450 Targets: 3 × 13 bytes (39 bytes)
└─ RD03D Targets: 3 × 13 bytes (39 bytes)

CSI Data: int8_t array [I, Q, I, Q, ...]
```

## 📋 Files to Share

Send these files to test the API:
1. `sample_packet_minimal.bin` - Smallest test file (178 bytes)
2. `BINARY_PACKET_FORMAT.md` - Complete format documentation
3. `test-packet-upload.sh` - Test script

## 🔍 Verify Packet Structure

```bash
# Check magic number (should be "ef be ad de")
hexdump -C test-data/sample_packet_minimal.bin | head -n 1

# Output should show:
# 00000000  ef be ad de 01 00 b2 00  ...
#           ^^^^^^^^^^ Magic (0xDEADBEEF in little-endian)
```

## 📚 Documentation Files

- **BINARY_PACKET_FORMAT.md** - Detailed format specification
- **generate-sample-packet.js** - Packet generator script
- **test-packet-upload.sh** - Automated test script

All packets match the exact C code structure from:
- Receiver: `csi_protocol.h`
- Transmitter: Forwards binary data as-is
- API Parser: `src/lib/utils/binary-parser.ts`
