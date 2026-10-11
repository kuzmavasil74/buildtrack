const isProduction = process.env.NODE_ENV === 'production'

export const AUTH_COOKIE_NAME = 'token'

// How long a login lasts without any activity (see utils/session.js).
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

export const authCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: SESSION_MAX_AGE_MS,
}
