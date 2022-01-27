import { Address, BigInt, dataSource } from "@graphprotocol/graph-ts";
import { Account } from "../generated/schema";

export const BIGINT_ONE = BigInt.fromI32(1);
export const BIGINT_ZERO = BigInt.fromI32(0);
export const SHORT_HELPER_ADDR = getShortHelperAddr(dataSource.network());

function getShortHelperAddr(networkName: string): Address {
  let addr = Address.fromString("0x3b4095D5ff0e629972CAAa50bd3004B09a1632C5");
  if (networkName === "ropsten") {
    addr = Address.fromString("0x8903918DFE74476E90B63061E5b9c3E63b65d3F4");
  } else if (networkName === "localhost") {
    addr = Address.fromString("0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE");
  } else if (networkName === "rinkebyArbitrum") {
    addr = Address.fromString("0x5A30a1E3873A2B5Fc9DB9b2b52491C4b6086FAe0");
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
