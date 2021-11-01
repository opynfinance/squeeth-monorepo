//SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma abicoder v2;

import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";
import {IShortPowerPerp} from "../interfaces/IShortPowerPerp.sol";
import {IOracle} from "../interfaces/IOracle.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {INonfungiblePositionManager} from "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {VaultLib} from "../libs/VaultLib.sol";
import {Power2Base} from "../libs/Power2Base.sol";

contract Controller is Ownable {
    using SafeMath for uint256;
    using VaultLib for VaultLib.Vault;
    using Address for address payable;

    uint32 internal constant SHUTDOWN_PERIOD = 10 minutes;
    uint256 internal constant MIN_COLLATERAL = 0.5 ether;
    /// @dev system can only be paused for 182 days from deployment
    uint256 public constant PAUSE_TIME_LIMIT = 182 days;
    uint256 public constant FUNDING_PERIOD = 1 days;

    address public immutable weth;
    address public immutable quoteCurrency;
    address public immutable ethQuoteCurrencyPool;
    /// @dev address of the powerPerp/weth pool
    address public immutable wPowerPerpPool;
    address public immutable uniswapPositionManager;
    address public immutable shortPowerPerp;
    address public immutable wPowerPerp;
    address public immutable oracle;
    address public feeRecipient;

    uint256 public immutable deployTimestamp;
    /// @dev fee rate in basis point. feeRate of 1 = 0.01%
    uint256 public feeRate;
    /// @dev the settlement price for each wPowerPerp for settlement
    uint256 public indexForSettlement;
    uint256 public normalizationFactor;
    uint256 public lastFundingUpdateTimestamp;
    uint256 public pausesLeft = 4;
    uint256 public lastPauseTime;

    bool public isShutDown;
    bool public isSystemPaused;

    /// @dev vault data storage
    mapping(uint256 => VaultLib.Vault) public vaults;

    /// Events
    event OpenVault(uint256 vaultId);
    event CloseVault(uint256 vaultId);
    event DepositCollateral(uint256 vaultId, uint256 amount, uint128 collateralId);
    event DepositUniPositionToken(uint256 vaultId, uint256 tokenId);
    event WithdrawCollateral(uint256 vaultId, uint256 amount, uint128 collateralId);
    event WithdrawUniPositionToken(uint256 vaultId, uint256 tokenId);
    event MintShort(uint256 amount, uint256 vaultId);
    event BurnShort(uint256 amount, uint256 vaultId);
    event UpdateOperator(uint256 vaultId, address operator);
    event FeeRateUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address oldFeeRecipient, address newFeeRecipient);
    event Liquidate(uint256 vaultId, uint256 debtAmount, uint256 collateralPaid);
    event NormalizationFactorUpdated(uint256 oldNormFactor, uint256 newNormFactor, uint256 timestamp);

    modifier notPaused() {
        require(!isSystemPaused, "Paused");
        _;
    }

    modifier isPaused() {
        require(isSystemPaused, "Not paused");
        _;
    }

    modifier notShutdown() {
        require(!isShutDown, "Shutdown");
        _;
    }

    modifier isShutdown() {
        require(isShutDown, "Not shutdown");
        _;
    }

    /**
     * @notice constructor
     * @param _oracle oracle address
     * @param _shortPowerPerp ERC721 token address representing the short position
     * @param _wPowerPerp ERC20 token address representing the long position
     * @param _weth weth address
     * @param _quoteCurrency quoteCurrency address
     * @param _ethQuoteCurrencyPool uniswap v3 pool for weth / quoteCurrency
     * @param _wPowerPerpPool uniswap v3 pool for wPowerPerp / weth
     * @param _uniPositionManager uniswap v3 position manager address
     */
    constructor(
        address _oracle,
        address _shortPowerPerp,
        address _wPowerPerp,
        address _weth,
        address _quoteCurrency,
        address _ethQuoteCurrencyPool,
        address _wPowerPerpPool,
        address _uniPositionManager
    ) {
        require(_oracle != address(0), "Invalid oracle address");
        require(_shortPowerPerp != address(0), "Invalid shortPowerPerp address");
        require(_wPowerPerp != address(0), "Invalid power perp address");
        require(_weth != address(0), "Invalid weth address");
        require(_quoteCurrency != address(0), "Invalid quote currency address");
        require(_ethQuoteCurrencyPool != address(0), "Invalid eth:quoteCurrency pool address");
        require(_wPowerPerpPool != address(0), "Invalid powerperp:eth pool address");
        require(_uniPositionManager != address(0), "Invalid uni position manager");

        oracle = _oracle;
        shortPowerPerp = _shortPowerPerp;
        wPowerPerp = _wPowerPerp;
        weth = _weth;
        quoteCurrency = _quoteCurrency;
        ethQuoteCurrencyPool = _ethQuoteCurrencyPool;
        wPowerPerpPool = _wPowerPerpPool;
        uniswapPositionManager = _uniPositionManager;

        deployTimestamp = block.timestamp;
        normalizationFactor = 1e18;
        lastFundingUpdateTimestamp = block.timestamp;
    }

    /**
     * ======================
     * | External Functions |
     * ======================
     */

    /**
     * @notice returns the expected normalization factor, if the funding is paid right now
     * @dev can be used for on-chain and off-chain calculations
     */
    function getExpectedNormalizationFactor() external view returns (uint256) {
        return _getNewNormalizationFactor();
    }

    /**
     * @notice get the index price of the powerPerp, scaled down
     * @dev the index price is scaled down by INDEX_SCALE in the associated PowerXBase library
     * @dev this is the index price used when calculating funding and for collateralization
     * @param _period period which you want to calculate twap with
     * @return index price denominated in $USD, scaled by 1e18
     */
    function getIndex(uint32 _period) external view returns (uint256) {
        return Power2Base._getIndex(_period, address(oracle), ethQuoteCurrencyPool, weth, quoteCurrency);
    }

    /**
     * @notice get the expected mark price of powerPerp after funding has been applied
     * @dev this is the mark that would be be used for future funding after a new normalization factor is applied
     * @param _period period which you want to calculate twap with
     * @return index price denominated in $USD, scaled by 1e18
     */
    function getUnscaledIndex(uint32 _period) external view returns (uint256) {
        return Power2Base._getUnscaledIndex(_period, address(oracle), ethQuoteCurrencyPool, weth, quoteCurrency);
    }

    /**
     * @notice get the mark price (after funding) of powerPerp as the twap divided by the normalization factor
     * @param _period period of time for the twap in seconds
     * @return mark price denominated in $USD, scaled by 1e18
     */
    function getDenormalizedMark(uint32 _period) external view returns (uint256) {
        uint256 expectedNormalizationFactor = _getNewNormalizationFactor();

        return
            Power2Base._getDenormalizedMark(
                _period,
                address(oracle),
                wPowerPerpPool,
                ethQuoteCurrencyPool,
                weth,
                quoteCurrency,
                address(wPowerPerp),
                expectedNormalizationFactor
            );
    }

    /**
     * @notice get the mark price of powerPerp before funding has been applied
     * @dev this is the mark that would be used to calculate a new normalization factor if funding was calculated now
     * @param _period period which you want to calculate twap with
     * @return mark price denominated in $USD, scaled by 1e18
     */
    function getDenormalizedMarkForFunding(uint32 _period) external view returns (uint256) {
        return
            Power2Base._getDenormalizedMark(
                _period,
                address(oracle),
                wPowerPerpPool,
                ethQuoteCurrencyPool,
                weth,
                quoteCurrency,
                address(wPowerPerp),
                normalizationFactor
            );
    }

    /**
     * @dev return if the vault is properly collateralized
     * @param _vaultId id of the vault
     * @return true if the vault is properly collateralized
     */
    function isVaultSafe(uint256 _vaultId) external view returns (bool) {
        VaultLib.Vault memory vault = vaults[_vaultId];
        uint256 expectedNormalizationFactor = _getNewNormalizationFactor();
        return _isVaultSafe(vault, expectedNormalizationFactor);
    }

    /**
     * @notice deposit collateral and mint wPowerPerp (non-rebasing) for specified powerPerp (rebasing) amount
     * @param _vaultId vault to mint wPowerPerp in
     * @param _powerPerpAmount amount of powerPerp to mint
     * @param _uniTokenId uniswap v3 position token id (additional collateral)
     * @return vaultId
     * @return amount of wPowerPerp minted
     */
    function mintPowerPerpAmount(
        uint256 _vaultId,
        uint128 _powerPerpAmount,
        uint256 _uniTokenId
    ) external payable notPaused returns (uint256, uint256) {
        return _openDepositMint(msg.sender, _vaultId, _powerPerpAmount, msg.value, _uniTokenId, false);
    }

    /**
     * @notice deposit collateral and mint wPowerPerp
     * @param _vaultId vault to mint wPowerPerp in
     * @param _wPowerPerpAmount amount of wPowerPerp to mint
     * @param _uniTokenId uniswap v3 position token id (additional collateral)
     * @return vaultId
     */
    function mintWPowerPerpAmount(
        uint256 _vaultId,
        uint128 _wPowerPerpAmount,
        uint256 _uniTokenId
    ) external payable notPaused returns (uint256) {
        (uint256 vaultId, ) = _openDepositMint(msg.sender, _vaultId, _wPowerPerpAmount, msg.value, _uniTokenId, true);
        return vaultId;
    }

    /**
     * @dev deposit collateral into a vault
     * @param _vaultId id of the vault
     */
    function deposit(uint256 _vaultId) external payable notPaused {
        _checkVaultId(_vaultId);
        _applyFunding();
        VaultLib.Vault memory cachedVault = vaults[_vaultId];
        _addEthCollateral(cachedVault, _vaultId, msg.value);

        _writeVault(_vaultId, cachedVault);
    }

    /**
     * @notice deposit uniswap position token into a vault to increase collateral ratio
     * @param _vaultId id of the vault
     * @param _uniTokenId uniswap position token id
     */
    function depositUniPositionToken(uint256 _vaultId, uint256 _uniTokenId) external notPaused {
        _checkVaultId(_vaultId);
        _applyFunding();
        VaultLib.Vault memory cachedVault = vaults[_vaultId];

        _depositUniPositionToken(cachedVault, msg.sender, _vaultId, _uniTokenId);
        _writeVault(_vaultId, cachedVault);
    }

    /**
     * @notice withdraw collateral from a vault
     * @param _vaultId id of the vault
     * @param _amount amount of eth to withdraw
     */
    function withdraw(uint256 _vaultId, uint256 _amount) external payable notPaused {
        uint256 cachedNormFactor = _applyFunding();
        VaultLib.Vault memory cachedVault = vaults[_vaultId];

        _withdrawCollateral(cachedVault, msg.sender, _vaultId, _amount);
        _checkVault(cachedVault, cachedNormFactor);
        _writeVault(_vaultId, cachedVault);
        payable(msg.sender).sendValue(_amount);
    }

    /**
     * @notice withdraw uniswap v3 position token from a vault
     * @param _vaultId id of the vault
     */
    function withdrawUniPositionToken(uint256 _vaultId) external notPaused {
        uint256 cachedNormFactor = _applyFunding();
        VaultLib.Vault memory cachedVault = vaults[_vaultId];
        _withdrawUniPositionToken(cachedVault, msg.sender, _vaultId);
        _checkVault(cachedVault, cachedNormFactor);
        _writeVault(_vaultId, cachedVault);
    }

    /**
     * @notice burn wPowerPerp and remove collateral from a vault
     * @param _vaultId id of the vault
     * @param _wPowerPerpAmount amount of wPowerPerp to burn
     * @param _withdrawAmount amount of eth to withdraw
     */
    function burnWPowerPerpAmount(
        uint256 _vaultId,
        uint256 _wPowerPerpAmount,
        uint256 _withdrawAmount
    ) external notPaused {
        _burnAndWithdraw(msg.sender, _vaultId, _wPowerPerpAmount, _withdrawAmount, true);
    }

    /**
     * @notice burn powerPerp and remove collateral from a vault
     * @param _vaultId id of the vault
     * @param _powerPerpAmount amount of powerPerp to burn
     * @param _withdrawAmount amount of eth to withdraw
     * @return amount of wPowerPerp burned
     */
    function burnPowerPerpAmount(
        uint256 _vaultId,
        uint256 _powerPerpAmount,
        uint256 _withdrawAmount
    ) external notPaused returns (uint256) {
        return _burnAndWithdraw(msg.sender, _vaultId, _powerPerpAmount, _withdrawAmount, false);
    }

    /**
     * @notice after the system is shutdown, insolvent vaults need to be have their uniswap v3 token assets withdrawn by force
     * @notice if a vault has a uniswap v3 position in it, anyone can call to withdraw uniswap v3 token assets, reducing debt and increasing collateral in the vault
     * @dev the caller won't get any bounty. this is expected to be used for insolvent vaults in shutdown
     * @param _vaultId vault containing uniswap v3 position to liquidate
     */
    function reduceDebtShutdown(uint256 _vaultId) external isShutdown {
        VaultLib.Vault memory cachedVault = vaults[_vaultId];
        _reduceDebt(cachedVault, IShortPowerPerp(shortPowerPerp).ownerOf(_vaultId), normalizationFactor, false);
        _writeVault(_vaultId, cachedVault);
    }

    /**
     * @notice withdraw assets from uniswap v3 position, reducing debt and increasing collateral in the vault
     * @dev the caller won't get any bounty. this is expected to be used by vault owner
     * @param _vaultId target vault
     */
    function reduceDebt(uint256 _vaultId) external notPaused {
        require(_canModifyVault(_vaultId, msg.sender), "Not allowed");
        uint256 cachedNormFactor = _applyFunding();
        VaultLib.Vault memory cachedVault = vaults[_vaultId];

        _reduceDebt(cachedVault, IShortPowerPerp(shortPowerPerp).ownerOf(_vaultId), cachedNormFactor, false);

        _writeVault(_vaultId, cachedVault);
    }

    /**
     * @notice if a vault is under the 150% collateral ratio, anyone can liquidate the vault by burning wPowerPerp
     * @dev liquidator can get back (wPowerPerp burned) * (index price) * (normalizationFactor)  * 110% in collateral
     * @dev normally can only liquidate 50% of a vault's debt
     * @dev if a vault is under dust limit after a liquidation can fully liquidate
     * @dev will attempt to reduceDebt first, and can earn a bounty if sucessful
     * @param _vaultId vault to liquidate
     * @param _maxDebtAmount max amount of wPowerPerpetual to repay
     * @return amount of wPowerPerp repaid
     */
    function liquidate(uint256 _vaultId, uint256 _maxDebtAmount) external notPaused returns (uint256) {
        _checkVaultId(_vaultId);
        uint256 cachedNormFactor = _applyFunding();

        VaultLib.Vault memory cachedVault = vaults[_vaultId];

        require(!_isVaultSafe(cachedVault, cachedNormFactor), "Can not liquidate safe vault");

        // try to save target vault before liquidation by reducing debt
        uint256 bounty = _reduceDebt(
            cachedVault,
            IShortPowerPerp(shortPowerPerp).ownerOf(_vaultId),
            cachedNormFactor,
            true
        );

        // if vault is safe after saving, pay bounty and return early
        if (_isVaultSafe(cachedVault, cachedNormFactor)) {
            _writeVault(_vaultId, cachedVault);
            payable(msg.sender).sendValue(bounty);
            return 0;
        }

        // add back the bounty amount, liquidators onlly get reward from liquidation
        cachedVault.addEthCollateral(bounty);

        // if the vault is still not safe after saving, liquidate it
        (uint256 debtAmount, uint256 collateralPaid) = _liquidate(
            cachedVault,
            _maxDebtAmount,
            cachedNormFactor,
            msg.sender
        );

        emit Liquidate(_vaultId, debtAmount, collateralPaid);

        _writeVault(_vaultId, cachedVault);

        // pay the liquidator
        payable(msg.sender).sendValue(collateralPaid);

        return debtAmount;
    }

    /**
     * @notice authorize an address to modify the vault
     * @dev can be revoke by setting address to 0
     * @param _vaultId id of the vault
     * @param _operator new operator address
     */
    function updateOperator(uint256 _vaultId, address _operator) external {
        require(IShortPowerPerp(shortPowerPerp).ownerOf(_vaultId) == msg.sender, "Not allowed");
        vaults[_vaultId].operator = _operator;
        emit UpdateOperator(_vaultId, _operator);
    }

    /**
     * @notice set the recipient who will receive the fee
     * @dev this should be a contract handling insurance
     * @param _newFeeRecipient new fee recipient
     */
    function setFeeRecipient(address _newFeeRecipient) external onlyOwner {
        require(_newFeeRecipient != address(0), "Invalid address");
        emit FeeRecipientUpdated(feeRecipient, _newFeeRecipient);
        feeRecipient = _newFeeRecipient;
    }

    /**
     * @notice set the fee rate when user mints
     * @dev this function cannot be called if the feeRecipient is still un-set
     * @param _newFeeRate new fee rate in basis points. can't be higher than 1%
     */
    function setFeeRate(uint256 _newFeeRate) external onlyOwner {
        require(feeRecipient != address(0), "Set fee recipient first");
        require(_newFeeRate <= 100, "Fee too high");
        emit FeeRateUpdated(feeRate, _newFeeRate);
        feeRate = _newFeeRate;
    }

    /**
     * @notice pause and then immediately shutdown the system
     * @dev this bypasses the check on number of pauses or time based checks, but is irreversible and enables emergency settlement
     */
    function pauseAndShutDown() external notShutdown notPaused onlyOwner {
        isSystemPaused = true;
        isShutDown = true;
        indexForSettlement = Power2Base._getScaledTwap(address(oracle), ethQuoteCurrencyPool, weth, quoteCurrency, 600);
    }

    /**
     * @notice shutdown the system and enable system settlement
     */
    function shutDown() external notShutdown isPaused onlyOwner {
        isShutDown = true;
        indexForSettlement = Power2Base._getScaledTwap(address(oracle), ethQuoteCurrencyPool, weth, quoteCurrency, 600);
    }

    /**
     * @notice pause the system for up to 24 hours after which any one can unpause
     * @dev can only be called for 365 days since the contract was launched or 4 times
     */
    function pause() external notShutdown notPaused onlyOwner {
        require(pausesLeft > 0, "Paused too many times");
        uint256 timeSinceDeploy = block.timestamp.sub(deployTimestamp);
        require(timeSinceDeploy < PAUSE_TIME_LIMIT, "Pause time limit exceeded");
        isSystemPaused = true;
        pausesLeft -= 1;
        lastPauseTime = block.timestamp;
    }

    /**
     * @notice unpause the contract
     * @dev anyone can unpause the contract after 24 hours
     */
    function unPauseAnyone() external notShutdown isPaused {
        require(block.timestamp > (lastPauseTime + 1 days), "Not enough paused time has passed");
        isSystemPaused = false;
    }

    /**
     * @notice unpause the contract
     * @dev owner can unpause at any time
     */
    function unPauseOwner() external notShutdown isPaused onlyOwner {
        isSystemPaused = false;
    }

    /**
     * @notice redeem wPowerPerp for (settlement index value) * normalizationFactor when the system is shutdown
     * @param _wPerpAmount amount of wPowerPerp to burn
     */
    function redeemLong(uint256 _wPerpAmount) external isShutdown {
        IWPowerPerp(wPowerPerp).burn(msg.sender, _wPerpAmount);

        uint256 longValue = Power2Base._getLongSettlementValue(_wPerpAmount, indexForSettlement, normalizationFactor);
        payable(msg.sender).sendValue(longValue);
    }

    /**
     * @notice redeem short position when the system is shutdown
     * @dev short position is redeemed by valuing the debt at the (settlement index value) * normalizationFactor
     * @param _vaultId vault id
     */
    function redeemShort(uint256 _vaultId) external isShutdown {
        require(_canModifyVault(_vaultId, msg.sender), "Not allowed");

        VaultLib.Vault memory cachedVault = vaults[_vaultId];
        uint256 cachedNormFactor = normalizationFactor;

        _reduceDebt(cachedVault, msg.sender, cachedNormFactor, false);

        uint256 debt = Power2Base._getLongSettlementValue(
            cachedVault.shortAmount,
            indexForSettlement,
            normalizationFactor
        );
        // if the debt is more than collateral, this line will revert
        uint256 excess = uint256(cachedVault.collateralAmount).sub(debt);

        // reset the vault but don't burn the nft, just because people may want to keep it
        cachedVault.shortAmount = 0;
        cachedVault.collateralAmount = 0;
        _writeVault(_vaultId, cachedVault);

        payable(msg.sender).sendValue(excess);
    }

    /**
     * @notice update the normalization factor as a way to pay funding
     */
    function applyFunding() external notPaused {
        _applyFunding();
    }

    /**
     * @notice add eth into a contract. used in case contract has insufficient eth to pay for settlement transactions
     */
    function donate() external payable isShutdown {}

    /**
     * @notice fallback function to accept eth
     */
    receive() external payable {
        require(msg.sender == weth, "Cannot receive eth");
    }

    /*
     * ======================
     * | Internal Functions |
     * ======================
     */

    /**
     * @notice check if a vaultId is valid, reverts if it's not valid
     * @param _vaultId the id to check
     */
    function _checkVaultId(uint256 _vaultId) internal view {
        require(_vaultId > 0 && _vaultId < IShortPowerPerp(shortPowerPerp).nextId(), "Invalid vault id");
    }

    /**
     * @notice returns if an address can modify a vault
     * @param _vaultId the id of the vault to check if can be modified by _account
     * @param _account the address to check if can modify the vault
     * @return true if the address can modify the vault
     */
    function _canModifyVault(uint256 _vaultId, address _account) internal view returns (bool) {
        return IShortPowerPerp(shortPowerPerp).ownerOf(_vaultId) == _account || vaults[_vaultId].operator == _account;
    }

    /**
     * @notice wrapper function which open a vault, add collateral and mint wPowerPerp
     * @param _account account to receive wPowerPerp
     * @param _vaultId id of the vault
     * @param _mintAmount amount to mint
     * @param _depositAmount amount of eth as collateral
     * @param _uniTokenId id of uniswap v3 position token
     * @param _isWAmount if the input amount is wPowerPerp (as opposed to rebasing powerPerp)
     * @return vaultId
     * @return total minted wPowerPower amount
     */
    function _openDepositMint(
        address _account,
        uint256 _vaultId,
        uint256 _mintAmount,
        uint256 _depositAmount,
        uint256 _uniTokenId,
        bool _isWAmount
    ) internal returns (uint256, uint256) {
        uint256 cachedNormFactor = _applyFunding();
        uint256 depositAmountWithFee = _depositAmount;
        uint256 wPowerPerpAmount = _isWAmount ? _mintAmount : _mintAmount.mul(1e18).div(cachedNormFactor);
        uint256 feeAmount;
        VaultLib.Vault memory cachedVault;

        // load vault or create new a new one
        if (_vaultId == 0) {
            (_vaultId, cachedVault) = _openVault(_account);
        } else {
            cachedVault = vaults[_vaultId];
        }

        if (wPowerPerpAmount > 0) {
            (feeAmount, depositAmountWithFee) = _payFee(cachedVault, wPowerPerpAmount, _depositAmount);
        }
        if (_depositAmount > 0) _addEthCollateral(cachedVault, _vaultId, depositAmountWithFee);
        if (_uniTokenId != 0) _depositUniPositionToken(cachedVault, _account, _vaultId, _uniTokenId);

        if (wPowerPerpAmount > 0) _mintWPowerPerp(cachedVault, _account, _vaultId, wPowerPerpAmount);

        _checkVault(cachedVault, cachedNormFactor);
        _writeVault(_vaultId, cachedVault);

        //pay insurance fee
        if (wPowerPerpAmount > 0) payable(feeRecipient).sendValue(feeAmount);

        return (_vaultId, wPowerPerpAmount);
    }

    /**
     * @notice wrapper function to burn wPowerPerp and redeem collateral
     * @param _account who should receive collateral
     * @param _vaultId id of the vault
     * @param _burnAmount amount of wPowerPerp to burn
     * @param _withdrawAmount amount of eth collateral to withdraw
     * @param _isWAmount true if the amount is wPowerPerp (as opposed to rebasing powerPerp)
     * @return total burned wPowerPower amount
     */
    function _burnAndWithdraw(
        address _account,
        uint256 _vaultId,
        uint256 _burnAmount,
        uint256 _withdrawAmount,
        bool _isWAmount
    ) internal returns (uint256) {
        _checkVaultId(_vaultId);
        uint256 cachedNormFactor = _applyFunding();
        uint256 wBurnAmount = _isWAmount ? _burnAmount : _burnAmount.mul(1e18).div(cachedNormFactor);

        VaultLib.Vault memory cachedVault = vaults[_vaultId];
        if (wBurnAmount > 0) _burnWPowerPerp(cachedVault, _account, _vaultId, wBurnAmount);
        if (_withdrawAmount > 0) _withdrawCollateral(cachedVault, _account, _vaultId, _withdrawAmount);
        _checkVault(cachedVault, cachedNormFactor);
        _writeVault(_vaultId, cachedVault);

        if (_withdrawAmount > 0) payable(msg.sender).sendValue(_withdrawAmount);

        return wBurnAmount;
    }

    /**
     * @notice open a new vault
     * @dev create a new vault and bind it with a new short vault id
     * @param _recipient owner of new vault
     * @return id of the new vault
     * @return new in-memory vault
     */
    function _openVault(address _recipient) internal returns (uint256, VaultLib.Vault memory) {
        uint256 vaultId = IShortPowerPerp(shortPowerPerp).mintNFT(_recipient);

        VaultLib.Vault memory vault = VaultLib.Vault({
            NftCollateralId: 0,
            collateralAmount: 0,
            shortAmount: 0,
            operator: address(0)
        });
        emit OpenVault(vaultId);
        return (vaultId, vault);
    }

    /**
     * @notice deposit uniswap v3 position token into a vault
     * @dev this function will update the vault memory in-place
     * @param _vault the Vault memory to update
     * @param _account account to transfer the uniswap v3 position from
     * @param _vaultId id of the vault
     * @param _uniTokenId uniswap position token id
     */
    function _depositUniPositionToken(
        VaultLib.Vault memory _vault,
        address _account,
        uint256 _vaultId,
        uint256 _uniTokenId
    ) internal {
        _checkUniNFT(_uniTokenId);
        _vault.addUniNftCollateral(_uniTokenId);
        INonfungiblePositionManager(uniswapPositionManager).transferFrom(_account, address(this), _uniTokenId);
        emit DepositUniPositionToken(_vaultId, _uniTokenId);
    }

    /**
     * @notice add eth collateral into a vault
     * @dev this function will update the vault memory in-place
     * @param _vault the Vault memory to update.
     * @param _amount amount of eth adding to the vault
     */
    function _addEthCollateral(
        VaultLib.Vault memory _vault,
        uint256 _vaultId,
        uint256 _amount
    ) internal {
        _vault.addEthCollateral(_amount);
        emit DepositCollateral(_vaultId, _amount, 0);
    }

    /**
     * @notice remove uniswap v3 position token from the vault
     * @dev this function will update the vault memory in-place
     * @param _vault the Vault memory to update
     * @param _account where to send the uni position token to
     * @param _vaultId id of the vault
     */
    function _withdrawUniPositionToken(
        VaultLib.Vault memory _vault,
        address _account,
        uint256 _vaultId
    ) internal {
        require(_canModifyVault(_vaultId, _account), "Not allowed");

        uint256 tokenId = _vault.NftCollateralId;
        _vault.removeUniNftCollateral();
        INonfungiblePositionManager(uniswapPositionManager).transferFrom(address(this), _account, tokenId);
        emit WithdrawUniPositionToken(_vaultId, tokenId);
    }

    /**
     * @notice remove eth collateral from the vault
     * @dev this function will update the vault memory in-place
     * @param _vault the Vault memory to update
     * @param _account where to send collateral to
     * @param _vaultId id of the vault
     * @param _amount amount of eth to withdraw
     */
    function _withdrawCollateral(
        VaultLib.Vault memory _vault,
        address _account,
        uint256 _vaultId,
        uint256 _amount
    ) internal {
        require(_canModifyVault(_vaultId, _account), "Not allowed");

        _vault.removeEthCollateral(_amount);

        emit WithdrawCollateral(_vaultId, _amount, 0);
    }

    /**
     * @notice mint wPowerPerp (ERC20) to an account
     * @dev this function will update the vault memory in-place
     * @param _vault the Vault memory to update
     * @param _account account to receive wPowerPerp
     * @param _vaultId id of the vault
     * @param _wPowerPerpAmount wPowerPerp amount to mint
     */
    function _mintWPowerPerp(
        VaultLib.Vault memory _vault,
        address _account,
        uint256 _vaultId,
        uint256 _wPowerPerpAmount
    ) internal {
        require(_canModifyVault(_vaultId, _account), "Not allowed");

        _vault.addShort(_wPowerPerpAmount);
        IWPowerPerp(wPowerPerp).mint(_account, _wPowerPerpAmount);

        emit MintShort(_wPowerPerpAmount, _vaultId);
    }

    /**
     * @notice burn wPowerPerp (ERC20) from an account
     * @dev this function will update the vault memory in-place
     * @param _vault the Vault memory to update
     * @param _account account burning the wPowerPerp
     * @param _vaultId id of the vault
     * @param _wPowerPerpAmount wPowerPerp amount to burn
     */
    function _burnWPowerPerp(
        VaultLib.Vault memory _vault,
        address _account,
        uint256 _vaultId,
        uint256 _wPowerPerpAmount
    ) internal {
        _vault.removeShort(_wPowerPerpAmount);
        IWPowerPerp(wPowerPerp).burn(_account, _wPowerPerpAmount);

        emit BurnShort(_wPowerPerpAmount, _vaultId);
    }

    /**
     * @notice liquidate a vault, pay the liquidator
     * @dev liquidator can only liquidate at most 1/2 of the vault in 1 transaction
     * @dev this function will update the vault memory in-place
     * @param _vault the Vault memory to update
     * @param _maxWPowerPerpAmount maximum debt amount liquidator is willing to repay
     * @param _normalizationFactor current normalization factor
     * @param _liquidator liquidator address to receive eth
     * @return debtAmount amount of wPowerPerp repaid (burn from the vault)
     * @return collateralToPay amount of collateral paid to liquidator
     */
    function _liquidate(
        VaultLib.Vault memory _vault,
        uint256 _maxWPowerPerpAmount,
        uint256 _normalizationFactor,
        address _liquidator
    ) internal returns (uint256, uint256) {
        // cast numbers to uint256 and cache them
        uint256 vaultShortAmount = uint256(_vault.shortAmount);
        uint256 vaultCollateralAmount = uint256(_vault.collateralAmount);

        // try limiting liquidation amount to half of the vault debt
        (uint256 wAmountToLiquidate, uint256 collateralToPay) = _getLiquidationAmount(
            _maxWPowerPerpAmount,
            vaultShortAmount.div(2),
            _normalizationFactor
        );

        if (vaultCollateralAmount > collateralToPay) {
            if (vaultCollateralAmount.sub(collateralToPay) < MIN_COLLATERAL) {
                // the vault is left with dust after liquidation, allow liquidating full vault
                // calculate the new liquidation amount and collateral again based on the new limit
                (wAmountToLiquidate, collateralToPay) = _getLiquidationAmount(
                    _maxWPowerPerpAmount,
                    vaultShortAmount,
                    _normalizationFactor
                );
            }
        }

        // check if final collateral to pay is greater than vault amount.
        // if so the system only pays out the amount the vault has, which may not be profitable
        if (collateralToPay > vaultCollateralAmount) {
            // force liquidator to pay full debt amount
            require(_maxWPowerPerpAmount >= vaultShortAmount, "Need full liquidation");
            collateralToPay = vaultCollateralAmount;
            wAmountToLiquidate = vaultShortAmount;
        }

        IWPowerPerp(wPowerPerp).burn(_liquidator, wAmountToLiquidate);
        _vault.removeShort(wAmountToLiquidate);
        _vault.removeEthCollateral(collateralToPay);

        (, bool isDust) = _getVaultStatus(_vault, _normalizationFactor);
        require(!isDust, "Dust vault left");

        return (wAmountToLiquidate, collateralToPay);
    }

    /**
     * @notice redeem uniswap v3 position in a vault for its constituent eth and wSqueeth
     * @notice this will increase vault collateral by the amount of eth, and decrease debt by the amount of wSqueeth
     * @dev will be executed before liquidation if there's an NFT in the vault
     * @dev pays a 2% bounty to the liquidator if called by liquidate()
     * @dev will update the vault memory in-place
     * @param _vault the Vault memory to update
     * @param _owner account to send any excess
     * @param _payBounty true if paying caller 2% bounty
     * @return bounty amount of bounty paid for liquidator
     */
    function _reduceDebt(
        VaultLib.Vault memory _vault,
        address _owner,
        uint256 _normalizationFactor,
        bool _payBounty
    ) internal returns (uint256) {
        uint256 nftId = _vault.NftCollateralId;
        if (nftId == 0) return 0;

        (uint256 withdrawnEthAmount, uint256 withdrawnWPowerPerpAmount) = _redeemUniToken(nftId);

        // change weth back to eth
        if (withdrawnEthAmount > 0) IWETH9(weth).withdraw(withdrawnEthAmount);

        // the bounty is 2% on top of total value withdrawn from the NFT
        uint256 bounty;
        if (_payBounty) {
            uint256 totalValue = Power2Base
                ._getCollateralByRepayAmount(
                    withdrawnWPowerPerpAmount,
                    address(oracle),
                    ethQuoteCurrencyPool,
                    weth,
                    quoteCurrency,
                    _normalizationFactor
                )
                .add(withdrawnEthAmount);

            bounty = totalValue.mul(2).div(100);
        }

        _vault.removeUniNftCollateral();
        _vault.addEthCollateral(withdrawnEthAmount);
        _vault.removeEthCollateral(bounty);

        // burn min of (shortAmount, withdrawnWPowerPerpAmount) from the vault
        if (withdrawnWPowerPerpAmount > _vault.shortAmount) {
            uint256 excess = withdrawnWPowerPerpAmount.sub(_vault.shortAmount);
            withdrawnWPowerPerpAmount = _vault.shortAmount;
            IWPowerPerp(wPowerPerp).transfer(_owner, excess);
        }

        _vault.removeShort(withdrawnWPowerPerpAmount);
        IWPowerPerp(wPowerPerp).burn(address(this), withdrawnWPowerPerpAmount);

        return bounty;
    }

    /**
     * @notice pay fee recipient
     * @dev pay in eth from either the vault or the deposit amount
     * @param _vault the Vault memory to update
     * @param _wSqueethAmount the amount of wSqueeth minting
     * @param _depositAmount the amount of eth depositing or withdrawing
     * @return the amount of actual deposited eth into the vault, this is less than the original amount if a fee was taken
     */
    function _payFee(
        VaultLib.Vault memory _vault,
        uint256 _wSqueethAmount,
        uint256 _depositAmount
    ) internal view returns (uint256, uint256) {
        uint256 cachedFeeRate = feeRate;
        if (cachedFeeRate == 0) return (uint256(0), _depositAmount);
        uint256 depositAmountAfterFee;
        uint256 ethEquivalentMinted = Power2Base._getCollateralByRepayAmount(
            _wSqueethAmount,
            address(oracle),
            ethQuoteCurrencyPool,
            weth,
            quoteCurrency,
            normalizationFactor
        );
        uint256 feeAmount = ethEquivalentMinted.mul(cachedFeeRate).div(10000);

        // if fee can be paid from deposited collateral, pay from _depositAmount
        if (_depositAmount > feeAmount) {
            depositAmountAfterFee = _depositAmount.sub(feeAmount);
            // if not, adjust the vault to pay from the vault collateral
        } else {
            _vault.removeEthCollateral(feeAmount);
            depositAmountAfterFee = _depositAmount;
        }
        //return the fee and deposit amount, which has only been reduced by a fee if it is paid out of the deposit amount
        return (feeAmount, depositAmountAfterFee);
    }

    /**
     * @notice write vault to storage
     * @dev writes to vaults mapping
     */
    function _writeVault(uint256 _vaultId, VaultLib.Vault memory _vault) private {
        vaults[_vaultId] = _vault;
    }

    /**
     * @dev redeem a uni position token and get back wPowerPerp and eth
     * @param _uniTokenId uniswap v3 position token id
     * @return wethAmount amount of weth withdrawn from uniswap
     * @return wPowerPerpAmount amount of wPowerPerp withdrawn from uniswap
     */
    function _redeemUniToken(uint256 _uniTokenId) internal returns (uint256, uint256) {
        INonfungiblePositionManager positionManager = INonfungiblePositionManager(uniswapPositionManager);

        (, , uint128 liquidity) = VaultLib._getUniswapPositionInfo(uniswapPositionManager, _uniTokenId);

        // prepare parameters to withdraw liquidity from uniswap v3 position manager
        INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseParams = INonfungiblePositionManager
            .DecreaseLiquidityParams({
                tokenId: _uniTokenId,
                liquidity: liquidity,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            });

        // the decreaseLiquidity function returns the amount collectable by the owner
        (uint256 amount0, uint256 amount1) = positionManager.decreaseLiquidity(decreaseParams);

        // withdraw weth and wPowerPerp from uniswap
        INonfungiblePositionManager.CollectParams memory collectParams = INonfungiblePositionManager.CollectParams({
            tokenId: _uniTokenId,
            recipient: address(this),
            amount0Max: uint128(amount0),
            amount1Max: uint128(amount1)
        });

        (uint256 collectedToken0, uint256 collectedToken1) = positionManager.collect(collectParams);

        bool cacheIsWethToken0 = weth < wPowerPerp;
        uint256 wethAmount = cacheIsWethToken0 ? collectedToken0 : collectedToken1;
        uint256 wPowerPerpAmount = cacheIsWethToken0 ? collectedToken1 : collectedToken0;

        return (wethAmount, wPowerPerpAmount);
    }

    /**
     * @notice update the normalization factor as a way to pay in-kind funding
     * @dev the normalization factor scales amount of debt that must be repaid, effecting an interest rate paid between long and short positions
     * @return new normalization factor
     **/
    function _applyFunding() internal returns (uint256) {
        // only update the norm factor once per block
        if (lastFundingUpdateTimestamp == block.timestamp) return normalizationFactor;

        uint256 newNormalizationFactor = _getNewNormalizationFactor();

        emit NormalizationFactorUpdated(normalizationFactor, newNormalizationFactor, block.timestamp);

        normalizationFactor = newNormalizationFactor;
        lastFundingUpdateTimestamp = block.timestamp;

        return newNormalizationFactor;
    }

    /**
     * @dev calculate new normalization factor base on the current timestamp
     * @return new normalization factor if funding happens in the current block
     */
    function _getNewNormalizationFactor() internal view returns (uint256) {
        uint32 period = uint32(block.timestamp.sub(lastFundingUpdateTimestamp));

        if (period == 0) {
            return normalizationFactor;
        }

        // make sure we use the same period for mark and index
        uint32 fairPeriod = _getFairPeriodForOracle(period);

        // avoid reading normalizationFactor from storage multiple times
        uint256 cacheNormFactor = normalizationFactor;

        uint256 mark = Power2Base._getDenormalizedMark(
            fairPeriod,
            address(oracle),
            wPowerPerpPool,
            ethQuoteCurrencyPool,
            weth,
            quoteCurrency,
            address(wPowerPerp),
            cacheNormFactor
        );
        uint256 index = Power2Base._getIndex(fairPeriod, address(oracle), ethQuoteCurrencyPool, weth, quoteCurrency);
        uint256 rFunding = (uint256(1e18).mul(uint256(period))).div(FUNDING_PERIOD);

        // floor mark to be at least 80% of index
        uint256 lowerBound = index.mul(4).div(5);
        if (mark < lowerBound) mark = lowerBound;

        // cap mark to be at most 120% of index
        uint256 upperBound = index.mul(5).div(4);
        if (mark > upperBound) mark = upperBound;

        // multiply by 1e36 to keep newNormalizationFactor in 18 decimals
        // newNormalizationFactor = mark / ( (1+rFunding) * mark - index * rFunding )

        uint256 newNormalizationFactor = (mark.mul(1e36)).div(
            ((uint256(1e18).add(rFunding)).mul(mark).sub(index.mul(rFunding)))
        );

        return cacheNormFactor.mul(newNormalizationFactor).div(1e18);
    }

    /**
     * @dev check that the specified uni tokenId is a valid wPowerPerp/weth token
     * @param _uniTokenId uniswap v3 position token id
     */
    function _checkUniNFT(uint256 _uniTokenId) internal view {
        (, , address token0, address token1, , , , , , , , ) = INonfungiblePositionManager(uniswapPositionManager)
            .positions(_uniTokenId);
        // only check token0 and token1, ignore fee
        // if there are multiple wPowerPerp/weth pools with different fee rate, accept position tokens from any of them
        address wPowerPerpAddr = address(wPowerPerp); // cache storage variable
        address wethAddr = weth; // cache storage variable
        require(
            (token0 == wPowerPerpAddr && token1 == wethAddr) || (token1 == wPowerPerpAddr && token0 == wethAddr),
            "Invalid nft"
        );
    }

    /**
     * @notice check if vault has enough collateral and is not a dust vault
     * @dev revert if vault has insufficient collateral or is a dust vault
     * @param _vault the Vault memory to update
     * @param _normalizationFactor normalization factor
     */
    function _checkVault(VaultLib.Vault memory _vault, uint256 _normalizationFactor) internal view {
        (bool isSafe, bool isDust) = _getVaultStatus(_vault, _normalizationFactor);
        require(isSafe, "Invalid state");
        require(!isDust, "Dust vault");
    }

    /**
     * @notice check that the vault has enough collateral
     * @param _vault in-memory vault
     * @param _normalizationFactor normalization factor
     * @return true if the vault is properly collateralized
     */
    function _isVaultSafe(VaultLib.Vault memory _vault, uint256 _normalizationFactor) internal view returns (bool) {
        (bool isSafe, ) = _getVaultStatus(_vault, _normalizationFactor);
        return isSafe;
    }

    /**
     * @notice return if the vault is properly collateralized and if it is a dust vault
     * @param _vault the Vault memory to update
     * @param _normalizationFactor normalization factor
     * @return true if the vault is safe
     * @return true if the vault is a dust vault
     */
    function _getVaultStatus(VaultLib.Vault memory _vault, uint256 _normalizationFactor)
        internal
        view
        returns (bool, bool)
    {
        uint256 scaledEthPrice = Power2Base._getScaledTwapSafe(
            address(oracle),
            ethQuoteCurrencyPool,
            weth,
            quoteCurrency,
            300
        );
        int24 perpPoolTick = IOracle(oracle).getTimeWeightedAverageTickSafe(wPowerPerpPool, 300);
        return
            VaultLib.getVaultStatus(
                _vault,
                uniswapPositionManager,
                _normalizationFactor,
                scaledEthPrice,
                MIN_COLLATERAL,
                perpPoolTick,
                weth < wPowerPerp
            );
    }

    /**
     * @notice determine how much wPowerPerp to liquidate, and how much collateral to return
     * @param _maxInputWAmount maximum wPowerPerp amount liquidator is willing to repay
     * @param _maxLiquidatableWAmount maximum wPowerPerp amount a liquidator is allowed to repay
     * @param _normalizationFactor normalization factor
     * @return finalWAmountToLiquidate amount of wPowerPerp the liquidator will burn
     * @return collateralToPay total collateral the liquidator will get
     */
    function _getLiquidationAmount(
        uint256 _maxInputWAmount,
        uint256 _maxLiquidatableWAmount,
        uint256 _normalizationFactor
    ) internal view returns (uint256, uint256) {
        uint256 finalWAmountToLiquidate = _maxInputWAmount > _maxLiquidatableWAmount
            ? _maxLiquidatableWAmount
            : _maxInputWAmount;

        uint256 collateralToPay = Power2Base._getCollateralByRepayAmount(
            finalWAmountToLiquidate,
            address(oracle),
            ethQuoteCurrencyPool,
            weth,
            quoteCurrency,
            _normalizationFactor
        );

        // add 10% bonus for liquidators
        collateralToPay = collateralToPay.add(collateralToPay.div(10));

        return (finalWAmountToLiquidate, collateralToPay);
    }

    /**
     * @notice get a period can be used to request a twap for 2 uniswap v3 pools
     * @dev if the period is greater than min(max_pool_1, max_pool_2), return min(max_pool_1, max_pool_2)
     * @param _period max period that we intend to use
     * @return fair period not greator than _period to be used for both pools.
     */
    function _getFairPeriodForOracle(uint32 _period) internal view returns (uint32) {
        uint32 maxSafePeriod = _getMaxSafePeriod();
        return _period > maxSafePeriod ? maxSafePeriod : _period;
    }

    /**
     * @dev get the smaller of the maximum periods of 2 uniswap v3 pools
     * @return return min(max_pool_1, max_pool_2)
     */
    function _getMaxSafePeriod() internal view returns (uint32) {
        uint32 maxPeriodPool1 = IOracle(oracle).getMaxPeriod(ethQuoteCurrencyPool);
        uint32 maxPeriodPool2 = IOracle(oracle).getMaxPeriod(wPowerPerpPool);
        return maxPeriodPool1 > maxPeriodPool2 ? maxPeriodPool2 : maxPeriodPool1;
    }
}
