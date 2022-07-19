import {
    SetHedgePriceThreshold,
    SetHedgeTimeThreshold,
    HedgeOTC,
    HedgeOTCSingle,
    SetStrategyCap,
    SetHedgingTwapPeriod,
    SetOTCPriceTolerance,
    VaultTransferred
  } from "../generated/CrabStrategyV2/CrabStrategyV2"

import { QueueTransaction } from "../generated/Timelock/Timelock";

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
    VaultTransferred as VaultTransferredSchema
} from "../generated/schema"

export function handleSetHedgeTimeThreshold(event: SetHedgeTimeThreshold): void {
  const timeThreshold = new CrabHedgeTimeThreshold(event.transaction.hash.toHex())
  timeThreshold.threshold = event.params.newHedgePriceThreshold;
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

export function handleExecuteTransaction(event : QueueTransaction): void {
  const execTimeLockTx = new ExecuteTimeLockTx(event.params.txHash.toHex());
  execTimeLockTx.timestamp = event.block.timestamp;
  const id = event.params.txHash.toHex();
  const tx = TimeLockTx.load(id);
  if(tx) {
    tx.queued = false
    tx.save();
    execTimeLockTx.timelocktx = tx.id;
  }
  execTimeLockTx.save();
}

export function handleHedgeOTC(event: HedgeOTC): void {
  const hedge = new HedgeOTCSchema(event.params.bidId.toString());
  hedge.bidID = event.params.bidId;
  hedge.clearingPrice = event.params.clearingPrice;
  hedge.quantity = event.params.quantity;
  hedge.isBuying = event.params.isBuying;
  hedge.timestamp = event.block.timestamp;
  hedge.save();
}

export function handleHedgeOTCSingle(event: HedgeOTCSingle): void {
  const hedge = new HedgeOTCSingleSchema(event.params.bidId.toString());
  hedge.hedgeOTC = event.params.bidId.toString();
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