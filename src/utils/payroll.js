const round2 = (n) => Math.round(n * 100) / 100

// Turns daily records into wages. Pure: no database access.
//   records: DailyRecord documents (or plain objects) with `entries`, `crewId`, `hoursWorked`
//   crewRows: rows of the crews table ({ id, name, members, member_rates })
//
// A worker's hourly rate comes from their entry; entries without a rate fall
// back to the crew's rate for that name. Records saved before per-worker
// entries existed credit every member of the crew with the record's hours.
export const computePayroll = (records, crewRows) => {
  const crewById = new Map(crewRows.map((crew) => [crew.id, crew]))

  // crew id (null = people logged without a crew) -> name -> { hours, wage }
  const groups = new Map()
  const addHours = (crewId, name, hours, rate) => {
    if (!groups.has(crewId)) groups.set(crewId, new Map())
    const people = groups.get(crewId)
    const person = people.get(name) || { hours: 0, wage: 0 }
    person.hours += hours
    person.wage += hours * rate
    people.set(name, person)
  }

  let unassignedHours = 0
  for (const record of records) {
    const crew = record.crewId != null ? crewById.get(record.crewId) : undefined
    const crewRate = (name) => Number(crew?.member_rates?.[name]) || 0

    if (record.entries?.length) {
      for (const entry of record.entries) {
        const rate = Number.isFinite(entry.rate) ? entry.rate : crewRate(entry.name)
        addHours(crew ? crew.id : null, entry.name, entry.hours, rate)
      }
    } else if (crew) {
      for (const name of crew.members || []) {
        addHours(crew.id, name, record.hoursWorked || 0, crewRate(name))
      }
    } else {
      unassignedHours += record.hoursWorked || 0
    }
  }

  const crews = [...groups.entries()]
    .map(([crewId, people]) => {
      const members = [...people.entries()].map(([name, { hours, wage }]) => ({
        name,
        hours: round2(hours),
        wage: round2(wage),
        rate: hours > 0 ? round2(wage / hours) : 0,
      }))
      return {
        crewId,
        crewName: crewId != null ? crewById.get(crewId).name : null,
        totalHours: round2(members.reduce((sum, m) => sum + m.hours, 0)),
        totalWage: round2(members.reduce((sum, m) => sum + m.wage, 0)),
        members,
      }
    })
    .filter((crew) => crew.totalHours > 0)
    .sort((a, b) => (a.crewId === null) - (b.crewId === null))

  const grandTotal = round2(crews.reduce((sum, crew) => sum + crew.totalWage, 0))

  return { crews, unassignedHours: round2(unassignedHours), grandTotal }
}
