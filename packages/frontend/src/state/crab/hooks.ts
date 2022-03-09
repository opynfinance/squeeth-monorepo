import { useAtom, useAtomValue } from 'jotai'
import { useUpdateAtom } from 'jotai/utils'
import { useCallback, useEffect } from 'react'

import useContract from '@hooks/useContract'
import {
  maxCapAtom,
  crabStrategyVaultAtom,
  crabStrategyCollatRatioAtom,
  crabStrategyLiquidationPriceAtom,
  timeAtLastHedgeAtom,
  crabLoadingAtom,
  currentEthValueAtom,
  profitableMovePercentAtom,
  crabStrategySlippageAtom,
  isTimeHedgeAvailableAtom,
  isPriceHedgeAvailableAtom,
} from './atoms'
import abi from '../../abis/crabStrategy.json'
import { addressesAtom } from '../positions/atoms'
import {
  getMaxCap,
  getStrategyVaultId,
  getTimeAtLastHedge,
  checkTimeHedge,
  checkPriceHedge,
  getCollateralFromCrabAmount,
  getWsqueethFromCrabAmount,
  getCurrentProfitableMovePercent,
} from './utils'
import { useCurrentImpliedFunding, useGetCollatRatioAndLiqPrice, useGetVault } from '../controller/hooks'
import db from '@utils/firestore'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import BigNumber from 'bignumber.js'
import { useGetBuyQuote, useGetSellQuote } from '../squeethPool/hooks'
import { fromTokenAmount } from '@utils/calculations'
import { useHandleTransaction } from '../wallet/hooks'
import { addressAtom } from '../wallet/atoms'
// checkTimeHedge - contract: Contract | null
// checkPriceHedge - auctionTriggerTime: number, contract: Contract | null
// getCollateralFromCrabAmount - crabAmount: BigNumber,
// ===contract: Contract | null,
// ===vault: Vault | null,
// getCurrentProfitableMovePercent - currentImpliedFunding
// getMaxCap-contract -  Contract | null
// getStrategyVaultId - contract: Contract | null
// getTimeAtLastHedge - contract: Contract | null
// getWsqueethFromCrabAmount - crabAmount: BigNumber, contract: Contract | null
// setStrategyCap - amount: BigNumber, contract: Contract | null, address: string | null

export const useSetStrategyData = () => {
  const { crabStrategy } = useAtomValue(addressesAtom)
  const setMaxCap = useUpdateAtom(maxCapAtom)
  const setVault = useUpdateAtom(crabStrategyVaultAtom)
  const setCollatRatio = useUpdateAtom(crabStrategyCollatRatioAtom)
  const setLiquidationPrice = useUpdateAtom(crabStrategyLiquidationPriceAtom)
  const setLoading = useUpdateAtom(crabLoadingAtom)
  const setIsPriceHedgeAvailable = useUpdateAtom(isPriceHedgeAvailableAtom)
  const setIsTimeHedgeAvailable = useUpdateAtom(isTimeHedgeAvailableAtom)
  const setTimeAtLastHedge = useUpdateAtom(timeAtLastHedgeAtom)
  const contract = useContract(crabStrategy, abi)
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
  // useEffect(() => {
  //   setStrategyData()
  // }, [setStrategyData])

  return setStrategyData
}

export const useCalculateEthWillingToPay = () => {
  const { crabStrategy } = useAtomValue(addressesAtom)
  const vault = useAtomValue(crabStrategyVaultAtom)
  const contract = useContract(crabStrategy, abi)
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
      if (!squeethDebt) return emptyState

      const ethWillingToPayQuote = await getBuyQuote(squeethDebt, new BigNumber(slippage))
      return ethWillingToPayQuote
    },
    [contract, getBuyQuote, vault?.id],
  )

  return calculateEthWillingToPay
}

export const useCalculateCurrentValue = () => {
  const { crabStrategy } = useAtomValue(addressesAtom)
  const vault = useAtomValue(crabStrategyVaultAtom)
  const slippage = useAtomValue(crabStrategySlippageAtom)
  const setCurrentEthValue = useUpdateAtom(currentEthValueAtom)
  const userCrabBalance = useTokenBalance(crabStrategy, 5, 18)
  const contract = useContract(crabStrategy, abi)
  const calculateEthWillingToPay = useCalculateEthWillingToPay()

  const calculateCurrentValue = useCallback(async () => {
    const collat = await getCollateralFromCrabAmount(userCrabBalance, contract, vault)
    const { amountIn: ethToPay } = await calculateEthWillingToPay(userCrabBalance, slippage)
    if (collat) {
      setCurrentEthValue(collat.minus(ethToPay))
    }
  }, [calculateEthWillingToPay, contract, slippage, userCrabBalance?.toString(), vault?.id])

  // useEffect(() => {
  //   calculateCurrentValue()
  // }, [calculateCurrentValue])

  return calculateCurrentValue
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

export const useFlashDeposit = (setStrategyData: any, calculateETHtoBorrowFromUniswap: any) => {
  const maxCap = useAtomValue(maxCapAtom)
  const address = useAtomValue(addressAtom)
  const vault = useAtomValue(crabStrategyVaultAtom)
  const { crabStrategy } = useAtomValue(addressesAtom)
  const contract = useContract(crabStrategy, abi)
  const handleTransaction = useHandleTransaction()
  // const calculateETHtoBorrowFromUniswap = useCalculateETHtoBorrowFromUniswap()
  const calculateCurrentValue = useCalculateCurrentValue()
  const flashDeposit = useCallback(
    async (amount: BigNumber, slippage: number) => {
      if (!contract || !vault) return

      let { ethBorrow: _ethBorrow } = await calculateETHtoBorrowFromUniswap(amount, slippage)
      const _allowedEthToBorrow = maxCap.minus(amount.plus(vault.collateralAmount))
      if (_ethBorrow.gt(_allowedEthToBorrow)) {
        _ethBorrow = _allowedEthToBorrow
      }
      const ethBorrow = fromTokenAmount(_ethBorrow, 18)
      const ethDeposit = fromTokenAmount(amount, 18)
      return handleTransaction(
        contract.methods.flashDeposit(ethBorrow.plus(ethDeposit).toFixed(0)).send({
          from: address,
          value: fromTokenAmount(amount, 18).toFixed(0),
        }),
      ).then((tx: any) => {
        setStrategyData()
        calculateCurrentValue()
        return tx
      })
    },
    [address, contract, handleTransaction, vault?.id, maxCap.toString()],
  )

  return flashDeposit
}

export const useFlashWithdraw = (setStrategyData: any) => {
  const { crabStrategy } = useAtomValue(addressesAtom)
  const contract = useContract(crabStrategy, abi)
  const handleTransaction = useHandleTransaction()
  const address = useAtomValue(addressAtom)
  const calculateEthWillingToPay = useCalculateEthWillingToPay()
  const calculateCurrentValue = useCalculateCurrentValue()

  const flashWithdraw = useCallback(
    async (amount: BigNumber, slippage: number) => {
      if (!contract) return

      const { maximumAmountIn: _ethWillingToPay } = await calculateEthWillingToPay(amount, slippage)
      const ethWillingToPay = fromTokenAmount(_ethWillingToPay, 18)
      const crabAmount = fromTokenAmount(amount, 18)
      return handleTransaction(
        contract.methods.flashWithdraw(crabAmount.toFixed(0), ethWillingToPay.toFixed(0)).send({
          from: address,
        }),
      ).then((tx: any) => {
        setStrategyData()
        calculateCurrentValue()
        return tx
      })
    },
    [contract, address, handleTransaction, calculateCurrentValue, calculateEthWillingToPay],
  )

  return flashWithdraw
}

export const useFlashWithdrawEth = (setStrategyData: any) => {
  const { crabStrategy } = useAtomValue(addressesAtom)
  const currentEthValue = useAtomValue(currentEthValueAtom)
  const userCrabBalance = useTokenBalance(crabStrategy, 5, 18)
  const contract = useContract(crabStrategy, abi)
  const flashWithdraw = useFlashWithdraw(setStrategyData)

  const flashWithdrawEth = useCallback(
    async (ethAmount: BigNumber, slippage: number) => {
      if (!contract) return

      const equivalentCrab = ethAmount.div(currentEthValue).times(userCrabBalance)
      return flashWithdraw(equivalentCrab, slippage)
    },
    [contract, currentEthValue?.toString(), flashWithdraw, userCrabBalance?.toString()],
  )

  return flashWithdrawEth
}

export const useSetStrategyCap = () => {
  const { crabStrategy } = useAtomValue(addressesAtom)
  const contract = useContract(crabStrategy, abi)
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
  const { crabStrategy } = useAtomValue(addressesAtom)
  const [profitableMovePercent, setProfitableMovePercent] = useAtom(profitableMovePercentAtom)
  const currentImpliedFunding = useCurrentImpliedFunding()
  const contract = useContract(crabStrategy, abi)

  useEffect(() => {
    if (!contract) return
    setProfitableMovePercent(getCurrentProfitableMovePercent(currentImpliedFunding))
  }, [contract, currentImpliedFunding])

  return profitableMovePercent
}
