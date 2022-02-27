import { useQuery } from '@apollo/client'
import { Position } from '@uniswap/v3-sdk'
import BigNumber from 'bignumber.js'
import { useCallback, useEffect, useMemo, useState } from 'react'

import NFTpositionManagerABI from '../abis/NFTpositionmanager.json'
import { useWallet } from '@context/wallet'
import { useWorldContext } from '@context/world'
import { usePositions } from '@context/positions'
import { positions, positionsVariables } from '../queries/uniswap/__generated__/positions'
import POSITIONS_QUERY, { POSITIONS_SUBSCRIPTION } from '../queries/uniswap/positionsQuery'
import VAULT_HISTORY_QUERY from '../queries/squeeth/vaultHistoryQuery'
import { VaultHistory } from '../queries/squeeth/__generated__/VaultHistory'
import { NFTManagers } from '../types'
import { toTokenAmount } from '@utils/calculations'
import { squeethClient } from '@utils/apollo-client'

import { useSqueethPool } from './contracts/useSqueethPool'
import { useController } from './contracts/useController'
import { useAddresses } from './useAddress'
import { calcDollarShortUnrealizedpnl, calcETHCollateralPnl, calcDollarLongUnrealizedpnl } from '../lib/pnl'
import { BIG_ZERO } from '../constants/'
import { useAtom } from 'jotai'
import { PositionType } from '../types'
import { useVaultHistory } from './useVaultHistory'

export const usePnL = () => {
  const [ethCollateralPnl, setEthCollateralPnl] = useState(BIG_ZERO)
  const [shortUnrealizedPNL, setShortUnrealizedPNL] = useState({ usd: BIG_ZERO, eth: BIG_ZERO, loading: true })
  const [longUnrealizedPNL, setLongUnrealizedPNL] = useState({ usd: BIG_ZERO, eth: BIG_ZERO, loading: true })
  const {
    squeethAmount,
    shortVaults,
    loading: positionLoading,
    swaps,
    isWethToken0,
    totalUSDFromBuy,
    totalUSDFromSell,
    existingCollat,
    positionType,
  } = usePositions()
  const { index } = useController()
  const { vaultHistory } = useVaultHistory()

  // const { ethPrice } = useWorldContext()
  const { ready, getSellQuote, getBuyQuote } = useSqueethPool()
  const { networkId } = useWallet()

  const [sellQuote, setSellQuote] = useState({
    amountOut: new BigNumber(0),
    minimumAmountOut: new BigNumber(0),
    priceImpact: '0',
  })
  const [buyQuote, setBuyQuote] = useState(new BigNumber(0))
  const [longGain, setLongGain] = useState(new BigNumber(0))
  const [shortGain, setShortGain] = useState(new BigNumber(0))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      if (vaultHistory?.length && !index.isZero() && !existingCollat.isZero() && swaps?.length) {
        const result = await calcETHCollateralPnl(vaultHistory, toTokenAmount(index, 18).sqrt(), existingCollat)
        setEthCollateralPnl(result)
      }
    })()
  }, [index.toString(), existingCollat.toString(), vaultHistory?.length, swaps?.length])

  useEffect(() => {
    if (!ready || positionLoading) return

    const p1 = getSellQuote(squeethAmount).then(setSellQuote)
    const p2 = getBuyQuote(squeethAmount).then((val) => setBuyQuote(val.amountIn))
    Promise.all([p1, p2]).then(() => setLoading(false))
  }, [getBuyQuote, getSellQuote, positionLoading, ready, squeethAmount.toString()])

  useEffect(() => {
    if (sellQuote.amountOut.isZero() && !loading) {
      setLongGain(new BigNumber(0))
      return
    }
    // const _currentValue = sellQuote.amountOut.times(100).div(wethAmount.absoluteValue())
    const _gain = longUnrealizedPNL.usd.dividedBy(totalUSDFromBuy).times(100)
    setLongGain(_gain)
  }, [loading, longUnrealizedPNL.usd.toString(), sellQuote.amountOut.toString(), totalUSDFromBuy])

  useEffect(() => {
    if (squeethAmount.isZero() || shortUnrealizedPNL.usd.isZero()) {
      setLongGain(new BigNumber(0))
      return
    }
    const _gain = shortUnrealizedPNL.usd
      .dividedBy(totalUSDFromSell.plus(existingCollat.times(toTokenAmount(index, 18).sqrt())))
      .times(100)

    setShortGain(_gain)
  }, [
    index.toString(),
    existingCollat.toString(),
    shortUnrealizedPNL.usd.toString(),
    squeethAmount.toString(),
    totalUSDFromSell.toString(),
  ])

  useEffect(() => {
    ;(async () => {
      if (
        swaps?.length &&
        !buyQuote.isZero() &&
        !index.isZero() &&
        !ethCollateralPnl.isZero() &&
        !squeethAmount.isZero() &&
        positionType === PositionType.SHORT
      ) {
        const pnl = await calcDollarShortUnrealizedpnl(
          swaps,
          isWethToken0,
          buyQuote,
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
    buyQuote.toString(),
    ethCollateralPnl.toString(),
    index.toString(),
    isWethToken0,
    swaps?.length,
    squeethAmount.toString(),
    positionType,
  ])

  useEffect(() => {
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
  }, [
    index.toString(),
    isWethToken0,
    sellQuote.amountOut.toString(),
    swaps?.length,
    squeethAmount.toString(),
    positionType,
  ])

  return {
    longGain,
    shortGain,
    buyQuote,
    sellQuote,
    loading,
    shortUnrealizedPNL,
    longUnrealizedPNL,
  }
}

export const useLPPositions = () => {
  const { address, web3 } = useWallet()
  const { squeethPool, nftManager, weth, oSqueeth } = useAddresses()
  const { pool, getWSqueethPositionValue, squeethInitialPrice } = useSqueethPool()
  const { ethPrice } = useWorldContext()

  const [activePositions, setActivePositions] = useState<NFTManagers[]>([])
  const [closedPositions, setClosedPositions] = useState<NFTManagers[]>([])
  const [loading, setLoading] = useState(true)
  const [squeethLiquidity, setSqueethLiquidity] = useState(new BigNumber(0))
  const [wethLiquidity, setWethLiquidity] = useState(new BigNumber(0))
  const [depositedSqueeth, setDepositedSqueeth] = useState(new BigNumber(0))
  const [depositedWeth, setDepositedWeth] = useState(new BigNumber(0))
  const [withdrawnSqueeth, setWithdrawnSqueeth] = useState(new BigNumber(0))
  const [withdrawnWeth, setWithdrawnWeth] = useState(new BigNumber(0))

  const {
    data,
    refetch,
    loading: gphLoading,
    subscribeToMore,
  } = useQuery<positions, positionsVariables>(POSITIONS_QUERY, {
    variables: {
      poolAddress: squeethPool?.toLowerCase(),
      owner: address?.toLowerCase() || '',
    },
    fetchPolicy: 'cache-and-network',
  })

  const manager = new web3.eth.Contract(NFTpositionManagerABI as any, nftManager?.toLowerCase() || '')
  const MAX_UNIT = '0xffffffffffffffffffffffffffffffff'

  useEffect(() => {
    setLoading(true)
  }, [address])

  useEffect(() => {
    subscribeToNewPositions()
  }, [])

  const subscribeToNewPositions = useCallback(() => {
    subscribeToMore({
      document: POSITIONS_SUBSCRIPTION,
      variables: {
        poolAddress: squeethPool?.toLowerCase(),
        owner: address?.toLowerCase() || '',
      },
      updateQuery(prev, { subscriptionData }) {
        if (!subscriptionData.data || subscriptionData.data.positions.length === data?.positions.length) return prev
        const newPosition = subscriptionData.data.positions
        return {
          positions: newPosition,
        }
      },
    })
  }, [squeethPool, address])

  const isWethToken0 = useMemo(() => parseInt(weth, 16) < parseInt(oSqueeth, 16), [weth, oSqueeth])

  const positionAndFees = useMemo(() => {
    if (!pool || !squeethInitialPrice.toNumber() || !ethPrice.toNumber()) return []
    return (
      data?.positions.map(async (p) => {
        const position = { ...p }
        const tokenIdHexString = new BigNumber(position.id).toString()
        const uniPosition = new Position({
          pool,
          liquidity: position.liquidity.toString(),
          tickLower: Number(position.tickLower.tickIdx),
          tickUpper: Number(position.tickUpper.tickIdx),
        })

        const fees = await manager.methods
          .collect({
            tokenId: tokenIdHexString,
            recipient: address,
            amount0Max: MAX_UNIT,
            amount1Max: MAX_UNIT,
          })
          .call()

        const squeethAmt = isWethToken0
          ? new BigNumber(uniPosition.amount1.toSignificant(18))
          : new BigNumber(uniPosition.amount0.toSignificant(18))

        const wethAmt = isWethToken0
          ? new BigNumber(uniPosition.amount0.toSignificant(18))
          : new BigNumber(uniPosition.amount1.toSignificant(18))

        const squeethFees = isWethToken0 ? toTokenAmount(fees?.amount1, 18) : toTokenAmount(fees?.amount0, 18)
        const wethFees = isWethToken0 ? toTokenAmount(fees?.amount0, 18) : toTokenAmount(fees?.amount1, 18)

        const dollarValue = getWSqueethPositionValue(squeethAmt)
          .plus(getWSqueethPositionValue(squeethFees))
          .plus(wethAmt.times(ethPrice))
          .plus(wethFees.times(ethPrice))

        return {
          ...position,
          amount0: new BigNumber(uniPosition.amount0.toSignificant(18)),
          amount1: new BigNumber(uniPosition.amount1.toSignificant(18)),
          fees0: toTokenAmount(fees?.amount0, 18),
          fees1: toTokenAmount(fees?.amount1, 18),
          dollarValue,
        }
      }) || []
    )
  }, [pool, ethPrice.toString(), squeethInitialPrice.toString(), ethPrice.toString(), data?.positions?.length])

  useEffect(() => {
    if (positionAndFees && !gphLoading) {
      setLoading(true)
      Promise.all(positionAndFees).then((values) => {
        setActivePositions(values.filter((p) => p.amount0.gt(0) || p.amount1.gt(0)))
        setClosedPositions(values.filter((p) => p.amount0.isZero() && p.amount1.isZero()))
        // Calculate cumulative LP position here
        let depSqth = new BigNumber(0)
        let depWeth = new BigNumber(0)
        let withSqth = new BigNumber(0)
        let withWeth = new BigNumber(0)
        let sqthLiq = new BigNumber(0)
        let wethLiq = new BigNumber(0)
        for (const position of values) {
          sqthLiq = sqthLiq.plus(isWethToken0 ? position.amount1 : position.amount0)
          wethLiq = wethLiq.plus(isWethToken0 ? position.amount0 : position.amount1)
          depSqth = depSqth.plus(isWethToken0 ? position.depositedToken1 : position.depositedToken0)
          depWeth = depWeth.plus(isWethToken0 ? position.depositedToken0 : position.depositedToken1)
          withSqth = withSqth.plus(
            isWethToken0
              ? new BigNumber(position.withdrawnToken1).plus(position.collectedFeesToken1)
              : new BigNumber(position.withdrawnToken0).plus(position.collectedFeesToken0),
          )
          withWeth = withWeth.plus(
            !isWethToken0
              ? new BigNumber(position.withdrawnToken1).plus(position.collectedFeesToken1)
              : new BigNumber(position.withdrawnToken0).plus(position.collectedFeesToken0),
          )
        }

        setDepositedSqueeth(depSqth)
        setDepositedWeth(depWeth)
        setWithdrawnSqueeth(withSqth)
        setWithdrawnWeth(withWeth)
        setSqueethLiquidity(sqthLiq)
        setWethLiquidity(wethLiq)
        if (
          !(
            depSqth.isEqualTo(0) &&
            depWeth.isEqualTo(0) &&
            withSqth.isEqualTo(0) &&
            sqthLiq.isEqualTo(0) &&
            wethLiq.isEqualTo(0)
          ) ||
          activePositions.length === 0
        )
          setLoading(false)
      })
    }
  }, [gphLoading, isWethToken0, positionAndFees.length])

  return {
    activePositions: activePositions,
    closedPositions: closedPositions,
    loading: gphLoading || loading,
    depositedSqueeth,
    depositedWeth,
    withdrawnSqueeth,
    withdrawnWeth,
    squeethLiquidity,
    wethLiquidity,
    refetch,
  }
}
