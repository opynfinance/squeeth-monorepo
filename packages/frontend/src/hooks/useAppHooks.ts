import { useMemo } from 'react'
import { useCallback } from 'react'
import { useEffect } from 'react'
import { DependencyList, EffectCallback } from 'react'

export function useAppEffect(effect: EffectCallback, deps?: DependencyList) {
  const updatedDeps = useMemo(
    () => deps?.map((dep) => (typeof dep.isZero === 'function' ? dep.toString() : dep)),
    [deps],
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, [updatedDeps])
}

export function useAppCallback(callback: (...args: any[]) => any, deps?: DependencyList) {
  const updatedDeps = useMemo(
    () => deps?.map((dep) => (typeof dep.isZero === 'function' ? dep.toString() : dep)),
    [deps],
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(callback, [updatedDeps])
}

export function useAppMemo(callback: (...args: any[]) => any, deps?: DependencyList) {
  const updatedDeps = useMemo(
    () => deps?.map((dep) => (typeof dep.isZero === 'function' ? dep.toString() : dep)),
    [deps],
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(callback, [updatedDeps])
}
