import { BIG_ZERO, UNI_POOL_FEES, USDC_DECIMALS } from '@constants/index'
import useAppMemo from '@hooks/useAppMemo'
import { bullStrategyContractAtom, flashBullContractAtom, quoterContractAtom } from '@state/contracts/atoms'
import { crabStrategyVaultAtomV2, crabTotalSupplyV2Atom } from '@state/crab/atoms'
import { addressesAtom } from '@state/positions/atoms'
import { slippageAmountAtom } from '@state/trade/atoms'
import { addressAtom, networkIdAtom } from '@state/wallet/atoms'
import { useHandleTransaction } from '@state/wallet/hooks'
import { fromTokenAmount, getUSDCPoolFee, toTokenAmount } from '@utils/calculations'
import { getExactIn } from '@utils/quoter'
import BigNumber from 'bignumber.js'
import { useAtom, useAtomValue } from 'jotai'
import { useUpdateAtom } from 'jotai/utils'
import { useEffect } from 'react'
import { useQueryClient } from 'react-query'
import { bullCrabBalanceAtom, bullSupplyAtom } from './atoms'
import { getWethToLendFromCrabEth } from './utils'

export const useInitBullStrategy = () => {
  const setBullState = useSetBullState()

  useEffect(() => {
    setBullState()
  }, [setBullState])
}

export const useSetBullState = () => {
  const bullContract = useAtomValue(bullStrategyContractAtom)
  const setBullCrabBalance = useUpdateAtom(bullCrabBalanceAtom)
  const setBullSupply = useUpdateAtom(bullSupplyAtom)

  const setBullState = async () => {
    if (!bullContract) return null

    const p1 = bullContract.methods.getCrabBalance().call()
    const p2 = bullContract.methods.totalSupply().call()

    const [crabBalance, totalSupply] = await Promise.all([p1, p2])
    setBullCrabBalance(toTokenAmount(crabBalance, 18))
    setBullSupply(toTokenAmount(totalSupply, 18))
  }

  return setBullState
}

export const useGetFlashBulldepositParams = () => {
  const bullStrategyContract = useAtomValue(bullStrategyContractAtom)
  const crabV2Vault = useAtomValue(crabStrategyVaultAtomV2)
  const crabTotalSupply = useAtomValue(crabTotalSupplyV2Atom)
  const bullCrabBalance = useAtomValue(bullCrabBalanceAtom)
  const bullSupply = useAtomValue(bullSupplyAtom)
  const quoterContract = useAtomValue(quoterContractAtom)
  const { weth, oSqueeth, usdc } = useAtomValue(addressesAtom)
  const slippage = useAtomValue(slippageAmountAtom)
  const network = useAtomValue(networkIdAtom)
  const queryClient = useQueryClient()

  const emptyState = {
    ethToCrab: BIG_ZERO,
    minEthFromSqth: BIG_ZERO,
    minEthFromUsdc: BIG_ZERO,
    wPowerPerpPoolFee: UNI_POOL_FEES,
    usdcPoolFee: getUSDCPoolFee(network),
  }

  const getFlashBullDepositParams = async (totalEthDeposit: BigNumber) => {
    if (!bullStrategyContract || !crabV2Vault || !quoterContract) return emptyState

    let prevState = { ...emptyState }
    let start = new BigNumber(0.25)
    let end = new BigNumber(3)
    const deviation = new BigNumber(0.0001) // .01 %

    while (start.lte(end)) {
      const middle = start.plus(end).div(2)

      const ethToCrab = totalEthDeposit.times(middle)
      const { oSqthToMint, wethToLend, usdcToBorrow } = await getWethToLendFromCrabEth(
        bullStrategyContract,
        ethToCrab,
        crabV2Vault,
        crabTotalSupply,
        bullCrabBalance,
        bullSupply,
      )

      if (ethToCrab.eq(prevState.ethToCrab)) break

      const oSqthProceedsPromise = getExactIn(
        quoterContract,
        oSqueeth,
        weth,
        fromTokenAmount(oSqthToMint, 18),
        UNI_POOL_FEES,
        slippage.toNumber(),
      )
      const usdcProceedsPromise = getExactIn(
        quoterContract,
        usdc,
        weth,
        fromTokenAmount(usdcToBorrow, USDC_DECIMALS),
        getUSDCPoolFee(network),
        slippage.toNumber(),
      )

      const [{ minAmountOut: oSqthProceeds }, { minAmountOut: usdcProceeds }] = await Promise.all([
        oSqthProceedsPromise,
        usdcProceedsPromise,
      ])

      const minEthFromSqth = toTokenAmount(oSqthProceeds, 18)
      const minEthFromUsdc = toTokenAmount(usdcProceeds, 18)

      prevState = { ...emptyState, ethToCrab, minEthFromSqth, minEthFromUsdc }

      const totalToBull = ethToCrab.plus(wethToLend).minus(minEthFromSqth).minus(minEthFromUsdc)
      console.log('Bull', middle.toNumber(), ethToCrab.toString(), totalEthDeposit.div(totalToBull).toString())
      // Total to bull should almost equal to totalEthDeposit
      if (totalToBull.gt(totalEthDeposit)) {
        end = middle
      } else {
        if (totalEthDeposit.div(totalToBull).minus(1).lte(deviation)) {
          // Means we found a number lightly less than totalEthDeposit
          break
        }
        start = middle
      }
    }

    return prevState
  }

  const queryKey = useAppMemo(
    () =>
      `getFlashBullDepositParams-${network}-${crabTotalSupply.toString()}-${bullCrabBalance.toString()}-${bullSupply.toString()}-${crabV2Vault?.collateralAmount.toString()}`,
    [network, crabTotalSupply, bullCrabBalance, bullSupply, crabV2Vault],
  )

  const getCachedDepositParams = async (totalEthDeposit: BigNumber) => {
    try {
      console.log('Here in query', `${queryKey}-${totalEthDeposit.toString()}`)
      console.log(queryClient.getQueryCache().get(`${queryKey}-${totalEthDeposit.toString()}`))
      const data = await queryClient.fetchQuery({
        queryKey: `${queryKey}-${totalEthDeposit.toString()}`,
        queryFn: () => getFlashBullDepositParams(totalEthDeposit),
        staleTime: 300_000,
      })
      return data
    } catch (error) {
      console.log(error)
      return emptyState
    }
  }

  return getCachedDepositParams
}

export const useBullFlashDeposit = () => {
  const flashBullContract = useAtomValue(flashBullContractAtom)
  const address = useAtomValue(addressAtom)
  const handleTransaction = useHandleTransaction()

  const flashDepositToBull = (
    ethToCrab: BigNumber,
    minEthFromSqth: BigNumber,
    minEthFromUsdc: BigNumber,
    wPowerPerpPoolFee: number,
    usdcPoolFee: number,
    ethToSend: BigNumber,
    onTxConfirmed?: () => void,
  ) => {
    if (!flashBullContract) return

    console.log(
      ethToCrab.toString(),
      minEthFromSqth.toString(),
      minEthFromUsdc.toString(),
      wPowerPerpPoolFee,
      usdcPoolFee,
      ethToSend.toString(),
    )

    return handleTransaction(
      flashBullContract.methods
        .flashDeposit({
          ethToCrab: fromTokenAmount(ethToCrab, 18).toFixed(0),
          minEthFromSqth: fromTokenAmount(minEthFromSqth, 18).toFixed(0),
          minEthFromUsdc: fromTokenAmount(minEthFromUsdc, 18).toFixed(0),
          wPowerPerpPoolFee,
          usdcPoolFee,
        })
        .send({
          from: address,
          value: fromTokenAmount(ethToSend, 18).toFixed(0),
        }),
      onTxConfirmed,
    )
  }

  return flashDepositToBull
}
