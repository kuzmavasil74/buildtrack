import { pool } from '../config/postgres.js'

const parseCoordinate = (value) =>
  value === '' || value == null ? null : Number(value)

export const createSite = async (req, res) => {
  const { name, address, latitude, longitude } = req.body
  const userId = req.user.id

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'Site name is required' })
  }

  const lat = parseCoordinate(latitude)
  const lng = parseCoordinate(longitude)
  if ((lat !== null && !Number.isFinite(lat)) || (lng !== null && !Number.isFinite(lng))) {
    return res.status(400).json({ message: 'Invalid coordinates' })
  }

  try {
    const site = await pool.query(
      `INSERT INTO sites (name, address, latitude, longitude, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, address, lat, lng, userId]
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
export const updateSite = async (req, res) => {
  const { id } = req.params
  const { name, address, latitude, longitude } = req.body
  const userId = req.user.id

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'Site name is required' })
  }

  const lat = parseCoordinate(latitude)
  const lng = parseCoordinate(longitude)
  if ((lat !== null && !Number.isFinite(lat)) || (lng !== null && !Number.isFinite(lng))) {
    return res.status(400).json({ message: 'Invalid coordinates' })
  }

  try {
    const site = await pool.query(
      `UPDATE sites SET name = $1, address = $2, latitude = $3, longitude = $4
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [name, address, lat, lng, id, userId]
    )
    if (site.rows.length === 0) {
      return res.status(404).json({ message: 'Site not found' })
    }
    res.status(200).json({ message: 'Site updated successfully', site: site.rows[0] })
  } catch (error) {
    res.status(500).json({ message: 'Error updating site' })
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
