import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { pool } from '../config/postgres.js'
import { AUTH_COOKIE_NAME, authCookieOptions } from '../config/cookie.js'
import dotenv from 'dotenv'

dotenv.config()

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

export const register = async (req, res) => {
  const { email, password } = req.body

  if (!email || !password || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: 'A valid email and password are required' })
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    })
  }

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
    console.error('REGISTER ERROR:', error)
    res.status(500).json({ message: 'Registration failed' })
  }
}

export const login = async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: 'Invalid credentials' })
  }

  try {
    const user = await pool.query(`SELECT * FROM users WHERE email = $1`, [
      email,
    ])
    const passwordMatch =
      user.rows[0] &&
      (await bcrypt.compare(password, user.rows[0].password_hash))

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = jwt.sign({ id: user.rows[0].id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    })
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions)
    res.status(200).json({ message: 'User logged in successfully' })
  } catch (error) {
    console.error('LOGIN ERROR:', error)
    res.status(500).json({ message: 'Login failed' })
  }
}

export const logout = async (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions)
  res.status(200).json({ message: 'Logged out' })
}

export const me = async (req, res) => {
  res.status(200).json({ id: req.user.id })
}
