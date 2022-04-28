import { useAtom, useAtomValue } from 'jotai'
import { useUpdateAtom } from 'jotai/utils'

import { useVaultHistoryQuery } from '@hooks/useVaultHistory'
import { toTokenAmount } from '@utils/calculations'
import { calcDollarLongUnrealizedpnl, calcDollarShortUnrealizedpnl, calcETHCollateralPnl } from 'src/lib/pnl'
import { useComputeSwaps, useFirstValidVault, useSwaps } from '../positions/hooks'
import {
  buyQuoteAtom,
  ethCollateralPnlAtom,
  loadingAtom,
  longGainAtom,
  longUnrealizedPNLAtom,
  sellQuoteAtom,
  shortGainAtom,
  shortUnrealizedPNLAtom,
} from './atoms'
import { isWethToken0Atom, positionTypeAtom, swapsAtom } from '../positions/atoms'
import { readyAtom } from '../squeethPool/atoms'
import { useGetBuyQuote, useGetSellQuote } from '../squeethPool/hooks'
import { BIG_ZERO } from '@constants/index'
import { PositionType } from '../../types'
import { useVaultData } from '@hooks/useVaultData'
import { indexAtom } from '../controller/atoms'
import useAppEffect from '@hooks/useAppEffect'
import { useState } from 'react'

export function useEthCollateralPnl() {
  const { vaultId } = useFirstValidVault()
  const { vaultHistory, loading: vaultHistoryLoading } = useVaultHistoryQuery(vaultId)
  const { existingCollat, isVaultLoading } = useVaultData(vaultId)

  const index = useAtomValue(indexAtom)

  const [ethCollateralPnl, setEthCollateralPnl] = useAtom(ethCollateralPnlAtom)
  const [error, setError] = useState('')
  const swapsData = useAtomValue(swapsAtom)

  useAppEffect(() => {
    ;(async () => {
      if (
        vaultHistory?.length &&
        !index.isZero() &&
        !existingCollat.isZero() &&
        swapsData?.swaps?.length &&
        !vaultHistoryLoading &&
        !isVaultLoading
      ) {
        try {
          const result = await calcETHCollateralPnl(vaultHistory, toTokenAmount(index, 18).sqrt(), existingCollat)

          setEthCollateralPnl(result)
        } catch (e) {
          if (e instanceof Error) {
            setError(e.message)
          }
        }
      }
    })()
  }, [existingCollat, index, setEthCollateralPnl, swapsData?.swaps, vaultHistory, isVaultLoading, vaultHistoryLoading])

  return { ethCollateralPnl, error }
}

export function useBuyAndSellQuote() {
  const { loading: positionsLoading } = useSwaps()
  const { squeethAmount } = useComputeSwaps()
  const getSellQuote = useGetSellQuote()
  const getBuyQuote = useGetBuyQuote()
  const [buyQuote, setBuyQuote] = useAtom(buyQuoteAtom)
  const [sellQuote, setSellQuote] = useAtom(sellQuoteAtom)
  const setLoading = useUpdateAtom(loadingAtom)
  const ready = useAtomValue(readyAtom)

  useAppEffect(() => {
    if (!ready || positionsLoading) return

    const p1 = getSellQuote(squeethAmount).then(setSellQuote)
    const p2 = getBuyQuote(squeethAmount).then((val) => setBuyQuote(val.amountIn))
    Promise.all([p1, p2]).then(() => setLoading(false))
  }, [getBuyQuote, getSellQuote, positionsLoading, ready, squeethAmount, setBuyQuote, setLoading, setSellQuote])

  return { buyQuote, sellQuote }
}

export function useLongGain() {
  const { totalUSDFromBuy } = useComputeSwaps()
  const sellQuote = useAtomValue(sellQuoteAtom)
  const loading = useAtomValue(loadingAtom)
  const [longGain, setLongGain] = useAtom(longGainAtom)
  const longUnrealizedPNL = useAtomValue(longUnrealizedPNLAtom)

  useAppEffect(() => {
    if (sellQuote.amountOut.isZero() && !loading) {
      setLongGain(BIG_ZERO)
      return
    }

    const _gain = longUnrealizedPNL.usd.dividedBy(totalUSDFromBuy).times(100)
    setLongGain(_gain)
  }, [loading, longUnrealizedPNL.usd, sellQuote.amountOut, totalUSDFromBuy, setLongGain])

  return longGain
}

export function useShortGain() {
  const { squeethAmount, totalUSDFromSell } = useComputeSwaps()
  const [shortGain, setShortGain] = useAtom(shortGainAtom)
  const shortUnrealizedPNL = useAtomValue(shortUnrealizedPNLAtom)
  const { vaultId } = useFirstValidVault()
  const { existingCollat } = useVaultData(vaultId)
  const index = useAtomValue(indexAtom)

  useAppEffect(() => {
    if (squeethAmount.isZero() || shortUnrealizedPNL.usd.isZero()) {
      setShortGain(BIG_ZERO)
      return
    }

    const _gain = shortUnrealizedPNL.usd
      .dividedBy(totalUSDFromSell.plus(existingCollat.times(toTokenAmount(index, 18).sqrt())))
      .times(100)

    setShortGain(_gain)
  }, [index, existingCollat, shortUnrealizedPNL.usd, squeethAmount, totalUSDFromSell, setShortGain])

  return shortGain
}

export function useLongUnrealizedPNL() {
  const { squeethAmount } = useComputeSwaps()
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const positionType = useAtomValue(positionTypeAtom)
  const sellQuote = useAtomValue(sellQuoteAtom)
  const [longUnrealizedPNL, setLongUnrealizedPNL] = useAtom(longUnrealizedPNLAtom)
  const index = useAtomValue(indexAtom)

  const swapsData = useAtomValue(swapsAtom)
  const swaps = swapsData?.swaps

  useAppEffect(() => {
    ;(async () => {
      if (
        swaps?.length &&
        !sellQuote.amountOut.isZero() &&
        !index.isZero() &&
        !squeethAmount.isZero() &&
        positionType === PositionType.LONG
      ) {
        const pnl = await calcDollarLongUnrealizedpnl(
          swaps,
          isWethToken0,
          sellQuote,
          toTokenAmount(index, 18).sqrt(),
          squeethAmount,
        )
        setLongUnrealizedPNL((prevState) => ({ ...prevState, ...pnl }))
      } else {
        setLongUnrealizedPNL((prevState) => ({ ...prevState, loading: true }))
      }
    })()
  }, [index, isWethToken0, sellQuote.amountOut, swaps, squeethAmount, positionType, setLongUnrealizedPNL, sellQuote])

  return longUnrealizedPNL
}

export function useShortUnrealizedPNL() {
  const { squeethAmount } = useComputeSwaps()
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const positionType = useAtomValue(positionTypeAtom)
  const buyQuote = useAtomValue(buyQuoteAtom)
  const { ethCollateralPnl, error } = useEthCollateralPnl()
  const [shortUnrealizedPNL, setShortUnrealizedPNL] = useAtom(shortUnrealizedPNLAtom)
  const index = useAtomValue(indexAtom)

  const { loading: swapsLoading } = useSwaps()
  const swapsData = useAtomValue(swapsAtom)
  const swaps = swapsData?.swaps

  useAppEffect(() => {
    ;(async () => {
      if (error) {
        setShortUnrealizedPNL((prevState) => ({
          ...prevState,
          error,
        }))
      } else if (
        swaps?.length &&
        !buyQuote.isZero() &&
        !index.isZero() &&
        !squeethAmount.isZero() &&
        positionType === PositionType.SHORT &&
        !swapsLoading
      ) {
        const pnl = await calcDollarShortUnrealizedpnl(
          swaps,
          isWethToken0,
          buyQuote,
          toTokenAmount(index, 18).sqrt(),
          squeethAmount,
          ethCollateralPnl,
        )

        setShortUnrealizedPNL((prevState) => ({
          ...prevState,
          ...pnl,
        }))
      } else {
        setShortUnrealizedPNL((prevState) => ({ ...prevState, loading: true }))
      }
    })()
  }, [
    buyQuote,
    ethCollateralPnl,
    index,
    isWethToken0,
    swaps,
    squeethAmount,
    positionType,
    setShortUnrealizedPNL,
    swapsLoading,
  ])

  return shortUnrealizedPNL
}
