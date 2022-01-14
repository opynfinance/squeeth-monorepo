import { useWallet } from '@context/wallet'
import { useAddresses } from '@hooks/useAddress'
import { useState, useEffect } from 'react'
import { Contract } from 'web3-eth-contract'
import abi from '../../abis/crabStrategy.json'
import BigNumber from 'bignumber.js'
import { fromTokenAmount, toTokenAmount } from '@utils/calculations'
import { Vault } from '../../types'
import { useController } from './useController'
import { useOracle } from './useOracle'
import { useSqueethPool } from './useSqueethPool'

export const useCrabStrategy = () => {
  const { web3, address, handleTransaction, networkId } = useWallet()
  const { crabStrategy } = useAddresses()
  const { getVault, getCollatRatioAndLiqPrice } = useController()
  const { getSellQuote, getBuyQuote } = useSqueethPool()

  const [contract, setContract] = useState<Contract>()
  const [maxCap, setMaxCap] = useState<BigNumber>(new BigNumber(0))
  const [vault, setVault] = useState<Vault | null>(null)
  const [collatRatio, setCollatRatio] = useState(0)
  const [liquidationPrice, setLiquidationPrice] = useState(new BigNumber(0))
  const [timeAtLastHedge, setTimeAtLastHedge] = useState(0)

  useEffect(() => {
    if (!web3 || !crabStrategy) return
    setContract(new web3.eth.Contract(abi as any, crabStrategy))
  }, [crabStrategy, web3])

  useEffect(() => {
    if (!contract) return

    setStrategyData()
  }, [contract, networkId, address])

  const setStrategyData = async () => {
    if (!contract) return
    console.log('Setting strategy data', contract)

    getMaxCap().then(setMaxCap)
    getStrategyVaultId()
      .then(getVault)
      .then((v) => {
        setVault(v)
        if (v) {
          getCollatRatioAndLiqPrice(v.collateralAmount, v.shortAmount).then((cl) => {
            setCollatRatio(cl.collateralPercent)
            setLiquidationPrice(cl.liquidationPrice)
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
    if (!vault) return new BigNumber(0)

    const squeethDebt = await getWsqueethFromCrabAmount(amount)
    if (!squeethDebt) return new BigNumber(0)

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

  return {
    maxCap,
    vault,
    collatRatio,
    liquidationPrice,
    timeAtLastHedge,
    deposit,
    flashDeposit,
    flashWithdraw,
    checkPriceHedge,
    checkTimeHedge,
    setStrategyCap,
  }
}
