import test from 'node:test'
import assert from 'node:assert/strict'
import { computePayroll } from '../src/utils/payroll.js'

const crew = {
  id: 1,
  name: 'Team A',
  members: ['Ivan', 'Petro'],
  member_rates: { Ivan: 10, Petro: 12 },
}

test('uses each worker\'s own hours and the rate on the entry', () => {
  const result = computePayroll(
    [{ crewId: 1, entries: [{ name: 'Ivan', hours: 8, rate: 100 }, { name: 'Petro', hours: 6, rate: 50 }] }],
    [crew]
  )
  const [team] = result.crews
  assert.equal(team.totalHours, 14)
  assert.deepEqual(team.members.map((m) => [m.name, m.hours, m.wage]), [
    ['Ivan', 8, 800],
    ['Petro', 6, 300],
  ])
  assert.equal(result.grandTotal, 1100)
})

test('falls back to the crew rate when the entry has none', () => {
  const { crews } = computePayroll(
    [{ crewId: 1, entries: [{ name: 'Ivan', hours: 5 }] }],
    [crew]
  )
  assert.equal(crews[0].members[0].wage, 50)
})

test('adds up the same worker across several records', () => {
  const { crews, grandTotal } = computePayroll(
    [
      { crewId: 1, entries: [{ name: 'Ivan', hours: 8, rate: 10 }] },
      { crewId: 1, entries: [{ name: 'Ivan', hours: 4, rate: 10 }] },
    ],
    [crew]
  )
  assert.equal(crews[0].members.length, 1)
  assert.equal(crews[0].members[0].hours, 12)
  assert.equal(grandTotal, 120)
})

test('workers logged without a crew land in their own group, listed last', () => {
  const { crews } = computePayroll(
    [
      { entries: [{ name: 'Solo', hours: 10, rate: 20 }] },
      { crewId: 1, entries: [{ name: 'Ivan', hours: 1, rate: 10 }] },
    ],
    [crew]
  )
  assert.equal(crews.length, 2)
  assert.equal(crews[0].crewId, 1)
  assert.equal(crews[1].crewId, null)
  assert.equal(crews[1].crewName, null)
  assert.equal(crews[1].totalWage, 200)
})

test('a record whose crew no longer exists is paid as no crew', () => {
  const { crews } = computePayroll(
    [{ crewId: 99, entries: [{ name: 'Ivan', hours: 2, rate: 10 }] }],
    [crew]
  )
  assert.equal(crews[0].crewId, null)
})

test('legacy records credit every crew member with the record hours', () => {
  const { crews } = computePayroll([{ crewId: 1, hoursWorked: 8 }], [crew])
  assert.deepEqual(crews[0].members.map((m) => [m.name, m.wage]), [
    ['Ivan', 80],
    ['Petro', 96],
  ])
})

test('legacy records without a crew are only counted as unassigned hours', () => {
  const result = computePayroll([{ hoursWorked: 7.5 }], [crew])
  assert.deepEqual(result.crews, [])
  assert.equal(result.unassignedHours, 7.5)
  assert.equal(result.grandTotal, 0)
})

test('amounts are rounded to cents', () => {
  const { crews } = computePayroll(
    [{ entries: [{ name: 'A', hours: 1 / 3, rate: 10 }] }],
    []
  )
  assert.equal(crews[0].members[0].wage, 3.33)
  assert.equal(crews[0].members[0].hours, 0.33)
})

test('empty input gives an empty payroll', () => {
  assert.deepEqual(computePayroll([], []), { crews: [], unassignedHours: 0, grandTotal: 0 })
})
