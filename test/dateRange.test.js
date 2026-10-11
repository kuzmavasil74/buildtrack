import test from 'node:test'
import assert from 'node:assert/strict'
import { applyDateRange } from '../src/utils/dateRange.js'

test('no dates leaves the filter alone', () => {
  assert.deepEqual(applyDateRange({ userId: 1 }), { userId: 1 })
})

test('the range is inclusive of both the first and the last day', () => {
  const filter = applyDateRange({}, '2026-09-01', '2026-09-30')
  const stored = (d) => new Date(`${d}T00:00:00.000Z`) // how records store their date
  assert.ok(stored('2026-09-01') >= filter.date.$gte)
  assert.ok(stored('2026-09-30') <= filter.date.$lte)
  assert.ok(stored('2026-08-31') < filter.date.$gte)
  assert.ok(stored('2026-10-01') > filter.date.$lte)
})

test('only one bound can be given', () => {
  assert.deepEqual(Object.keys(applyDateRange({}, '2026-09-01').date), ['$gte'])
  assert.deepEqual(Object.keys(applyDateRange({}, undefined, '2026-09-30').date), ['$lte'])
})
