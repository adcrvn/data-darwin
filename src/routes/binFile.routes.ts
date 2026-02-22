import { Router, raw } from 'express'
import { getBinFiles, uploadBinFileHandler } from '@/controllers/binFile.controller'

const router = Router()

router.get('/bin-files', getBinFiles)
router.post('/bin-files/upload', raw({ type: 'application/octet-stream', limit: '20mb' }), uploadBinFileHandler)

export default router
