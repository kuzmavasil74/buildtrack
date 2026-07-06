import express from 'express'
import { createSite, getSites } from '../controllers/siteController.js'
import { authMiddleware } from '../middleware/auth.js'
const router = express.Router()

router.post('/', authMiddleware, createSite)
router.get('/', authMiddleware, getSites)

export default router
