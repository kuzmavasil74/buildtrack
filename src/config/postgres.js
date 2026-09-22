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

export const ensureSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sites (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      user_id INTEGER NOT NULL REFERENCES users(id)
    );
    ALTER TABLE sites ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
    ALTER TABLE sites ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
    CREATE TABLE IF NOT EXISTS crews (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      members TEXT[] NOT NULL DEFAULT '{}',
      user_id INTEGER NOT NULL REFERENCES users(id)
    );
    ALTER TABLE crews ADD COLUMN IF NOT EXISTS member_rates JSONB NOT NULL DEFAULT '{}';
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens(token_hash);
  `)
}
