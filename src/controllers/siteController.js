import { pool } from '../config/postgres.js'

export const createSite = async (req, res) => {
  const { name, address } = req.body
  const userId = req.user.id
  try {
    const site = await pool.query(
      `INSERT INTO sites (name, address, user_id) VALUES ($1, $2, $3) RETURNING *`,
      [name, address, userId]
    )
    const siteId = site.rows[0].id
    res.status(201).json({ message: 'Site created successfully', siteId })
  } catch (error) {
    res.status(500).json({ message: 'Error creating site' })
  }
}
export const getSites = async (req, res) => {
  const userId = req.user.id
  try {
    const sites = await pool.query(`SELECT * FROM sites WHERE user_id = $1`, [
      userId,
    ])
    res.status(200).json({ sites: sites.rows })
  } catch (error) {
    res.status(500).json({ message: 'Error getting sites' })
  }
}
export const deleteSite = async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  try {
    await pool.query(`DELETE FROM sites WHERE id = $1 AND user_id = $2`, [
      id,
      userId,
    ])
    res.status(200).json({ message: 'Site deleted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Error deleting site' })
  }
}
