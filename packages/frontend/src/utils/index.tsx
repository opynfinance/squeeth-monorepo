export * from './pricer'

export function getCost(amount: number, price: number) {
  return amount * price
}

export function getTimestampAgo(amount: number, timeType: 'hour' | 'day' | 'month' | 'year' = 'hour') {
  const newDate = new Date()
  if (timeType === 'day') {
    newDate.setDate(newDate.getDate() - amount)
  } else if (timeType == 'month') {
    newDate.setMonth(newDate.getMonth() - amount)
  } else if (timeType === 'year') {
    newDate.setFullYear(newDate.getFullYear() - amount)
  } else {
    newDate.setHours(newDate.getHours() - amount)
  }
  return Math.floor(newDate.getTime() / 1000)
}
