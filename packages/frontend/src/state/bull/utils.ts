import { Vault } from '../../types'
import BigNumber from 'bignumber.js'
import { Contract } from 'web3-eth-contract'
import { fromTokenAmount, toTokenAmount } from '@utils/calculations'
import { BIG_ZERO, USDC_DECIMALS, WETH_DECIMALS } from '@constants/index'

export const getWethToLendFromCrabEth = async (
  bullStrategy: Contract,
  ethToCrab: BigNumber,
  vault: Vault,
  totalCrabSupply: BigNumber,
  bullCrabBalance: BigNumber,
  bullSupply: BigNumber,
) => {
  const oSqthToMint = calcWsqueethToMint(ethToCrab, vault.shortAmount, vault.collateralAmount)
  const crabToGet = calcCrabToMint(ethToCrab, vault.collateralAmount, totalCrabSupply)
  const bullShare = bullSupply.isZero() ? new BigNumber(1) : crabToGet.div(bullCrabBalance.plus(crabToGet))
  const data = await bullStrategy.methods
    .calcLeverageEthUsdc(
      fromTokenAmount(crabToGet, 18).toFixed(0),
      fromTokenAmount(bullShare, 18).toFixed(0),
      fromTokenAmount(vault.collateralAmount.plus(ethToCrab), 18).toFixed(0),
      fromTokenAmount(vault.shortAmount.plus(oSqthToMint), 18).toFixed(0),
      fromTokenAmount(totalCrabSupply.plus(crabToGet), 18).toFixed(0),
    )
    .call()

  const [wethToLend, usdcToBorrow] = [data[0], data[1]]
  return {
    oSqthToMint,
    wethToLend: toTokenAmount(wethToLend, WETH_DECIMALS),
    usdcToBorrow: toTokenAmount(usdcToBorrow, USDC_DECIMALS),
  }
}

export const calcAssetNeededForFlashWithdraw = async (
  bullStrategy: Contract,
  bullAmount: BigNumber,
  vault: Vault,
  bullSupply: BigNumber,
  bullCrabBalance: BigNumber,
  totalCrabSupply: BigNumber,
) => {
  const bullShare = bullAmount.div(bullSupply)
  const crabToRedeem = bullShare.times(bullCrabBalance)
  const wPowerPerpToRedeem = crabToRedeem.times(vault.shortAmount).div(totalCrabSupply)
  const ethToWithdraw = crabToRedeem.times(vault.collateralAmount).div(totalCrabSupply)
  const usdcToRepay = toTokenAmount(
    await bullStrategy.methods.calcUsdcToRepay(fromTokenAmount(bullShare, 18).toFixed(0)).call(),
    USDC_DECIMALS,
  )

  return { crabToRedeem, wPowerPerpToRedeem, ethToWithdraw, usdcToRepay }
}

// ToDo: Include fee calculation
const calcWsqueethToMint = (depositEthAmount: BigNumber, strategyDebt: BigNumber, strategyCollat: BigNumber) => {
  return depositEthAmount.times(strategyDebt).div(strategyCollat)
}

const calcCrabToMint = (depositEthAmount: BigNumber, strategyCollat: BigNumber, totalSupply: BigNumber) => {
  const depositorShare = depositEthAmount.div(strategyCollat.plus(depositEthAmount))

  return totalSupply.times(depositorShare).div(new BigNumber(1).minus(depositorShare))
}

// https://docs.euler.finance/developers/numeric-limits#interestrate
export const getEulerInterestRate = (apy: BigNumber) => {
  return apy.div(new BigNumber(10).pow(27))
}
