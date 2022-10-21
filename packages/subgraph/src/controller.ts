import {
  Address,
  BigInt,
  Bytes,
  log,
  dataSource,
} from "@graphprotocol/graph-ts";
import {
  Controller,
  BurnShort,
  DepositCollateral,
  DepositUniPositionToken,
  FeeRateUpdated,
  FeeRecipientUpdated,
  Liquidate,
  MintShort,
  NormalizationFactorUpdated,
  OpenVault,
  OwnershipTransferred,
  Paused,
  RedeemLong,
  RedeemShort,
  ReduceDebt,
  Shutdown,
  UnPaused,
  UpdateOperator,
  WithdrawCollateral,
  WithdrawUniPositionToken,
} from "../generated/Controller/Controller";
import {
  Vault,
  Liquidation,
  NormalizationFactorUpdate,
  HourStatSnapshot,
  DayStatSnapshot,
  VaultHistory,
} from "../generated/schema";
import { loadOrCreateAccount } from "./util";

import {
  BIGINT_ONE,
  BIGINT_ZERO,
  SHORT_HELPER_ADDR,
  EMPTY_ADDR,
} from "./constants";

// Note: If a handler doesn't require existing field values, it is faster
// _not_ to load the entity from the store. Instead, create it fresh with
// `new Entity(...)`, set the fields that should be updated and save the
// entity back to the store. Fields that were not set or unset remain
// unchanged, allowing for partial updates to be applied.

// It is also possible to access smart contracts from mappings. For
// example, the contract that has emitted the event can be connected to
// with:
//
// let contract = Contract.bind(event.address)
//
// The following functions can then be called on this contract to access
// state variables and other data:
//
// - contract.FUNDING_PERIOD(...)
// - contract.TWAP_PERIOD(...)
// - contract.burnPowerPerpAmount(...)
// - contract.ethQuoteCurrencyPool(...)
// - contract.feeRate(...)
// - contract.feeRecipient(...)
// - contract.getDenormalizedMark(...)
// - contract.getDenormalizedMarkForFunding(...)
// - contract.getExpectedNormalizationFactor(...)
// - contract.getIndex(...)
// - contract.getUnscaledIndex(...)
// - contract.indexForSettlement(...)
// - contract.isShutDown(...)
// - contract.isSystemPaused(...)
// - contract.isVaultSafe(...)
// - contract.lastFundingUpdateTimestamp(...)
// - contract.lastPauseTime(...)
// - contract.liquidate(...)
// - contract.normalizationFactor(...)
// - contract.onERC721Received(...)
// - contract.oracle(...)
// - contract.owner(...)
// - contract.pausesLeft(...)
// - contract.quoteCurrency(...)
// - contract.shortPowerPerp(...)
// - contract.vaults(...)
// - contract.wPowerPerp(...)
// - contract.wPowerPerpPool(...)
// - contract.weth(...)

export function handleBurnShort(event: BurnShort): void {
  const vault = Vault.load(event.params.vaultId.toString());
  if (!vault) return;

  vault.shortAmount = vault.shortAmount.minus(event.params.amount);
  vault.save();

  let timestamp = event.block.timestamp;
  let transactionHash = event.transaction.hash.toHex();

  //check if users manually burn or using shorthelper to close position
  let actionType: string;
  if (event.params.sender == SHORT_HELPER_ADDR) {
    actionType = "CLOSE_SHORT";
  } else {
    actionType = "BURN";
  }
  //update vault history
  const vaultTransaction = getTransactionDetail(
    event.transaction.from,
    event.params.sender,
    event.params.vaultId,
    event.params.amount,
    vault,
    timestamp,
    actionType,
    transactionHash,
    BIGINT_ZERO
  );
  vaultTransaction.save();
}

export function handleDepositCollateral(event: DepositCollateral): void {
  const vault = Vault.load(event.params.vaultId.toString());
  if (!vault) return;

  vault.collateralAmount = vault.collateralAmount.plus(event.params.amount);
  vault.save();

  let timestamp = event.block.timestamp;
  let transactionHash = event.transaction.hash.toHex();

  //update vault history
  const vaultTransaction = getTransactionDetail(
    event.transaction.from,
    event.params.sender,
    event.params.vaultId,
    event.params.amount,
    vault,
    timestamp,
    "DEPOSIT_COLLAT",
    transactionHash,
    BIGINT_ZERO
  );
  vaultTransaction.save();

  // update TVL stats
  const hourStatSnapshot = getHourStatSnapshot(timestamp);
  hourStatSnapshot.totalCollateralAmount =
    hourStatSnapshot.totalCollateralAmount.plus(event.params.amount);
  hourStatSnapshot.save();

  const dayStatSnapshot = getDayStatSnapshot(timestamp);
  dayStatSnapshot.totalCollateralAmount =
    dayStatSnapshot.totalCollateralAmount.plus(event.params.amount);
  dayStatSnapshot.save();
}

export function handleDepositUniPositionToken(
  event: DepositUniPositionToken
): void {
  const vault = Vault.load(event.params.vaultId.toString());
  if (!vault) return;

  vault.NftCollateralId = event.params.tokenId;
  vault.save();
}

export function handleFeeRateUpdated(event: FeeRateUpdated): void {}

export function handleFeeRecipientUpdated(event: FeeRecipientUpdated): void {}

export function handleLiquidate(event: Liquidate): void {
  const vault = Vault.load(event.params.vaultId.toString());
  if (!vault) return;

  vault.shortAmount = vault.shortAmount.minus(event.params.debtAmount);
  vault.collateralAmount = vault.collateralAmount.minus(
    event.params.collateralPaid
  );
  vault.save();

  let timestamp = event.block.timestamp;
  let transactionHash = event.transaction.hash.toHex();
  //update vault history
  const vaultTransaction = getTransactionDetail(
    event.transaction.from,
    EMPTY_ADDR,
    event.params.vaultId,
    event.params.collateralPaid,
    vault,
    timestamp,
    "LIQUIDATE",
    transactionHash,
    event.params.debtAmount
  );
  vaultTransaction.save();

  // update TVL stats
  const hourStatSnapshot = getHourStatSnapshot(timestamp);
  hourStatSnapshot.totalCollateralAmount =
    hourStatSnapshot.totalCollateralAmount.minus(event.params.collateralPaid);
  hourStatSnapshot.save();

  const dayStatSnapshot = getDayStatSnapshot(timestamp);
  dayStatSnapshot.totalCollateralAmount =
    dayStatSnapshot.totalCollateralAmount.minus(event.params.collateralPaid);
  dayStatSnapshot.save();

  const liquidation = new Liquidation(
    `${event.transaction.hash.toHex()}-${event.logIndex.toString()}`
  );
  liquidation.debtAmount = event.params.debtAmount;
  liquidation.collateralPaid = event.params.collateralPaid;
  liquidation.vaultId = event.params.vaultId;
  liquidation.liquidator = event.params.liquidator;
  liquidation.timestamp = event.block.timestamp;
  liquidation.save();
}

export function handleMintShort(event: MintShort): void {
  const vault = Vault.load(event.params.vaultId.toString());
  if (!vault) return;

  vault.shortAmount = vault.shortAmount.plus(event.params.amount);
  vault.save();

  let timestamp = event.block.timestamp;
  let transactionHash = event.transaction.hash.toHex();
  //check if users manually mint or using shorthelper to close position
  //if directly sent to short helper address, then it's open short in 1 step, if directly sen t to controller address, then it's mint
  let actionType: string;
  if (event.params.sender == SHORT_HELPER_ADDR) {
    actionType = "OPEN_SHORT";
  } else {
    actionType = "MINT";
  }

  //update vault history
  const vaultTransaction = getTransactionDetail(
    event.transaction.from,
    event.params.sender,
    event.params.vaultId,
    event.params.amount,
    vault,
    timestamp,
    actionType,
    transactionHash,
    BIGINT_ZERO
  );
  vaultTransaction.save();
}

export function handleNormalizationFactorUpdated(
  event: NormalizationFactorUpdated
): void {
  const nfUpdate = new NormalizationFactorUpdate(
    `${event.transaction.hash.toHex()}-${event.logIndex.toString()}`
  );
  nfUpdate.newNormFactor = event.params.newNormFactor;
  nfUpdate.oldNormFactor = event.params.oldNormFactor;
  nfUpdate.timestamp = event.params.timestamp;
  nfUpdate.lastModificationTimestamp = event.params.lastModificationTimestamp;
  nfUpdate.save();
}

export function handleOpenVault(event: OpenVault): void {
  const account = loadOrCreateAccount(event.transaction.from.toHex());
  account.vaultCount = account.vaultCount.plus(BIGINT_ONE);
  account.save();

  const vault = new Vault(event.params.vaultId.toString());
  vault.owner = event.transaction.from.toHex();
  vault.collateralAmount = BIGINT_ZERO;
  vault.shortAmount = BIGINT_ZERO;
  vault.save();
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {}

export function handlePaused(event: Paused): void {}

export function handleRedeemLong(event: RedeemLong): void {}

export function handleRedeemShort(event: RedeemShort): void {}

export function handleReduceDebt(event: ReduceDebt): void {}

export function handleShutdown(event: Shutdown): void {}

export function handleUnPaused(event: UnPaused): void {}

export function handleUpdateOperator(event: UpdateOperator): void {
  const vault = Vault.load(event.params.vaultId.toString());
  if (!vault) return;

  vault.operator = event.params.operator;
  vault.save();
}

export function handleWithdrawCollateral(event: WithdrawCollateral): void {
  const vault = Vault.load(event.params.vaultId.toString());
  if (!vault) return;

  vault.collateralAmount = vault.collateralAmount.minus(event.params.amount);
  vault.save();

  let timestamp = event.block.timestamp;
  let transactionHash = event.transaction.hash.toHex();

  //update vault history
  const vaultTransaction = getTransactionDetail(
    event.transaction.from,
    event.params.sender,
    event.params.vaultId,
    event.params.amount,
    vault,
    timestamp,
    "WITHDRAW_COLLAT",
    transactionHash,
    BIGINT_ZERO
  );
  vaultTransaction.save();

  // update TVL stats
  const hourStatSnapshot = getHourStatSnapshot(timestamp);
  hourStatSnapshot.totalCollateralAmount =
    hourStatSnapshot.totalCollateralAmount.minus(event.params.amount);
  hourStatSnapshot.save();

  const dayStatSnapshot = getDayStatSnapshot(timestamp);
  dayStatSnapshot.totalCollateralAmount =
    dayStatSnapshot.totalCollateralAmount.minus(event.params.amount);
  dayStatSnapshot.save();
}

export function handleWithdrawUniPositionToken(
  event: WithdrawUniPositionToken
): void {
  const vault = Vault.load(event.params.vaultId.toString());
  if (!vault) return;

  vault.NftCollateralId = BIGINT_ZERO;
  vault.save();
}

function getHourStatSnapshot(timestamp: BigInt): HourStatSnapshot {
  let hourIndex = timestamp.toI32() / 3600; // get unique hour within unix history
  let hourStartUnix = hourIndex * 3600; // want the rounded effect
  let hourStartUnixBigInt = BigInt.fromI32(hourStartUnix);

  let hourStatSnapshot = HourStatSnapshot.load("last");

  if (hourStatSnapshot === null) {
    hourStatSnapshot = new HourStatSnapshot("last");
    hourStatSnapshot.totalCollateralAmount = BIGINT_ZERO;
    hourStatSnapshot.timestamp = hourStartUnixBigInt;
  }

  if (
    hourStatSnapshot !== null &&
    hourStatSnapshot.timestamp.notEqual(hourStartUnixBigInt)
  ) {
    let totalCollateral = hourStatSnapshot.totalCollateralAmount;
    hourStatSnapshot.id = hourStatSnapshot.timestamp.toString();
    hourStatSnapshot.save();

    hourStatSnapshot = new HourStatSnapshot("last");
    hourStatSnapshot.totalCollateralAmount = totalCollateral;
    hourStatSnapshot.timestamp = hourStartUnixBigInt;
  }

  return hourStatSnapshot as HourStatSnapshot;
}

function getDayStatSnapshot(timestamp: BigInt): DayStatSnapshot {
  let dayID = timestamp.toI32() / 86400;
  let dayStartUnix = dayID * 86400;
  let dayStartUnixBigInt = BigInt.fromI32(dayStartUnix);

  let dayStatSnapshot = DayStatSnapshot.load("last");

  if (dayStatSnapshot === null) {
    dayStatSnapshot = new DayStatSnapshot("last");
    dayStatSnapshot.totalCollateralAmount = BIGINT_ZERO;
    dayStatSnapshot.timestamp = dayStartUnixBigInt;
  }

  if (
    dayStatSnapshot !== null &&
    dayStatSnapshot.timestamp.notEqual(dayStartUnixBigInt)
  ) {
    let totalCollateral = dayStatSnapshot.totalCollateralAmount;
    dayStatSnapshot.id = dayStatSnapshot.timestamp.toString();
    dayStatSnapshot.save();

    dayStatSnapshot = new DayStatSnapshot("last");
    dayStatSnapshot.totalCollateralAmount = totalCollateral;
    dayStatSnapshot.timestamp = dayStartUnixBigInt;
  }

  return dayStatSnapshot as DayStatSnapshot;
}

function getTransactionDetail(
  from: Bytes,
  sender: Bytes,
  vaultId: BigInt,
  amount: BigInt,
  vault: Vault,
  timestamp: BigInt,
  action: string,
  transactionHash: string,
  debtAmount: BigInt
): VaultHistory {
  const vaultHistory = new VaultHistory(transactionHash + "-" + action);
  vaultHistory.totalEthCollateralAmount = vault.collateralAmount;
  vaultHistory.action = action;
  vaultHistory.vaultId = vaultId;
  vaultHistory.txid = transactionHash;
  vaultHistory.timestamp = timestamp;
  vaultHistory.from = from;
  vaultHistory.sender = sender;
  vaultHistory.ethCollateralAmount = BigInt.zero()
  vaultHistory.oSqthAmount = BigInt.zero();

  if (action == "DEPOSIT_COLLAT" || action == "WITHDRAW_COLLAT") {
    vaultHistory.ethCollateralAmount = amount;
  } else if (action == "LIQUIDATE") {
    vaultHistory.ethCollateralAmount = amount;
    vaultHistory.oSqthAmount = debtAmount;
  } else {
    vaultHistory.oSqthAmount = amount;
  }

  return vaultHistory as VaultHistory;
}
