// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IZenBullStrategy } from "./interface/IZenBullStrategy.sol";
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
import { IWETH9 } from "squeeth-monorepo/interfaces/IWETH9.sol";
// contract
import { ERC20 } from "openzeppelin/token/ERC20/ERC20.sol";
import { UniFlash } from "./UniFlash.sol";
// lib
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol";
import { Address } from "openzeppelin/utils/Address.sol";

contract EmergencyWithdraw is ERC20, UniFlash {
    using StrategyMath for uint256;
    using Address for address payable;

    /// @dev ZenBull total supply amount at the time of this contract deployment
    uint256 private _zenBullSupply;

    /// @dev crab strategy address
    address public immutable crab;
    /// @dev ZenBull strategy address
    address public immutable zenBull;
    /// @dev WETH address
    address public immutable weth;
    /// @dev wPowerPerp address
    address public immutable wPowerPerp;

    event Withdraw(
        address indexed recepient,
        uint256 zenBullAmountRedeemed,
        uint256 crabAmountRedeemed,
        uint256 wPowerPerpRedeemed,
        uint256 ethReceived,
        uint256 eulerRecoveryTokenAmount
    );

    /**
     * @dev constructor
     * @param _crab crab address
     * @param _zenBull ZenBull address
     * @param _weth WETH address
     * @param _wPowerPerp WPowerPerp address
     * @param _factory Uni V3 factory contract
     */
    constructor(
        address _crab,
        address _zenBull,
        address _weth,
        address _wPowerPerp,
        address _factory
    ) ERC20("ZenBull Euler Part Recovery", "ZBEPR") UniFlash(_factory) {
        crab = _crab;
        zenBull = _zenBull;
        weth = _weth;
        wPowerPerp = _wPowerPerp;

        _zenBullSupply = IERC20(_zenBull).totalSupply();

        IERC20(_wPowerPerp).approve(_zenBull, type(uint256).max);
    }

    /**
     * @dev receive ETH
     */
    receive() external payable {
        require(msg.sender == weth, "Can't receive ETH from this sender");
    }

    /**
     * @notice withdraw ETH deposited into crab
     * @dev this will give the sender ZBEPR token as ownership for the ETH deposited in Euler pool
     * @param _zenBullAmount ZenBull amount to redeem
     * @param _maxEthForWPowerPerp max ETH to pay for flashswapped oSQTH amount
     */
    function withdraw(uint256 _zenBullAmount, uint256 _maxEthForWPowerPerp) external {
        uint256 crabToRedeem =
            _zenBullAmount.wdiv(_zenBullSupply).wmul(IZenBullStrategy(zenBull).getCrabBalance());
        (, uint256 wPowerPerpInCrab) = IZenBullStrategy(zenBull).getCrabVaultDetails();
        uint256 wPowerPerpToRedeem =
            crabToRedeem.wmul(wPowerPerpInCrab).wdiv(IERC20(crab).totalSupply());

        _zenBullSupply = _zenBullSupply.sub(_zenBullAmount);

        IERC20(zenBull).transferFrom(msg.sender, address(this), _zenBullAmount);
        _mint(msg.sender, _zenBullAmount);

        _exactOutFlashSwap(
            weth,
            wPowerPerp,
            3000,
            wPowerPerpToRedeem,
            _maxEthForWPowerPerp,
            0,
            abi.encodePacked(crabToRedeem, wPowerPerpToRedeem)
        );

        uint256 payout = IWETH9(weth).balanceOf(address(this));
        IWETH9(weth).withdraw(payout);
        payable(msg.sender).sendValue(payout);

        emit Withdraw(
            msg.sender, _zenBullAmount, crabToRedeem, wPowerPerpToRedeem, payout, _zenBullAmount
        );
    }

    /**
     * @notice return the circulating total supply of ZenBull token
     */
    function zenBullSupply() external view returns (uint256) {
        return _zenBullSupply;
    }

    /**
     * @dev function to handle Uni v3 FlashSwapCallBack
     * @param _uniFlashSwapData data struct
     */
    function _uniFlashSwap(UniFlashswapCallbackData memory _uniFlashSwapData) internal override {
        (uint256 crabToRedeem, uint256 wPowerPerpToRedeem) =
            abi.decode(_uniFlashSwapData.callData, (uint256, uint256));

        IZenBullStrategy(zenBull).redeemCrabAndWithdrawWEth(crabToRedeem, wPowerPerpToRedeem);

        IERC20(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
    }
}
