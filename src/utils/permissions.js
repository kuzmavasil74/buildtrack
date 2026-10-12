// Roles inside a company. The owner runs it; a foreman logs work.
export const ROLES = { OWNER: 'owner', FOREMAN: 'foreman' }

export const isOwner = (user) => user?.role === ROLES.OWNER

// ADMIN_EMAILS is a comma-separated list; matching ignores case and spaces.
export const parseAdminEmails = (value = '') =>
  value
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

export const isAdminEmail = (email, value = process.env.ADMIN_EMAILS) =>
  Boolean(email) && parseAdminEmails(value).includes(String(email).trim().toLowerCase())

// The Mongo filter for a record this user may change: an owner may change any
// record in the company, a foreman only the ones they entered.
export const editableRecordFilter = (user, id) =>
  isOwner(user)
    ? { _id: id, companyId: user.companyId }
    : { _id: id, companyId: user.companyId, userId: user.id }

export const requireOwner = (req, res, next) =>
  isOwner(req.user) ? next() : res.status(403).json({ message: 'Only the company owner can do this' })

export const requireAdmin = (req, res, next) =>
  req.user?.isAdmin ? next() : res.status(403).json({ message: 'Admins only' })
