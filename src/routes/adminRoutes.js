import express from 'express'
import { getAdminStats } from '../controllers/adminController.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireAdmin } from '../utils/permissions.js'

const router = express.Router()

router.get('/stats', authMiddleware, requireAdmin, getAdminStats)

export default router
