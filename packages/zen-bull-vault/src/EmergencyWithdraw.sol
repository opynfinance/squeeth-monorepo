// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;
pragma abicoder v2;

import { console } from "forge-std/console.sol";

// interface
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IZenBullStrategy } from "./interface/IZenBullStrategy.sol";
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
import { IWETH9 } from "squeeth-monorepo/interfaces/IWETH9.sol";

import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol";
import { ERC20 } from "openzeppelin/token/ERC20/ERC20.sol";
import { Address } from "openzeppelin/utils/Address.sol";
import { UniFlash } from "./UniFlash.sol";

contract EmergencyWithdraw is ERC20, UniFlash {
	using StrategyMath for uint256;
	using Address for address payable;

	address public immutable crab;
    address public immutable zenBull;
	address public immutable weth;
	address public immutable wPowerPerp;
	

	/// @dev amount of crab token owned by bull strategy
    uint256 private _bullSupply;

	constructor(
		address _crab,
		address _zenBull,
		address _powerTokenController,
		address _factory
	) ERC20("Zen Bull Recovery token", "ZenBullEulerRecoveryToken") UniFlash(_factory) {
        crab = _crab;
		zenBull = _zenBull;
		_bullSupply = IERC20(_zenBull).totalSupply();
		weth = IController(_powerTokenController).weth();
		wPowerPerp = IController(_powerTokenController).wPowerPerp();
		IERC20(IController(IZenBullStrategy(_zenBull).powerTokenController()).wPowerPerp()).approve(
            _zenBull, type(uint256).max
        );
    }

	receive() external payable {
        require(msg.sender == weth, "Can't receive ETH from this sender");
    }

	struct WithdrawData {
        uint256 bullAmount;
		uint256 crabToRedeem;
		uint256 wPowerPerpToRedeem;
    }

	function withdraw(uint256 _bullAmount, uint256 _maxEthForPowerPerp) external {
		(uint256 crabToRedeem, uint256 wPowerPerpToRedeem) = _getWithdrawTokenDetails(_bullAmount);
		_bullSupply = _bullSupply.sub(_bullAmount);

		IERC20(zenBull).transferFrom(msg.sender, address(this), _bullAmount);
		_mint(msg.sender, _bullAmount);

		_exactOutFlashSwap(
            weth,
            wPowerPerp,
            3000,
            wPowerPerpToRedeem,
            _maxEthForPowerPerp,
            1,
            abi.encodePacked(
                _bullAmount,
                crabToRedeem,
                wPowerPerpToRedeem
            )
        );

		if (address(this).balance > 0) {
            payable(msg.sender).sendValue(address(this).balance);
        }
	}

	function _uniFlashSwap(UniFlashswapCallbackData memory _uniFlashSwapData) internal override {
		WithdrawData memory data =
                abi.decode(_uniFlashSwapData.callData, (WithdrawData));
		IZenBullStrategy(zenBull).redeemCrabAndWithdrawWEth(data.crabToRedeem, data.wPowerPerpToRedeem);

		IERC20(weth).transfer(_uniFlashSwapData.pool, _uniFlashSwapData.amountToPay);
	
		IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));
	}


	function getWithdrawTokenDetails(uint256 _bullAmount) external view returns (uint256, uint256) {
    	return _getWithdrawTokenDetails(_bullAmount);
    }

	function bullSupply() external view returns (uint256) {
		return _bullSupply;
	}

	function _getWithdrawTokenDetails(uint256 _bullAmount) internal view returns (uint256, uint256) {
    	uint256 crabShare = IZenBullStrategy(zenBull).getCrabBalance().wmul(_bullAmount).wdiv(_bullSupply);
		(uint256 ethInCrab, uint256 wPowerPerpInCrab) = IZenBullStrategy(zenBull).getCrabVaultDetails();
		uint256 crabSupply = IERC20(crab).totalSupply();
		uint256 wPowerPerpNeeded = wPowerPerpInCrab.wmul(crabShare).wdiv(crabSupply);
		return (crabShare, wPowerPerpNeeded);
    }
}