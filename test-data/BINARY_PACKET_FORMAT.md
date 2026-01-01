# Binary Packet Format & Samples

This directory contains sample binary packet files that match the exact format expected by your ESP32 firmware and API.

## Quick Start

### Generate New Samples
```bash
# Generate fresh sample packets
node test-data/generate-sample-packet.js

# This creates 4 sample files:
# - sample_packet_living_room.bin (370 bytes)
# - sample_packet_bedroom.bin (626 bytes)
# - sample_packet_office.bin (242 bytes)
# - sample_packet_minimal.bin (178 bytes)
```

### Test the API
```bash
# Using curl (production)
curl -X POST https://darwin-data-collection.vercel.app/api/radar-data \
  -H "Content-Type: application/octet-stream" \
  --data-binary @test-data/sample_packet_living_room.bin

# Using curl (local development)
curl -X POST http://localhost:3000/api/radar-data \
  -H "Content-Type: application/octet-stream" \
  --data-binary @test-data/sample_packet_minimal.bin

# Using the test script
./test-data/test-packet-upload.sh test-data/sample_packet_living_room.bin
```

## Binary Packet Format

The binary packet format matches your C code (`csi_protocol.h`):

### Packet Structure Overview
```
[Header: 114 bytes] + [CSI Data: csi_len × 2 bytes]
```

### Header Layout (114 bytes total)

#### 1. Synchronization & Version (8 bytes)
- **Magic** (4 bytes, LE): `0xDEADBEEF` - Packet synchronization marker
- **Version** (1 byte): `1` - Protocol version
- **Reserved** (1 byte): `0` - Reserved for future use
- **Packet Length** (2 bytes, LE): Total packet size including CSI data

#### 2. Device Identification (8 bytes)
- **RX MAC** (6 bytes): Receiver MAC address (e.g., `F0:F5:BD:01:56:01`)
- **Room ID** (1 byte): Location identifier (see Room ID mapping below)
- **Building ID** (1 byte): Building identifier (see Building ID mapping below)

#### 3. Sequence & Timing (16 bytes)
- **Sequence Number** (4 bytes, LE): Packet sequence for loss detection
- **CSI Counter** (4 bytes, LE): Total CSI captures
- **Timestamp MS** (8 bytes, LE): Millisecond timestamp

#### 4. WiFi CSI Metadata (4 bytes)
- **RSSI** (1 byte, signed): Signal strength in dBm (e.g., -42)
- **Channel** (1 byte): WiFi channel (1-14)
- **CSI Length** (2 bytes, LE): Number of complex CSI samples (typically 32-256)

#### 5. Radar Data - LD2450 (39 bytes)
3 targets × 13 bytes each:
- **x_mm** (2 bytes, LE, signed): X position in millimeters
- **y_mm** (2 bytes, LE, signed): Y position in millimeters
- **dist_mm** (2 bytes, LE): Distance in millimeters
- **speed_cms** (2 bytes, LE, signed): Speed in cm/s
- **angle_deg_x10** (2 bytes, LE, signed): Angle in degrees × 10 (for 0.1° precision)
- **track_id** (2 bytes, LE): Tracking ID
- **valid** (1 byte): `1` = valid target, `0` = invalid

#### 6. Radar Data - RD03D (39 bytes)
Same structure as LD2450 (3 targets × 13 bytes each)

#### 7. CSI Data (variable length)
- **CSI Samples** (csi_len × 2 bytes): Array of int8_t pairs (I and Q components)
  - Each complex sample = 2 bytes: `[I_component, Q_component]`
  - Example: 128 samples = 256 bytes

### Total Packet Sizes
- Minimal (32 CSI samples): 114 + 64 = **178 bytes**
- Small (64 CSI samples): 114 + 128 = **242 bytes**
- Medium (128 CSI samples): 114 + 256 = **370 bytes**
- Large (256 CSI samples): 114 + 512 = **626 bytes**

## ID Mappings

### Room IDs
```c
0  = Bedroom
1  = Living Room
2  = Kitchen
3  = Bathroom
4  = Office
5  = Hallway
6  = Garage
7  = Basement
8  = Dining Room
9  = Guest Room
10 = Balcony
11 = Laundry
12 = Storage
13 = Entrance
14 = Patio
255 = Unknown
```

### Building IDs
```c
0  = Main Office
1  = Building A
2  = Building B
3  = Building C
4  = Warehouse
5  = Lab
6  = Factory
7  = Residence 1
8  = Residence 2
9  = Annex
255 = Unknown
```

## Sample Packet Details

### sample_packet_living_room.bin (370 bytes)
- **Room**: Living Room (1)
- **Building**: Main Office (0)
- **CSI Length**: 128 samples
- **RSSI**: -42 dBm
- **Channel**: 6
- **Active Targets**: 2 (LD2450) + 1 (RD03D)

### sample_packet_bedroom.bin (626 bytes)
- **Room**: Bedroom (0)
- **Building**: Residence 1 (7)
- **CSI Length**: 256 samples
- **RSSI**: -38 dBm
- **Channel**: 11
- **Active Targets**: 1 (LD2450) + 1 (RD03D)

### sample_packet_office.bin (242 bytes)
- **Room**: Office (4)
- **Building**: Building A (1)
- **CSI Length**: 64 samples
- **RSSI**: -50 dBm
- **Channel**: 1
- **Active Targets**: 3 (LD2450) + 3 (RD03D)

### sample_packet_minimal.bin (178 bytes)
- **Room**: Living Room (1)
- **Building**: Main Office (0)
- **CSI Length**: 32 samples
- **RSSI**: -45 dBm
- **Channel**: 6
- **Active Targets**: 2 (LD2450) + 1 (RD03D)

## Customization

### Generate Custom Packets

Edit `generate-sample-packet.js` and modify the options:

```javascript
const customPacket = createCSIPacket({
    rx_mac: [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF],
    room_id: ROOM_IDS.KITCHEN,
    building_id: BUILDING_IDS.BUILDING_B,
    seq_number: 100,
    csi_counter: 5000,
    rssi: -35,
    channel: 11,
    csi_len: 256,
    ld2450_targets: [
        { x_mm: 1000, y_mm: 500, dist_mm: 1118, speed_cms: 10, angle_deg: 26.6, track_id: 1, valid: true },
        // ... more targets
    ]
});
```

## Expected API Response

Successful upload returns:
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "version": 1,
    "rx_mac": "F0:F5:BD:01:56:01",
    "room_id": 1,
    "building_id": 0,
    "seq_number": "1",
    "timestamp_ms": "1702401234567",
    "rssi": -42,
    "channel": 6,
    "csi_len": 128,
    "radar_targets": {
      "0": [
        {"x_mm": 1200, "y_mm": 800, "dist_mm": 1442, "speed_cms": 15, "angle_deg_x10": 337, "track_id": 1, "valid": 1},
        {"x_mm": -500, "y_mm": 1500, "dist_mm": 1581, "speed_cms": -8, "angle_deg_x10": -184, "track_id": 2, "valid": 1},
        {"x_mm": 0, "y_mm": 0, "dist_mm": 0, "speed_cms": 0, "angle_deg_x10": 0, "track_id": 0, "valid": 0}
      ],
      "1": [
        {"x_mm": 900, "y_mm": 600, "dist_mm": 1081, "speed_cms": 12, "angle_deg_x10": 288, "track_id": 3, "valid": 1},
        {"x_mm": 0, "y_mm": 0, "dist_mm": 0, "speed_cms": 0, "angle_deg_x10": 0, "track_id": 0, "valid": 0},
        {"x_mm": 0, "y_mm": 0, "dist_mm": 0, "speed_cms": 0, "angle_deg_x10": 0, "track_id": 0, "valid": 0}
      ]
    },
    "csi_data": [[12, -5], [8, 3], ...],
    "created_at": "2025-12-12T..."
  }
}
```

## Troubleshooting

### Common Issues

**400 Bad Request - Invalid packet format**
- Check magic number is `0xDEADBEEF` (little-endian)
- Verify packet_length matches actual size
- Ensure CSI data length = `csi_len × 2` bytes

**Packet too small error**
- Minimum packet size is 178 bytes (114 header + 64 CSI data)
- Check `csi_len` matches actual CSI data size

**CSI data mismatch**
- CSI data must be int8_t array (signed bytes -128 to +127)
- Each complex sample = 2 bytes (I and Q components)

### Verification

```bash
# Check packet size
ls -lh test-data/sample_packet_*.bin

# Verify magic number (should show "ef be ad de" = 0xDEADBEEF in little-endian)
hexdump -C test-data/sample_packet_minimal.bin | head -n 1

# Full hex dump
hexdump -C test-data/sample_packet_minimal.bin
```

## Legacy Packets

The old protocol packets are still available for reference:
- `packet_1_sensor.bin` through `packet_5_sensors.bin`

These use a different format and may not work with the current API.

## Resources

- **C Protocol Definition**: `src/lib/utils/binary-parser.ts`
- **API Endpoint**: `src/app/api/radar-data/route.ts`
- **Type Definitions**: `src/types/radar.ts`
- **Generator Script**: `test-data/generate-sample-packet.js`
- **Test Script**: `test-data/test-packet-upload.sh`
