import { supabase } from './supabase-storage'
import { RadarPacket } from '@/types/radar'

/**
 * Store radar reading as CSV in Supabase storage
 * Path structure: building_id/room_id/YYYY-MM-DD/HH.csv
 */
export async function storeRadarReadingToCSV(packet: RadarPacket): Promise<void> {
  try {
    // Use current time (received_at) for folder structure, not the packet timestamp
    const timestamp = new Date()
    
    // Build path components
    const buildingId = packet.building_id.toString()
    const roomId = packet.room_id.toString()
    const date = timestamp.toISOString().split('T')[0] // YYYY-MM-DD
    const hour = timestamp.getUTCHours().toString().padStart(2, '0') // HH
    
    const filePath = `${buildingId}/${roomId}/${date}/${hour}.csv`
    
    // Convert packet to CSV row
    const csvRow = packetToCSVRow(packet)
    
    // Check if file exists
    const { data: existingFile, error: downloadError } = await supabase.storage
      .from('radar-readings')
      .download(filePath)
    
    let csvContent: string
    
    if (existingFile) {
      // Append to existing file
      const existingContent = await existingFile.text()
      csvContent = existingContent + '\n' + csvRow
    } else {
      // Create new file with header
      const header = getCSVHeader()
      csvContent = header + '\n' + csvRow
    }
    
    // Upload/update file
    const { error: uploadError } = await supabase.storage
      .from('radar-readings')
      .upload(filePath, new Blob([csvContent], { type: 'text/csv' }), {
        upsert: true,
        contentType: 'text/csv'
      })
    
    if (uploadError) {
      console.error('Error uploading to Supabase storage:', uploadError)
      throw uploadError
    }
    
  } catch (error) {
    console.error('Error storing radar reading to CSV:', error)
    throw error
  }
}

/**
 * Get CSV header row
 */
function getCSVHeader(): string {
  return [
    'timestamp_ms',
    'rx_mac',
    'room_id',
    'building_id',
    'seq_number',
    'csi_counter',
    'version',
    'packet_length',
    'rssi',
    'channel',
    'csi_len',
    'radar_targets',
    'csi_data'
  ].join(',')
}

/**
 * Convert radar packet to CSV row
 */
function packetToCSVRow(packet: RadarPacket): string {
  const values = [
    packet.timestamp_ms.toString(),
    `"${packet.rx_mac}"`,
    packet.room_id.toString(),
    packet.building_id.toString(),
    packet.seq_number.toString(),
    packet.csi_counter.toString(),
    packet.version.toString(),
    packet.packet_length.toString(),
    packet.rssi.toString(),
    packet.channel.toString(),
    packet.csi_len.toString(),
    `"${JSON.stringify(packet.radar_targets).replace(/"/g, '""')}"`, // Escape quotes
    `"${JSON.stringify(packet.csi_data).replace(/"/g, '""')}"` // Escape quotes
  ]
  
  return values.join(',')
}

/**
 * Retrieve CSV file from storage
 */
export async function getCSVFile(
  buildingId: number,
  roomId: number,
  date: string,
  hour: string
): Promise<string | null> {
  const filePath = `${buildingId}/${roomId}/${date}/${hour.padStart(2, '0')}.csv`
  
  const { data, error } = await supabase.storage
    .from('radar-readings')
    .download(filePath)
  
  if (error) {
    console.error('Error downloading from Supabase storage:', error)
    return null
  }
  
  return await data.text()
}

/**
 * List all CSV files for a specific date
 */
export async function listCSVFilesForDate(
  buildingId: number,
  roomId: number,
  date: string
): Promise<string[]> {
  const prefix = `${buildingId}/${roomId}/${date}/`
  
  const { data, error } = await supabase.storage
    .from('radar-readings')
    .list(prefix)
  
  if (error) {
    console.error('Error listing files from Supabase storage:', error)
    return []
  }
  
  return data?.map(file => file.name) || []
}
