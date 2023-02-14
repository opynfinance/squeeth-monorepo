// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { DeployScript } from "./DeployScript.s.sol";

contract GoerliDeployScript is DeployScript {
    address public constant ownerAddress = 0x56a847c21a4FA937c11258d94C8B1650cdbA21F7;
    address public constant zenBullAddress = 0x2a5AD7582a9e42944Ee32671436593D16999c70a;
    address public constant eulerSimpleLensAddress = 0x62626a0f051B547b3182e55D1Eba667138790D8D;
    address public constant flashZenAddress = 0x3876aF971560FD4c4ba3FB18632AcC0570B745b1;
    address public constant uniFactoryAddress = 0x55C0ceF3cc64F511C34b18c720bCf38feC6C6fFa;

    uint256 public constant initialMinEthAmount = 1e18;
    uint256 public constant initialMinZenBullAmount = 1;

    constructor()
        DeployScript(
            ownerAddress,
            zenBullAddress,
            eulerSimpleLensAddress,
            flashZenAddress,
            uniFactoryAddress,
            initialMinEthAmount,
            initialMinZenBullAmount
        )
    { }
}
