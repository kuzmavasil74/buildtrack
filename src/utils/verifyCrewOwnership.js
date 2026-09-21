import { pool } from '../config/postgres.js'

export const verifyCrewOwnership = async (crewId, userId) => {
  const result = await pool.query(
    `SELECT id FROM crews WHERE id = $1 AND user_id = $2`,
    [crewId, userId]
  )
  return result.rows.length > 0
}
