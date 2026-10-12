// Nightly backup: dumps every Postgres table and MongoDB collection into one
// compressed file in S3 (backups/), then deletes backups older than 30 days.
// Run by the Railway cron service `buildtrack-backup`; exits non-zero on any
// failure so a broken backup shows up as a failed run.
//
//   node scripts/backup-to-s3.js                 # upload to S3 (what the cron service does)
//   node scripts/backup-to-s3.js --file out.json.gz   # write a local file instead
//
// Needs DATABASE_URL and MONGO_URI; for S3 also AWS_REGION, AWS_ACCESS_KEY_ID,
// AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME.
import fs from 'node:fs'
import mongoose from 'mongoose'
import {
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3'
import { pool } from '../src/config/postgres.js'
import { s3Client, BUCKET_NAME } from '../src/config/s3.js'
import DailyRecord from '../src/models/DailyRecord.js'
import Receipt from '../src/models/Receipt.js'
import {
  BACKUP_PREFIX,
  backupKey,
  countRows,
  decodeBackup,
  encodeBackup,
  selectExpired,
} from '../src/utils/backup.js'

export const PG_TABLES = ['users', 'companies', 'sites', 'crews', 'password_reset_tokens', 'company_invites']

const listBackupKeys = async () => {
  const keys = []
  let token
  do {
    const page = await s3Client.send(
      new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: BACKUP_PREFIX, ContinuationToken: token })
    )
    for (const item of page.Contents || []) keys.push(item.Key)
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)
  return keys
}

const fileIndex = process.argv.indexOf('--file')
const localFile = fileIndex !== -1 ? process.argv[fileIndex + 1] : null

const run = async () => {
  const required = ['DATABASE_URL', 'MONGO_URI']
  if (!localFile) required.push('S3_BUCKET_NAME', 'AWS_ACCESS_KEY_ID')
  for (const name of required) {
    if (!process.env[name]) throw new Error(`${name} is not set`)
  }

  await mongoose.connect(process.env.MONGO_URI)

  const snapshot = { version: 1, createdAt: new Date(), postgres: {}, mongo: {} }
  for (const table of PG_TABLES) {
    snapshot.postgres[table] = (await pool.query(`SELECT * FROM ${table} ORDER BY 1`)).rows
  }
  for (const model of [DailyRecord, Receipt]) {
    snapshot.mongo[model.collection.name] = await model.collection.find({}).toArray()
  }

  const body = encodeBackup(snapshot)
  // Prove the file reads back to the same row counts before trusting it.
  const expected = JSON.stringify(countRows(snapshot))
  if (JSON.stringify(countRows(decodeBackup(body))) !== expected) {
    throw new Error('Backup failed its own read-back check; not uploading')
  }

  if (localFile) {
    fs.writeFileSync(localFile, body, { mode: 0o600 })
    console.log(`Backup OK: ${localFile} (${body.length} bytes) ${expected}`)
    return
  }

  const key = backupKey()
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: 'application/gzip',
      ServerSideEncryption: 'AES256',
    })
  )
  const head = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
  if (head.ContentLength !== body.length) {
    throw new Error(`Uploaded size ${head.ContentLength} != local size ${body.length}`)
  }
  console.log(`Backup OK: s3://${BUCKET_NAME}/${key} (${body.length} bytes) ${expected}`)

  const expired = selectExpired(await listBackupKeys())
  if (expired.length) {
    await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: { Objects: expired.map((Key) => ({ Key })) },
      })
    )
    console.log(`Pruned ${expired.length} backup(s) older than 30 days`)
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('BACKUP FAILED:', error)
    process.exit(1)
  })
