#!/usr/bin/env node
/**
 * Generate Sample Binary Packet for Darwin Data Collection API
 * 
 * This script creates a binary packet matching the exact format from the C code:
 * - csi_packet_header_t structure (114 bytes)
 * - CSI data (variable length int8_t array)
 * 
 * Protocol matches: csi_protocol.h
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// PROTOCOL CONSTANTS (matching C code)
// ============================================================================
const CSI_MAGIC_SYNC = 0xDEADBEEF;
const CSI_PROTOCOL_VERSION = 1;

// Room IDs (matching room_id_t enum)
const ROOM_IDS = {
    BEDROOM: 0,
    LIVING_ROOM: 1,
    KITCHEN: 2,
    BATHROOM: 3,
    OFFICE: 4,
    HALLWAY: 5,
    GARAGE: 6,
    BASEMENT: 7,
    DINING_ROOM: 8,
    GUEST_ROOM: 9,
    BALCONY: 10,
    LAUNDRY: 11,
    STORAGE: 12,
    ENTRANCE: 13,
    PATIO: 14,
    UNKNOWN: 255
};

// Building IDs (matching building_id_t enum)
const BUILDING_IDS = {
    MAIN_OFFICE: 0,
    BUILDING_A: 1,
    BUILDING_B: 2,
    BUILDING_C: 3,
    WAREHOUSE: 4,
    LAB: 5,
    FACTORY: 6,
    RESIDENCE_1: 7,
    RESIDENCE_2: 8,
    ANNEX: 9,
    UNKNOWN: 255
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a radar target (13 bytes)
 */
function createRadarTarget(x_mm, y_mm, dist_mm, speed_cms, angle_deg, track_id, valid) {
    const buffer = Buffer.alloc(13);
    let offset = 0;
    
    buffer.writeInt16LE(x_mm, offset); offset += 2;           // x_mm
    buffer.writeInt16LE(y_mm, offset); offset += 2;           // y_mm
    buffer.writeUInt16LE(dist_mm, offset); offset += 2;       // dist_mm
    buffer.writeInt16LE(speed_cms, offset); offset += 2;      // speed_cms
    buffer.writeInt16LE(Math.round(angle_deg * 10), offset); offset += 2; // angle_deg_x10
    buffer.writeUInt16LE(track_id, offset); offset += 2;      // track_id
    buffer.writeUInt8(valid ? 1 : 0, offset);                 // valid
    
    return buffer;
}

/**
 * Create CSI packet with header + CSI data
 */
function createCSIPacket(options = {}) {
    // Default options
    const {
        rx_mac = [0xF0, 0xF5, 0xBD, 0x01, 0x56, 0x01],
        room_id = ROOM_IDS.LIVING_ROOM,
        building_id = BUILDING_IDS.MAIN_OFFICE,
        seq_number = 1,
        csi_counter = 1,
        timestamp_ms = Date.now(),
        rssi = -45,
        channel = 6,
        csi_len = 128,  // Reduced CSI length for smaller packet
        
        // LD2450 targets
        ld2450_targets = [
            { x_mm: 1200, y_mm: 800, dist_mm: 1442, speed_cms: 15, angle_deg: 33.7, track_id: 1, valid: true },
            { x_mm: -500, y_mm: 1500, dist_mm: 1581, speed_cms: -8, angle_deg: -18.4, track_id: 2, valid: true },
            { x_mm: 0, y_mm: 0, dist_mm: 0, speed_cms: 0, angle_deg: 0, track_id: 0, valid: false }
        ],
        
        // RD03D targets
        rd03d_targets = [
            { x_mm: 900, y_mm: 600, dist_mm: 1081, speed_cms: 12, angle_deg: 28.8, track_id: 3, valid: true },
            { x_mm: 0, y_mm: 0, dist_mm: 0, speed_cms: 0, angle_deg: 0, track_id: 0, valid: false },
            { x_mm: 0, y_mm: 0, dist_mm: 0, speed_cms: 0, angle_deg: 0, track_id: 0, valid: false }
        ]
    } = options;
    
    // Calculate total packet length
    const header_size = 114;
    const csi_data_size = csi_len * 2;  // 2 bytes per complex sample (I and Q as int8_t)
    const packet_length = header_size + csi_data_size;
    
    // Create header buffer (114 bytes)
    const header = Buffer.alloc(header_size);
    let offset = 0;
    
    // Synchronization & Version (8 bytes)
    header.writeUInt32LE(CSI_MAGIC_SYNC, offset); offset += 4;  // magic
    header.writeUInt8(CSI_PROTOCOL_VERSION, offset); offset += 1;  // version
    header.writeUInt8(0, offset); offset += 1;  // reserved1
    header.writeUInt16LE(packet_length, offset); offset += 2;  // packet_length
    
    // Device Identification (8 bytes)
    for (let i = 0; i < 6; i++) {
        header.writeUInt8(rx_mac[i], offset); offset += 1;  // rx_mac
    }
    header.writeUInt8(room_id, offset); offset += 1;  // room_id
    header.writeUInt8(building_id, offset); offset += 1;  // building_id
    
    // Sequence & Timing (16 bytes)
    header.writeUInt32LE(seq_number, offset); offset += 4;  // seq_number
    header.writeUInt32LE(csi_counter, offset); offset += 4;  // csi_counter
    header.writeBigUInt64LE(BigInt(timestamp_ms), offset); offset += 8;  // timestamp_ms
    
    // WiFi CSI Metadata (4 bytes)
    header.writeInt8(rssi, offset); offset += 1;  // rssi
    header.writeUInt8(channel, offset); offset += 1;  // channel
    header.writeUInt16LE(csi_len, offset); offset += 2;  // csi_len
    
    // Radar Data - LD2450 (39 bytes = 3 targets × 13 bytes)
    for (let i = 0; i < 3; i++) {
        const target = ld2450_targets[i];
        const targetBuf = createRadarTarget(
            target.x_mm, target.y_mm, target.dist_mm,
            target.speed_cms, target.angle_deg, target.track_id, target.valid
        );
        targetBuf.copy(header, offset);
        offset += 13;
    }
    
    // Radar Data - RD03D (39 bytes = 3 targets × 13 bytes)
    for (let i = 0; i < 3; i++) {
        const target = rd03d_targets[i];
        const targetBuf = createRadarTarget(
            target.x_mm, target.y_mm, target.dist_mm,
            target.speed_cms, target.angle_deg, target.track_id, target.valid
        );
        targetBuf.copy(header, offset);
        offset += 13;
    }
    
    // Verify header size
    if (offset !== header_size) {
        throw new Error(`Header size mismatch: expected ${header_size}, got ${offset}`);
    }
    
    // Create CSI data (int8_t array, 2 bytes per complex sample)
    const csi_data = Buffer.alloc(csi_data_size);
    for (let i = 0; i < csi_len; i++) {
        // Generate realistic CSI data (I and Q components)
        // Simulate realistic CSI with varying amplitude and phase
        const amplitude = Math.floor(Math.random() * 60) - 30;  // -30 to +30
        const phase = Math.floor(Math.random() * 40) - 20;      // -20 to +20
        
        csi_data.writeInt8(amplitude, i * 2);      // I component
        csi_data.writeInt8(phase, i * 2 + 1);      // Q component
    }
    
    // Combine header and CSI data
    return Buffer.concat([header, csi_data]);
}

// ============================================================================
// GENERATE SAMPLE PACKETS
// ============================================================================

console.log('Generating sample binary packets for Darwin Data Collection API...\n');

// Sample 1: Living Room with 2 active targets
const packet1 = createCSIPacket({
    room_id: ROOM_IDS.LIVING_ROOM,
    building_id: BUILDING_IDS.MAIN_OFFICE,
    seq_number: 1,
    csi_counter: 100,
    rssi: -42,
    channel: 6,
    csi_len: 128
});
fs.writeFileSync(path.join(__dirname, 'sample_packet_living_room.bin'), packet1);
console.log(`✓ Generated: sample_packet_living_room.bin (${packet1.length} bytes)`);
console.log(`  Room: Living Room, Building: Main Office`);
console.log(`  CSI Length: 128 samples, RSSI: -42 dBm\n`);

// Sample 2: Bedroom with 1 active target
const packet2 = createCSIPacket({
    rx_mac: [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF],
    room_id: ROOM_IDS.BEDROOM,
    building_id: BUILDING_IDS.RESIDENCE_1,
    seq_number: 50,
    csi_counter: 500,
    rssi: -38,
    channel: 11,
    csi_len: 256,
    ld2450_targets: [
        { x_mm: 800, y_mm: 1200, dist_mm: 1442, speed_cms: 20, angle_deg: 56.3, track_id: 5, valid: true },
        { x_mm: 0, y_mm: 0, dist_mm: 0, speed_cms: 0, angle_deg: 0, track_id: 0, valid: false },
        { x_mm: 0, y_mm: 0, dist_mm: 0, speed_cms: 0, angle_deg: 0, track_id: 0, valid: false }
    ],
    rd03d_targets: [
        { x_mm: 750, y_mm: 1100, dist_mm: 1323, speed_cms: 18, angle_deg: 55.7, track_id: 6, valid: true },
        { x_mm: 0, y_mm: 0, dist_mm: 0, speed_cms: 0, angle_deg: 0, track_id: 0, valid: false },
        { x_mm: 0, y_mm: 0, dist_mm: 0, speed_cms: 0, angle_deg: 0, track_id: 0, valid: false }
    ]
});
fs.writeFileSync(path.join(__dirname, 'sample_packet_bedroom.bin'), packet2);
console.log(`✓ Generated: sample_packet_bedroom.bin (${packet2.length} bytes)`);
console.log(`  Room: Bedroom, Building: Residence 1`);
console.log(`  CSI Length: 256 samples, RSSI: -38 dBm\n`);

// Sample 3: Office with 3 active targets (both radars)
const packet3 = createCSIPacket({
    rx_mac: [0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC],
    room_id: ROOM_IDS.OFFICE,
    building_id: BUILDING_IDS.BUILDING_A,
    seq_number: 999,
    csi_counter: 10000,
    rssi: -50,
    channel: 1,
    csi_len: 64,
    ld2450_targets: [
        { x_mm: 1500, y_mm: 500, dist_mm: 1581, speed_cms: 25, angle_deg: 18.4, track_id: 10, valid: true },
        { x_mm: -800, y_mm: 1000, dist_mm: 1281, speed_cms: -10, angle_deg: -38.7, track_id: 11, valid: true },
        { x_mm: 200, y_mm: 2000, dist_mm: 2010, speed_cms: 5, angle_deg: 5.7, track_id: 12, valid: true }
    ],
    rd03d_targets: [
        { x_mm: 1400, y_mm: 600, dist_mm: 1523, speed_cms: 22, angle_deg: 23.2, track_id: 13, valid: true },
        { x_mm: -750, y_mm: 950, dist_mm: 1211, speed_cms: -8, angle_deg: -38.3, track_id: 14, valid: true },
        { x_mm: 250, y_mm: 1900, dist_mm: 1916, speed_cms: 4, angle_deg: 7.5, track_id: 15, valid: true }
    ]
});
fs.writeFileSync(path.join(__dirname, 'sample_packet_office.bin'), packet3);
console.log(`✓ Generated: sample_packet_office.bin (${packet3.length} bytes)`);
console.log(`  Room: Office, Building: Building A`);
console.log(`  CSI Length: 64 samples, RSSI: -50 dBm\n`);

// Create a minimal packet for quick testing
const packetMinimal = createCSIPacket({
    csi_len: 32,  // Minimal CSI length
    seq_number: 1,
    csi_counter: 1
});
fs.writeFileSync(path.join(__dirname, 'sample_packet_minimal.bin'), packetMinimal);
console.log(`✓ Generated: sample_packet_minimal.bin (${packetMinimal.length} bytes)`);
console.log(`  Minimal packet for quick API testing\n`);

console.log('═════════════════════════════════════════════════════════════');
console.log('Sample packets generated successfully!');
console.log('═════════════════════════════════════════════════════════════');
console.log('\nTest with curl:');
console.log('  curl -X POST https://darwin-data-collection.vercel.app/api/radar-data \\');
console.log('    -H "Content-Type: application/octet-stream" \\');
console.log('    --data-binary @test-data/sample_packet_living_room.bin\n');
console.log('Or use the test script:');
console.log('  ./test-data/test-packet-upload.sh test-data/sample_packet_living_room.bin\n');
