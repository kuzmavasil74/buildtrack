import { connectDB } from './config/mongo.js'
import app from './app.js'
import dotenv from 'dotenv'

dotenv.config()
const start = async () => {
  await connectDB()
  app.listen(process.env.PORT, () => {
    console.log(`Server is listening on port ${process.env.PORT}`)
  })
}
start()
