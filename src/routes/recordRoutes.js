import {
  createRecord,
  getRecords,
  updateRecord,
  generateReport,
  generateCsv,
  deleteRecord,
  getMonthlyStats,
  getPayroll,
  getPayrollCsv,
} from '../controllers/recordController.js'
import { authMiddleware } from '../middleware/auth.js'
import express from 'express'
const router = express.Router()

router.post('/', authMiddleware, createRecord)
router.get('/', authMiddleware, getRecords)
router.get('/report', authMiddleware, generateReport)
router.get('/export.csv', authMiddleware, generateCsv)
router.get('/payroll', authMiddleware, getPayroll)
router.get('/payroll.csv', authMiddleware, getPayrollCsv)
router.put('/:id', authMiddleware, updateRecord)
router.delete('/:id', authMiddleware, deleteRecord)
router.get('/monthly-stats', authMiddleware, getMonthlyStats)
export default router
