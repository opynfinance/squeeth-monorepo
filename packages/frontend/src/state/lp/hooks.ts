import { tickToPrice } from '@uniswap/v3-sdk'

import { fromTokenAmount } from '@utils/calculations'
import { useAtom, useAtomValue } from 'jotai'
import { addressesAtom, isWethToken0Atom } from '../positions/atoms'
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
import { useGetSellQuote } from '../squeethPool/hooks'

// CONSTANTS
const one = new BigNumber(10).pow(18)

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

      const [lowerTick, upperTick] = validTicks(lowerTickInput, upperTickInput)

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

// Opening a mint and LP position and depositing
export const useOpenPositionDeposit = () => {
  const { squeethPool } = useAtomValue(addressesAtom)
  const normalizationFactor = useAtomValue(normFactorAtom)
  const address = useAtomValue(addressAtom)
  const contract = useAtomValue(controllerHelperHelperContractAtom)
  const handleTransaction = useHandleTransaction()
  const normFactor = useAtomValue(normFactorAtom)
  const ethPrice = useAtomValue(wethPriceAtom)
  const squeethPrice = useAtomValue(squeethPriceeAtom)
  const openPositionDeposit = useAppCallback(
    async (
      ethAmount: BigNumber,
      squeethToMint: BigNumber,
      lowerTickInput: number,
      upperTickInput: number,
      onTxConfirmed?: () => void,
    ) => {
      const mintWSqueethAmount = fromTokenAmount(squeethToMint, OSQUEETH_DECIMALS).multipliedBy(normalizationFactor)
      const mintRSqueethAmount = mintWSqueethAmount.multipliedBy(normFactor).div(one)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.multipliedBy(scaledEthPrice).div(one)

      // Do we want to hardcode a 150% collateralization ratio?
      const collateralToMint = debtInEth.multipliedBy(3).div(2).plus(0.01)
      const collateralToLp = mintWSqueethAmount.multipliedBy(squeethPrice).div(one)
      const flashloanFee = collateralToMint.multipliedBy(9).div(1000)

      // Closest 60 tick width above or below current tick (60 is minimum tick width for 30bps pool)

      const [lowerTick, upperTick] = validTicks(lowerTickInput, upperTickInput)

      const flashloanWMintDepositNftParams = {
        wPowerPerpPool: squeethPool,
        vaultId: 0,
        wPowerPerpAmount: mintWSqueethAmount.toString(),
        collateralToDeposit: collateralToMint.toString(),
        collateralToFlashloan: collateralToMint.toString(),
        collateralToLp: collateralToLp.toString(),
        collateralToWithdraw: 0,
        amount0Min: 0,
        amount1Min: 0,
        lowerTick: lowerTick,
        upperTick: upperTick,
      }

      if (!contract || !address) return null

      return handleTransaction(
        contract.methods
          .flashloanWMintLpDepositNft(flashloanWMintDepositNftParams, {
            value: collateralToLp.plus(flashloanFee).plus(0.01).toString(),
          })
          .send({
            from: address,
            value: fromTokenAmount(ethAmount, 18),
          }),
        onTxConfirmed,
      )
    },
    [],
  )
  return openPositionDeposit
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

export function validTicks(lowerTickInput: number, upperTickInput: number) {
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
  return [lowerTick, upperTick]
}

// Rebalance via vault
export const useRebalanceVault = () => {
  const address = useAtomValue(addressAtom)
  const controllerHelperContract = useAtomValue(controllerHelperHelperContractAtom)
  const { controllerHelper, weth, oSqueeth, squeethPool } = useAtomValue(addressesAtom)
  const controllerContract = useAtomValue(controllerContractAtom)
  const handleTransaction = useHandleTransaction()
  const ethPrice = useAtomValue(wethPriceAtom)
  const positionManager = useAtomValue(nftManagerContractAtom)
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const getSellQuote = useGetSellQuote()
  const rebalanceVault = useAppCallback(
    async (vaultId: BigNumber, lowerTickInput: number, upperTickInput: number, onTxConfirmed?: () => void) => {
      if (!controllerContract || !controllerHelperContract || !address || !positionManager) return
      const one = new BigNumber(10).pow(18)
      const uniTokenId = (await controllerContract?.methods.vaults(vaultId)).NftCollateralId
      const positionBefore = await positionManager.methods.positions(uniTokenId)
      const vaultBefore = await controllerContract?.methods.vaults(vaultId)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = vaultBefore.shortAmount.mul(scaledEthPrice).div(one)
      const collateralToFlashloan = debtInEth.mul(3).div(2).add(0.01)
      const tokenIndex = await positionManager.methods.totalSupply()
      const tokenId = await positionManager.methods.tokenByIndex(tokenIndex.sub(1))
      const amount0Min = new BigNumber(0)
      const amount1Min = new BigNumber(0)
      const safetyWPowerPerp = ethers.utils.parseUnits('0.01')

      const [lowerTick, upperTick] = validTicks(lowerTickInput, upperTickInput)

      // Get current LPpositions
      const [amount0, amount1] = await positionManager.methods.decreaseLiquidity({
        tokenId: tokenId,
        liquidity: positionBefore.liquidity,
        amount0Min: 0,
        amount1Min: 0,
        deadline: Math.floor(Date.now() / 1000 + 1800),
      })
      const wPowerPerpAmountInLPBefore = isWethToken0 ? amount1 : amount0
      const wethAmountInLPBefore = isWethToken0 ? amount0 : amount1

      // Estimate proceeds from liquidating squeeth in LP
      const ethAmountOutFromSwap = getSellQuote(wPowerPerpAmountInLPBefore)

      // Estimate of new LP with 0.01 weth safety margin
      const safetyEth = ethers.utils.parseUnits('0.01')
      const wethAmountToLP = wethAmountInLPBefore.add(ethAmountOutFromSwap).sub(safetyEth)

      const abiCoder = new ethers.utils.AbiCoder()
      const rebalanceLpInVaultParams = [
        {
          // Liquidate LP
          rebalanceLpInVaultType: new BigNumber(1), // DecreaseLpLiquidity:
          // DecreaseLpLiquidityParams: [tokenId, liquidity, liquidityPercentage, amount0Min, amount1Min]
          data: abiCoder.encode(
            ['uint256', 'uint256', 'uint256', 'uint128', 'uint128'],
            [
              tokenId,
              positionBefore.liquidity,
              new BigNumber(100).multipliedBy(new BigNumber(10).pow(16)).toString(),
              new BigNumber(0).toString(),
              new BigNumber(0).toString(),
            ],
          ),
        },
        {
          // Deposit into vault and mint
          rebalanceLpInVaultType: new BigNumber(2).toString(), // DepositIntoVault
          // DepsositIntoVault: [wPowerPerpToMint, collateralToDeposit]
          data: abiCoder.encode(['uint256', 'uint256'], [wPowerPerpAmountInLPBefore, wethAmountInLPBefore]),
        },
        {
          // Withdraw from vault
          rebalanceLpInVaultType: new BigNumber(3), // WithdrawFromVault
          // withdrawFromVault: [wPowerPerpToBurn, collateralToWithdraw, burnExactRemoved ]
          data: abiCoder.encode(
            ['uint256', 'uint256', 'bool'],
            [wPowerPerpAmountInLPBefore, wethAmountInLPBefore, false],
          ),
        },
        {
          // Mint new LP
          rebalanceLpInVaultType: new BigNumber(4).toString(), // MintNewLP
          // lpWPowerPerpPool: [recipient, wPowerPerpPool, vaultId, wPowerPerpAmount, collateralToDeposit, collateralToLP, amount0Min, amount1Min, lowerTick, upperTick ]
          data: abiCoder.encode(
            ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'int24', 'int24'],
            [
              controllerHelper,
              squeethPool,
              vaultId,
              new BigNumber(0).toString(),
              new BigNumber(0).toString(),
              wethAmountToLP,
              amount0Min,
              amount1Min,
              lowerTick,
              upperTick,
            ],
          ),
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
    },
    [],
  )
  return rebalanceVault
}

// Rebalance via general swap
export const useRebalanceGeneralSwap = () => {
  const address = useAtomValue(addressAtom)
  const controllerHelperContract = useAtomValue(controllerHelperHelperContractAtom)
  const { controllerHelper, weth, oSqueeth, squeethPool } = useAtomValue(addressesAtom)
  const controllerContract = useAtomValue(controllerContractAtom)
  const handleTransaction = useHandleTransaction()
  const ethPrice = useAtomValue(wethPriceAtom)
  const positionManager = useAtomValue(nftManagerContractAtom)
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const getSellQuote = useGetSellQuote()
  const rebalanceGeneralSwap = useAppCallback(
    async (vaultId: BigNumber, lowerTickInput: number, upperTickInput: number, onTxConfirmed?: () => void) => {
      if (!controllerContract || !controllerHelperContract || !address || !positionManager) return
      const one = new BigNumber(10).pow(18)
      const uniTokenId = (await controllerContract?.methods.vaults(vaultId)).NftCollateralId
      const positionBefore = await positionManager.methods.positions(uniTokenId)
      const vaultBefore = await controllerContract?.methods.vaults(vaultId)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = vaultBefore.shortAmount.mul(scaledEthPrice).div(one)
      const collateralToFlashloan = debtInEth.mul(3).div(2).add(0.01)
      const tokenIndex = await positionManager.methods.totalSupply()
      const tokenId = await positionManager.methods.tokenByIndex(tokenIndex.sub(1))
      const amount0Min = new BigNumber(0)
      const amount1Min = new BigNumber(0)
      const safetyWPowerPerp = ethers.utils.parseUnits('0.01')

      const [lowerTick, upperTick] = validTicks(lowerTickInput, upperTickInput)

      // Get current LPpositions
      const [amount0, amount1] = await positionManager.methods.decreaseLiquidity({
        tokenId: tokenId,
        liquidity: positionBefore.liquidity,
        amount0Min: 0,
        amount1Min: 0,
        deadline: Math.floor(Date.now() / 1000 + 1800),
      })
      const wPowerPerpAmountInLPBefore = isWethToken0 ? amount1 : amount0
      const wethAmountInLPBefore = isWethToken0 ? amount0 : amount1

      // Estimate proceeds from liquidating squeeth in LP
      const ethAmountOutFromSwap = getSellQuote(wPowerPerpAmountInLPBefore)

      // Estimate of new LP with 0.01 weth safety margin
      const safetyEth = ethers.utils.parseUnits('0.01')
      const wethAmountToLP = wethAmountInLPBefore.add(ethAmountOutFromSwap).sub(safetyEth)

      const abiCoder = new ethers.utils.AbiCoder()
      const rebalanceLpInVaultParams = [
        {
          // Liquidate LP
          rebalanceLpInVaultType: new BigNumber(1), // DecreaseLpLiquidity:
          // DecreaseLpLiquidityParams: [tokenId, liquidity, liquidityPercentage, amount0Min, amount1Min]
          data: abiCoder.encode(
            ['uint256', 'uint256', 'uint256', 'uint128', 'uint128'],
            [
              tokenId,
              positionBefore.liquidity,
              new BigNumber(100).multipliedBy(new BigNumber(10).pow(16)).toString(),
              new BigNumber(0).toString(),
              new BigNumber(0).toString(),
            ],
          ),
        },
        {
          // Sell all oSQTH for ETH
          rebalanceLpInVaultType: new BigNumber(5), // GeneralSwap:
          // GeneralSwap: [tokenIn, tokenOut, amountIn, limitPrice]
          data: abiCoder.encode(
            ['address', 'address', 'uint256', 'uint256', 'uint24'],
            [oSqueeth, weth, wPowerPerpAmountInLPBefore.sub(safetyWPowerPerp), new BigNumber(0).toString(), 3000],
          ),
        },
        {
          // Mint new LP
          rebalanceLpInVaultType: new BigNumber(4).toString(), // MintNewLP
          // lpWPowerPerpPool: [recipient, wPowerPerpPool, vaultId, wPowerPerpAmount, collateralToDeposit, collateralToLP, amount0Min, amount1Min, lowerTick, upperTick ]
          data: abiCoder.encode(
            ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'int24', 'int24'],
            [
              controllerHelper,
              squeethPool,
              vaultId,
              new BigNumber(0).toString(),
              new BigNumber(0).toString(),
              wethAmountToLP,
              amount0Min,
              amount1Min,
              lowerTick,
              upperTick,
            ],
          ),
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
    },
    [],
  )
  return rebalanceGeneralSwap
}
