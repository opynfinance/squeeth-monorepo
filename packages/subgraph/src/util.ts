import { BigInt } from "@graphprotocol/graph-ts";
import { Address, ethereum } from "@graphprotocol/graph-ts";
import { Account, TransactionHistory } from "../generated/schema";
import {
  MAINNET_SHORT_HELPER_ADDR,
  ROPSTEN_SHORT_HELPER_ADDR,
  LOCALHOST_SHORT_HELPER_ADDR,
  RA_SHORT_HELPER_ADDR,
  BIGINT_ZERO,
} from "./constants";

export function getShortHelperAddr(networkName: string): Address {
  let addr = MAINNET_SHORT_HELPER_ADDR;
  if (networkName == "ropsten") {
    addr = ROPSTEN_SHORT_HELPER_ADDR;
  } else if (networkName == "localhost") {
    addr = LOCALHOST_SHORT_HELPER_ADDR;
  } else if (networkName == "rinkebyArbitrum") {
    addr = RA_SHORT_HELPER_ADDR;
  }
  return addr;
}

export function loadOrCreateAccount(accountId: string): Account {
  let account = Account.load(accountId);
  // if no account, create new entity
  if (account == null) {
    account = new Account(accountId);
    account.vaultCount = BIGINT_ZERO;
  }
  return account as Account;
}

export function saveTransactionHistory(
  event: ethereum.Event,
  fn: (transactionHistory: TransactionHistory) => void
): void {
  let transactionHistory = new TransactionHistory(
    `${event.transaction.hash.toHex()}-${event.logIndex}`
  );

  transactionHistory.timestamp = event.block.timestamp;
  transactionHistory.oSqthAmount = BigInt.zero();
  transactionHistory.ethAmount = BigInt.zero();
  transactionHistory.oSqthPrice = BigInt.zero();

  fn(transactionHistory);

  transactionHistory.save();
}
