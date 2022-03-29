import stringifyBigNumDeps from '@utils/stringifyBigNumDeps'
import { useEffect } from 'react'
import { DependencyList } from 'react'
import { EffectCallback } from 'react'

export default function useAppEffect(effect: EffectCallback, deps?: DependencyList) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, stringifyBigNumDeps(deps))
}
