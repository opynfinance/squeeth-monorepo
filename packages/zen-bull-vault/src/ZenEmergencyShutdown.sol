// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IWETH9 } from "squeeth-monorepo/interfaces/IWETH9.sol";
import { IZenBullStrategy } from "./interface/IZenBullStrategy.sol";
// contract
import { UniFlash } from "./UniFlash.sol";
import { Ownable } from "openzeppelin/access/Ownable.sol";
//lib
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol";

/**
 * Error codes
 * ES1: Strategy has already been fully unwound with redeemShortShutdown()
 */

/**
 * @notice ZenEmergencyShutdown contract
 * @dev handle the emergency shutdown of the Bull strategy if the wPowerPerp and Crab contracts are shut down
 * @author opyn team
 */
contract ZenEmergencyShutdown is UniFlash, Ownable {
    using StrategyMath for uint256;

    /// @dev 1e18
    uint256 private constant ONE = 1e18;
    /// @dev difference in decimals between WETH and USDC
    uint256 internal constant WETH_DECIMALS_DIFF = 1e12;
    /// @dev enum to differentiate between Uniswap swap callback function source

    /// @dev enum to differentiate between Uniswap swap callback function source
    enum FLASH_SOURCE { SHUTDOWN }

    /// @dev redeemShortShutdown params structs
    struct ShutdownParams {
        uint256 shareToUnwind;
        uint256 ethLimitPrice;
        uint24 ethPoolFee;
    }

    /// @dev weth address
    address private immutable weth;
    /// @dev usdc address
    address private immutable usdc;
    /// @dev bull stratgey address
    address public immutable bullStrategy;

    /**
     * @notice constructor
     * @param _bull bull strategy address
     * @param _factory uniswap v3 factory
     */
    constructor(address _bull, address _factory) UniFlash(_factory) {
        bullStrategy = _bull;
        weth = IController(IZenBullStrategy(_bull).powerTokenController()).weth();
        usdc = IController(IZenBullStrategy(_bull).powerTokenController()).quoteCurrency();
    }

    /**
     * @notice redeem the Crab shares owned by Bull if WPowerPerp controller contract is shutdown and collapse leverage trade to hold ETH only
     * @param _params Shutdown params struct
     */

    function redeemShortShutdown(ShutdownParams calldata _params) external onlyOwner {
        require(!IZenBullStrategy(bullStrategy).hasRedeemedInShutdown(), "ES1");

        uint256 usdcToRepay = IZenBullStrategy(bullStrategy).calcUsdcToRepay(_params.shareToUnwind);
        _exactOutFlashSwap(
            weth,
            usdc,
            _params.ethPoolFee,
            usdcToRepay,
            usdcToRepay.mul(WETH_DECIMALS_DIFF).wdiv(_params.ethLimitPrice),
            uint8(FLASH_SOURCE.SHUTDOWN),
            abi.encodePacked(usdcToRepay, _params.shareToUnwind)
        );
    }

    /**
     * @notice uniswap flash swap callback function to handle different types of flashswaps
     * @dev this function will be called by flashswap callback function uniswapV3SwapCallback()
     * @param _uniFlashSwapData UniFlashswapCallbackData struct
     */
    function _uniFlashSwap(UniFlashswapCallbackData memory _uniFlashSwapData) internal override {
        if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.SHUTDOWN) {
            (uint256 usdcToRepay, uint256 shareToUnwind) =
                abi.decode(_uniFlashSwapData.callData, (uint256, uint256));

            IERC20(usdc).approve(bullStrategy, usdcToRepay);
            IZenBullStrategy(bullStrategy).shutdownRepayAndWithdraw(
                _uniFlashSwapData.amountToPay, shareToUnwind
            );

            // repay the weth flash swap
            IWETH9(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
        }
    }
}
