import { connectDB } from './config/mongo.js'
import { ensureSchema, ensureCompanies } from './config/postgres.js'
import { backfillMongoCompanies } from './utils/companyBackfill.js'
import app from './app.js'
import dotenv from 'dotenv'

dotenv.config()
const start = async () => {
  await connectDB()
  await ensureSchema()
  await ensureCompanies()
  await backfillMongoCompanies()
  app.listen(process.env.PORT, () => {
    console.log(`Server is listening on port ${process.env.PORT}`)
  })
}
start()
