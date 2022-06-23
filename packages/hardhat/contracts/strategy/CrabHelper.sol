pragma solidity =0.7.6;

import {ICrabStrategyV2} from "../interfaces/ICrabStrategyV2.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {StrategyBase} from "./base/StrategyBase.sol";

/**
 * @dev CrabHelper contract
 * @notice Contract for Crab helper functions
 * @author Opyn team
 */
contract CrabHelper is StrategySwap, ReentrancyGuard {
    address public immutable crab;
    address public immutable weth;
    address public immutable wPowerPerp;

    event FlashDepositERC20(
        address indexed depositor,
        address depositedERC20,
        uint256 depositedAmount,
        uint256 depositedEthAmount,
        uint256 tradedAmountOut,
        uint256 returnedEth
    );

	event FlashWithdrawERC20(
        address indexed withdrawer,
        address withdrawnERC20,
        uint256 withdrawnAmount,
        uint256 withdrawnEthAmount,
        uint256 crabAmount,
    );

    constructor(address _crab, address _swapRouter) StrategySwap(_swapRouter) {
        require(_crab != address(0), "Invalid crab address");

        crab = _crab;
        weth = ICrabStrategyV2(_crab).weth();
        wPowerPerp = ICrabStrategyV2(_crab).wPowerPerp();
    }

    function flashDepositERC20(
        uint256 _ethToDeposit,
        uint256 _amountIn,
        uint256 _minEthToGet,
        uint24 _fee,
        address _tokenIn
    ) external nonReentrant {
        uint256 wethReceived = _swapExactInputSingle(
            _tokenIn,
            weth,
            msg.sender,
            address(this),
            _amountIn,
            _minEthToGet,
            _fee
        );

        IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));
        ICrabStrategyV2(crab).flashDeposit{value: address(this).balance}(_ethToDeposit);

        uint256 oSqthAmount = IERC20(wPowerPerp).balanceOf(address(this));

        emit FlashDepositERC20(msg.sender, _tokenIn, _amountIn, _ethToDeposit, oSqthAmount, address(this).balance);

        IERC20(wPowerPerp).transfer(msg.sender, oSqthAmount);

        if (address(this).balance > 0) {
            payable(msg.sender).sendValue(address(this).balance);
        }
    }

    function flashWithdrawERC20(
        uint256 _crabAmount,
        uint256 _maxEthToPay,
        address _tokenOut,
        uint256 _minAmountOut,
        uint24 _fee
    ) external nonReentrant {
        ICrabStrategyV2(crab).transferFrom(msg.sender, address(this), _crabAmount);
        ICrabStrategyV2(crab).approve(crab, _crabAmount);

        ICrabStrategyV2(crab).flashWithdraw(_crabAmount, _maxEthToPay);

        uint256 ethBalance = address(this).balance;
        IWETH9(weth).deposit{value: ethBalance}();
        uint256 tokenReceived = _swapExactInputSingle(
            weth,
            _tokenOut,
            address(this),
            msg.sender,
            ethBalance,
            _minAmountOut,
            _fee
        );

        emit FlashWithdrawERC20Callback(msg.sender, _tokenOut, tokenReceived, ethBalance, _crabAmount);
    }
}
