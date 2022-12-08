import React, { useState, useCallback } from 'react'

const useStateWithReset = <S>(
  initialState: S | (() => S),
): [S, React.Dispatch<React.SetStateAction<S>>, () => void] => {
  const [state, setState] = useState(initialState)

  const resetState = useCallback(() => setState(initialState), [initialState])
  return [state, setState, resetState]
}

export default useStateWithReset
