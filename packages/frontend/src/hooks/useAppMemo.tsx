import stringifyBigNumDeps from '@utils/stringifyBigNumDeps'
import { useMemo } from 'react'
import { DependencyList } from 'react'

export default function useAppMemo<T>(factory: () => T, deps?: DependencyList) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, stringifyBigNumDeps(deps))
}
