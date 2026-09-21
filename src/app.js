import express from 'express'
import cookieParser from 'cookie-parser'
import recordRoutes from './routes/recordRoutes.js'
import authRoutes from './routes/authRoutes.js'
import siteRoutes from './routes/siteRoutes.js'
import crewRoutes from './routes/crewRoutes.js'
import cors from 'cors'
import receiptRoutes from './routes/receiptRoutes.js'

const app = express()

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.FRONTEND_URL,
].filter(Boolean)

app.use(
  cors({
    origin(origin, callback) {
      // allow non-browser clients (curl/Postman) and any whitelisted origin
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`))
      }
    },
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
