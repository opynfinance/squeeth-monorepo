import { Vault } from '../types'
import BigNumber from 'bignumber.js'
import React, { useContext, useEffect, useState } from 'react'
import { BIG_ZERO } from '../constants'
import { useWallet } from './wallet'
import { useAddresses } from '@hooks/useAddress'
import { useSqueethPool } from '@hooks/contracts/useSqueethPool'
import { useController } from '@hooks/contracts/useController'
import { Contract } from 'web3-eth-contract'
import abi from '../abis/crabStrategy.json'
import { fromTokenAmount, toTokenAmount } from '@utils/calculations'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'

type CrabStrategyType = {
  loading: boolean
  maxCap: BigNumber
  vault: Vault | null
  collatRatio: number
  liquidationPrice: BigNumber
  timeAtLastHedge: number
  userCrabBalance: BigNumber
  vaultId: number
  getCollateralFromCrabAmount: (crabAmount: BigNumber) => Promise<BigNumber | null>
  flashDeposit: (amount: BigNumber, slippage: number) => Promise<any>
  flashWithdraw: (amount: BigNumber, slippage: number) => Promise<any>
  setStrategyCap: (amount: BigNumber) => Promise<any>
  calculateEthWillingToPay: (amount: BigNumber, slippage: number) => Promise<BigNumber>
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
  getCollateralFromCrabAmount: async () => BIG_ZERO,
  flashDeposit: async () => null,
  flashWithdraw: async () => null,
  setStrategyCap: async () => null,
  calculateEthWillingToPay: async () => BIG_ZERO,
}

const crabContext = React.createContext<CrabStrategyType>(initialState)
const useCrab = () => useContext(crabContext)

const CrabProvider: React.FC = ({ children }) => {
  const { web3, address, handleTransaction, networkId } = useWallet()
  const { crabStrategy } = useAddresses()
  const { getVault, getCollatRatioAndLiqPrice } = useController()
  const { getSellQuote, getBuyQuote, ready } = useSqueethPool()

  const [contract, setContract] = useState<Contract>()
  const [maxCap, setMaxCap] = useState<BigNumber>(new BigNumber(0))
  const [vault, setVault] = useState<Vault | null>(null)
  const [collatRatio, setCollatRatio] = useState(0)
  const [liquidationPrice, setLiquidationPrice] = useState(new BigNumber(0))
  const [timeAtLastHedge, setTimeAtLastHedge] = useState(0)
  const [loading, setLoading] = useState(true)
  const userCrabBalance = useTokenBalance(crabStrategy, 15, 18)

  useEffect(() => {
    if (!web3 || !crabStrategy) return
    setContract(new web3.eth.Contract(abi as any, crabStrategy))
  }, [crabStrategy, web3])

  useEffect(() => {
    if (!contract || !ready) return

    setStrategyData()
  }, [contract, networkId, address, ready])

  const setStrategyData = async () => {
    if (!contract) return

    getMaxCap().then(setMaxCap)
    getStrategyVaultId()
      .then(getVault)
      .then((v) => {
        setVault(v)
        if (v) {
          getCollatRatioAndLiqPrice(v.collateralAmount, v.shortAmount).then((cl) => {
            setCollatRatio(cl.collateralPercent)
            setLiquidationPrice(cl.liquidationPrice)
            setLoading(false)
          })
        }
      })
    getTimeAtLastHedge().then(setTimeAtLastHedge)
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
    console.log('get collat', vault.collateralAmount.toString(), crabAmount.toString(), totalSupply.toString())
    return vault.collateralAmount.times(crabAmount).div(totalSupply)
  }

  const getStrategyVaultId = async () => {
    if (!contract) return 0

    const _vaultId = await contract.methods.getStrategyVaultId().call()
    return Number(_vaultId.toString())
  }

  // Don't use directly
  const deposit = async (amount: BigNumber) => {
    if (!contract) return

    const _ethAmt = fromTokenAmount(amount, 18)
    return handleTransaction(
      contract.methods.deposit().send({
        from: address,
        value: _ethAmt.toString(),
      }),
    )
  }

  const calculateETHtoBorrow = async (amount: BigNumber, slippage: number) => {
    // ethDeposit + ethBorrow = wSqueethDebt * wSqueethPrice * 2
    if (!vault) return new BigNumber(0)
    const ethDeposit = amount

    // Float is not handled well in JS so using BigNumber
    for (let multiplier = new BigNumber(1); multiplier.isGreaterThan(0); multiplier = multiplier.minus(0.01)) {
      const ethBorrow = ethDeposit.times(multiplier)
      const initialWSqueethDebt = ethBorrow.plus(ethDeposit).times(vault.shortAmount).div(vault.collateralAmount)
      const returnedETH = await getSellQuote(initialWSqueethDebt, new BigNumber(slippage))
      if (ethBorrow.lt(returnedETH.minimumAmountOut)) {
        return ethBorrow
      }
    }

    return new BigNumber(0)
  }

  const flashDeposit = async (amount: BigNumber, slippage: number) => {
    if (!contract) return

    const ethBorrow = fromTokenAmount(await calculateETHtoBorrow(amount, slippage), 18)
    const ethDeposit = fromTokenAmount(amount, 18)
    return contract.methods.flashDeposit(ethBorrow.plus(ethDeposit).toFixed(0)).send({
      from: address,
      value: fromTokenAmount(amount, 18).toFixed(0),
    })
  }

  const calculateEthWillingToPay = async (amount: BigNumber, slippage: number) => {
    console.log('ETH willing to pay: before vault')
    if (!vault) return new BigNumber(0)
    console.log('ETH willing to pay: after vault')

    const squeethDebt = await getWsqueethFromCrabAmount(amount)
    if (!squeethDebt) return new BigNumber(0)

    console.log('ETH willing to pay: here')
    const ethWillingtToPayQuote = await getBuyQuote(squeethDebt, new BigNumber(slippage))
    return ethWillingtToPayQuote.maximumAmountIn
  }

  const flashWithdraw = async (amount: BigNumber, slippage: number) => {
    if (!contract) return

    const ethWillingToPay = fromTokenAmount(await calculateEthWillingToPay(amount, slippage), 18)
    const crabAmount = fromTokenAmount(amount, 18)
    return contract.methods.flashWithdraw(crabAmount.toFixed(0), ethWillingToPay.toFixed(0)).send({
      from: address,
    })
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
    flashDeposit,
    flashWithdraw,
    setStrategyCap,
    getCollateralFromCrabAmount,
    calculateEthWillingToPay,
  }
  return <crabContext.Provider value={store}>{children}</crabContext.Provider>
}

export { CrabProvider, useCrab }
