import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { needsRefresh, signSession, REFRESH_AFTER_MS } from '../src/utils/session.js'
import { SESSION_MAX_AGE_MS } from '../src/config/cookie.js'

process.env.JWT_SECRET = 'test-secret'

test('a fresh token does not need refreshing', () => {
  const now = Date.now()
  assert.equal(needsRefresh({ iat: Math.floor(now / 1000) }, now), false)
})

test('a token older than a day is refreshed (sliding session)', () => {
  const now = Date.now()
  const iat = Math.floor((now - REFRESH_AFTER_MS - 60_000) / 1000)
  assert.equal(needsRefresh({ iat }, now), true)
})

test('tokens without an issue time are left alone', () => {
  assert.equal(needsRefresh({}), false)
  assert.equal(needsRefresh(undefined), false)
})

test('a session token carries the user id and lasts the configured time', () => {
  const decoded = jwt.verify(signSession(42), process.env.JWT_SECRET)
  assert.equal(decoded.id, 42)
  assert.equal(decoded.exp - decoded.iat, SESSION_MAX_AGE_MS / 1000)
})
