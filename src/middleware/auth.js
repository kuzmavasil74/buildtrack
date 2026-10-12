import jwt from 'jsonwebtoken'
import { AUTH_COOKIE_NAME } from '../config/cookie.js'
import { pool } from '../config/postgres.js'
import { needsRefresh, startSession } from '../utils/session.js'
import { isAdminEmail } from '../utils/permissions.js'

// The token only carries the user id; company and role are read fresh on every
// request, so removing someone from a company takes effect immediately.
// last_seen_at is written at most every few minutes for the admin page.
const LOAD_USER = `
  WITH seen AS (
    UPDATE users SET last_seen_at = NOW()
    WHERE id = $1 AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '5 minutes')
  )
  SELECT id, email, role, company_id FROM users WHERE id = $1`

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization
  const token =
    req.cookies?.[AUTH_COOKIE_NAME] ||
    (authHeader && authHeader.split(' ')[1])

  if (!token) {
    return res.status(401).json({ message: 'Not authorized' })
  }
  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET)
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  try {
    const { rows } = await pool.query(LOAD_USER, [decoded.id])
    const user = rows[0]
    if (!user || !user.company_id) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.company_id,
      isAdmin: isAdminEmail(user.email),
    }
    // Only cookie sessions slide; a bearer token is the caller's own business.
    if (req.cookies?.[AUTH_COOKIE_NAME] && needsRefresh(decoded)) {
      startSession(res, decoded.id)
    }
    next()
  } catch (error) {
    console.error('AUTH ERROR:', error)
    res.status(500).json({ message: 'Could not check session' })
  }
}
