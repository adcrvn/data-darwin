import { NextFunction, Request, Response } from 'express'
import { fetchBinFileByName, fetchBinFiles, fetchLatestBinFile, uploadBinaryFile } from '@/services/binFile.service'

export async function getBinFiles(req: Request, res: Response, next: NextFunction) {
  try {
    const fileNameParam = (req.query.name as string | undefined)?.trim()
    const latest = req.query.latest === 'true'
    const download = req.query.download === 'true'
    const limit = parseInt((req.query.limit as string | undefined) || '50', 10)
    const offset = parseInt((req.query.offset as string | undefined) || '0', 10)

    if (latest) {
      const latestFile = await fetchLatestBinFile(fileNameParam)

      if (!latestFile) {
        return res.status(404).json({
          error: fileNameParam ? `No firmware found for device: ${fileNameParam}` : 'No files found',
        })
      }

      if (download) {
        const fileData = await fetchBinFileByName(latestFile.name)
        if (!fileData) {
          return res.status(404).json({ error: 'File not found' })
        }
        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader('Content-Disposition', `attachment; filename="${latestFile.name}"`)
        res.setHeader('Content-Length', fileData.length.toString())
        return res.send(Buffer.from(fileData))
      }

      return res.json({ success: true, data: latestFile })
    }

    if (fileNameParam) {
      let fileData = await fetchBinFileByName(fileNameParam)
      let resolvedName = fileNameParam

      if (!fileData) {
        const allFiles = await fetchBinFiles(100, 0)
        const match = allFiles.find((f) => f.name.toLowerCase().includes(fileNameParam.toLowerCase()))
        if (match) {
          fileData = await fetchBinFileByName(match.name)
          resolvedName = match.name
        }
      }

      if (!fileData) {
        return res.status(404).json({ error: 'File not found' })
      }

      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="${resolvedName}"`)
      res.setHeader('Content-Length', fileData.length.toString())
      return res.send(Buffer.from(fileData))
    }

    const files = await fetchBinFiles(limit, offset)

    return res.json({
      success: true,
      data: files,
      pagination: {
        limit,
        offset,
        count: files.length,
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function uploadBinFileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body)

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Empty file received' })
    }

    const filename =
      (req.query.filename as string | null) ||
      req.headers['x-filename']?.toString() ||
      undefined

    const disableOTAParser = req.query.disableOTAParser === 'true'

    const result = await uploadBinaryFile(buffer, filename, !disableOTAParser)

    return res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        fileName: result.fileName,
        filePath: result.filePath,
        size: buffer.length,
        version: result.metadata?.version,
        projectName: result.metadata?.projectName,
      },
    })
  } catch (error) {
    return next(error)
  }
}
