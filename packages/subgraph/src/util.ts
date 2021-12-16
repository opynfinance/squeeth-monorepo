import { BigInt } from "@graphprotocol/graph-ts";
import { Account } from "../generated/schema";

export const BIGINT_ONE = BigInt.fromI32(1)
export const BIGINT_ZERO = BigInt.fromI32(0)


export function loadOrCreateAccount(accountId: string): Account {
  let account = Account.load(accountId);
  // if no account, create new entity
  if (account == null) {
    account = new Account(accountId);
    account.vaultCount = BIGINT_ZERO;
  }
  return account as Account;
}