//SPDX-License-Identifier: BUSL-1.1

pragma solidity =0.7.6;

import {ICrabStrategyV2} from "../interfaces/ICrabStrategyV2.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {StrategySwap} from "./helper/StrategySwap.sol";

/**
 * @dev CrabHelper contract
 * @notice Contract for Crab helper functions
 * @author Opyn team
 */
contract CrabHelper is StrategySwap, ReentrancyGuard {
    using Address for address payable;

    address public immutable crab;
    address public immutable weth;

    event FlashDepositERC20(
        address indexed depositor,
        address depositedERC20,
        uint256 depositedAmount,
        uint256 depositedEthAmount,
        uint256 crabAmount,
        uint256 returnedEth
    );

    event FlashWithdrawERC20(
        address indexed withdrawer,
        address withdrawnERC20,
        uint256 withdrawnAmount,
        uint256 withdrawnEthAmount,
        uint256 crabAmount
    );

    constructor(address _crab, address _swapRouter) StrategySwap(_swapRouter) {
        require(_crab != address(0), "Invalid crab address");

        crab = _crab;
        weth = ICrabStrategyV2(_crab).weth();
    }

    function flashDepositERC20(
        uint256 _ethToDeposit,
        uint256 _amountIn,
        uint256 _minEthToGet,
        uint24 _erc20Fee,
        uint24 _wPowerPerpFee,
        address _tokenIn
    ) external nonReentrant {
        _swapExactInputSingle(_tokenIn, weth, msg.sender, address(this), _amountIn, _minEthToGet, _erc20Fee);

        IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));
        ICrabStrategyV2(crab).flashDeposit{value: address(this).balance}(_ethToDeposit, _wPowerPerpFee);

        uint256 crabAmount = IERC20(crab).balanceOf(address(this));

        emit FlashDepositERC20(msg.sender, _tokenIn, _amountIn, _ethToDeposit, crabAmount, address(this).balance);

        IERC20(crab).transfer(msg.sender, crabAmount);

        if (address(this).balance > 0) {
            payable(msg.sender).sendValue(address(this).balance);
        }
    }

    function flashWithdrawERC20(
        uint256 _crabAmount,
        uint256 _maxEthToPay,
        address _tokenOut,
        uint256 _minAmountOut,
        uint24 _erc20Fee,
        uint24 _wPowerPerpFee
    ) external nonReentrant {
        IERC20(crab).transferFrom(msg.sender, address(this), _crabAmount);

        ICrabStrategyV2(crab).flashWithdraw(_crabAmount, _maxEthToPay, _wPowerPerpFee);

        uint256 ethBalance = address(this).balance;
        IWETH9(weth).deposit{value: ethBalance}();
        uint256 tokenReceived = _swapExactInputSingle(
            weth,
            _tokenOut,
            address(this),
            msg.sender,
            ethBalance,
            _minAmountOut,
            _erc20Fee
        );

        emit FlashWithdrawERC20(msg.sender, _tokenOut, tokenReceived, ethBalance, _crabAmount);
    }

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable {
        require(msg.sender == weth || msg.sender == crab, "Cannot receive eth");
    }
}
