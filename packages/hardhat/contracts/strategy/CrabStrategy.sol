//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import "hardhat/console.sol";

// interface
import {IController} from "../interfaces/IController.sol";
import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";
import {IOracle} from "../interfaces/IOracle.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

// contract
import {StrategyBase} from "./base/StrategyBase.sol";
import {StrategyFlashSwap} from "./base/StrategyFlashSwap.sol";

// lib
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {StrategyMath} from "./base/StrategyMath.sol";

/**
 * @dev CrabStrategy contract
 * @notice Contract for Crab strategy
 * @author Opyn team
 */
contract CrabStrategy is StrategyBase, StrategyFlashSwap {
    using StrategyMath for uint256;
    using Address for address payable;

    uint32 public constant TWAP_PERIOD = 600;

    enum FLASH_SOURCE {
        FLASH_DEPOSIT,
        FLASH_WITHDRAW
    }

    /// @dev ETH:WSqueeth uniswap V3 pool
    address public ethWSqueethPool;
    /// @dev startegy UNI v3 oracle
    address public oracle;

    /// @dev latest rebalance timestamp
    uint256 internal _latestRebalanceTimestamp;
    /// @dev trading slippage limit for Uni v3
    uint256 internal _slippageLimit;

    event Deposit(address indexed depositor, uint256 wSqueethAmount, uint256 lpAmount);
    event Withdraw(address indexed withdrawer, uint256 crabAmount, uint256 wSqueethAmount, uint256 ethWithdrawn);
    event FlashDeposit(
        address indexed depositor,
        uint256 depositedAmount,
        uint256 borrowedAmount,
        uint256 totalDepositedAmount,
        uint256 tradedAmountOut
    );
    event FlashWithdraw(address indexed withdrawer, uint256 crabAmount, uint256 wSqueethAmount);

    /**
     * @notice Strategy base constructor
     * @dev this will open a vault in the power token contract and store vault ID
     * @param _wSqueethController power token controller address
     * @param _oracle oracle address
     * @param _weth weth address
     * @param _uniswapFactory uniswap factory address
     * @param _ethWSqueethPool eth:dai uniswap v3 address
     * @param _name strategy name
     * @param _symbol strategy symbol
     */
    constructor(
        address _wSqueethController,
        address _oracle,
        address _weth,
        address _uniswapFactory,
        address _ethWSqueethPool,
        string memory _name,
        string memory _symbol
    ) StrategyBase(_wSqueethController, _weth, _name, _symbol) StrategyFlashSwap(_uniswapFactory) {
        require(_oracle != address(0), "invalid oracle address");
        require(_ethWSqueethPool != address(0), "invalid ETH:WSqueeth address");

        oracle = _oracle;
        ethWSqueethPool = _ethWSqueethPool;
    }

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable {}

    /**
     * @notice flash deposit
     * @dev this function sell minted WSqueeth for _ethToBorrow
     * @param _ethToDeposit ETH sent from depositor
     * @param _ethToBorrow ETH to flashswap on uni v3
     */
    function flashDeposit(uint256 _ethToDeposit, uint256 _ethToBorrow) external payable {
        require(msg.value > _ethToDeposit, "Need some buffer");

        uint256 wSqueethToMint = _calcWsqueethToMint(
            _ethToDeposit.add(_ethToBorrow),
            _strategyDebt,
            _strategyCollateral
        );

        _exactInFlashSwap(
            wPowerPerp,
            weth,
            IUniswapV3Pool(ethWSqueethPool).fee(),
            wSqueethToMint,
            _ethToDeposit.add(_ethToBorrow).sub(msg.value),
            uint8(FLASH_SOURCE.FLASH_DEPOSIT),
            _ethToDeposit.add(_ethToBorrow)
        );

        emit FlashDeposit(msg.sender, _ethToDeposit, _ethToBorrow, msg.value, wSqueethToMint);
    }

    /**
     * @notice flash withdraw
     * @dev this function will borrow wSqueeth amount and repay for selling some of the ETH collateral
     * @param _crabAmount crab token amount to burn
     */
    function flashWithdraw(uint256 _crabAmount, uint256 _maxEthToPay) external {
        uint256 exactWSqueethNeeded = _strategyDebt.wmul(_crabAmount).wdiv(totalSupply());

        _exactOutFlashSwap(
            weth,
            wPowerPerp,
            IUniswapV3Pool(ethWSqueethPool).fee(),
            exactWSqueethNeeded,
            _maxEthToPay,
            uint8(FLASH_SOURCE.FLASH_WITHDRAW),
            _crabAmount
        );

        emit FlashWithdraw(msg.sender, _crabAmount, exactWSqueethNeeded);
    }

    /**
     * @notice deposit ETH into strategy
     * @dev this function do not use flashswap
     * @return minted debt amount of LP amount
     */
    function deposit() external payable returns (uint256, uint256) {
        uint256 amount = msg.value;

        (uint256 wSqueethToMint, uint256 depositorCrabAmount) = _deposit(msg.sender, amount, false);

        emit Deposit(msg.sender, wSqueethToMint, depositorCrabAmount);

        return (wSqueethToMint, depositorCrabAmount);
    }

    /**
     * @notice withdraw WETH from strategy
     * @dev this function do not use flashswap
     * @param _crabAmount amount of crab token to burn
     * @param _wSqueethAmount amount of wSqueeth to burn
     */
    function withdraw(uint256 _crabAmount, uint256 _wSqueethAmount) external payable {
        uint256 ethToWithdraw = _withdraw(msg.sender, _crabAmount, _wSqueethAmount, false);

        // send back ETH collateral
        payable(msg.sender).sendValue(ethToWithdraw);

        emit Withdraw(msg.sender, _crabAmount, _wSqueethAmount, ethToWithdraw);
    }

    /**
     * @notice startegy uniswap flash swap
     * @dev this function will be called by flashswap callback function uniswapV3SwapCallback()
     * @param _tokenIn token IN address
     * @param _tokenOut token OUT address
     * @param _fee uniswap pool fee
     * @param _amountToPay amount to pay back for flashswap
     */
    function _strategyFlash(
        address _caller,
        address _tokenIn,
        address _tokenOut,
        uint24 _fee,
        uint256 _amountToPay,
        uint256 _callAmount,
        uint8 _callSource
    ) internal override {
        if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_DEPOSIT) {
            // convert WETH to ETH as Uniswap use WETH
            IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));

            _deposit(_caller, _callAmount, true);

            IWPowerPerp(wPowerPerp).transfer(ethWSqueethPool, _amountToPay);

            if (address(this).balance > 0) {
                payable(_caller).sendValue(address(this).balance);
            }
        }
        if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_WITHDRAW) {
            uint256 ethToWithdraw = _withdraw(
                _caller,
                _callAmount,
                IWPowerPerp(wPowerPerp).balanceOf(address(this)),
                true
            );

            IWETH9(weth).deposit{value: _amountToPay}();
            IWETH9(weth).transfer(ethWSqueethPool, _amountToPay);

            uint256 proceeds = ethToWithdraw.sub(_amountToPay);
            if (proceeds > 0) {
                payable(_caller).sendValue(proceeds);
            }
        }
    }

    /**
     * @dev deposit into strategy
     * @param _amount amount of ETH collateral to deposit
     * @param _isFlashDeposit true if this function is called by flash deposit
     * @return minted amount of WSqueeth and minted CRAB token amount
     */
    function _deposit(
        address _depositor,
        uint256 _amount,
        bool _isFlashDeposit
    ) internal returns (uint256, uint256) {
        // load vars for gas optimization
        uint256 strategyCollateral = _strategyCollateral;
        uint256 strategyDebt = _strategyDebt;

        uint256 wSqueethToMint = _calcWsqueethToMint(_amount, strategyDebt, strategyCollateral);
        uint256 depositorCrabAmount = _calcSharesToMint(_amount, strategyCollateral, totalSupply());

        // update strategy state
        _strategyCollateral = strategyCollateral.add(_amount);
        _strategyDebt = strategyDebt.add(wSqueethToMint);

        // mint wSqueeth and send it to msg.sender
        _mintWPowerPerp(_depositor, wSqueethToMint, _amount, _isFlashDeposit);
        // mint LP to depositor
        _mintStrategyToken(_depositor, depositorCrabAmount);

        return (wSqueethToMint, depositorCrabAmount);
    }

    /**
     * @notice withdraw WETH from strategy
     * @dev this function do not use flashswap
     * @param _crabAmount amount of crab token to burn
     * @param _wSqueethAmount amount of wSqueeth to burn
     * @return ETH amount to withdraw
     */
    function _withdraw(
        address _from,
        uint256 _crabAmount,
        uint256 _wSqueethAmount,
        bool _isFlashWithdraw
    ) internal returns (uint256) {
        // load vars for gas optimization
        uint256 strategyCollateral = _strategyCollateral;
        uint256 strategyDebt = _strategyDebt;

        uint256 strategyShare = _calcCrabRatio(_crabAmount, totalSupply());
        uint256 ethToWithdraw = _calcEthToWithdraw(strategyShare, strategyCollateral);

        require(_wSqueethAmount.wdiv(strategyDebt) == strategyShare, "invalid ratio");

        // update strategy state
        _strategyDebt = strategyDebt.sub(_wSqueethAmount);
        _strategyCollateral = strategyCollateral.sub(ethToWithdraw);

        _burnWPowerPerp(_from, _wSqueethAmount, ethToWithdraw, _isFlashWithdraw);
        _burn(_from, _crabAmount);

        return ethToWithdraw;
    }

    /**
     * @notice get wSqueeth debt amount from crab token amount
     * @notice _crabAmount strategy token amount
     * @return wSqueeth amount
     */
    function getWsqueethFromCrabAmount(uint256 _crabAmount) external view returns (uint256) {
        return _getDebtFromStrategyAmount(_crabAmount);
    }

    /**
     * @dev calculate amount of debt to mint
     * @param _depositedAmount amount of deposited WETH
     * @param _strategyDebtAmount amount of strategy debt
     * @param _strategyCollateralAmount collateral amount in strategy
     * @return amount of minted wSqueeth
     */
    function _calcWsqueethToMint(
        uint256 _depositedAmount,
        uint256 _strategyDebtAmount,
        uint256 _strategyCollateralAmount
    ) internal view returns (uint256) {
        uint256 wSqueethToMint;

        if (_strategyDebtAmount == 0) {
            uint256 wSqueethEthPrice = IOracle(oracle).getTwapSafe(ethWSqueethPool, wPowerPerp, weth, TWAP_PERIOD);
            uint256 squeethDelta = wSqueethEthPrice.mul(2);
            wSqueethToMint = _depositedAmount.wdiv(squeethDelta);
        } else {
            wSqueethToMint = _depositedAmount.wmul(_strategyDebtAmount).wdiv(_strategyCollateralAmount);
        }

        return wSqueethToMint;
    }

    /**
     * @dev calculate amount of LP to mint for depositor
     * @param _amount amount of WETH deposited
     * @param _strategyCollateralAmount amount of strategy collateral
     * @param _crabTotalSupply amount of crab token total supply
     * @return amount of new minted LP token
     */
    function _calcSharesToMint(
        uint256 _amount,
        uint256 _strategyCollateralAmount,
        uint256 _crabTotalSupply
    ) internal pure returns (uint256) {
        uint256 depositorShare = _amount.wdiv(_strategyCollateralAmount.add(_amount));

        uint256 depositorCrabAmount;
        if (_crabTotalSupply != 0) {
            depositorCrabAmount = (_crabTotalSupply.wmul(depositorShare)).wdiv(uint256(1e18).sub(depositorShare));
        } else {
            depositorCrabAmount = _amount;
        }

        return depositorCrabAmount;
    }

    /**
     * @notice calc crab ratio
     * @param _crabAmount crab token amount
     * @param _totalSupply crab total supply
     * @return ratio
     */
    function _calcCrabRatio(uint256 _crabAmount, uint256 _totalSupply) internal pure returns (uint256) {
        return _crabAmount.wdiv(_totalSupply);
    }

    /**
     * @notice calc ETH to withdraw from strategy
     * @param _crabRatio crab ratio
     * @param _strategyCollateralAmount amount of collateral in strategy
     * @return amount of ETH allowed to withdraw
     */
    function _calcEthToWithdraw(uint256 _crabRatio, uint256 _strategyCollateralAmount) internal pure returns (uint256) {
        return _strategyCollateralAmount.wmul(_crabRatio);
    }
}
