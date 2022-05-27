import { useAtom, useAtomValue } from 'jotai'
import BigNumber from 'bignumber.js'

import { addressAtom, networkIdAtom, web3Atom } from '../wallet/atoms'
import { OSQUEETH_DECIMALS, SWAP_EVENT_TOPIC, TWAP_PERIOD } from '../../constants'
import {
  markAtom,
  currentImpliedFundingAtom,
  dailyHistoricalFundingAtom,
  impliedVolAtom,
  indexAtom,
  normFactorAtom,
} from './atoms'
import { fromTokenAmount, toTokenAmount } from '@utils/calculations'
import { useHandleTransaction } from '../wallet/hooks'
import { INDEX_SCALE } from '../../constants'
import { addressesAtom, isWethToken0Atom } from '../positions/atoms'
import { useCallback, useEffect } from 'react'
import { useOracle } from '@hooks/contracts/useOracle'
import {
  calculateLiquidationPriceForLP,
  getCurrentImpliedFunding,
  getDailyHistoricalFunding,
  getIndex,
  getMark,
} from './utils'
import { useGetETHandOSQTHAmount } from '../nftmanager/hooks'
import { controllerContractAtom } from '../contracts/atoms'
import { ETH_USDC_POOL, SQUEETH_UNI_POOL } from '@constants/address'

export const useOpenDepositAndMint = () => {
  const address = useAtomValue(addressAtom)
  const handleTransaction = useHandleTransaction()
  const contract = useAtomValue(controllerContractAtom)
  /**
   * @param vaultId - 0 to create new
   * @param amount - Amount of squeeth to mint, if 0 act as add collateral
   * @param vaultType
   * @returns
   */
  const openDepositAndMint = (
    vaultId: number,
    amount: BigNumber,
    collatAmount: BigNumber,
    onTxConfirmed?: () => void,
  ) => {
    if (!contract || !address) return

    const _amount = fromTokenAmount(amount, OSQUEETH_DECIMALS).toFixed(0)
    const ethAmt = fromTokenAmount(collatAmount, 18).toFixed(0)
    return handleTransaction(
      contract.methods.mintWPowerPerpAmount(vaultId, _amount.toString(), 0).send({
        from: address,
        value: ethAmt,
      }),
      onTxConfirmed,
    )
  }

  return openDepositAndMint
}

export const useDepositCollateral = () => {
  const address = useAtomValue(addressAtom)
  const handleTransaction = useHandleTransaction()
  const contract = useAtomValue(controllerContractAtom)
  /**
   * Less gas than openDepositAndMint if only deposit is needed
   * @param vaultId
   * @param collatAmount
   */
  const depositCollateral = (vaultId: number, collatAmount: BigNumber, onTxConfirmed?: () => void) => {
    if (!contract || !address) return

    const ethAmt = fromTokenAmount(collatAmount, 18)
    return handleTransaction(
      contract.methods.deposit(vaultId).send({
        from: address,
        value: ethAmt.toFixed(0),
      }),
      onTxConfirmed,
    )
  }
  return depositCollateral
}

export const useWithdrawCollateral = () => {
  const address = useAtomValue(addressAtom)
  const handleTransaction = useHandleTransaction()
  const contract = useAtomValue(controllerContractAtom)
  /**
   * Less gas than burnAndRedeem
   * @param vaultId
   * @param collatAmount
   * @returns
   */
  const withdrawCollateral = (vaultId: number, collatAmount: BigNumber, onTxConfirmed?: () => void) => {
    if (!contract || !address) return

    const ethAmt = fromTokenAmount(collatAmount, 18)
    return handleTransaction(
      contract.methods.withdraw(vaultId, ethAmt.toFixed(0)).send({
        from: address,
      }),
      onTxConfirmed,
    )
  }

  return withdrawCollateral
}

export const useBurnAndRedeem = () => {
  const address = useAtomValue(addressAtom)
  const handleTransaction = useHandleTransaction()
  const contract = useAtomValue(controllerContractAtom)
  /**
   * @param vaultId
   * @param amount - Amount of squeeth to burn, if 0 act as remove collateral
   * @param collatAmount - Amount of collat to remove
   * @returns
   */
  const burnAndRedeem = (vaultId: number, amount: BigNumber, collatAmount: BigNumber, onTxConfirmed?: () => void) => {
    if (!contract || !address) return

    const _amount = fromTokenAmount(amount, OSQUEETH_DECIMALS)
    const ethAmt = fromTokenAmount(collatAmount, 18)
    return handleTransaction(
      contract.methods.burnWPowerPerpAmount(vaultId, _amount.toFixed(0), ethAmt.toFixed(0)).send({
        from: address,
      }),
      onTxConfirmed,
    )
  }
  return burnAndRedeem
}

export const useUpdateOperator = () => {
  const address = useAtomValue(addressAtom)
  const handleTransaction = useHandleTransaction()
  const contract = useAtomValue(controllerContractAtom)
  /**
   * Authorize an address to modify the vault
   * @param vaultId
   * @param operator
   */
  const updateOperator = async (vaultId: number, operator: string, onTxConfirmed?: () => void) => {
    if (!contract || !address) return

    await handleTransaction(
      contract.methods.updateOperator(vaultId, operator).send({
        from: address,
      }),
      onTxConfirmed,
    )
  }

  return updateOperator
}

export const useGetVault = () => {
  const contract = useAtomValue(controllerContractAtom)

  const getVault = useCallback(
    async (vaultId: number) => {
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
    },
    [contract],
  )

  return getVault
}

export const useGetDebtAmount = () => {
  const { ethUsdcPool, weth, usdc } = useAtomValue(addressesAtom)
  const contract = useAtomValue(controllerContractAtom)
  const normFactor = useAtomValue(normFactorAtom)
  const { getTwapSafe } = useOracle()
  const getDebtAmount = useCallback(
    async (shortAmount: BigNumber) => {
      if (!contract) return new BigNumber(0)

      const ethUsdcPrice = await getTwapSafe(ethUsdcPool, weth, usdc, TWAP_PERIOD)
      const _shortAmt = fromTokenAmount(shortAmount, OSQUEETH_DECIMALS)
      const ethDebt = new BigNumber(_shortAmt).div(INDEX_SCALE).multipliedBy(normFactor).multipliedBy(ethUsdcPrice)
      return toTokenAmount(ethDebt, 18)
    },
    [contract, ethUsdcPool, getTwapSafe, normFactor?.toString(), usdc, weth],
  )
  return getDebtAmount
}

export const useGetTwapEthPrice = () => {
  const { ethUsdcPool, weth, usdc } = useAtomValue(addressesAtom)
  const { getTwapSafe } = useOracle()
  const getTwapEthPrice = useCallback(
    async () => await getTwapSafe(ethUsdcPool, weth, usdc, TWAP_PERIOD),
    [usdc, ethUsdcPool, getTwapSafe, weth],
  )

  return getTwapEthPrice
}

export const useGetShortAmountFromDebt = () => {
  const { ethUsdcPool, weth, usdc } = useAtomValue(addressesAtom)
  const normFactor = useAtomValue(normFactorAtom)
  const contract = useAtomValue(controllerContractAtom)
  const { getTwapSafe } = useOracle()
  const getShortAmountFromDebt = async (debtAmount: BigNumber) => {
    if (!contract) return new BigNumber(0)

    const ethUsdcPrice = await getTwapSafe(ethUsdcPool, weth, usdc, TWAP_PERIOD)
    const shortAmount = fromTokenAmount(debtAmount, 18).times(INDEX_SCALE).div(normFactor).div(ethUsdcPrice)
    return toTokenAmount(shortAmount.toFixed(0), OSQUEETH_DECIMALS)
  }

  return getShortAmountFromDebt
}

export const useGetUniNFTCollatDetail = () => {
  const normFactor = useAtomValue(normFactorAtom)
  const getETHandOSQTHAmount = useGetETHandOSQTHAmount()
  const getTwapEthPrice = useGetTwapEthPrice()

  const getUniNFTCollatDetail = async (uniId: number) => {
    const ethPrice = await getTwapEthPrice()
    const { wethAmount, oSqthAmount, position } = await getETHandOSQTHAmount(uniId)
    const sqthValueInEth = oSqthAmount.multipliedBy(normFactor).multipliedBy(ethPrice).div(INDEX_SCALE)

    return { collateral: sqthValueInEth.plus(wethAmount), position }
  }

  return getUniNFTCollatDetail
}

export const useGetCollatRatioAndLiqPrice = () => {
  const impliedVol = useAtomValue(impliedVolAtom)
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const normFactor = useAtomValue(normFactorAtom)
  const contract = useAtomValue(controllerContractAtom)
  const getTwapEthPrice = useGetTwapEthPrice()
  const getDebtAmount = useGetDebtAmount()
  const getETHandOSQTHAmount = useGetETHandOSQTHAmount()
  const getUniNFTCollatDetail = useGetUniNFTCollatDetail()
  const getCollatRatioAndLiqPrice = useCallback(
    async (collateralAmount: BigNumber, shortAmount: BigNumber, uniId?: number) => {
      const emptyState = {
        collateralPercent: 0,
        liquidationPrice: new BigNumber(0),
      }
      if (!contract) return emptyState

      let effectiveCollat = collateralAmount
      let liquidationPrice = new BigNumber(0)
      // Uni LP token is deposited
      if (uniId) {
        const { collateral: uniCollat, position } = await getUniNFTCollatDetail(uniId)
        effectiveCollat = effectiveCollat.plus(uniCollat)
        liquidationPrice = calculateLiquidationPriceForLP(
          collateralAmount,
          shortAmount,
          position!,
          isWethToken0,
          normFactor,
          impliedVol,
        )
      }
      const debt = await getDebtAmount(shortAmount)

      if (debt && !debt.isZero() && debt.isPositive()) {
        const collateralPercent = Number(effectiveCollat.div(debt).times(100).toFixed(1))
        const rSqueeth = normFactor.multipliedBy(new BigNumber(shortAmount)).dividedBy(10000)
        if (!uniId) liquidationPrice = effectiveCollat.div(rSqueeth.multipliedBy(1.5))

        return {
          collateralPercent,
          liquidationPrice,
        }
      }

      return emptyState
    },
    [contract, getDebtAmount, getETHandOSQTHAmount, getTwapEthPrice, impliedVol, isWethToken0, normFactor.toString()],
  )

  return getCollatRatioAndLiqPrice
}

export const useDepositUnuPositionToken = () => {
  const address = useAtomValue(addressAtom)
  const contract = useAtomValue(controllerContractAtom)
  const handleTransaction = useHandleTransaction()
  const depositUniPositionToken = async (vaultId: number, uniTokenId: number, onTxConfirmed?: () => void) => {
    if (!contract || !address) return

    await handleTransaction(
      contract.methods.depositUniPositionToken(vaultId, uniTokenId).send({
        from: address,
      }),
      onTxConfirmed,
    )
  }
  return depositUniPositionToken
}

export const useWithdrawUniPositionToken = () => {
  const address = useAtomValue(addressAtom)
  const contract = useAtomValue(controllerContractAtom)
  const handleTransaction = useHandleTransaction()
  const withdrawUniPositionToken = async (vaultId: number, onTxConfirmed?: () => void) => {
    if (!contract || !address) return
    await handleTransaction(
      contract.methods.withdrawUniPositionToken(vaultId).send({
        from: address,
      }),
      onTxConfirmed,
    )
  }
  return withdrawUniPositionToken
}

const useNormFactor = () => {
  const networkId = useAtomValue(networkIdAtom)
  const contract = useAtomValue(controllerContractAtom)
  const [normFactor, setNormFactor] = useAtom(normFactorAtom)
  useEffect(() => {
    if (!contract) return
    contract.methods
      .getExpectedNormalizationFactor()
      .call()
      .then((normFactor: any) => {
        setNormFactor(toTokenAmount(new BigNumber(normFactor.toString()), 18))
      })
      .catch(() => {
        contract.methods
          .normalizationFactor()
          .call()
          .then((normFactor: any) => {
            setNormFactor(toTokenAmount(new BigNumber(normFactor.toString()), 18))
          })
          .catch(() => {
            console.log('normFactor error')
          })
      })
  }, [contract, setNormFactor, networkId])

  return normFactor
}

const useIndex = () => {
  const address = useAtomValue(addressAtom)
  const web3 = useAtomValue(web3Atom)
  const networkId = useAtomValue(networkIdAtom)
  const [index, setIndex] = useAtom(indexAtom)
  const contract = useAtomValue(controllerContractAtom)

  useEffect(() => {
    if (!contract) return
    getIndex(1, contract).then(setIndex)
  }, [address, networkId, contract, setIndex])

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
        getIndex(3, contract).then(setIndex)
      },
    )

    return () => {
      sub.unsubscribe()
    }
  }, [contract, web3, networkId])

  return index
}

const useDailyHistoricalFunding = () => {
  const address = useAtomValue(addressAtom)
  const networkId = useAtomValue(networkIdAtom)
  const [dailyHistoricalFunding, setDailyHistoricalFunding] = useAtom(dailyHistoricalFundingAtom)
  const contract = useAtomValue(controllerContractAtom)
  useEffect(() => {
    if (!contract) return
    getDailyHistoricalFunding(contract).then(setDailyHistoricalFunding)
  }, [address, networkId, contract, setDailyHistoricalFunding])

  return dailyHistoricalFunding
}

const useCurrentImpliedFunding = () => {
  const address = useAtomValue(addressAtom)
  const networkId = useAtomValue(networkIdAtom)
  const [currentImpliedFunding, setCurrentImpliedFunding] = useAtom(currentImpliedFundingAtom)
  const contract = useAtomValue(controllerContractAtom)
  useEffect(() => {
    if (!contract) return
    getCurrentImpliedFunding(contract).then(setCurrentImpliedFunding)
  }, [address, networkId, setCurrentImpliedFunding, contract])

  return currentImpliedFunding
}

const useMark = () => {
  const address = useAtomValue(addressAtom)
  const web3 = useAtomValue(web3Atom)
  const networkId = useAtomValue(networkIdAtom)
  const [mark, setMark] = useAtom(markAtom)
  const contract = useAtomValue(controllerContractAtom)

  useEffect(() => {
    if (!contract) return
    getMark(1, contract).then(setMark)
  }, [address, networkId, contract, setMark])

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
        getMark(3, contract).then(setMark)
      },
    )
    // cleanup function
    return () => {
      sub.unsubscribe()
    }
  }, [contract, networkId, web3])

  return mark
}

export const useInitController = () => {
  useIndex()
  useMark()
  useCurrentImpliedFunding()
  useDailyHistoricalFunding()
  useNormFactor()
}
