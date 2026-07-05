import express from 'express'
import recordRoutes from './routes/recordRoutes.js'
import authRoutes from './routes/authRoutes.js'

const app = express()
app.use(express.json())
app.use('/auth', authRoutes)
app.use('/records', recordRoutes)

export default app
