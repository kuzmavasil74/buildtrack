import crypto from 'crypto'
import { pool } from '../config/postgres.js'

export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

export const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex')

export const newInviteToken = () => crypto.randomBytes(32).toString('hex')

export const inviteUrl = (token) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/$/, '')
  return `${frontendUrl}/invite?token=${token}`
}

// Why an invite cannot be used, or null when it can.
export const inviteProblem = (invite, now = new Date()) => {
  if (!invite) return 'not_found'
  if (invite.revoked_at) return 'revoked'
  if (invite.accepted_at) return 'used'
  if (new Date(invite.expires_at) < now) return 'expired'
  return null
}

export const findInvite = async (token, db = pool) => {
  const { rows } = await db.query(
    `SELECT i.*, c.name AS company_name FROM company_invites i
     JOIN companies c ON c.id = i.company_id
     WHERE i.token_hash = $1`,
    [hashToken(token)]
  )
  return rows[0] || null
}
