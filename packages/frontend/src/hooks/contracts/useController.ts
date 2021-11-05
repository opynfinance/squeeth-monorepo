import BigNumber from 'bignumber.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import abi from '../../abis/controller.json'
import { INDEX_SCALE, SWAP_EVENT_TOPIC, Vaults, WSQUEETH_DECIMALS } from '../../constants'
import { ETH_DAI_POOL, SQUEETH_UNI_POOL } from '../../constants/address'
import { useWallet } from '../../context/wallet'
import { Vault } from '../../types'
import { fromTokenAmount, toTokenAmount } from '../../utils/calculations'
import { useAddresses } from '../useAddress'
import { useOracle } from './useOracle'

const getMultiplier = (type: Vaults) => {
  if (type === Vaults.ETHBull) return 3
  if (type === Vaults.CrabVault) return 2

  return 1
}

export const useController = () => {
  const { web3, address, handleTransaction, networkId } = useWallet()
  const [contract, setContract] = useState<Contract>()
  const [normFactor, setNormFactor] = useState(new BigNumber(1))
  const [mark, setMark] = useState(new BigNumber(0))
  const [index, setIndex] = useState(new BigNumber(0))
  const [fundingPerDay, setFundingPerDay] = useState(0)
  const { controller, ethDaiPool, weth, dai } = useAddresses()
  const { getTwapSafe } = useOracle()

  useEffect(() => {
    if (!web3) return
    setContract(new web3.eth.Contract(abi as any, controller))
    const controllerContract = new web3.eth.Contract(abi as any, controller)
    controllerContract.methods
      .getExpectedNormalizationFactor()
      .call()
      .then((normFactor: any) => {
        setNormFactor(toTokenAmount(new BigNumber(normFactor.toString()), 18))
      })
      .catch(() => {
        controllerContract.methods
          .normalizationFactor()
          .call()
          .then((normFactor: any) => {
            setNormFactor(toTokenAmount(new BigNumber(normFactor.toString()), 18))
          })
          .catch(() => {
            console.log('normFactor error')
          })
      })
  }, [controller, web3])

  useEffect(() => {
    if (!contract) return
    getFundingForDay().then(setFundingPerDay)
  }, [address, contract])

  /**
   *
   * @param vaultId - 0 to create new
   * @param amount - Amount of squeeth to mint
   * @param vaultType
   * @returns
   */
  const openDepositAndMint = (vaultId: number, amount: BigNumber, vaultType: Vaults) => {
    if (!contract || !address) return

    const _amount = fromTokenAmount(amount, 18)
    handleTransaction(
      contract.methods.mintWPowerPerpAmount(vaultId, _amount.toString(), 0).send({
        from: address,
        value: _amount.multipliedBy(getMultiplier(vaultType)).multipliedBy(10000),
      }),
    )
  }

  /**
   * Authorize an address to modify the vault
   * @param vaultId
   * @param operator
   */
  const updateOperator = async (vaultId: number, operator: string) => {
    if (!contract || !address) return

    await handleTransaction(
      contract.methods.updateOperator(vaultId, operator).send({
        from: address,
      }),
    )
  }

  const getVault = async (vaultId: number): Promise<Vault | null> => {
    if (!contract) return null

    const vault = await contract.methods.vaults(vaultId).call()
    const { NFTCollateralId, collateralAmount, shortAmount, operator } = vault

    return {
      id: vaultId,
      NFTCollateralId,
      collateralAmount: toTokenAmount(new BigNumber(collateralAmount), 18),
      shortAmount: toTokenAmount(new BigNumber(shortAmount), WSQUEETH_DECIMALS),
      operator,
    }
  }

  const getIndex = useCallback(
    async (period: number) => {
      if (!contract) return new BigNumber(0)

      const indexPrice = await contract.methods.getIndex(period.toString()).call()
      return new BigNumber(indexPrice).times(INDEX_SCALE).times(INDEX_SCALE)
    },
    [contract],
  )

  const getMark = useCallback(
    async (period: number) => {
      if (!contract) return new BigNumber(0)
      const markPrice = await contract.methods.getDenormalizedMark(period.toString()).call()

      return new BigNumber(markPrice).times(INDEX_SCALE).times(INDEX_SCALE)
    },
    [contract],
  )

  useEffect(() => {
    if (!contract) return
    //TODO: 3000 not a magic number
    getMark(1).then(setMark)
    getIndex(1).then(setIndex)
  }, [address, contract, getIndex, getMark])

  // setup mark listener
  useEffect(() => {
    if (!web3) return
    const sub = web3.eth.subscribe(
      'logs',
      {
        address: [SQUEETH_UNI_POOL[networkId]],
        topics: [SWAP_EVENT_TOPIC],
      },
      () => {
        //console.log(`someone traded wsqueeth, mark update!`)
        getMark(3).then(setMark)
      },
    )
    // cleanup function
    // return () => sub.unsubscribe()
  }, [web3, networkId, getMark])

  // setup index listender
  useEffect(() => {
    if (!web3) return
    const sub = web3.eth.subscribe(
      'logs',
      {
        address: [ETH_DAI_POOL[networkId]],
        topics: [SWAP_EVENT_TOPIC],
      },
      () => {
        //console.log(`someone traded weth, mark update!`)
        getIndex(3).then(setIndex)
      },
    )
    // return () => sub.unsubscribe()
  }, [web3, networkId, getIndex])
  const getFundingForDay = async () => {
    let index
    let mark
    try {
      index = await getIndex(86400)
      mark = await getMark(86400)
    } catch (error) {
      index = await getIndex(1)
      mark = await getMark(1)
    }

    const nF = mark.dividedBy(mark.multipliedBy(2).minus(index))
    return 1 - nF.toNumber()
  }

  // implied variance = - log ((index/mark +1)/2 ) / f
  const impliedVol = useMemo(() => {
    if (mark.isZero()) return 0
    const f = 1 / 365
    const v2 = Math.log((index.div(mark).toNumber() + 1) / 2) / -f
    return Math.sqrt(v2)
  }, [mark, index])

  const getDebtAmount = async (shortAmount: BigNumber) => {
    if (!contract) return new BigNumber(0)

    const ethDaiPrice = await getTwapSafe(ethDaiPool, weth, dai, 3000)
    const _shortAmt = fromTokenAmount(shortAmount, WSQUEETH_DECIMALS)
    const ethDebt = new BigNumber(_shortAmt).div(INDEX_SCALE).multipliedBy(normFactor).multipliedBy(ethDaiPrice)
    return toTokenAmount(ethDebt, 18)
  }

  const getShortAmountFromDebt = async (debtAmount: BigNumber) => {
    if (!contract) return new BigNumber(0)

    const ethDaiPrice = await getTwapSafe(ethDaiPool, weth, dai, 3000)
    const shortAmount = fromTokenAmount(debtAmount, 18).times(INDEX_SCALE).div(normFactor).div(ethDaiPrice)
    return toTokenAmount(shortAmount.toFixed(0), WSQUEETH_DECIMALS)
  }

  return {
    openDepositAndMint,
    getVault,
    mark,
    index,
    impliedVol,
    updateOperator,
    normFactor,
    fundingPerDay,
    getDebtAmount,
    getShortAmountFromDebt,
  }
}
