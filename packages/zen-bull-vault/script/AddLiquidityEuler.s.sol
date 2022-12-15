// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import "forge-std/Script.sol";

import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IEulerEToken } from "../src/interface/IEulerEToken.sol";
import { IEulerMarkets } from "../src/interface/IEulerMarkets.sol";

contract AddLiquidityEuler is Script {
    address private immutable euler;
    address private immutable eulerMarkets;
    address private immutable eToken;
    address private immutable underlying;

    constructor(address _euler, address _eulerMarkets, address _underlying, address _eToken) {
        euler = _euler;
        eulerMarkets = _eulerMarkets;
        underlying = _underlying;
        eToken = _eToken;
    }

    function run() public {
        uint256 userKey = vm.envUint("SCRIPT_USER_PK");
        address userAddress = vm.rememberKey(userKey);
        vm.startBroadcast(userAddress);

        uint256 underlyingAmount = vm.envUint("UNDERLYING_AMOUNT");
        IERC20(underlying).approve(euler, underlyingAmount);

        IEulerEToken(eToken).deposit(0, underlyingAmount);

        IEulerMarkets markets = IEulerMarkets(eulerMarkets);
        markets.enterMarket(0, underlying);

        vm.stopBroadcast();
    }
}
