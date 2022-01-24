import BigNumber from 'bignumber.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import abi from '../../abis/controller.json'
import { FUNDING_PERIOD, INDEX_SCALE, SWAP_EVENT_TOPIC, Vaults, OSQUEETH_DECIMALS, TWAP_PERIOD } from '../../constants'
import { ETH_USDC_POOL, SQUEETH_UNI_POOL } from '@constants/address'
import { useWallet } from '@context/wallet'
import { Vault } from '../../types'
import { fromTokenAmount, toTokenAmount } from '@utils/calculations'
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
  const [fundingPerHalfHour, setFundingPerHalfHour] = useState(0)
  const [currentImpliedFunding, setCurrentImpliedFunding] = useState(0)
  const { controller, ethUsdcPool, weth, usdc } = useAddresses()
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
    getFundingForHalfHour().then(setFundingPerHalfHour)
    getCurrentImpliedFunding().then(setCurrentImpliedFunding)
  }, [address, contract])

  /**
   *
   * @param vaultId - 0 to create new
   * @param amount - Amount of squeeth to mint, if 0 act as add collateral
   * @param vaultType
   * @returns
   */
  const openDepositAndMint = (vaultId: number, amount: BigNumber, collatAmount: BigNumber) => {
    if (!contract || !address) return

    const _amount = fromTokenAmount(amount, OSQUEETH_DECIMALS).toFixed(0)
    const ethAmt = fromTokenAmount(collatAmount, 18).toFixed(0)
    return handleTransaction(
      contract.methods.mintWPowerPerpAmount(vaultId, _amount.toString(), 0).send({
        from: address,
        value: ethAmt,
      }),
    )
  }

  /**
   * Less gas than openDepositAndMint if only deposit is needed
   *
   * @param vaultId
   * @param collatAmount
   */
  const depositCollateral = (vaultId: number, collatAmount: BigNumber) => {
    if (!contract || !address) return

    const ethAmt = fromTokenAmount(collatAmount, 18)
    return handleTransaction(
      contract.methods.deposit(vaultId).send({
        from: address,
        value: ethAmt.toFixed(0),
      }),
    )
  }

  /**
   * Less gas than burnAndRedeem
   *
   * @param vaultId
   * @param collatAmount
   * @returns
   */
  const withdrawCollateral = (vaultId: number, collatAmount: BigNumber) => {
    if (!contract || !address) return

    const ethAmt = fromTokenAmount(collatAmount, 18)
    return handleTransaction(
      contract.methods.withdraw(vaultId, ethAmt.toFixed(0)).send({
        from: address,
      }),
    )
  }

  /**
   *
   * @param vaultId
   * @param amount - Amount of squeeth to burn, if 0 act as remove collateral
   * @param collatAmount - Amount of collat to remove
   * @returns
   */
  const burnAndRedeem = (vaultId: number, amount: BigNumber, collatAmount: BigNumber) => {
    if (!contract || !address) return

    const _amount = fromTokenAmount(amount, OSQUEETH_DECIMALS)
    const ethAmt = fromTokenAmount(collatAmount, 18)
    return handleTransaction(
      contract.methods.burnWPowerPerpAmount(vaultId, _amount.toFixed(0), ethAmt.toFixed(0)).send({
        from: address,
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
      shortAmount: toTokenAmount(new BigNumber(shortAmount), OSQUEETH_DECIMALS),
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
        address: [ETH_USDC_POOL[networkId]],
        topics: [SWAP_EVENT_TOPIC],
      },
      () => {
        getIndex(3).then(setIndex)
      },
    )
    // return () => sub.unsubscribe()
  }, [web3, networkId, getIndex])

  const getFundingForHalfHour = async () => {
    let index
    let mark
    try {
      index = await getIndex(1800)
      mark = await getMark(1800)
    } catch (error) {
      index = await getIndex(1)
      mark = await getMark(1)
    }
    if (index.isEqualTo(0)) {
      return 0
    }

    return Math.log(mark.dividedBy(index).toNumber()) / FUNDING_PERIOD
  }

  const getCurrentImpliedFunding = async () => {
    const currIndex = await getIndex(1)
    const currMark = await getMark(1)
    if (currIndex.isEqualTo(0)) {
      return 0
    }

    return Math.log(currMark.dividedBy(currIndex).toNumber()) / FUNDING_PERIOD
  }

  const impliedVol = useMemo(() => {
    if (mark.isZero()) return 0
    if (mark.lt(index)) return 0
    if (currentImpliedFunding < 0) return 0

    return Math.sqrt(currentImpliedFunding * 365)
  }, [mark, currentImpliedFunding, index])

  const getDebtAmount = async (shortAmount: BigNumber) => {
    if (!contract) return new BigNumber(0)

    const ethUsdcPrice = await getTwapSafe(ethUsdcPool, weth, usdc, TWAP_PERIOD)
    const _shortAmt = fromTokenAmount(shortAmount, OSQUEETH_DECIMALS)
    console.log('ETH usdc price', ethUsdcPrice.toString())
    const ethDebt = new BigNumber(_shortAmt).div(INDEX_SCALE).multipliedBy(normFactor).multipliedBy(ethUsdcPrice)
    return toTokenAmount(ethDebt, 18)
  }

  const getTwapEthPrice = useCallback(
    async () => await getTwapSafe(ethUsdcPool, weth, usdc, TWAP_PERIOD),
    [usdc, ethUsdcPool, getTwapSafe, weth],
  )

  const getShortAmountFromDebt = async (debtAmount: BigNumber) => {
    if (!contract) return new BigNumber(0)

    const ethUsdcPrice = await getTwapSafe(ethUsdcPool, weth, usdc, TWAP_PERIOD)
    const shortAmount = fromTokenAmount(debtAmount, 18).times(INDEX_SCALE).div(normFactor).div(ethUsdcPrice)
    return toTokenAmount(shortAmount.toFixed(0), OSQUEETH_DECIMALS)
  }

  const getCollatRatioAndLiqPrice = async (collateralAmount: BigNumber, shortAmount: BigNumber) => {
    const emptyState = {
      collateralPercent: 0,
      liquidationPrice: new BigNumber(0),
    }
    if (!contract) return emptyState

    const debt = await getDebtAmount(shortAmount)
    if (debt && debt.isPositive()) {
      console.log('debt: ', collateralAmount.toString(), debt.toString())
      const collateralPercent = Number(collateralAmount.div(debt).times(100).toFixed(1))
      const rSqueeth = normFactor.multipliedBy(new BigNumber(shortAmount)).dividedBy(10000)
      const liquidationPrice = collateralAmount.div(rSqueeth.multipliedBy(1.5))
      return {
        collateralPercent,
        liquidationPrice,
      }
    }

    return emptyState
  }

  return {
    openDepositAndMint,
    getVault,
    mark,
    index,
    impliedVol,
    updateOperator,
    normFactor,
    fundingPerHalfHour,
    getDebtAmount,
    getShortAmountFromDebt,
    burnAndRedeem,
    getCollatRatioAndLiqPrice,
    depositCollateral,
    withdrawCollateral,
    currentImpliedFunding,
    getTwapEthPrice,
  }
}
