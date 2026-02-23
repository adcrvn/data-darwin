import { Router } from 'express'
import { getOtaUpdate } from '@/controllers/ota.controller'

const router = Router()

router.get('/ota/update', getOtaUpdate)

export default router
