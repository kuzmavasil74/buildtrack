import { pool } from '../config/postgres.js'

export const verifySiteOwnership = async (siteId, userId) => {
  const result = await pool.query(
    `SELECT id FROM sites WHERE id = $1 AND user_id = $2`,
    [siteId, userId]
  )
  return result.rows.length > 0
}
