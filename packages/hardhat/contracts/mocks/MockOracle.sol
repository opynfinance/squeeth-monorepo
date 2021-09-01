// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

contract MockOracle {
    mapping(address => uint256) public poolPeriodPrice;

    function setPrice(
        address _pool,
        uint32 _period,
        uint256 _price
    ) external {
        poolPeriodPrice[_pool] = _price;
    }

    function getTwaPriceSafe(
        address _pool,
        address,
        address,
        uint32
    ) external view returns (uint256) {
        return poolPeriodPrice[_pool];
    }

    function getTwaPrice(
        address _pool,
        address,
        address,
        uint32
    ) external view returns (uint256) {
        return poolPeriodPrice[_pool];
    }

    function getMaxPeriod(address) external view returns (uint32) {
        return uint32(-1);
    }
}
