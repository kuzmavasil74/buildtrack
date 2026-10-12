import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { pool } from '../config/postgres.js'
import { s3Client, BUCKET_NAME } from '../config/s3.js'
import { AUTH_COOKIE_NAME, authCookieOptions } from '../config/cookie.js'
import DailyRecord from '../models/DailyRecord.js'
import Receipt from '../models/Receipt.js'
import { ROLES } from '../utils/permissions.js'
import {
  buildExport,
  chunk,
  deletionBlocker,
  emailConfirmed,
  exportFileName,
  receiptPrefix,
} from '../utils/accountData.js'

// GET /account/export — everything we hold about the signed-in user, as JSON.
export const exportAccount = async (req, res) => {
  const { id: userId, companyId, role } = req.user
  const owner = role === ROLES.OWNER
  try {
    const [user, company, sites, crews] = await Promise.all([
      pool.query(`SELECT id, email, role, created_at, last_seen_at FROM users WHERE id = $1`, [userId]),
      pool.query(`SELECT id, name, currency, created_at FROM companies WHERE id = $1`, [companyId]),
      owner
        ? pool.query(`SELECT id, name, address, latitude, longitude FROM sites WHERE company_id = $1 ORDER BY id`, [companyId])
        : { rows: [] },
      owner
        ? pool.query(`SELECT id, name, members, member_rates FROM crews WHERE company_id = $1 ORDER BY id`, [companyId])
        : { rows: [] },
    ])
    // An owner gets the company's data; anyone also gets what they entered elsewhere.
    const filter = owner ? { $or: [{ companyId }, { userId }] } : { userId }
    const [records, receipts] = await Promise.all([
      DailyRecord.find(filter).sort({ date: 1, _id: 1 }).lean(),
      Receipt.find(filter).sort({ createdAt: 1 }).lean(),
    ])
    const now = new Date()
    const data = buildExport({
      user: user.rows[0],
      company: company.rows[0],
      sites: sites.rows,
      crews: crews.rows,
      records,
      receipts,
      now,
    })
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename=${exportFileName(now)}`)
    res.status(200).send(JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('ACCOUNT EXPORT ERROR:', error)
    res.status(500).json({ message: 'Could not export data' })
  }
}

// Deletes every receipt photo under the given sites plus any explicit keys.
const deleteReceiptObjects = async (siteIds, keys) => {
  const all = new Set(keys)
  for (const siteId of siteIds) {
    let ContinuationToken
    do {
      const page = await s3Client.send(
        new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: receiptPrefix(siteId), ContinuationToken })
      )
      for (const object of page.Contents || []) all.add(object.Key)
      ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
    } while (ContinuationToken)
  }
  for (const batch of chunk([...all])) {
    const result = await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      })
    )
    if (result.Errors?.length) throw new Error(`S3 refused ${result.Errors.length} deletions`)
  }
  return all.size
}

// DELETE /account { email } — see src/utils/accountData.js for what goes.
export const deleteAccount = async (req, res) => {
  const { id: userId, email, role, companyId } = req.user
  if (!emailConfirmed(req.body?.email, email)) {
    return res.status(400).json({ message: 'Type your email to confirm', code: 'EMAIL_MISMATCH' })
  }

  const client = await pool.connect()
  let purged = { companyIds: [], siteIds: [], receiptKeys: [] }
  try {
    await client.query('BEGIN')
    await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [userId])
    const others = await client.query(
      `SELECT COUNT(*)::int AS n FROM users WHERE company_id = $1 AND id <> $2`,
      [companyId, userId]
    )
    const blocker = deletionBlocker({ role, otherMembers: others.rows[0].n })
    if (blocker) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Remove the other members of your company first', code: blocker })
    }

    // Companies this person owns: delete the ones nobody else is in. A company
    // they left behind that someone joined later passes to its oldest member.
    const { rows: owned } = await client.query(`SELECT id FROM companies WHERE owner_id = $1`, [userId])
    for (const { id } of owned) {
      const { rows: heirs } = await client.query(
        `SELECT id FROM users WHERE company_id = $1 AND id <> $2 ORDER BY created_at NULLS FIRST, id LIMIT 1`,
        [id, userId]
      )
      if (heirs[0]) {
        await client.query(`UPDATE companies SET owner_id = $1 WHERE id = $2`, [heirs[0].id, id])
        await client.query(`UPDATE users SET role = $1 WHERE id = $2`, [ROLES.OWNER, heirs[0].id])
      } else {
        purged.companyIds.push(id)
      }
    }

    if (purged.companyIds.length) {
      const ids = purged.companyIds
      const sites = await client.query(`SELECT id FROM sites WHERE company_id = ANY($1)`, [ids])
      purged.siteIds = sites.rows.map((row) => row.id)
      const receipts = await Receipt.find({ companyId: { $in: ids } }, { key: 1 }).lean()
      purged.receiptKeys = receipts.map((receipt) => receipt.key)

      await client.query(`UPDATE users SET company_id = NULL WHERE id = $1`, [userId])
      await client.query(`DELETE FROM sites WHERE company_id = ANY($1)`, [ids])
      await client.query(`DELETE FROM crews WHERE company_id = ANY($1)`, [ids])
      await client.query(`DELETE FROM company_invites WHERE company_id = ANY($1)`, [ids])
      await client.query(`DELETE FROM companies WHERE id = ANY($1)`, [ids])
    }

    // Anything left that still names this person as its creator now belongs
    // to the owner of the company it is in.
    for (const table of ['sites', 'crews']) {
      await client.query(
        `UPDATE ${table} t SET user_id = c.owner_id FROM companies c
         WHERE t.company_id = c.id AND t.user_id = $1`,
        [userId]
      )
    }
    await client.query(`DELETE FROM company_invites WHERE invited_by = $1`, [userId])
    await client.query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [userId])
    await client.query(`DELETE FROM users WHERE id = $1`, [userId])

    // Mongo runs before COMMIT so a failure here leaves the account intact.
    if (purged.companyIds.length) {
      const scope = { companyId: { $in: purged.companyIds } }
      await Promise.all([DailyRecord.deleteMany(scope), Receipt.deleteMany(scope)])
    }
    await Promise.all([
      DailyRecord.updateMany({ userId }, { $set: { userId: null } }),
      Receipt.updateMany({ userId }, { $set: { userId: null } }),
    ])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('ACCOUNT DELETE ERROR:', error)
    return res.status(500).json({ message: 'Could not delete account' })
  } finally {
    client.release()
  }

  // The account is gone either way; photos that S3 would not delete are
  // logged so they can be removed by hand.
  let photosDeleted = 0
  if (purged.siteIds.length || purged.receiptKeys.length) {
    try {
      photosDeleted = await deleteReceiptObjects(purged.siteIds, purged.receiptKeys)
    } catch (error) {
      console.error('ACCOUNT DELETE S3 ERROR:', { userId, sites: purged.siteIds, keys: purged.receiptKeys }, error)
    }
  }

  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions)
  res.status(200).json({
    message: 'Account deleted',
    deletedCompanies: purged.companyIds.length,
    photosDeleted,
  })
}
