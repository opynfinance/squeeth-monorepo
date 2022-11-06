// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

pragma abicoder v2;

// interface
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
import { ICrabStrategyV2 } from "./interface/ICrabStrategyV2.sol";
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
// contract
import { ERC20 } from "openzeppelin/token/ERC20/ERC20.sol";
import { LeverageBull } from "./LeverageBull.sol";
// lib
import { Address } from "openzeppelin/utils/Address.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import { VaultLib } from "squeeth-monorepo/libs/VaultLib.sol";

/**
 * Error codes
 * BS0: Can't receive ETH from this sender
 * BS1: Invalid strategy cap
 * BS2: Strategy cap reached max
 */

/**
 * @notice BullStrategy contract
 * @dev this is an abstracted BullStrategy in term of deposit and withdraw functionalities
 * @author opyn team
 */
contract BullStrategy is ERC20, LeverageBull {
    using StrategyMath for uint256;
    using Address for address payable;

    /// @dev the amount of crab token bull strategy own
    uint256 private _crabBalance;

    /// @dev Crab contract address
    address public immutable crab;
    /// @dev PowerToken controller
    address public immutable powerTokenController;

    /// @dev the cap in ETH for the strategy, above which deposits will be rejected
    uint256 public strategyCap;

    event Withdraw(address from, uint256 bullAmount, uint256 wPowerPerpToRedeem);

    /**
     * @notice constructor for BullStrategy
     * @dev this will open a vault in the power token contract and store the vault ID
     * @param _owner bull strategy owner
     * @param _crab crab address
     * @param _powerTokenController wPowerPerp Controller address
     * @param _euler euler address
     * @param _eulerMarketsModule euler markets module address
     */
    constructor(
        address _owner,
        address _crab,
        address _powerTokenController,
        address _euler,
        address _eulerMarketsModule
    )
        ERC20("Bull Vault", "BullVault")
        LeverageBull(_owner, _euler, _eulerMarketsModule, _powerTokenController)
    {
        crab = _crab;
        powerTokenController = _powerTokenController;
    }

    receive() external payable {
        require(msg.sender == weth || msg.sender == address(crab), "BS0");
    }

    /**
     * @notice set strategy cap
     * @param _cap startegy cap
     */
    function setCap(uint256 _cap) external onlyOwner {
        require(_cap != 0, "BS1");

        emit SetCap(strategyCap, _cap);

        strategyCap = _cap;
    }

    /**
     * @notice set strategy cap
     * @param _cap startegy cap
     */
    function setCap(uint256 _cap) external onlyOwner {
        require(_cap != 0, "BS1");

        emit SetCap(strategyCap, _cap);

        strategyCap = _cap;
    }

    /**
     * @notice deposit function that handle minting shares and depositing into the leverage component
     * @dev this function assume the _from depositor already have _crabAmount
     * @param _crabAmount amount of crab token
     */
    function deposit(uint256 _crabAmount) external payable {
        IERC20(crab).transferFrom(msg.sender, address(this), _crabAmount);
        uint256 crabBalance = _increaseCrabBalance(_crabAmount);

        uint256 share = ONE;
        uint256 bullToMint = _crabAmount;

        if (totalSupply() == 0) {
            _mint(msg.sender, _crabAmount);
        } else {
            share = _crabAmount.wdiv(crabBalance);
            bullToMint = share.wmul(totalSupply()).wdiv(ONE.sub(share));
            _mint(msg.sender, bullToMint);
        }

        (uint256 ethInCrab, uint256 squeethInCrab) = _getCrabVaultDetails();
        (, uint256 usdcBorrowed, uint256 _totalWethInEuler) = _leverageDeposit(
            msg.value, bullToMint, share, ethInCrab, squeethInCrab, IERC20(crab).totalSupply()
        );

        require(_totalWethInEuler <= strategyCap, "BS2");

        IERC20(usdc).transfer(msg.sender, usdcBorrowed);
    }

    /**
     * @notice withdraw ETH from crab and euler by providing wPowerPerp, bull token and USDC to repay debt
     * @param _bullAmount amount of bull token to redeem
     */
    function withdraw(uint256 _bullAmount) external {
        uint256 share = _bullAmount.wdiv(totalSupply());
        uint256 crabToRedeem = share.wmul(_crabBalance);
        uint256 crabTotalSupply = IERC20(crab).totalSupply();
        (, uint256 squeethInCrab) = _getCrabVaultDetails();
        uint256 wPowerPerpToRedeem = crabToRedeem.wmul(squeethInCrab).wdiv(crabTotalSupply);

        IERC20(wPowerPerp).transferFrom(msg.sender, address(this), wPowerPerpToRedeem);
        IERC20(wPowerPerp).approve(crab, wPowerPerpToRedeem);
        _burn(msg.sender, _bullAmount);

        _decreaseCrabBalance(crabToRedeem);
        ICrabStrategyV2(crab).withdraw(crabToRedeem);

        _repayAndWithdrawFromLeverage(share);

        payable(msg.sender).sendValue(address(this).balance);

        emit Withdraw(msg.sender, _bullAmount, wPowerPerpToRedeem);
    }

    /**
     * @notice return the internal accounting of the bull strategy's crab balance
     * @return crab token amount hold by the bull strategy
     */
    function getCrabBalance() external view returns (uint256) {
        return _crabBalance;
    }

    function getCrabVaultDetails() external view returns (uint256, uint256) {
        return _getCrabVaultDetails();
    }

    function calcDeltaAndCR(bool _isBuyingUsdc, uint256 _usdcAmount)
        external
        view
        returns (uint256, uint256)
    {
        return _calcDeltaAndCR(_isBuyingUsdc, _usdcAmount);
    }

    /**
     * @notice increase internal accounting of bull stragtegy's crab balance
     * @param _crabAmount crab amount
     */
    function _increaseCrabBalance(uint256 _crabAmount) private returns (uint256) {
        _crabBalance = _crabBalance.add(_crabAmount);
        return _crabBalance;
    }

    /**
     * @notice decrease internal accounting of bull strategy's crab balance
     * @param _crabAmount crab amount
     */
    function _decreaseCrabBalance(uint256 _crabAmount) private returns (uint256) {
        _crabBalance = _crabBalance.sub(_crabAmount);
        return _crabBalance;
    }

    function _getCrabVaultDetails() internal view returns (uint256, uint256) {
        VaultLib.Vault memory strategyVault =
            IController(powerTokenController).vaults(ICrabStrategyV2(crab).vaultId());

        return (strategyVault.collateralAmount, strategyVault.shortAmount);
    }

    // TODO: Take in crab params when we add full rebalance
    function _calcDeltaAndCR(bool _isBuyingUsdc, uint256 _usdcAmount)
        internal
        view
        returns (uint256, uint256)
    {
        (uint256 ethInCrab, uint256 squeethInCrab) = _getCrabVaultDetails();
        uint256 ethUsdPrice = UniOracle._getTwap(ethUSDCPool, weth, usdc, TWAP, false);
        uint256 squeethEthPrice = UniOracle._getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
        uint256 crabUsdPrice = (
            ethInCrab.wmul(ethUsdPrice).sub(squeethInCrab.wmul(squeethEthPrice).wmul(ethUsdPrice))
        ).wdiv(IERC20(crab).totalSupply());

        uint256 usdcDebt;
        uint256 ethInCollateral;
        uint256 expectedEth = _usdcAmount.wdiv(ethUsdPrice).mul(1e12);
        if (_isBuyingUsdc) {
            usdcDebt = IEulerDToken(dToken).balanceOf(address(this)).sub(_usdcAmount);
            ethInCollateral =
                IEulerEToken(eToken).balanceOfUnderlying(address(this)).sub(expectedEth);
        } else {
            usdcDebt = IEulerDToken(dToken).balanceOf(address(this)).add(_usdcAmount);
            ethInCollateral =
                IEulerEToken(eToken).balanceOfUnderlying(address(this)).add(expectedEth);
        }

        uint256 delta = (ethInCollateral.wmul(ethUsdPrice)).wdiv(
            (_crabBalance.wmul(crabUsdPrice)).add(ethInCollateral.wmul(ethUsdPrice)).sub(
                usdcDebt.mul(1e12)
            )
        );

        uint256 cr = ethInCollateral.wmul(ethUsdPrice).wdiv(usdcDebt).div(1e12);
        return (delta, cr);
    }
}
