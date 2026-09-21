import express from 'express'
import cookieParser from 'cookie-parser'
import recordRoutes from './routes/recordRoutes.js'
import authRoutes from './routes/authRoutes.js'
import siteRoutes from './routes/siteRoutes.js'
import crewRoutes from './routes/crewRoutes.js'
import cors from 'cors'
import receiptRoutes from './routes/receiptRoutes.js'

const app = express()

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
)
app.use(express.json())
app.use(cookieParser())
app.use('/auth', authRoutes)
app.use('/records', recordRoutes)
app.use('/sites', siteRoutes)
app.use('/crews', crewRoutes)
app.use('/receipts', receiptRoutes)

export default app
