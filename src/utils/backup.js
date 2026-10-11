import { gzipSync, gunzipSync } from 'node:zlib'
import mongoose from 'mongoose'

// Nightly backups are one gzip-compressed EJSON file per run in S3. EJSON keeps
// Mongo's ObjectIds and dates intact so a restore gives back identical documents.
// Relaxed mode on purpose: numbers stay plain numbers (canonical mode would
// bring back Int32/Double wrappers that corrupt JSON columns in Postgres).
const { EJSON } = mongoose.mongo.BSON

export const BACKUP_PREFIX = 'backups/'
export const KEEP_DAYS = 30
// Never prune below this many files, even if they are old: if backups silently
// stop running, the last good ones must survive.
export const MIN_KEEP = 7

const pad = (n, len = 2) => String(n).padStart(len, '0')

// backups/buildtrack-20261011-130000Z.json.gz (UTC)
export const backupKey = (date = new Date()) =>
  `${BACKUP_PREFIX}buildtrack-${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(
    date.getUTCDate()
  )}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z.json.gz`

const KEY_RE = /^backups\/buildtrack-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})Z\.json\.gz$/

export const parseBackupTime = (key) => {
  const m = KEY_RE.exec(key)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m.map(Number)
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s))
}

// Keys older than keepDays, oldest first, always leaving the newest minKeep
// backups alone. Anything that is not one of our backup files is ignored.
export const selectExpired = (keys, now = new Date(), keepDays = KEEP_DAYS, minKeep = MIN_KEEP) => {
  const dated = keys
    .map((key) => ({ key, time: parseBackupTime(key) }))
    .filter((item) => item.time)
    .sort((a, b) => b.time - a.time) // newest first
  const cutoff = now.getTime() - keepDays * 24 * 60 * 60 * 1000
  return dated
    .slice(minKeep)
    .filter((item) => item.time.getTime() < cutoff)
    .map((item) => item.key)
    .reverse()
}

export const encodeBackup = (snapshot) =>
  gzipSync(Buffer.from(EJSON.stringify(snapshot), 'utf8'))

export const decodeBackup = (buffer) => EJSON.parse(gunzipSync(buffer).toString('utf8'))

// { postgres: { users: 4, ... }, mongo: { dailyrecords: 12, ... } }
export const countRows = (snapshot) => {
  const count = (group) =>
    Object.fromEntries(Object.entries(group || {}).map(([name, rows]) => [name, rows.length]))
  return { postgres: count(snapshot.postgres), mongo: count(snapshot.mongo) }
}
