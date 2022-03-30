import { Address } from "@graphprotocol/graph-ts";
import { Account } from "../generated/schema";
import { BIGINT_ZERO } from "./constants";

export function getAddress(
  networkName: string,
  addresses: {
    mainnet: Address;
    localhost: Address;
    ropsten: Address;
    ra: Address;
  }
): Address {
  let addr = addresses.mainnet;
  if (networkName == "ropsten") {
    addr = addresses.ropsten;
  } else if (networkName == "localhost") {
    addr = addresses.localhost;
  } else if (networkName == "rinkebyArbitrum") {
    addr = addresses.ra;
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
