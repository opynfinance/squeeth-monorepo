// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import {console} from "forge-std/console.sol";

import {Order} from "../../src/CrabNetting.sol";

contract SigUtils {
    bytes32 internal DOMAIN_SEPARATOR;

    constructor(bytes32 _DOMAIN_SEPARATOR) {
        DOMAIN_SEPARATOR = _DOMAIN_SEPARATOR;
    }

    // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 public constant _CRAB_NETTING_TYPEHASH = keccak256(
        "Order(uint256 bidId,address trader,uint256 quantity,uint256 price,bool isBuying,uint256 expiry,uint256 nonce)"
    );

    // computes the hash of a permit
    function getStructHash(Order memory _order) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                _CRAB_NETTING_TYPEHASH,
                _order.bidId,
                _order.trader,
                _order.quantity,
                _order.price,
                _order.isBuying,
                _order.expiry,
                _order.nonce
            )
        );
    }

    // computes the hash of the fully encoded EIP-712 message for the domain, which can be used to recover the signer
    function getTypedDataHash(Order memory _order) public view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, getStructHash(_order)));
    }
}
