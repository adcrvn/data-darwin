import { NextFunction, Request, Response } from 'express'
import { checkHealth, getLatestReadingsPerDevice } from '@/services/healthz.service'

export async function getHealth(req: Request, res: Response) {
  try {
    const result = await checkHealth()
    return res.status(200).json(result)
  } catch (error) {
    return res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export async function getLatestReading(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getLatestReadingsPerDevice()
    return res.json({ success: true, data })
  } catch (error) {
    return next(error)
  }
}
