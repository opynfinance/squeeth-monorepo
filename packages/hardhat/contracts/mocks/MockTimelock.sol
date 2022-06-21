// SPDX-License-Identifier: BSD-3-Clause
pragma solidity =0.8.10;

import {Timelock} from "../strategy/timelock/Timelock.sol";

contract MockTimelock is Timelock {
    constructor(address _admin, uint256 _delay) Timelock(_admin, _delay) {}

    function executeVaultTransfer(address crab, address newStrategy) public returns (bool) {
        (bool success, bytes memory result) = crab.call(abi.encodeWithSignature("transferVault(address)", newStrategy));

        return success;
    }

    function mockSetDelay(uint256 _delay) external {
        delay = _delay;
    }

    function mockSetPendingAdmin(address _pendingAdmin) external {
        pendingAdmin = _pendingAdmin;
    }
<<<<<<< HEAD
    
	function mockSetAdmin(address _admin) external {
		admin = _admin;
	}
}

=======

    function mockSetAdmin(address _admin) external {
        admin = _admin;
    }
}
>>>>>>> 0ece66af00897d39ec1f00b8897e9fbf26433802
