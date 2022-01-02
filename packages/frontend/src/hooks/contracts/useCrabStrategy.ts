import { useWallet } from '@context/wallet'
import { useAddresses } from '@hooks/useAddress'
import { useState, useEffect } from 'react'
import { Contract } from 'web3-eth-contract'
import abi from '@abis/CrabStrategy.json'
import BigNumber from 'bignumber.js'
import { fromTokenAmount, toTokenAmount } from '@utils/calculations'
import { Vault } from '../../types'
import { useController } from './useController'
import { useOracle } from './useOracle'

export const useCrabStrategy = () => {
  const { web3, address, handleTransaction, networkId } = useWallet()
  const { crabStrategy, squeethPool, wSqueeth, weth } = useAddresses()
  const { getVault, getCollatRatioAndLiqPrice } = useController()
  const { getTwapSafe } = useOracle()

  const [contract, setContract] = useState<Contract>()
  const [maxCap, setMaxCap] = useState<BigNumber>(new BigNumber(0))
  const [vault, setVault] = useState<Vault | null>(null)
  const [collatRatio, setCollatRatio] = useState(0)
  const [liquidationPrice, setLiquidationPrice] = useState(0)
  const [isPriceHedge, setIsPriceHedge] = useState(false)
  const [isTimeHedge, setIsTimeHedge] = useState(false)
  const [actionTriggerTime, setAuctionTriggerTime] = useState(0)

  useEffect(() => {
    if (!web3) return
    setContract(new web3.eth.Contract(abi as any, crabStrategy))
  }, [crabStrategy, web3])

  useEffect(() => {
    if (!contract) return

    setStrategyData()
  }, [contract, address])

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
          })
        }
      })
    const timeHedge = await checkTimeHedge()
    const _isPriceHedge = await checkPriceHedge(1640319531)
    setIsTimeHedge(timeHedge[0])
    setIsPriceHedge(_isPriceHedge)
    setAuctionTriggerTime(1640319531)
    const squeethPrice = await calculateAuctionPrice()
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

  const checkPriceHedge = async (auctionTriggerTime: number) => {
    if (!contract) return null

    const result = await contract.methods.checkPriceHedge(auctionTriggerTime).call()
    return result
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

  const calculateAuctionPrice = async () => {
    const squeethPrice = await getTwapSafe(squeethPool, wSqueeth, weth, 3000)
    return squeethPrice.times(0.95)
  }

  const flashDeposit = async (amount: BigNumber) => {
    if (!contract) return
  }

  const priceHedgeOnUniswap = async () => {
    return handleTransaction(
      contract?.methods.priceHedgeOnUniswap(1640319531, 0, 0).send({
        from: address,
      }),
    )
  }

  return {
    maxCap,
    vault,
    collatRatio,
    liquidationPrice,
    isTimeHedge,
    isPriceHedge,
    actionTriggerTime,
    deposit,
    priceHedgeOnUniswap,
  }
}
