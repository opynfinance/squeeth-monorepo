import BigNumber from 'bignumber.js'
import { DependencyList } from 'react'

export default function stringifyDeps(deps?: DependencyList, lengthAsArrDep?: boolean) {
  return deps?.map((dep) => {
    if (dep instanceof BigNumber) {
      return dep.toString()
    }

    if (Array.isArray(dep)) {
      if (lengthAsArrDep) {
        return dep.length
      }

      if (dep.every((item) => item?.hasOwnProperty('id'))) {
        return dep.map((item) => item.id).join(',')
      }
    }

    return dep
  })
}
