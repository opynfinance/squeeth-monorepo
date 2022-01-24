import { useEffect, useRef } from 'react'
import { clearIntervalAsync, setIntervalAsync } from 'set-interval-async/dynamic'

type Callback = () => void

/**
 * for calling async functions at intervals
 * @param callback the async callback function
 * @param interval, the interval in milliseconds, it must be at least 10ms
 * @returns {void}
 */
export function useIntervalAsync(callback: Callback, interval: number) {
  const savedCallback = useRef<Callback>(callback)

  if (interval < 10) {
    throw new Error('Interval must be at least 10ms')
  }

  // if the provided function changes, change its reference
  useEffect(() => {
    if (typeof callback === 'function') {
      savedCallback.current = callback
    }
  }, [callback])

  useEffect(() => {
    const timer = setIntervalAsync(savedCallback.current, interval)

    return () => {
      clearIntervalAsync(timer)
    }
  }, [interval])
}
