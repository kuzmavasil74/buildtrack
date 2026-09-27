const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const round2 = (n) => Math.round(n * 100) / 100

// Hours between "HH:MM" and "HH:MM"; an end before the start means the shift crossed midnight.
export const hoursBetween = (start, end) => {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let minutes = eh * 60 + em - (sh * 60 + sm)
  if (minutes < 0) minutes += 24 * 60
  return round2(minutes / 60)
}

const isBlank = (value) => value === undefined || value === null || value === ''

const normalizeEntry = (raw) => {
  const name = String(raw?.name ?? '').trim()
  if (!name) return null

  const startTime = isBlank(raw.startTime) ? undefined : String(raw.startTime)
  const endTime = isBlank(raw.endTime) ? undefined : String(raw.endTime)
  if ((startTime && !TIME_RE.test(startTime)) || (endTime && !TIME_RE.test(endTime))) {
    return null
  }

  let hours
  if (!isBlank(raw.hours)) hours = Number(raw.hours)
  else if (startTime && endTime) hours = hoursBetween(startTime, endTime)
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) return null

  let rate
  if (!isBlank(raw.rate)) {
    rate = Number(raw.rate)
    if (!Number.isFinite(rate) || rate < 0) return null
  }

  const note = String(raw.note ?? '').trim()
  return { name, startTime, endTime, hours: round2(hours), rate, note: note || undefined }
}

// Validates a create/update body and returns the fields to store, or { error }.
// With per-person `entries` the totals are derived; without them the legacy
// workersPresent/hoursWorked pair is required (old records and clients).
export const parseRecordBody = (body) => {
  const { siteId, crewId, date, tasksCompleted, crewNote, entries, materialsUsed } = body

  if (!siteId || !date) return { error: 'Missing or invalid record fields' }
  if (tasksCompleted !== undefined && !Array.isArray(tasksCompleted)) {
    return { error: 'Missing or invalid record fields' }
  }

  const fields = {
    siteId,
    crewId: crewId || undefined,
    date,
    tasksCompleted: tasksCompleted || [],
    crewNote: String(crewNote ?? '').trim() || undefined,
    materialsUsed: Array.isArray(materialsUsed) ? materialsUsed : [],
  }

  if (Array.isArray(entries) && entries.length > 0) {
    const normalized = entries.map(normalizeEntry)
    if (normalized.some((entry) => !entry)) {
      return { error: 'Each worker needs a name and valid hours (0-24)' }
    }
    fields.entries = normalized
    fields.workersPresent = normalized.length
    fields.hoursWorked = round2(normalized.reduce((sum, e) => sum + e.hours, 0))
    return { fields }
  }

  if (!Number.isFinite(Number(body.workersPresent)) || !Number.isFinite(Number(body.hoursWorked))) {
    return { error: 'Missing or invalid record fields' }
  }
  fields.entries = []
  fields.workersPresent = Number(body.workersPresent)
  fields.hoursWorked = Number(body.hoursWorked)
  return { fields }
}
