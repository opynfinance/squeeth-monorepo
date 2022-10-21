import {
  SetHedgePriceThreshold,
  SetHedgeTimeThreshold,
  HedgeOTC,
  HedgeOTCSingle,
  SetStrategyCap,
  SetHedgingTwapPeriod,
  SetOTCPriceTolerance,
  VaultTransferred,
  Deposit,
  Withdraw,
  WithdrawShutdown,
  FlashDeposit,
  FlashWithdraw,
  FlashDepositCallback,
  FlashWithdrawCallback,
  Transfer,
  CrabStrategyV2
} from "../generated/CrabStrategyV2/CrabStrategyV2"
import { BigInt, Bytes, ethereum, json, log } from "@graphprotocol/graph-ts"

import { QueueTransaction } from "../generated/Timelock/Timelock";
import { FlashDepositERC20, FlashWithdrawERC20 } from "../generated/CrabHelper/CrabHelper";

import {
  CrabHedgeTimeThreshold,
  ExecuteTimeLockTx,
  HedgeOTC as HedgeOTCSchema,
  HedgeOTCSingle as HedgeOTCSingleSchema,
  SetHedgingTwapPeriod as SetHedgingTwapPeriodSchema,
  SetStrategyCap as SetStrategyCapSchema,
  SetHedgePriceThreshold as SetHedgePriceThresholdSchema,
  TimeLockTx,
  SetOTCPriceTolerance as SetOTCPriceToleranceSchema,
  VaultTransferred as VaultTransferredSchema,
  CrabUserTx as CrabUserTxSchema,
  CrabUserTx,
  Strategy,
  Vault,
} from "../generated/schema"
import { ClaimV2Shares, DepositV1Shares } from "../generated/CrabMigration/CrabMigration";
import { CRAB_MIGRATION_ADDR, CRAB_V1_ADDR, CRAB_V2_ADDR } from "./constants";

function loadOrCreateTx(id: string): CrabUserTxSchema {
  let userTx = CrabUserTx.load(id)
  if (userTx) return userTx

  userTx = new CrabUserTx(id)
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

export function handleDeposit(event: Deposit): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.wSqueethAmount = event.params.wSqueethAmount
  userTx.lpAmount = event.params.lpAmount
  userTx.ethAmount = event.transaction.value
  userTx.user = event.params.depositor
  userTx.owner = event.transaction.from
  userTx.type = 'DEPOSIT'
  userTx.timestamp = event.block.timestamp
  userTx.save()
}

export function handleWithdraw(event: Withdraw): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.wSqueethAmount = event.params.wSqueethAmount
  userTx.lpAmount = event.params.crabAmount
  userTx.ethAmount = event.params.ethWithdrawn
  userTx.user = event.params.withdrawer
  userTx.owner = event.transaction.from
  userTx.type = 'WITHDRAW'
  userTx.timestamp = event.block.timestamp
  userTx.save()
}

export function handleWithdrawShutdown(event: WithdrawShutdown): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.lpAmount = event.params.crabAmount
  userTx.ethAmount = event.params.ethWithdrawn
  userTx.user = event.params.withdrawer
  userTx.owner = event.transaction.from
  userTx.type = 'WITHDRAW_SHUTDOWN'
  userTx.timestamp = event.block.timestamp
  userTx.save()
}

export function handleFlashDeposit(event: FlashDeposit): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.wSqueethAmount = event.params.tradedAmountOut
  if (event.transaction.value.isZero()) {
    const constructedInput = '0x' + event.transaction.input.toHex().substring(10)
    let dec = ethereum.decode('(uint256,uint256,uint256,uint24,uint24,address)', Bytes.fromHexString(constructedInput))
    if (dec) {
      const decoded = dec.toTuple()
      log.info('USDC input {}', [constructedInput])
      log.info('USDC input {} {}', [decoded[0].toBigInt().toString(), decoded[2].toBigInt().toString()])
      userTx.ethAmount = (userTx.ethAmount !== null ? userTx.ethAmount : BigInt.fromString('0')).plus(decoded[2].toBigInt())
    }
  } else {
    userTx.ethAmount = (userTx.ethAmount !== null ? userTx.ethAmount : BigInt.fromString('0')).plus(event.transaction.value)
  }
  userTx.user = event.params.depositor
  userTx.owner = event.transaction.from
  userTx.type = 'FLASH_DEPOSIT'
  userTx.timestamp = event.block.timestamp
  userTx.save()
}

export function handleFlashWithdraw(event: FlashWithdraw): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.wSqueethAmount = event.params.wSqueethAmount
  userTx.lpAmount = event.params.crabAmount
  userTx.user = event.params.withdrawer
  if (userTx.user.equals(CRAB_MIGRATION_ADDR)) {
    userTx.user = event.transaction.from
  }
  userTx.owner = event.transaction.from
  userTx.type = 'FLASH_WITHDRAW'
  userTx.timestamp = event.block.timestamp
  userTx.save()
}

export function handleFlashDepositCallback(event: FlashDepositCallback): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.ethAmount = ((userTx.ethAmount !== null ? userTx.ethAmount : BigInt.fromString('0')) as BigInt).minus(event.params.excess)
  userTx.type = 'FLASH_DEPOSIT_CALLBACK'
  userTx.save()
}

export function handleFlashDepositERC20(event: FlashDepositERC20): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.erc20Amount = event.params.depositedAmount
  userTx.erc20Token = event.params.depositedERC20.toHex()
  userTx.excessEth = event.params.returnedEth
  userTx.save()
}

export function handleFlashWithdrawERC20(event: FlashWithdrawERC20): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.erc20Amount = event.params.withdrawnAmount
  userTx.erc20Token = event.params.withdrawnERC20.toHex()
  userTx.save()
}

export function handleFlashWithdrawCallback(event: FlashWithdrawCallback): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  userTx.ethAmount = event.params.excess
  userTx.type = 'FLASH_WITHDRAW_CALLBACK'
  userTx.save()
}

export function handleTransfer(event: Transfer): void {
  const strategy = loadOrCreateStrategy(CRAB_V2_ADDR.toHex())

  let contract = CrabStrategyV2.bind(event.address)
  const vaultId = contract.vaultId()
  strategy.vaultId = vaultId

  // Minting token
  if (event.params.from.toHex().toLowerCase() == '0x0000000000000000000000000000000000000000') {
    const userTx = loadOrCreateTx(event.transaction.hash.toHex())
    userTx.lpAmount = event.params.value
    userTx.save()

    strategy.totalSupply = (strategy.totalSupply || BigInt.zero()).plus(event.params.value)
    strategy.save()
  }
  // Burning token
  if (event.params.to.toHex().toLowerCase() == '0x0000000000000000000000000000000000000000') {
    strategy.totalSupply = strategy.totalSupply.minus(event.params.value)
    strategy.save()
  }
}

export function handleDepositV1Shares(event: DepositV1Shares): void {
  const userTx = loadOrCreateTx(event.transaction.hash.toHex())
  const strategy = loadOrCreateStrategy(CRAB_V1_ADDR.toHex())
  const vault = Vault.load(strategy.vaultId.toString());
  if (!vault) return

  userTx.lpAmount = event.params.crabV1Amount
  userTx.ethAmount = event.params.crabV1Amount.times(vault.collateralAmount).div(strategy.totalSupply)
  userTx.user = event.params.user
  userTx.owner = event.transaction.from
  userTx.type = 'DEPOSIT_V1'
  userTx.timestamp = event.block.timestamp
  userTx.save()

}

export function handleSetHedgeTimeThreshold(event: SetHedgeTimeThreshold): void {
  const timeThreshold = new CrabHedgeTimeThreshold(event.transaction.hash.toHex())
  timeThreshold.threshold = event.params.newHedgeTimeThreshold;
  timeThreshold.timestamp = event.block.timestamp;
  timeThreshold.save()
}

export function handleQueueTransaction(event: QueueTransaction): void {
  const tx = new TimeLockTx(event.params.txHash.toHex());
  tx.target = event.params.target;
  tx.value = event.params.value;
  tx.signature = event.params.signature;
  tx.data = event.params.data;
  tx.eta = event.params.eta
  tx.queued = true;
  tx.timestamp = event.block.timestamp;
  tx.save()
}

export function handleExecuteTransaction(event: QueueTransaction): void {
  const execTimeLockTx = new ExecuteTimeLockTx(event.params.txHash.toHex());
  execTimeLockTx.timestamp = event.block.timestamp;
  const id = event.params.txHash.toHex();
  const tx = TimeLockTx.load(id);
  if (tx) {
    tx.queued = false
    tx.save();
    execTimeLockTx.timelocktx = tx.id;
  }
  execTimeLockTx.save();
}

export function handleHedgeOTC(event: HedgeOTC): void {
  const hedge = new HedgeOTCSchema(event.transaction.hash.toHex());
  hedge.bidID = event.params.bidId;
  hedge.clearingPrice = event.params.clearingPrice;
  hedge.quantity = event.params.quantity;
  hedge.isBuying = event.params.isBuying;
  hedge.timestamp = event.block.timestamp;
  hedge.save();
}

export function handleHedgeOTCSingle(event: HedgeOTCSingle): void {
  const hedge = new HedgeOTCSingleSchema(event.transaction.hash.toHex() + event.logIndex.toHexString());
  hedge.hedgeOTC = event.transaction.hash.toHex();
  hedge.trader = event.params.trader;
  hedge.bidID = event.params.bidId;
  hedge.clearingPrice = event.params.clearingPrice;
  hedge.quantity = event.params.quantity;
  hedge.price = event.params.price;
  hedge.isBuying = event.params.isBuying;
  hedge.timestamp = event.block.timestamp;
  hedge.save();
}

export function handleSetStrategyCap(event: SetStrategyCap): void {
  const cap = new SetStrategyCapSchema(event.transaction.hash.toHex());
  cap.cap = event.params.newCapAmount;
  cap.timestamp = event.block.timestamp;
  cap.save();
}

export function handleSetHedgingTwapPeriod(event: SetHedgingTwapPeriod): void {
  const twap = new SetHedgingTwapPeriodSchema(event.transaction.hash.toHex());
  twap.hedging = event.params.newHedgingTwapPeriod;
  twap.timestamp = event.block.timestamp;
  twap.save();
}

export function handleSetHedgePriceThreshold(event: SetHedgePriceThreshold): void {
  const price = new SetHedgePriceThresholdSchema(event.transaction.hash.toHex());
  price.threshold = event.params.newHedgePriceThreshold;
  price.timestamp = event.block.timestamp;
  price.save();
}

export function handleSetOTCPriceTolerance(event: SetOTCPriceTolerance): void {
  const tolerance = new SetOTCPriceToleranceSchema(event.transaction.hash.toHex());
  tolerance.tolerance = event.params.otcPriceTolerance;
  tolerance.timestamp = event.block.timestamp;
  tolerance.save();
}

export function handleVaultTransferred(event: VaultTransferred): void {
  const transfer = new VaultTransferredSchema(event.transaction.hash.toHex());
  transfer.strategy = event.params.newStrategy;
  transfer.vaultID = event.params.vaultId;
  transfer.save();
}