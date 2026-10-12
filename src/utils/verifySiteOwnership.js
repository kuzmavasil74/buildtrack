import { pool } from '../config/postgres.js'

// True when the site belongs to the given company.
export const verifySiteOwnership = async (siteId, companyId) => {
  const result = await pool.query(
    `SELECT id FROM sites WHERE id = $1 AND company_id = $2`,
    [siteId, companyId]
  )
  return result.rows.length > 0
}
