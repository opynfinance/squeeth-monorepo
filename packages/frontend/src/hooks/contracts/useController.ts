import BigNumber from 'bignumber.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Contract } from 'web3-eth-contract'
import { atom, useAtom } from 'jotai'

import abi from '../../abis/controller.json'
import { FUNDING_PERIOD, INDEX_SCALE, SWAP_EVENT_TOPIC, Vaults, OSQUEETH_DECIMALS, TWAP_PERIOD } from '../../constants'
import { ETH_USDC_POOL, SQUEETH_UNI_POOL } from '@constants/address'
import { useWallet } from '@context/wallet'
import { Vault } from '../../types'
import { fromTokenAmount, toTokenAmount } from '@utils/calculations'
import { useAddresses } from '../useAddress'
import { useOracle } from './useOracle'
import { useNFTManager } from './useNFTManager'

const getMultiplier = (type: Vaults) => {
  if (type === Vaults.ETHBull) return 3
  if (type === Vaults.CrabVault) return 2

  return 1
}

export const normFactorAtom = atom(new BigNumber(1))
export const markAtom = atom(new BigNumber(0))
export const indexAtom = atom(new BigNumber(0))
export const currentImpliedFundingAtom = atom(0)
export const impliedVolAtom = atom((get: any) => {
  const mark = get(markAtom)
  const index = get(indexAtom)
  const currentImpliedFunding = get(currentImpliedFundingAtom)

  if (mark.isZero()) return 0
  if (mark.lt(index)) return 0
  if (currentImpliedFunding < 0) return 0

  return Math.sqrt(currentImpliedFunding * 365)
})
export const dailyHistoricalFundingAtom = atom({ period: 0, funding: 0})

export const useController = () => {
  const { web3, address, handleTransaction, networkId } = useWallet()
  const [contract, setContract] = useState<Contract>()
  const [normFactor, setNormFactor] = useAtom(normFactorAtom)
  const [mark, setMark] = useAtom(markAtom)
  const [index, setIndex] = useAtom(indexAtom)
  const [currentImpliedFunding, setCurrentImpliedFunding] = useAtom(currentImpliedFundingAtom)
  const [dailyHistoricalFunding, setDailyHistoricalFunding] = useAtom(dailyHistoricalFundingAtom)

  const { controller, ethUsdcPool, weth, usdc } = useAddresses()
  const { getTwapSafe } = useOracle()
  const { getETHandOSQTHAmount } = useNFTManager()

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
    getDailyHistoricalFunding().then(setDailyHistoricalFunding)
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
    const { NftCollateralId, collateralAmount, shortAmount, operator } = vault

    return {
      id: vaultId,
      NFTCollateralId: NftCollateralId,
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

  // Tries to get funding for the longest period available based on Uniswap storage slots, optimistically 24hrs, worst case spot
  // TODO: get 24hr historical funding from the subgraph to have a value that isn't dynamic based on storage slots
  const getDailyHistoricalFunding = async () => {
    let index = new BigNumber(0)
    let mark = new BigNumber(0)
    let period = 24
    let isError = false

    //start by trying 24hr twap, if fails try dividing by 2 until 45min minimum, fall back to spot otherwise
    for (; period >= 0.75; period = period / 2) {
      try {
        //convert period from hours to seconds
        index = await getIndex(period * 3600)
        mark = await getMark(period * 3600)
        isError = false
      } catch (error) {
        isError = true
      }
      if (isError === false) {
        break
      }
    }
    if (index.isEqualTo(0) || mark.isEqualTo(0)) {
      index = await getIndex(1)
      mark = await getMark(1)
    }

    if (index.isEqualTo(0)) {
      return { period: 0, funding: 0 }
    }

    console.log('period ' + period)

    const funding = Math.log(mark.dividedBy(index).toNumber()) / FUNDING_PERIOD

    return { period: period, funding: funding }
  }

  const getCurrentImpliedFunding = async () => {
    const currIndex = await getIndex(1)
    const currMark = await getMark(1)
    if (currIndex.isEqualTo(0)) {
      return 0
    }

    return Math.log(currMark.dividedBy(currIndex).toNumber()) / FUNDING_PERIOD
  }

  const getDebtAmount = async (shortAmount: BigNumber) => {
    if (!contract) return new BigNumber(0)

    const ethUsdcPrice = await getTwapSafe(ethUsdcPool, weth, usdc, TWAP_PERIOD)
    const _shortAmt = fromTokenAmount(shortAmount, OSQUEETH_DECIMALS)
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

  const getCollatRatioAndLiqPrice = async (collateralAmount: BigNumber, shortAmount: BigNumber, uniId?: number) => {
    const emptyState = {
      collateralPercent: 0,
      liquidationPrice: new BigNumber(0),
    }
    if (!contract) return emptyState

    let effectiveCollat = collateralAmount
    // Uni LP token is deposited
    if (uniId) {
      const { wethAmount, oSqthAmount } = await getETHandOSQTHAmount(uniId)
      const ethPrice = await getTwapEthPrice()
      const sqthValueInEth = oSqthAmount.multipliedBy(normFactor).multipliedBy(ethPrice).div(INDEX_SCALE)
      effectiveCollat = effectiveCollat.plus(sqthValueInEth).plus(wethAmount)
    }
    const debt = await getDebtAmount(shortAmount)
    if (debt && debt.isPositive()) {
      const collateralPercent = Number(effectiveCollat.div(debt).times(100).toFixed(1))
      const rSqueeth = normFactor.multipliedBy(new BigNumber(shortAmount)).dividedBy(10000)
      const liquidationPrice = effectiveCollat.div(rSqueeth.multipliedBy(1.5))
      return {
        collateralPercent,
        liquidationPrice,
      }
    }

    return emptyState
  }

  const depositUniPositionToken = async (vaultId: number, uniTokenId: number) => {
    if (!contract || !address) return

    await handleTransaction(
      contract.methods.depositUniPositionToken(vaultId, uniTokenId).send({
        from: address,
      }),
    )
  }

  const withdrawUniPositionToken = async (vaultId: number) => {
    if (!contract || !address) return

    await handleTransaction(
      contract.methods.withdrawUniPositionToken(vaultId).send({
        from: address,
      }),
    )
  }

  return {
    openDepositAndMint,
    getVault,
    updateOperator,
    getDebtAmount,
    getShortAmountFromDebt,
    burnAndRedeem,
    getCollatRatioAndLiqPrice,
    depositCollateral,
    withdrawCollateral,
    getTwapEthPrice,
    depositUniPositionToken,
    withdrawUniPositionToken,
  }
}
