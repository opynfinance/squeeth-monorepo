// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

pragma abicoder v2;

// interface
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
//import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IWETH9 } from "squeeth-monorepo/interfaces/IWETH9.sol";
import { IUniswapV3Pool } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
//import { ICrabStrategyV2 } from "./interface/ICrabStrategyV2.sol";
import { IBullStrategy } from "./interface/IBullStrategy.sol";
// contract
import { UniFlash } from "./UniFlash.sol";
import { Ownable } from "openzeppelin/access/Ownable.sol";

// lib
//import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
//import { Address } from "openzeppelin/utils/Address.sol";
//import { UniOracle } from "./UniOracle.sol";

/**
 * @notice FlashBull contract
 * @dev handle the flashswap interactions
 * @author opyn team
 */
contract EmergencyShutdown is UniFlash, Ownable {
    //using StrategyMath for uint256;
    //using Address for address payable;

    uint256 private constant ONE = 1e18;

    /// @dev enum to differentiate between Uniswap swap callback function source
    enum FLASH_SOURCE {
        SHUTDOWN
    }

    struct ShutdownParams {
        uint256 maxEthToPay;
        uint24 ethPoolFee;
    }

    /// @dev weth address
    address private immutable weth;
    /// @dev usdc address
    address private immutable usdc;
    /// @dev bull stratgey address
    address public immutable bullStrategy;

    constructor(address _bull, address _factory, address _owner) UniFlash(_factory) {

        bullStrategy = _bull;
        weth = IController(IBullStrategy(_bull).powerTokenController()).weth();
        usdc = IController(IBullStrategy(_bull).powerTokenController()).quoteCurrency();
        transferOwnership(_owner);
    }

    /**
     * @notice redeem the Crab shares owned by Bull if Squeeth contracts are shutdown and collapse leverage trade to hold ETH only
     * @param _params Shutdown params
     */

    function redeemShortShutdown(ShutdownParams calldata _params) external onlyOwner {
        uint256 usdcToRepay = IBullStrategy(bullStrategy).calcUsdcToRepay(ONE);
        _exactOutFlashSwap(
            weth,
            usdc,
            _params.ethPoolFee,
            usdcToRepay,
            _params.maxEthToPay,
            uint8(FLASH_SOURCE.SHUTDOWN),
            abi.encodePacked("")
        );
    }

    /**
     * @notice uniswap flash swap callback function
     * @dev this function will be called by flashswap callback function uniswapV3SwapCallback()
     */
    function _uniFlashSwap(UniFlashswapCallbackData memory _uniFlashSwapData) internal override {
        if (FLASH_SOURCE(_uniFlashSwapData.callSource) == FLASH_SOURCE.SHUTDOWN) {

            
            IBullStrategy(bullStrategy).shutdownRepayAndWithdraw(_uniFlashSwapData.amountToPay);

            // repay the weth flash swap
            IWETH9(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
            }
        }
}
