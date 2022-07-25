import { Address, BigInt, dataSource } from "@graphprotocol/graph-ts";
import { getShortHelperAddr } from "./util";

export const BIGINT_ONE = BigInt.fromI32(1);
export const BIGINT_ZERO = BigInt.fromI32(0);
export const EMPTY_ADDR = Address.empty();
export const MAINNET_SHORT_HELPER_ADDR = Address.fromString(
  "0x3b4095D5ff0e629972CAAa50bd3004B09a1632C5"
);
export const ROPSTEN_SHORT_HELPER_ADDR = Address.fromString(
  "0x8903918DFE74476E90B63061E5b9c3E63b65d3F4"
);
export const LOCALHOST_SHORT_HELPER_ADDR = Address.fromString(
  "0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE"
);
export const RA_SHORT_HELPER_ADDR = Address.fromString(
  "0x5A30a1E3873A2B5Fc9DB9b2b52491C4b6086FAe0"
);

export const SHORT_HELPER_ADDR = getShortHelperAddr(dataSource.network());

export const CRAB_V2_ADDR = dataSource.network() == "ropsten" ? Address.fromString("0xdD1e9c25115e0d6e531d9F9E6ab7dbbEd15158Ce") : Address.fromString("0x3B960E47784150F5a63777201ee2B15253D713e8");

export const CRAB_MIGRATION_ADDR = dataSource.network() == "ropsten" ? Address.fromString("0xD0fb9d47B5F65d76C6bDf1b9E43a4A2345080B2f") : Address.fromString("0xa1cab67a4383312718a5799eaa127906e9d4b19e");

export const CRAB_V1_ADDR = dataSource.network() == "ropsten" ? Address.fromString("0xbffBD99cFD9d77c49595dFe8eB531715906ca4Cf") : Address.fromString("0xf205ad80bb86ac92247638914265887a8baa437d");
