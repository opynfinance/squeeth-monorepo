//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";
import {IOracle} from "../interfaces/IOracle.sol";

// contract
import {StrategyFlashSwap} from "../strategy/base/StrategyFlashSwap.sol";

// lib
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/// @dev this contract just to test receiving the flashswap callback
contract StrategyFlashSwapTester is StrategyFlashSwap {
    using SafeMath for uint256;
    using Address for address payable;
    
    enum FlashSwapSource{
        FLASH_DEPOSIT
    }

    uint8 public callbackData;

    /**
     * @notice StrategyFlashSwapTester constructor
     * @param _factory uniswap v3 factory
     * @param _weth weth address
     */
    constructor(
        address _factory,
        address _weth
    ) StrategyFlashSwap(_factory, _weth) {
    }

    function flashLoan(address _token0, address _token1, uint256 _amount0, uint256 _amount1, uint256 _fee1) external {
        initFlash(
            FlashParams({
                token0: _token0,
                token1: _token1,
                fee1: uint24(_fee1),
                amount0: _amount0,
                amount1: _amount1, 
                fee2: uint24(0),
                fee3: uint24(0),
                flashSource: uint8(FlashSwapSource.FLASH_DEPOSIT)
            })
        );
    }

    function _strategyFlash(address _token0, address _token1, uint256 _amount0, uint256 _amount1, uint8 _flashSource) internal override {
        require(_flashSource == uint8(FlashSwapSource.FLASH_DEPOSIT));

        callbackData = _flashSource;
    }
}