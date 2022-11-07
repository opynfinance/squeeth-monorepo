export const formatNumber: (number: number, decimals?: number) => string = (number, decimals = 2) => {
  return number.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
