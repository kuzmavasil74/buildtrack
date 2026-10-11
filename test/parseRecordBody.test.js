import test from 'node:test'
import assert from 'node:assert/strict'
import { hoursBetween, parseRecordBody } from '../src/utils/parseRecordBody.js'

const base = { siteId: 1, date: '2026-10-01' }

test('hoursBetween subtracts the 30-minute lunch break', () => {
  assert.equal(hoursBetween('07:00', '19:00'), 11.5)
  assert.equal(hoursBetween('07:00', '15:30'), 8)
  assert.equal(hoursBetween('08:00', '16:00'), 7.5)
})

test('hoursBetween handles a shift that crosses midnight', () => {
  assert.equal(hoursBetween('22:00', '06:00'), 7.5)
})

test('hoursBetween never goes below zero', () => {
  assert.equal(hoursBetween('09:00', '09:15'), 0)
  assert.equal(hoursBetween('09:00', '09:00'), 0)
})

test('entries: totals are derived from the workers', () => {
  const { fields, error } = parseRecordBody({
    ...base,
    entries: [
      { name: 'Ivan', hours: 8, rate: 100 },
      { name: ' Petro ', hours: '6.5' },
    ],
  })
  assert.equal(error, undefined)
  assert.equal(fields.workersPresent, 2)
  assert.equal(fields.hoursWorked, 14.5)
  assert.equal(fields.entries[1].name, 'Petro')
  assert.equal(fields.entries[1].hours, 6.5)
})

test('entries: hours come from start/end when not given', () => {
  const { fields } = parseRecordBody({
    ...base,
    entries: [{ name: 'Ivan', startTime: '07:00', endTime: '19:00' }],
  })
  assert.equal(fields.entries[0].hours, 11.5)
})

test('entries: an explicit hours value wins over start/end', () => {
  const { fields } = parseRecordBody({
    ...base,
    entries: [{ name: 'Ivan', startTime: '07:00', endTime: '19:00', hours: 10 }],
  })
  assert.equal(fields.entries[0].hours, 10)
})

test('entries: rejects a missing name, bad hours, bad times and negative rates', () => {
  const bad = [
    { name: '', hours: 5 },
    { name: 'A', hours: 25 },
    { name: 'A', hours: -1 },
    { name: 'A' },
    { name: 'A', hours: 5, startTime: '7am' },
    { name: 'A', hours: 5, rate: -3 },
  ]
  for (const entry of bad) {
    const { error } = parseRecordBody({ ...base, entries: [entry] })
    assert.ok(error, `expected an error for ${JSON.stringify(entry)}`)
  }
})

test('legacy records without entries keep their own totals', () => {
  const { fields, error } = parseRecordBody({
    ...base,
    workersPresent: 3,
    hoursWorked: 24,
    tasksCompleted: ['walls'],
  })
  assert.equal(error, undefined)
  assert.deepEqual(fields.entries, [])
  assert.equal(fields.workersPresent, 3)
  assert.equal(fields.hoursWorked, 24)
})

test('requires a site and a date, and totals when there are no entries', () => {
  assert.ok(parseRecordBody({ date: '2026-10-01' }).error)
  assert.ok(parseRecordBody({ siteId: 1 }).error)
  assert.ok(parseRecordBody({ ...base }).error)
})

test('an empty crew id becomes undefined; the crew note is trimmed', () => {
  const { fields } = parseRecordBody({
    ...base,
    crewId: '',
    crewNote: '  poured concrete  ',
    entries: [{ name: 'A', hours: 1 }],
  })
  assert.equal(fields.crewId, undefined)
  assert.equal(fields.crewNote, 'poured concrete')
})
