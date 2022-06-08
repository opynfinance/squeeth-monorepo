import {
  Address,
  BigInt,
  BigDecimal,
  dataSource,
} from "@graphprotocol/graph-ts";
import { getoSQTHPoolAddr, getShortHelperAddr, getUSDCPoolAddr } from "./util";

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

export const MAINNET_USDC_WETH_POOL =
  "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8".toLowerCase();
export const ROPSTEN_USDC_WETH_POOL =
  "0x8356AbC730a218c24446C2c85708F373f354F0D8".toLowerCase();
export const LOCALHOST_USDC_WETH_POOL =
  "0x8dF057949E6717B6f28962f30e8415b148241e16".toLowerCase();
export const RA_USDC_WETH_POOL =
  "0xe7715b01a0B16E3e38A7d9b78F6Bd2b163D7f319".toLowerCase();

export const MAINNET_OSQTH_WETH_POOL =
  "0x82c427AdFDf2d245Ec51D8046b41c4ee87F0d29C".toLowerCase();
export const ROPSTEN_OSQTH_WETH_POOL =
  "0x921c384F79de1BAe96d6f33E3E5b8d0B2B34cb68".toLowerCase();
export const LOCALHOST_OSQTH_WETH_POOL =
  "0x8dF057949E6717B6f28962f30e8415b148241e16".toLowerCase();
export const RA_OSQTH_WETH_POOL =
  "0x0567A9C01990a4C7EE096F077A05CeEbA87db07f".toLowerCase();

export const SHORT_HELPER_ADDR = getShortHelperAddr(dataSource.network());
export const OSQTH_WETH_POOL = getoSQTHPoolAddr(dataSource.network());
export const USDC_WETH_POOL = getUSDCPoolAddr(dataSource.network());
export const TOKEN_DECIMALS_18 = BigInt.fromI32(18);
export const TOKEN_DECIMALS_USDC = BigInt.fromI32(6);
export const ZERO_BI = BigInt.fromI32(0);
export const ONE_BI = BigInt.fromI32(1);
export const ZERO_BD = BigDecimal.fromString("0");
export const ONE_BD = BigDecimal.fromString("1");
