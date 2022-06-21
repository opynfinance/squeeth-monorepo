import { useAtom, useAtomValue, atom } from 'jotai'
import { useUpdateAtom } from 'jotai/utils'
import { useQuery } from '@apollo/client'
import BigNumber from 'bignumber.js'
import { Position } from '@uniswap/v3-sdk'

import { networkIdAtom, addressAtom } from '../wallet/atoms'
import { VAULT_QUERY } from '@queries/squeeth/vaultsQuery'
import { OSQUEETH_DECIMALS } from '@constants/index'
import {
  addressesAtom,
  isWethToken0Atom,
  positionTypeAtom,
  managerAtom,
  activePositionsAtom,
  closedPositionsAtom,
  squeethLiquidityAtom,
  wethLiquidityAtom,
  depositedSqueethAtom,
  depositedWethAtom,
  withdrawnSqueethAtom,
  withdrawnWethAtom,
} from './atoms'
import { positions, positionsVariables } from '@queries/uniswap/__generated__/positions'
import POSITIONS_QUERY, { POSITIONS_SUBSCRIPTION } from '@queries/uniswap/positionsQuery'
import { useVaultManager } from '@hooks/contracts/useVaultManager'
import { toTokenAmount } from '@utils/calculations'
import { squeethClient } from '@utils/apollo-client'
import { PositionType } from '../../types'
import { poolAtom, squeethInitialPriceAtom } from '../squeethPool/atoms'
import { useETHPrice } from '@hooks/useETHPrice'
import { useGetWSqueethPositionValue } from '../squeethPool/hooks'
import { Vault } from '@queries/squeeth/__generated__/Vault'
import useAppEffect from '@hooks/useAppEffect'
import useAppMemo from '@hooks/useAppMemo'
import usePositionNPnL from '@hooks/usePositionNPnL'

export const useShortDebt = () => {
  const positionType = useAtomValue(positionTypeAtom)
  const { currentOSQTHAmount: squeethAmount } = usePositionNPnL()
  const shortDebt = useAppMemo(() => {
    return positionType === PositionType.SHORT ? squeethAmount : new BigNumber(0)
  }, [positionType, squeethAmount])

  return shortDebt.absoluteValue()
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

  return { data, refetch, loading }
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

export const useFirstValidVault = () => {
  const { vaults: shortVaults, loading } = useVaultManager()

  const vault = shortVaults?.find((vault) => vault.collateralAmount.isGreaterThan(0))

  return {
    isVaultLoading: loading,
    vaultId: Number(vault?.id) || 0,
    validVault: vault,
  }
}
