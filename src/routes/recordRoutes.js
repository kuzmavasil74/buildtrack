import {
  createRecord,
  getRecords,
  generateReport,
  deleteRecord,
  getMonthlyStats,
} from '../controllers/recordController.js'
import { authMiddleware } from '../middleware/auth.js'
import express from 'express'
const router = express.Router()

router.post('/', authMiddleware, createRecord)
router.get('/', authMiddleware, getRecords)
router.get('/report', authMiddleware, generateReport)
router.delete('/:id', authMiddleware, deleteRecord)
router.get('/monthly-stats', authMiddleware, getMonthlyStats)
export default router
