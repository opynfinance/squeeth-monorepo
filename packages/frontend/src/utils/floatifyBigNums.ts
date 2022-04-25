import BigNumber from 'bignumber.js'

/** Function for helping logging value that includes Big number  */
export default function floatifyBigNums(value: any): any {
  if (value instanceof BigNumber) {
    return value.toNumber()
  }

  if (value === null) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((v) => floatifyBigNums(v))
  }

  if (typeof value === 'object') {
    return Object.entries(value).reduce((acc, [k, v]) => {
      acc[k as any] = floatifyBigNums(v)
      return acc
    }, {} as any)
  }

  return value
}
