import { Address, dataSource } from "@graphprotocol/graph-ts";

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

export const MAINNET_CONTROLLER_ADDR = Address.fromString(
  "0x64187ae08781B09368e6253F9E94951243A493D5"
);
export const ROPSTEN_CONTROLLER_ADDR = Address.fromString(
  "0x59F0c781a6eC387F09C40FAA22b7477a2950d209"
);
export const LOCALHOST_CONTROLLER_ADDR = Address.fromString(
  "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853"
);
export const RA_CONTROLLER_ADDR = Address.fromString(
  "0x6FBbc7eBd7E421839915e8e4fAcC9947dC32F4dE"
);

export const MAINNET_SWAPROUTER_ADDR = Address.fromString(
  "0xE592427A0AEce92De3Edee1F18E0157C05861564"
);
export const ROPSTEN_SWAPROUTER_ADDR = Address.fromString(
  "0x528a19A3e88861E7298C86fE5490B8Ec007a4204"
);
export const LOCALHOST_SWAPROUTER_ADDR = Address.fromString(
  "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
);
export const RA_SWAPROUTER_ADDR = Address.fromString(
  "0xE592427A0AEce92De3Edee1F18E0157C05861564"
);

export const MAINNET_ROPSTEN_SWAPROUTER2_ADDR = Address.fromString(
  "0xE592427A0AEce92De3Edee1F18E0157C05861564"
);

export const MAINNET_NFT_MANAGER_ADDR = Address.fromString(
  "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
);
export const ROPSTEN_NFT_MANAGER_ADDR = Address.fromString(
  "0x8c7c1f786da4dee7d4bb49697a9b0c0c8fb328e0"
);

export const MAINNET_CRAB_STRATEGY_ADDR = Address.fromString(
  "0xf205ad80bb86ac92247638914265887a8baa437d"
);
export const ROPSTEN_CRAB_STRATEGY_ADDR = Address.fromString(
  "0xbffBD99cFD9d77c49595dFe8eB531715906ca4Cf"
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

export const MAINNET_OSQTH =
  "0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B".toLowerCase();
export const ROPSTEN_OSQTH =
  "0xa4222f78d23593e82Aa74742d25D06720DCa4ab7".toLowerCase();
export const LOCALHOST_OSQTH =
  "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318".toLowerCase();
export const RA_OSQTH =
  "0xEC0db8766bc003C14861af996e411beA6Bf800aB".toLowerCase();

export const MAINNET_WETH =
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2".toLowerCase();
export const ROPSTEN_WETH =
  "0xc778417e063141139fce010982780140aa0cd5ab".toLowerCase();
export const LOCALHOST_WETH =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3".toLowerCase();
export const RA_WETH =
  "0xB47e6A5f8b33b3F17603C83a0535A9dcD7E32681".toLowerCase();

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

export function getUSDCPoolAddr(networkName: string): string {
  let addr = MAINNET_USDC_WETH_POOL;
  if (networkName == "ropsten") {
    addr = ROPSTEN_USDC_WETH_POOL;
  } else if (networkName == "localhost") {
    addr = LOCALHOST_USDC_WETH_POOL;
  } else if (networkName == "rinkebyArbitrum") {
    addr = RA_USDC_WETH_POOL;
  }
  return addr;
}

export function getoSQTHPoolAddr(networkName: string): string {
  let addr = MAINNET_OSQTH_WETH_POOL;
  if (networkName == "ropsten") {
    addr = ROPSTEN_OSQTH_WETH_POOL;
  } else if (networkName == "localhost") {
    addr = LOCALHOST_OSQTH_WETH_POOL;
  } else if (networkName == "rinkebyArbitrum") {
    addr = RA_OSQTH_WETH_POOL;
  }
  return addr;
}

export function getoSQTHTokenAddr(networkName: string): string {
  let addr = MAINNET_OSQTH;
  if (networkName == "ropsten") {
    addr = ROPSTEN_OSQTH;
  } else if (networkName == "localhost") {
    addr = LOCALHOST_OSQTH;
  } else if (networkName == "rinkebyArbitrum") {
    addr = RA_OSQTH;
  }
  return addr;
}

export function getWETHTokenAddr(networkName: string): string {
  let addr = MAINNET_WETH;
  if (networkName == "ropsten") {
    addr = ROPSTEN_WETH;
  } else if (networkName == "localhost") {
    addr = LOCALHOST_WETH;
  } else if (networkName == "rinkebyArbitrum") {
    addr = RA_WETH;
  }
  return addr;
}

export function getControllerAddr(networkName: string): Address {
  let addr = MAINNET_CONTROLLER_ADDR;
  if (networkName == "ropsten") {
    addr = ROPSTEN_CONTROLLER_ADDR;
  } else if (networkName == "localhost") {
    addr = LOCALHOST_CONTROLLER_ADDR;
  } else if (networkName == "rinkebyArbitrum") {
    addr = RA_CONTROLLER_ADDR;
  }
  return addr;
}

export function getSwapRouterAddr(networkName: string): Address {
  let addr = MAINNET_SWAPROUTER_ADDR;
  if (networkName == "ropsten") {
    addr = ROPSTEN_SWAPROUTER_ADDR;
  } else if (networkName == "localhost") {
    addr = LOCALHOST_SWAPROUTER_ADDR;
  } else if (networkName == "rinkebyArbitrum") {
    addr = RA_SWAPROUTER_ADDR;
  }
  return addr;
}

export function getSwapRouter2Addr(networkName: string): Address {
  let addr = MAINNET_ROPSTEN_SWAPROUTER2_ADDR;
  if (networkName == "ropsten") {
    addr = ROPSTEN_SWAPROUTER_ADDR;
  }
  return addr;
}

export function getNFTManagerAddr(networkName: string): Address {
  let addr = MAINNET_NFT_MANAGER_ADDR;
  if (networkName == "ropsten") {
    addr = ROPSTEN_NFT_MANAGER_ADDR;
  }
  return addr;
}

export function getCrabStrategyAddr(networkName: string): Address {
  let addr = MAINNET_CRAB_STRATEGY_ADDR;
  if (networkName == "ropsten") {
    addr = ROPSTEN_CRAB_STRATEGY_ADDR;
  }
  return addr;
}

export const SHORT_HELPER_ADDR = getShortHelperAddr(dataSource.network());
export const OSQTH_WETH_POOL = getoSQTHPoolAddr(dataSource.network());
export const USDC_WETH_POOL = getUSDCPoolAddr(dataSource.network());
export const OSQTH_TOKEN_ADDR = getoSQTHTokenAddr(dataSource.network());
export const WETH_TOKEN_ADDR = getWETHTokenAddr(dataSource.network());
export const CONTROLLER_ADDR = getControllerAddr(dataSource.network());
export const SWAPROUTER_ADDR = getSwapRouterAddr(dataSource.network());
export const SWAPROUTER2_ADDR = getSwapRouter2Addr(dataSource.network());
export const NFT_MANAGER_ADDR = getNFTManagerAddr(dataSource.network());
export const CRAB_STRATEGY_ADDR = getCrabStrategyAddr(dataSource.network());
