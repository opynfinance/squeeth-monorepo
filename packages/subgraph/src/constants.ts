import {
  Address,
  BigInt,
  BigDecimal,
  dataSource,
} from "@graphprotocol/graph-ts";
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

export const USDC_WETH_POOL =
  "0x8356AbC730a218c24446C2c85708F373f354F0D8".toLowerCase();

export const OSQTH_WETH_POOL =
  "0x921c384F79de1BAe96d6f33E3E5b8d0B2B34cb68".toLowerCase();

export const SHORT_HELPER_ADDR = getShortHelperAddr(dataSource.network());
export const TOKEN_DECIMALS_18 = BigInt.fromI32(18);
export const TOKEN_DECIMALS_USDC = BigInt.fromI32(6);
export const ZERO_BI = BigInt.fromI32(0);
export const ONE_BI = BigInt.fromI32(1);
export const ZERO_BD = BigDecimal.fromString("0");
export const ONE_BD = BigDecimal.fromString("1");
