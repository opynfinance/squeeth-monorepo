import { useEffect, useMemo, useState } from 'react'

export function useAsyncMemo<T>(
  callback: () => Promise<T>,
  init: T,
  dependencies: any[] = [],
  onError?: (e: Error) => void,
): T {
  const [output, setOutput] = useState<T>(init)

  // eslint-disable-next-line
  const _callback = useMemo(callback, dependencies)

  useEffect(() => {
    let isNotCancelled = true

    _callback.then((payload) => {
      if (isNotCancelled) {
        setOutput(payload)
      }
    })

    return () => {
      isNotCancelled = false
    }
  }, [_callback])

  useEffect(() => {
    _callback.catch(onError)
  }, [_callback, onError])

  return output
}

export default useAsyncMemo
