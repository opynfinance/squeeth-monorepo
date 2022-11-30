import {
    BullStrategyWithdraw,
    BullStrategyDeposit,
    SetCap,
    RedeemCrabAndWithdrawEth,
    SetShutdownContract,
    ShutdownRepayAndWithdraw,
    Farm,
    DepositEthIntoCrab,
    BullStrategyWithdrawShutdown,
    AuctionRepayAndWithdrawFromLeverage,
    SetAuction
} from "../generated/BullStrategy/BullStrategy"
import {
    SetCrUpperAndLower,
    SetDeltaUpperAndLower,
    LeverageRebalance,
    FullRebalance,
    SetFullRebalanceClearingPriceTolerance,
    SetRebalanceWethLimitPriceTolerance,
    SetAuctionManager
} from "../generated/AuctionBull/AuctionBull"
import {
    FlashWithdraw,
    FlashDeposit,
} from "../generated/FlashBull/FlashBull"
import { BigInt, Bytes, ethereum, json, log } from "@graphprotocol/graph-ts"
import {
    CrabHedgeTimeThreshold,
    ExecuteTimeLockTx,
    HedgeOTC as HedgeOTCSchema,
    HedgeOTCSingle as HedgeOTCSingleSchema,
    SetHedgingTwapPeriod as SetHedgingTwapPeriodSchema,
    SetAddress as SetAddressSchema,
    SetStrategyCap as SetStrategyCapSchema,
    SetHedgePriceThreshold as SetHedgePriceThresholdSchema,
    TimeLockTx,
    SetOTCPriceTolerance as SetOTCPriceToleranceSchema,
    VaultTransferred as VaultTransferredSchema,
    BullUserTx as BullUserTxSchema,
    BullUserTx,
    Strategy,
    Vault,
} from "../generated/schema"
import { GOERLI_BULL_STRATEGY_ADDR, GOERLI_AUCTION_BULL_ADDR, GOERLI_FLASH_BULL_ADDR } from "./constants";
  
function loadOrCreateTx(id: string): BullUserTxSchema {
  let userTx = BullUserTx.load(id)
  if (userTx) return userTx

  userTx = new BullUserTx(id)
  userTx.owner = Bytes.empty()
  userTx.user = Bytes.empty()
  userTx.ethAmount = BigInt.zero()
  userTx.type = "TRANSFER"
  userTx.timestamp = BigInt.zero()

  return userTx
}

function loadOrCreateStrategy(id: string): Strategy {
  let strategy = Strategy.load(id)
  if (strategy) return strategy

  strategy =  new Strategy(id)
  strategy.totalSupply = BigInt.zero()
  return strategy
}

export function handleWithdraw(event: BullStrategyWithdraw): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.wSqueethAmount = event.params.wPowerPerpToRedeem
  userTx.bullAmount = event.params.bullAmount
  userTx.ethAmount = event.params.wethToWithdraw
  userTx.crabAmount = event.params.crabToRedeem
  userTx.user = event.params.to
  userTx.wethLentAmount = event.params.wethToWithdraw
  userTx.usdcBorrowedAmount = event.params.usdcToRepay
  userTx.owner = event.transaction.from
  userTx.type = 'WITHDRAW'
  userTx.timestamp = event.block.timestamp
  userTx.save()
}

export function handleSetCap(event: BullStrategyDeposit): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.ethAmount = event.transaction.value
  userTx.crabAmount = event.params.crabAmount
  userTx.user = event.params.from
  userTx.wethLentAmount = event.params.wethLent
  userTx.usdcBorrowedAmount = event.params.usdcBorrowed
  userTx.owner = event.transaction.from
  userTx.type = 'WITHDRAW'
  userTx.timestamp = event.block.timestamp
  userTx.save()
}

export function handleDeposit(event: BullStrategyDeposit): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.ethAmount = event.transaction.value
  userTx.crabAmount = event.params.crabAmount
  userTx.user = event.params.from
  userTx.wethLentAmount = event.params.wethLent
  userTx.usdcBorrowedAmount = event.params.usdcBorrowed
  userTx.owner = event.transaction.from
  userTx.type = 'DEPOSIT'
  userTx.timestamp = event.block.timestamp
  userTx.save()
}

export function handleSetStrategyCap(event: SetCap): void {
  const cap = new SetStrategyCapSchema(event.transaction.hash.toHex());
  cap.cap = event.params.newCap;
  cap.timestamp = event.block.timestamp;
  cap.save();
}

export function handleRedeemCrabAndWithdrawEth(event: RedeemCrabAndWithdrawEth): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.ethAmount = event.params.wethBalanceReturned
  userTx.wSqueethAmount = event.params.wPowerPerpRedeemed
  userTx.crabAmount = event.params.crabToRedeem
  userTx.user = event.transaction.from
  userTx.owner = event.transaction.from
  userTx.type = 'REDEEM_CRAB_AND_WITHDRAW_ETH'
  userTx.timestamp = event.block.timestamp
  userTx.save()
}

export function handleSetShutdownContract(event: SetShutdownContract): void {
  const shutdownContract = new SetAddressSchema(event.transaction.hash.toHex());
  shutdownContract.oldAddress = event.params.oldShutdownContract;
  shutdownContract.newAddress = event.params.newShutdownContract;
  shutdownContract.timestamp = event.block.timestamp;
  shutdownContract.save();
}

export function handleShutdownRepayAndWithdraw(event: ShutdownRepayAndWithdraw): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.ethAmount = event.transaction.value
  userTx.crabAmount = event.params.crabToRedeem
  userTx.user = event.transaction.from
  userTx.bullAmount = event.params.shareToUnwind
  userTx.owner = event.transaction.from
  userTx.type = 'SHUTDOWN_REPAY_AND_WITHDRAW'
  userTx.timestamp = event.block.timestamp
  userTx.save()
}

export function handleFarm(event: Farm): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.erc20Token = String(event.params.asset)
  userTx.user = event.params.receiver
  userTx.owner = event.transaction.from
}

export function handleDepositEthIntoCrab(event: DepositEthIntoCrab): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.ethAmount = event.params.ethToDeposit
  userTx.user = event.transaction.from
  userTx.owner = event.transaction.from
  userTx.type = 'DEPOSIT_ETH_INTO_CRAB'
  userTx.timestamp = event.block.timestamp
  userTx.save()
}

export function handleWithdrawShutdown(event: BullStrategyWithdrawShutdown): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.ethAmount = event.params.ethToReceive
  userTx.user = event.params.withdrawer
  userTx.bullAmount = event.params.bullAmount
  userTx.owner = event.transaction.from
  userTx.type = 'WITHDRAW_SHUTDOWN'
  userTx.timestamp = event.block.timestamp
  userTx.save()
}