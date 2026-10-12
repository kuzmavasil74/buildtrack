// Restores a backup made by backup-to-s3.js into EMPTY databases.
//
//   node scripts/restore-backup.js <file.json.gz>            # dry run: shows what is inside
//   node scripts/restore-backup.js <file.json.gz> --apply    # writes it
//   node scripts/restore-backup.js --s3 <key> [--apply]      # read the file from S3
//
// Download a file from the bucket yourself (aws s3 cp) or use --s3 with the
// app's AWS_* variables. Refuses to write if any target table/collection already
// has rows, so it can never mix a backup into live data.
import fs from 'node:fs'
import mongoose from 'mongoose'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { pool } from '../src/config/postgres.js'
import { s3Client, BUCKET_NAME } from '../src/config/s3.js'
import DailyRecord from '../src/models/DailyRecord.js'
import Receipt from '../src/models/Receipt.js'
import { countRows, decodeBackup } from '../src/utils/backup.js'

// Parents before children, so foreign keys hold.
// users and companies point at each other, so users go in without their
// company_id and get it once the companies exist.
const PG_ORDER = ['users', 'companies', 'sites', 'crews', 'password_reset_tokens', 'company_invites']

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const s3Index = args.indexOf('--s3')

const loadBuffer = async () => {
  if (s3Index !== -1) {
    const out = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: args[s3Index + 1] }))
    return Buffer.from(await out.Body.transformToByteArray())
  }
  const file = args.find((a) => !a.startsWith('--'))
  if (!file) throw new Error('Give a backup file path or --s3 <key>')
  return fs.readFileSync(file)
}

const run = async () => {
  const snapshot = decodeBackup(await loadBuffer())
  console.log(`Backup made ${snapshot.createdAt?.toISOString?.() ?? snapshot.createdAt}`)
  console.log(JSON.stringify(countRows(snapshot), null, 2))
  if (!apply) return console.log('Dry run. Add --apply to restore into empty databases.')

  await mongoose.connect(process.env.MONGO_URI)
  const mongoModels = { [DailyRecord.collection.name]: DailyRecord, [Receipt.collection.name]: Receipt }

  // Safety: every target must be empty.
  for (const table of PG_ORDER) {
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${table}`)
    if (rows[0].n > 0) throw new Error(`Postgres table ${table} is not empty (${rows[0].n} rows); aborting`)
  }
  for (const name of Object.keys(snapshot.mongo)) {
    if ((await mongoModels[name].collection.countDocuments()) > 0) {
      throw new Error(`Mongo collection ${name} is not empty; aborting`)
    }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const table of PG_ORDER) {
      for (const row of snapshot.postgres[table] || []) {
        const cols = Object.keys(row).filter((c) => !(table === 'users' && c === 'company_id'))
        await client.query(
          `INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols
            .map((_, i) => `$${i + 1}`)
            .join(',')})`,
          cols.map((c) => row[c])
        )
      }
      if (table === 'companies') {
        for (const user of snapshot.postgres.users || []) {
          if (user.company_id != null) {
            await client.query(`UPDATE users SET company_id = $1 WHERE id = $2`, [user.company_id, user.id])
          }
        }
      }
      // Keep the id counters ahead of the restored rows.
      await client.query(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM ${table}`
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  for (const [name, docs] of Object.entries(snapshot.mongo)) {
    if (docs.length) await mongoModels[name].collection.insertMany(docs)
  }
  console.log('Restore complete.')
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('RESTORE FAILED:', error.message)
    process.exit(1)
  })
