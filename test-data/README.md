# Binary Radar Packet Testing

Test files and sample packets for the Darwin data collection API.

## Quick Start

### Generate Sample Packets
```bash
node generate-sample-packet.js
```

### Test API
```bash
# Production
curl -X POST https://darwin-data-collection.vercel.app/api/radar-data \
  -H "Content-Type: application/octet-stream" \
  --data-binary @sample_packet_minimal.bin

# Local
npm run dev
curl -X POST http://localhost:3000/api/radar-data \
  -H "Content-Type: application/octet-stream" \
  --data-binary @sample_packet_minimal.bin
```

## Sample Files

- `sample_packet_minimal.bin` (178 bytes) - Quick test packet
- `sample_packet_living_room.bin` (370 bytes) - Medium size
- `sample_packet_office.bin` (242 bytes) - Full targets
- `sample_packet_bedroom.bin` (626 bytes) - Full CSI data

## Documentation

- **QUICK_TEST_GUIDE.md** - Quick reference for testing
- **BINARY_PACKET_FORMAT.md** - Complete protocol specification

## Protocol Summary

**Header**: 114 bytes fixed
- Magic: 0xDEADBEEF
- Device ID: MAC, Room, Building
- Timing: Sequence, Counter, Timestamp
- WiFi: RSSI, Channel, CSI Length
- Radar: LD2450 (3 targets) + RD03D (3 targets)

**CSI Data**: Variable (csi_len × 2 bytes)
