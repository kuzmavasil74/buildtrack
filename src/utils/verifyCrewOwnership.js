import { pool } from '../config/postgres.js'

// True when the crew belongs to the given company.
export const verifyCrewOwnership = async (crewId, companyId) => {
  const result = await pool.query(
    `SELECT id FROM crews WHERE id = $1 AND company_id = $2`,
    [crewId, companyId]
  )
  return result.rows.length > 0
}
