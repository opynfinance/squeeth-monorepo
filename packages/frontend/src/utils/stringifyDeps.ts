import BigNumber from 'bignumber.js'
import { DependencyList } from 'react'

export default function stringifyDeps(deps?: DependencyList) {
  return deps?.map((dep) => {
    if (dep instanceof BigNumber) {
      return dep.toString()
    }

    if (Array.isArray(dep) && dep.every((item) => item.hasOwnProperty('id'))) {
      return dep.map((item) => item.id).join(',')
    }

    return dep
  })
}
