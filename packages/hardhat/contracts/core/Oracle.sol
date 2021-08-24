// SPDX-License-Identifier: MIT

// uniswap Library only works under 0.7.6
pragma solidity =0.7.6;

import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

contract Oracle {
    using OracleLibrary for address;

    function getTwaPrice(address _pool, uint32 _period) external view returns (uint256) {
        return _fetchTwap(_pool, _period, uint256(1e18));
    }

    function _fetchTwap(
        address _pool,
        uint32 _twapPeriod,
        uint256 _amountIn
    ) internal view returns (uint256 amountOut) {
        int24 twapTick = OracleLibrary.consult(_pool, _twapPeriod);
        
        return
            OracleLibrary.getQuoteAtTick(
                twapTick,
                toUint128(_amountIn),
                IUniswapV3Pool(_pool).token0(),
                IUniswapV3Pool(_pool).token1()
            );
    }

    /// @notice Cast a uint256 to a uint128, revert on overflow
    /// @param y The uint256 to be downcasted
    /// @return z The downcasted integer, now type uint128
    function toUint128(uint256 y) internal pure returns (uint128 z) {
        require((z = uint128(y)) == y);
    }
}
