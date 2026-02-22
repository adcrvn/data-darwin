import { NextFunction, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { fetchRadarReadings, ingestRadarPacket } from '@/services/radarReading.service'

export async function postRadarData(req: Request, res: Response, next: NextFunction) {
  try {
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body)
    const result = await ingestRadarPacket(buffer)

    if (!result.ok) {
      return res.status(result.status).json(result.body)
    }

    return res.status(result.status).json(result.body)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return next({ status: 400, message: 'Database error', details: error.message })
    }

    if (error instanceof Error && error.message.includes('Invalid magic number')) {
      return next({ status: 400, message: 'Invalid packet format', details: error.message })
    }

    return next(error)
  }
}

export async function getRadarData(req: Request, res: Response, next: NextFunction) {
  try {
    const rx_mac = req.query.rx_mac as string | undefined
    const room_id = req.query.room_id ? parseInt(req.query.room_id as string, 10) : undefined
    const building_id = req.query.building_id ? parseInt(req.query.building_id as string, 10) : undefined
    const limit = parseInt((req.query.limit as string | undefined) || '100', 10)
    const offset = parseInt((req.query.offset as string | undefined) || '0', 10)

    const response = await fetchRadarReadings({
      rx_mac,
      room_id,
      building_id,
      limit,
      offset,
    })

    return res.json(response)
  } catch (error) {
    return next(error)
  }
}
