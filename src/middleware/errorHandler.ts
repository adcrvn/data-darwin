import { NextFunction, Request, Response } from 'express'

export function notFoundHandler(_req: Request, res: Response) {
  return res.status(404).json({
    success: false,
    error: 'Not found',
  })
}

// Centralized error handler to avoid leaking stack traces
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const method = req.method
  const path = req.originalUrl

  if (err instanceof Error) {
    console.error(`Unhandled error ${method} ${path}:`, err.message, err.stack)
  } else {
    console.error(`Unhandled error ${method} ${path}:`, err)
  }

  const status =
    typeof err === 'object' && err !== null && 'status' in err && typeof (err as any).status === 'number'
      ? (err as any).status
      : 500

  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Internal server error'

  return res.status(status).json({
    success: false,
    error: message,
  })
}
