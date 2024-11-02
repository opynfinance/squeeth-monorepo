// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IZenBullStrategy } from "./interface/IZenBullStrategy.sol";
import { IZenEmergencyWithdraw } from "./interface/IZenEmergencyWithdraw.sol";
import { IWETH9 } from "squeeth-monorepo/interfaces/IWETH9.sol";
import { IOracle } from "squeeth-monorepo/interfaces/IOracle.sol";
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
// contract
import { Ownable } from "openzeppelin/access/Ownable.sol";
// lib
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol";
import { Address } from "openzeppelin/utils/Address.sol";

contract ShutdownEmergencyWithdraw is Ownable {
    using StrategyMath for uint256;
    using Address for address payable;

    uint256 public constant INDEX_SCALE = 1e4;
    uint32 public constant TWAP_PERIOD = 420 seconds;

    /// @dev crab strategy address
    address internal immutable crab;
    /// @dev ZenBull strategy address
    address internal immutable zenBull;
    /// @dev WETH address
    address internal immutable weth;
    /// @dev USDC address
    address internal immutable usdc;
    /// @dev ETH:USDC pool address
    address internal immutable ethUsdcPool;
    /// @dev wPowerPerp address
    address internal immutable wPowerPerp;
    /// @dev oracle address
    address internal immutable oracle;
    /// @dev ZenBull emergency withdraw address
    address internal immutable zenBullEmergencyWithdraw;
    /// @dev controller address
    address internal immutable controller;
    /// @dev amount of weth available for redemption
    uint256 public wethAtRedemption;
    /// @dev zen bull total supply at redemption
    uint256 public zenBullTotalSupplyAtRedemption;

    event ShutdownEmergencyWithdraw(
        address indexed sender,
        uint256 crabAmountRedeemed,
        uint256 wPowerPerpRedeemed,
        uint256 totalPayout,
        uint256 ethValueInWPowerPerp,
        uint256 wethAtRedemption
    );

    event ZenBullRedeemed(address indexed sender, uint256 zenAmountRedeemed, uint256 wethReceived);

    /**
     * @dev constructor
     * @param _crab crab address
     * @param _zenBull ZenBull address
     * @param _weth WETH address
     * @param _usdc USDC address
     * @param _wPowerPerp WPowerPerp address
     * @param _oracle oracle address
     * @param _zenBullEmergencyWithdraw ZenBull emergency withdraw address
     * @param _controller controller address
     * @param _ethUsdcPool ETH:USDC pool address
     */
    constructor(
        address _crab,
        address _zenBull,
        address _weth,
        address _usdc,
        address _wPowerPerp,
        address _ethUsdcPool,
        address _oracle,
        address _zenBullEmergencyWithdraw,
        address _controller,
        address _owner
    ) {
        crab = _crab;
        zenBull = _zenBull;
        weth = _weth;
        usdc = _usdc;
        wPowerPerp = _wPowerPerp;
        oracle = _oracle;
        controller = _controller;
        zenBullEmergencyWithdraw = _zenBullEmergencyWithdraw;
        ethUsdcPool = _ethUsdcPool;
        transferOwnership(_owner);
        IERC20(_wPowerPerp).approve(_zenBull, type(uint256).max);
    }

    /**
     * @dev receive ETH
     */
    receive() external payable {
        require(msg.sender == weth, "Can't receive ETH from sender");
    }

    /**
     * @notice withdraw from all remaining Crab in ZenBull strategy
     * @dev only owner can call this function
     */
    function shutdownEmergencyWithdraw() external onlyOwner {
        require(zenBullTotalSupplyAtRedemption == 0, "ZenBull total supply set");
        uint256 crabToRedeem = IZenBullStrategy(zenBull).getCrabBalance();
        (, uint256 wPowerPerpInCrab) = IZenBullStrategy(zenBull).getCrabVaultDetails();

        uint256 ethIndexPrice =
            IOracle(oracle).getTwap(ethUsdcPool, weth, usdc, TWAP_PERIOD, true).div(INDEX_SCALE);

        uint256 wPowerPerpToRedeem =
            crabToRedeem.wmul(wPowerPerpInCrab).wdiv(IERC20(crab).totalSupply());
        uint256 ethValueInWPowerPerp = wPowerPerpToRedeem.wmul(ethIndexPrice).wmul(
            IController(controller).getExpectedNormalizationFactor()
        );

        IERC20(wPowerPerp).transferFrom(msg.sender, address(this), wPowerPerpToRedeem);

        uint256 totalPayout =
            IZenBullStrategy(zenBull).redeemCrabAndWithdrawWEth(crabToRedeem, wPowerPerpToRedeem);

        IERC20(weth).transfer(msg.sender, ethValueInWPowerPerp);

        zenBullTotalSupplyAtRedemption = IERC20(zenBull).totalSupply()
            - IZenEmergencyWithdraw(zenBullEmergencyWithdraw).redeemedZenBullAmountForCrabWithdrawal();

        wethAtRedemption = IERC20(weth).balanceOf(address(this));

        emit ShutdownEmergencyWithdraw(
            msg.sender,
            crabToRedeem,
            wPowerPerpToRedeem,
            totalPayout,
            ethValueInWPowerPerp,
            wethAtRedemption
        );
    }

    function claimZenBullRedemption(uint256 _amountToRedeem) external {
        require(zenBullTotalSupplyAtRedemption != 0, "Emergency withdraw not called");
        IERC20(zenBull).transferFrom(msg.sender, address(this), _amountToRedeem);
        uint256 wethOwed =
            _amountToRedeem.wmul(wethAtRedemption).wdiv(zenBullTotalSupplyAtRedemption);
        IERC20(weth).transfer(msg.sender, wethOwed);
        emit ZenBullRedeemed(msg.sender, _amountToRedeem, wethOwed);
    }
}
