import { normalizeEmail } from './invites.js'
import { ROLES } from './permissions.js'

// Self-service data rights (GDPR art. 15, 17, 20): what a person can export
// and what happens when they delete their account.
//
// Export: an owner gets the whole company (sites, crews, every record and the
// receipt metadata); a foreman gets their account and what they entered.
//
// Delete: the user row goes, with their reset tokens and the invitations they
// sent. Companies they own and nobody else is in are deleted with everything
// in them (sites, crews, records, receipts and the receipt photos in S3).
// Records and receipts they entered in someone else's company belong to that
// company and stay, but their `userId` is set to null so nothing points at a
// deleted person any more. An owner whose current company still has other
// members is refused until they remove them.

export const EXPORT_FORMAT_VERSION = 1

// The delete form asks people to type their email; case and spaces don't count.
export const emailConfirmed = (typed, actual) =>
  Boolean(normalizeEmail(typed)) && normalizeEmail(typed) === normalizeEmail(actual)

// Why this account cannot be deleted right now, or null when it can.
export const deletionBlocker = ({ role, otherMembers }) =>
  role === ROLES.OWNER && otherMembers > 0 ? 'OWNER_HAS_MEMBERS' : null

// S3 DeleteObjects takes at most 1000 keys per call.
export const chunk = (items, size = 1000) => {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// Receipts are uploaded under receipts/<siteId>/, so a deleted site's photos
// are everything under that prefix (site ids are never reused).
export const receiptPrefix = (siteId) => `receipts/${siteId}/`

// What the export says about a receipt: where and when, not a link to the photo.
export const receiptMetadata = (receipt) => ({
  id: String(receipt._id),
  siteId: receipt.siteId,
  enteredBy: receipt.userId ?? null,
  originalName: receipt.originalName ?? null,
  storageKey: receipt.key,
  createdAt: receipt.createdAt ?? null,
  updatedAt: receipt.updatedAt ?? null,
})

export const recordData = (record) => {
  const { _id, __v, companyId, userId, ...rest } = record
  return { id: String(_id), enteredBy: userId ?? null, ...rest }
}

export const buildExport = ({ user, company, sites = [], crews = [], records = [], receipts = [], now = new Date() }) => {
  const owner = user.role === ROLES.OWNER
  return {
    format: 'sanjo-data-export',
    version: EXPORT_FORMAT_VERSION,
    generatedAt: now.toISOString(),
    scope: owner ? 'company' : 'own-entries',
    account: {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.created_at ?? null,
      lastSeenAt: user.last_seen_at ?? null,
    },
    company: company
      ? {
          id: company.id,
          name: company.name,
          currency: company.currency,
          createdAt: company.created_at ?? null,
        }
      : null,
    ...(owner && {
      sites: sites.map(({ id, name, address, latitude, longitude }) => ({ id, name, address, latitude, longitude })),
      crews: crews.map(({ id, name, members, member_rates }) => ({ id, name, members, memberRates: member_rates })),
    }),
    records: records.map(recordData),
    receipts: receipts.map(receiptMetadata),
  }
}

export const exportFileName = (now = new Date()) => `sanjo-data-${now.toISOString().slice(0, 10)}.json`
