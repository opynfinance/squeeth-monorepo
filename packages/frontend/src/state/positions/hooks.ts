import { useAtom, useAtomValue, atom } from 'jotai'
import { useUpdateAtom } from 'jotai/utils'
import { useQuery } from '@apollo/client'
import { useEffect, useMemo } from 'react'
import BigNumber from 'bignumber.js'
import { Position } from '@uniswap/v3-sdk'

import { networkIdAtom, addressAtom, connectedWalletAtom } from '../wallet/atoms'
import { swaps } from '@queries/uniswap/__generated__/swaps'
import { Vaults } from '@queries/squeeth/__generated__/Vaults'
import SWAPS_ROPSTEN_QUERY, { SWAPS_ROPSTEN_SUBSCRIPTION } from '@queries/uniswap/swapsRopstenQuery'
import { VAULT_QUERY } from '@queries/squeeth/vaultsQuery'
import { BIG_ZERO, OSQUEETH_DECIMALS } from '@constants/index'
import { useWorldContext } from '@context/world'
import {
  addressesAtom,
  firstValidVaultAtom,
  isWethToken0Atom,
  positionTypeAtom,
  managerAtom,
  activePositionsAtom,
  closedPositionsAtom,
  lpPositionsLoadingAtom,
  squeethLiquidityAtom,
  wethLiquidityAtom,
  depositedSqueethAtom,
  depositedWethAtom,
  withdrawnSqueethAtom,
  withdrawnWethAtom,
  vaultAtom,
  existingCollatPercentAtom,
  existingCollatAtom,
  existingLiqPriceAtom,
  collatPercentAtom,
  isVaultLoadingAtom,
} from './atoms'
import { positions, positionsVariables } from '@queries/uniswap/__generated__/positions'
import POSITIONS_QUERY, { POSITIONS_SUBSCRIPTION } from '@queries/uniswap/positionsQuery'
import { useUsdAmount } from '@hooks/useUsdAmount'
import { useVaultManager } from '@hooks/contracts/useVaultManager'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { useSqueethPool } from '@hooks/contracts/useSqueethPool'
import { useController } from '@hooks/contracts/useController'
import { toTokenAmount } from '@utils/calculations'
import { squeethClient } from '@utils/apollo-client'
import { PositionType, Vault } from '../../types'
import { useLPPositions } from '../../hooks/usePositions'

export const useSwaps = () => {
  const [networkId] = useAtom(networkIdAtom)
  const [address] = useAtom(addressAtom)
  const [{ squeethPool, oSqueeth, shortHelper, swapRouter, crabStrategy }] = useAtom(addressesAtom)
  const { subscribeToMore, data, refetch, loading, error } = useQuery<swaps, any>(SWAPS_ROPSTEN_QUERY, {
    variables: {
      // tokenAddress: oSqueeth?.toLowerCase(),
      origin: address || '',
      poolAddress: squeethPool?.toLowerCase(),
      recipients: [shortHelper, address || '', swapRouter],
      recipient_not: crabStrategy?.toLowerCase(),
      orderDirection: 'asc',
    },
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    subscribeToMore({
      document: SWAPS_ROPSTEN_SUBSCRIPTION,
      variables: {
        // tokenAddress: oSqueeth?.toLowerCase(),
        origin: address || '',
        poolAddress: squeethPool?.toLowerCase(),
        recipients: [shortHelper, address || '', swapRouter],
        recipient_not: crabStrategy?.toLowerCase(),
        orderDirection: 'asc',
      },
      updateQuery(prev, { subscriptionData }) {
        if (!subscriptionData.data) return prev
        const newSwaps = subscriptionData.data.swaps
        return {
          swaps: newSwaps,
        }
      },
    })
  }, [address, crabStrategy, networkId, oSqueeth, shortHelper, squeethPool, swapRouter, subscribeToMore])

  return { data, refetch, loading, error }
}

export const useComputeSwaps = () => {
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const setPositionType = useUpdateAtom(positionTypeAtom)
  const { getUsdAmt } = useUsdAmount()
  const { data } = useSwaps()

  const computedSwaps = useMemo(
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
    [getUsdAmt, isWethToken0, data?.swaps.length],
  )

  const { finalSqueeth, finalWeth } = useMemo(() => {
    // dont include LPed & minted amount will be the correct short amount
    const finalSqueeth = computedSwaps.squeethAmount
    const finalWeth = computedSwaps.wethAmount.div(computedSwaps.squeethAmount).multipliedBy(finalSqueeth)
    return { finalSqueeth, finalWeth }
  }, [computedSwaps.squeethAmount.toString(), computedSwaps.wethAmount.toString()])

  useEffect(() => {
    if (finalSqueeth.isGreaterThan(0)) {
      setPositionType(PositionType.LONG)
    } else if (finalSqueeth.isLessThan(0)) {
      setPositionType(PositionType.SHORT)
    } else setPositionType(PositionType.NONE)
  }, [finalSqueeth.toString(), computedSwaps.squeethAmount.toString()])

  return { ...computedSwaps, wethAmount: finalWeth }
}

export const useLongRealizedPnl = () => {
  const { boughtSqueeth, soldSqueeth, totalUSDFromBuy, totalUSDFromSell } = useComputeSwaps()
  return useMemo(() => {
    if (!soldSqueeth.gt(0)) return BIG_ZERO
    const costForOneSqth = !totalUSDFromBuy.isEqualTo(0) ? totalUSDFromBuy.div(boughtSqueeth) : BIG_ZERO
    const realizedForOneSqth = !totalUSDFromSell.isEqualTo(0) ? totalUSDFromSell.div(soldSqueeth) : BIG_ZERO
    const pnlForOneSqth = realizedForOneSqth.minus(costForOneSqth)

    return pnlForOneSqth.multipliedBy(soldSqueeth)
  }, [boughtSqueeth.toString(), soldSqueeth.toString(), totalUSDFromBuy.toString(), totalUSDFromSell.toString()])
}

export const useShortRealizedPnl = () => {
  const { boughtSqueeth, soldSqueeth, totalUSDFromBuy, totalUSDFromSell } = useComputeSwaps()
  return useMemo(() => {
    if (!boughtSqueeth.gt(0)) return BIG_ZERO

    const costForOneSqth = !totalUSDFromSell.isEqualTo(0) ? totalUSDFromSell.div(soldSqueeth) : BIG_ZERO
    const realizedForOneSqth = !totalUSDFromBuy.isEqualTo(0) ? totalUSDFromBuy.div(boughtSqueeth) : BIG_ZERO
    const pnlForOneSqth = realizedForOneSqth.minus(costForOneSqth)

    return pnlForOneSqth.multipliedBy(boughtSqueeth)
  }, [boughtSqueeth.toString(), totalUSDFromBuy.toString(), soldSqueeth.toString(), totalUSDFromSell.toString()])
}

export const useMintedDebt = () => {
  const { vaults: shortVaults } = useVaultManager()
  const positionType = useAtomValue(positionTypeAtom)
  const firstValidVault = useAtomValue(firstValidVaultAtom)
  const { oSqueeth } = useAtomValue(addressesAtom)
  const oSqueethBal = useTokenBalance(oSqueeth, 15, OSQUEETH_DECIMALS)
  const { squeethAmount } = useComputeSwaps()
  const mintedDebt = useMemo(() => {
    // squeethAmount = user long balance if oSqueethBal > 0, but it could also be minted balance
    return shortVaults[firstValidVault]?.shortAmount.gt(0) &&
      oSqueethBal?.isGreaterThan(0) &&
      positionType === PositionType.LONG
      ? oSqueethBal.minus(squeethAmount)
      : shortVaults[firstValidVault]?.shortAmount.gt(0) && oSqueethBal?.isGreaterThan(0)
      ? oSqueethBal
      : new BigNumber(0)
  }, [firstValidVault, oSqueethBal?.toString(), positionType, shortVaults?.length, squeethAmount.toString()])
  return mintedDebt
}

export const useShortDebt = () => {
  const positionType = useAtomValue(positionTypeAtom)
  const { squeethAmount } = useComputeSwaps()
  const shortDebt = useMemo(() => {
    return positionType === PositionType.SHORT ? squeethAmount : new BigNumber(0)
  }, [positionType, squeethAmount.toString()])

  return shortDebt
}

export const useLongSqthBal = () => {
  const { oSqueeth } = useAtomValue(addressesAtom)
  const oSqueethBal = useTokenBalance(oSqueeth, 15, OSQUEETH_DECIMALS)
  const mintedDebt = useMintedDebt()
  const longSqthBal = useMemo(() => {
    return mintedDebt.gt(0) ? oSqueethBal.minus(mintedDebt) : oSqueethBal
  }, [oSqueethBal?.toString(), mintedDebt.toString()])
  return longSqthBal
}

export const useLpDebt = () => {
  const { depositedSqueeth, withdrawnSqueeth } = useLPPositions()
  const lpDebt = useMemo(() => {
    return depositedSqueeth.minus(withdrawnSqueeth).isGreaterThan(0)
      ? depositedSqueeth.minus(withdrawnSqueeth)
      : new BigNumber(0)
  }, [depositedSqueeth.toString(), withdrawnSqueeth.toString()])

  return lpDebt
}

export const useLPPositionsQuery = () => {
  const [{ squeethPool }] = useAtom(addressesAtom)
  const [address] = useAtom(addressAtom)
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

  useEffect(() => {
    subscribeToMore({
      document: POSITIONS_SUBSCRIPTION,
      variables: {
        poolAddress: squeethPool?.toLowerCase(),
        owner: address?.toLowerCase() || '',
      },
      updateQuery(prev, { subscriptionData }) {
        if (!subscriptionData.data) return prev
        const newPosition = subscriptionData.data.positions
        return {
          positions: newPosition,
        }
      },
    })
  }, [address, squeethPool, subscribeToMore])

  return { data, refetch, gphLoading }
}

const MAX_UNIT = '0xffffffffffffffffffffffffffffffff'
export const useLPPositionsAndFees = () => {
  const manager = useAtomValue(managerAtom)
  const address = useAtomValue(addressAtom)
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const { data } = useLPPositionsQuery()
  const { pool, getWSqueethPositionValue, squeethInitialPrice } = useSqueethPool()
  const { ethPrice } = useWorldContext()

  return useMemo(() => {
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
}

export const usePositionsAndFeesComputation = (positionAndFees: [], gphLoading: boolean) => {
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const [activePositions, setActivePositions] = useAtom(activePositionsAtom)
  const setClosedPositions = useUpdateAtom(closedPositionsAtom)
  const setLoading = useUpdateAtom(lpPositionsLoadingAtom)
  const setDepositedSqueeth = useUpdateAtom(depositedSqueethAtom)
  const setDepositedWeth = useUpdateAtom(depositedWethAtom)
  const setWithdrawnSqueeth = useUpdateAtom(withdrawnSqueethAtom)
  const setWithdrawnWeth = useUpdateAtom(withdrawnWethAtom)
  const setWethLiquidity = useUpdateAtom(wethLiquidityAtom)
  const setSqueethLiquidity = useUpdateAtom(squeethLiquidityAtom)
  useEffect(() => {
    if (positionAndFees && !gphLoading) {
      setLoading(true)
      Promise.all(positionAndFees).then((values: any[]) => {
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
}

export const useVaultQuery = (vaultId: number) => {
  const networkId = useAtomValue(networkIdAtom)

  return useQuery<{ vault: Vault }>(VAULT_QUERY, {
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
    variables: {
      vaultID: vaultId,
    },
  })
}
export const useUpdateVaultData = (vaultId: number) => {
  const connected = useAtomValue(connectedWalletAtom)
  const setVault = useUpdateAtom(vaultAtom)
  const setExistingCollat = useUpdateAtom(existingCollatAtom)
  const setExistingCollatPercent = useUpdateAtom(existingCollatPercentAtom)
  const setCollatPercent = useUpdateAtom(collatPercentAtom)
  const setExistingLiqPrice = useUpdateAtom(existingLiqPriceAtom)
  const setVaultLoading = useUpdateAtom(isVaultLoadingAtom)
  const { ready } = useSqueethPool()
  const { getCollatRatioAndLiqPrice, getVault } = useController()
  useEffect(() => {
    ;(async () => {
      if (!connected || !ready) return

      // const _vault = await getVault(vaultId)

      const { data } = useVaultQuery(vaultId)
      const _vault = data?.vault

      if (!_vault) return

      setVault(_vault)
      setExistingCollat(_vault.collateralAmount)

      getCollatRatioAndLiqPrice(
        _vault.collateralAmount,
        _vault.shortAmount,
        _vault.NFTCollateralId ? Number(_vault.NFTCollateralId) : undefined,
      ).then(({ collateralPercent, liquidationPrice }) => {
        setExistingCollatPercent(collateralPercent)
        setCollatPercent(collateralPercent)
        setExistingLiqPrice(new BigNumber(liquidationPrice))
        setVaultLoading(false)
      })
    })()
  }, [connected, getCollatRatioAndLiqPrice, getVault, ready, vaultId])
}
