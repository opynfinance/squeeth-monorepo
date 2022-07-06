import { FeeAmount, nearestUsableTick, SqrtPriceMath, TickMath, tickToPrice, TICK_SPACINGS } from '@uniswap/v3-sdk'

import { fromTokenAmount } from '@utils/calculations'
import { useAtom, useAtomValue } from 'jotai'
import { addressesAtom, isWethToken0Atom, positionTypeAtom } from '../positions/atoms'
import BigNumber from 'bignumber.js'
import { BIG_ZERO, INDEX_SCALE, OSQUEETH_DECIMALS, UNI_POOL_FEES, WETH_DECIMALS } from '@constants/index'
import { controllerContractAtom, controllerHelperHelperContractAtom, nftManagerContractAtom, quoterContractAtom } from '../contracts/atoms'
import useAppCallback from '@hooks/useAppCallback'
import { addressAtom, signerAtom, web3Atom } from '../wallet/atoms'
import positionManagerAbi from '../../abis/NFTpositionmanager.json'
import controllerAbi from '../../abis/controller.json'
import { normFactorAtom } from '../controller/atoms'
import { Price, Token } from '@uniswap/sdk-core'

// import { Price, Token, TickMath } from '@uniswap/v3-periphery'

import { useHandleTransaction } from '../wallet/hooks'
import { squeethPriceeAtom, squeethTokenAtom, wethPriceAtom, wethTokenAtom } from '../squeethPool/atoms'
import { ethers } from 'ethers'
import { useGetBuyQuote, useGetSellQuote } from '../squeethPool/hooks'
import { useUpdateAtom } from 'jotai/utils'
import { lowerTickAtom, upperTickAtom } from './atoms'
import { useCallback, useMemo } from 'react'
import { useGetDebtAmount, useGetTwapEthPrice, useGetTwapSqueethPrice, useGetVault } from '../controller/hooks'
import { useFirstValidVault } from '../positions/hooks'

/*** CONSTANTS ***/
const one = new BigNumber(10).pow(18)
export enum Bound {
  LOWER = 'LOWER',
  UPPER = 'UPPER',
}

/*** ACTIONS ***/

// Close position with flashloan
export const useClosePosition = () => {
  const address = useAtomValue(addressAtom)
  const controllerHelperContract = useAtomValue(controllerHelperHelperContractAtom)
  const controllerContract = useAtomValue(controllerContractAtom)
  const handleTransaction = useHandleTransaction()
  const getDebtAmount = useGetDebtAmount()
  const getVault = useGetVault()
  const getPosition = useGetPosition()
  const getLimitEth = useGetLimitEth()
  const closePosition = useAppCallback(async (vaultId: number, onTxConfirmed?: () => void) => {
    const vaultBefore = await getVault(vaultId)
    const uniTokenId = vaultBefore?.NFTCollateralId 
    const position = await getPosition(uniTokenId)

    if (
      !controllerContract ||
      !controllerHelperContract ||
      !address ||
      !position ||
      !vaultBefore ||
      !vaultBefore.shortAmount
    )
      return

    const shortAmount = fromTokenAmount(vaultBefore.shortAmount, OSQUEETH_DECIMALS)
    const debtInEth = await getDebtAmount(shortAmount)
    const collateralToFlashloan = debtInEth.multipliedBy(1.5)
    const limitEth = await getLimitEth(shortAmount)

    const flashloanCloseVaultLpNftParam = {
      vaultId: vaultId,
      tokenId: uniTokenId,
      liquidity: position.liquidity,
      liquidityPercentage: fromTokenAmount(1, 18).toFixed(0),
      wPowerPerpAmountToBurn: shortAmount.toFixed(0),
      collateralToFlashloan: collateralToFlashloan.toFixed(0),
      collateralToWithdraw: 0,
      limitPriceEthPerPowerPerp: limitEth,
      amount0Min: 0,
      amount1Min: 0,
      poolFee: 3000,
      burnExactRemoved: true,
    }

    console.log("flashloanCloseVaultLpNftParam", flashloanCloseVaultLpNftParam)

    return handleTransaction(
      await controllerHelperContract.methods.flashloanCloseVaultLpNft(flashloanCloseVaultLpNftParam).send({
        from: address,
      }),
      onTxConfirmed,
    )
  }, [address, controllerHelperContract, controllerContract])
  return closePosition
}

// Opening a mint and LP position and depositing
export const useOpenPositionDeposit = () => {
  const { squeethPool } = useAtomValue(addressesAtom)
  const address = useAtomValue(addressAtom)
  const contract = useAtomValue(controllerHelperHelperContractAtom)
  const handleTransaction = useHandleTransaction()
  const getTwapSqueethPrice = useGetTwapSqueethPrice()
  const getDebtAmount = useGetDebtAmount()
  const openPositionDeposit = useAppCallback(
    async (squeethToMint: BigNumber, lowerTickInput: number, upperTickInput: number, vaultID: number, onTxConfirmed?: () => void) => {
      const squeethPrice = await getTwapSqueethPrice()
      console.log("squeethPrice", squeethPrice.toString())
      const mintWSqueethAmount = fromTokenAmount(squeethToMint, OSQUEETH_DECIMALS)
      const ethDebt = await getDebtAmount(mintWSqueethAmount)

      // Do we want to hardcode a 150% collateralization ratio?
      console.log('squeeth price', squeethPrice.toString())
      const collateralToMint = ethDebt.multipliedBy(3).div(2)
      const collateralToLp = mintWSqueethAmount.multipliedBy(squeethPrice)

      const lowerTick = nearestUsableTick(lowerTickInput, 3000)
      const upperTick = nearestUsableTick(upperTickInput, 3000)

      const flashloanWMintDepositNftParams = {
        wPowerPerpPool: squeethPool,
        vaultId: vaultID,
        wPowerPerpAmount: mintWSqueethAmount.toFixed(0),
        collateralToDeposit: collateralToMint.toFixed(0),
        collateralToFlashloan: collateralToMint.toFixed(0),
        collateralToLp: collateralToLp.toFixed(0),
        collateralToWithdraw: 0,
        amount0Min: 0,
        amount1Min: 0,
        lowerTick: lowerTick,
        upperTick: upperTick,
      }

      console.log('flashloanWMintDepositNftParams from hooks', flashloanWMintDepositNftParams)
      if (!contract || !address) return null

      return handleTransaction(
        contract.methods.flashloanWMintLpDepositNft(flashloanWMintDepositNftParams).send({
          from: address,
          value: collateralToLp.toFixed(0),
        }),
        onTxConfirmed,
      )
    },
    [address, squeethPool, contract],
  )
  return openPositionDeposit
}

// Collect fees
export const useCollectFees = () => {
  const address = useAtomValue(addressAtom)
  const controllerHelperContract = useAtomValue(controllerHelperHelperContractAtom)
  const controllerContract = useAtomValue(controllerContractAtom)
  const handleTransaction = useHandleTransaction()
  const getDebtAmount = useGetDebtAmount()
  const getVault = useGetVault()
  const collectFees = useAppCallback(async (vaultId: number, onTxConfirmed?: () => void) => {
    const vaultBefore = await getVault(vaultId)
    const uniTokenId = vaultBefore?.NFTCollateralId    
    
    if (
      !controllerContract ||
      !controllerHelperContract ||
      !address ||
      !vaultBefore ||
      !vaultBefore.shortAmount
    )
      return

    const shortAmount = fromTokenAmount(vaultBefore.shortAmount, OSQUEETH_DECIMALS)
    const debtInEth = await getDebtAmount(shortAmount)
    const collateralToFlashloan = debtInEth.multipliedBy(1.5)
    const amount0Max = new BigNumber(2).multipliedBy(new BigNumber(10).pow(18)).minus(1).toFixed(0)
    const amount1Max = new BigNumber(2).multipliedBy(new BigNumber(10).pow(18)).minus(1).toFixed(0)
    const abiCoder = new ethers.utils.AbiCoder()
    const rebalanceLpInVaultParams = [
      {
        rebalanceLpInVaultType: new BigNumber(6).toFixed(0),
        // CollectFees
        data: abiCoder.encode(['uint256', 'uint128', 'uint128'], [uniTokenId, amount0Max, amount1Max]),
      },
      {
        rebalanceLpInVaultType: new BigNumber(7).toFixed(0),
        // DepositExistingNftParams
        data: abiCoder.encode(["uint256"], [uniTokenId])
      }
    ]

    return handleTransaction(
      await controllerHelperContract.methods
        .rebalanceLpInVault(vaultId, collateralToFlashloan.toFixed(0), rebalanceLpInVaultParams)
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

// Rebalance via vault
export const useRebalanceVault = () => {
  const address = useAtomValue(addressAtom)
  const controllerHelperContract = useAtomValue(controllerHelperHelperContractAtom)
  const { controllerHelper, squeethPool } = useAtomValue(addressesAtom)
  const controllerContract = useAtomValue(controllerContractAtom)
  const handleTransaction = useHandleTransaction()
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const web3 = useAtomValue(web3Atom)
  const getSellQuote = useGetSellQuote()
  const getDebtAmount = useGetDebtAmount()
  const getVault = useGetVault()
  const getPosition = useGetPosition()
  const getTotalSupply = useGetTotalSupply()
  const getTokenByIndex = useGetTokenByIndex()
  const getDecreaseLiquidity = useGetDecreaseLiquidity()
  const getLimitEth = useGetLimitEth()
  const rebalanceVault = useAppCallback(
    async (vaultId: number, lowerTickInput: number, upperTickInput: number, onTxConfirmed?: () => void) => {
      const vaultBefore = await getVault(vaultId)
      const uniTokenId = vaultBefore?.NFTCollateralId 
      console.log("uniTokenId", uniTokenId)
      const position = await getPosition(uniTokenId)
      console.log(position)
      if (!controllerContract || !controllerHelperContract || !address || !position || !vaultBefore ) return
      const shortAmount = fromTokenAmount(vaultBefore.shortAmount, OSQUEETH_DECIMALS)
      const debtInEth = await getDebtAmount(shortAmount)
      const collateralToFlashloan = debtInEth.multipliedBy(1.5)
      const amount0Min = new BigNumber(0)
      const amount1Min = new BigNumber(0)

      const lowerTick = nearestUsableTick(lowerTickInput, 3000)
      const upperTick = nearestUsableTick(upperTickInput, 3000)

      // Get current LPpositions
      const { amount0, amount1 } = await getDecreaseLiquidity(uniTokenId, position.liquidity, 0, 0, Math.floor(Date.now() / 1000 + 86400))
     
      console.log("iswethtoken0", isWethToken0)
      const wPowerPerpAmountInLPBefore = isWethToken0 ? amount1 : amount0
      const wethAmountInLPBefore = isWethToken0 ? amount0 : amount1

      // Estimate proceeds from liquidating squeeth in LP
      const wPowerPerpAmountInLPBeforeVal = fromTokenAmount(wPowerPerpAmountInLPBefore, OSQUEETH_DECIMALS)
      const ethAmountOutFromSwap = await getLimitEth(wPowerPerpAmountInLPBeforeVal)
      console.log("ethAmountOutFromSwap", ethAmountOutFromSwap)

      // Estimate of new LP
      const wethAmountToLP = new BigNumber(wethAmountInLPBefore).plus(ethAmountOutFromSwap).toFixed(0)
      console.log("wPowerPerpAmountInLPBefore", wPowerPerpAmountInLPBefore.toString())
      console.log("wethAmountInLPBefore", wethAmountInLPBefore.toString())
      console.log("wethAmountToLP", wethAmountToLP)

      const abiCoder = new ethers.utils.AbiCoder()
      const rebalanceLpInVaultParams = [
        {
          // Liquidate LP
          rebalanceLpInVaultType: new BigNumber(1).toFixed(0), // DecreaseLpLiquidity:
          // DecreaseLpLiquidityParams: [tokenId, liquidity, liquidityPercentage, amount0Min, amount1Min]
          data: abiCoder.encode(
            ['uint256', 'uint256', 'uint256', 'uint128', 'uint128'],
            [
              uniTokenId,
              position.liquidity,
              fromTokenAmount(1, 18).toFixed(0),
              0,
              0,
            ],
          ),
        },
        {
          // Withdraw from vault
          rebalanceLpInVaultType: new BigNumber(3).toFixed(0), // WithdrawFromVault
          // withdrawFromVault: [wPowerPerpToBurn, collateralToWithdraw, burnExactRemoved ]
          data: abiCoder.encode(
            ['uint256', 'uint256', 'bool'],
            [wPowerPerpAmountInLPBefore, wethAmountInLPBefore, true],
          ),
        },
        {
          // Deposit into vault and mint
          rebalanceLpInVaultType: new BigNumber(2).toFixed(0), // DepositIntoVault
          // DepsositIntoVault: [wPowerPerpToMint, collateralToDeposit]
          data: abiCoder.encode(['uint256', 'uint256'], [wPowerPerpAmountInLPBefore, wethAmountInLPBefore]),
        },
        {
          // Mint new LP
          rebalanceLpInVaultType: new BigNumber(4).toFixed(0), // MintNewLP
          // lpWPowerPerpPool: [recipient, wPowerPerpPool, vaultId, wPowerPerpAmount, collateralToDeposit, collateralToLP, amount0Min, amount1Min, lowerTick, upperTick ]
          data: abiCoder.encode(
            ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'int24', 'int24'],
            [
              controllerHelper,
              squeethPool,
              vaultId,
              0,
              0,
              wethAmountToLP,
              amount0Min.toFixed(0),
              amount1Min.toFixed(0),
              lowerTick,
              upperTick,
            ],
          ),
        },
      ]

      console.log("collateralToFlashloan", collateralToFlashloan.toString())

      return handleTransaction(
        await controllerHelperContract.methods
          .rebalanceLpInVault(vaultId, collateralToFlashloan.toFixed(0), rebalanceLpInVaultParams)
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
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const getDebtAmount = useGetDebtAmount()
  const getVault = useGetVault()
  const getDecreaseLiquidity = useGetDecreaseLiquidity()
  const getPosition = useGetPosition()
  const getLimitEth = useGetLimitEth()
  const getSqueethEquivalent = useGetSqueethEquivalent()
  const getTwapSqueethPrice = useGetTwapSqueethPrice()
  const rebalanceGeneralSwap = useAppCallback(
    async (vaultId: number, lowerTickInput: number, upperTickInput: number, onTxConfirmed?: () => void) => {
      const vaultBefore = await getVault(vaultId)
      const uniTokenId = vaultBefore?.NFTCollateralId 
      const position = await getPosition(uniTokenId)
      if (!controllerContract || !controllerHelperContract || !address || !position || !vaultBefore) return
      const shortAmount = fromTokenAmount(vaultBefore.shortAmount, OSQUEETH_DECIMALS)
      const debtInEth = await getDebtAmount(shortAmount)
      const collateralToFlashloan = debtInEth.multipliedBy(1.5)

      const amount0Min = new BigNumber(0)
      const amount1Min = new BigNumber(0)

      const lowerTick = nearestUsableTick(lowerTickInput, 3000)
      const upperTick = nearestUsableTick(upperTickInput, 3000)

      // Get current LP positions
      const { amount0, amount1 } = await getDecreaseLiquidity(uniTokenId, position.liquidity, 0, 0, Math.floor(Date.now() / 1000 + 86400))

      const wPowerPerpAmountInLPBefore = isWethToken0 ? amount1 : amount0
      console.log("wPowerPerpAmountInLPBefore", wPowerPerpAmountInLPBefore)
      const wethAmountInLPBefore = isWethToken0 ? amount0 : amount1
      console.log("wethAmountInLPBefore", wethAmountInLPBefore)

      const x96 = new BigNumber(2).pow(96)
      const squeethPrice = new BigNumber(await getTwapSqueethPrice())
      const liquidity = new BigNumber(position.liquidity)

      // Calculate prices from ticks
      const sqrtLowerPrice = new BigNumber(TickMath.getSqrtRatioAtTick(lowerTick).toString()).div(x96)
      const sqrtUpperPrice = new BigNumber(TickMath.getSqrtRatioAtTick(upperTick).toString()).div(x96)
      const sqrtSqueethPrice = new BigNumber(squeethPrice.sqrt())
      console.log("sqrtSqueethPrice", sqrtSqueethPrice.toFixed(0))

      // Calculate amounts of each asset to LP
      // x = L(sqrt(upperPrice) - sqrt(squeethPrice))) / sqrt(squeethPrice) * sqrt(upperPrice)
      // y = L(sqrt(squeethPrice) - sqrt(lowerPrice))
      const newAmount0 = liquidity.times(sqrtUpperPrice.minus(sqrtSqueethPrice)).div((sqrtSqueethPrice.times(sqrtUpperPrice)))
      const newAmount1 = liquidity.times(sqrtSqueethPrice.minus(sqrtLowerPrice))

      // Calculate difference new position
      const wethAmountInLPAfter = isWethToken0 ? newAmount0 : newAmount1
      console.log("wethAmountInLPAfter", wethAmountInLPAfter.toFixed(0))
      const wPowerPerpAmountInLPAfter = isWethToken0 ? newAmount1 : newAmount0
      console.log("wPowerPerpAmountInLPAfter", wPowerPerpAmountInLPAfter.toFixed(0))
      console.log("wethAmountToLP", wethAmountInLPAfter.toFixed(0))
      const needMoreWeth = new BigNumber(wethAmountInLPBefore).lt(new BigNumber(wethAmountInLPAfter))
      console.log("needMoreWeth", needMoreWeth)

      const tokenIn = needMoreWeth ? oSqueeth : weth
      const tokenOut = needMoreWeth ? weth : oSqueeth

      const amountIn = needMoreWeth ? await getSqueethEquivalent(new BigNumber(wethAmountInLPAfter).minus(new BigNumber(wethAmountInLPBefore)))
                                    : new BigNumber(wethAmountInLPBefore).minus(new BigNumber(wethAmountInLPAfter)).toFixed(0)
      console.log("amountIn", amountIn)

      console.log("1st", [
        uniTokenId,
        position.liquidity,
        fromTokenAmount(1, 18).toFixed(0),
        0,
        0,
      ])
      console.log("2nd", [tokenIn, tokenOut, amountIn, "0", 3000])
      console.log("3rd", [
        controllerHelper,
        squeethPool,
        vaultId,
        "0",
        "0",
        wethAmountInLPAfter.toFixed(0),
        amount0Min.toFixed(0),
        amount1Min.toFixed(0),
        lowerTick,
        upperTick,
      ])

      const abiCoder = new ethers.utils.AbiCoder()
      const rebalanceLpInVaultParams = [
        {
          // Liquidate LP
          rebalanceLpInVaultType: new BigNumber(1).toFixed(0), // DecreaseLpLiquidity:
          // DecreaseLpLiquidityParams: [tokenId, liquidity, liquidityPercentage, amount0Min, amount1Min]
          data: abiCoder.encode(
            ['uint256', 'uint256', 'uint256', 'uint128', 'uint128'],
            [
              uniTokenId,
              position.liquidity,
              fromTokenAmount(1, 18).toFixed(0),
              0,
              0,
            ],
          ),
        },
        {
          // Exchange necessary amount of oSQTH and ETH
          rebalanceLpInVaultType: new BigNumber(5).toFixed(0), // GeneralSwap:
          // GeneralSwap: [tokenIn, tokenOut, amountIn, limitPrice]
          data: abiCoder.encode(
            ['address', 'address', 'uint256', 'uint256', 'uint24'],
            [tokenIn, tokenOut, amountIn, 0, 3000],
          ),
        },
        {
          // Mint new LP
          rebalanceLpInVaultType: new BigNumber(4).toFixed(0), // MintNewLP
          // lpWPowerPerpPool: [recipient, wPowerPerpPool, vaultId, wPowerPerpAmount, collateralToDeposit, collateralToLP, amount0Min, amount1Min, lowerTick, upperTick ]
          data: abiCoder.encode(
            ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'int24', 'int24'],
            [
              controllerHelper,
              squeethPool,
              vaultId,
              wPowerPerpAmountInLPAfter.toFixed(0),
              0,
              wethAmountInLPAfter.toFixed(0),
              amount0Min.toFixed(0),
              amount1Min.toFixed(0),
              lowerTick,
              upperTick,
            ],
          ),
        },
      ]
      return handleTransaction(
        await controllerHelperContract.methods
          .rebalanceLpInVault(vaultId, collateralToFlashloan.toFixed(0), rebalanceLpInVaultParams)
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

/*** GETTERS ***/

export const useGetPosition = () => {
  const contract = useAtomValue(nftManagerContractAtom)

  const getPosition = useCallback(
    async (uniTokenId: number) => {
      if (!contract) return null
      const position = await contract.methods.positions(uniTokenId).call()
      const { nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1 } = position
      return {
        nonce,
        operator,
        token0,
        token1,
        fee,
        tickLower,
        tickUpper,
        liquidity,
        feeGrowthInside0LastX128,
        feeGrowthInside1LastX128,
        tokensOwed0,
        tokensOwed1
      }
    },
    [contract],
  )

  return getPosition
}

export const useGetTotalSupply = () => {
  const contract = useAtomValue(nftManagerContractAtom)

  const getTotalSupply = useCallback(
    async () => {
      if (!contract) return null
      const totalSupply = await contract.methods.totalSupply().call()

      return totalSupply
    },
    [contract],
  )

  return getTotalSupply
}

export const useGetTokenByIndex = () => {
  const contract = useAtomValue(nftManagerContractAtom)

  const getTokenByIndex = useCallback(
    async (index: BigNumber) => {
      if (!contract) return null
      const tokenByIndex = await contract.methods.tokenByIndex(index.toFixed(0)).call()

      return tokenByIndex
    },
    [contract],
  )

  return getTokenByIndex
}

export const useGetDecreaseLiquidity = () => {
  const contract = useAtomValue(nftManagerContractAtom)

  const getDecreaseLiquiduity = useCallback(
    async (tokenId: number, liquidity: number, amount0Min: number, amount1Min: number, deadline: number) => {
      if (!contract) return null
      const DecreaseLiquidityParams = {
        tokenId,
        liquidity,
        amount0Min,
        amount1Min,
        deadline,
      }
      console.log("DecreaseLiquidityParams", DecreaseLiquidityParams)

      const decreaseLiquidity = await contract.methods.decreaseLiquidity(DecreaseLiquidityParams).call()

      return decreaseLiquidity
    },
    [contract],
  )

  return getDecreaseLiquiduity
}


export const useGetLimitEth = () => {
  const contract = useAtomValue(quoterContractAtom)
  const {weth, oSqueeth} = useAtomValue(addressesAtom)

  const getLimitEth = useCallback(
    async (mintWSqueethAmount: BigNumber) => {
      if (!contract) return null

      const QuoteExactInputSingleParams = {
        tokenIn: oSqueeth,
        tokenOut: weth,
        amountIn: mintWSqueethAmount.toFixed(0),
        fee: 3000,
        sqrtPriceLimitX96: 0
      }

      const limitEth = await contract.methods.quoteExactInputSingle(QuoteExactInputSingleParams).call()
      return limitEth.amountOut
    },
    [contract, weth, oSqueeth],
  )

  return getLimitEth
}

export const useGetSqueethEquivalent = () => {
  const contract = useAtomValue(quoterContractAtom)
  const {weth, oSqueeth} = useAtomValue(addressesAtom)

  const getSqueethEquivalent = useCallback(
    async (wethAmount: BigNumber) => {
      if (!contract) return null

      const QuoteExactInputSingleParams = {
        tokenIn: weth,
        tokenOut: oSqueeth,
        amountIn: wethAmount.toFixed(0),
        fee: 3000,
        sqrtPriceLimitX96: 0
      }

      const limitEth = await contract.methods.quoteExactInputSingle(QuoteExactInputSingleParams).call()
      return limitEth.amountOut
    },
    [contract, weth, oSqueeth],
  )

  return getSqueethEquivalent
}

// export const getNow = async(provider: any) => {
//   const blockNumBefore = await provider.getBlockNumber();
//   const blockBefore = await provider.getBlock(blockNumBefore);
//   return blockBefore.timestamp;
// }
