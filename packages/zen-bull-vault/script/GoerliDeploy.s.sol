// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import { DeployScript } from "./Deploy.s.sol";

contract GoerliDeploy is DeployScript {
    address public constant systemOwnerAddress = 0xE3Dc747E5A8D8B664Dd701EE6A72AE63e740Ebc6;
    address public constant auctionManagerAddress = 0xE3Dc747E5A8D8B664Dd701EE6A72AE63e740Ebc6;
    address public constant crabAddress = 0x3fF39f6BF8156bdA997D93E3EFF6904c2bc4481f;
    address public constant powerTokenControllerAddress = 0x6FC3f76f8a2D256Cc091bD58baB8c2Bc3F51d508;
    address public constant eulerAddress = 0x931172BB95549d0f29e10ae2D079ABA3C63318B3;
    address public constant eulerMarketsModuleAddress = 0x3EbC39b84B1F856fAFE9803A9e1Eae7Da016Da36;
    address public constant uniFactoryAddress = 0x55C0ceF3cc64F511C34b18c720bCf38feC6C6fFa;
    address public constant eTokenAddress = 0xEf5e087D827194732Bc1843351ccA80982E154eB;
    address public constant dTokenAddress = 0x356079240635B276A63065478471d89340443C49;
    uint256 public constant bullStrategyCap = 500000e18;
    uint256 public constant fullRebalancePriceTolerance = 0.05e18;
    uint256 public constant rebalanceWethLimitPriceTolerance = 0.05e18;
    uint256 public constant crUpper = 2.2e18;
    uint256 public constant crLower = 1.8e18;
    uint256 public constant deltaUpper = 1.1e18;
    uint256 public constant deltaLower = 0.9e18;

    constructor() {
        setAddressParamsAtConstructor(
            systemOwnerAddress,
            auctionManagerAddress,
            crabAddress,
            powerTokenControllerAddress,
            eulerAddress,
            eulerMarketsModuleAddress,
            uniFactoryAddress,
            eTokenAddress,
            dTokenAddress
        );

        setUintParamsAtConstructor(
            bullStrategyCap,
            fullRebalancePriceTolerance,
            rebalanceWethLimitPriceTolerance,
            crUpper,
            crLower,
            deltaUpper,
            deltaLower
        );
    }
}
