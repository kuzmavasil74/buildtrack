// Currencies a user can pick for payroll amounts (ISO 4217 codes).
export const CURRENCIES = ['UAH', 'EUR', 'PLN', 'CZK', 'USD']
export const DEFAULT_CURRENCY = 'UAH'

export const isSupportedCurrency = (value) => CURRENCIES.includes(value)
