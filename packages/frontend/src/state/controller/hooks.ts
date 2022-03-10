import { useAtomValue } from 'jotai'
import BigNumber from 'bignumber.js'

import { addressAtom } from '../wallet/atoms'
import { OSQUEETH_DECIMALS, TWAP_PERIOD } from '../../constants'
import { impliedVolAtom, normFactorAtom } from './atoms'
import { fromTokenAmount, toTokenAmount } from '@utils/calculations'
import { useHandleTransaction } from '../wallet/hooks'
import { INDEX_SCALE } from '../../constants'
import abi from '../../abis/controller.json'
import { addressesAtom, isWethToken0Atom } from '../positions/atoms'
import { useCallback } from 'react'
import { useOracle } from '@hooks/contracts/useOracle'
import useContract from '../../hooks/useContract'
import { calculateLiquidationPriceForLP } from './utils'
import { useGetETHandOSQTHAmount } from '../nftmanager/hooks'

export const useOpenDepositAndMint = () => {
  const address = useAtomValue(addressAtom)
  const { controller } = useAtomValue(addressesAtom)
  const handleTransaction = useHandleTransaction()
  const contract = useContract(controller, abi)
  /**
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

  return openDepositAndMint
}

export const useDepositCollateral = () => {
  const address = useAtomValue(addressAtom)
  const { controller } = useAtomValue(addressesAtom)
  const handleTransaction = useHandleTransaction()
  const contract = useContract(controller, abi)
  /**
   * Less gas than openDepositAndMint if only deposit is needed
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
  return depositCollateral
}

export const useWithdrawCollateral = () => {
  const address = useAtomValue(addressAtom)
  const { controller } = useAtomValue(addressesAtom)
  const handleTransaction = useHandleTransaction()
  const contract = useContract(controller, abi)
  /**
   * Less gas than burnAndRedeem
   * @param vaultId
   * @param collatAmount
   * @returns
   */
  const withdrawCollateral = useCallback(
    (vaultId: number, collatAmount: BigNumber) => {
      if (!contract || !address) return

      const ethAmt = fromTokenAmount(collatAmount, 18)
      return handleTransaction(
        contract.methods.withdraw(vaultId, ethAmt.toFixed(0)).send({
          from: address,
        }),
      )
    },
    [address, contract],
  )

  return withdrawCollateral
}

export const useBurnAndRedeem = () => {
  const address = useAtomValue(addressAtom)
  const { controller } = useAtomValue(addressesAtom)
  const handleTransaction = useHandleTransaction()
  const contract = useContract(controller, abi)
  /**
   * @param vaultId
   * @param amount - Amount of squeeth to burn, if 0 act as remove collateral
   * @param collatAmount - Amount of collat to remove
   * @returns
   */
  const burnAndRedeem = useCallback(
    (vaultId: number, amount: BigNumber, collatAmount: BigNumber) => {
      if (!contract || !address) return

      const _amount = fromTokenAmount(amount, OSQUEETH_DECIMALS)
      const ethAmt = fromTokenAmount(collatAmount, 18)
      return handleTransaction(
        contract.methods.burnWPowerPerpAmount(vaultId, _amount.toFixed(0), ethAmt.toFixed(0)).send({
          from: address,
        }),
      )
    },
    [contract, address],
  )
  return burnAndRedeem
}

export const useUpdateOperator = () => {
  const address = useAtomValue(addressAtom)
  const { controller } = useAtomValue(addressesAtom)
  const handleTransaction = useHandleTransaction()
  const contract = useContract(controller, abi)
  /**
   * Authorize an address to modify the vault
   * @param vaultId
   * @param operator
   */
  const updateOperator = useCallback(
    async (vaultId: number, operator: string) => {
      if (!contract || !address) return

      await handleTransaction(
        contract.methods.updateOperator(vaultId, operator).send({
          from: address,
        }),
      )
    },
    [contract, address],
  )

  return updateOperator
}

export const useGetVault = () => {
  const { controller } = useAtomValue(addressesAtom)
  const contract = useContract(controller, abi)

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
  const { ethUsdcPool, weth, usdc, controller } = useAtomValue(addressesAtom)
  const contract = useContract(controller, abi)
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
  const { ethUsdcPool, weth, usdc, controller } = useAtomValue(addressesAtom)
  const normFactor = useAtomValue(normFactorAtom)
  const contract = useContract(controller, abi)
  const { getTwapSafe } = useOracle()
  const getShortAmountFromDebt = async (debtAmount: BigNumber) => {
    if (!contract) return new BigNumber(0)

    const ethUsdcPrice = await getTwapSafe(ethUsdcPool, weth, usdc, TWAP_PERIOD)
    const shortAmount = fromTokenAmount(debtAmount, 18).times(INDEX_SCALE).div(normFactor).div(ethUsdcPrice)
    return toTokenAmount(shortAmount.toFixed(0), OSQUEETH_DECIMALS)
  }

  return getShortAmountFromDebt
}

export const useGetCollatRatioAndLiqPrice = () => {
  const impliedVol = useAtomValue(impliedVolAtom)
  const { controller } = useAtomValue(addressesAtom)
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const normFactor = useAtomValue(normFactorAtom)
  const contract = useContract(controller, abi)
  const getTwapEthPrice = useGetTwapEthPrice()
  const getDebtAmount = useGetDebtAmount()
  const getETHandOSQTHAmount = useGetETHandOSQTHAmount()
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
        const { wethAmount, oSqthAmount, position } = await getETHandOSQTHAmount(uniId)
        const ethPrice = await getTwapEthPrice()
        const sqthValueInEth = oSqthAmount.multipliedBy(normFactor).multipliedBy(ethPrice).div(INDEX_SCALE)
        effectiveCollat = effectiveCollat.plus(sqthValueInEth).plus(wethAmount)
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
      if (debt && debt.isPositive()) {
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
  const { controller } = useAtomValue(addressesAtom)
  const contract = useContract(controller, abi)
  const handleTransaction = useHandleTransaction()
  const depositUniPositionToken = async (vaultId: number, uniTokenId: number) => {
    if (!contract || !address) return

    await handleTransaction(
      contract.methods.depositUniPositionToken(vaultId, uniTokenId).send({
        from: address,
      }),
    )
  }
  return depositUniPositionToken
}

export const useWithdrawUniPositionToken = () => {
  const address = useAtomValue(addressAtom)
  const { controller } = useAtomValue(addressesAtom)
  const contract = useContract(controller, abi)
  const handleTransaction = useHandleTransaction()
  const withdrawUniPositionToken = async (vaultId: number) => {
    if (!contract || !address) return
    await handleTransaction(
      contract.methods.withdrawUniPositionToken(vaultId).send({
        from: address,
      }),
    )
  }
  return withdrawUniPositionToken
}
