import { useAtom, useAtomValue } from 'jotai'
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
  crabStrategySlippageAtom,
  isTimeHedgeAvailableAtom,
  isPriceHedgeAvailableAtom,
  currentEthLoadingAtom,
  currentCrabPositionValueAtom,
  currentCrabPositionValueInETHAtom,
  crabPositionValueLoadingAtom,
  crabLoadingAtom,
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
} from './utils'
import { useGetCollatRatioAndLiqPrice, useGetVault } from '../controller/hooks'
import db from '@utils/firestore'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import BigNumber from 'bignumber.js'
import { useGetBuyQuote, useGetSellQuote, useGetWSqueethPositionValueInETH } from '../squeethPool/hooks'
import { fromTokenAmount } from '@utils/calculations'
import { useHandleTransaction } from '../wallet/hooks'
import { addressAtom } from '../wallet/atoms'
import { currentImpliedFundingAtom } from '../controller/atoms'
import { crabStrategyContractAtom,  crabStrategyContractAtomV2 } from '../contracts/atoms'
import useAppCallback from '@hooks/useAppCallback'
import { BIG_ZERO } from '@constants/index'
import useAppEffect from '@hooks/useAppEffect'
import floatifyBigNums from '@utils/floatifyBigNums'
import { useETHPrice } from '@hooks/useETHPrice'
import { userMigratedSharesAtom } from '../crabMigration/atom'
import useAppMemo from '@hooks/useAppMemo'

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
      checkPriceHedgeV2(contract).then(setIsPriceHedgeAvailable)
    }
  }, [contract, getCollatRatioAndLiqPrice, getVault])

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

export const useCurrentCrabPositionValue = () => {
  const { crabStrategy } = useAtomValue(addressesAtom)

  const [isCrabPositionValueLoading, setIsCrabPositionValueLoading] = useAtom(crabPositionValueLoadingAtom)
  const [currentCrabPositionValue, setCurrentCrabPositionValue] = useAtom(currentCrabPositionValueAtom)
  const [currentCrabPositionValueInETH, setCurrentCrabPositionValueInETH] = useAtom(currentCrabPositionValueInETHAtom)
  const { value: userCrabBalance } = useTokenBalance(crabStrategy, 15, 18)
  const userMigratedShares = useAtomValue(userMigratedSharesAtom)
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
    return userMigratedShares.gt(0) ? userMigratedShares : userCrabBalance;
  }, [userMigratedShares, userCrabBalance])

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
  const { value: userCrabBalance } = useTokenBalance(crabStrategy2, 15, 18)
  const userMigratedShares = useAtomValue(userMigratedSharesAtom)
  const contract = useAtomValue(crabStrategyContractAtomV2)
  const setCurrentEthLoading = useUpdateAtom(currentEthLoadingAtomV2)
  const vault = useAtomValue(crabStrategyVaultAtomV2)
  const ethPrice = useETHPrice()
  const setStrategyData = useSetStrategyData()
  const getWSqueethPositionValueInETH = useGetWSqueethPositionValueInETH()

  useEffect(() => {
    setStrategyData()
  }, [])

  const userShares = useAppMemo(() => {
    return userMigratedShares.gt(0) ? userMigratedShares : userCrabBalance;
  }, [userMigratedShares, userCrabBalance])

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

      console.log('Eth to borrow: ', prevState.ethBorrow.toString(), prevState.minimumAmountOut.toString())
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

      console.log('Eth to borrow: ', prevState.ethBorrow.toString(), prevState.minimumAmountOut.toString())
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
  const flashDeposit = useAppCallback(
    async (amount: BigNumber, slippage: number, onTxConfirmed?: () => void) => {
      if (!contract || !vault) return

      let { ethBorrow: _ethBorrow } = await calculateETHtoBorrowFromUniswap(amount, slippage)
      const _allowedEthToBorrow = maxCap.minus(amount.plus(vault.collateralAmount))
      if (_ethBorrow.gt(_allowedEthToBorrow)) {
        _ethBorrow = _allowedEthToBorrow
      }

      // TODO: fix it so it uses v2 ratio, not v1.
      const ethBorrow = fromTokenAmount(_ethBorrow, 18)
      const ethDeposit = fromTokenAmount(amount, 18)
      const poolFeePercent = 3000;
      return await handleTransaction(
        contract.methods.flashDeposit(ethBorrow.plus(ethDeposit).toFixed(0), poolFeePercent).send({
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

export const useFlashWithdraw = () => {
  const contract = useAtomValue(crabStrategyContractAtom)
  const handleTransaction = useHandleTransaction()
  const address = useAtomValue(addressAtom)
  const calculateEthWillingToPay = useCalculateEthWillingToPay()

  const flashWithdraw = useCallback(
    async (amount: BigNumber, slippage: number, onTxConfirmed?: () => void) => {
      if (!contract) return

      const { maximumAmountIn: _ethWillingToPay } = await calculateEthWillingToPay(amount, slippage)
      console.log(_ethWillingToPay.toString())
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

  const flashWithdraw = useCallback(
    async (amount: BigNumber, slippage: number, onTxConfirmed?: () => void) => {
      if (!contract) return

      const { maximumAmountIn: _ethWillingToPay } = await calculateEthWillingToPay(amount, slippage)
      console.log(_ethWillingToPay.toString())
      const ethWillingToPay = fromTokenAmount(_ethWillingToPay, 18)
      const crabAmount = fromTokenAmount(amount, 18)
      const poolFeePercent = 3000
      return await handleTransaction(
        contract.methods.flashWithdraw(crabAmount.toFixed(0), ethWillingToPay.toFixed(0), poolFeePercent.toFixed(0)).send({
          from: address,
        }),
        onTxConfirmed,
      )
    },
    [contract, address, handleTransaction, calculateEthWillingToPay],
  )

  return flashWithdraw
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
  const currentEthValue = useAtomValue(currentCrabPositionValueInETHAtomV2)
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
