import { createRecord, getRecords } from '../controllers/recordController.js'
import { authMiddleware } from '../middleware/auth.js'
import express from 'express'
const router = express.Router()

router.post('/', authMiddleware, createRecord)
router.get('/', authMiddleware, getRecords)
export default router
