import express from 'express'
import {
  createSite,
  getSites,
  updateSite,
  deleteSite,
} from '../controllers/siteController.js'
import { authMiddleware } from '../middleware/auth.js'
const router = express.Router()

router.post('/', authMiddleware, createSite)
router.get('/', authMiddleware, getSites)
router.put('/:id', authMiddleware, updateSite)
router.delete('/:id', authMiddleware, deleteSite)

export default router
