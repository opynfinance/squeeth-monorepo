// SPDX-License-Identifier: BSD-3-Clause
pragma solidity =0.7.6;

import {Timelock} from "../strategy/Timelock.sol";

contract MockTimelock is Timelock {

	constructor(address _admin, uint _delay) Timelock(_admin, _delay) { }

	function executeVaultTransfer(address crab, address newStrategy) public returns(bool) {
		(bool success, bytes memory result) = crab.call(abi.encodeWithSignature("transferVault(address)", newStrategy));

		return success;
	}

	function mockSetDelay(uint _delay) external {
		delay = _delay;
	}

	function mockSetPendingAdmin(address _pendingAdmin) external {
		pendingAdmin = _pendingAdmin;
	}

	function mockSetAdmin(address _admin) external {
		admin = _admin;
	}
}