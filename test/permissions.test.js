import test from 'node:test'
import assert from 'node:assert/strict'
import {
  editableRecordFilter,
  isAdminEmail,
  parseAdminEmails,
  requireAdmin,
  requireOwner,
} from '../src/utils/permissions.js'
import { inviteProblem, normalizeEmail } from '../src/utils/invites.js'

const owner = { id: 1, role: 'owner', companyId: 10 }
const foreman = { id: 2, role: 'foreman', companyId: 10 }

test('an owner may edit any record in the company, a foreman only their own', () => {
  assert.deepEqual(editableRecordFilter(owner, 'r1'), { _id: 'r1', companyId: 10 })
  assert.deepEqual(editableRecordFilter(foreman, 'r1'), { _id: 'r1', companyId: 10, userId: 2 })
})

const run = (middleware, user) => {
  let status = 200
  let nextCalled = false
  const res = { status: (code) => ((status = code), { json: () => {} }) }
  middleware({ user }, res, () => (nextCalled = true))
  return { status, nextCalled }
}

test('requireOwner lets owners through and stops foremen', () => {
  assert.deepEqual(run(requireOwner, owner), { status: 200, nextCalled: true })
  assert.deepEqual(run(requireOwner, foreman), { status: 403, nextCalled: false })
  assert.deepEqual(run(requireOwner, undefined), { status: 403, nextCalled: false })
})

test('requireAdmin only passes flagged users', () => {
  assert.equal(run(requireAdmin, { isAdmin: true }).nextCalled, true)
  assert.equal(run(requireAdmin, { ...owner, isAdmin: false }).status, 403)
})

test('admin emails are a comma list matched without case or spaces', () => {
  assert.deepEqual(parseAdminEmails(' A@x.com, ,b@y.com '), ['a@x.com', 'b@y.com'])
  assert.equal(isAdminEmail('a@X.com ', 'a@x.com,b@y.com'), true)
  assert.equal(isAdminEmail('c@x.com', 'a@x.com'), false)
  assert.equal(isAdminEmail('a@x.com', ''), false)
  assert.equal(isAdminEmail('', 'a@x.com'), false)
})

test('invites expire, can be used once and can be revoked', () => {
  const now = new Date('2026-10-12T12:00:00Z')
  const open = { expires_at: '2026-10-20T00:00:00Z', accepted_at: null, revoked_at: null }
  assert.equal(inviteProblem(open, now), null)
  assert.equal(inviteProblem(null, now), 'not_found')
  assert.equal(inviteProblem({ ...open, revoked_at: now }, now), 'revoked')
  assert.equal(inviteProblem({ ...open, accepted_at: now }, now), 'used')
  assert.equal(inviteProblem({ ...open, expires_at: '2026-10-01T00:00:00Z' }, now), 'expired')
})

test('emails are compared trimmed and lower-cased', () => {
  assert.equal(normalizeEmail('  Foo@Bar.COM '), 'foo@bar.com')
  assert.equal(normalizeEmail(undefined), '')
})
