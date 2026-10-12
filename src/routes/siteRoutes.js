import express from 'express'
import {
  createSite,
  getSites,
  updateSite,
  deleteSite,
} from '../controllers/siteController.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireOwner } from '../utils/permissions.js'
const router = express.Router()

router.post('/', authMiddleware, requireOwner, createSite)
router.get('/', authMiddleware, getSites)
router.put('/:id', authMiddleware, requireOwner, updateSite)
router.delete('/:id', authMiddleware, requireOwner, deleteSite)

export default router
