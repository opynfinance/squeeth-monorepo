import { Address, BigInt, dataSource } from "@graphprotocol/graph-ts";
import { getShortHelperAddr, getCrabV2Addr, getCrabMigrationAddr, getCrabV1Addr, getBullAddr, getFlashBullAddr, getAuctionBullAddr } from "./util";

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
export const MAINNET_FLASH_BULL_ADDR = Address.fromString(
  "0x11A56a3A7A6Eb768A9125798B1eABE9EBD9EcE02"
);
export const MAINNET_BULL_STRATEGY_ADDR = Address.fromString(
  "0xb46Fb07b0c80DBC3F97cae3BFe168AcaD46dF507"
);
export const MAINNET_AUCTION_BULL_ADDR = Address.fromString(
  "0x6cd0890054d308264cD68B0b6ba38A36860593ec"
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
  "0xD837848Ca57AdBb4361911C1aD8397FA21e35672"
);
export const GOERLI_CRAB_V2_ADDR = Address.fromString(
  "0x4Eb533506f996dea20f3d582C2ff36BA527ba35D"
);
export const GOERLI_CRAB_MIGRATION_ADDR = Address.fromString(
  "0x5632367328327189A4858ac413A6424fe12F6C8f"
);
export const GOERLI_CRAB_V1_ADDR = Address.fromString(
  "0x5632367328327189A4858ac413A6424fe12F6C8f"
);
export const GOERLI_BULL_STRATEGY_ADDR = Address.fromString(
  "0x2a5AD7582a9e42944Ee32671436593D16999c70a"
);
export const GOERLI_AUCTION_BULL_ADDR = Address.fromString(
  "0xE5E4302933aef104Bb93181Ae9E8A664E42c8d9C"
);
export const GOERLI_FLASH_BULL_ADDR = Address.fromString(
  "0x3876aF971560FD4c4ba3FB18632AcC0570B745b1"
);

export const SHORT_HELPER_ADDR = getShortHelperAddr(dataSource.network());
export const CRAB_V2_ADDR = getCrabV2Addr(dataSource.network());
export const CRAB_MIGRATION_ADDR = getCrabMigrationAddr(dataSource.network());
export const CRAB_V1_ADDR = getCrabV1Addr(dataSource.network());
export const FLASH_BULL_ADDR = getFlashBullAddr(dataSource.network());
export const BULL_ADDR = getBullAddr(dataSource.network());
export const AUCTION_BULL = getAuctionBullAddr(dataSource.network());
