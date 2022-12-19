import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useUpdateAtom } from 'jotai/utils'
import { useCallback, useEffect } from 'react'

import {
  maxCapAtom,
  crabStrategyVaultAtom,
  crabStrategyCollatRatioAtom,
  crabStrategyLiquidationPriceAtom,
  crabStrategyLiquidationPriceAtomV2,
  timeAtLastHedgeAtom,
  loadingAtom,
  profitableMovePercentAtom,
  profitableMovePercentAtomV2,
  isTimeHedgeAvailableAtom,
  isPriceHedgeAvailableAtom,
  currentEthLoadingAtom,
  currentCrabPositionValueAtom,
  currentCrabPositionValueInETHAtom,
  crabPositionValueLoadingAtom,
  crabStrategyVaultAtomV2,
  maxCapAtomV2,
  crabStrategyCollatRatioAtomV2,
  loadingAtomV2,
  isPriceHedgeAvailableAtomV2,
  isTimeHedgeAvailableAtomV2,
  timeAtLastHedgeAtomV2,
  crabPositionValueLoadingAtomV2,
  currentCrabPositionValueAtomV2,
  currentCrabPositionValueInETHAtomV2,
  currentEthLoadingAtomV2,
  currentCrabPositionETHActualAtomV2,
  ethPriceAtLastHedgeAtomV2,
  usdcQueuedAtom,
  crabQueuedAtom,
  crabUSDValueAtom,
  isNettingAuctionLiveAtom,
  crabQueuedInEthAtom,
  crabQueuedInUsdAtom,
  minUSDCAmountAtom,
  minCrabAmountAtom,
  crabTotalSupplyV2Atom,
} from './atoms'
import { addressesAtom } from '../positions/atoms'
import {
  getMaxCap,
  getStrategyVaultId,
  getTimeAtLastHedge,
  checkTimeHedge,
  checkPriceHedge,
  checkPriceHedgeV2,
  getCollateralFromCrabAmount,
  getWsqueethFromCrabAmount,
  getCurrentProfitableMovePercent,
  getCurrentProfitableMovePercentV2,
  getTotalCrabSupply,
} from './utils'
import { useGetCollatRatioAndLiqPrice, useGetVault } from '../controller/hooks'
import db from '@utils/firestore'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import BigNumber from 'bignumber.js'
import { useGetBuyQuote, useGetSellQuote, useGetWSqueethPositionValueInETH } from '../squeethPool/hooks'
import { fromTokenAmount, getUSDCPoolFee, toTokenAmount } from '@utils/calculations'
import { useHandleTransaction } from '../wallet/hooks'
import { addressAtom, networkIdAtom } from '../wallet/atoms'
import { currentImpliedFundingAtom, impliedVolAtom, indexAtom, normFactorAtom } from '../controller/atoms'
import {
  crabHelperContractAtom,
  crabMigrationContractAtom,
  crabNettingContractAtom,
  crabStrategyContractAtom,
  crabStrategyContractAtomV2,
} from '../contracts/atoms'
import useAppCallback from '@hooks/useAppCallback'
import {
  BIG_ONE,
  BIG_ZERO,
  REVERTED_TRANSACTION_CODE,
  UNI_POOL_FEES,
  USDC_DECIMALS,
  WETH_DECIMALS,
} from '@constants/index'
import useAppEffect from '@hooks/useAppEffect'
import { useETHPrice, useOnChainETHPrice } from '@hooks/useETHPrice'
import { userMigratedSharesAtom, userMigratedSharesETHAtom } from '../crabMigration/atom'
import useAppMemo from '@hooks/useAppMemo'
import * as Fathom from 'fathom-client'
import { Networks } from '../../types/index'
import { useUniswapQuoter } from '@hooks/useUniswapQuoter'
import { getEthPriceAtHedge } from '@utils/pricer'
import { squeethInitialPriceAtom } from '../squeethPool/atoms'
import { CRAB_EVENTS } from '@utils/amplitude'
import useAmplitude from '@hooks/useAmplitude'

export const useSetStrategyData = () => {
  const setMaxCap = useUpdateAtom(maxCapAtom)
  const setVault = useUpdateAtom(crabStrategyVaultAtom)
  const setCollatRatio = useUpdateAtom(crabStrategyCollatRatioAtom)
  const setLiquidationPrice = useUpdateAtom(crabStrategyLiquidationPriceAtom)
  const setLoading = useUpdateAtom(loadingAtom)
  const setIsPriceHedgeAvailable = useUpdateAtom(isPriceHedgeAvailableAtom)
  const setIsTimeHedgeAvailable = useUpdateAtom(isTimeHedgeAvailableAtom)
  const setTimeAtLastHedge = useUpdateAtom(timeAtLastHedgeAtom)
  const contract = useAtomValue(crabStrategyContractAtom)
  const getVault = useGetVault()
  const getCollatRatioAndLiqPrice = useGetCollatRatioAndLiqPrice()

  const setStrategyData = useCallback(async () => {
    if (!contract) return

    getMaxCap(contract).then(setMaxCap)
    getStrategyVaultId(contract)
      .then(getVault)
      .then((v) => {
        setVault(v)
        if (v) {
          getCollatRatioAndLiqPrice(v.collateralAmount, v.shortAmount)
            .then((cl) => {
              setCollatRatio(cl.collateralPercent)
              setLiquidationPrice(cl.liquidationPrice)
              setLoading(false)
            })
            .catch((e) => {
              setLoading(false)
            })
        }
      })
    getTimeAtLastHedge(contract).then(setTimeAtLastHedge)
    checkTimeHedge(contract).then((h) => setIsTimeHedgeAvailable(h[0]))
    if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      // Check price hedge only if firebase is available
      const doc = await db.doc('squeeth-monitoring/crab').get()
      checkPriceHedge(doc?.data()?.lastAuctionTrigger || 0, contract).then(setIsPriceHedgeAvailable)
    }
  }, [contract, getCollatRatioAndLiqPrice, getVault])

  return setStrategyData
}

export const useSetStrategyDataV2 = () => {
  const setMaxCap = useUpdateAtom(maxCapAtomV2)
  const setVault = useUpdateAtom(crabStrategyVaultAtomV2)
  const setCollatRatio = useUpdateAtom(crabStrategyCollatRatioAtomV2)
  const setLiquidationPrice = useUpdateAtom(crabStrategyLiquidationPriceAtomV2)
  const setLoading = useUpdateAtom(loadingAtomV2)
  const setIsPriceHedgeAvailable = useUpdateAtom(isPriceHedgeAvailableAtomV2)
  const setIsTimeHedgeAvailable = useUpdateAtom(isTimeHedgeAvailableAtomV2)
  const setTimeAtLastHedge = useUpdateAtom(timeAtLastHedgeAtomV2)
  const contract = useAtomValue(crabStrategyContractAtomV2)
  const getVault = useGetVault()
  const getCollatRatioAndLiqPrice = useGetCollatRatioAndLiqPrice()
  const networkId = useAtomValue(networkIdAtom)
  const setEthPriceAtLastHedge = useUpdateAtom(ethPriceAtLastHedgeAtomV2)
  const normFactor = useAtomValue(normFactorAtom)
  const setCrabTotalSupply = useUpdateAtom(crabTotalSupplyV2Atom)

  const setStrategyData = useCallback(async () => {
    if (!contract || !normFactor) return

    getMaxCap(contract).then(setMaxCap)
    getStrategyVaultId(contract)
      .then(getVault)
      .then((v) => {
        setVault(v)
        if (v) {
          getCollatRatioAndLiqPrice(v.collateralAmount, v.shortAmount)
            .then((cl) => {
              setCollatRatio(cl.collateralPercent)
              setLiquidationPrice(cl.liquidationPrice)
              setLoading(false)
            })
            .catch((e) => {
              setLoading(false)
            })
        }
      })
    getTimeAtLastHedge(contract).then(setTimeAtLastHedge)
    getTotalCrabSupply(contract).then(setCrabTotalSupply)
    if (networkId !== Networks.ROPSTEN) {
      checkTimeHedge(contract).then((h) => {
        setIsTimeHedgeAvailable(h)
      })
      if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        // Check price hedge only if firebase is available
        checkPriceHedgeV2(contract).then(setIsPriceHedgeAvailable)
      }
      // get eth price at hedge
      getEthPriceAtHedge().then(setEthPriceAtLastHedge)
    }
  }, [contract, getCollatRatioAndLiqPrice, getVault, networkId])

  return setStrategyData
}

export const useCalculateEthWillingToPay = () => {
  const vault = useAtomValue(crabStrategyVaultAtom)

  const contract = useAtomValue(crabStrategyContractAtom)
  const getBuyQuote = useGetBuyQuote()
  const calculateEthWillingToPay = useCallback(
    async (amount: BigNumber, slippage: number) => {
      const emptyState = {
        amountIn: new BigNumber(0),
        maximumAmountIn: new BigNumber(0),
        priceImpact: '0',
      }
      if (!vault) return emptyState

      const squeethDebt = await getWsqueethFromCrabAmount(amount, contract)
      console.log('Debt', squeethDebt?.toString(), amount.toString())
      if (!squeethDebt) return emptyState

      const ethWillingToPayQuote = await getBuyQuote(squeethDebt, new BigNumber(slippage))
      return ethWillingToPayQuote
    },
    [contract, getBuyQuote, vault?.id],
  )

  return calculateEthWillingToPay
}

export const useCalculateEthWillingToPayV2 = () => {
  const vault = useAtomValue(crabStrategyVaultAtomV2)

  const contract = useAtomValue(crabStrategyContractAtomV2)
  const getBuyQuote = useGetBuyQuote()
  const getWSqueethPositionValueInETH = useGetWSqueethPositionValueInETH()

  const calculateEthWillingToPay = useCallback(
    async (amount: BigNumber, slippage: number) => {
      const emptyState = {
        amountIn: new BigNumber(0),
        maximumAmountIn: new BigNumber(0),
        priceImpact: '0',
        squeethDebt: new BigNumber(0),
        ethToGet: new BigNumber(0),
      }
      if (!vault) return emptyState

      const squeethDebt = await getWsqueethFromCrabAmount(amount, contract)
      const collat = await getCollateralFromCrabAmount(amount, contract, vault)
      console.log('Debt', squeethDebt?.toString(), amount.toString())
      if (!squeethDebt) return emptyState

      const ethWillingToPayQuote = await getBuyQuote(squeethDebt, new BigNumber(slippage))
      return {
        ...ethWillingToPayQuote,
        squeethDebt,
        ethToGet: collat?.minus(ethWillingToPayQuote.maximumAmountIn) || BIG_ZERO,
      }
    },
    [contract, getBuyQuote, vault?.id],
  )

  return calculateEthWillingToPay
}

export const useCurrentCrabPositionValue = () => {
  const { crabStrategy } = useAtomValue(addressesAtom)

  const [isCrabPositionValueLoading, setIsCrabPositionValueLoading] = useAtom(crabPositionValueLoadingAtom)
  const [currentCrabPositionValue, setCurrentCrabPositionValue] = useAtom(currentCrabPositionValueAtom)
  const [currentCrabPositionValueInETH, setCurrentCrabPositionValueInETH] = useAtom(currentCrabPositionValueInETHAtom)
  const { value: userCrabBalance } = useTokenBalance(crabStrategy, 15, 18)
  const contract = useAtomValue(crabStrategyContractAtom)
  const setCurrentEthLoading = useUpdateAtom(currentEthLoadingAtom)
  const vault = useAtomValue(crabStrategyVaultAtom)
  const ethPrice = useETHPrice()
  const setStrategyData = useSetStrategyData()
  const getWSqueethPositionValueInETH = useGetWSqueethPositionValueInETH()

  useEffect(() => {
    setStrategyData()
  }, [])

  const userShares = useAppMemo(() => {
    return userCrabBalance
  }, [userCrabBalance])

  useAppEffect(() => {
    ;(async () => {
      setIsCrabPositionValueLoading(true)
      const [collateral, squeethDebt] = await Promise.all([
        getCollateralFromCrabAmount(userShares, contract, vault),
        getWsqueethFromCrabAmount(userShares, contract),
      ])

      if (!squeethDebt || !collateral) {
        setCurrentCrabPositionValue(BIG_ZERO)
        setCurrentCrabPositionValueInETH(BIG_ZERO)
        return
      }

      const ethDebt = getWSqueethPositionValueInETH(squeethDebt)

      const crabPositionValueInETH = collateral.minus(ethDebt)
      const crabPositionValueInUSD = crabPositionValueInETH.times(ethPrice)

      setCurrentCrabPositionValue(crabPositionValueInUSD)
      setCurrentCrabPositionValueInETH(crabPositionValueInETH)

      setIsCrabPositionValueLoading(false)
      setCurrentEthLoading(false)
    })()
  }, [
    userShares,
    contract,
    setCurrentEthLoading,
    setIsCrabPositionValueLoading,
    getWSqueethPositionValueInETH,
    ethPrice,
    vault,
  ])

  return { currentCrabPositionValue, currentCrabPositionValueInETH, isCrabPositionValueLoading }
}

export const useCurrentCrabPositionValueV2 = () => {
  const { crabStrategy2 } = useAtomValue(addressesAtom)

  const [isCrabPositionValueLoading, setIsCrabPositionValueLoading] = useAtom(crabPositionValueLoadingAtomV2)
  const [currentCrabPositionValue, setCurrentCrabPositionValue] = useAtom(currentCrabPositionValueAtomV2)
  const [currentCrabPositionValueInETH, setCurrentCrabPositionValueInETH] = useAtom(currentCrabPositionValueInETHAtomV2)
  const { value: userCrabBalance, loading: balLoading } = useTokenBalance(crabStrategy2, 15, 18)
  const userMigratedShares = useAtomValue(userMigratedSharesAtom)
  const crabQueuedShares = useAtomValue(crabQueuedAtom)
  const setUserMigratedSharesETH = useUpdateAtom(userMigratedSharesETHAtom)
  const setCurrentCrabPositionETHActual = useUpdateAtom(currentCrabPositionETHActualAtomV2)
  const setCrabQueuedInEth = useUpdateAtom(crabQueuedInEthAtom)
  const setCrabQueuedInUsd = useUpdateAtom(crabQueuedInUsdAtom)
  const contract = useAtomValue(crabStrategyContractAtomV2)
  const setCurrentEthLoading = useUpdateAtom(currentEthLoadingAtomV2)
  const vault = useAtomValue(crabStrategyVaultAtomV2)
  const ethPrice = useOnChainETHPrice()
  const setStrategyData = useSetStrategyData()
  const getWSqueethPositionValueInETH = useGetWSqueethPositionValueInETH()
  const normFactor = useAtomValue(normFactorAtom)
  const squeethInitialPrice = useAtomValue(squeethInitialPriceAtom)
  const setCrabUsdValue = useSetAtom(crabUSDValueAtom)
  const fetchQueuedData = useQueuedCrabPositionAndStatus()

  useEffect(() => {
    setStrategyData()
  }, [])

  const userShares = useAppMemo(() => {
    return userMigratedShares.plus(userCrabBalance)
  }, [userMigratedShares, userCrabBalance])

  useAppEffect(() => {
    ;(async () => {
      if (balLoading) {
        setIsCrabPositionValueLoading(true)
      }
      fetchQueuedData()
      const [collateral, squeethDebt, collateralOne, squeethDebtOne, collatMigrated, debtMigrated] = await Promise.all([
        getCollateralFromCrabAmount(userShares, contract, vault),
        getWsqueethFromCrabAmount(userShares, contract),
        getCollateralFromCrabAmount(BIG_ONE, contract, vault),
        getWsqueethFromCrabAmount(BIG_ONE, contract),
        getCollateralFromCrabAmount(toTokenAmount(crabQueuedShares, 18), contract, vault),
        getWsqueethFromCrabAmount(toTokenAmount(crabQueuedShares, 18), contract),
      ])

      if (
        !squeethDebt ||
        !collateral ||
        !normFactor ||
        ((collateral.isZero() || squeethDebt.isZero() || squeethInitialPrice.isZero()) && userShares.gt(0))
      ) {
        setCurrentCrabPositionValue(BIG_ZERO)
        setCurrentCrabPositionValueInETH(BIG_ZERO)
        setIsCrabPositionValueLoading(true)
        return
      }

      const ethDebt = getWSqueethPositionValueInETH(squeethDebt)
      if (collateralOne && squeethDebtOne) {
        const ethDebtOne = getWSqueethPositionValueInETH(squeethDebtOne)
        setCrabUsdValue(collateralOne.minus(ethDebtOne).times(ethPrice))
      }

      // Or else vault would have been liquidated
      if (collateral.lt(ethDebt)) return

      const crabPositionValueInETH = collateral.minus(ethDebt)
      const crabPositionValueInUSD = crabPositionValueInETH.times(ethPrice)

      if (debtMigrated && collatMigrated && !collatMigrated?.isZero() && !debtMigrated?.isZero()) {
        const ethDebtOne = getWSqueethPositionValueInETH(debtMigrated)
        setCrabQueuedInEth(collatMigrated.minus(ethDebtOne))
        setCrabQueuedInUsd(collatMigrated.minus(ethDebtOne).times(ethPrice))
      }

      setCurrentCrabPositionValue(crabPositionValueInUSD)
      setCurrentCrabPositionValueInETH(crabPositionValueInETH)
      setUserMigratedSharesETH(
        userShares.isZero() ? BIG_ZERO : crabPositionValueInETH.div(userShares).times(userMigratedShares),
      )
      setCurrentCrabPositionETHActual(
        userShares.isZero() ? BIG_ZERO : crabPositionValueInETH.div(userShares).times(userCrabBalance),
      )

      setIsCrabPositionValueLoading(false)
      setCurrentEthLoading(false)
    })()
  }, [
    userShares,
    contract,
    setCurrentEthLoading,
    setIsCrabPositionValueLoading,
    getWSqueethPositionValueInETH,
    setCurrentCrabPositionValue,
    setCurrentCrabPositionValueInETH,
    setUserMigratedSharesETH,
    ethPrice,
    vault,
    balLoading,
    squeethInitialPrice,
    setCrabUsdValue,
    crabQueuedShares,
  ])

  return { currentCrabPositionValue, currentCrabPositionValueInETH, isCrabPositionValueLoading }
}

export const useCalculateETHtoBorrowFromUniswap = () => {
  const vault = useAtomValue(crabStrategyVaultAtom)
  const getSellQuote = useGetSellQuote()

  const calculateETHtoBorrowFromUniswap = useCallback(
    async (ethDeposit: BigNumber, slippage: number) => {
      const emptyState = {
        amountOut: new BigNumber(0),
        minimumAmountOut: new BigNumber(0),
        priceImpact: '0',
        ethBorrow: new BigNumber(0),
      }
      if (!vault || ethDeposit.eq(0)) return emptyState

      let start = new BigNumber(0.25)
      let end = new BigNumber(3)
      const deviation = new BigNumber(0.0001) // .01 %

      let prevState = emptyState
      while (start.lte(end)) {
        const middle = start.plus(end).div(2)
        const ethBorrow = ethDeposit.times(middle)
        const initialWSqueethDebt = ethBorrow.plus(ethDeposit).times(vault.shortAmount).div(vault.collateralAmount)
        const quote = await getSellQuote(initialWSqueethDebt, new BigNumber(slippage))
        const borrowRatio = quote.minimumAmountOut.div(ethBorrow).minus(1)
        if (prevState.minimumAmountOut.eq(quote.minimumAmountOut)) {
          break
        }
        prevState = { ...quote, ethBorrow }
        if (borrowRatio.gt(0) && borrowRatio.lte(deviation)) {
          break
        } else {
          // If ratio matches check in first half or search in second half
          if (borrowRatio.gt(0)) {
            start = middle
          } else {
            end = middle
          }
        }
      }

      console.log(
        'Eth to borrow: ',
        prevState.ethBorrow.toString(),
        prevState.minimumAmountOut.toString(),
        start.toString(),
        end.toString(),
      )
      return prevState
    },
    [vault?.id, getSellQuote],
  )

  return calculateETHtoBorrowFromUniswap
}

export const useCalculateETHtoBorrowFromUniswapV2 = () => {
  const vault = useAtomValue(crabStrategyVaultAtomV2)
  const getSellQuote = useGetSellQuote()

  const calculateETHtoBorrowFromUniswap = useCallback(
    async (ethDeposit: BigNumber, slippage: number) => {
      const emptyState = {
        amountOut: new BigNumber(0),
        minimumAmountOut: new BigNumber(0),
        priceImpact: '0',
        ethBorrow: new BigNumber(0),
        initialWSqueethDebt: new BigNumber(0),
      }
      if (!vault || ethDeposit.eq(0)) return emptyState

      let start = new BigNumber(0.25)
      let end = new BigNumber(3)
      const deviation = new BigNumber(0.0001) // .01 %

      let prevState = emptyState
      while (start.lte(end)) {
        const middle = start.plus(end).div(2)
        const ethBorrow = ethDeposit.times(middle)
        const initialWSqueethDebt = ethBorrow.plus(ethDeposit).times(vault.shortAmount).div(vault.collateralAmount)
        const quote = await getSellQuote(initialWSqueethDebt, new BigNumber(slippage))
        const borrowRatio = quote.minimumAmountOut.div(ethBorrow).minus(1)
        if (prevState.minimumAmountOut.eq(quote.minimumAmountOut)) {
          break
        }
        prevState = { ...quote, ethBorrow, initialWSqueethDebt }
        if (borrowRatio.gt(0) && borrowRatio.lte(deviation)) {
          break
        } else {
          // If ratio matches check in first half or search in second half
          if (borrowRatio.gt(0)) {
            start = middle
          } else {
            end = middle
          }
        }
      }

      console.log(
        'Eth to borrow: ',
        prevState.ethBorrow.toString(),
        prevState.minimumAmountOut.toString(),
        start.toString(),
        end.toString(),
      )
      return prevState
    },
    [vault?.id, getSellQuote],
  )

  return calculateETHtoBorrowFromUniswap
}

export const useFlashDeposit = (calculateETHtoBorrowFromUniswap: any) => {
  const maxCap = useAtomValue(maxCapAtom)
  const address = useAtomValue(addressAtom)
  const vault = useAtomValue(crabStrategyVaultAtom)
  const contract = useAtomValue(crabStrategyContractAtom)
  const handleTransaction = useHandleTransaction()
  const flashDeposit = useAppCallback(
    async (amount: BigNumber, slippage: number, onTxConfirmed?: () => void) => {
      if (!contract || !vault) return

      let { ethBorrow: _ethBorrow } = await calculateETHtoBorrowFromUniswap(amount, slippage)
      const _allowedEthToBorrow = maxCap.minus(amount.plus(vault.collateralAmount))
      if (_ethBorrow.gt(_allowedEthToBorrow)) {
        _ethBorrow = _allowedEthToBorrow
      }
      const ethBorrow = fromTokenAmount(_ethBorrow, 18)
      const ethDeposit = fromTokenAmount(amount, 18)
      return await handleTransaction(
        contract.methods.flashDeposit(ethBorrow.plus(ethDeposit).toFixed(0)).send({
          from: address,
          value: fromTokenAmount(amount, 18).toFixed(0),
        }),
        onTxConfirmed,
      )
    },
    [address, contract, handleTransaction, vault?.id, maxCap, calculateETHtoBorrowFromUniswap],
  )

  return flashDeposit
}

export const useFlashDepositV2 = (calculateETHtoBorrowFromUniswap: any) => {
  const maxCap = useAtomValue(maxCapAtomV2)
  const address = useAtomValue(addressAtom)
  const vault = useAtomValue(crabStrategyVaultAtomV2)
  const contract = useAtomValue(crabStrategyContractAtomV2)
  const handleTransaction = useHandleTransaction()
  const { track } = useAmplitude()

  const flashDeposit = useAppCallback(
    async (amount: BigNumber, slippage: number, onTxConfirmed?: () => void) => {
      if (!contract || !vault) return

      let { ethBorrow: _ethBorrow } = await calculateETHtoBorrowFromUniswap(amount, slippage)
      // Just to make sure the issue never happens
      if (_ethBorrow.isZero()) {
        Fathom.trackGoal('HOUQK7NR', 0)
        alert('Some error occurred. Refresh the page!')
        throw new Error('Some error occurred. Refresh the page!')
      }
      const _allowedEthToBorrow = maxCap.minus(amount.plus(vault.collateralAmount))
      if (_ethBorrow.gt(_allowedEthToBorrow)) {
        _ethBorrow = _allowedEthToBorrow
      }

      // TODO: fix it so it uses v2 ratio, not v1.
      const ethBorrow = fromTokenAmount(_ethBorrow, 18)
      const ethDeposit = fromTokenAmount(amount, 18)
      const poolFeePercent = 3000
      track(CRAB_EVENTS.DEPOSIT_CRAB_CLICK, { amount: amount.plus(_ethBorrow).toString() })
      try {
        const tx = await handleTransaction(
          contract.methods.flashDeposit(ethBorrow.plus(ethDeposit).toFixed(0), poolFeePercent).send({
            from: address,
            value: fromTokenAmount(amount, 18).toFixed(0),
          }),
          onTxConfirmed,
        )

        track(CRAB_EVENTS.DEPOSIT_CRAB_SUCCESS, { amount: amount.plus(_ethBorrow).toNumber() })
        return tx
      } catch (e: any) {
        e?.code === REVERTED_TRANSACTION_CODE ? track(CRAB_EVENTS.DEPOSIT_CRAB_REVERT) : null
        track(CRAB_EVENTS.DEPOSIT_CRAB_FAILED, { code: e?.code })
        throw e
      }
    },
    [address, contract, handleTransaction, vault?.id, maxCap, calculateETHtoBorrowFromUniswap],
  )

  return flashDeposit
}

export const useFlashDepositUSDC = (calculateETHtoBorrowFromUniswap: any) => {
  const maxCap = useAtomValue(maxCapAtomV2)
  const address = useAtomValue(addressAtom)
  const { usdc, weth } = useAtomValue(addressesAtom)
  const network = useAtomValue(networkIdAtom)
  const vault = useAtomValue(crabStrategyVaultAtomV2)
  const contract = useAtomValue(crabHelperContractAtom)
  const { getExactIn } = useUniswapQuoter()
  const handleTransaction = useHandleTransaction()
  const { track } = useAmplitude()

  const usdcFee = getUSDCPoolFee(network)

  const flashDepositUSDC = useAppCallback(
    async (amount: BigNumber, slippage: number, onTxConfirmed?: () => void) => {
      if (!contract || !vault) return

      const usdcAmount = fromTokenAmount(amount, USDC_DECIMALS)
      const quote = await getExactIn(usdc, weth, usdcAmount, usdcFee, slippage)
      const ethAmount = new BigNumber(quote.minAmountOut)
      let { ethBorrow: _ethBorrow } = await calculateETHtoBorrowFromUniswap(toTokenAmount(ethAmount, 18), slippage)
      // Just to make sure the issue never happens
      if (_ethBorrow.isZero()) {
        Fathom.trackGoal('HOUQK7NR', 0)
        alert('Some error occurred. Refresh the page!')
        throw new Error('Some error occurred. Refresh the page!')
      }
      const _allowedEthToBorrow = maxCap.minus(toTokenAmount(ethAmount, 18).plus(vault.collateralAmount))
      if (_ethBorrow.gt(_allowedEthToBorrow)) {
        _ethBorrow = _allowedEthToBorrow
      }

      // TODO: fix it so it uses v2 ratio, not v1.
      const ethBorrow = fromTokenAmount(_ethBorrow, 18)
      const ethDeposit = ethAmount
      track(CRAB_EVENTS.DEPOSIT_CRAB_USDC_CLICK, { amount: amount.toString() })
      try {
        const tx = await handleTransaction(
          contract.methods
            .flashDepositERC20(
              ethBorrow.plus(ethDeposit).toFixed(0),
              usdcAmount.toFixed(0),
              ethDeposit.toFixed(0),
              usdcFee,
              UNI_POOL_FEES,
              usdc,
            )
            .send({
              from: address,
            }),
          onTxConfirmed,
        )

        track(CRAB_EVENTS.DEPOSIT_CRAB_USDC_SUCCESS, { amount: amount.toNumber() })
        return tx
      } catch (e: any) {
        e?.code === REVERTED_TRANSACTION_CODE ? track(CRAB_EVENTS.DEPOSIT_CRAB_USDC_REVERT) : null
        track(CRAB_EVENTS.DEPOSIT_CRAB_USDC_FAILED, { code: e?.code })
        console.log(e)
      }
    },
    [address, contract, handleTransaction, vault?.id, maxCap, calculateETHtoBorrowFromUniswap],
  )

  return flashDepositUSDC
}

export const useQueueDepositUSDC = () => {
  const contract = useAtomValue(crabNettingContractAtom)
  const handleTransaction = useHandleTransaction()
  const address = useAtomValue(addressAtom)
  const { track } = useAmplitude()

  const depositUSDC = useAppCallback(
    async (amount: BigNumber, onTxConfirmed?: () => void) => {
      if (!contract) return
      track(CRAB_EVENTS.DEPOSIT_STN_CRAB_USDC_CLICK)
      try {
        console.log('Queue:', fromTokenAmount(amount, USDC_DECIMALS).toString())
        await handleTransaction(
          contract.methods.depositUSDC(fromTokenAmount(amount, USDC_DECIMALS).toString()).send({
            from: address,
          }),
          onTxConfirmed,
        )
        track(CRAB_EVENTS.DEPOSIT_STN_CRAB_USDC_SUCCESS, { amount: amount.toNumber() })
      } catch (e: any) {
        e?.code === REVERTED_TRANSACTION_CODE ? track(CRAB_EVENTS.DEPOSIT_STN_CRAB_USDC_REVERT) : null
        track(CRAB_EVENTS.DEPOSIT_STN_CRAB_USDC_FAILED, { code: e?.code })
        console.log(e)
      }
    },
    [contract, address, handleTransaction],
  )

  return depositUSDC
}

export const useQueueWithdrawCrab = () => {
  const contract = useAtomValue(crabNettingContractAtom)
  const handleTransaction = useHandleTransaction()
  const address = useAtomValue(addressAtom)
  const { track } = useAmplitude()

  const queueWithdraw = useAppCallback(
    async (amount: BigNumber, onTxConfirmed?: () => void) => {
      if (!contract) return

      track(CRAB_EVENTS.WITHDRAW_STN_CRAB_USDC_CLICK)
      console.log('Queue: withdraw', fromTokenAmount(amount, WETH_DECIMALS).toString())
      try {
        await handleTransaction(
          contract.methods.queueCrabForWithdrawal(fromTokenAmount(amount, WETH_DECIMALS).toFixed(0)).send({
            from: address,
          }),
          onTxConfirmed,
        )
        track(CRAB_EVENTS.WITHDRAW_STN_CRAB_USDC_SUCCESS, { amount: amount.toNumber() })
      } catch (e: any) {
        e?.code === REVERTED_TRANSACTION_CODE ? track(CRAB_EVENTS.WITHDRAW_STN_CRAB_USDC_REVERT) : null
        track(CRAB_EVENTS.WITHDRAW_STN_CRAB_USDC_FAILED, { code: e?.code })
        console.log(e)
      }
    },
    [contract, address, handleTransaction],
  )

  return queueWithdraw
}

export const useFlashWithdraw = () => {
  const contract = useAtomValue(crabStrategyContractAtom)
  const handleTransaction = useHandleTransaction()
  const address = useAtomValue(addressAtom)
  const calculateEthWillingToPay = useCalculateEthWillingToPay()

  const flashWithdraw = useCallback(
    async (amount: BigNumber, slippage: number, onTxConfirmed?: () => void) => {
      if (!contract) return

      const { maximumAmountIn: _ethWillingToPay } = await calculateEthWillingToPay(amount, slippage)
      const ethWillingToPay = fromTokenAmount(_ethWillingToPay, 18)
      const crabAmount = fromTokenAmount(amount, 18)
      return await handleTransaction(
        contract.methods.flashWithdraw(crabAmount.toFixed(0), ethWillingToPay.toFixed(0)).send({
          from: address,
        }),
        onTxConfirmed,
      )
    },
    [contract, address, handleTransaction, calculateEthWillingToPay],
  )

  return flashWithdraw
}

export const useFlashWithdrawV2 = () => {
  const contract = useAtomValue(crabStrategyContractAtomV2)
  const handleTransaction = useHandleTransaction()
  const address = useAtomValue(addressAtom)
  const calculateEthWillingToPay = useCalculateEthWillingToPayV2()
  const { track } = useAmplitude()

  const flashWithdraw = useCallback(
    async (amount: BigNumber, slippage: number, onTxConfirmed?: () => void) => {
      if (!contract) return

      const { maximumAmountIn: _ethWillingToPay } = await calculateEthWillingToPay(amount, slippage)
      console.log(_ethWillingToPay.toString())
      const ethWillingToPay = fromTokenAmount(_ethWillingToPay, 18)
      const crabAmount = fromTokenAmount(amount, 18)
      const poolFeePercent = 3000
      track(CRAB_EVENTS.WITHDRAW_CRAB_CLICK)
      try {
        const tx = await handleTransaction(
          contract.methods
            .flashWithdraw(crabAmount.toFixed(0), ethWillingToPay.toFixed(0), poolFeePercent.toFixed(0))
            .send({
              from: address,
            }),
          onTxConfirmed,
        )
        track(CRAB_EVENTS.WITHDRAW_CRAB_SUCCESS, { amount: amount.toNumber() })
        return tx
      } catch (e: any) {
        e?.code === REVERTED_TRANSACTION_CODE ? track(CRAB_EVENTS.WITHDRAW_CRAB_REVERT) : null
        track(CRAB_EVENTS.WITHDRAW_CRAB_FAILED, { code: e?.code })
        throw e
      }
    },
    [contract, address, handleTransaction, calculateEthWillingToPay],
  )

  return flashWithdraw
}

export const useFlashWithdrawV2USDC = () => {
  const contract = useAtomValue(crabHelperContractAtom)
  const handleTransaction = useHandleTransaction()
  const address = useAtomValue(addressAtom)
  const calculateEthWillingToPay = useCalculateEthWillingToPayV2()
  const { getExactIn } = useUniswapQuoter()
  const { usdc, weth } = useAtomValue(addressesAtom)
  const network = useAtomValue(networkIdAtom)

  const usdcFee = getUSDCPoolFee(network)

  const flashWithdrawUSDC = useCallback(
    async (amount: BigNumber, slippage: number, onTxConfirmed?: () => void) => {
      if (!contract) return

      const { maximumAmountIn: _ethWillingToPay, ethToGet } = await calculateEthWillingToPay(amount, slippage)
      console.log(_ethWillingToPay.toString())
      const ethWillingToPay = fromTokenAmount(_ethWillingToPay, 18)
      const crabAmount = fromTokenAmount(amount, 18)
      const { minAmountOut } = await getExactIn(weth, usdc, fromTokenAmount(ethToGet, 18), usdcFee, slippage)
      console.log('Min amount out USDC', minAmountOut.toString())
      const poolFeePercent = 3000
      return await handleTransaction(
        contract.methods
          .flashWithdrawERC20(
            crabAmount.toFixed(0),
            ethWillingToPay.toFixed(0),
            usdc,
            minAmountOut,
            usdcFee,
            poolFeePercent,
          )
          .send({
            from: address,
          }),
        onTxConfirmed,
      )
    },
    [contract, address, handleTransaction, calculateEthWillingToPay],
  )

  return flashWithdrawUSDC
}

export const useClaimWithdrawV2 = () => {
  const contract = useAtomValue(crabMigrationContractAtom)
  const handleTransaction = useHandleTransaction()
  const address = useAtomValue(addressAtom)
  const calculateEthWillingToPay = useCalculateEthWillingToPayV2()

  const claimAndWithdraw = useCallback(
    async (amount: BigNumber, slippage: number, onTxConfirmed?: () => void) => {
      if (!contract) return

      const { maximumAmountIn: _ethWillingToPay } = await calculateEthWillingToPay(amount, slippage)
      const ethWillingToPay = fromTokenAmount(_ethWillingToPay, 18)
      const crabAmount = fromTokenAmount(amount, 18)
      const poolFeePercent = 3000
      return await handleTransaction(
        contract.methods
          .claimAndWithdraw(crabAmount.toFixed(0), ethWillingToPay.toFixed(0), poolFeePercent.toFixed(0))
          .send({
            from: address,
          }),
        onTxConfirmed,
      )
    },
    [contract, address, handleTransaction, calculateEthWillingToPay],
  )

  return claimAndWithdraw
}

export const useFlashWithdrawEth = () => {
  const { crabStrategy } = useAtomValue(addressesAtom)
  const currentEthValue = useAtomValue(currentCrabPositionValueInETHAtom)
  const { value: userCrabBalance } = useTokenBalance(crabStrategy, 5, 18)
  const contract = useAtomValue(crabStrategyContractAtom)
  const flashWithdraw = useFlashWithdraw()

  const flashWithdrawEth = useCallback(
    async (ethAmount: BigNumber, slippage: number, onTxConfirmed?: () => void) => {
      if (!contract) return

      const equivalentCrab = ethAmount.div(currentEthValue).times(userCrabBalance)
      console.log(currentEthValue?.toString(), userCrabBalance?.toString(), ethAmount.toString())
      return await flashWithdraw(equivalentCrab, slippage, onTxConfirmed)
    },
    [contract, currentEthValue?.toString(), flashWithdraw, userCrabBalance?.toString()],
  )

  return flashWithdrawEth
}

export const useFlashWithdrawEthV2 = () => {
  const { crabStrategy2 } = useAtomValue(addressesAtom)
  const currentEthValue = useAtomValue(currentCrabPositionETHActualAtomV2)
  const { value: userCrabBalance } = useTokenBalance(crabStrategy2, 5, 18)
  const contract = useAtomValue(crabStrategyContractAtomV2)
  const flashWithdraw = useFlashWithdrawV2()

  const flashWithdrawEth = useCallback(
    async (ethAmount: BigNumber, slippage: number, onTxConfirmed?: () => void) => {
      if (!contract) return

      const equivalentCrab = ethAmount.div(currentEthValue).times(userCrabBalance)
      console.log(currentEthValue?.toString(), userCrabBalance?.toString(), ethAmount.toString())
      return await flashWithdraw(equivalentCrab, slippage, onTxConfirmed)
    },
    [contract, currentEthValue?.toString(), flashWithdraw, userCrabBalance?.toString()],
  )

  return flashWithdrawEth
}

export const useETHtoCrab = () => {
  const { crabStrategy2 } = useAtomValue(addressesAtom)
  const currentEthValue = useAtomValue(currentCrabPositionETHActualAtomV2)
  const { value: userCrabBalance } = useTokenBalance(crabStrategy2, 5, 18)

  const getUserCrabForEthAmount = useAppCallback(
    (ethAmount: BigNumber) => {
      if (currentEthValue.isZero()) {
        return BIG_ZERO
      }
      return ethAmount.div(currentEthValue).times(userCrabBalance)
    },
    [currentEthValue, userCrabBalance],
  )

  return getUserCrabForEthAmount
}

export const useClaimAndWithdrawEthV2 = () => {
  const currentEthValue = useAtomValue(userMigratedSharesETHAtom)
  const userCrabBalance = useAtomValue(userMigratedSharesAtom)
  const contract = useAtomValue(crabMigrationContractAtom)
  const claimAndWithdraw = useClaimWithdrawV2()

  const claimAndWithdrawEth = useCallback(
    async (ethAmount: BigNumber, slippage: number, onTxConfirmed?: () => void) => {
      if (!contract) return

      const equivalentCrab = ethAmount.div(currentEthValue).times(userCrabBalance)
      return await claimAndWithdraw(equivalentCrab, slippage, onTxConfirmed)
    },
    [contract, currentEthValue?.toString(), claimAndWithdraw, userCrabBalance?.toString()],
  )

  return claimAndWithdrawEth
}

export const useSetStrategyCap = () => {
  const contract = useAtomValue(crabStrategyContractAtom)
  const address = useAtomValue(addressAtom)
  const setStrategyCap = useCallback(
    async (amount: BigNumber) => {
      if (!contract) return

      const crabAmount = fromTokenAmount(amount, 18)
      return contract.methods.setStrategyCap(crabAmount.toFixed(0)).send({
        from: address,
      })
    },
    [contract, address],
  )

  return setStrategyCap
}

export const useSetProfitableMovePercent = () => {
  const [profitableMovePercent, setProfitableMovePercent] = useAtom(profitableMovePercentAtom)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)
  const contract = useAtomValue(crabStrategyContractAtom)

  useEffect(() => {
    if (!contract) return
    setProfitableMovePercent(getCurrentProfitableMovePercent(currentImpliedFunding))
  }, [contract, currentImpliedFunding])

  return profitableMovePercent
}

export const useSetProfitableMovePercentV2 = () => {
  const [profitableMovePercentV2, setProfitableMovePercentV2] = useAtom(profitableMovePercentAtomV2)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)
  const currentImpliedVol = useAtomValue(impliedVolAtom)
  const contract = useAtomValue(crabStrategyContractAtom)

  useEffect(() => {
    if (!contract) return
    setProfitableMovePercentV2(getCurrentProfitableMovePercentV2(currentImpliedVol))
  }, [contract, currentImpliedVol])

  return profitableMovePercentV2
}

export const useQueuedCrabPositionAndStatus = () => {
  const contract = useAtomValue(crabNettingContractAtom)
  const address = useAtomValue(addressAtom)
  const setUsdcQueued = useSetAtom(usdcQueuedAtom)
  const setCrabQueued = useSetAtom(crabQueuedAtom)
  const setNettingAuctionLive = useSetAtom(isNettingAuctionLiveAtom)
  const setMinUSDCAmount = useSetAtom(minUSDCAmountAtom)
  const setMinCrabAmount = useSetAtom(minCrabAmountAtom)

  const fetchAndStoreQueuedPosition = async () => {
    if (!contract || !address) return

    const usdcPromise = contract.methods.usdBalance(address).call()
    const crabPromise = contract.methods.crabBalance(address).call()
    const auctionStatusPromise = contract.methods.isAuctionLive().call()
    const minUSDCAmountPromise = contract.methods.minUSDCAmount().call()
    const minCrabAmountPromise = contract.methods.minCrabAmount().call()

    const [usdcQueued, crabQueued, auctionStatus, minUSDCAmount, minCrabAmount] = await Promise.all([
      usdcPromise,
      crabPromise,
      auctionStatusPromise,
      minUSDCAmountPromise,
      minCrabAmountPromise,
    ])
    setUsdcQueued(new BigNumber(usdcQueued))
    setCrabQueued(new BigNumber(crabQueued))
    setNettingAuctionLive(auctionStatus)
    setMinUSDCAmount(new BigNumber(minUSDCAmount))
    setMinCrabAmount(new BigNumber(minCrabAmount))
  }

  return fetchAndStoreQueuedPosition
}

export const useDeQueueDepositUSDC = () => {
  const contract = useAtomValue(crabNettingContractAtom)
  const handleTransaction = useHandleTransaction()
  const address = useAtomValue(addressAtom)

  const deQueueUSDC = useAppCallback(
    async (amount: BigNumber, onTxConfirmed?: () => void) => {
      if (!contract) return

      return await handleTransaction(
        contract.methods.withdrawUSDC(amount.toString(), false).send({
          from: address,
        }),
        onTxConfirmed,
      )
    },
    [contract, address, handleTransaction],
  )

  return deQueueUSDC
}

export const useDeQueueWithdrawCrab = () => {
  const contract = useAtomValue(crabNettingContractAtom)
  const handleTransaction = useHandleTransaction()
  const address = useAtomValue(addressAtom)

  const queueWithdraw = useAppCallback(
    async (amount: BigNumber, onTxConfirmed?: () => void) => {
      if (!contract) return

      return await handleTransaction(
        contract.methods.dequeueCrab(amount.toFixed(0), false).send({
          from: address,
        }),
        onTxConfirmed,
      )
    },
    [contract, address, handleTransaction],
  )

  return queueWithdraw
}
