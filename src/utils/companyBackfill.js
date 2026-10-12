import { pool } from '../config/postgres.js'
import DailyRecord from '../models/DailyRecord.js'
import Receipt from '../models/Receipt.js'

// Records and receipts written before companies existed only carry a userId.
// Stamp them with that user's company; documents that already have one are
// left alone, so records a foreman made in another company stay there.
export const backfillMongoCompanies = async () => {
  const { rows } = await pool.query(
    `SELECT id, company_id FROM users WHERE company_id IS NOT NULL`
  )
  let updated = 0
  for (const { id, company_id: companyId } of rows) {
    const filter = { userId: id, companyId: { $exists: false } }
    const update = { $set: { companyId } }
    const [records, receipts] = await Promise.all([
      DailyRecord.updateMany(filter, update),
      Receipt.updateMany(filter, update),
    ])
    updated += records.modifiedCount + receipts.modifiedCount
  }
  if (updated) console.log(`Companies: stamped ${updated} records/receipts`)
}
