import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { RadarPacket } from '@/types/radar'

// S3 client configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "smarthome-radar-radar-data-802738533039";

/**
 * Store radar reading as CSV in S3
 * Path structure: radar-readings/building_id/room_id/YYYY-MM-DD/HH.csv
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

    const filePath = `radar-readings/${buildingId}/${roomId}/${date}/${hour}.csv`

    // Convert packet to CSV row
    const csvRow = packetToCSVRow(packet)

    let csvContent: string

    try {
      // Try to get existing file
      const getCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: filePath,
      });

      const response = await s3Client.send(getCommand);
      const existingContent = await response.Body?.transformToString();

      if (existingContent) {
        // Append to existing file
        csvContent = existingContent + '\n' + csvRow;
      } else {
        // Create new file with header
        const header = getCSVHeader();
        csvContent = header + '\n' + csvRow;
      }
    } catch (error: any) {
      // File doesn't exist, create new file with header
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        const header = getCSVHeader();
        csvContent = header + '\n' + csvRow;
      } else {
        throw error;
      }
    }

    // Upload/update file
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filePath,
      Body: csvContent,
      ContentType: 'text/csv',
    });

    await s3Client.send(putCommand);

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
 * Retrieve CSV file from S3
 */
export async function getCSVFile(
  buildingId: number,
  roomId: number,
  date: string,
  hour: string
): Promise<string | null> {
  const filePath = `radar-readings/${buildingId}/${roomId}/${date}/${hour.padStart(2, '0')}.csv`

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filePath,
    });

    const response = await s3Client.send(command);
    return await response.Body?.transformToString() || null;
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    console.error('Error downloading from S3:', error);
    throw error;
  }
}

/**
 * List all CSV files for a specific date
 */
export async function listCSVFilesForDate(
  buildingId: number,
  roomId: number,
  date: string
): Promise<string[]> {
  const prefix = `radar-readings/${buildingId}/${roomId}/${date}/`

  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
    });

    const response = await s3Client.send(command);

    return response.Contents?.map(obj => {
      // Extract just the filename from the full key
      const parts = obj.Key?.split('/') || [];
      return parts[parts.length - 1];
    }).filter(Boolean) || [];
  } catch (error) {
    console.error('Error listing files from S3:', error);
    return [];
  }
}
