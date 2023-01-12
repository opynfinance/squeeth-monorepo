import {
    Withdraw,
    Deposit,
    SetCap,
    RedeemCrabAndWithdrawEth,
    SetShutdownContract,
    ShutdownRepayAndWithdraw,
    Farm,
    DepositEthIntoCrab,
    WithdrawShutdown,
    AuctionRepayAndWithdrawFromLeverage,
    SetAuction,
    Transfer
} from "../generated/ZenBullStrategy/ZenBullStrategy"
import {
    SetCrUpperAndLower,
    SetDeltaUpperAndLower,
    LeverageRebalance,
    FullRebalance,
    SetFullRebalanceClearingPriceTolerance,
    SetRebalanceWethLimitPriceTolerance,
    SetAuctionManager
} from "../generated/ZenAuction/ZenAuction"
import {
    FlashWithdraw,
    FlashDeposit,
} from "../generated/FlashZen/FlashZen"
import {
    SetAddress as SetAddressSchema,
    SetUpperLower as SetUpperLowerSchema,
    LeverageRebalance as LeverageRebalanceSchema,
    SetStrategyCap as SetStrategyCapSchema,
    SetParams as SetParamsSchema,
    BullUserTx as BullUserTxSchema,
    BullUserTx,
    Strategy,
    FullRebalance as FullRebalanceSchema
} from "../generated/schema"
import * as WETH9 from "../generated/Weth/Weth"
import { Address, BigInt, ByteArray, Bytes, ethereum, log } from "@graphprotocol/graph-ts"
import { loadOrCreateStrategy } from "./util"
import { AUCTION_BULL, FLASH_BULL_ADDR, WETH } from "./constants"

export function loadOrCreateTx(id: string): BullUserTxSchema {
  let userTx = BullUserTx.load(id)
  if (userTx) return userTx

  userTx = new BullUserTx(id)
  userTx.owner = Bytes.empty()
  userTx.user = Bytes.empty()
  userTx.ethAmount = BigInt.zero()
  userTx.type = "TRANSFER"
  userTx.timestamp = BigInt.zero()
  userTx.bullAmount = BigInt.zero()
  userTx.wSqueethAmount = BigInt.zero()
  userTx.wethLentAmount = BigInt.zero()
  userTx.usdcBorrowedAmount = BigInt.zero()

  return userTx
}

export function handleWithdraw(event: Withdraw): void {
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

export function handleSetCap(event: SetCap): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.ethAmount = event.params.newCap
  userTx.type = 'SET_CAP'
  userTx.timestamp = event.block.timestamp
  userTx.save()
}

export function handleDeposit(event: Deposit): void {
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

export function handleSetAuction(event: SetAuction): void {
  const shutdownContract = new SetAddressSchema(event.transaction.hash.toHex());
  shutdownContract.oldAddress = event.params.oldAuction;
  shutdownContract.newAddress = event.params.newAuction;
  shutdownContract.timestamp = event.block.timestamp;
  shutdownContract.save();
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
  userTx.erc20Token = event.params.asset.toHex()
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

export function handleWithdrawShutdown(event: WithdrawShutdown): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.ethAmount = event.params.ethToReceive
  userTx.user = event.params.withdrawer
  userTx.bullAmount = event.params.bullAmount
  userTx.owner = event.transaction.from
  userTx.type = 'WITHDRAW_SHUTDOWN'
  userTx.timestamp = event.block.timestamp
  userTx.save()
}

export function handleAuctionRepayAndWithdrawFromLeverage(event: AuctionRepayAndWithdrawFromLeverage): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.ethAmount = event.params.wethToWithdraw
  userTx.usdcBorrowedAmount = event.params.usdcToRepay
  userTx.user = event.transaction.from
  userTx.owner = event.transaction.from
  userTx.type = 'AUCTION_REPAY_AND_WITHDRAW_FROM_LEVERAGE'
  userTx.timestamp = event.block.timestamp
  userTx.save()

}

export function handleSetCrUpperAndLower(event: SetCrUpperAndLower): void {
  const params = new SetUpperLowerSchema(event.transaction.hash.toHex());
  params.oldLower = event.params.oldCrLower
  params.oldUpper = event.params.oldCrUpper
  params.newLower = event.params.newCrLower
  params.newUpper = event.params.newCrUpper
  params.save()
}

export function handleSetDeltaUpperAndLower(event: SetDeltaUpperAndLower): void {
  const params = new SetUpperLowerSchema(event.transaction.hash.toHex());
  params.oldLower = event.params.oldDeltaLower
  params.oldUpper = event.params.oldDeltaUpper
  params.newLower = event.params.newDeltaLower
  params.newUpper = event.params.newDeltaUpper
  params.save()
}

export function handleLeverageRebalance(event: LeverageRebalance): void { 
  const rebalance = new LeverageRebalanceSchema(event.transaction.hash.toHex());
  rebalance.isSellingUsdc = event.params.isSellingUsdc
  rebalance.usdcAmount = event.params.usdcAmount
  rebalance.wethLimitAmount = event.params.wethLimitAmount
  rebalance.timestamp = event.block.timestamp
  rebalance.save()

  const strategy = loadOrCreateStrategy(AUCTION_BULL.toHex())
  strategy.lastHedgeTimestamp = event.block.timestamp
  strategy.lastHedgeTx = event.transaction.hash.toHex()
  strategy.save()
}

export function handleSetFullRebalanceClearingPriceTolerance(event: SetFullRebalanceClearingPriceTolerance): void {
  const params = new SetParamsSchema(event.transaction.hash.toHex());
  params.oldValue = event.params.oldPriceTolerance
  params.newValue = event.params.newPriceTolerance
  params.save()
}

export function handleSetRebalanceWethLimitPriceTolerance(event: SetRebalanceWethLimitPriceTolerance): void {
  const params = new SetParamsSchema(event.transaction.hash.toHex());
  params.oldValue = event.params.oldWethLimitPriceTolerance
  params.newValue = event.params.newWethLimitPriceTolerance
  params.save()
}

export function handleSetAuctionManager(event: SetAuctionManager): void {
  const shutdownContract = new SetAddressSchema(event.transaction.hash.toHex());
  shutdownContract.oldAddress = event.params.oldAuctionManager;
  shutdownContract.newAddress = event.params.newAuctionManager;
  shutdownContract.timestamp = event.block.timestamp;
  shutdownContract.save();
}

export function handleFullRebalance(event: FullRebalance): void { 
  const rebalance = new FullRebalanceSchema(event.transaction.hash.toHex());
  rebalance.crabAmount = event.params.crabAmount
  rebalance.clearingPrice = event.params.clearingPrice
  rebalance.wPowerPerpAmount = event.params.wPowerPerpAmount
  rebalance.wethTargetInEuler = event.params.wethTargetInEuler
  rebalance.isDepositingInCrab = event.params.isDepositingInCrab
  rebalance.timestamp = event.block.timestamp
  rebalance.save()

  const strategy = loadOrCreateStrategy(AUCTION_BULL.toHex())
  strategy.lastHedgeTimestamp = event.block.timestamp
  strategy.lastHedgeTx = event.transaction.hash.toHex()
  strategy.save()
}

export function handleFlashDeposit(event: FlashDeposit): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.ethAmount = findFlashBullEthDeposited(event)
  userTx.crabAmount = event.params.crabAmount
  userTx.user = event.transaction.from
  userTx.wethLentAmount = event.params.wethToLend
  userTx.usdcBorrowedAmount = event.params.usdcToBorrow
  userTx.owner = event.transaction.from
  userTx.type = 'FLASH_DEPOSIT'
  userTx.timestamp = event.block.timestamp
  userTx.save()
}

export function handleFlashWithdraw(event: FlashWithdraw): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.bullAmount = event.params.bullAmount
  userTx.ethAmount = event.params.ethReturned
  userTx.user = event.transaction.from
  userTx.owner = event.transaction.from
  userTx.type = 'FLASH_WITHDRAW'
  userTx.timestamp = event.block.timestamp
  userTx.save()
}

export function handleTransfer(event: Transfer): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.bullAmount = event.params.value
  userTx.save()
}

function findFlashBullEthDeposited(event: FlashDeposit): BigInt {
  let returnedAmount = event.params.ethDeposited
  if (!event.receipt) return returnedAmount

  const allEvents = (event.receipt as ethereum.TransactionReceipt).logs as Array<ethereum.Log>
  if (!allEvents) return returnedAmount

  for (let i = 0; i < allEvents.length; i++) {
    const e = allEvents[i]
    if (!e) continue

    if (e.topics[0].toHexString().toLowerCase() == '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'.toLowerCase() && WETH.equals(e.address)) { // Transfer event (should add)
      const dec = ethereum.decode('(uint256)', Bytes.fromHexString(e.data.toHexString()))
      const dec2 = ethereum.decode('(address)', Bytes.fromHexString(e.topics[2].toHexString()))
      if (dec2) {
        const decodedTopics = dec2.toTuple()
        if (dec && FLASH_BULL_ADDR.equals(decodedTopics[0].toAddress())) { // If the event is a transfer to the flash bull
          const decoded = dec.toTuple()
          returnedAmount = returnedAmount.plus(decoded[0].toBigInt())
        }
      }
    } else if (e.topics[0].toHexString() == '0x3ca13b7aab12bad7472691fe558faa6b25e99099824a0070a88bd5aa84be610f') { // Deposit colat (should subtract)
      const dec = ethereum.decode('(address,uint256,uint256)', Bytes.fromHexString(e.data.toHexString()))
      if (dec) {
        const decoded = dec.toTuple()
        returnedAmount = returnedAmount.minus(decoded[2].toBigInt())
      }
    } else if (e.topics[0].toHexString() == '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c') { // Wrap deposit event (should subtract)
      const dec = ethereum.decode('(uint256)', Bytes.fromHexString(e.data.toHexString()))
      if (dec) {
        const decoded = dec.toTuple()
        returnedAmount = returnedAmount.minus(decoded[0].toBigInt())
      }
    }
  }

  return event.params.ethDeposited.minus(returnedAmount)
}
