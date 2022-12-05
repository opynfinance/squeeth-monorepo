import { Address, BigInt, dataSource } from "@graphprotocol/graph-ts";
import { getShortHelperAddr, getCrabV2Addr, getCrabMigrationAddr, getCrabV1Addr } from "./util";

export const BIGINT_ONE = BigInt.fromI32(1);
export const BIGINT_ZERO = BigInt.fromI32(0);
export const EMPTY_ADDR = Address.empty();
// mainnet
export const MAINNET_SHORT_HELPER_ADDR = Address.fromString(
  "0x3b4095D5ff0e629972CAAa50bd3004B09a1632C5"
);
export const MAINNET_CRAB_V2_ADDR = Address.fromString(
  "0x3B960E47784150F5a63777201ee2B15253D713e8"
);
export const MAINNET_CRAB_MIGRATION_ADDR = Address.fromString(
  "0xD0fb9d47B5F65d76C6bDf1b9E43a4A2345080B2f"
);
export const MAINNET_CRAB_V1_ADDR = Address.fromString(
  "0xf205ad80bb86ac92247638914265887a8baa437d"
);
// ropsten
export const ROPSTEN_SHORT_HELPER_ADDR = Address.fromString(
  "0x8903918DFE74476E90B63061E5b9c3E63b65d3F4"
);
export const ROPSTEN_CRAB_V2_ADDR = Address.fromString(
  "0xdD1e9c25115e0d6e531d9F9E6ab7dbbEd15158Ce"
);
export const ROPSTEN_CRAB_MIGRATION_ADDR = Address.fromString(
  "0xD0fb9d47B5F65d76C6bDf1b9E43a4A2345080B2f"
);
export const ROPSTEN_CRAB_V1_ADDR = Address.fromString(
  "0xbffBD99cFD9d77c49595dFe8eB531715906ca4Cf"
);
// localhost?
export const LOCALHOST_SHORT_HELPER_ADDR = Address.fromString(
  "0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE"
);
// rinekby arbitrum
export const RA_SHORT_HELPER_ADDR = Address.fromString(
  "0x5A30a1E3873A2B5Fc9DB9b2b52491C4b6086FAe0"
);
// goerli
export const GOERLI_SHORT_HELPER_ADDR = Address.fromString(
  "0xE3606363ABE8fdE4A7f1A2058361976A4590e1e9"
);
export const GOERLI_CRAB_V2_ADDR = Address.fromString(
  "0x3ff39f6bf8156bda997d93e3eff6904c2bc4481f"
);
export const GOERLI_CRAB_MIGRATION_ADDR = Address.fromString(
  "0x5632367328327189A4858ac413A6424fe12F6C8f"
);
export const GOERLI_CRAB_V1_ADDR = Address.fromString(
  "0x5632367328327189A4858ac413A6424fe12F6C8f"
);
export const GOERLI_BULL_STRATEGY_ADDR = Address.fromString(
  "0x95F6251D3A0e0Dc5a7E52a13ef74951C5fF6503a"
);
export const GOERLI_AUCTION_BULL_ADDR = Address.fromString(
  "0x17f08f2994d411e77271161142363CdAcaD898FD"
);
export const GOERLI_FLASH_BULL_ADDR = Address.fromString(
  "0xE47f67B08CA77670133Af293E189f48C79332d51"
);

export const SHORT_HELPER_ADDR = getShortHelperAddr(dataSource.network());
export const CRAB_V2_ADDR = getCrabV2Addr(dataSource.network());
export const CRAB_MIGRATION_ADDR = getCrabMigrationAddr(dataSource.network());
export const CRAB_V1_ADDR = getCrabV1Addr(dataSource.network());
