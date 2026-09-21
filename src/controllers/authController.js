import bcrypt from 'bcrypt'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { pool } from '../config/postgres.js'
import { AUTH_COOKIE_NAME, authCookieOptions } from '../config/cookie.js'
import { sendMail } from '../utils/mailer.js'
import dotenv from 'dotenv'

dotenv.config()

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

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

export const forgotPassword = async (req, res) => {
  const { email } = req.body

  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: 'A valid email is required' })
  }

  try {
    const result = await pool.query(`SELECT id FROM users WHERE email = $1`, [
      email,
    ])
    const user = result.rows[0]

    // Only act when the user exists, but always respond the same way so we
    // don't reveal which emails are registered.
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex')
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)

      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      )

      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173')
        .trim()
        .replace(/\/$/, '')
      const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`

      await sendMail({
        to: email,
        subject: 'BuildTrack password reset',
        text: `You requested a password reset.\n\nOpen this link to set a new password (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
        html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Set a new password</a> (valid for 1 hour).</p><p>If you didn't request this, you can safely ignore this email.</p>`,
      })
    }

    return res.status(200).json({
      message: 'If that email is registered, a reset link has been sent.',
    })
  } catch (error) {
    console.error('FORGOT PASSWORD ERROR:', error)
    return res.status(500).json({ message: 'Could not process request' })
  }
}

export const resetPassword = async (req, res) => {
  const { token, password } = req.body

  if (!token || !password) {
    return res
      .status(400)
      .json({ message: 'Token and new password are required' })
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    })
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const result = await pool.query(
      `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens WHERE token_hash = $1`,
      [tokenHash]
    )
    const row = result.rows[0]

    if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
      return res
        .status(400)
        .json({ message: 'This reset link is invalid or has expired' })
    }

    const hashPassword = await bcrypt.hash(password, 10)
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      hashPassword,
      row.user_id,
    ])
    // Consume this token and invalidate any other outstanding ones.
    await pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [row.user_id]
    )

    return res.status(200).json({ message: 'Password updated successfully' })
  } catch (error) {
    console.error('RESET PASSWORD ERROR:', error)
    return res.status(500).json({ message: 'Could not reset password' })
  }
}

export const logout = async (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions)
  res.status(200).json({ message: 'Logged out' })
}

export const me = async (req, res) => {
  res.status(200).json({ id: req.user.id })
}
