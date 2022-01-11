//SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity =0.7.6;

import {IShortPowerPerp} from "../interfaces/IShortPowerPerp.sol";

/**
 * use this contract to check that controller has correct access control to mint NFTs
 * a testing contract is necessary as the before transfer hook calls updateOperator
 */
contract ControllerAccessTester{
    
    IShortPowerPerp shortPowerPerp;

    constructor(address _shortPowerPerp) {
        shortPowerPerp = IShortPowerPerp(_shortPowerPerp);
    }
    
    function mintTest(address _address) external returns (uint256) {
        return shortPowerPerp.mintNFT(_address);
    }

    function updateOperator(uint256 _tokenId, address _operator) external {

    }
}