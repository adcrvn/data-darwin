import { NextFunction, Request, Response } from 'express'
import { getLatestFirmware } from '@/services/ota.service'

const DEVICE_TYPES = ['transmitter', 'receiver'] as const

export async function getOtaUpdate(req: Request, res: Response, next: NextFunction) {
  try {
    const device_type = req.query.device_type as string | undefined
    const current_version = req.query.current_version as string | undefined

    if (!device_type || !DEVICE_TYPES.includes(device_type as any)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid device_type. Use transmitter or receiver.',
      })
    }

    const latest = await getLatestFirmware(device_type as any, current_version)

    if (!latest) {
      return res.status(204).send()
    }

    return res.json(latest)
  } catch (error) {
    return next(error)
  }
}
