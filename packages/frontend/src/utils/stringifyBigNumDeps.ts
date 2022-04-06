import BigNumber from 'bignumber.js'
import { DependencyList } from 'react'

export default function stringifyBigNumDeps(deps?: DependencyList) {
  return deps?.map((dep) => (dep instanceof BigNumber ? dep.toString() : dep))
}
