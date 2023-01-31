// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { DeployScript } from "./DeployScript.s.sol";

contract MainnetDeployScript is DeployScript {
    address public constant ownerAddress = 0xAfE66363c27EedB597a140c28B70b32F113fd5a8;
    address public constant zenBullAddress = 0xb46Fb07b0c80DBC3F97cae3BFe168AcaD46dF507;
    address public constant eulerSimpleLensAddress = 0xAF68CFba29D0e15490236A5631cA9497e035CD39;
    address public constant flashZenAddress = 0x11A56a3A7A6Eb768A9125798B1eABE9EBD9EcE02;
    address public constant uniFactoryAddress = 0x1F98431c8aD98523631AE4a59f267346ea31F984;

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
