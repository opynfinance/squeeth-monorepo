import stringifyDeps from '@utils/stringifyDeps'
import { useCallback } from 'react'
import { DependencyList } from 'react'

export default function useAppCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: DependencyList,
  lengthAsArrDep?: boolean,
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(callback, stringifyDeps(deps, lengthAsArrDep) ?? [])
}
