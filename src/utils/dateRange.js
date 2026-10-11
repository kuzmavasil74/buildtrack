// Adds an inclusive `date` range to a Mongo filter. `from` and `to` are
// "YYYY-MM-DD" strings; `to` covers the whole of that day.
export const applyDateRange = (filter, from, to) => {
  if (!from && !to) return filter
  filter.date = {}
  if (from) filter.date.$gte = new Date(from)
  if (to) {
    const toDate = new Date(to)
    toDate.setUTCHours(23, 59, 59, 999)
    filter.date.$lte = toDate
  }
  return filter
}
