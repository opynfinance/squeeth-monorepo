import BigNumber from 'bignumber.js'
import { createContext } from 'react'
import { useAtomValue } from 'jotai'
import { useUpdateAtom } from 'jotai/utils'
import { BIG_ZERO, OSQUEETH_DECIMALS } from '@constants/index'
import { addressesAtom, isWethToken0Atom, positionTypeAtom, isToHidePnLAtom } from './atoms'
import { useUsdAmount } from '@hooks/useUsdAmount'
import { PositionType } from '../../types'
import { useSwaps } from './hooks'
import useAppMemo from '@hooks/useAppMemo'
import { FC } from 'react'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import useAppEffect from '@hooks/useAppEffect'
interface ComputeSwapsContextValue {
  squeethAmount: BigNumber
  wethAmount: BigNumber
  longUsdAmount: BigNumber
  shortUsdAmount: BigNumber
  boughtSqueeth: BigNumber
  soldSqueeth: BigNumber
  totalUSDFromBuy: BigNumber
  totalUSDFromSell: BigNumber
}

export const ComputeSwapsContext = createContext<ComputeSwapsContextValue | null>(null)

export const ComputeSwapsProvider: FC = ({ children }) => {
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const setPositionType = useUpdateAtom(positionTypeAtom)
  const setIsToHidePnL = useUpdateAtom(isToHidePnLAtom)
  const { getUsdAmt } = useUsdAmount()
  const { data } = useSwaps()
  const { oSqueeth } = useAtomValue(addressesAtom)
  const { value: oSqueethBal, refetch } = useTokenBalance(oSqueeth, 15, OSQUEETH_DECIMALS)

  const computedSwaps = useAppMemo(
    () =>
      data?.swaps.reduce(
        (acc, s) => {
          //values are all from the pool pov
          //if >0 for the pool, user gave some squeeth to the pool, meaning selling the squeeth
          const squeethAmt = new BigNumber(isWethToken0 ? s.amount1 : s.amount0)
          const wethAmt = new BigNumber(isWethToken0 ? s.amount0 : s.amount1)
          const usdAmt = getUsdAmt(wethAmt, s.timestamp)
          //buy one squeeth means -1 to the pool, +1 to the user
          acc.squeethAmount = acc.squeethAmount.plus(squeethAmt.negated())
          //<0 means, buying squeeth
          //>0 means selling squeeth
          if (squeethAmt.isPositive()) {
            //sold Squeeth amount
            acc.soldSqueeth = acc.soldSqueeth.plus(squeethAmt.abs())
            //usd value from sell to close long position or open short
            acc.totalUSDFromSell = acc.totalUSDFromSell.plus(usdAmt.abs())
          } else if (squeethAmt.isNegative()) {
            //bought Squeeth amount
            acc.boughtSqueeth = acc.boughtSqueeth.plus(squeethAmt.abs())
            //usd value from buy to close short position or open long
            acc.totalUSDFromBuy = acc.totalUSDFromBuy.plus(usdAmt.abs())
          }
          if (acc.squeethAmount.isZero()) {
            acc.longUsdAmount = BIG_ZERO
            acc.shortUsdAmount = BIG_ZERO
            acc.wethAmount = BIG_ZERO
            acc.boughtSqueeth = BIG_ZERO
            acc.soldSqueeth = BIG_ZERO
            acc.totalUSDFromSell = BIG_ZERO
            acc.totalUSDFromBuy = BIG_ZERO
          } else {
            // when the position is partially closed, will accumulate usdamount
            acc.longUsdAmount = acc.longUsdAmount.plus(usdAmt)
            acc.shortUsdAmount = acc.shortUsdAmount.plus(usdAmt.negated())
            acc.wethAmount = acc.wethAmount.plus(wethAmt.negated())
          }
          return acc
        },
        {
          squeethAmount: BIG_ZERO,
          wethAmount: BIG_ZERO,
          longUsdAmount: BIG_ZERO,
          shortUsdAmount: BIG_ZERO,
          boughtSqueeth: BIG_ZERO,
          soldSqueeth: BIG_ZERO,
          totalUSDFromBuy: BIG_ZERO,
          totalUSDFromSell: BIG_ZERO,
        },
      ) || {
        squeethAmount: BIG_ZERO,
        wethAmount: BIG_ZERO,
        longUsdAmount: BIG_ZERO,
        shortUsdAmount: BIG_ZERO,
        boughtSqueeth: BIG_ZERO,
        soldSqueeth: BIG_ZERO,
        totalUSDFromBuy: BIG_ZERO,
        totalUSDFromSell: BIG_ZERO,
      },
    [isWethToken0, data?.swaps, getUsdAmt],
  )

  useAppEffect(() => {
    if (computedSwaps.squeethAmount.isGreaterThan(0) && oSqueethBal?.isGreaterThan(0)) {
      setPositionType(PositionType.LONG)
      // check if user osqth wallet balance is equal to the accumulated amount from tx history
      // if it's not the same, it's likely that they do smt on crab acution or otc or lp etc so dont show the pnl for them
      if (!computedSwaps.squeethAmount.isEqualTo(oSqueethBal)) {
        setIsToHidePnL(true)
      } else {
        setIsToHidePnL(false)
      }
    } else if (computedSwaps.squeethAmount.isLessThan(0)) {
      setIsToHidePnL(true)
      setPositionType(PositionType.SHORT)
    } else {
      setIsToHidePnL(false)
      setPositionType(PositionType.NONE)
    }
  }, [computedSwaps.squeethAmount, oSqueethBal, setPositionType])

  useAppEffect(() => {
    refetch()
  }, [computedSwaps.squeethAmount, refetch])

  const value = useAppMemo(
    () => ({
      ...computedSwaps,
      squeethAmount:
        computedSwaps.squeethAmount.isGreaterThan(0) && computedSwaps.squeethAmount.isGreaterThan(oSqueethBal)
          ? oSqueethBal
          : computedSwaps.squeethAmount.absoluteValue(),
    }),
    [computedSwaps, oSqueethBal],
  )

  return <ComputeSwapsContext.Provider value={value}>{children}</ComputeSwapsContext.Provider>
}
