import { Address } from "@graphprotocol/graph-ts";
import { Account } from "../generated/schema";
import {
  MAINNET_SHORT_HELPER_ADDR,
  ROPSTEN_SHORT_HELPER_ADDR,
  LOCALHOST_SHORT_HELPER_ADDR,
  RA_SHORT_HELPER_ADDR,
  BIGINT_ZERO,
  MAINNET_CONTROLLER_HELPER_ADDR,
  ROPSTEN_CONTROLLER_HELPER_ADDR,
  LOCALHOST_CONTROLLER_HELPER_ADDR,
  RA_CONTROLLER_HELPER_ADDR,
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
export function getControllerHelperAddr(networkName: string): Address {
  let addr = MAINNET_CONTROLLER_HELPER_ADDR;
  if (networkName == "ropsten") {
    addr = ROPSTEN_CONTROLLER_HELPER_ADDR;
  } else if (networkName == "localhost") {
    addr = LOCALHOST_CONTROLLER_HELPER_ADDR;
  } else if (networkName == "rinkebyArbitrum") {
    addr = RA_CONTROLLER_HELPER_ADDR;
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
