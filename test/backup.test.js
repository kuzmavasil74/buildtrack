import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import {
  KEEP_DAYS,
  MIN_KEEP,
  backupKey,
  countRows,
  decodeBackup,
  encodeBackup,
  parseBackupTime,
  selectExpired,
} from '../src/utils/backup.js'

const day = 24 * 60 * 60 * 1000
const keyDaysAgo = (now, days) => backupKey(new Date(now.getTime() - days * day))

test('backup keys are sortable UTC timestamps and parse back', () => {
  const date = new Date(Date.UTC(2026, 9, 11, 3, 5, 9))
  assert.equal(backupKey(date), 'backups/buildtrack-20261011-030509Z.json.gz')
  assert.equal(parseBackupTime(backupKey(date)).getTime(), date.getTime())
})

test('parseBackupTime ignores files that are not ours', () => {
  assert.equal(parseBackupTime('backups/readme.txt'), null)
  assert.equal(parseBackupTime('receipts/photo.jpg'), null)
  assert.equal(parseBackupTime('backups/buildtrack-2026-10-11.json.gz'), null)
})

test('selectExpired returns only backups older than the retention window', () => {
  const now = new Date(Date.UTC(2026, 10, 30))
  // one backup a day for 45 days
  const keys = Array.from({ length: 45 }, (_, i) => keyDaysAgo(now, i))
  const expired = selectExpired(keys, now)
  assert.equal(expired.length, 45 - (KEEP_DAYS + 1)) // days 31..44 are older than 30 days
  for (const key of expired) {
    assert.ok(now - parseBackupTime(key) > KEEP_DAYS * day)
  }
  assert.ok(!expired.includes(keyDaysAgo(now, 0)), 'never the newest')
})

test('selectExpired always keeps the newest backups, even when all are old', () => {
  const now = new Date(Date.UTC(2026, 10, 30))
  // backups stopped 100 days ago: 10 old files remain
  const keys = Array.from({ length: 10 }, (_, i) => keyDaysAgo(now, 100 + i))
  const expired = selectExpired(keys, now)
  assert.equal(expired.length, 10 - MIN_KEEP)
  const kept = keys.filter((k) => !expired.includes(k))
  assert.equal(kept.length, MIN_KEEP)
})

test('selectExpired leaves unrelated objects alone', () => {
  const now = new Date(Date.UTC(2026, 10, 30))
  const keys = ['backups/notes.txt', 'receipts/a.jpg', ...Array.from({ length: 20 }, (_, i) => keyDaysAgo(now, 40 + i))]
  const expired = selectExpired(keys, now)
  assert.ok(!expired.includes('backups/notes.txt'))
  assert.ok(!expired.includes('receipts/a.jpg'))
})

test('a backup survives encode/decode with ObjectIds, dates and arrays intact', () => {
  const id = new mongoose.Types.ObjectId()
  const when = new Date(Date.UTC(2026, 9, 5))
  const snapshot = {
    version: 1,
    createdAt: new Date(Date.UTC(2026, 9, 11)),
    postgres: {
      users: [{ id: 1, email: 'a@b.c', password_hash: 'x', currency: 'EUR' }],
      crews: [{ id: 2, name: 'Team', members: ['Ivan', 'Petro'], member_rates: { Ivan: 10 }, user_id: 1 }],
      sites: [],
    },
    mongo: {
      dailyrecords: [{ _id: id, siteId: 1, date: when, entries: [{ name: 'Ivan', hours: 8, rate: 10 }] }],
      receipts: [],
    },
  }
  const back = decodeBackup(encodeBackup(snapshot))
  assert.equal(back.mongo.dailyrecords[0]._id.toString(), id.toString())
  assert.ok(back.mongo.dailyrecords[0]._id instanceof mongoose.Types.ObjectId)
  assert.equal(back.mongo.dailyrecords[0].date.getTime(), when.getTime())
  assert.deepEqual(back.postgres.crews[0].members, ['Ivan', 'Petro'])
  assert.deepEqual(back.postgres.crews[0].member_rates, { Ivan: 10 })
  assert.deepEqual(countRows(back), {
    postgres: { users: 1, crews: 1, sites: 0 },
    mongo: { dailyrecords: 1, receipts: 0 },
  })
})

test('the encoded backup is compressed', () => {
  const rows = Array.from({ length: 500 }, (_, i) => ({ id: i, email: `user${i}@example.com` }))
  const raw = JSON.stringify(rows).length
  assert.ok(encodeBackup({ postgres: { users: rows }, mongo: {} }).length < raw / 2)
})
