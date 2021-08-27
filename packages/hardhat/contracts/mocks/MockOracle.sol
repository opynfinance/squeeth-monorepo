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

    function getTwaPrice(
        address _pool,
        address _base,
        address _quote,
        uint32 _period
    ) external view returns (uint256) {
        return poolPeriodPrice[_pool];
    }
}
