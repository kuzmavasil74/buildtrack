import express from 'express'
import recordRoutes from './routes/recordRoutes.js'
import authRoutes from './routes/authRoutes.js'
import cors from 'cors'

const app = express()

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://buildtrack-frontend-ten.vercel.app',
    ],
  })
)
app.use(express.json())
app.use('/auth', authRoutes)
app.use('/records', recordRoutes)

export default app
