import { Address } from "@graphprotocol/graph-ts";
import { Account } from "../generated/schema";
import {
  MAINNET_SHORT_HELPER_ADDR,
  ROPSTEN_SHORT_HELPER_ADDR,
  LOCALHOST_SHORT_HELPER_ADDR,
  RA_SHORT_HELPER_ADDR,
  GOERLI_SHORT_HELPER_ADDR,
  BIGINT_ZERO,
  MAINNET_CRAB_V2_ADDR,
  ROPSTEN_CRAB_V2_ADDR,
  MAINNET_CRAB_MIGRATION_ADDR,
  ROPSTEN_CRAB_MIGRATION_ADDR,
  MAINNET_CRAB_V1_ADDR,
  ROPSTEN_CRAB_V1_ADDR,
  GOERLI_CRAB_V2_ADDR,
  GOERLI_CRAB_MIGRATION_ADDR,
  GOERLI_CRAB_V1_ADDR
} from "./constants";

export function getShortHelperAddr(networkName: string): Address {
  let addr = MAINNET_SHORT_HELPER_ADDR;
  if (networkName == "ropsten") {
    addr = ROPSTEN_SHORT_HELPER_ADDR;
  } else if (networkName == "localhost") {
    addr = LOCALHOST_SHORT_HELPER_ADDR;
  } else if (networkName == "rinkebyArbitrum") {
    addr = RA_SHORT_HELPER_ADDR;
  } else if (networkName == "goerli") {
    addr = GOERLI_SHORT_HELPER_ADDR;
  } 
  return addr;
}

export function getCrabV2Addr(networkName: string): Address {
  let addr = MAINNET_CRAB_V2_ADDR;
  if (networkName == "ropsten") {
    addr = ROPSTEN_CRAB_V2_ADDR;
  } else if (networkName == "goerli") {
    addr = GOERLI_CRAB_V2_ADDR
  }

  return addr;
}

export function getCrabMigrationAddr(networkName: string): Address {
  let addr = MAINNET_CRAB_MIGRATION_ADDR;
  if (networkName == "ropsten") {
    addr = ROPSTEN_CRAB_MIGRATION_ADDR;
  } else if (networkName == "goerli") {
    addr = GOERLI_CRAB_MIGRATION_ADDR;
  }

  return addr;
}

export function getCrabV1Addr(networkName: string): Address {
  let addr = MAINNET_CRAB_V1_ADDR;
  if (networkName == "ropsten") {
    addr = ROPSTEN_CRAB_V1_ADDR
  } else if (networkName == "goerli") {
    addr = GOERLI_CRAB_V1_ADDR
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
