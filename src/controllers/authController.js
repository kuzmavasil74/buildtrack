import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { pool } from '../config/postgres.js'
import dotenv from 'dotenv'

dotenv.config()

export const register = async (req, res) => {
  console.log('Register attempt:', req.body)
  console.log('PG_HOST:', process.env.PG_HOST)
  console.log('PG_DATABASE:', process.env.PG_DATABASE)
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'set' : 'undefined')
  const { email, password } = req.body

  try {
    const hashPassword = await bcrypt.hash(password, 10)
    const response = await pool.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
      [email, hashPassword]
    )
    res
      .status(201)
      .json({ message: 'User registered successfully', user: response.rows[0] })
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'User already exists' })
    }
    res.status(500).json({ message: 'Error registering user' })
  }
}

export const login = async (req, res) => {
  const { email, password } = req.body
  try {
    const user = await pool.query(`SELECT * FROM users WHERE email = $1`, [
      email,
    ])
    if (!user.rows[0]) {
      return res.status(401).json({ message: 'User not found' })
    }
    const passwordMatch = await bcrypt.compare(
      password,
      user.rows[0].password_hash
    )
    if (passwordMatch) {
      const token = jwt.sign({ id: user.rows[0].id }, process.env.JWT_SECRET, {
        expiresIn: '1h',
      })
      res.status(200).json({ message: 'User logged in successfully', token })
    } else {
      res.status(401).json({ message: 'Invalid credentials' })
    }
  } catch (error) {
    res.status(500).json({ message: 'Error logging in user' })
  }
}
