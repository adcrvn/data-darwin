import { Router, raw } from 'express'
import { getRadarData, postRadarData } from '@/controllers/radarReading.controller'

const router = Router()

router.post('/radar-data', raw({ type: 'application/octet-stream', limit: '5mb' }), postRadarData)
router.get('/radar-data', getRadarData)

export default router
