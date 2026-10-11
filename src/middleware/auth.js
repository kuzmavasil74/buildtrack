import jwt from 'jsonwebtoken'
import { AUTH_COOKIE_NAME } from '../config/cookie.js'
import { needsRefresh, startSession } from '../utils/session.js'

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization
  const token =
    req.cookies?.[AUTH_COOKIE_NAME] ||
    (authHeader && authHeader.split(' ')[1])

  if (!token) {
    return res.status(401).json({ message: 'Not authorized' })
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    // Only cookie sessions slide; a bearer token is the caller's own business.
    if (req.cookies?.[AUTH_COOKIE_NAME] && needsRefresh(decoded)) {
      startSession(res, decoded.id)
    }
    next()
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized' })
  }
}
