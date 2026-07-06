import express from 'express'
import recordRoutes from './routes/recordRoutes.js'
import authRoutes from './routes/authRoutes.js'
import siteRoutes from './routes/siteRoutes.js'
import cors from 'cors'

const app = express()

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  })
)
app.use(express.json())
app.use('/auth', authRoutes)
app.use('/records', recordRoutes)
app.use('/sites', siteRoutes)

export default app
