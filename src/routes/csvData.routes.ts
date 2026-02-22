import { Router } from 'express'
import { getCSVData } from '@/controllers/csvData.controller'

const router = Router()

router.get('/csv-data', getCSVData)

export default router
