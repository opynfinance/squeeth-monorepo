import stringifyDeps from '@utils/stringifyDeps'
import { useMemo } from 'react'
import { DependencyList } from 'react'

export default function useAppMemo<T>(factory: () => T, deps?: DependencyList, lengthAsArrDep?: boolean) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, stringifyDeps(deps, lengthAsArrDep))
}
