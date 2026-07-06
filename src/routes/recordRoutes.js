import {
  createRecord,
  getRecords,
  generateReport,
} from '../controllers/recordController.js'
import { authMiddleware } from '../middleware/auth.js'
import express from 'express'
const router = express.Router()

router.post('/', authMiddleware, createRecord)
router.get('/', authMiddleware, getRecords)
router.get('/report', authMiddleware, generateReport)
export default router
