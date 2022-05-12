import React, { useContext, useReducer, Reducer } from 'react'

import { useAtomValue } from 'jotai'
import { addressesAtom } from 'src/state/positions/atoms'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { OSQUEETH_DECIMALS } from '@constants/index'
import useAppEffect from '@hooks/useAppEffect'

export enum Steps {
  SELECT_METHOD = 1,
  GET_SQUEETH,
  PROVIDE_LIQUIDITY,
}

export enum OBTAIN_METHOD {
  MINT = 1,
  BUY,
}

type LPType = {
  step: Steps
  mostForwardStep: Steps
  obtainMethod: OBTAIN_METHOD
  canGoBack: boolean
  canGoForward: boolean
}

type LPContextType = {
  lpState: LPType
  dispatch: React.Dispatch<ActionType>
}

const initialState: LPType = {
  step: Steps.SELECT_METHOD,
  mostForwardStep: Steps.SELECT_METHOD,
  obtainMethod: OBTAIN_METHOD.MINT,
  canGoBack: false,
  canGoForward: false,
}

export enum LPActions {
  SELECT_METHOD,
  GO_BACK,
  GO_FORWARD,
  GO_TO_PROVIDE_LIQUIDITY,
}

export type ActionType = {
  type: LPActions
  payload?: any
}

const updateBoundary = (newState: LPType) => {
  const canGoBack = newState.step > Steps.SELECT_METHOD
  const canGoForward = newState.step < newState.mostForwardStep

  return { ...newState, canGoBack, canGoForward }
}

const tradeReducer: (state: LPType, action: any) => LPType = (state, action: ActionType) => {
  console.log(state)
  switch (action.type) {
    case LPActions.SELECT_METHOD:
      return updateBoundary({
        ...state,
        step: Steps.GET_SQUEETH,
        mostForwardStep: state.mostForwardStep === Steps.SELECT_METHOD ? Steps.GET_SQUEETH : state.mostForwardStep,
        obtainMethod: action.payload,
      })
    case LPActions.GO_BACK:
      if (!state.canGoBack) return state
      return updateBoundary({ ...state, step: state.step - 1 })
    case LPActions.GO_FORWARD:
      if (!state.canGoForward) return state
      return updateBoundary({ ...state, step: state.step + 1 })
    case LPActions.GO_TO_PROVIDE_LIQUIDITY:
      return updateBoundary({ ...state, step: Steps.PROVIDE_LIQUIDITY, mostForwardStep: Steps.PROVIDE_LIQUIDITY })
    default:
      return state
  }
}

const LPContext = React.createContext<LPContextType>({ lpState: initialState, dispatch: () => null })
const useLPState = () => useContext<LPContextType>(LPContext)

const LPProvider: React.FC = ({ children }) => {
  const [lpState, dispatch] = useReducer<Reducer<LPType, ActionType>>(tradeReducer, initialState)

  const { oSqueeth } = useAtomValue(addressesAtom)
  const { value: oSqueethBal } = useTokenBalance(oSqueeth, 15, OSQUEETH_DECIMALS)

  useAppEffect(() => {
    if (oSqueethBal.isZero() || lpState.step === Steps.PROVIDE_LIQUIDITY) return

    dispatch({ type: LPActions.GO_TO_PROVIDE_LIQUIDITY })
  }, [oSqueethBal])

  return <LPContext.Provider value={{ lpState, dispatch }}>{children}</LPContext.Provider>
}

export { LPProvider, useLPState }
