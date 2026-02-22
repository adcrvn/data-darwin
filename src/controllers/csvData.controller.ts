import { NextFunction, Request, Response } from 'express'
import { fetchCSVFile, fetchCSVFilesForDate } from '@/services/csvData.service'

export async function getCSVData(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.query.building_id as string | undefined
    const roomId = req.query.room_id as string | undefined
    const date = req.query.date as string | undefined
    const hour = req.query.hour as string | undefined

    if (!buildingId || !roomId || !date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: building_id, room_id, date',
      })
    }

    const buildingIdNum = parseInt(buildingId, 10)
    const roomIdNum = parseInt(roomId, 10)

    if (hour) {
      const csvContent = await fetchCSVFile(buildingIdNum, roomIdNum, date, hour)

      if (!csvContent) {
        return res.status(404).json({
          success: false,
          error: 'CSV file not found',
        })
      }

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="${buildingId}_${roomId}_${date}_${hour}.csv"`)
      return res.status(200).send(csvContent)
    }

    const files = await fetchCSVFilesForDate(buildingIdNum, roomIdNum, date)

    return res.json({
      success: true,
      data: {
        building_id: buildingIdNum,
        room_id: roomIdNum,
        date,
        files,
      },
    })
  } catch (error) {
    return next(error)
  }
}
