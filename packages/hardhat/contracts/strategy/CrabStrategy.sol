//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import "hardhat/console.sol";

// interface
import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";
import {IOracle} from "../interfaces/IOracle.sol";

// contract
import {StrategyBase} from "./base/StrategyBase.sol";

// lib
import {StrategyMath} from "./base/StrategyMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/**
 * @dev CrabStrategy contract
 * @notice Contract for Crab strategy
 * @author Opyn team
 */
contract CrabStrategy is StrategyBase {
    using StrategyMath for uint256;
    using Address for address payable;

    uint32 public constant TWAP_PERIOD = 600;

    /// @dev ETH:DAI uniswap V3 pool
    address public wSqueethEthPool;
    /// @dev startegy UNI v3 oracle
    address public oracle;

    /// @dev latest rebalance timestamp
    uint256 internal _latestRebalanceTimestamp;
    /// @dev trading slippage limit for Uni v3
    uint256 internal _slippageLimit;
    /// @dev strategy debt amount
    uint256 internal _wSqueethDebt;
    /// @dev strategy collateral amount
    uint256 internal _ethCollateral;

    event Deposit(address indexed depositor, uint256 wSqueethAmount, uint256 lpAmount);
    event Withdraw(address indexed withdrawer, uint256 crabAmount, uint256 wSqueethAmount, uint256 ethWithdrawn);

    /**
     * @notice Strategy base constructor
     * @dev this will open a vault in the power token contract and store vault ID
     * @param _wSqueethController power token controller address
     * @param _oracle oracle address
     * @param _weth weth address
     * @param _wSqueethEthPool eth:dai uniswap v3 address
     * @param _name strategy name
     * @param _symbol strategy symbol
     */
    constructor(
        address _wSqueethController,
        address _oracle,
        address _weth,
        address _wSqueethEthPool,
        string memory _name,
        string memory _symbol
    ) StrategyBase(_wSqueethController, _weth, _name, _symbol) {
        require(_oracle != address(0), "invalid oracle address");
        require(_wSqueethEthPool != address(0), "invalid ETH:DAI address");

        oracle = _oracle;
        wSqueethEthPool = _wSqueethEthPool;
    }

    /**
     * fallback function to accept eth
     */
    receive() external payable {}

    /// TODO: implement flashswap in diff PR
    function flashDeposit() external payable returns (uint256, uint256) {
        uint256 amount = msg.value;

        // load vars for gas optimization
        uint256 strategyCollateral = _ethCollateral;
        uint256 strategyDebt = _wSqueethDebt;

        uint256 wSqueethToMint = calcWsqueethToMint(amount, strategyDebt, strategyCollateral);
        uint256 depositorStrategyShare = calcSharesToMint(amount, strategyCollateral, totalSupply());

        // update strategy state
        _ethCollateral = strategyCollateral.add(amount);
        _wSqueethDebt = strategyDebt.add(wSqueethToMint);

        // mint wSqueeth
        _mintWsqueeth(msg.sender, wSqueethToMint, 0, true);
        // mint LP to depositor
        _mint(msg.sender, depositorStrategyShare);

        emit Deposit(msg.sender, wSqueethToMint, depositorStrategyShare);

        return (wSqueethToMint, depositorStrategyShare);
    }

    /**
     * @notice deposit ETH into strategy
     * @dev this function do not use flashswap
     * @return minted debt amount of LP amount
     */
    function deposit() external payable returns (uint256, uint256) {
        uint256 amount = msg.value;

        // load vars for gas optimization
        uint256 strategyCollateral = _ethCollateral;
        uint256 strategyDebt = _wSqueethDebt;

        uint256 wSqueethToMint = calcWsqueethToMint(amount, strategyDebt, strategyCollateral);
        uint256 depositorStrategyShare = calcSharesToMint(amount, strategyCollateral, totalSupply());

        // update strategy state
        _ethCollateral = strategyCollateral.add(amount);
        _wSqueethDebt = strategyDebt.add(wSqueethToMint);

        // mint wSqueeth and send it to msg.sender
        _mintWsqueeth(msg.sender, wSqueethToMint, amount, false);
        // mint LP to depositor
        _mint(msg.sender, depositorStrategyShare);

        emit Deposit(msg.sender, wSqueethToMint, depositorStrategyShare);

        return (wSqueethToMint, depositorStrategyShare);
    }

    /**
     * @notice withdraw WETH from strategy
     * @dev this function do not use flashswap
     * @param _crabAmountAmount amount of crab token to burn
     * @param _wSqueethAmount amount of wSqueeth to burn
     */
    function withdraw(uint256 _crabAmountAmount, uint256 _wSqueethAmount) external {
        // load vars for gas optimization
        uint256 strategyCollateral = _ethCollateral;
        uint256 strategyDebt = _wSqueethDebt;

        (uint256 strategyShare, uint256 ethToWithdraw) = calcCrabPercentageAndEthToWithdraw(
            _crabAmountAmount,
            strategyCollateral,
            totalSupply()
        );

        require(_wSqueethAmount.wdiv(strategyDebt) == strategyShare, "invalid ratio");

        // update strategy state
        _wSqueethDebt = strategyDebt.sub(_wSqueethAmount);
        _ethCollateral = strategyCollateral.sub(ethToWithdraw);

        _burnWsqueeth(msg.sender, _wSqueethAmount, ethToWithdraw, false);
        _burn(msg.sender, _crabAmountAmount);

        payable(msg.sender).sendValue(ethToWithdraw);

        emit Withdraw(msg.sender, _crabAmountAmount, _wSqueethAmount, ethToWithdraw);
    }

    /**
     * @notice return strategy debt amount
     */
    function getStrategyDebt() external view returns (uint256) {
        return _wSqueethDebt;
    }

    /**
     * @notice return strategy collateral amount
     */
    function getStrategyCollateral() external view returns (uint256) {
        return _ethCollateral;
    }

    /**
     * @notice get wSqueeth debt amount from specific startegy token amount
     * @notice _crabAmountAmount strategy token amount
     * @return wSqueeth amount
     */
    function getWsqueethFromStrategyAmount(uint256 _crabAmountAmount) external view returns (uint256) {
        return _wSqueethDebt.wmul(_crabAmountAmount).wdiv(totalSupply());
    }

    /**
     * @notice mint wSqueeth
     * @dev this function will keep minted wSqueeth in this contract if _keepWsqueeth == true
     * @param _receiver receiver address
     * @param _wAmount amount of wSqueeth to mint
     * @param _collateral amount of ETH collateral to deposit
     * @param _keepWsqueeth keep minted wSqueeth in this contract if it is set to true
     */
    function _mintWsqueeth(
        address _receiver,
        uint256 _wAmount,
        uint256 _collateral,
        bool _keepWsqueeth
    ) internal {
        powerTokenController.mintWPowerPerpAmount{value: _collateral}(_vaultId, uint128(_wAmount), 0);

        if (!_keepWsqueeth) {
            IWPowerPerp wSqueeth = IWPowerPerp(powerTokenController.wPowerPerp());
            wSqueeth.transfer(_receiver, _wAmount);
        }
    }

    /**
     * @notice burn Wsqueeth
     * @dev this function will not take wSqueeth from msg.sender if _isFlashSwap == true
     * @param _from wSqueeth holder address
     * @param _amount amount to burn
     * @param _collateralToWithdraw amount of collateral to unlock from wSqueeth vault
     * @param _isFlashSwap transfer wSqueeth from holder if it is set to false
     */
    function _burnWsqueeth(
        address _from,
        uint256 _amount,
        uint256 _collateralToWithdraw,
        bool _isFlashSwap
    ) internal {
        IWPowerPerp wSqueeth = IWPowerPerp(powerTokenController.wPowerPerp());

        if (!_isFlashSwap) {
            wSqueeth.transferFrom(_from, address(this), _amount);
        }

        powerTokenController.burnWPowerPerpAmount(_vaultId, _amount, _collateralToWithdraw);
    }

    /**
     * @dev calculate amount of debt to mint
     * @param _depositedAmount amount of deposited WETH
     * @param _strategyDebt amount of strategy debt
     * @param _strategyCollateral collateral amount in strategy
     * @return amount of minted wSqueeth
     */
    function calcWsqueethToMint(
        uint256 _depositedAmount,
        uint256 _strategyDebt,
        uint256 _strategyCollateral
    ) internal view returns (uint256) {
        uint256 wSqueethToMint;

        if (_strategyDebt == 0) {
            IWPowerPerp wSqueeth = IWPowerPerp(powerTokenController.wPowerPerp());
            uint256 wSqueethEthPrice = IOracle(oracle).getTwapSafe(
                wSqueethEthPool,
                address(weth),
                address(wSqueeth),
                TWAP_PERIOD
            );
            uint256 squeethDelta = wSqueethEthPrice.mul(2);
            wSqueethToMint = _depositedAmount.wdiv(squeethDelta);
        } else {
            wSqueethToMint = _depositedAmount.wmul(_strategyDebt).wdiv(_strategyCollateral);
        }

        return wSqueethToMint;
    }

    /**
     * @dev calculate amount of LP to mint for depositor
     * @param _amount amount of WETH deposited
     * @param _strategyCollateral amount of strategy collateral
     * @param _crabTotalSupply amount of crab token total supply
     * @return amount of new minted LP token
     */
    function calcSharesToMint(
        uint256 _amount,
        uint256 _strategyCollateral,
        uint256 _crabTotalSupply
    ) internal pure returns (uint256) {
        uint256 depositorShare = _amount.wdiv(_strategyCollateral.add(_amount));

        uint256 depositorStrategyShare;
        if (_crabTotalSupply != 0) {
            depositorStrategyShare = (_crabTotalSupply.wmul(depositorShare)).wdiv(uint256(1e18).sub(depositorShare));
        } else {
            depositorStrategyShare = _amount;
        }

        return depositorStrategyShare;
    }

    /**
     * @dev calculate amount of crab shares and ETH to withdraw
     * @param _crabAmountAmount crab token amount
     * @param _strategyCollateral strategy total collateral amount
     * @param _totalSupply crab total supply amount
     * @return withdrawer strategy share and weth amount to withdraw
     */
    function calcCrabPercentageAndEthToWithdraw(
        uint256 _crabAmountAmount,
        uint256 _strategyCollateral,
        uint256 _totalSupply
    ) internal pure returns (uint256, uint256) {
        uint256 strategyShare = _crabAmountAmount.wdiv(_totalSupply);
        uint256 ethToWithdraw = _strategyCollateral.wmul(strategyShare);

        return (strategyShare, ethToWithdraw);
    }
}
