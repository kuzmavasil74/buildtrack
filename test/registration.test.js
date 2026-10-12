import test from 'node:test'
import assert from 'node:assert/strict'
import { isRegistrationOpen, register } from '../src/controllers/authController.js'

test('registration is closed unless OPEN_REGISTRATION is exactly "true"', () => {
  assert.equal(isRegistrationOpen(undefined), false)
  assert.equal(isRegistrationOpen('1'), false)
  assert.equal(isRegistrationOpen('true'), true)
})

test('signing up without an invitation is refused while registration is closed', async () => {
  let result
  const res = { status: (code) => ({ json: (body) => (result = [code, body.code]) }) }
  await register({ body: { email: 'new@example.com', password: 'password123' } }, res)
  assert.deepEqual(result, [403, 'REGISTRATION_CLOSED'])
})
