import stringifyDeps from '@utils/stringifyDeps'
import { useEffect } from 'react'
import { DependencyList } from 'react'
import { EffectCallback } from 'react'

export default function useAppEffect(effect: EffectCallback, deps?: DependencyList, lengthAsArrDep?: boolean) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, stringifyDeps(deps, lengthAsArrDep))
}
