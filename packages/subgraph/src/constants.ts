import { Address, BigInt, dataSource } from "@graphprotocol/graph-ts";
import { getShortHelperAddr, getControllerHelperAddr } from "./util";

export const BIGINT_ONE = BigInt.fromI32(1);
export const BIGINT_ZERO = BigInt.fromI32(0);
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

// export const MAINNET_CONTROLLER_HELPER_ADDR = Address.fromString("");
export const ROPSTEN_CONTROLLER_HELPER_ADDR = Address.fromString(
  "0x75500ff751789b5753DF14c047e61BC5c4324CF8"
);
// export const LOCALHOST_CONTROLLER_HELPER_ADDR = Address.fromString("");
// export const RA_CONTROLLER_HELPER_ADDR = Address.fromString("");

export const CONTROLLER_HELPER_ADDR = getControllerHelperAddr(
  dataSource.network()
);
