import test from 'node:test'
import assert from 'node:assert/strict'
import { CURRENCIES, DEFAULT_CURRENCY, isSupportedCurrency } from '../src/config/currencies.js'

test('the default currency is one of the supported ones', () => {
  assert.ok(CURRENCIES.includes(DEFAULT_CURRENCY))
})

test('accepts supported ISO codes and nothing else', () => {
  for (const code of CURRENCIES) assert.equal(isSupportedCurrency(code), true)
  for (const bad of ['', 'uah', 'BTC', 'EURO', null, undefined, 5, ['EUR']]) {
    assert.equal(isSupportedCurrency(bad), false, `should reject ${String(bad)}`)
  }
})
