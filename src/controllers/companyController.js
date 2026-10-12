import { pool, defaultCompanyName } from '../config/postgres.js'
import { sendMail } from '../utils/mailer.js'
import { ROLES } from '../utils/permissions.js'
import {
  INVITE_TTL_MS,
  findInvite,
  hashToken,
  inviteProblem,
  inviteUrl,
  newInviteToken,
  normalizeEmail,
} from '../utils/invites.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_COMPANY_NAME = 100

// Owner view: the company, its people and the invitations still open.
export const getCompany = async (req, res) => {
  const { companyId } = req.user
  try {
    const [company, members, invites] = await Promise.all([
      pool.query(`SELECT id, name, owner_id FROM companies WHERE id = $1`, [companyId]),
      pool.query(
        `SELECT id, email, role, created_at, last_seen_at FROM users
         WHERE company_id = $1 ORDER BY role = 'owner' DESC, email`,
        [companyId]
      ),
      pool.query(
        `SELECT id, email, role, created_at, expires_at FROM company_invites
         WHERE company_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()
         ORDER BY created_at DESC`,
        [companyId]
      ),
    ])
    res.status(200).json({
      company: company.rows[0],
      members: members.rows,
      invites: invites.rows,
    })
  } catch (error) {
    console.error('GET COMPANY ERROR:', error)
    res.status(500).json({ message: 'Could not load company' })
  }
}

export const updateCompany = async (req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name || name.length > MAX_COMPANY_NAME) {
    return res.status(400).json({ message: 'Company name is required' })
  }
  try {
    await pool.query(`UPDATE companies SET name = $1 WHERE id = $2`, [name, req.user.companyId])
    res.status(200).json({ name })
  } catch (error) {
    console.error('UPDATE COMPANY ERROR:', error)
    res.status(500).json({ message: 'Could not save company' })
  }
}

// Creates an invitation and emails it. The link is also returned so the owner
// can pass it on through a messenger when email is not set up or not read.
export const createInvite = async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: 'A valid email is required' })
  }
  const { companyId, id: userId } = req.user
  try {
    const existing = await pool.query(
      `SELECT company_id FROM users WHERE lower(email) = $1`,
      [email]
    )
    if (existing.rows[0]?.company_id === companyId) {
      return res.status(409).json({ message: 'Already a member', code: 'ALREADY_MEMBER' })
    }

    // A fresh invite replaces any open one for the same address.
    await pool.query(
      `UPDATE company_invites SET revoked_at = NOW()
       WHERE company_id = $1 AND lower(email) = $2 AND accepted_at IS NULL AND revoked_at IS NULL`,
      [companyId, email]
    )
    const token = newInviteToken()
    const { rows } = await pool.query(
      `INSERT INTO company_invites (company_id, email, role, token_hash, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role, created_at, expires_at`,
      [companyId, email, ROLES.FOREMAN, hashToken(token), userId, new Date(Date.now() + INVITE_TTL_MS)]
    )
    const company = await pool.query(`SELECT name FROM companies WHERE id = $1`, [companyId])
    const companyName = company.rows[0]?.name || 'Sanjo'
    const link = inviteUrl(token)

    let emailed = false
    try {
      const result = await sendMail({
        to: email,
        subject: `Invitation to ${companyName} on Sanjo`,
        text: `${req.user.email} invited you to join "${companyName}" on Sanjo.\n\nOpen this link to accept (valid for 14 days):\n${link}`,
        html: `<p>${escapeHtml(req.user.email)} invited you to join <b>${escapeHtml(companyName)}</b> on Sanjo.</p><p><a href="${link}">Accept the invitation</a> (valid for 14 days).</p>`,
      })
      emailed = result.delivered
    } catch (error) {
      console.error('INVITE EMAIL ERROR:', error)
    }

    res.status(201).json({ invite: rows[0], link, emailed })
  } catch (error) {
    console.error('CREATE INVITE ERROR:', error)
    res.status(500).json({ message: 'Could not create invitation' })
  }
}

export const revokeInvite = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE company_invites SET revoked_at = NOW()
       WHERE id = $1 AND company_id = $2 AND accepted_at IS NULL AND revoked_at IS NULL`,
      [req.params.id, req.user.companyId]
    )
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Invitation not found' })
    }
    res.status(200).json({ message: 'Invitation revoked' })
  } catch (error) {
    console.error('REVOKE INVITE ERROR:', error)
    res.status(500).json({ message: 'Could not revoke invitation' })
  }
}

// Public: what the invite page shows before someone signs in or registers.
export const previewInvite = async (req, res) => {
  try {
    const invite = await findInvite(req.params.token)
    const problem = inviteProblem(invite)
    if (problem) return res.status(404).json({ message: 'Invitation not valid', code: problem })
    const account = await pool.query(`SELECT 1 FROM users WHERE lower(email) = $1`, [
      normalizeEmail(invite.email),
    ])
    res.status(200).json({
      companyName: invite.company_name,
      email: invite.email,
      role: invite.role,
      hasAccount: account.rows.length > 0,
    })
  } catch (error) {
    console.error('PREVIEW INVITE ERROR:', error)
    res.status(500).json({ message: 'Could not load invitation' })
  }
}

// A signed-in user joins the inviting company. Their own company (and its
// data) is kept, so they get it back if they are ever removed again.
export const acceptInvite = async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const invite = await findInvite(req.body?.token, client)
    const problem = inviteProblem(invite)
    if (problem) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'This invitation is no longer valid', code: 'INVITE_INVALID' })
    }
    if (normalizeEmail(invite.email) !== normalizeEmail(req.user.email)) {
      await client.query('ROLLBACK')
      return res.status(403).json({ message: 'This invitation was sent to a different email', code: 'INVITE_EMAIL_MISMATCH' })
    }
    if (invite.company_id === req.user.companyId) {
      await client.query(`UPDATE company_invites SET accepted_at = NOW() WHERE id = $1`, [invite.id])
      await client.query('COMMIT')
      return res.status(200).json({ message: 'Already a member' })
    }
    // An owner with people in their company would leave them without one.
    if (req.user.role === ROLES.OWNER) {
      const others = await client.query(
        `SELECT 1 FROM users WHERE company_id = $1 AND id <> $2 LIMIT 1`,
        [req.user.companyId, req.user.id]
      )
      if (others.rows.length) {
        await client.query('ROLLBACK')
        return res.status(409).json({ message: 'Your company still has members', code: 'OWNER_HAS_MEMBERS' })
      }
    }
    await client.query(`UPDATE users SET company_id = $1, role = $2 WHERE id = $3`, [
      invite.company_id,
      invite.role,
      req.user.id,
    ])
    await client.query(`UPDATE company_invites SET accepted_at = NOW() WHERE id = $1`, [invite.id])
    await client.query('COMMIT')
    res.status(200).json({ message: 'Joined', companyName: invite.company_name })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('ACCEPT INVITE ERROR:', error)
    res.status(500).json({ message: 'Could not accept invitation' })
  } finally {
    client.release()
  }
}

// The owner removes a member. Everything the member entered stays with this
// company; the member goes back to a company of their own.
export const removeMember = async (req, res) => {
  const memberId = Number(req.params.id)
  if (memberId === req.user.id) {
    return res.status(400).json({ message: 'The owner cannot remove themselves' })
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `SELECT id, email FROM users WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [memberId, req.user.companyId]
    )
    const member = rows[0]
    if (!member) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Member not found' })
    }
    const own = await client.query(
      `SELECT id FROM companies WHERE owner_id = $1 ORDER BY id LIMIT 1`,
      [member.id]
    )
    const homeId =
      own.rows[0]?.id ??
      (
        await client.query(
          `INSERT INTO companies (name, owner_id) VALUES ($1, $2) RETURNING id`,
          [defaultCompanyName(member.email), member.id]
        )
      ).rows[0].id
    await client.query(`UPDATE users SET company_id = $1, role = $2 WHERE id = $3`, [
      homeId,
      ROLES.OWNER,
      member.id,
    ])
    await client.query('COMMIT')
    res.status(200).json({ message: 'Member removed' })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('REMOVE MEMBER ERROR:', error)
    res.status(500).json({ message: 'Could not remove member' })
  } finally {
    client.release()
  }
}

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
