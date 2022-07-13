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
import { useGetDebtAmount, useGetTwapSqueethPrice, useGetVault } from '../controller/hooks'

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
  const getQuote = useGetQuote()
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
    const limitEth = await getQuote(shortAmount, true)

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
  }, [address, controllerHelperContract, controllerContract, handleTransaction, getDebtAmount, getVault, getPosition, getQuote])
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
      const mintWSqueethAmount = fromTokenAmount(squeethToMint, OSQUEETH_DECIMALS)
      const ethDebt = await getDebtAmount(mintWSqueethAmount)

      const collateralToMint = ethDebt.multipliedBy(3).div(2)
      const collateralToLp = mintWSqueethAmount.multipliedBy(squeethPrice)

      const lowerTick = nearestUsableTick(lowerTickInput, 60)
      const upperTick = nearestUsableTick(upperTickInput, 60)

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
    [address, squeethPool, contract, handleTransaction, getTwapSqueethPrice, getDebtAmount],
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
    const amount0Max = new BigNumber(2).pow(128).minus(1).toFixed(0)
    const amount1Max = new BigNumber(2).pow(128).minus(1).toFixed(0)
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
      const collateralToFlashloan = debtInEth.multipliedBy(1.5)

      const amount0Min = new BigNumber(0)
      const amount1Min = new BigNumber(0)

      const lowerTick = nearestUsableTick(lowerTickInput, 60)
      const upperTick = nearestUsableTick(upperTickInput, 60)

      // Get current LP positions
      const { amount0, amount1 } = await getDecreaseLiquidity(uniTokenId, position.liquidity, 0, 0, Math.floor(Date.now() / 1000 + 86400))
      const wPowerPerpAmountInLPBefore = isWethToken0 ? amount1 : amount0
      const wethAmountInLPBefore = isWethToken0 ? amount0 : amount1
      const x96 = new BigNumber(2).pow(96)

      // Calculate prices from ticks
      const sqrtLowerPrice = new BigNumber(TickMath.getSqrtRatioAtTick(lowerTick).toString()).div(x96)
      const sqrtUpperPrice = new BigNumber(TickMath.getSqrtRatioAtTick(upperTick).toString()).div(x96)
      console.log(sqrtUpperPrice.toString())
      const lowerPrice =  sqrtLowerPrice.pow(2)
      const upperPrice = sqrtUpperPrice.pow(2)
      console.log("upperPrice", upperPrice.toString())
      const { sqrtPriceX96 } = await getPoolState(squeethPoolContract)
      const sqrtSqueethPrice = new BigNumber(sqrtPriceX96.toString()).div(x96)
      const squeethPrice = await getTwapSqueethPrice()

      let newAmount0, newAmount1, amountIn, wethAmountInLPAfter, wPowerPerpAmountInLPAfter, needMoreWeth, tokenIn, tokenOut
      if (sqrtUpperPrice.lt(sqrtSqueethPrice)) {
        console.log("case 1")
        // All weth position
        // newLiquidity = positionEthValue/(upperPrice/sqrt(upperPrice) - upperPrice/sqrt(upperPrice) + sqrt(upperPrice)-sqrt(lowerPrice))
        const wPowerPerpAmountInLPBeforeInEth = await getQuote(new BigNumber(wPowerPerpAmountInLPBefore), true)
        const positionEthValue = new BigNumber(wethAmountInLPBefore).plus(new BigNumber(wPowerPerpAmountInLPBeforeInEth))
        wPowerPerpAmountInLPAfter = 0
        const liquidity = positionEthValue.div((upperPrice.div(sqrtUpperPrice))
                                                          .minus(upperPrice.div(sqrtUpperPrice))
                                                          .plus(sqrtUpperPrice)
                                                          .minus(sqrtLowerPrice))
        wethAmountInLPAfter = liquidity.times(sqrtUpperPrice.minus(sqrtLowerPrice))
        amountIn = wPowerPerpAmountInLPBefore
        tokenIn = oSqueeth
        tokenOut = weth
      } else if (sqrtSqueethPrice.lt(sqrtLowerPrice)) {
        console.log("case 2")
        // All squeeth position
        console.log("beep")
        wethAmountInLPAfter = 0
        const squeethAmountOut = await getQuote(new BigNumber(wethAmountInLPBefore), false)
        wPowerPerpAmountInLPAfter = new BigNumber(squeethAmountOut).plus(wPowerPerpAmountInLPBefore)
        amountIn = wethAmountInLPBefore
        tokenIn = weth
        tokenOut = oSqueeth
      } else {
        console.log("case 3")
        // Get previous liquidity ammount in ETH
        const wPowerPerpAmountInLPBeforeInEth = await getQuote(new BigNumber(wPowerPerpAmountInLPBefore), true)
        const positionEthValue = new BigNumber(wethAmountInLPBefore).plus(new BigNumber(wPowerPerpAmountInLPBeforeInEth))
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
        needMoreWeth = new BigNumber(wethAmountInLPBefore).lt(new BigNumber(wethAmountInLPAfter))
        tokenIn = needMoreWeth ? oSqueeth : weth
        tokenOut = needMoreWeth ? weth : oSqueeth
        amountIn = needMoreWeth ? new BigNumber(wPowerPerpAmountInLPAfter).minus(new BigNumber(wPowerPerpAmountInLPBefore)).toFixed(0)
        : new BigNumber(wethAmountInLPBefore).minus(new BigNumber(wethAmountInLPAfter)).toFixed(0)
      }

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


export const useGetQuote = () => {
  const contract = useAtomValue(quoterContractAtom)
  const {weth, oSqueeth} = useAtomValue(addressesAtom)

  const getQuote = useCallback(
    async (amount: BigNumber, squeethIn: boolean) => {
      if (!contract) return null

      const QuoteExactInputSingleParams = {
        tokenIn: squeethIn ? oSqueeth : weth,
        tokenOut: squeethIn ? weth : oSqueeth,
        amountIn: amount.toFixed(0),
        fee: 3000,
        sqrtPriceLimitX96: 0
      }

      const quote = await contract.methods.quoteExactInputSingle(QuoteExactInputSingleParams).call()
      return quote.amountOut
    },
    [contract, weth, oSqueeth],
  )

  return getQuote
}

async function getPoolState(squeethContract: Contract) {
  const [slot, liquidity] = await Promise.all([
    squeethContract?.methods.slot0().call(),
    squeethContract?.methods.liquidity().call(),
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
  }

  return PoolState
}