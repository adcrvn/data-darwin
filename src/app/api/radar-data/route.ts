import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { RadarPacketSchema } from '@/types/radar'
import { parseBinaryPacket, validatePacketBuffer } from '@/lib/utils/binary-parser'
import { storeRadarReadingToCSV } from '@/lib/storage/csv-storage'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    // Read the raw binary data from request body
    const arrayBuffer = await request.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Validate buffer has minimum required data
    const validation = validatePacketBuffer(buffer)
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid packet format',
        details: validation.error,
      }, { status: 400 })
    }

    // Parse the binary packet into structured data
    const parsedPacket = parseBinaryPacket(buffer)

    // Validate the parsed data with Zod
    const validatedData = RadarPacketSchema.parse(parsedPacket)

    // Transform to database format
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

    // Insert into database
    const result = await prisma.radarReading.create({
      data: record,
    })

    // Store to CSV in Supabase storage (async, don't block response)
    storeRadarReadingToCSV(validatedData).catch(error => {
      console.error('Failed to store to CSV:', error)
      // Don't fail the request if CSV storage fails
    })

    return NextResponse.json({
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
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      }, { status: 400 })
    }

    if (error instanceof Error && error.message.includes('Invalid magic number')) {
      return NextResponse.json({
        success: false,
        error: 'Invalid packet format',
        message: error.message,
      }, { status: 400 })
    }

    console.error('Error processing radar packet:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rxMac = searchParams.get('rx_mac')
    const roomId = searchParams.get('room_id')
    const buildingId = searchParams.get('building_id')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where = {
      ...(rxMac && { rx_mac: rxMac }),
      ...(roomId && { room_id: parseInt(roomId) }),
      ...(buildingId && { building_id: parseInt(buildingId) }),
    }

    const readings = await prisma.radarReading.findMany({
      where,
      orderBy: { timestamp_ms: 'desc' },
      take: limit,
      skip: offset,
    })

    const total = await prisma.radarReading.count({ where })

    // Convert BigInt to string for JSON serialization
    const serializedReadings = readings.map(reading => ({
      ...reading,
      seq_number: reading.seq_number.toString(),
      csi_counter: reading.csi_counter.toString(),
      timestamp_ms: reading.timestamp_ms.toString(),
    }))

    return NextResponse.json({
      success: true,
      data: serializedReadings,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })

  } catch (error) {
    console.error('Error fetching radar data:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
