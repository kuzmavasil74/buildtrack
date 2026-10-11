import jwt from 'jsonwebtoken'
import { AUTH_COOKIE_NAME, authCookieOptions, SESSION_MAX_AGE_MS } from '../config/cookie.js'

// Sessions are sliding: a token lives SESSION_MAX_AGE_MS, and whoever keeps
// using the app gets a fresh one at most once per REFRESH_AFTER_MS, so an
// active user is never thrown back to the login form. Someone who stays away
// for the whole window has to sign in again.
export const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000

export const signSession = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: Math.floor(SESSION_MAX_AGE_MS / 1000),
  })

export const startSession = (res, userId) => {
  res.cookie(AUTH_COOKIE_NAME, signSession(userId), authCookieOptions)
}

// `iat`/`exp` are in seconds. True when the token is older than REFRESH_AFTER_MS.
export const needsRefresh = (decoded, now = Date.now()) =>
  typeof decoded?.iat === 'number' && now - decoded.iat * 1000 > REFRESH_AFTER_MS
