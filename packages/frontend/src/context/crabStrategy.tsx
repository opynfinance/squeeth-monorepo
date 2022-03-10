import { Vault } from '../types'
import BigNumber from 'bignumber.js'
import React, { useContext, useEffect, useState } from 'react'
import { BIG_ZERO } from '../constants'
// import { useWallet } from './wallet'

import { Contract } from 'web3-eth-contract'
import abi from '../abis/crabStrategy.json'
import { fromTokenAmount, toTokenAmount } from '@utils/calculations'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import db from '@utils/firestore'
import { useAtomValue } from 'jotai'
import { addressAtom, networkIdAtom, web3Atom } from 'src/state/wallet/atoms'
import { useHandleTransaction } from 'src/state/wallet/hooks'
import { addressesAtom } from 'src/state/positions/atoms'
import { readyAtom } from 'src/state/squeethPool/atoms'
import { useGetBuyQuote, useGetSellQuote } from 'src/state/squeethPool/hooks'
import { useGetCollatRatioAndLiqPrice, useGetVault, useIndex } from 'src/state/controller/hooks'
import { currentImpliedFundingAtom } from 'src/state/controller/atoms'

type CrabStrategyType = {
  loading: boolean
  maxCap: BigNumber
  vault: Vault | null
  collatRatio: number
  liquidationPrice: BigNumber
  timeAtLastHedge: number
  userCrabBalance: BigNumber
  vaultId: number
  currentEthValue: BigNumber
  profitableMovePercent: number
  slippage: number
  ethIndexPrice: BigNumber
  isTimeHedgeAvailable: boolean
  isPriceHedgeAvailable: boolean
  getCollateralFromCrabAmount: (crabAmount: BigNumber) => Promise<BigNumber | null>
  flashDeposit: (amount: BigNumber, slippage: number) => Promise<any>
  flashWithdraw: (amount: BigNumber, slippage: number) => Promise<any>
  setStrategyCap: (amount: BigNumber) => Promise<any>
  calculateEthWillingToPay: (
    amount: BigNumber,
    slippage: number,
  ) => Promise<{
    amountIn: BigNumber
    maximumAmountIn: BigNumber
    priceImpact: string
  }>
  calculateETHtoBorrowFromUniswap: (
    amount: BigNumber,
    slippage: number,
  ) => Promise<{
    amountOut: BigNumber
    minimumAmountOut: BigNumber
    priceImpact: string
    ethBorrow: BigNumber
  }>
  flashWithdrawEth: (amount: BigNumber, slippage: number) => Promise<any>
  setSlippage: (slippage: number) => void
}

const initialState: CrabStrategyType = {
  maxCap: BIG_ZERO,
  vault: null,
  loading: true,
  collatRatio: 0,
  liquidationPrice: BIG_ZERO,
  timeAtLastHedge: 0,
  userCrabBalance: BIG_ZERO,
  vaultId: 0,
  currentEthValue: BIG_ZERO,
  profitableMovePercent: 0,
  slippage: 0.5,
  ethIndexPrice: BIG_ZERO,
  isTimeHedgeAvailable: false,
  isPriceHedgeAvailable: false,
  getCollateralFromCrabAmount: async () => BIG_ZERO,
  flashDeposit: async () => null,
  flashWithdraw: async () => null,
  setStrategyCap: async () => null,
  calculateEthWillingToPay: async () => ({
    amountIn: new BigNumber(0),
    maximumAmountIn: new BigNumber(0),
    priceImpact: '0',
  }),
  calculateETHtoBorrowFromUniswap: async () => ({
    amountOut: new BigNumber(0),
    minimumAmountOut: new BigNumber(0),
    priceImpact: '0',
    ethBorrow: new BigNumber(0),
  }),
  flashWithdrawEth: async () => null,
  setSlippage: () => null,
}

const crabContext = React.createContext<CrabStrategyType>(initialState)
const useCrab = () => useContext(crabContext)

const CrabProvider: React.FC = ({ children }) => {
  // const { web3, address, handleTransaction, networkId } = useWallet()
  const web3 = useAtomValue(web3Atom)
  const networkId = useAtomValue(networkIdAtom)
  const address = useAtomValue(addressAtom)
  const ready = useAtomValue(readyAtom)
  const handleTransaction = useHandleTransaction()
  // const { crabStrategy } = useAddresses()
  const { crabStrategy } = useAtomValue(addressesAtom)
  const getVault = useGetVault()
  const getBuyQuote = useGetBuyQuote()
  const getSellQuote = useGetSellQuote()
  const index = useIndex()
  const getCollatRatioAndLiqPrice = useGetCollatRatioAndLiqPrice()
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)

  const [contract, setContract] = useState<Contract>()
  const [maxCap, setMaxCap] = useState<BigNumber>(new BigNumber(0))
  const [vault, setVault] = useState<Vault | null>(null)
  const [collatRatio, setCollatRatio] = useState(0)
  const [liquidationPrice, setLiquidationPrice] = useState(new BigNumber(0))
  const [timeAtLastHedge, setTimeAtLastHedge] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentEthValue, setCurrentEthValue] = useState(new BigNumber(0))
  const userCrabBalance = useTokenBalance(crabStrategy, 5, 18)
  const [profitableMovePercent, setProfitableMovePercent] = useState(0)
  const [slippage, setSlippage] = useState(0.5)
  const [isTimeHedgeAvailable, setIsTimeHedgeAvailable] = useState(false)
  const [isPriceHedgeAvailable, setIsPriceHedgeAvailable] = useState(false)

  useEffect(() => {
    if (!web3 || !crabStrategy) return
    setContract(new web3.eth.Contract(abi as any, crabStrategy))
  }, [crabStrategy, web3])

  useEffect(() => {
    if (!contract || !ready) return

    setStrategyData()
  }, [contract, networkId, address, ready])

  useEffect(() => {
    if (!contract) return
    setProfitableMovePercent(getCurrentProfitableMovePercent)
  }, [contract, currentImpliedFunding])

  const getCurrentProfitableMovePercent = () => {
    return Math.sqrt(currentImpliedFunding)
  }

  const setStrategyData = async () => {
    if (!contract) return

    getMaxCap().then(setMaxCap)
    getStrategyVaultId()
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
    getTimeAtLastHedge().then(setTimeAtLastHedge)
    checkTimeHedge().then((h) => setIsTimeHedgeAvailable(h[0]))
    if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      // Check price hedge only if firebase is available
      const doc = await db.doc('squeeth-monitoring/crab').get()
      checkPriceHedge(doc?.data()?.lastAuctionTrigger || 0).then(setIsPriceHedgeAvailable)
    }
  }

  useEffect(() => {
    if (!contract || !ready) return

    calculateCurrentValue()
  }, [userCrabBalance.toString(), ready, contract, vault, slippage])

  const calculateCurrentValue = async () => {
    const collat = await getCollateralFromCrabAmount(userCrabBalance)
    const { amountIn: ethToPay } = await calculateEthWillingToPay(userCrabBalance, slippage)
    if (collat) {
      setCurrentEthValue(collat.minus(ethToPay))
    }
  }

  const getMaxCap = async () => {
    if (!contract) return new BigNumber(0)

    const cap = await contract.methods.strategyCap().call()
    return toTokenAmount(cap, 18)
  }

  const checkTimeHedge = async () => {
    if (!contract) return null

    const result = await contract.methods.checkTimeHedge().call()
    return result
  }

  const getTimeAtLastHedge = async () => {
    if (!contract) return null

    const result = await contract.methods.timeAtLastHedge().call()
    return result
  }

  const checkPriceHedge = async (auctionTriggerTime: number) => {
    if (!contract) return null

    const result = await contract.methods.checkPriceHedge(auctionTriggerTime).call()
    return result
  }

  const getWsqueethFromCrabAmount = async (crabAmount: BigNumber) => {
    if (!contract) return null

    const result = await contract.methods.getWsqueethFromCrabAmount(fromTokenAmount(crabAmount, 18).toFixed(0)).call()
    return toTokenAmount(result.toString(), 18)
  }

  const getCollateralFromCrabAmount = async (crabAmount: BigNumber) => {
    if (!contract || !vault) return null

    const totalSupply = toTokenAmount(await contract.methods.totalSupply().call(), 18)
    return vault.collateralAmount.times(crabAmount).div(totalSupply)
  }

  const getStrategyVaultId = async () => {
    if (!contract) return 0

    const _vaultId = await contract.methods.getStrategyVaultId().call()
    return Number(_vaultId.toString())
  }

  const calculateETHtoBorrowFromUniswap = async (ethDeposit: BigNumber, slippage: number) => {
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
  }

  const flashDeposit = async (amount: BigNumber, slippage: number) => {
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
  }

  const calculateEthWillingToPay = async (amount: BigNumber, slippage: number) => {
    const emptyState = {
      amountIn: new BigNumber(0),
      maximumAmountIn: new BigNumber(0),
      priceImpact: '0',
    }
    if (!vault) return emptyState

    const squeethDebt = await getWsqueethFromCrabAmount(amount)
    if (!squeethDebt) return emptyState

    const ethWillingToPayQuote = await getBuyQuote(squeethDebt, new BigNumber(slippage))
    return ethWillingToPayQuote
  }

  const flashWithdraw = async (amount: BigNumber, slippage: number) => {
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
  }

  const flashWithdrawEth = async (ethAmount: BigNumber, slippage: number) => {
    if (!contract) return

    const equivalentCrab = ethAmount.div(currentEthValue).times(userCrabBalance)
    return flashWithdraw(equivalentCrab, slippage)
  }

  const setStrategyCap = async (amount: BigNumber) => {
    if (!contract) return

    const crabAmount = fromTokenAmount(amount, 18)
    return contract.methods.setStrategyCap(crabAmount.toFixed(0)).send({
      from: address,
    })
  }

  const store: CrabStrategyType = {
    maxCap,
    vault,
    loading: loading || !ready,
    collatRatio,
    liquidationPrice,
    timeAtLastHedge,
    userCrabBalance,
    vaultId: vault?.id || 0,
    currentEthValue,
    slippage,
    ethIndexPrice: toTokenAmount(index, 18).sqrt(),
    flashDeposit,
    flashWithdraw,
    setStrategyCap,
    getCollateralFromCrabAmount,
    calculateEthWillingToPay,
    calculateETHtoBorrowFromUniswap,
    flashWithdrawEth,
    setSlippage,
    profitableMovePercent,
    isTimeHedgeAvailable,
    isPriceHedgeAvailable,
  }
  return <crabContext.Provider value={store}>{children}</crabContext.Provider>
}

export { CrabProvider, useCrab }
