import { register, login, logout, me } from '../controllers/authController.js'
import { authMiddleware } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimit.js'
import express from 'express'
const router = express.Router()

router.post('/register', authLimiter, register)
router.post('/login', authLimiter, login)
router.post('/logout', logout)
router.get('/me', authMiddleware, me)

export default router
