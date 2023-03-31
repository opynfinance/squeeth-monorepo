import { useQuery } from '@apollo/client'
import {
  BIG_ONE,
  BIG_ZERO,
  REVERTED_TRANSACTION_CODE,
  UNI_POOL_FEES,
  USDC_DECIMALS,
  WETH_DECIMALS,
} from '@constants/index'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import useAmplitude from '@hooks/useAmplitude'
import useAppCallback from '@hooks/useAppCallback'
import useAppMemo from '@hooks/useAppMemo'
import { useOnChainETHPrice } from '@hooks/useETHPrice'
import usePopup, { GenericErrorPopupConfig } from '@hooks/usePopup'
import STRATEGY_QUERY from '@queries/squeeth/strategyQuery'
import { strategyQuery, strategyQueryVariables } from '@queries/squeeth/__generated__/strategyQuery'
import {
  auctionBullContractAtom,
  bullStrategyContractAtom,
  eulerLensContractAtom,
  flashBullContractAtom,
  quoterContractAtom,
  wethETokenContractAtom,
  bullEmergencyWithdrawContractAtom,
} from '@state/contracts/atoms'
import { indexAtom } from '@state/controller/atoms'
import { crabStrategySlippageAtomV2, crabStrategyVaultAtomV2, crabTotalSupplyV2Atom } from '@state/crab/atoms'
import { addressesAtom } from '@state/positions/atoms'
import { squeethInitialPriceAtom } from '@state/squeethPool/atoms'
import { useGetWSqueethPositionValueInETH } from '@state/squeethPool/hooks'
import { addressAtom, networkIdAtom } from '@state/wallet/atoms'
import { useHandleTransaction } from '@state/wallet/hooks'
import { BULL_EVENTS } from '@utils/amplitude'
import { squeethClient } from '@utils/apollo-client'
import { fromTokenAmount, getUSDCPoolFee, toTokenAmount } from '@utils/calculations'
import { getExactIn, getExactOut } from '@utils/quoter'
import BigNumber from 'bignumber.js'
import { useAtomValue, useSetAtom } from 'jotai'
import { useUpdateAtom } from 'jotai/utils'
import { useEffect, useMemo } from 'react'
import { useQueryClient } from 'react-query'
import { useMountedState } from 'react-use'
import {
  bullCapAtom,
  bullCRAtom,
  bullDeltaAtom,
  bullCrabBalanceAtom,
  bullCurrentETHPositionAtom,
  bullCurrentUSDCPositionAtom,
  bullDepositedEthInEulerAtom,
  bullEthValuePerShareAtom,
  bullEulerUsdcDebtPerShareAtom,
  bullEulerWethCollatPerShareAtom,
  bullSupplyAtom,
  isBullReadyAtom,
  eulerUsdcBorrowRateAtom,
  eulerETHLendRateAtom,
  bullTimeAtLastHedgeAtom,
  bullEulerUSDCDebtAtom,
  bullCrabPositionValueInEth,
  bullCrabValueInEth,
  isBullRecoveryReadyAtom,
} from './atoms'
import {
  calcAssetNeededForFlashWithdraw,
  getEulerInterestRate,
  getWethToLendFromCrabEth,
  calcAssetNeededForEmergencyWithdraw,
} from './utils'

export const useInitBullStrategy = () => {
  const setBullState = useSetBullState()
  const setBullUserState = useSetBullUserState()
  const setBullTimeAtLastHedge = useSetAtom(bullTimeAtLastHedgeAtom)
  const { auctionBull } = useAtomValue(addressesAtom)
  const networkId = useAtomValue(networkIdAtom)

  const { data, loading } = useQuery<strategyQuery, strategyQueryVariables>(STRATEGY_QUERY, {
    variables: { strategyId: auctionBull },
    fetchPolicy: 'cache-and-network',
    client: squeethClient[networkId],
  })

  useEffect(() => {
    if (loading) return

    setBullTimeAtLastHedge(data?.strategy?.lastHedgeTimestamp)
  }, [data?.strategy?.lastHedgeTimestamp, loading, setBullTimeAtLastHedge])

  useEffect(() => {
    setBullState()
  }, [setBullState])

  useEffect(() => {
    setBullUserState()
  }, [setBullUserState])
}

export const useSetBullState = () => {
  const bullContract = useAtomValue(bullStrategyContractAtom)
  const etokenContract = useAtomValue(wethETokenContractAtom)
  const auctionBullContract = useAtomValue(auctionBullContractAtom)
  const eulerLenseContract = useAtomValue(eulerLensContractAtom)
  const setBullCrabBalance = useUpdateAtom(bullCrabBalanceAtom)
  const setBullSupply = useUpdateAtom(bullSupplyAtom)
  const setEulerWeth = useUpdateAtom(bullEulerWethCollatPerShareAtom)
  const setEulerUsdc = useUpdateAtom(bullEulerUsdcDebtPerShareAtom)
  const setBullCap = useUpdateAtom(bullCapAtom)
  const setDepositedEth = useUpdateAtom(bullDepositedEthInEulerAtom)
  const setBullCR = useUpdateAtom(bullCRAtom)
  const setBullDelta = useUpdateAtom(bullDeltaAtom)
  const setUsdcBorrowRate = useUpdateAtom(eulerUsdcBorrowRateAtom)
  const setEthLendRate = useUpdateAtom(eulerETHLendRateAtom)
  const setTotalUSDCInEuler = useUpdateAtom(bullEulerUSDCDebtAtom)
  const { bullStrategy, weth, usdc } = useAtomValue(addressesAtom)

  const isMounted = useMountedState()

  const setBullState = useAppCallback(async () => {
    if (!bullContract || !etokenContract || !auctionBullContract || !eulerLenseContract) return null
    try {
      const p1 = bullContract.methods.getCrabBalance().call()
      const p2 = bullContract.methods.totalSupply().call()
      const p3 = bullContract.methods.calcWethToWithdraw(BIG_ONE.toString()).call()
      const p4 = bullContract.methods.calcUsdcToRepay(BIG_ONE.toString()).call()
      const p5 = bullContract.methods.strategyCap().call()
      const p6 = etokenContract.methods.balanceOfUnderlying(bullStrategy).call()
      const p7 = auctionBullContract.methods.getCurrentDeltaAndCollatRatio().call()
      const p8 = eulerLenseContract.methods.interestRates(weth).call()
      const p9 = eulerLenseContract.methods.interestRates(usdc).call()
      const p10 = eulerLenseContract.methods.getDTokenBalance(usdc, bullStrategy).call()

      const [
        crabBalance,
        totalSupply,
        eulerWeth,
        eulerUsdc,
        bullCap,
        depositedEth,
        deltaAndCr,
        wethInterests,
        usdcInterests,
        totalUsdcInEuler,
      ] = await Promise.all([p1, p2, p3, p4, p5, p6, p7, p8, p9, p10])

      if (!isMounted()) return null

      setBullCrabBalance(toTokenAmount(crabBalance, WETH_DECIMALS))
      setBullSupply(toTokenAmount(totalSupply, WETH_DECIMALS))
      setEulerWeth(toTokenAmount(eulerWeth, WETH_DECIMALS))
      setEulerUsdc(toTokenAmount(eulerUsdc, USDC_DECIMALS))
      setBullCap(toTokenAmount(bullCap, WETH_DECIMALS))
      setDepositedEth(toTokenAmount(depositedEth, WETH_DECIMALS))
      setBullDelta(toTokenAmount(deltaAndCr[0], WETH_DECIMALS))
      setBullCR(toTokenAmount(deltaAndCr[1], WETH_DECIMALS))
      setUsdcBorrowRate(getEulerInterestRate(new BigNumber(usdcInterests[1])))
      setEthLendRate(getEulerInterestRate(new BigNumber(wethInterests[2])))
      setTotalUSDCInEuler(toTokenAmount(totalUsdcInEuler, USDC_DECIMALS))
    } catch (error) {
      console.error(error)
    }
  }, [bullContract, etokenContract, auctionBullContract, eulerLenseContract, bullStrategy, weth, usdc, isMounted])

  return setBullState
}

export const useSetBullUserState = () => {
  const { bullStrategy } = useAtomValue(addressesAtom)
  const { value: bullShare } = useTokenBalance(bullStrategy)
  const eulerWeth = useAtomValue(bullEulerWethCollatPerShareAtom)
  const eulerUsdc = useAtomValue(bullEulerUsdcDebtPerShareAtom)
  const index = useAtomValue(indexAtom)
  const ethPrice = toTokenAmount(index, 18).sqrt()
  const bullCrabBalance = useAtomValue(bullCrabBalanceAtom)
  const bullSupply = useAtomValue(bullSupplyAtom)
  const crabTotalSupply = useAtomValue(crabTotalSupplyV2Atom)
  const crabV2Vault = useAtomValue(crabStrategyVaultAtomV2)
  const getWSqueethPositionValueInETH = useGetWSqueethPositionValueInETH()
  const setBullCurrentPosition = useUpdateAtom(bullCurrentETHPositionAtom)
  const setBullCurrentUsdcPosition = useUpdateAtom(bullCurrentUSDCPositionAtom)
  const setBullEthValuePerShare = useUpdateAtom(bullEthValuePerShareAtom)
  const setBullReady = useUpdateAtom(isBullReadyAtom)

  const isMounted = useMountedState()

  const setBullUserState = useAppCallback(async () => {
    if (!crabV2Vault || eulerWeth.isZero() || eulerUsdc.isZero() || !isMounted()) return null

    const leverageComponent = bullShare.times(eulerWeth.minus(eulerUsdc.div(ethPrice))).div(bullSupply)
    const userCrab = bullShare.times(bullCrabBalance).div(bullSupply)
    const crabCollat = userCrab.times(crabV2Vault.collateralAmount).div(crabTotalSupply)
    const crabDebt = userCrab.times(crabV2Vault.shortAmount).div(crabTotalSupply)
    const crabDebtInEth = getWSqueethPositionValueInETH(crabDebt)

    const crabComponent = crabCollat.minus(crabDebtInEth)
    const userBullPosition = crabComponent.plus(leverageComponent)
    if (!isMounted()) return null
    setBullCurrentPosition(new BigNumber(userBullPosition.toFixed(18)))
    setBullCurrentUsdcPosition(userBullPosition.times(ethPrice))
    setBullEthValuePerShare(userBullPosition.div(bullShare))
    setBullReady(true)
  }, [bullCrabBalance, bullShare, bullSupply, crabTotalSupply, crabV2Vault, ethPrice, eulerUsdc, eulerWeth, isMounted])

  return setBullUserState
}

export const useInitBullRecoveryStrategy = () => {
  const setBullRecoveryState = useSetBullRecoveryState()
  const setBullRecoveryUserState = useSetBullRecoveryUserState()

  useEffect(() => {
    setBullRecoveryState()
  }, [setBullRecoveryState])

  useEffect(() => {
    setBullRecoveryUserState()
  }, [setBullRecoveryUserState])
}

export const useSetBullRecoveryState = () => {
  const bullContract = useAtomValue(bullStrategyContractAtom)
  const bullEmergencyWithdrawContract = useAtomValue(bullEmergencyWithdrawContractAtom)

  const setBullCrabBalance = useUpdateAtom(bullCrabBalanceAtom)
  const setBullSupply = useUpdateAtom(bullSupplyAtom)

  const isMounted = useMountedState()

  const setBullRecoveryState = useAppCallback(async () => {
    if (!bullContract || !bullEmergencyWithdrawContract) {
      return null
    }

    try {
      const p1 = bullContract.methods.getCrabBalance().call()
      const p2 = bullContract.methods.totalSupply().call()
      const p3 = bullEmergencyWithdrawContract.methods.redeemedZenBullAmountForCrabWithdrawal().call()

      const [crabBalance, totalSupply, redeemed] = await Promise.all([p1, p2, p3])

      if (!isMounted()) return null

      setBullCrabBalance(toTokenAmount(crabBalance, WETH_DECIMALS))
      setBullSupply(toTokenAmount(totalSupply, WETH_DECIMALS).minus(toTokenAmount(redeemed, WETH_DECIMALS)))
    } catch (error) {
      console.error(error)
    }
  }, [bullContract, bullEmergencyWithdrawContract, isMounted])

  return setBullRecoveryState
}

export const useSetBullRecoveryUserState = () => {
  const { bullStrategy } = useAtomValue(addressesAtom)
  const bullCrabBalance = useAtomValue(bullCrabBalanceAtom)
  const bullSupply = useAtomValue(bullSupplyAtom)
  const crabTotalSupply = useAtomValue(crabTotalSupplyV2Atom)
  const crabV2Vault = useAtomValue(crabStrategyVaultAtomV2)
  const index = useAtomValue(indexAtom)

  const setBullCrabPositionValueInEth = useUpdateAtom(bullCrabPositionValueInEth)
  const setBullCrabValueInEth = useUpdateAtom(bullCrabValueInEth)
  const setBullRecoveryReady = useUpdateAtom(isBullRecoveryReadyAtom)

  const getWSqueethPositionValueInETH = useGetWSqueethPositionValueInETH()
  const isMounted = useMountedState()

  const { value: userBullBalance } = useTokenBalance(bullStrategy)
  const ethPrice = toTokenAmount(index, 18).sqrt()

  const setBullRecoveryUserState = useAppCallback(async () => {
    if (!crabV2Vault || !isMounted()) {
      return null
    }

    const bullShare = bullSupply.isZero() ? BIG_ZERO : userBullBalance.div(bullSupply)
    const userCrab = bullShare.times(bullCrabBalance)
    const crabCollat = userCrab.times(crabV2Vault.collateralAmount).div(crabTotalSupply)
    const crabDebt = userCrab.times(crabV2Vault.shortAmount).div(crabTotalSupply)
    const crabDebtInEth = getWSqueethPositionValueInETH(crabDebt)

    const crabComponent = crabCollat.minus(crabDebtInEth)
    const userBullCrabPosition = crabComponent

    setBullCrabPositionValueInEth(new BigNumber(userBullCrabPosition.toFixed(18)))
    setBullCrabValueInEth(userBullCrabPosition.div(userBullBalance))
    setBullRecoveryReady(true)
  }, [bullCrabBalance, userBullBalance, bullSupply, crabTotalSupply, crabV2Vault, ethPrice, isMounted])

  return setBullRecoveryUserState
}

export const useGetFlashBulldepositParams = () => {
  const bullStrategyContract = useAtomValue(bullStrategyContractAtom)
  const crabV2Vault = useAtomValue(crabStrategyVaultAtomV2)
  const crabTotalSupply = useAtomValue(crabTotalSupplyV2Atom)
  const bullCrabBalance = useAtomValue(bullCrabBalanceAtom)
  const bullSupply = useAtomValue(bullSupplyAtom)
  const quoterContract = useAtomValue(quoterContractAtom)
  const { weth, oSqueeth, usdc } = useAtomValue(addressesAtom)
  const slippage = useAtomValue(crabStrategySlippageAtomV2)
  const network = useAtomValue(networkIdAtom)
  const queryClient = useQueryClient()
  const ethPrice = useOnChainETHPrice()
  const sqthPrice = useAtomValue(squeethInitialPriceAtom)

  const emptyState = useMemo(
    () => ({
      ethToCrab: BIG_ZERO,
      minEthFromSqth: BIG_ZERO,
      minEthFromUsdc: BIG_ZERO,
      ethOutForSqth: BIG_ZERO,
      ethOutForUsdc: BIG_ZERO,
      oSqthIn: BIG_ZERO,
      usdcIn: BIG_ZERO,
      wPowerPerpPoolFee: UNI_POOL_FEES,
      usdcPoolFee: getUSDCPoolFee(network),
      priceImpact: 0,
      wethToLend: BIG_ZERO,
      poolFee: 0,
    }),
    [network],
  )

  const getFlashBullDepositParams = useAppCallback(
    async (totalEthDeposit: BigNumber) => {
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
          slippage,
        )
        const usdcProceedsPromise = getExactIn(
          quoterContract,
          usdc,
          weth,
          fromTokenAmount(usdcToBorrow, USDC_DECIMALS),
          getUSDCPoolFee(network),
          slippage,
        )

        const [
          { minAmountOut: oSqthMinProceeds, amountOut: oSqthProceeds },
          { minAmountOut: usdcMinProceeds, amountOut: usdcProceeds },
        ] = await Promise.all([oSqthProceedsPromise, usdcProceedsPromise])

        const minEthFromSqth = toTokenAmount(oSqthMinProceeds, 18)
        const minEthFromUsdc = toTokenAmount(usdcMinProceeds, 18)
        const cumulativeSpotPrice = oSqthToMint.times(sqthPrice).plus(usdcToBorrow.div(ethPrice))
        const executionPrice = toTokenAmount(oSqthProceeds, 18).plus(toTokenAmount(usdcProceeds, 18))

        const squeethSpot = oSqthToMint.times(sqthPrice) // eth from sqth trade
        const usdcSpot = usdcToBorrow.div(ethPrice) // eth from usdc trade

        // cumulative uniswap fees

        const poolFee = squeethSpot
          .times(UNI_POOL_FEES)
          .plus(usdcSpot.times(getUSDCPoolFee(network)))
          .div(cumulativeSpotPrice)

        const priceImpact = (1 - executionPrice.div(cumulativeSpotPrice).toNumber()) * 100

        prevState = {
          ...emptyState,
          ethToCrab,
          minEthFromSqth,
          minEthFromUsdc,
          priceImpact,
          wethToLend,
          ethOutForSqth: toTokenAmount(oSqthProceeds, 18),
          ethOutForUsdc: toTokenAmount(usdcProceeds, 18),
          usdcIn: usdcToBorrow,
          oSqthIn: oSqthToMint,
          poolFee: poolFee.div(10000).toNumber(),
        }

        const totalToBull = ethToCrab.plus(wethToLend).minus(minEthFromSqth).minus(minEthFromUsdc)
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
    },
    [
      bullCrabBalance,
      bullStrategyContract,
      bullSupply,
      crabTotalSupply,
      crabV2Vault,
      emptyState,
      ethPrice,
      network,
      oSqueeth,
      quoterContract,
      slippage,
      sqthPrice,
      usdc,
      weth,
    ],
  )

  const queryKey = useAppMemo(
    () =>
      `getFlashBullDepositParams-${network}-${crabTotalSupply.toString()}-${bullCrabBalance.toString()}-${bullSupply.toString()}-${crabV2Vault?.collateralAmount.toString()}-${slippage.toString()}-${ethPrice.toString()}-${sqthPrice.toString()}`,
    [
      network,
      crabTotalSupply,
      bullCrabBalance,
      bullSupply,
      crabV2Vault?.collateralAmount,
      slippage,
      ethPrice,
      sqthPrice,
    ],
  )

  const getCachedDepositParams = async (totalEthDeposit: BigNumber) => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: `${queryKey}-${totalEthDeposit.toString()}`,
        queryFn: () => getFlashBullDepositParams(totalEthDeposit),
        staleTime: 60_000,
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
  const { track } = useAmplitude()
  const { flashBull } = useAtomValue(addressesAtom)
  const { show: showErrorFeedbackPopup } = usePopup(
    GenericErrorPopupConfig('Hi, I am having trouble depositing into bull.', 'deposit-bull'),
  )

  const flashDepositToBull = async (
    ethToCrab: BigNumber,
    minEthFromSqth: BigNumber,
    minEthFromUsdc: BigNumber,
    wPowerPerpPoolFee: number,
    usdcPoolFee: number,
    ethToSend: BigNumber,
    dataToTrack?: any,
    onTxConfirmed?: (id?: string) => void,
  ) => {
    if (!flashBullContract) return
    track(BULL_EVENTS.DEPOSIT_BULL_CLICK, dataToTrack)
    let gasEstimate
    let gas
    try {
      try {
        gasEstimate = await flashBullContract.methods
          .flashDeposit({
            ethToCrab: fromTokenAmount(ethToCrab, 18).toFixed(0),
            minEthFromSqth: fromTokenAmount(minEthFromSqth, 18).toFixed(0),
            minEthFromUsdc: fromTokenAmount(minEthFromUsdc, 18).toFixed(0),
            wPowerPerpPoolFee,
            usdcPoolFee,
          })
          .estimateGas({
            to: flashBull,
            value: fromTokenAmount(ethToSend, WETH_DECIMALS).toFixed(0),
            from: address,
          })

        console.log('gasEstimate for flashdeposit', gasEstimate)
        if (gasEstimate === 0) throw new Error('WRONG_GAS_ESTIMATE')
      } catch (e) {
        track(BULL_EVENTS.DEPOSIT_BULL_WRONG_GAS)
        alert('Error occurred, please refresh and try again')
        throw e
      }

      gas = Number((gasEstimate * 1.2).toFixed(0))

      await handleTransaction(
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
            gas: gasEstimate ? gas : undefined,
          }),
        onTxConfirmed,
      )
      track(BULL_EVENTS.DEPOSIT_BULL_SUCCESS, { ...(dataToTrack ? { ...dataToTrack, gas } : {}) })
    } catch (e: any) {
      const trackingData = { ...(dataToTrack ?? {}), gas }
      e?.code === REVERTED_TRANSACTION_CODE ? track(BULL_EVENTS.DEPOSIT_BULL_REVERT, trackingData) : null
      e?.code !== REVERTED_TRANSACTION_CODE ? showErrorFeedbackPopup() : null
      track(BULL_EVENTS.DEPOSIT_BULL_FAILED, {
        code: e?.code,
        message: e?.message,
        ...trackingData,
      })
      console.log(e)
    }
  }

  return flashDepositToBull
}

export const useGetFlashWithdrawParams = () => {
  const bullStrategyContract = useAtomValue(bullStrategyContractAtom)
  const crabV2Vault = useAtomValue(crabStrategyVaultAtomV2)
  const crabTotalSupply = useAtomValue(crabTotalSupplyV2Atom)
  const bullCrabBalance = useAtomValue(bullCrabBalanceAtom)
  const bullSupply = useAtomValue(bullSupplyAtom)
  const network = useAtomValue(networkIdAtom)
  const quoterContract = useAtomValue(quoterContractAtom)
  const slippage = useAtomValue(crabStrategySlippageAtomV2)
  const { oSqueeth, weth, usdc } = useAtomValue(addressesAtom)
  const queryClient = useQueryClient()
  const ethPrice = useOnChainETHPrice()
  const sqthPrice = useAtomValue(squeethInitialPriceAtom)

  const emptyState = {
    maxEthForWPowerPerp: BIG_ZERO,
    maxEthForUsdc: BIG_ZERO,
    wPowerPerpPoolFee: UNI_POOL_FEES,
    usdcPoolFee: getUSDCPoolFee(network),
    priceImpact: 0,
    ethInForSqth: BIG_ZERO,
    ethInForUsdc: BIG_ZERO,
    oSqthOut: BIG_ZERO,
    usdcOut: BIG_ZERO,
    poolFee: 0,
  }

  const getFlashWithdrawParams = async (bullToFlashWithdraw: BigNumber) => {
    if (!bullStrategyContract || !crabV2Vault || !quoterContract) return emptyState

    const { wPowerPerpToRedeem, usdcToRepay } = await calcAssetNeededForFlashWithdraw(
      bullStrategyContract,
      bullToFlashWithdraw,
      crabV2Vault,
      bullSupply,
      bullCrabBalance,
      crabTotalSupply,
    )

    const oSqthProceedsPromise = getExactOut(
      quoterContract,
      weth,
      oSqueeth,
      fromTokenAmount(wPowerPerpToRedeem, 18),
      UNI_POOL_FEES,
      slippage,
    )

    const usdcProceedsPromise = getExactOut(
      quoterContract,
      weth,
      usdc,
      fromTokenAmount(usdcToRepay, USDC_DECIMALS),
      getUSDCPoolFee(network),
      slippage,
    )

    const [
      { maxAmountIn: oSqthMinProceeds, amountIn: oSqthProceeds },
      { maxAmountIn: usdcMinProceeds, amountIn: usdcProceeds },
    ] = await Promise.all([oSqthProceedsPromise, usdcProceedsPromise])

    const maxEthForWPowerPerp = toTokenAmount(oSqthMinProceeds, 18)
    const maxEthForUsdc = toTokenAmount(usdcMinProceeds, 18)

    const cumulativeSpotPrice = wPowerPerpToRedeem.times(sqthPrice).plus(usdcToRepay.div(ethPrice))
    const executionPrice = toTokenAmount(oSqthProceeds, 18).plus(toTokenAmount(usdcProceeds, 18))

    const squeethSpot = wPowerPerpToRedeem.times(sqthPrice)
    const usdcSpot = usdcToRepay.div(ethPrice)

    // cumulative uniswap fees

    const poolFee = squeethSpot
      .times(UNI_POOL_FEES)
      .plus(usdcSpot.times(getUSDCPoolFee(network)))
      .div(cumulativeSpotPrice)

    const priceImpact = (executionPrice.div(cumulativeSpotPrice).toNumber() - 1) * 100

    return {
      ...emptyState,
      maxEthForUsdc,
      maxEthForWPowerPerp,
      priceImpact,
      ethInForSqth: toTokenAmount(oSqthProceeds, 18),
      ethInForUsdc: toTokenAmount(usdcProceeds, 18),
      usdcOut: usdcToRepay,
      oSqthOut: wPowerPerpToRedeem,
      poolFee: poolFee.div(10000).toNumber(),
    }
  }

  const queryKey = useAppMemo(
    () =>
      `getFlashBullWithdrawParams-${network}-${crabTotalSupply.toString()}-${bullCrabBalance.toString()}-${bullSupply.toString()}-${crabV2Vault?.collateralAmount.toString()}-${ethPrice.toString()}-${sqthPrice.toString()}-${slippage.toString()}`,
    [
      network,
      crabTotalSupply,
      bullCrabBalance,
      bullSupply,
      crabV2Vault?.collateralAmount,
      ethPrice,
      sqthPrice,
      slippage,
    ],
  )

  const getCachedWithdrawParams = async (bullToWithdraw: BigNumber) => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: `${queryKey}-${bullToWithdraw.toString()}`,
        queryFn: () => getFlashWithdrawParams(bullToWithdraw),
        staleTime: 60_000,
      })
      return data
    } catch (error) {
      console.log(error)
      return emptyState
    }
  }

  return getCachedWithdrawParams
}

export const useBullFlashWithdraw = () => {
  const flashBullContract = useAtomValue(flashBullContractAtom)
  const address = useAtomValue(addressAtom)
  const handleTransaction = useHandleTransaction()
  const { track } = useAmplitude()
  const { flashBull } = useAtomValue(addressesAtom)
  const { show: showErrorFeedbackPopup } = usePopup(
    GenericErrorPopupConfig('Hi, I am having trouble withdrawing from bull.', 'withdraw-bull'),
  )

  const flashWithdrawFromBull = async (
    bullAmount: BigNumber,
    maxEthForWPowerPerp: BigNumber,
    maxEthForUsdc: BigNumber,
    wPowerPerpPoolFee: number,
    usdcPoolFee: number,
    dataToTrack?: any,
    onTxConfirmed?: () => void,
  ) => {
    if (!flashBullContract) return
    track(BULL_EVENTS.WITHDRAW_BULL_CLICK, dataToTrack)
    let gasEstimate
    let gas
    try {
      try {
        gasEstimate = await flashBullContract.methods
          .flashWithdraw({
            bullAmount: fromTokenAmount(bullAmount, 18).toFixed(0),
            maxEthForWPowerPerp: fromTokenAmount(maxEthForWPowerPerp, 18).toFixed(0),
            maxEthForUsdc: fromTokenAmount(maxEthForUsdc, 18).toFixed(0),
            wPowerPerpPoolFee,
            usdcPoolFee,
          })
          .estimateGas({
            to: flashBull,
            from: address,
          })

        console.log('gasEstimate for flashwithdraw', gasEstimate)
        if (gasEstimate === 0) throw new Error('WRONG_GAS_ESTIMATE')
      } catch (e) {
        track(BULL_EVENTS.WITHDRAW_BULL_WRONG_GAS)
        alert('Error occurred, please refresh and try again')
        throw e
      }
      gas = Number((gasEstimate * 1.2).toFixed(0))
      await handleTransaction(
        flashBullContract.methods
          .flashWithdraw({
            bullAmount: fromTokenAmount(bullAmount, 18).toFixed(0),
            maxEthForWPowerPerp: fromTokenAmount(maxEthForWPowerPerp, 18).toFixed(0),
            maxEthForUsdc: fromTokenAmount(maxEthForUsdc, 18).toFixed(0),
            wPowerPerpPoolFee,
            usdcPoolFee,
          })
          .send({
            from: address,
            gas: gasEstimate ? Number((gasEstimate * 1.2).toFixed(0)) : undefined,
          }),
        onTxConfirmed,
      )

      track(BULL_EVENTS.WITHDRAW_BULL_SUCCESS, { ...(dataToTrack ? { ...dataToTrack, gas } : {}) })
    } catch (e: any) {
      const trackingData = { ...(dataToTrack ?? {}), gas }
      e?.code === REVERTED_TRANSACTION_CODE ? track(BULL_EVENTS.WITHDRAW_BULL_REVERT, trackingData) : null
      e?.code !== REVERTED_TRANSACTION_CODE ? showErrorFeedbackPopup() : null

      track(BULL_EVENTS.WITHDRAW_BULL_FAILED, {
        code: e?.code,
        message: e?.message,
        ...trackingData,
      })
      console.log(e)
    }
  }

  return flashWithdrawFromBull
}

export const useGetEmergencyWithdrawParams = () => {
  const crabV2Vault = useAtomValue(crabStrategyVaultAtomV2)
  const bullSupply = useAtomValue(bullSupplyAtom)
  const bullCrabBalance = useAtomValue(bullCrabBalanceAtom)
  const crabTotalSupply = useAtomValue(crabTotalSupplyV2Atom)
  const quoterContract = useAtomValue(quoterContractAtom)
  const { oSqueeth, weth } = useAtomValue(addressesAtom)
  const slippage = useAtomValue(crabStrategySlippageAtomV2)
  const sqthPriceInEth = useAtomValue(squeethInitialPriceAtom)
  const network = useAtomValue(networkIdAtom)
  const queryClient = useQueryClient()

  const emptyState = {
    maxEthForWPowerPerp: BIG_ZERO,
    ethInForOsqth: BIG_ZERO,
    osqthOut: BIG_ZERO,
    wPowerPerpPoolFee: UNI_POOL_FEES,
    priceImpact: 0,
  }

  const getEmergencyWithdrawParams = async (bullToWithdraw: BigNumber) => {
    if (!crabV2Vault || !quoterContract) {
      return emptyState
    }

    const { wPowerPerpToRedeem } = await calcAssetNeededForEmergencyWithdraw(
      bullToWithdraw,
      crabV2Vault,
      bullSupply,
      bullCrabBalance,
      crabTotalSupply,
    )

    const { maxAmountIn: maxEthForOsqth, amountIn: ethForOsqth } = await getExactOut(
      quoterContract,
      weth,
      oSqueeth,
      fromTokenAmount(wPowerPerpToRedeem, 18),
      UNI_POOL_FEES,
      slippage,
    )

    const maxEthForWPowerPerp = toTokenAmount(maxEthForOsqth, 18)
    const ethInForOsqth = toTokenAmount(ethForOsqth, 18)

    const spotPrice = wPowerPerpToRedeem.times(sqthPriceInEth)
    const executionPrice = ethInForOsqth

    const priceImpact = (executionPrice.div(spotPrice).toNumber() - 1) * 100

    return {
      ...emptyState,
      maxEthForWPowerPerp,
      ethInForOsqth,
      osqthOut: wPowerPerpToRedeem,
      priceImpact,
    }
  }

  const queryKey = useAppMemo(
    () =>
      `getEmergencyWithdrawParams-${network}-${crabTotalSupply.toString()}-${bullCrabBalance.toString()}-${bullSupply.toString()}-${crabV2Vault?.collateralAmount.toString()}-${sqthPriceInEth.toString()}-${slippage.toString()}`,
    [network, crabTotalSupply, bullCrabBalance, bullSupply, crabV2Vault?.collateralAmount, sqthPriceInEth, slippage],
  )

  const getCachedWithdrawParams = async (bullToWithdraw: BigNumber) => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: `${queryKey}-${bullToWithdraw.toString()}`,
        queryFn: () => getEmergencyWithdrawParams(bullToWithdraw),
        staleTime: 60_000,
      })
      return data
    } catch (error) {
      console.log(error)
      return emptyState
    }
  }

  return getCachedWithdrawParams
}

export const useBullEmergencyWithdrawEthFromCrab = () => {
  const bullEmergencyWithdrawContract = useAtomValue(bullEmergencyWithdrawContractAtom)
  const address = useAtomValue(addressAtom)
  const { bullEmergencyWithdraw } = useAtomValue(addressesAtom)
  const { track } = useAmplitude()
  const handleTransaction = useHandleTransaction()
  const { show: showErrorFeedbackPopup } = usePopup(
    GenericErrorPopupConfig('Hi, I am having trouble withdrawing from bull.', 'withdraw-bull-recovery'),
  )

  const bullEmergencyWithdrawFromCrab = async (
    bullAmount: BigNumber,
    maxEthForWPowerPerp: BigNumber,
    dataToTrack?: any,
    onTxConfirmed?: () => void,
  ) => {
    if (!bullEmergencyWithdrawContract) {
      return
    }

    track(BULL_EVENTS.EMERGENCY_WITHDRAW_BULL_CLICK, dataToTrack)

    let gasEstimate
    let gas

    try {
      const _bullAmount = fromTokenAmount(bullAmount, 18).toFixed(0)
      const _maxEthForWPowerPerp = fromTokenAmount(maxEthForWPowerPerp, 18).toFixed(0)

      try {
        gasEstimate = await bullEmergencyWithdrawContract.methods
          .emergencyWithdrawEthFromCrab(_bullAmount, _maxEthForWPowerPerp)
          .estimateGas({
            to: bullEmergencyWithdraw,
            from: address,
          })

        console.log('gasEstimate for bullEmergencyWithdraw', gasEstimate)
        if (gasEstimate === 0) throw new Error('WRONG_GAS_ESTIMATE')
      } catch (e) {
        console.error('gas estimate error: ', e)
        track(BULL_EVENTS.EMERGENCY_WITHDRAW_BULL_WRONG_GAS)
        alert('Error occurred, please refresh and try again')
        throw e
      }
      gas = Number((gasEstimate * 1.2).toFixed(0))
      await handleTransaction(
        bullEmergencyWithdrawContract.methods.emergencyWithdrawEthFromCrab(_bullAmount, _maxEthForWPowerPerp).send({
          from: address,
          gas: gasEstimate ? Number((gasEstimate * 1.2).toFixed(0)) : undefined,
        }),
        onTxConfirmed,
      )

      track(BULL_EVENTS.EMERGENCY_WITHDRAW_BULL_SUCCESS, { ...(dataToTrack ? { ...dataToTrack, gas } : {}) })
    } catch (e: any) {
      const trackingData = { ...(dataToTrack ?? {}), gas }
      e?.code === REVERTED_TRANSACTION_CODE ? track(BULL_EVENTS.EMERGENCY_WITHDRAW_BULL_REVERT, trackingData) : null
      e?.code !== REVERTED_TRANSACTION_CODE ? showErrorFeedbackPopup() : null

      track(BULL_EVENTS.EMERGENCY_WITHDRAW_BULL_FAILED, {
        code: e?.code,
        message: e?.message,
        ...trackingData,
      })
      console.log(e)
    }
  }

  return bullEmergencyWithdrawFromCrab
}
