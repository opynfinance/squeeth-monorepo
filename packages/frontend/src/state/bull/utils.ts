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

  // console.log(
  //   data,
  //   crabToGet.toString(),
  //   bullShare.toString(),
  //   vault.collateralAmount.plus(ethToCrab).toString(),
  //   vault.shortAmount.plus(oSqthToMint).toString(),
  //   totalCrabSupply.toString(),
  // )

  const [wethToLend, usdcToBorrow] = [data[0], data[1]]
  return {
    oSqthToMint,
    wethToLend: toTokenAmount(wethToLend, WETH_DECIMALS),
    usdcToBorrow: toTokenAmount(usdcToBorrow, USDC_DECIMALS),
  }
}

// ToDo: Include fee calculation
const calcWsqueethToMint = (depositEthAmount: BigNumber, strategyDebt: BigNumber, strategyCollat: BigNumber) => {
  return depositEthAmount.times(strategyDebt).div(strategyCollat)
}

const calcCrabToMint = (depositEthAmount: BigNumber, strategyCollat: BigNumber, totalSupply: BigNumber) => {
  const depositorShare = depositEthAmount.div(strategyCollat.plus(depositEthAmount))
  console.log(depositorShare.toString(), totalSupply.toString())

  return totalSupply.times(depositorShare).div(new BigNumber(1).minus(depositorShare))
}
