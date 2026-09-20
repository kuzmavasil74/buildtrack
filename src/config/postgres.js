import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()
console.log('Pool connectionString:', process.env.DATABASE_URL ? 'set' : 'undefined')
const { Pool } = pg

const sslEnabled = Boolean(process.env.DATABASE_URL) && process.env.PGSSL !== 'disable'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
})
