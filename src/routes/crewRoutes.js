import express from 'express'
import {
  createCrew,
  getCrews,
  updateCrew,
  deleteCrew,
} from '../controllers/crewController.js'
import { authMiddleware } from '../middleware/auth.js'
const router = express.Router()

router.post('/', authMiddleware, createCrew)
router.get('/', authMiddleware, getCrews)
router.put('/:id', authMiddleware, updateCrew)
router.delete('/:id', authMiddleware, deleteCrew)

export default router
