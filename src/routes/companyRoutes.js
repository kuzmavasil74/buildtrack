import express from 'express'
import {
  getCompany,
  updateCompany,
  createInvite,
  revokeInvite,
  previewInvite,
  acceptInvite,
  removeMember,
} from '../controllers/companyController.js'
import { authMiddleware } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimit.js'
import { requireOwner } from '../utils/permissions.js'

const router = express.Router()

router.get('/', authMiddleware, requireOwner, getCompany)
router.put('/', authMiddleware, requireOwner, updateCompany)
router.post('/invites', authMiddleware, requireOwner, createInvite)
router.delete('/invites/:id', authMiddleware, requireOwner, revokeInvite)
router.get('/invites/:token', authLimiter, previewInvite)
router.post('/invites/accept', authMiddleware, acceptInvite)
router.delete('/members/:id', authMiddleware, requireOwner, removeMember)

export default router
