import express from 'express'
import {
  createCrew,
  getCrews,
  updateCrew,
  deleteCrew,
} from '../controllers/crewController.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireOwner } from '../utils/permissions.js'
const router = express.Router()

router.post('/', authMiddleware, requireOwner, createCrew)
router.get('/', authMiddleware, getCrews)
router.put('/:id', authMiddleware, requireOwner, updateCrew)
router.delete('/:id', authMiddleware, requireOwner, deleteCrew)

export default router
