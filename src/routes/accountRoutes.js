import express from 'express'
import { exportAccount, deleteAccount } from '../controllers/accountController.js'
import { authMiddleware } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimit.js'

const router = express.Router()

router.get('/export', authMiddleware, exportAccount)
router.delete('/', authLimiter, authMiddleware, deleteAccount)

export default router
