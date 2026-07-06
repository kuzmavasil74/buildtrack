import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()
console.log('Pool connectionString:', process.env.DATABASE_URL ? 'set' : 'undefined')
const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
})
