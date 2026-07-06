import express from 'express'
import { getUploadUrl } from '../controllers/receiptController.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

router.post('/upload-url', authMiddleware, getUploadUrl)

export default router
