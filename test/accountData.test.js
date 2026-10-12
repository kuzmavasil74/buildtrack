import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildExport,
  chunk,
  deletionBlocker,
  emailConfirmed,
  exportFileName,
  receiptMetadata,
  receiptPrefix,
} from '../src/utils/accountData.js'

test('the typed email must match the account, ignoring case and spaces', () => {
  assert.equal(emailConfirmed('  Anna@Example.com ', 'anna@example.com'), true)
  assert.equal(emailConfirmed('anna@example.co', 'anna@example.com'), false)
  assert.equal(emailConfirmed('', ''), false)
  assert.equal(emailConfirmed(undefined, 'anna@example.com'), false)
})

test('only an owner with other members is stopped from deleting', () => {
  assert.equal(deletionBlocker({ role: 'owner', otherMembers: 2 }), 'OWNER_HAS_MEMBERS')
  assert.equal(deletionBlocker({ role: 'owner', otherMembers: 0 }), null)
  assert.equal(deletionBlocker({ role: 'foreman', otherMembers: 5 }), null)
})

test('chunk splits keys into S3-sized batches', () => {
  const keys = Array.from({ length: 2001 }, (_, i) => `k${i}`)
  assert.deepEqual(chunk(keys).map((batch) => batch.length), [1000, 1000, 1])
  assert.deepEqual(chunk([]), [])
  assert.deepEqual(chunk([1, 2, 3], 2), [[1, 2], [3]])
})

test('receipt photos of a site live under its own prefix', () => {
  assert.equal(receiptPrefix(12), 'receipts/12/')
})

test('receipt metadata leaves out the stored file URL', () => {
  const meta = receiptMetadata({
    _id: 'abc',
    siteId: 3,
    userId: 7,
    companyId: 1,
    key: 'receipts/3/x-a.jpg',
    fileUrl: 'https://bucket/receipts/3/x-a.jpg',
    originalName: 'a.jpg',
    createdAt: new Date('2026-01-02T00:00:00Z'),
  })
  assert.equal(meta.id, 'abc')
  assert.equal(meta.enteredBy, 7)
  assert.equal(meta.storageKey, 'receipts/3/x-a.jpg')
  assert.equal('fileUrl' in meta, false)
})

const now = new Date('2026-10-12T10:00:00Z')
const company = { id: 1, name: 'Acme', currency: 'EUR', created_at: now, owner_id: 5 }
const sites = [{ id: 3, name: 'Site', address: 'Main 1', latitude: 1, longitude: 2, user_id: 5, company_id: 1 }]
const crews = [{ id: 4, name: 'Crew', members: ['Ivan'], member_rates: { Ivan: 10 }, user_id: 5 }]
const records = [{ _id: 'r1', __v: 0, userId: 5, companyId: 1, siteId: 3, hoursWorked: 8, entries: [] }]

test('an owner export carries the company with its sites and crews', () => {
  const data = buildExport({
    user: { id: 5, email: 'o@x.cz', role: 'owner', created_at: now, password_hash: 'secret' },
    company,
    sites,
    crews,
    records,
    receipts: [],
    now,
  })
  assert.equal(data.scope, 'company')
  assert.equal(data.generatedAt, now.toISOString())
  assert.deepEqual(data.account, { id: 5, email: 'o@x.cz', role: 'owner', createdAt: now, lastSeenAt: null })
  assert.deepEqual(data.company, { id: 1, name: 'Acme', currency: 'EUR', createdAt: now })
  assert.deepEqual(data.sites, [{ id: 3, name: 'Site', address: 'Main 1', latitude: 1, longitude: 2 }])
  assert.deepEqual(data.crews, [{ id: 4, name: 'Crew', members: ['Ivan'], memberRates: { Ivan: 10 } }])
  assert.deepEqual(data.records, [{ id: 'r1', enteredBy: 5, siteId: 3, hoursWorked: 8, entries: [] }])
  assert.equal(JSON.stringify(data).includes('secret'), false)
})

test('a foreman export has no sites or crews', () => {
  const data = buildExport({
    user: { id: 6, email: 'f@x.cz', role: 'foreman' },
    company,
    sites,
    crews,
    records,
    now,
  })
  assert.equal(data.scope, 'own-entries')
  assert.equal('sites' in data, false)
  assert.equal('crews' in data, false)
  assert.equal(data.records.length, 1)
  assert.deepEqual(data.receipts, [])
})

test('the export file is named by date', () => {
  assert.equal(exportFileName(now), 'sanjo-data-2026-10-12.json')
})
