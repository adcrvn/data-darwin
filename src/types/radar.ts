import { z } from 'zod'

// Radar target structure (13 bytes each)
export interface RadarTarget {
  x_mm: number          // 2 bytes - X position in millimeters
  y_mm: number          // 2 bytes - Y position in millimeters
  dist_mm: number       // 2 bytes - Distance in millimeters
  speed_cms: number     // 2 bytes - Speed in cm/s
  angle_deg_x10: number // 2 bytes - Angle in degrees * 10
  track_id: number      // 2 bytes - Track ID
  valid: boolean        // 1 byte - Valid flag (0 or 1)
}

// CSI complex sample [I, Q]
export type CsiSample = [number, number]

// Parsed radar packet structure
export interface RadarPacket {
  // Header (28 bytes fixed)
  magic: number           // 4 bytes - 0xDEADBEEF
  version: number         // 1 byte
  reserved1: number       // 1 byte
  packet_length: number   // 2 bytes
  rx_mac: string          // 6 bytes - formatted as "XX:XX:XX:XX:XX:XX"
  room_id: number         // 1 byte
  building_id: number     // 1 byte
  seq_number: bigint      // 4 bytes
  csi_counter: bigint     // 4 bytes
  timestamp_ms: bigint    // 8 bytes
  rssi: number            // 1 byte (signed)
  channel: number         // 1 byte
  csi_len: number         // 2 bytes - number of complex CSI samples
  
  // Radar targets from all sensors (flexible structure)
  radar_targets: RadarSensorData[]
  
  // CSI data (variable length: 2 * csi_len bytes)
  csi_data: CsiSample[]   // Array of [I, Q] complex samples
}

// Radar sensor data - each sensor has multiple targets
export interface RadarSensorData {
  [sensorIndex: string]: RadarTarget[]  // e.g., "0": [target1, target2, target3]
}

// Zod schema for validation
export const RadarTargetSchema = z.object({
  x_mm: z.number().int(),
  y_mm: z.number().int(),
  dist_mm: z.number().int(),
  speed_cms: z.number().int(),
  angle_deg_x10: z.number().int(),
  track_id: z.number().int(),
  valid: z.boolean(),
})

export const RadarPacketSchema = z.object({
  magic: z.number().int(),
  version: z.number().int().min(0).max(255),
  reserved1: z.number().int().min(0).max(255),
  packet_length: z.number().int().positive(),
  rx_mac: z.string().regex(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i),
  room_id: z.number().int().min(0).max(255),
  building_id: z.number().int().min(0).max(255),
  seq_number: z.bigint(),
  csi_counter: z.bigint(),
  timestamp_ms: z.bigint(),
  rssi: z.number().int().min(-128).max(127),
  channel: z.number().int().min(0).max(255),
  csi_len: z.number().int().min(0),
  radar_targets: z.array(z.record(z.string(), z.array(RadarTargetSchema))),
  csi_data: z.array(z.tuple([z.number().int(), z.number().int()])),
})

// Database record type (matches Prisma schema)
export interface RadarReadingRecord {
  id: string
  version: number
  packet_length: number
  rx_mac: string
  room_id: number
  building_id: number
  seq_number: bigint
  csi_counter: bigint
  timestamp_ms: bigint
  rssi: number
  channel: number
  csi_len: number
  radar_targets: RadarSensorData[]
  csi_data: CsiSample[]
  created_at: Date
  received_at: Date
}

export type RadarPacketInput = z.infer<typeof RadarPacketSchema>
