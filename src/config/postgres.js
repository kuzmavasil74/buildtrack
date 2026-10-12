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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'UAH';
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

    -- Companies: every user belongs to one. The owner manages sites, crews,
    -- payroll and members; a foreman adds records and receipts.
    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      owner_id INTEGER REFERENCES users(id),
      currency TEXT NOT NULL DEFAULT 'UAH',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner';
    -- Left NULL for accounts created before it existed.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
    ALTER TABLE users ALTER COLUMN created_at SET DEFAULT NOW();
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
    ALTER TABLE sites ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
    ALTER TABLE crews ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
    CREATE INDEX IF NOT EXISTS idx_sites_company ON sites(company_id);
    CREATE INDEX IF NOT EXISTS idx_crews_company ON crews(company_id);
    CREATE TABLE IF NOT EXISTS company_invites (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'foreman',
      token_hash TEXT NOT NULL UNIQUE,
      invited_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ
    );
  `)
}

// Gives every user without a company one of their own (as owner, with their
// old currency) and stamps their sites and crews with it. Safe to run on
// every start: it only touches rows that are still missing a company.
export const ensureCompanies = async () => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: orphans } = await client.query(
      `SELECT id, email, currency FROM users WHERE company_id IS NULL ORDER BY id FOR UPDATE`
    )
    for (const user of orphans) {
      const { rows } = await client.query(
        `INSERT INTO companies (name, owner_id, currency) VALUES ($1, $2, $3) RETURNING id`,
        [defaultCompanyName(user.email), user.id, user.currency || 'UAH']
      )
      await client.query(`UPDATE users SET company_id = $1, role = 'owner' WHERE id = $2`, [
        rows[0].id,
        user.id,
      ])
    }
    for (const table of ['sites', 'crews']) {
      await client.query(
        `UPDATE ${table} t SET company_id = u.company_id FROM users u
         WHERE t.user_id = u.id AND t.company_id IS NULL`
      )
    }
    await client.query('COMMIT')
    if (orphans.length) console.log(`Companies: created ${orphans.length} for existing users`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export const defaultCompanyName = (email) => String(email || '').split('@')[0] || 'My company'
