export const formatCurrency: (
  number: number,
  locales?: Intl.LocalesArgument,
  formatOptions?: Intl.NumberFormatOptions,
) => string = (
  number,
  locales = 'en-us',
  formatOptions = {
    style: 'currency',
    currency: 'USD',
  },
) => {
  return number.toLocaleString(locales, formatOptions)
}

export const formatBalance: (number: number) => string = (number) => {
  return number.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 4,
  })
}

export const formatNumber: (number: number, decimals?: number) => string = (number, decimals = 2) => {
  return number.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}