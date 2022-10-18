import { Address, BigInt, log } from "@graphprotocol/graph-ts"
import {
  CrabStrategy,
  Deposit,
  Withdraw,
  FlashDeposit,
  FlashWithdraw,
  Transfer,
  HedgeOnUniswap,
  Hedge,
  FlashDepositCallback,
  FlashWithdrawCallback,
  ExecuteSellAuction,
  ExecuteBuyAuction
} from "../generated/CrabStrategy/CrabStrategy"
import { CrabStrategyV2 } from "../generated/CrabStrategyV2/CrabStrategyV2"
import { CrabAuction, CrabStrategyTx, Strategy } from "../generated/schema"
import { CRAB_V1_ADDR } from "./constants"

function loadOrCreateTx(id: string): CrabStrategyTx {
  let strategy = CrabStrategyTx.load(id)
  if (strategy) return strategy

  strategy = new CrabStrategyTx(id)
  strategy.type = "Transfer"
  strategy.lpAmount = BigInt.zero()
  strategy.ethAmount = BigInt.zero()
  strategy.timestamp = BigInt.zero()
  return strategy
}

function loadOrCreateStrategy(id: string): Strategy {
  let strategy = Strategy.load(id)
  if (strategy) return strategy

  strategy =  new Strategy(id)
  strategy.totalSupply = BigInt.zero()
  return strategy
}

export function handleDeposit(event: Deposit): void {
  const strategyTx = loadOrCreateTx(event.transaction.hash.toHex())
  strategyTx.wSqueethAmount = event.params.wSqueethAmount
  strategyTx.lpAmount = event.params.lpAmount
  strategyTx.ethAmount = event.transaction.value
  strategyTx.owner = event.transaction.from
  strategyTx.timestamp = event.block.timestamp
  strategyTx.type = 'DEPOSIT'
  strategyTx.save()
}

export function handleWithdraw(event: Withdraw): void {
  const strategyTx = loadOrCreateTx(event.transaction.hash.toHex())
  strategyTx.wSqueethAmount = event.params.wSqueethAmount
  strategyTx.lpAmount = event.params.crabAmount
  strategyTx.ethAmount = event.params.ethWithdrawn
  strategyTx.owner = event.transaction.from
  strategyTx.timestamp = event.block.timestamp
  strategyTx.type = 'WITHDRAW'
  strategyTx.save()
}

export function handleFlashDeposit(event: FlashDeposit): void {
  const strategyTx = loadOrCreateTx(event.transaction.hash.toHex())
  strategyTx.wSqueethAmount = event.params.tradedAmountOut
  strategyTx.ethAmount = (strategyTx.ethAmount !== null ? strategyTx.ethAmount : BigInt.fromString('0')).plus(event.transaction.value)
  strategyTx.owner = event.transaction.from
  strategyTx.timestamp = event.block.timestamp
  strategyTx.type = 'FLASH_DEPOSIT'
  strategyTx.save()
}

export function handleFlashWithdraw(event: FlashWithdraw): void {
  const strategyTx = loadOrCreateTx(event.transaction.hash.toHex())
  strategyTx.wSqueethAmount = event.params.wSqueethAmount
  strategyTx.lpAmount = event.params.crabAmount
  strategyTx.owner = event.transaction.from
  strategyTx.timestamp = event.block.timestamp
  strategyTx.type = 'FLASH_WITHDRAW'
  strategyTx.save()
}

export function handleHedgeOnUniswap(event: HedgeOnUniswap): void {
  const strategyTx = loadOrCreateTx(event.transaction.hash.toHex())
  strategyTx.type = 'HEDGE_ON_UNISWAP'
  strategyTx.wSqueethHedgeTargetAmount = event.params.wSqueethHedgeTargetAmount
  strategyTx.ethHedgeTargetAmount = event.params.ethHedgetargetAmount
  strategyTx.auctionPrice = event.params.auctionPrice
  strategyTx.isSellingSqueeth = event.params.auctionType
  strategyTx.owner = event.params.hedger
  strategyTx.timestamp = event.block.timestamp
  strategyTx.save()
}

export function handleHedge(event: Hedge): void {
  const strategyTx = loadOrCreateTx(event.transaction.hash.toHex())
  strategyTx.type = 'HEDGE'
  strategyTx.wSqueethHedgeTargetAmount = event.params.wSqueethHedgeTargetAmount
  strategyTx.ethHedgeTargetAmount = event.params.ethHedgetargetAmount
  strategyTx.auctionPrice = event.params.auctionPrice
  strategyTx.isSellingSqueeth = event.params.auctionType
  strategyTx.hedgerPrice = event.params.hedgerPrice
  strategyTx.owner = event.params.hedger
  strategyTx.timestamp = event.block.timestamp
  strategyTx.save()
}

export function handleFlashDepositCallback(event: FlashDepositCallback): void {
  const strategyTx = loadOrCreateTx(event.transaction.hash.toHex())
  strategyTx.ethAmount = ((strategyTx.ethAmount !== null ? strategyTx.ethAmount : BigInt.fromString('0')) as BigInt).minus(event.params.excess)
  strategyTx.save()
}

export function handleFlashWithdrawCallback(event: FlashWithdrawCallback): void {
  const strategyTx = loadOrCreateTx(event.transaction.hash.toHex())
  strategyTx.ethAmount = event.params.excess
  strategyTx.save()
}

export function handleTransfer(event: Transfer): void {
  const strategyTx = loadOrCreateTx(event.transaction.hash.toHex())
  const strategy = loadOrCreateStrategy(CRAB_V1_ADDR.toHex())

  let contract = CrabStrategy.bind(event.address)
  const vaultId = contract.vaultId()
  strategy.vaultId = vaultId


  // Minting token
  if (event.params.from.toHex().toLowerCase() == '0x0000000000000000000000000000000000000000') {
    strategyTx.lpAmount = event.params.value
    strategyTx.save()
    strategy.totalSupply = strategy.totalSupply.plus(event.params.value)
    strategy.save()
  }
  // Burning token
  if (event.params.to.toHex().toLowerCase() == '0x0000000000000000000000000000000000000000') {
    strategy.totalSupply = strategy.totalSupply.minus(event.params.value)
    strategy.save()
  }
}

export function handleExecuteSellAuction(event: ExecuteSellAuction): void {
  const auction = new CrabAuction(event.transaction.hash.toHex())
  auction.ethAmount = event.params.ethBought
  auction.squeethAmount = event.params.wSqueethSold
  auction.isSellingSqueeth = true
  auction.isHedgingOnUniswap = event.params.isHedgingOnUniswap
  auction.timestamp = event.block.timestamp
  auction.owner = event.transaction.from
  auction.save()
}

export function handleExecuteBuyAuction(event: ExecuteBuyAuction): void {
  const auction = new CrabAuction(event.transaction.hash.toHex())
  auction.ethAmount = event.params.ethSold
  auction.squeethAmount = event.params.wSqueethBought
  auction.isSellingSqueeth = false
  auction.isHedgingOnUniswap = event.params.isHedgingOnUniswap
  auction.timestamp = event.block.timestamp
  auction.owner = event.transaction.from
  auction.save()
}