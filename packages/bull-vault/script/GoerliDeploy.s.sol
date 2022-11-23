// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import { DeployScript } from "./Deploy.s.sol";

contract GoerliDeploy is DeployScript {
    address public constant systemOwnerAddress = address(0);
    address public constant auctionManagerAddress = address(0);
    address public constant crabAddress = 0x3B960E47784150F5a63777201ee2B15253D713e8;
    address public constant powerTokenControllerAddress = 0x3B960E47784150F5a63777201ee2B15253D713e8;
    address public constant eulerAddress = 0x27182842E098f60e3D576794A5bFFb0777E025d3;
    address public constant eulerMarketsModuleAddress = 0x3520d5a913427E6F0D6A83E07ccD4A4da316e4d3;
    address public constant uniFactoryAddress = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
    address public constant eTokenAddress = 0x1b808F49ADD4b8C6b5117d9681cF7312Fcf0dC1D;
    address public constant dTokenAddress = 0x84721A3dB22EB852233AEAE74f9bC8477F8bcc42;
    uint256 public constant bullStrategyCap = 500e18;
    uint256 public constant fullRebalancePriceTolerance = 2e17;
    uint256 public constant rebalanceWethLimitPriceTolerance = 2e17;
    uint256 public constant crUpper = 2.2e18;
    uint256 public constant crLower = 1.8e18;
    uint256 public constant deltaUpper = 1.1e18;
    uint256 public constant deltaLower = 0.9e18;

    constructor()
    { 
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
