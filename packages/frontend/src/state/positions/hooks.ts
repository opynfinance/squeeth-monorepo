import { useAtom, useAtomValue, atom } from 'jotai'
import { useUpdateAtom } from 'jotai/utils'
import { useQuery } from '@apollo/client'
import { useEffect, useMemo } from 'react'
import BigNumber from 'bignumber.js'
import { Position } from '@uniswap/v3-sdk'

import { networkIdAtom, addressAtom, connectedWalletAtom } from '../wallet/atoms'
import { swaps, swapsVariables } from '@queries/uniswap/__generated__/swaps'
import SWAPS_QUERY, { SWAPS_SUBSCRIPTION } from '@queries/uniswap/swapsQuery'
import SWAPS_ROPSTEN_QUERY, { SWAPS_ROPSTEN_SUBSCRIPTION } from '@queries/uniswap/swapsRopstenQuery'
import { VAULT_QUERY } from '@queries/squeeth/vaultsQuery'
import { BIG_ZERO, OSQUEETH_DECIMALS } from '@constants/index'
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
import { toTokenAmount } from '@utils/calculations'
import { squeethClient } from '@utils/apollo-client'
import { PositionType, Networks } from '../../types'
import { poolAtom, readyAtom, squeethInitialPriceAtom } from '../squeethPool/atoms'
import { useGetCollatRatioAndLiqPrice, useGetVault } from '../controller/hooks'
import { useETHPrice } from '@hooks/useETHPrice'
import { useGetWSqueethPositionValue } from '../squeethPool/hooks'
import { useVaultHistory } from '@hooks/useVaultHistory'
import { swapsRopsten, swapsRopstenVariables } from '@queries/uniswap/__generated__/swapsRopsten'
import { Vault } from '@queries/squeeth/__generated__/Vault'

export const useSwaps = () => {
  const [networkId] = useAtom(networkIdAtom)
  const [address] = useAtom(addressAtom)
  const { squeethPool, oSqueeth, shortHelper, swapRouter, crabStrategy } = useAtomValue(addressesAtom)
  const { subscribeToMore, data, refetch, loading, error, startPolling, stopPolling } = useQuery<
    swaps | swapsRopsten,
    swapsVariables | swapsRopstenVariables
  >(networkId === Networks.MAINNET ? SWAPS_QUERY : SWAPS_ROPSTEN_QUERY, {
    variables: {
      origin: address || '',
      orderDirection: 'asc',
      recipient_not: crabStrategy,
      ...(networkId === Networks.MAINNET
        ? {
            tokenAddress: oSqueeth,
          }
        : {
            poolAddress: squeethPool,
            recipients: [shortHelper, address || '', swapRouter],
          }),
    },
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    subscribeToMore({
      document: networkId === Networks.MAINNET ? SWAPS_SUBSCRIPTION : SWAPS_ROPSTEN_SUBSCRIPTION,
      variables: {
        origin: address || '',
        orderDirection: 'asc',
        recipient_not: crabStrategy,
        ...(networkId === Networks.MAINNET
          ? {
              tokenAddress: oSqueeth,
            }
          : {
              poolAddress: squeethPool,
              recipients: [shortHelper, address || '', swapRouter],
            }),
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

  return { data, refetch, loading, error, startPolling, stopPolling }
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
    [isWethToken0, data?.swaps.length],
  )

  useEffect(() => {
    if (computedSwaps.squeethAmount.isGreaterThan(0)) {
      setPositionType(PositionType.LONG)
    } else if (computedSwaps.squeethAmount.isLessThan(0)) {
      setPositionType(PositionType.SHORT)
    } else setPositionType(PositionType.NONE)
  }, [computedSwaps.squeethAmount.toString()])

  return computedSwaps
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

export const useMintedSoldSort = () => {
  const { vaultId } = useFirstValidVault()
  const { openShortSqueeth } = useVaultHistory(vaultId)
  const positionType = useAtomValue(positionTypeAtom)
  const { squeethAmount } = useComputeSwaps()
  //when the squeethAmount < 0 and the abs amount is greater than openShortSqueeth, that means there is manually sold short position
  return useMemo(() => {
    return positionType === PositionType.SHORT && squeethAmount.abs().isGreaterThan(openShortSqueeth)
      ? squeethAmount.abs().minus(openShortSqueeth)
      : new BigNumber(0)
  }, [positionType, squeethAmount?.toString(), openShortSqueeth.toString()])
}

export const useMintedDebt = () => {
  const { vaultId } = useFirstValidVault()
  const { mintedSqueeth } = useVaultHistory(vaultId)
  const lpDebt = useLpDebt()
  const mintedSoldShort = useMintedSoldSort()

  //mintedSqueeth balance from vault histroy - mintedSold short position = existing mintedDebt in vault, but
  //LPed amount wont be taken into account from vault history, so will need to be deducted here and added the withdrawn amount back
  //if there is LP Debt, shld be deducted from minted Debt
  const mintedDebt = useMemo(() => {
    return mintedSqueeth.minus(mintedSoldShort).minus(lpDebt)
  }, [mintedSqueeth.toString(), mintedSoldShort?.toString(), lpDebt.toString()])
  return mintedDebt
}

export const useShortDebt = () => {
  const positionType = useAtomValue(positionTypeAtom)
  const { squeethAmount } = useComputeSwaps()
  const shortDebt = useMemo(() => {
    return positionType === PositionType.SHORT ? squeethAmount : new BigNumber(0)
  }, [positionType, squeethAmount.toString()])

  return shortDebt.absoluteValue()
}

export const useLongSqthBal = () => {
  const { oSqueeth } = useAtomValue(addressesAtom)
  const { value: oSqueethBal } = useTokenBalance(oSqueeth, 15, OSQUEETH_DECIMALS)
  const mintedDebt = useMintedDebt()
  const longSqthBal = useMemo(() => {
    return mintedDebt.gt(0) ? oSqueethBal.minus(mintedDebt) : oSqueethBal
  }, [oSqueethBal?.toString(), mintedDebt.toString()])
  return longSqthBal
}

export const useLpDebt = () => {
  const depositedSqueeth = useAtomValue(depositedSqueethAtom)
  const withdrawnSqueeth = useAtomValue(withdrawnSqueethAtom)
  const lpDebt = useMemo(() => {
    return depositedSqueeth.minus(withdrawnSqueeth).isGreaterThan(0)
      ? depositedSqueeth.minus(withdrawnSqueeth)
      : new BigNumber(0)
  }, [depositedSqueeth.toString(), withdrawnSqueeth.toString()])

  return lpDebt
}

export const useLPPositionsQuery = () => {
  const { squeethPool } = useAtomValue(addressesAtom)
  const address = useAtomValue(addressAtom)
  const lpPositionsLoading = useAtomValue(lpPositionsLoadingAtom)
  const { data, refetch, loading, subscribeToMore } = useQuery<positions, positionsVariables>(POSITIONS_QUERY, {
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

  return { data, refetch, loading: loading || lpPositionsLoading }
}

const MAX_UNIT = '0xffffffffffffffffffffffffffffffff'
const positionFeesAtom = atom<any[]>([])
export const useLPPositionsAndFees = () => {
  const manager = useAtomValue(managerAtom)
  const address = useAtomValue(addressAtom)
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const pool = useAtomValue(poolAtom)
  const squeethInitialPrice = useAtomValue(squeethInitialPriceAtom)
  const getWSqueethPositionValue = useGetWSqueethPositionValue()
  const { data } = useLPPositionsQuery()
  const ethPrice = useETHPrice()
  const [positionFees, setPositionFees] = useAtom(positionFeesAtom)

  useEffect(() => {
    ;(async function handlePositionFees() {
      if (!pool || !squeethInitialPrice.toNumber() || !ethPrice.toNumber() || !data) return []

      const positionFeesP = data.positions.map(async (p) => {
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
      })

      setPositionFees(await Promise.all(positionFeesP))
    })()
  }, [ethPrice.toString(), squeethInitialPrice.toString(), data?.positions?.length])

  return positionFees
}

export const usePositionsAndFeesComputation = () => {
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

  const positionAndFees = useLPPositionsAndFees()
  const { loading: gphLoading } = useLPPositionsQuery()

  useEffect(() => {
    if (positionAndFees && !gphLoading) {
      setLoading(true)
      // Promise.all(positionAndFees).then((values: any[]) => {
      setActivePositions(positionAndFees.filter((p) => p.amount0.gt(0) || p.amount1.gt(0)))
      setClosedPositions(positionAndFees.filter((p) => p.amount0.isZero() && p.amount1.isZero()))
      // Calculate cumulative LP position here
      let depSqth = new BigNumber(0)
      let depWeth = new BigNumber(0)
      let withSqth = new BigNumber(0)
      let withWeth = new BigNumber(0)
      let sqthLiq = new BigNumber(0)
      let wethLiq = new BigNumber(0)
      for (const position of positionAndFees) {
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
      // })
    }
  }, [gphLoading, isWethToken0, positionAndFees.length])
}

export const useVaultQuery = (vaultId: number) => {
  const networkId = useAtomValue(networkIdAtom)

  const query = useQuery<Vault>(VAULT_QUERY, {
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
    variables: {
      vaultID: vaultId,
    },
  })

  const vaultData = useMemo(() => {
    if (query.data) {
      const vault = query.data.vault

      return {
        id: vault?.id,
        NFTCollateralId: vault?.NftCollateralId,
        collateralAmount: toTokenAmount(new BigNumber(vault?.collateralAmount), 18),
        shortAmount: toTokenAmount(new BigNumber(vault?.shortAmount), OSQUEETH_DECIMALS),
        operator: vault?.operator,
      }
    }
  }, [query.data])

  return { ...query, data: vaultData }
}
export const useUpdateVaultData = () => {
  const connected = useAtomValue(connectedWalletAtom)
  const setVault = useUpdateAtom(vaultAtom)
  const setExistingCollat = useUpdateAtom(existingCollatAtom)
  const setExistingCollatPercent = useUpdateAtom(existingCollatPercentAtom)
  const setCollatPercent = useUpdateAtom(collatPercentAtom)
  const setExistingLiqPrice = useUpdateAtom(existingLiqPriceAtom)
  const setVaultLoading = useUpdateAtom(isVaultLoadingAtom)
  const ready = useAtomValue(readyAtom)
  const { vaultId } = useFirstValidVault()
  const getCollatRatioAndLiqPrice = useGetCollatRatioAndLiqPrice()
  const getVault = useGetVault()

  const updateVault = async () => {
    if (!connected || !ready) return

    const _vault = await getVault(vaultId)

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
  }

  useEffect(() => {
    updateVault()
  }, [connected, ready, vaultId])

  return updateVault
}

export const useFirstValidVault = () => {
  const { vaults: shortVaults } = useVaultManager()
  const [firstValidVault, setFirstValidVault] = useAtom(firstValidVaultAtom)
  useEffect(() => {
    for (let i = 0; i < shortVaults.length; i++) {
      if (shortVaults[i]?.collateralAmount.isGreaterThan(0)) {
        setFirstValidVault(i)
      }
    }
  }, [shortVaults.length])

  return { firstValidVault, vaultId: shortVaults[firstValidVault]?.id || 0 }
}
