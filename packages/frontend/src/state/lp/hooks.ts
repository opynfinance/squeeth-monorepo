import { tickToPrice } from '@uniswap/v3-sdk'

import { fromTokenAmount } from '@utils/calculations'
import { useAtom, useAtomValue } from 'jotai'
import { addressesAtom } from '../positions/atoms'
import BigNumber from 'bignumber.js'
import { BIG_ZERO, OSQUEETH_DECIMALS } from '@constants/index'
import { controllerContractAtom, controllerHelperHelperContractAtom, nftManagerContractAtom } from '../contracts/atoms'
import useAppCallback from '@hooks/useAppCallback'
import { addressAtom } from '../wallet/atoms'
import { normFactorAtom } from '../controller/atoms'
import { Price, Token } from '@uniswap/sdk-core'
import { useHandleTransaction } from '../wallet/hooks'
import { squeethPriceeAtom, wethPriceAtom } from '../squeethPool/atoms'
import ethers from 'ethers'

// Close position with flashloan
export const useClosePosition = () => {
  const address = useAtomValue(addressAtom)
  const controllerHelperContract = useAtomValue(controllerHelperHelperContractAtom)
  const { controllerHelper } = useAtomValue(addressesAtom)
  const controllerContract = useAtomValue(controllerContractAtom)
  const handleTransaction = useHandleTransaction()
  const squeethPrice = useAtomValue(squeethPriceeAtom)
  const ethPrice = useAtomValue(wethPriceAtom)
  const positionManager = useAtomValue(nftManagerContractAtom)
  const closePosition = useAppCallback(async (vaultId: BigNumber, onTxConfirmed?: () => void) => {
    if (!controllerContract || !controllerHelperContract || !address || !positionManager) return
    const one = new BigNumber(10).pow(18)
    const uniTokenId = (await controllerContract?.methods.vaults(vaultId)).NftCollateralId
    const vaultBefore = await controllerContract?.methods.vaults(vaultId)
    const scaledEthPrice = ethPrice.div(10000)
    const debtInEth = vaultBefore.shortAmount.mul(scaledEthPrice).div(one)
    const collateralToFlashloan = debtInEth.mul(3).div(2).add(0.01)
    const slippage = new BigNumber(3).multipliedBy(new BigNumber(10).pow(16))
    const limitPriceEthPerPowerPerp = squeethPrice.multipliedBy(one.minus(slippage)).div(one)
    const positionBefore = await positionManager.methods.positions(uniTokenId)

    const flashloanCloseVaultLpNftParam = {
      vaultId: vaultId,
      tokenId: uniTokenId,
      liquidity: positionBefore.liquidity,
      liquidityPercentage: 1,
      wPowerPerpAmountToBurn: vaultBefore.shortAmount.toString(),
      collateralToFlashloan: collateralToFlashloan.toString(),
      collateralToWithdraw: 0,
      limitPriceEthPerPowerPerp: limitPriceEthPerPowerPerp.toString(),
      amount0Min: 0,
      amount1Min: 0,
      poolFee: 3000,
      burnExactRemoved: false,
    }

    await controllerContract.methods.updateOperator(vaultId, controllerHelper)

    return handleTransaction(
      await controllerHelperContract.methods.flashloanCloseVaultLpNft(flashloanCloseVaultLpNftParam).send({
        from: address,
      }),
      onTxConfirmed,
    )
  }, [])
  return closePosition
}

// Opening a mint and LP position
export const useOpenPosition = () => {
  const { squeethPool } = useAtomValue(addressesAtom)
  const normalizationFactor = useAtomValue(normFactorAtom)
  const address = useAtomValue(addressAtom)
  const contract = useAtomValue(controllerHelperHelperContractAtom)
  const handleTransaction = useHandleTransaction()
  const openPosition = useAppCallback(
    async (
      ethAmount: BigNumber,
      squeethToMint: BigNumber,
      collateralAmount: BigNumber,
      vaultId: BigNumber,
      lowerTickInput: number,
      upperTickInput: number,
      onTxConfirmed?: () => void,
    ) => {
      const amount0Min = BIG_ZERO
      const amount1Min = BIG_ZERO
      const mintWSqueethAmount = fromTokenAmount(squeethToMint, OSQUEETH_DECIMALS).multipliedBy(normalizationFactor)

      // Closest 60 tick width above or below current tick (60 is minimum tick width for 30bps pool)

      // Closest valid lower tick
      const lowerTickBelow = lowerTickInput - (lowerTickInput % 60)
      const lowerTickAbove = lowerTickInput + (lowerTickInput % 60)
      const lowerTick =
        Math.abs(lowerTickAbove - lowerTickInput) < Math.abs(lowerTickBelow - lowerTickInput)
          ? lowerTickAbove
          : lowerTickBelow

      // TODO: ensure we're not hitting a bound for a tick
      // Closest valid upper tick
      const upperTickBelow = upperTickInput - (upperTickInput % 60)
      const upperTickAbove = upperTickInput + (upperTickInput % 60)
      const upperTick =
        Math.abs(upperTickAbove - upperTickInput) < Math.abs(upperTickBelow - upperTickInput)
          ? upperTickAbove
          : upperTickBelow

      const params = {
        recipient: address,
        wPowerPerpPool: squeethPool,
        vaultId: vaultId,
        wPowerPerpAmount: mintWSqueethAmount,
        collateralToDeposit: collateralAmount,
        collateralToLp: BIG_ZERO,
        amount0Min: amount0Min,
        amount1Min: amount1Min,
        lowerTick: lowerTick,
        upperTick: upperTick,
      }

      if (!contract || !address) return null

      return handleTransaction(
        contract.methods.wMintLp(params, { value: collateralAmount }).send({
          from: address,
          value: fromTokenAmount(ethAmount, 18),
        }),
        onTxConfirmed,
      )
    },
    [],
  )
  return openPosition
}

// Collect fees
export const useCollectFees = () => {
  const address = useAtomValue(addressAtom)
  const controllerHelperContract = useAtomValue(controllerHelperHelperContractAtom)
  const { controllerHelper } = useAtomValue(addressesAtom)
  const controllerContract = useAtomValue(controllerContractAtom)
  const handleTransaction = useHandleTransaction()
  const ethPrice = useAtomValue(wethPriceAtom)
  const positionManager = useAtomValue(nftManagerContractAtom)
  const collectFees = useAppCallback(async (vaultId: BigNumber, onTxConfirmed?: () => void) => {
    if (!controllerContract || !controllerHelperContract || !address || !positionManager) return
    const one = new BigNumber(10).pow(18)
    const uniTokenId = (await controllerContract?.methods.vaults(vaultId)).NftCollateralId
    const vaultBefore = await controllerContract?.methods.vaults(vaultId)
    const scaledEthPrice = ethPrice.div(10000)
    const debtInEth = vaultBefore.shortAmount.mul(scaledEthPrice).div(one)
    const collateralToFlashloan = debtInEth.mul(3).div(2).add(0.01)
    const amount0Max = new BigNumber(2).multipliedBy(new BigNumber(10).pow(18)).minus(1)
    const amount1Max = new BigNumber(2).multipliedBy(new BigNumber(10).pow(18)).minus(1)

    const abiCoder = new ethers.utils.AbiCoder()
    const rebalanceLpInVaultParams = [
      {
        rebalanceLpInVaultType: new BigNumber(6),
        // CollectFees
        data: abiCoder.encode(['uint256', 'uint128', 'uint128'], [uniTokenId, amount0Max, amount1Max]),
      },
    ]

    await controllerContract.methods.updateOperator(vaultId, controllerHelper)
    return handleTransaction(
      await controllerHelperContract.methods
        .rebalanceLpInVault(vaultId, collateralToFlashloan, rebalanceLpInVaultParams)
        .send({
          from: address,
        }),
      onTxConfirmed,
    )
  }, [])
  return collectFees
}

export function getTickToPrice(baseToken?: Token, quoteToken?: Token, tick?: number): Price<Token, Token> | undefined {
  if (!baseToken || !quoteToken || typeof tick !== 'number') {
    return undefined
  }
  return tickToPrice(baseToken, quoteToken, tick)
}
