import { Contract } from 'web3-eth-contract'

export async function getPoolState(squeethContract: Contract) {
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
