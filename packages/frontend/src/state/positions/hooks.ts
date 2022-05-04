import { useState } from 'react'
import { useAtom, useAtomValue, atom } from 'jotai'
import { useUpdateAtom } from 'jotai/utils'
import { useQuery } from '@apollo/client'
import { useContext } from 'react'
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
  swapsAtom,
} from './atoms'
import { positions, positionsVariables } from '@queries/uniswap/__generated__/positions'
import POSITIONS_QUERY, { POSITIONS_SUBSCRIPTION } from '@queries/uniswap/positionsQuery'
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
import { ComputeSwapsContext } from './providers'
import useAppEffect from '@hooks/useAppEffect'
import useAppMemo from '@hooks/useAppMemo'
import useAppCallback from '@hooks/useAppCallback'

export const useSwaps = () => {
  const [swapData, setSwapData] = useState<swaps | swapsRopsten | undefined>(undefined)
  const [networkId] = useAtom(networkIdAtom)
  const [address] = useAtom(addressAtom)
  const setSwaps = useUpdateAtom(swapsAtom)
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

  useAppEffect(() => {
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

  useAppEffect(() => {
    if (data?.swaps) {
      setSwaps({ swaps: data.swaps })
    }
  }, [data?.swaps, setSwaps])

  useAppEffect(() => {
    if (data && data.swaps && data.swaps.length > 0) {
      setSwapData(data)
    }
  }, [data])

  return { data: swapData, refetch, loading, error, startPolling, stopPolling }
}

export const useComputeSwaps = () => {
  const context = useContext(ComputeSwapsContext)

  if (!context) {
    throw new Error('useComputeSwaps must be used inside ComputeSwapsProvider')
  }

  return context
}

export const useLongRealizedPnl = () => {
  const { boughtSqueeth, soldSqueeth, totalUSDFromBuy, totalUSDFromSell } = useComputeSwaps()
  return useAppMemo(() => {
    if (!soldSqueeth.gt(0)) return BIG_ZERO
    const costForOneSqth = !totalUSDFromBuy.isEqualTo(0) ? totalUSDFromBuy.div(boughtSqueeth) : BIG_ZERO
    const realizedForOneSqth = !totalUSDFromSell.isEqualTo(0) ? totalUSDFromSell.div(soldSqueeth) : BIG_ZERO
    const pnlForOneSqth = realizedForOneSqth.minus(costForOneSqth)

    return pnlForOneSqth.multipliedBy(soldSqueeth)
  }, [boughtSqueeth, soldSqueeth, totalUSDFromBuy, totalUSDFromSell])
}

export const useShortRealizedPnl = () => {
  const { boughtSqueeth, soldSqueeth, totalUSDFromBuy, totalUSDFromSell } = useComputeSwaps()
  return useAppMemo(() => {
    if (!boughtSqueeth.gt(0)) return BIG_ZERO

    const costForOneSqth = !totalUSDFromSell.isEqualTo(0) ? totalUSDFromSell.div(soldSqueeth) : BIG_ZERO
    const realizedForOneSqth = !totalUSDFromBuy.isEqualTo(0) ? totalUSDFromBuy.div(boughtSqueeth) : BIG_ZERO
    const pnlForOneSqth = realizedForOneSqth.minus(costForOneSqth)

    return pnlForOneSqth.multipliedBy(boughtSqueeth)
  }, [boughtSqueeth, totalUSDFromBuy, soldSqueeth, totalUSDFromSell])
}

export const useMintedSoldSort = () => {
  const { vaultId } = useFirstValidVault()
  const { openShortSqueeth } = useVaultHistory(vaultId)
  const positionType = useAtomValue(positionTypeAtom)
  const { squeethAmount } = useComputeSwaps()

  //when the squeethAmount < 0 and the abs amount is greater than openShortSqueeth, that means there is manually sold short position
  return useAppMemo(() => {
    return positionType === PositionType.SHORT && squeethAmount.abs().isGreaterThan(openShortSqueeth)
      ? squeethAmount.abs().minus(openShortSqueeth)
      : new BigNumber(0)
  }, [positionType, squeethAmount, openShortSqueeth])
}

export const useMintedDebt = () => {
  const { vaultId } = useFirstValidVault()
  const { mintedSqueeth } = useVaultHistory(vaultId)
  const lpDebt = useLpDebt()
  const mintedSoldShort = useMintedSoldSort()

  //mintedSqueeth balance from vault histroy - mintedSold short position = existing mintedDebt in vault, but
  //LPed amount wont be taken into account from vault history, so will need to be deducted here and added the withdrawn amount back
  //if there is LP Debt, shld be deducted from minted Debt
  const mintedDebt = useAppMemo(() => {
    return mintedSqueeth.minus(mintedSoldShort).minus(lpDebt)
  }, [mintedSqueeth, mintedSoldShort, lpDebt])

  return mintedDebt
}

export const useShortDebt = () => {
  const positionType = useAtomValue(positionTypeAtom)
  const { squeethAmount } = useComputeSwaps()
  const shortDebt = useAppMemo(() => {
    return positionType === PositionType.SHORT ? squeethAmount : new BigNumber(0)
  }, [positionType, squeethAmount])

  return shortDebt.absoluteValue()
}

export const useLongSqthBal = () => {
  const { oSqueeth } = useAtomValue(addressesAtom)
  const { value: oSqueethBal, loading, error, refetch } = useTokenBalance(oSqueeth, 15, OSQUEETH_DECIMALS)
  const mintedDebt = useMintedDebt()
  const longSqthBal = useAppMemo(() => {
    return mintedDebt.gt(0) ? oSqueethBal.minus(mintedDebt) : oSqueethBal
  }, [oSqueethBal, mintedDebt])
  return { longSqthBal, loading, error, refetch }
}

export const useLpDebt = () => {
  const depositedSqueeth = useAtomValue(depositedSqueethAtom)
  const withdrawnSqueeth = useAtomValue(withdrawnSqueethAtom)
  const lpDebt = useAppMemo(() => {
    return depositedSqueeth.minus(withdrawnSqueeth).isGreaterThan(0)
      ? depositedSqueeth.minus(withdrawnSqueeth)
      : new BigNumber(0)
  }, [depositedSqueeth, withdrawnSqueeth])

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

  useAppEffect(() => {
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

  useAppEffect(() => {
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
  }, [
    ethPrice,
    squeethInitialPrice,
    data?.positions,
    address,
    data,
    getWSqueethPositionValue,
    isWethToken0,
    manager.methods,
    pool,
    setPositionFees,
  ])

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

  useAppEffect(() => {
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
  }, [
    gphLoading,
    isWethToken0,
    positionAndFees,
    activePositions.length,
    setActivePositions,
    setClosedPositions,
    setDepositedSqueeth,
    setDepositedWeth,
    setLoading,
    setSqueethLiquidity,
    setWethLiquidity,
    setWithdrawnSqueeth,
    setWithdrawnWeth,
  ])
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

  const vaultData = useAppMemo(() => {
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

  const updateVault = useAppCallback(async () => {
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
  }, [
    connected,
    getCollatRatioAndLiqPrice,
    getVault,
    ready,
    setCollatPercent,
    setExistingCollat,
    setExistingCollatPercent,
    setExistingLiqPrice,
    setVault,
    setVaultLoading,
    vaultId,
  ])

  useAppEffect(() => {
    updateVault()
  }, [connected, ready, vaultId, updateVault])

  return updateVault
}

export const useFirstValidVault = () => {
  const { vaults: shortVaults } = useVaultManager()
  const [firstValidVault, setFirstValidVault] = useAtom(firstValidVaultAtom)
  useAppEffect(() => {
    for (let i = 0; i < shortVaults.length; i++) {
      if (shortVaults[i]?.collateralAmount.isGreaterThan(0)) {
        setFirstValidVault(i)
      }
    }
  }, [shortVaults, setFirstValidVault])

  return { firstValidVault, vaultId: shortVaults[firstValidVault]?.id || 0 }
}
