import { pool } from '../config/postgres.js'
import DailyRecord from '../models/DailyRecord.js'
import Receipt from '../models/Receipt.js'

const countsByUser = async (Model) => {
  const rows = await Model.aggregate([
    { $group: { _id: '$userId', count: { $sum: 1 }, last: { $max: '$_id' } } },
  ])
  // An ObjectId carries its creation time: the latest one is the last entry.
  return new Map(rows.map((row) => [row._id, { count: row.count, lastAt: row.last?.getTimestamp() }]))
}

// Site-wide numbers for the admin page: who signed up, who is active and how
// much each person has entered. Only emails and counts, never the data itself.
export const getAdminStats = async (req, res) => {
  try {
    const [users, companies, sites, records, receipts] = await Promise.all([
      pool.query(
        `SELECT u.id, u.email, u.role, u.created_at, u.last_seen_at, u.company_id, c.name AS company_name
         FROM users u LEFT JOIN companies c ON c.id = u.company_id
         ORDER BY u.last_seen_at DESC NULLS LAST, u.id`
      ),
      pool.query(`SELECT COUNT(*)::int AS n FROM companies c WHERE EXISTS (SELECT 1 FROM users u WHERE u.company_id = c.id)`),
      pool.query(`SELECT company_id, COUNT(*)::int AS n FROM sites GROUP BY company_id`),
      countsByUser(DailyRecord),
      countsByUser(Receipt),
    ])
    const sitesByCompany = new Map(sites.rows.map((row) => [row.company_id, row.n]))
    const now = Date.now()
    const activeWithin = (days) =>
      users.rows.filter((u) => u.last_seen_at && now - new Date(u.last_seen_at) < days * 86400000).length

    const list = users.rows.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      company: u.company_name,
      createdAt: u.created_at,
      lastSeenAt: u.last_seen_at,
      companySites: sitesByCompany.get(u.company_id) || 0,
      records: records.get(u.id)?.count || 0,
      lastRecordAt: records.get(u.id)?.lastAt || null,
      receipts: receipts.get(u.id)?.count || 0,
    }))

    res.status(200).json({
      totals: {
        users: users.rows.length,
        companies: companies.rows[0].n,
        active7d: activeWithin(7),
        active30d: activeWithin(30),
        records: list.reduce((sum, u) => sum + u.records, 0),
        receipts: list.reduce((sum, u) => sum + u.receipts, 0),
      },
      users: list,
    })
  } catch (error) {
    console.error('ADMIN STATS ERROR:', error)
    res.status(500).json({ message: 'Could not load stats' })
  }
}
