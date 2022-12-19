import { useCallback, useRef } from 'react'

const useExecuteOnce = (fn?: any) => {
  const executedRef = useRef(false)

  const executeFunction = useCallback(
    (...params) => {
      if (!executedRef.current) {
        fn?.(...params)
        executedRef.current = true
      }
    },
    [fn],
  )

  const reset = () => (executedRef.current = false)

  return [executeFunction, reset]
}

export default useExecuteOnce
