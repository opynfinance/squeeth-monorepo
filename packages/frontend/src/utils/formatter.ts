import { toTokenAmount } from '@utils/calculations'
import BigNumber from 'bignumber.js'

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
  let maximumFractionDigits = 2
  if (number <= 0.005) {
    maximumFractionDigits = 4
  } else if (number <= 0.05) {
    maximumFractionDigits = 3
  }

  return number.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  })
}

export const formatNumber: (number: number, decimals?: number) => string = (number, decimals = 2) => {
  return number.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export const formatTokenAmount: (amount: BigNumber | number | string, tokenDecimals: number) => string = (
  amount,
  tokenDecimals,
) => {
  const tokenAmount = toTokenAmount(amount, tokenDecimals)

  let maximumFractionDigits = 2
  if (tokenAmount.lte(0.005)) {
    maximumFractionDigits = 4
  } else if (tokenAmount.lte(0.05)) {
    maximumFractionDigits = 3
  }

  return tokenAmount.toNumber().toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  })
}
