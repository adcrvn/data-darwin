import { RadarPacket, RadarTarget, RadarSensorData } from '@/types/radar'

/**
 * Parse binary radar packet into structured data
 * 
 * NEW PROTOCOL - Matches C code (csi_protocol.h):
 * 
 * HEADER (114 bytes total):
 * - Magic (4 bytes): 0xDEADBEEF
 * - Version (1 byte)
 * - Reserved1 (1 byte)
 * - Packet Length (2 bytes, little-endian) = 114 + (csi_len × 2)
 * - RX MAC (6 bytes)
 * - Room ID (1 byte)
 * - Building ID (1 byte)
 * - Sequence Number (4 bytes, little-endian)
 * - CSI Counter (4 bytes, little-endian)
 * - Timestamp MS (8 bytes, little-endian)
 * - RSSI (1 byte, signed)
 * - Channel (1 byte)
 * - CSI Length (2 bytes, little-endian)
 * - LD2450 Radar Targets (39 bytes = 3 targets × 13 bytes)
 * - RD03D Radar Targets (39 bytes = 3 targets × 13 bytes)
 * 
 * CSI DATA (variable length):
 * - CSI Data (csi_len × 2 bytes, int8_t array [I, Q, I, Q, ...])
 */
export function parseBinaryPacket(buffer: Buffer): RadarPacket {
  let offset = 0

  // Helper: read little-endian unsigned integers
  const readUInt8 = () => buffer.readUInt8(offset++)
  const readInt16LE = () => {
    const val = buffer.readInt16LE(offset)
    offset += 2
    return val
  }
  const readUInt16LE = () => {
    const val = buffer.readUInt16LE(offset)
    offset += 2
    return val
  }
  const readUInt32LE = () => {
    const val = buffer.readUInt32LE(offset)
    offset += 4
    return val
  }
  const readUInt64LE = () => {
    const val = buffer.readBigUInt64LE(offset)
    offset += 8
    return val
  }
  const readInt8 = () => buffer.readInt8(offset++)

  // === SYNCHRONIZATION & VERSION (8 bytes) ===
  
  // Magic number (4 bytes)
  const magic = readUInt32LE()
  if (magic !== 0xDEADBEEF) {
    throw new Error(`Invalid magic number: 0x${magic.toString(16).toUpperCase()} (expected 0xDEADBEEF)`)
  }

  // Version, reserved, packet length
  const version = readUInt8()
  const reserved1 = readUInt8()
  const packet_length = readUInt16LE()

  // === DEVICE IDENTIFICATION (8 bytes) ===
  
  // RX MAC (6 bytes) - format as XX:XX:XX:XX:XX:XX
  const macBytes = []
  for (let i = 0; i < 6; i++) {
    macBytes.push(readUInt8().toString(16).toUpperCase().padStart(2, '0'))
  }
  const rx_mac = macBytes.join(':')

  // Room and building IDs
  const room_id = readUInt8()
  const building_id = readUInt8()

  // === SEQUENCE & TIMING (16 bytes) ===
  
  // Sequence number and CSI counter (32-bit)
  const seq_number = BigInt(readUInt32LE())
  const csi_counter = BigInt(readUInt32LE())

  // Timestamp (64-bit)
  const timestamp_ms = readUInt64LE()

  // === WIFI CSI METADATA (4 bytes) ===
  
  // RSSI (signed), channel, CSI length
  const rssi = readInt8()
  const channel = readUInt8()
  const csi_len = readUInt16LE()

  // === RADAR TARGETS - FIXED STRUCTURE (78 bytes total) ===
  
  const parseRadarTarget = (): RadarTarget => {
    const x_mm = readInt16LE()         // Signed 16-bit
    const y_mm = readInt16LE()         // Signed 16-bit
    const dist_mm = readUInt16LE()     // Unsigned 16-bit
    const speed_cms = readInt16LE()    // Signed 16-bit
    const angle_deg_x10 = readInt16LE() // Signed 16-bit (angle × 10)
    const track_id = readUInt16LE()    // Unsigned 16-bit
    const valid_byte = readUInt8()     // Valid flag (1 = valid, 0 = invalid)

    // Target is valid based on the valid byte from C code
    const valid = valid_byte === 1

    return { x_mm, y_mm, dist_mm, speed_cms, angle_deg_x10, track_id, valid }
  }

  // LD2450 Radar Targets (3 targets × 13 bytes = 39 bytes)
  const ld2450_targets: RadarTarget[] = []
  for (let i = 0; i < 3; i++) {
    ld2450_targets.push(parseRadarTarget())
  }

  // RD03D Radar Targets (3 targets × 13 bytes = 39 bytes)
  const rd03d_targets: RadarTarget[] = []
  for (let i = 0; i < 3; i++) {
    rd03d_targets.push(parseRadarTarget())
  }

  // Combine radar targets in format expected by database
  // Sensor 0 = LD2450, Sensor 1 = RD03D
  const radar_targets: RadarSensorData[] = [
    { '0': ld2450_targets },
    { '1': rd03d_targets }
  ]

  // === CSI DATA (csi_len × 2 bytes) ===
  
  const csi_data: [number, number][] = []
  for (let i = 0; i < csi_len; i++) {
    const I = readInt8() // I component (signed)
    const Q = readInt8() // Q component (signed)
    csi_data.push([I, Q])
  }

  // Validate buffer was fully consumed
  const expectedLength = 114 + (csi_len * 2)
  if (buffer.length !== expectedLength) {
    console.warn(`Buffer length mismatch: received ${buffer.length} bytes, expected ${expectedLength} bytes (header: 114, CSI data: ${csi_len * 2})`)
  }

  return {
    magic,
    version,
    reserved1,
    packet_length,
    rx_mac,
    room_id,
    building_id,
    seq_number,
    csi_counter,
    timestamp_ms,
    rssi,
    channel,
    csi_len,
    radar_targets,
    csi_data,
  }
}

/**
 * Format MAC address from byte array
 */
export function formatMacAddress(bytes: number[]): string {
  return bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(':')
}

/**
 * Validate packet structure before parsing
 * Updated for new 114-byte header protocol
 */
export function validatePacketBuffer(buffer: Buffer): { valid: boolean; error?: string } {
  const HEADER_SIZE = 114
  
  if (buffer.length < HEADER_SIZE) {
    return { valid: false, error: `Buffer too small: ${buffer.length} bytes (minimum ${HEADER_SIZE} bytes for header)` }
  }

  const magic = buffer.readUInt32LE(0)
  if (magic !== 0xDEADBEEF) {
    return { valid: false, error: `Invalid magic number: 0x${magic.toString(16).toUpperCase()}` }
  }

  const packet_length = buffer.readUInt16LE(6)
  if (buffer.length !== packet_length) {
    return { valid: false, error: `Buffer size mismatch: ${buffer.length} bytes, expected ${packet_length} bytes` }
  }
  
  // Validate packet length is reasonable (header + at least some CSI data)
  if (packet_length < HEADER_SIZE) {
    return { valid: false, error: `Invalid packet length: ${packet_length} (must be at least ${HEADER_SIZE} bytes)` }
  }

  return { valid: true }
}
