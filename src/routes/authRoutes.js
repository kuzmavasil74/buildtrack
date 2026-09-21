import {
  register,
  login,
  logout,
  me,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js'
import { authMiddleware } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimit.js'
import express from 'express'
const router = express.Router()

router.post('/register', authLimiter, register)
router.post('/login', authLimiter, login)
router.post('/forgot-password', authLimiter, forgotPassword)
router.post('/reset-password', authLimiter, resetPassword)
router.post('/logout', logout)
router.get('/me', authMiddleware, me)

export default router
