const isProduction = process.env.NODE_ENV === 'production'

export const AUTH_COOKIE_NAME = 'token'

export const authCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: 60 * 60 * 1000,
}
