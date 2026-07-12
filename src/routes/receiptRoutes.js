import express from 'express'
import multer from 'multer'
import { uploadReceipt, getReceipts } from '../controllers/receiptController.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

router.post('/upload', authMiddleware, upload.single('receipt'), uploadReceipt)

router.get('/', authMiddleware, getReceipts)

export default router
