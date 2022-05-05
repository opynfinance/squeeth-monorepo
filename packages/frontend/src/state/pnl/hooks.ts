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
import {
  isWethToken0Atom,
  positionTypeAtom,
  longPositionValueAtom,
  shortPositionValueAtom,
  swapsAtom,
} from '../positions/atoms'
import { readyAtom } from '../squeethPool/atoms'
import { useGetBuyQuote, useGetSellQuote, useGetWSqueethPositionValue } from '../squeethPool/hooks'
import { BIG_ZERO } from '@constants/index'
import { PositionType } from '../../types'
import { useVaultData } from '@hooks/useVaultData'
import { indexAtom } from '../controller/atoms'
import useAppEffect from '@hooks/useAppEffect'

export function useEthCollateralPnl() {
  const { vaultId } = useFirstValidVault()
  const { vaultHistory, loading: vaultHistoryLoading } = useVaultHistoryQuery(vaultId)
  const { existingCollat, isVaultLoading } = useVaultData(vaultId)

  const index = useAtomValue(indexAtom)

  const [ethCollateralPnl, setEthCollateralPnl] = useAtom(ethCollateralPnlAtom)
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
        const result = await calcETHCollateralPnl(vaultHistory, toTokenAmount(index, 18).sqrt(), existingCollat)
        setEthCollateralPnl(result)
      }
    })()
  }, [existingCollat, index, setEthCollateralPnl, swapsData?.swaps, vaultHistory, isVaultLoading, vaultHistoryLoading])

  return ethCollateralPnl
}

/* depreciated */
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

export function useCurrentLongPositionValue() {
  const { squeethAmount } = useComputeSwaps()
  const getWSqueethPositionValue = useGetWSqueethPositionValue()
  const [positionValue, setPositionValue] = useAtom(longPositionValueAtom)
  const positionType = useAtomValue(positionTypeAtom)

  useAppEffect(() => {
    if (squeethAmount.isZero() || positionType != PositionType.LONG) {
      setPositionValue(BIG_ZERO)
      return
    }

    const squeethPositionValueInUSD = getWSqueethPositionValue(squeethAmount)
    setPositionValue(squeethPositionValueInUSD)
  }, [squeethAmount, positionType, getWSqueethPositionValue, setPositionValue])

  return positionValue
}

export function useCurrentShortPositionValue() {
  const { squeethAmount } = useComputeSwaps()
  const getWSqueethPositionValue = useGetWSqueethPositionValue()
  const { vaultId } = useFirstValidVault()
  const { existingCollat } = useVaultData(vaultId)
  const index = useAtomValue(indexAtom)
  const [positionValue, setPositionValue] = useAtom(shortPositionValueAtom)
  const positionType = useAtomValue(positionTypeAtom)

  useAppEffect(() => {
    if (squeethAmount.isZero() || existingCollat.isZero() || index.isZero() || positionType != PositionType.SHORT) {
      setPositionValue(BIG_ZERO)
      return
    }

    const squeethPositionValueInUSD = getWSqueethPositionValue(squeethAmount)
    setPositionValue(squeethPositionValueInUSD.plus(existingCollat.times(toTokenAmount(index, 18).sqrt())))
  }, [squeethAmount, existingCollat, index, setPositionValue, positionType, getWSqueethPositionValue])

  return positionValue
}

export function useLongGain() {
  const [longGain, setLongGain] = useAtom(longGainAtom)
  const longUnrealizedPNL = useAtomValue(longUnrealizedPNLAtom)
  const longPositionValue = useAtomValue(longPositionValueAtom)
  const positionType = useAtomValue(positionTypeAtom)
  const setLoading = useUpdateAtom(loadingAtom)

  useAppEffect(() => {
    if (longPositionValue.isZero() && positionType != PositionType.LONG) {
      setLongGain(BIG_ZERO)
      setLoading(false)

      return
    }
    const _gain = longUnrealizedPNL.usd.dividedBy(longPositionValue).times(100)
    setLongGain(_gain)
    setLoading(false)
  }, [setLoading, longUnrealizedPNL.usd, positionType, longPositionValue, setLongGain])

  return longGain
}

export function useShortGain() {
  const [shortGain, setShortGain] = useAtom(shortGainAtom)
  const shortUnrealizedPNL = useAtomValue(shortUnrealizedPNLAtom)
  const shortPositionValue = useAtomValue(shortPositionValueAtom)
  const positionType = useAtomValue(positionTypeAtom)
  const setLoading = useUpdateAtom(loadingAtom)

  useAppEffect(() => {
    if (shortPositionValue.isZero() && positionType != PositionType.SHORT) {
      setShortGain(BIG_ZERO)
      setLoading(false)

      return
    }
    const _gain = shortUnrealizedPNL.usd.dividedBy(shortPositionValue).times(100)
    setShortGain(_gain)
    setLoading(false)
  }, [setLoading, shortUnrealizedPNL.usd, shortPositionValue, positionType, setShortGain])

  return shortGain
}

export function useLongUnrealizedPNL() {
  const { squeethAmount } = useComputeSwaps()
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const positionType = useAtomValue(positionTypeAtom)
  const longPositionValue = useAtomValue(longPositionValueAtom)

  const [longUnrealizedPNL, setLongUnrealizedPNL] = useAtom(longUnrealizedPNLAtom)
  const index = useAtomValue(indexAtom)

  const swapsData = useAtomValue(swapsAtom)
  const swaps = swapsData?.swaps

  useAppEffect(() => {
    ;(async () => {
      if (
        swaps?.length &&
        !index.isZero() &&
        !longPositionValue.isZero() &&
        !squeethAmount.isZero() &&
        positionType === PositionType.LONG
      ) {
        const pnl = await calcDollarLongUnrealizedpnl(
          swaps,
          isWethToken0,
          longPositionValue,
          toTokenAmount(index, 18).sqrt(),
          squeethAmount,
        )
        setLongUnrealizedPNL((prevState) => ({ ...prevState, ...pnl }))
      } else {
        setLongUnrealizedPNL((prevState) => ({ ...prevState, loading: true }))
      }
    })()
  }, [index, isWethToken0, swaps, squeethAmount, positionType, setLongUnrealizedPNL, longPositionValue])

  return longUnrealizedPNL
}

export function useShortUnrealizedPNL() {
  const { squeethAmount } = useComputeSwaps()
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const positionType = useAtomValue(positionTypeAtom)
  const ethCollateralPnl = useEthCollateralPnl()

  const shortPositionValue = useAtomValue(shortPositionValueAtom)
  const [shortUnrealizedPNL, setShortUnrealizedPNL] = useAtom(shortUnrealizedPNLAtom)
  const index = useAtomValue(indexAtom)

  const { loading: swapsLoading } = useSwaps()
  const swapsData = useAtomValue(swapsAtom)
  const swaps = swapsData?.swaps

  useAppEffect(() => {
    ;(async () => {
      if (
        swaps?.length &&
        !shortPositionValue.isZero() &&
        !index.isZero() &&
        !ethCollateralPnl.isZero() &&
        !squeethAmount.isZero() &&
        positionType === PositionType.SHORT &&
        !swapsLoading
      ) {
        const pnl = await calcDollarShortUnrealizedpnl(
          swaps,
          isWethToken0,
          shortPositionValue,
          toTokenAmount(index, 18).sqrt(),
          squeethAmount,
          ethCollateralPnl,
        )
        setShortUnrealizedPNL({
          ...pnl,
        })
      } else {
        setShortUnrealizedPNL((prevState) => ({ ...prevState, loading: true }))
      }
    })()
  }, [
    shortPositionValue,
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
