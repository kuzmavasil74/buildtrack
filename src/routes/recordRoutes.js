import {
  createRecord,
  getRecords,
  generateReport,
  deleteRecord,
} from '../controllers/recordController.js'
import { authMiddleware } from '../middleware/auth.js'
import express from 'express'
const router = express.Router()

router.post('/', authMiddleware, createRecord)
router.get('/', authMiddleware, getRecords)
router.get('/report', authMiddleware, generateReport)
router.delete('/:id', authMiddleware, deleteRecord)
export default router
