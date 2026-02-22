import { Router } from 'express'
import { getHealth, getLatestReading } from '@/controllers/healthz.controller'

const router = Router()

// Health check endpoint
router.get('/healthz', getHealth)

// Liveness check endpoint
router.get('/healthz/latest-reading', getLatestReading)

export default router
