import { pool } from '../config/postgres.js'

const normalizeMembers = (members, memberRates) => {
  const cleanMembers = members
    .map((m) => (typeof m === 'string' ? m.trim() : ''))
    .filter(Boolean)

  const cleanRates = {}
  if (memberRates && typeof memberRates === 'object') {
    for (const name of cleanMembers) {
      const rate = Number(memberRates[name])
      cleanRates[name] = Number.isFinite(rate) && rate >= 0 ? rate : 0
    }
  }

  return { cleanMembers, cleanRates }
}

export const createCrew = async (req, res) => {
  const { name, members, memberRates } = req.body
  const userId = req.user.id

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'Crew name is required' })
  }
  if (!Array.isArray(members)) {
    return res.status(400).json({ message: 'members must be an array of names' })
  }

  try {
    const { cleanMembers, cleanRates } = normalizeMembers(members, memberRates)

    const crew = await pool.query(
      `INSERT INTO crews (name, members, member_rates, user_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, cleanMembers, cleanRates, userId]
    )
    res.status(201).json({ message: 'Crew created successfully', crew: crew.rows[0] })
  } catch (error) {
    console.error('CREATE CREW ERROR:', error)
    res.status(500).json({ message: 'Error creating crew' })
  }
}

export const updateCrew = async (req, res) => {
  const { id } = req.params
  const { name, members, memberRates } = req.body
  const userId = req.user.id

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'Crew name is required' })
  }
  if (!Array.isArray(members)) {
    return res.status(400).json({ message: 'members must be an array of names' })
  }

  try {
    const { cleanMembers, cleanRates } = normalizeMembers(members, memberRates)

    const crew = await pool.query(
      `UPDATE crews SET name = $1, members = $2, member_rates = $3 WHERE id = $4 AND user_id = $5 RETURNING *`,
      [name, cleanMembers, cleanRates, id, userId]
    )
    if (crew.rows.length === 0) {
      return res.status(404).json({ message: 'Crew not found' })
    }
    res.status(200).json({ message: 'Crew updated successfully', crew: crew.rows[0] })
  } catch (error) {
    console.error('UPDATE CREW ERROR:', error)
    res.status(500).json({ message: 'Error updating crew' })
  }
}

export const getCrews = async (req, res) => {
  const userId = req.user.id
  try {
    const crews = await pool.query(`SELECT * FROM crews WHERE user_id = $1`, [
      userId,
    ])
    res.status(200).json({ crews: crews.rows })
  } catch (error) {
    res.status(500).json({ message: 'Error getting crews' })
  }
}

export const deleteCrew = async (req, res) => {
  const { id } = req.params
  const userId = req.user.id
  try {
    await pool.query(`DELETE FROM crews WHERE id = $1 AND user_id = $2`, [
      id,
      userId,
    ])
    res.status(200).json({ message: 'Crew deleted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Error deleting crew' })
  }
}
