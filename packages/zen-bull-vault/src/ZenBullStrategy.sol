// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import { IController } from "squeeth-monorepo/interfaces/IController.sol";
import { ICrabStrategyV2 } from "./interface/ICrabStrategyV2.sol";
import { IERC20 } from "openzeppelin/token/ERC20/IERC20.sol";
import { IWETH9 } from "squeeth-monorepo/interfaces/IWETH9.sol";
// contract
import { ERC20 } from "openzeppelin/token/ERC20/ERC20.sol";
import { LeverageZen } from "./LeverageZen.sol";
// lib
import { Address } from "openzeppelin/utils/Address.sol";
import { StrategyMath } from "squeeth-monorepo/strategy/base/StrategyMath.sol";
import { VaultLib } from "squeeth-monorepo/libs/VaultLib.sol";

/**
 * Error codes
 * BS1: Can't receive ETH from this sender
 * BS2: Strategy cap reached max
 * BS3: RedeemShortShutdown must be called first
 * BS4: Emergency shutdown contract needs to initiate the shutdownRepayAndWithdraw call
 * BS5: Can't farm token
 * BS6: Invalid shutdownContract address set
 * BS7: wPowerPerp contract has been shutdown
 * BS8: Caller is not auction address
 * BS9: deposited amount less than minimum
 * BS10: Remaining amount of bull token should be more than minimum or zero
 * BS11: Invalid receiver address
 * BS12: Strategy is shutdown
 */

/**
 * @notice ZenBullStrategy contract
 * @author opyn team
 */
contract ZenBullStrategy is ERC20, LeverageZen {
    using StrategyMath for uint256;
    using Address for address payable;

    /// @dev amount of crab token owned by bull strategy
    uint256 private _crabBalance;
    /// @dev crab contract address
    address public immutable crab;
    /// @dev powerToken controller
    address public immutable powerTokenController;
    /// @dev public emergency shutdown contract
    address public shutdownContract;
    /// @dev the cap in ETH for the strategy, above which deposits will be rejected
    uint256 public strategyCap;
    /// @dev set to true when redeemShortShutdown has been called
    bool public hasRedeemedInShutdown;

    event Withdraw(
        address indexed to,
        uint256 bullAmount,
        uint256 crabToRedeem,
        uint256 wPowerPerpToRedeem,
        uint256 usdcToRepay,
        uint256 wethToWithdraw
    );
    event Deposit(address indexed from, uint256 crabAmount, uint256 wethLent, uint256 usdcBorrowed);
    event SetCap(uint256 oldCap, uint256 newCap);
    event RedeemCrabAndWithdrawEth(
        uint256 indexed crabToRedeem, uint256 wPowerPerpRedeemed, uint256 wethBalanceReturned
    );
    event SetShutdownContract(address oldShutdownContract, address newShutdownContract);
    event ShutdownRepayAndWithdraw(
        uint256 wethToUniswap, uint256 shareToUnwind, uint256 crabToRedeem
    );
    event Farm(address indexed asset, address indexed receiver);
    event DepositEthIntoCrab(uint256 ethToDeposit);
    event WithdrawShutdown(address indexed withdrawer, uint256 bullAmount, uint256 ethToReceive);

    /**
     * @notice constructor for BullStrategy
     * @param _crab crab address
     * @param _powerTokenController wPowerPerp Controller address
     * @param _euler euler address
     * @param _eulerMarketsModule euler markets module address
     */

    constructor(
        address _crab,
        address _powerTokenController,
        address _euler,
        address _eulerMarketsModule
    )
        ERC20("Zen Bull Strategy", "ZenBull")
        LeverageZen(_euler, _eulerMarketsModule, _powerTokenController)
    {
        crab = _crab;
        powerTokenController = _powerTokenController;
        IERC20(IController(_powerTokenController).wPowerPerp()).approve(_crab, type(uint256).max);
    }

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable {
        require(msg.sender == weth || msg.sender == address(crab), "BS1");
    }

    /**
     * @notice withdraw assets transfered directly to this contract
     * @dev can only be called by owner
     * @param _asset asset address
     * @param _receiver receiver address
     */
    function farm(address _asset, address _receiver) external onlyOwner {
        require(!IController(powerTokenController).isShutDown(), "BS7");
        require(!hasRedeemedInShutdown, "BS12");
        require((_asset != crab) && (_asset != eToken) && (_asset != dToken), "BS5");
        require(_receiver != address(0), "BS11");

        if (_asset == address(0)) {
            payable(_receiver).sendValue(address(this).balance);
        } else {
            IERC20(_asset).transfer(_receiver, IERC20(_asset).balanceOf(address(this)));
        }

        emit Farm(_asset, _receiver);
    }

    /**
     * @notice set strategy cap which is checked on deposits and compared against the collateral in Euler
     * @param _cap strategy cap
     */
    function setCap(uint256 _cap) external onlyOwner {
        emit SetCap(strategyCap, _cap);

        strategyCap = _cap;
    }

    /**
     * @notice set shutdown contract that can be used to unwind the strategy if WPowerPerp controller contract is shut down
     * @param _shutdownContract shutdown contract address
     */
    function setShutdownContract(address _shutdownContract) external onlyOwner {
        require(_shutdownContract != address(0), "BS6");

        emit SetShutdownContract(shutdownContract, _shutdownContract);

        shutdownContract = _shutdownContract;
    }

    /**
     * @notice deposit to crab: deposits crab and ETH, receives USDC, wPowerPerp and Bull token
     * @param _crabAmount amount of crab token to deposit
     */
    function deposit(uint256 _crabAmount) external payable {
        require(!IController(powerTokenController).isShutDown(), "BS7");

        IERC20(crab).transferFrom(msg.sender, address(this), _crabAmount);
        uint256 crabBalance = _increaseCrabBalance(_crabAmount);

        uint256 share = ONE;

        if (totalSupply() == 0) {
            _mint(msg.sender, _crabAmount);
        } else {
            share = _crabAmount.wdiv(crabBalance);
            uint256 bullToMint = share.wmul(totalSupply()).wdiv(ONE.sub(share));
            _mint(msg.sender, bullToMint);
        }

        require(totalSupply() > 1e14, "BS9");

        (uint256 ethInCrab, uint256 wPowerPerpInCrab) = _getCrabVaultDetails();
        // deposit eth into leverage component and borrow USDC
        (uint256 wethLent, uint256 usdcBorrowed, uint256 _totalWethInEuler) = _leverageDeposit(
            _crabAmount, share, ethInCrab, wPowerPerpInCrab, IERC20(crab).totalSupply()
        );

        require(_totalWethInEuler <= strategyCap, "BS2");

        // transfer borrowed USDC to depositor
        IERC20(usdc).transfer(msg.sender, usdcBorrowed);

        // refund unused ETH
        payable(msg.sender).sendValue(address(this).balance);

        emit Deposit(msg.sender, _crabAmount, wethLent, usdcBorrowed);
    }

    /**
     * @notice withdraw from crab: repay wPowerPerp, USDC and Bull token and receive ETH
     * @param _bullAmount amount of Bull token to redeem
     */
    function withdraw(uint256 _bullAmount) external {
        uint256 share = _bullAmount.wdiv(totalSupply());
        uint256 crabToRedeem = share.wmul(_crabBalance);
        uint256 crabTotalSupply = IERC20(crab).totalSupply();
        (, uint256 wPowerPerpInCrab) = _getCrabVaultDetails();
        uint256 wPowerPerpToRedeem = crabToRedeem.wmul(wPowerPerpInCrab).wdiv(crabTotalSupply);

        IERC20(wPowerPerp).transferFrom(msg.sender, address(this), wPowerPerpToRedeem);

        _burn(msg.sender, _bullAmount);

        require(totalSupply() == 0 || totalSupply() > 1e14, "BS10");

        _decreaseCrabBalance(crabToRedeem);
        ICrabStrategyV2(crab).withdraw(crabToRedeem);

        (uint256 usdcToRepay,) = _repayAndWithdrawFromLeverage(share);

        emit Withdraw(
            msg.sender,
            _bullAmount,
            crabToRedeem,
            wPowerPerpToRedeem,
            usdcToRepay,
            address(this).balance
            );

        payable(msg.sender).sendValue(address(this).balance);
    }

    /**
     * @notice auction contract redeems some crab to withdraw eth
     * @param _crabToRedeem amount of crab token redeemed by auction
     * @param _wPowerPerpToRedeem amount of wPowerPerp sent back for crab redeem
     */
    function redeemCrabAndWithdrawWEth(uint256 _crabToRedeem, uint256 _wPowerPerpToRedeem)
        external
        returns (uint256)
    {
        require(msg.sender == auction, "BS8");

        IERC20(wPowerPerp).transferFrom(msg.sender, address(this), _wPowerPerpToRedeem);

        uint256 crabBalancebefore = IERC20(crab).balanceOf(address(this));

        ICrabStrategyV2(crab).withdraw(_crabToRedeem);

        _decreaseCrabBalance(crabBalancebefore.sub(IERC20(crab).balanceOf(address(this))));

        uint256 wethBalanceToReturn = address(this).balance;
        IWETH9(weth).deposit{value: wethBalanceToReturn}();
        IWETH9(weth).transfer(msg.sender, wethBalanceToReturn);

        emit RedeemCrabAndWithdrawEth(_crabToRedeem, _wPowerPerpToRedeem, wethBalanceToReturn);

        return wethBalanceToReturn;
    }

    /**
     * @notice auction contract deposits into crab and receives some wPowerPerp
     * @param _ethToDeposit amount of eth to deposit
     */
    function depositEthIntoCrab(uint256 _ethToDeposit) external {
        require(msg.sender == auction, "BS8");

        IWETH9(weth).transferFrom(msg.sender, address(this), _ethToDeposit);
        IWETH9(weth).withdraw(_ethToDeposit);

        uint256 crabBalancebefore = IERC20(crab).balanceOf(address(this));

        ICrabStrategyV2(crab).deposit{value: _ethToDeposit}();

        _increaseCrabBalance(IERC20(crab).balanceOf(address(this)).sub(crabBalancebefore));

        IERC20(wPowerPerp).transfer(msg.sender, IERC20(wPowerPerp).balanceOf(address(this)));

        emit DepositEthIntoCrab(_ethToDeposit);
    }

    /**
     * @notice close out Euler leverage position if contracts have been shut down
     * @param wethToUniswap weth to repay to uniswap via auction contract
     * @param shareToUnwind share of crab to redeem scaled by 1e18
     */
    function shutdownRepayAndWithdraw(uint256 wethToUniswap, uint256 shareToUnwind) external {
        require(msg.sender == shutdownContract, "BS4");
        if (shareToUnwind == ONE) {
            hasRedeemedInShutdown = true;
        }

        uint256 crabToRedeem = shareToUnwind.wmul(ICrabStrategyV2(crab).balanceOf(address(this)));
        _decreaseCrabBalance(crabToRedeem);
        ICrabStrategyV2(crab).withdrawShutdown(crabToRedeem);

        _repayAndWithdrawFromLeverage(shareToUnwind);
        IWETH9(weth).deposit{value: wethToUniswap}();
        IWETH9(weth).transfer(shutdownContract, wethToUniswap);

        emit ShutdownRepayAndWithdraw(wethToUniswap, shareToUnwind, crabToRedeem);
    }

    /**
     * @notice allows a user to withdraw their share of ETH if WPowerPerp controller contracts have been shut down
     * @dev redeemShortShutdown must have been called first
     * @param _bullAmount bull amount to withdraw
     */
    function withdrawShutdown(uint256 _bullAmount) external {
        require(hasRedeemedInShutdown, "BS3");

        uint256 share = _bullAmount.wdiv(totalSupply());
        uint256 ethToReceive = share.wmul(address(this).balance);

        _burn(msg.sender, _bullAmount);

        payable(msg.sender).sendValue(ethToReceive);

        emit WithdrawShutdown(msg.sender, _bullAmount, ethToReceive);
    }

    /**
     * @notice return the internal accounting of the bull strategy's crab balance
     * @return crab token amount hold by the bull strategy
     */
    function getCrabBalance() external view returns (uint256) {
        return _crabBalance;
    }

    /**
     * @notice get crab vault debt and collateral details
     * @return vault eth collateral, vault wPowerPerp debt
     */
    function getCrabVaultDetails() external view returns (uint256, uint256) {
        return _getCrabVaultDetails();
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

    /**
     * @notice get crab vault debt and collateral details
     * @return vault eth collateral, vault wPowerPerp debt
     */
    function _getCrabVaultDetails() internal view returns (uint256, uint256) {
        VaultLib.Vault memory strategyVault =
            IController(powerTokenController).vaults(ICrabStrategyV2(crab).vaultId());

        return (strategyVault.collateralAmount, strategyVault.shortAmount);
    }
}
