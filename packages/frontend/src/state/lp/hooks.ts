import { nearestUsableTick, TickMath } from '@uniswap/v3-sdk'
import { fromTokenAmount } from '@utils/calculations'
import { useAtomValue } from 'jotai'
import { addressesAtom, isWethToken0Atom } from '../positions/atoms'
import BigNumber from 'bignumber.js'
import { OSQUEETH_DECIMALS } from '@constants/index'
import { controllerContractAtom, controllerHelperHelperContractAtom, nftManagerContractAtom, quoterContractAtom, squeethPoolContractAtom } from '../contracts/atoms'
import useAppCallback from '@hooks/useAppCallback'
import { addressAtom } from '../wallet/atoms'
import { Contract } from 'web3-eth-contract'
import { useHandleTransaction } from '../wallet/hooks'
import { ethers } from 'ethers'
import { useCallback } from 'react'
import { useGetDebtAmount, useGetVault } from '../controller/hooks'

/*** CONSTANTS ***/
const COLLAT_RATIO_FLASHLOAN = 2
const POOL_FEE = 3000
const MAX_INT_128 = new BigNumber(2).pow(128).minus(1).toFixed(0)
const x96 = new BigNumber(2).pow(96)

/*** ACTIONS ***/

// Opening a mint and LP position and depositing
export const useOpenPositionDeposit = () => {
  const { squeethPool } = useAtomValue(addressesAtom)
  const address = useAtomValue(addressAtom)
  const contract = useAtomValue(controllerHelperHelperContractAtom)
  const handleTransaction = useHandleTransaction()
  const getDebtAmount = useGetDebtAmount()
  const squeethPoolContract = useAtomValue(squeethPoolContractAtom)
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const openPositionDeposit = useAppCallback(
    async (squeethToMint: BigNumber, lowerTickInput: number, upperTickInput: number, vaultId: number, collatRatio: number, slippage: number, withdrawAmount: number, onTxConfirmed?: () => void) => {
      if (!contract || !address || !squeethPoolContract) return null
      
      const mintWSqueethAmount = fromTokenAmount(squeethToMint, OSQUEETH_DECIMALS)
      const ethDebtPromise = getDebtAmount(mintWSqueethAmount)
      const poolStatePromise = getPoolState(squeethPoolContract)

      // Calculate prices from ticks
      const [ethDebt, { tick, tickSpacing }] = await Promise.all([ethDebtPromise, poolStatePromise])
      const lowerTick = nearestUsableTick(lowerTickInput, Number(tickSpacing))
      const upperTick = nearestUsableTick(upperTickInput, Number(tickSpacing))
      const sqrtLowerPrice = new BigNumber(TickMath.getSqrtRatioAtTick(lowerTick).toString()).div(x96)
      const sqrtUpperPrice = new BigNumber(TickMath.getSqrtRatioAtTick(upperTick).toString()).div(x96)
      const squeethPrice = isWethToken0 ? new BigNumber(1).div(new BigNumber(TickMath.getSqrtRatioAtTick(Number(tick)).toString()).div(x96).pow(2))
                                            : new BigNumber(TickMath.getSqrtRatioAtTick(Number(tick)).toString()).div(x96).pow(2)
      const sqrtSqueethPrice = squeethPrice.sqrt()
      const collateralToMint = ethDebt.multipliedBy(collatRatio)

      // Lx = x * (sqrtSqueethPrice * sqrtUpperPrice) / (sqrtUpperPrice - sqrtSqueethPrice)
      // y = Lx * (sqrtSqueethPrice - sqrtLowerPrice)
      const liquidity = mintWSqueethAmount.times(sqrtSqueethPrice.times(sqrtUpperPrice)).div(sqrtUpperPrice.minus(sqrtSqueethPrice))
      const collateralToLp = sqrtUpperPrice.lt(sqrtSqueethPrice) ? liquidity.times(sqrtUpperPrice.minus(sqrtLowerPrice))
                            : sqrtSqueethPrice.lt(sqrtLowerPrice) ? new BigNumber(0)
                            : liquidity.times(sqrtSqueethPrice.minus(sqrtLowerPrice))
      
      const amount0 = isWethToken0 ? collateralToLp : mintWSqueethAmount
      const amount1 = isWethToken0 ? mintWSqueethAmount : collateralToLp
      const amount0Min = amount0.times(new BigNumber(1).minus(slippage)).toFixed(0)
      const amount1Min = amount1.times(new BigNumber(1).minus(slippage)).toFixed(0)

      const collateralToWithdraw =  new BigNumber(withdrawAmount)

      const flashloanWMintDepositNftParams = {
        wPowerPerpPool: squeethPool,
        vaultId: vaultId,
        wPowerPerpAmount: mintWSqueethAmount.toFixed(0),
        collateralToDeposit: collateralToMint.toFixed(0),
        collateralToFlashloan: collateralToMint.toFixed(0),
        collateralToLp: collateralToLp.toFixed(0),
        collateralToWithdraw: collateralToWithdraw.toFixed(0),
        amount0Min,
        amount1Min,
        lowerTick: lowerTick,
        upperTick: upperTick,
      }

      return handleTransaction(
        contract.methods.flashloanWMintLpDepositNft(flashloanWMintDepositNftParams).send({
          from: address,
          value: collateralToLp.plus(collateralToMint).minus(collateralToWithdraw).toFixed(0),
        }),
        onTxConfirmed,
      )
    },
    [address, squeethPool, contract, handleTransaction, getDebtAmount, squeethPoolContract, isWethToken0],
  )

  return openPositionDeposit
}

// Close position with flashloan
export const useClosePosition = () => {
  const address = useAtomValue(addressAtom)
  const controllerHelperContract = useAtomValue(controllerHelperHelperContractAtom)
  const controllerContract = useAtomValue(controllerContractAtom)
  const handleTransaction = useHandleTransaction()
  const getDebtAmount = useGetDebtAmount()
  const getVault = useGetVault()
  const getPosition = useGetPosition()
  const getExactIn = useGetExactIn()
  const getExactOut = useGetExactOut()
  const getDecreaseLiquidity = useGetDecreaseLiquidity()
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const closePosition = useAppCallback(async (vaultId: number, liquidityPercentage: number, burnPercentage: number, collateralToWithdraw: number, burnExactRemoved: boolean, slippage: number, onTxConfirmed?: () => void) => {
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
    const debtInEthPromise = getDebtAmount(shortAmount)

    // Get current LP positions
    const { amount0, amount1 } = await getDecreaseLiquidity(uniTokenId, position.liquidity, 0, 0, Math.floor(Date.now() / 1000 + 86400))
    const wPowerPerpAmountInLP = isWethToken0 ? amount1 : amount0
   
    const amountToLiquidate = new BigNumber(wPowerPerpAmountInLP).times(liquidityPercentage)
    const amountToBurn = shortAmount.times(burnPercentage)
    const limitEthPromise = amountToLiquidate.gt(amountToBurn) ? getExactIn(amountToLiquidate.minus(amountToBurn), true)
                            : getExactOut(amountToBurn.minus(amountToLiquidate), true)
    
    const [debtInEth, limitEth] = await Promise.all([debtInEthPromise, limitEthPromise])
    const limitPrice = new BigNumber(limitEth).div(amountToLiquidate.minus(amountToBurn).abs()).times(new BigNumber(1).minus(slippage))

    const collateralToFlashloan = debtInEth.multipliedBy(COLLAT_RATIO_FLASHLOAN)

    const amount0Min = new BigNumber(amount0).times(liquidityPercentage).times(new BigNumber(1).minus(slippage)).toFixed(0)
    const amount1Min = new BigNumber(amount1).times(liquidityPercentage).times(new BigNumber(1).minus(slippage)).toFixed(0)

    const flashloanCloseVaultLpNftParam = {
      vaultId: vaultId,
      tokenId: uniTokenId,
      liquidity: position.liquidity,
      liquidityPercentage: fromTokenAmount(liquidityPercentage, 18).toFixed(0),
      wPowerPerpAmountToBurn: amountToBurn.toFixed(0),
      collateralToFlashloan: collateralToFlashloan.toFixed(0),
      collateralToWithdraw: collateralToWithdraw.toFixed(0),
      limitPriceEthPerPowerPerp: fromTokenAmount(limitPrice, 18).toFixed(0),
      amount0Min,
      amount1Min,
      poolFee: POOL_FEE,
      burnExactRemoved,
    }

    return handleTransaction(
      await controllerHelperContract.methods.flashloanCloseVaultLpNft(flashloanCloseVaultLpNftParam).send({
        from: address,
      }),
      onTxConfirmed,
    )
  }, [address, controllerHelperContract, controllerContract, handleTransaction, getDebtAmount, getVault, getPosition, getExactIn, getExactOut, getDecreaseLiquidity, isWethToken0])
  return closePosition
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
      !vaultBefore.shortAmount ||
      !uniTokenId
    )
      return

    const shortAmount = fromTokenAmount(vaultBefore.shortAmount, OSQUEETH_DECIMALS)
    const debtInEth = await getDebtAmount(shortAmount)
    const collateralToFlashloan = debtInEth.multipliedBy(COLLAT_RATIO_FLASHLOAN)
    const amount0Max = MAX_INT_128
    const amount1Max = MAX_INT_128
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
  }, [address, controllerHelperContract, controllerContract, handleTransaction, getDebtAmount, getVault])
  return collectFees
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
  const getTwapSqueethPrice = useGetTwapSqueethPrice()
  const squeethPoolContract = useAtomValue(squeethPoolContractAtom)
  const getQuote = useGetQuote()
  const rebalanceGeneralSwap = useAppCallback(
    async (vaultId: number, lowerTickInput: number, upperTickInput: number, onTxConfirmed?: () => void) => {
      const vaultBefore = await getVault(vaultId)
      const uniTokenId = vaultBefore?.NFTCollateralId 
      const position = await getPosition(uniTokenId)
      if (!controllerContract || !controllerHelperContract || !address || !position || !vaultBefore || !squeethPoolContract) return
      const shortAmount = fromTokenAmount(vaultBefore.shortAmount, OSQUEETH_DECIMALS)
      const debtInEth = await getDebtAmount(shortAmount)
      const collateralToFlashloan = debtInEth.multipliedBy(COLLAT_RATIO)

      const amount0Min = new BigNumber(0)
      const amount1Min = new BigNumber(0)

      const lowerTick = nearestUsableTick(lowerTickInput, TICK_SPACE)
      const upperTick = nearestUsableTick(upperTickInput, TICK_SPACE)

      // Get current LP positions
      const { amount0, amount1 } = await getDecreaseLiquidity(uniTokenId, position.liquidity, 0, 0, Math.floor(Date.now() / 1000 + 86400))
      const wPowerPerpAmountInLPBefore = isWethToken0 ? amount1 : amount0
      const wethAmountInLPBefore = isWethToken0 ? amount0 : amount1

      // Calculate prices from ticks
      const sqrtLowerPrice = new BigNumber(TickMath.getSqrtRatioAtTick(lowerTick).toString()).div(x96)
      const sqrtUpperPrice = new BigNumber(TickMath.getSqrtRatioAtTick(upperTick).toString()).div(x96)
      const { sqrtPriceX96 } = await getPoolState(squeethPoolContract)
      const sqrtSqueethPrice = new BigNumber(sqrtPriceX96.toString()).div(x96)
      const squeethPrice = sqrtSqueethPrice.pow(2)

      // Get previous liquidity amount in ETH
      const wPowerPerpAmountInLPBeforeInEth = await getQuote(new BigNumber(wPowerPerpAmountInLPBefore), true)
      const positionEthValue = new BigNumber(wethAmountInLPBefore).plus(new BigNumber(wPowerPerpAmountInLPBeforeInEth))       
      console.log("positionEthValue", positionEthValue.toString())

      let newAmount0, newAmount1, amountIn, wethAmountInLPAfter, wPowerPerpAmountInLPAfter, tokenIn, tokenOut
      if (sqrtUpperPrice.lt(sqrtSqueethPrice)) {
        // All weth position
        // newLiquidity = positionEthValue/(sqrt(upperPrice) - sqrt(lowerPrice))
        const liquidity = positionEthValue.div(sqrtUpperPrice.minus(sqrtLowerPrice))
        // wethAmount = L(sqrt(upperPrice) - sqrt(lowerPrice))
        wethAmountInLPAfter = liquidity.times(sqrtUpperPrice.minus(sqrtLowerPrice))
        wPowerPerpAmountInLPAfter = 0
        amountIn = wPowerPerpAmountInLPBefore
        tokenIn = oSqueeth
        tokenOut = weth
      } else if (sqrtSqueethPrice.lt(sqrtLowerPrice)) {
        // All squeeth position
        // newLiquidity = positionEthValue/(squeethPrice/sqrt(lowerPrice) - squeethPrice/sqrt(upperPrice))
        const liquidity = positionEthValue.div((squeethPrice.div(sqrtLowerPrice)).minus((squeethPrice.div(sqrtUpperPrice))))
        wethAmountInLPAfter = 0
        // wPowerPerpAmount = L/sqrt(lowerPrice) - L/sqrt(upperPrice)
        wPowerPerpAmountInLPAfter = (liquidity.div(sqrtLowerPrice).minus(liquidity.div(sqrtUpperPrice)))
        amountIn = wethAmountInLPBefore
        tokenIn = weth
        tokenOut = oSqueeth
      } else {
        // newLiquidity = positionEthValue/(squeethPrice/sqrt(squeethPrice) - squeethPrice/sqrt(upperPrice) + sqrt(squeethPrice) - sqrt(lowerPrice))
        const liquidity = positionEthValue.div((new BigNumber(squeethPrice).div(sqrtSqueethPrice))
                                                                          .minus((new BigNumber(squeethPrice).div(sqrtUpperPrice)))
                                                                          .plus(sqrtSqueethPrice)
                                                                          .minus(sqrtLowerPrice))
        // Calculate amounts of each asset to LP
        // x = L(sqrt(upperPrice) - sqrt(squeethPrice))) / sqrt(squeethPrice) * sqrt(upperPrice)
        // y = L(sqrt(squeethPrice) - sqrt(lowerPrice))
        newAmount0 = liquidity.times(sqrtUpperPrice.minus(sqrtSqueethPrice)).div((sqrtSqueethPrice.times(sqrtUpperPrice)))
        newAmount1 = liquidity.times(sqrtSqueethPrice.minus(sqrtLowerPrice))
        wethAmountInLPAfter = isWethToken0 ? newAmount0 : newAmount1
        wPowerPerpAmountInLPAfter = isWethToken0 ? newAmount1 : newAmount0
        const needMoreWeth = new BigNumber(wethAmountInLPBefore).lt(new BigNumber(wethAmountInLPAfter))
        const needMoreSqueeth = new BigNumber(wPowerPerpAmountInLPBefore).lt(new BigNumber(wPowerPerpAmountInLPAfter))
        tokenIn = needMoreWeth ? oSqueeth : weth
        tokenOut = needMoreWeth ? weth : oSqueeth
        amountIn = needMoreWeth && !needMoreSqueeth ? new BigNumber(wPowerPerpAmountInLPBefore).minus(new BigNumber(wPowerPerpAmountInLPAfter)).toFixed(0) :
                   needMoreSqueeth && !needMoreWeth ? new BigNumber(wethAmountInLPBefore).minus(new BigNumber(wethAmountInLPAfter)).toFixed(0)
                  : 0
      }

      const abiCoder = new ethers.utils.AbiCoder()
      const liquidatePreviousLP = {
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
      }
      const generalSwap = {
        // Exchange necessary amount of oSQTH and ETH
        rebalanceLpInVaultType: new BigNumber(5).toFixed(0), // GeneralSwap:
        // GeneralSwap: [tokenIn, tokenOut, amountIn, limitPrice]
        data: abiCoder.encode(
          ['address', 'address', 'uint256', 'uint256', 'uint24'],
          [tokenIn, tokenOut, amountIn, 0, POOL_FEE],
        ),
      }
      const mintNewLP = {
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
      }

      const rebalanceLpInVaultParams = amountIn > 0 ? [liquidatePreviousLP, generalSwap, mintNewLP] : [liquidatePreviousLP, mintNewLP]

      return handleTransaction(
        await controllerHelperContract.methods
          .rebalanceLpInVault(vaultId, collateralToFlashloan.toFixed(0), rebalanceLpInVaultParams)
          .send({
            from: address,
          }),
        onTxConfirmed,
      )
    },
    [address, controllerHelperContract, controllerHelper, weth, oSqueeth, squeethPool, controllerContract, handleTransaction, isWethToken0, getDebtAmount, getVault, getDecreaseLiquidity, getPosition, getTwapSqueethPrice, squeethPoolContract],
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

      const decreaseLiquidity = await contract.methods.decreaseLiquidity(DecreaseLiquidityParams).call()

      return decreaseLiquidity
    },
    [contract],
  )

  return getDecreaseLiquiduity
}

export const useGetExactIn = () => {
  const contract = useAtomValue(quoterContractAtom)
  const {weth, oSqueeth} = useAtomValue(addressesAtom)

  const getExactIn = useCallback(
    async (amount: BigNumber, squeethIn: boolean) => {
      if (!contract) return null

      const QuoteExactInputSingleParams = {
        tokenIn: squeethIn ? oSqueeth : weth,
        tokenOut: squeethIn ? weth : oSqueeth,
        amountIn: amount.toFixed(0),
        fee: POOL_FEE,
        sqrtPriceLimitX96: 0
      }

      const quote = await contract.methods.quoteExactInputSingle(QuoteExactInputSingleParams).call()
      return quote.amountOut
    },
    [contract, weth, oSqueeth],
  )

  return getExactIn
}

export const useGetExactOut = () => {
  const contract = useAtomValue(quoterContractAtom)
  const {weth, oSqueeth} = useAtomValue(addressesAtom)

  const getExactOut = useCallback(
    async (amount: BigNumber, squeethOut: boolean) => {
      if (!contract) return null

      const QuoteExactOutputSingleParams = {
        tokenIn: squeethOut ? weth : oSqueeth,
        tokenOut: squeethOut ? oSqueeth : weth,
        amount: amount.toFixed(0),
        fee: POOL_FEE,
        sqrtPriceLimitX96: 0
      }

      const quote = await contract.methods.quoteExactOutputSingle(QuoteExactOutputSingleParams).call()
      return quote.amountIn
    },
    [contract, weth, oSqueeth],
  )

  return getExactOut
}

async function getPoolState(poolContract: Contract) {
  const [slot, liquidity, tickSpacing] = await Promise.all([
    poolContract?.methods.slot0().call(),
    poolContract?.methods.liquidity().call(),
    poolContract.methods.tickSpacing().call()
  ])

  const PoolState = {
    liquidity,
    sqrtPriceX96: slot[0],
    tick: slot[1],
    observationIndex: slot[2],
    observationCardinality: slot[3],
    observationCardinalityNext: slot[4],
    feeProtocol: slot[5],
    unlocked: slot[6],
    tickSpacing
  }

  return PoolState
}