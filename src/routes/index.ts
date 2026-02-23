import { Router } from 'express'
import healthzRoutes from './healthz.routes'
import radarReadingRoutes from './radarReading.routes'
import csvDataRoutes from './csvData.routes'
import binFileRoutes from './binFile.routes'
import otaRoutes from './ota.routes'

const router = Router()

router.use(healthzRoutes)
router.use(radarReadingRoutes)
router.use(csvDataRoutes)
router.use(binFileRoutes)
router.use(otaRoutes)

export default router
