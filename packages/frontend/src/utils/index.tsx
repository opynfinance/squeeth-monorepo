export * from './pricer'

export function getCost(amount: number, price: number) {
  return amount * price
}
