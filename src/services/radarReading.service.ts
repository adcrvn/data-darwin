import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { parseBinaryPacket, validatePacketBuffer } from '@/lib/utils/binary-parser'
import { RadarPacketSchema } from '@/types/radar'
import { storeRadarReadingToCSV } from '@/lib/storage/csv-storage'

export interface RadarQueryParams {
  rx_mac?: string
  room_id?: number
  building_id?: number
  limit: number
  offset: number
}

export async function ingestRadarPacket(buffer: Buffer) {
  const validation = validatePacketBuffer(buffer)
  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        error: 'Invalid packet format',
        details: validation.error,
      },
    } as const
  }

  const parsedPacket = parseBinaryPacket(buffer)
  const validatedData = RadarPacketSchema.parse(parsedPacket)

  const record = {
    version: validatedData.version,
    packet_length: validatedData.packet_length,
    rx_mac: validatedData.rx_mac,
    room_id: validatedData.room_id,
    building_id: validatedData.building_id,
    seq_number: validatedData.seq_number,
    csi_counter: validatedData.csi_counter,
    timestamp_ms: validatedData.timestamp_ms,
    rssi: validatedData.rssi,
    channel: validatedData.channel,
    csi_len: validatedData.csi_len,
    radar_targets: validatedData.radar_targets as unknown as Prisma.InputJsonValue,
    csi_data: validatedData.csi_data as unknown as Prisma.InputJsonValue,
  }

  const result = await prisma.radarReading.create({ data: record })

  storeRadarReadingToCSV(validatedData).catch((error) => {
    console.error('Failed to store to CSV:', error)
  })

  return {
    ok: true,
    status: 201,
    body: {
      success: true,
      id: result.id,
      message: 'Successfully processed radar packet',
      data: {
        rx_mac: validatedData.rx_mac,
        timestamp_ms: validatedData.timestamp_ms.toString(),
        seq_number: validatedData.seq_number.toString(),
        room_id: validatedData.room_id,
        building_id: validatedData.building_id,
      },
    },
  } as const
}

export async function fetchRadarReadings(params: RadarQueryParams) {
  const { rx_mac, room_id, building_id, limit, offset } = params

  const where = {
    ...(rx_mac && { rx_mac }),
    ...(typeof room_id === 'number' && { room_id }),
    ...(typeof building_id === 'number' && { building_id }),
  }

  const readings = await prisma.radarReading.findMany({
    where,
    orderBy: { timestamp_ms: 'desc' },
    take: limit,
    skip: offset,
  })

  const total = await prisma.radarReading.count({ where })

  const serializedReadings = readings.map((reading) => ({
    ...reading,
    seq_number: reading.seq_number.toString(),
    csi_counter: reading.csi_counter.toString(),
    timestamp_ms: reading.timestamp_ms.toString(),
  }))

  return {
    success: true,
    data: serializedReadings,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  }
}
