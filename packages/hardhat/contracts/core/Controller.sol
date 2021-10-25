//SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma abicoder v2;

import "hardhat/console.sol";

import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";
import {IShortPowerPerp} from "../interfaces/IShortPowerPerp.sol";
import {IOracle} from "../interfaces/IOracle.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {INonfungiblePositionManager} from "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/Initializable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {VaultLib} from "../libs/VaultLib.sol";
import {Power2Base} from "../libs/Power2Base.sol";

contract Controller is Initializable, Ownable {
    using SafeMath for uint256;
    using VaultLib for VaultLib.Vault;
    using Address for address payable;

    uint32 internal constant SHUTDOWN_PERIOD = 10 minutes;
    uint256 internal constant MIN_COLLATERAL = 0.5 ether;
    /// @dev system can only be paused for 182 days from deployment
    uint256 public constant PAUSE_TIME_LIMIT = 182 days;
    uint256 public constant FUNDING_PERIOD = 1 days;

    bool public isShutDown; // default to false
    bool public isSystemPaused; // default to false
    uint256 public pausesLeft = 4;
    uint256 public lastPauseTime; // default to 0

    address public weth;
    address public dai;
    address public ethDaiPool;
    address public feeRecipient;

    /// @dev address of the powerPerp/weth pool
    address public wPowerPerpPool;

    address public uniswapPositionManager;

    /// @dev fee rate in basis point. feeRate of 1 = 0.01%
    uint256 public feeRate;

    /// @dev the settlement price for each wPowerPerp for settlement
    uint256 public indexForSettlement;

    uint256 public normalizationFactor;
    uint256 public lastFundingUpdateTimestamp;
    uint256 public deployTimestamp;

    bool public isWethToken0;

    /// @dev The token ID vault data
    mapping(uint256 => VaultLib.Vault) public vaults;

    IShortPowerPerp public shortPowerPerp;
    IWPowerPerp public wPowerPerp;
    IOracle public oracle;

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
     * ======================
     * | External Functions |
     * ======================
     */

    /**
     * @notice returns the expected normalization factor, if the funding is paid right now.
     * @dev can be used for on-chain and off-chain calculations
     */
    function getExpectedNormalizationFactor() external view returns (uint256) {
        return _getNewNormalizationFactor();
    }

    /**
     * @notice get the index price of powerPerp.
     * @param _period period which you want to calculate twap with
     * @return index price denominated in $USD, scaled by 1e18
     */
    function getIndex(uint32 _period) external view returns (uint256) {
        return Power2Base._getIndex(_period, address(oracle), ethDaiPool, weth, dai);
    }

    /**
     * @notice get the mark price of powerPerp.
     * @param _period period which you want to calculate twap with
     * @return mark price denominated in $USD, scaled by 1e18
     */
    function getDenormalizedMark(uint32 _period) external view returns (uint256) {
        uint256 expectedNormalizationFactor = _getNewNormalizationFactor();
        return
            Power2Base._getDenormalizedMark(
                _period,
                address(oracle),
                wPowerPerpPool,
                ethDaiPool,
                weth,
                dai,
                address(wPowerPerp),
                expectedNormalizationFactor
            );
    }

    /**
     * @dev return if the vault is properly collateralized.
     * @param _vaultId id of the vault
     * @return true if the vault is safe.
     */
    function isVaultSafe(uint256 _vaultId) external view returns (bool) {
        VaultLib.Vault memory vault = vaults[_vaultId];
        uint256 expectednormalizationFactor = _getNewNormalizationFactor();
        return _isVaultSafe(vault, expectednormalizationFactor);
    }

    /**
     * @notice initialize the contract
     * @param _oracle oracle address
     * @param _shortPowerPerp erc721 token address representing the short position
     * @param _wPowerPerp erc20 token address representing non-rebasing long position
     * @param _weth weth address
     * @param _dai dai address
     * @param _ethDaiPool uniswap v3 pool for weth / dai
     * @param _wPowerPerpPool uniswap v3 pool for wPowerPerp / weth
     * @param _uniPositionManager uniswap v3 nonfungible position manager address
     */
    function init(
        address _oracle,
        address _shortPowerPerp,
        address _wPowerPerp,
        address _weth,
        address _dai,
        address _ethDaiPool,
        address _wPowerPerpPool,
        address _uniPositionManager
    ) public initializer {
        require(_oracle != address(0), "Invalid oracle address");
        require(_shortPowerPerp != address(0), "Invalid shortPowerPerp address");
        require(_wPowerPerp != address(0), "Invalid power perp address");
        require(_weth != address(0), "Invalid weth address");
        require(_dai != address(0), "Invalid quote currency address");
        require(_ethDaiPool != address(0), "Invalid eth:usd pool address");
        require(_wPowerPerpPool != address(0), "Invalid powerperp:eth pool address");
        require(_uniPositionManager != address(0), "Invalid uni position manager");

        oracle = IOracle(_oracle);
        shortPowerPerp = IShortPowerPerp(_shortPowerPerp);
        wPowerPerp = IWPowerPerp(_wPowerPerp);

        ethDaiPool = _ethDaiPool;
        wPowerPerpPool = _wPowerPerpPool;
        uniswapPositionManager = _uniPositionManager;

        weth = _weth;
        dai = _dai;

        normalizationFactor = 1e18;
        lastFundingUpdateTimestamp = block.timestamp;
        deployTimestamp = block.timestamp;

        isWethToken0 = weth < _wPowerPerp;
    }

    /**
     * @notice put down collateral and mint wPowerPerp.
     * @param _vaultId the vault where you want to mint wPowerPerp in
     * @param _powerPerpAmount amount of powerPerp you wish to mint
     * @param _uniTokenId uniswap v3 position token id want to use to increase collateral ratio
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
     * @notice put down collateral and mint wPowerPerp.
     * @param _vaultId the vault where you want to mint wPowerPerp in
     * @param _wPowerPerpAmount amount of wPowerPerp you wish to mint
     * @param _uniTokenId uniswap v3 position token id want to use to increase collateral ratio
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
        _applyFunding();
        VaultLib.Vault memory cachedVault = vaults[_vaultId];
        _addEthCollateral(cachedVault, _vaultId, msg.value);

        _writeVault(_vaultId, cachedVault);
    }

    /**
     * @notice deposit uniswap v3 position token into a vault to increase collateral ratio
     * @param _vaultId id of the vault
     * @param _uniTokenId uniswap v3 position token id
     */
    function depositUniPositionToken(uint256 _vaultId, uint256 _uniTokenId) external notPaused {
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
    }

    /**
     * @dev withdraw uniswap v3 position token from a vault
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
     * @notice burn wPowerPerp and remove collateral from a vault.
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
     * @notice burn powerPerp and remove collateral from a vault.
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
     * @notice if a vault is unsafe and has a UNI NFT in it, owner call redeem the NFT to pay back some debt.
     * @dev the caller won't get any bounty. this is expected to be used by vault owner
     * @param _vaultId the vault you want to save
     */
    function reduceDebt(uint256 _vaultId) external notPaused {
        require(_canModifyVault(_vaultId, msg.sender), "Not allowed");
        uint256 cachedNormFactor = _applyFunding();
        VaultLib.Vault memory cachedVault = vaults[_vaultId];

        _reduceDebt(cachedVault, shortPowerPerp.ownerOf(_vaultId), cachedNormFactor, false);

        _writeVault(_vaultId, cachedVault);
    }

    /**
     * @notice if a vault is under the 150% collateral ratio, anyone can liquidate the vault by burning wPowerPerp
     * @dev liquidator can get back (powerPerp burned) * (index price) * 110% in collateral
     * @param _vaultId the vault you want to liquidate
     * @param _maxDebtAmount max amount of wPowerPerpetual you want to repay.
     * @return amount of wPowerPerp repaid.
     */
    function liquidate(uint256 _vaultId, uint256 _maxDebtAmount) external notPaused returns (uint256) {
        uint256 cachedNormFactor = _applyFunding();

        VaultLib.Vault memory cachedVault = vaults[_vaultId];

        require(!_isVaultSafe(cachedVault, cachedNormFactor), "Can not liquidate safe vault");

        // try to save target vault before liquidation by reducing debt
        uint256 bounty = _reduceDebt(cachedVault, shortPowerPerp.ownerOf(_vaultId), cachedNormFactor, true);

        // if vault is safe after saving, pay bounty and return early.
        if (_isVaultSafe(cachedVault, cachedNormFactor)) {
            payable(msg.sender).sendValue(bounty);
            _writeVault(_vaultId, cachedVault);
            return 0;
        }

        // add back the bounty amount, liquidators are only getting reward from liquidation.
        cachedVault.addEthCollateral(bounty);

        // if the vault is still not safe after saving, liquidate it.
        (uint256 debtAmount, uint256 collateralPaid) = _liquidate(
            cachedVault,
            _maxDebtAmount,
            cachedNormFactor,
            msg.sender
        );

        emit Liquidate(_vaultId, debtAmount, collateralPaid);

        _writeVault(_vaultId, cachedVault);

        return debtAmount;
    }

    /**
     * @notice authorize an address to modify the vault.
     * @dev can be revoke by setting address to 0.
     * @param _vaultId id of the vault
     * @param _operator new operator address
     */
    function updateOperator(uint256 _vaultId, address _operator) external {
        require(_canModifyVault(_vaultId, msg.sender), "Not allowed");
        vaults[_vaultId].operator = _operator;
        emit UpdateOperator(_vaultId, _operator);
    }

    /**
     * @dev set the recipient who will receive the fee. this should be a contract handling insurance.
     * @param _newFeeRecipient new fee recipient
     */
    function setFeeRecipient(address _newFeeRecipient) external onlyOwner {
        require(_newFeeRecipient != address(0), "Invalid address");
        emit FeeRecipientUpdated(feeRecipient, _newFeeRecipient);
        feeRecipient = _newFeeRecipient;
    }

    /**
     * @dev set the fee rate when user deposit or withdraw collateral
     * @dev this function cannot be called if the feeRecipient is still un-set
     * @param _newFeeRate new fee rate in basis point. can't be higher than 2%
     */
    function setFeeRate(uint256 _newFeeRate) external onlyOwner {
        require(feeRecipient != address(0), "Set fee recipient first");
        require(_newFeeRate <= 100, "Fee too high");
        emit FeeRateUpdated(feeRate, _newFeeRate);
        feeRate = _newFeeRate;
    }

    /**
     * @dev pause and then immediately shutdown the system
     * @dev this bypasses the check on number of pauses or time based checks, but is irreversible and enables emergency settlement
     */
    function pauseAndShutDown() external notShutdown notPaused onlyOwner {
        isSystemPaused = true;
        isShutDown = true;
        indexForSettlement = Power2Base._getScaledTwap(address(oracle), ethDaiPool, weth, dai, 600);
    }

    /**
     * @dev shutdown the system and enable system settlement
     */
    function shutDown() external notShutdown isPaused onlyOwner {
        isShutDown = true;
        indexForSettlement = Power2Base._getScaledTwap(address(oracle), ethDaiPool, weth, dai, 600);
    }

    /**
     * @dev pause the system for up to 24 hours after which any one can unpause
     * @dev can only be called for 365 days since the contract was launched or 4 times, without triggering shutdown atomically
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
     * @dev anyone can unpause the contract after 24 hours
     */
    function unPauseAnyone() external notShutdown isPaused {
        require(block.timestamp > (lastPauseTime + 1 days), "Not enough paused time has passed");
        isSystemPaused = false;
    }

    /**
     * @dev owner can unpause at any time
     */
    function unPauseOwner() external notShutdown isPaused onlyOwner {
        isSystemPaused = false;
    }

    /**
     * @dev redeem wPowerPerp for its index value when the system is shutdown
     * @param _wPerpAmount amount of wPowerPerp to burn
     */
    function redeemLong(uint256 _wPerpAmount) external isShutdown {
        wPowerPerp.burn(msg.sender, _wPerpAmount);

        uint256 longValue = Power2Base._getLongSettlementValue(_wPerpAmount, indexForSettlement, normalizationFactor);
        payable(msg.sender).sendValue(longValue);
    }

    /**
     * @dev redeem additional collateral from the vault when the system is shutdown
     * @param _vaultId vauld id
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

        // reset the vault but don't burn the nft, just because people may want to keep it.
        cachedVault.shortAmount = 0;
        cachedVault.collateralAmount = 0;
        _writeVault(_vaultId, cachedVault);

        payable(msg.sender).sendValue(excess);
    }

    /**
     * @dev update the normalization factor as a way to pay funding.
     */
    function applyFunding() external notPaused {
        _applyFunding();
    }

    /**
     * @notice a function to add eth into a contract, in case it got insolvent and have ensufficient eth to pay out for settlement.
     */
    function donate() external payable isShutdown {}

    /**
     * fallback function to accept eth
     */
    receive() external payable {
        require(msg.sender == weth, "Cannot receive eth");
    }

    /*
     * ======================
     * | Internal Functions |
     * ======================
     */

    function _canModifyVault(uint256 _vaultId, address _account) internal view returns (bool) {
        return shortPowerPerp.ownerOf(_vaultId) == _account || vaults[_vaultId].operator == _account;
    }

    /**
     * @notice wrapper function which open a vault, add collateral and mint wPowerPerp
     * @param _account who should receive wPowerPerp
     * @param _vaultId id of the vault
     * @param _mintAmount amount to mint
     * @param _depositAmount amount of eth as collateral
     * @param _isWAmount if the input amount is wPowerPerp
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

        VaultLib.Vault memory cachedVault;

        // load vault or create new a new one
        if (_vaultId == 0) {
            (_vaultId, cachedVault) = _openVault(_account);
        } else {
            cachedVault = vaults[_vaultId];
        }

        if (wPowerPerpAmount > 0) {
            depositAmountWithFee = _payFee(cachedVault, wPowerPerpAmount, _depositAmount);
        }
        if (_depositAmount > 0) _addEthCollateral(cachedVault, _vaultId, depositAmountWithFee);
        if (_uniTokenId != 0) _depositUniPositionToken(cachedVault, _account, _vaultId, _uniTokenId);

        if (wPowerPerpAmount > 0) _mintWPowerPerp(cachedVault, _account, _vaultId, wPowerPerpAmount);

        _checkVault(cachedVault, cachedNormFactor);
        _writeVault(_vaultId, cachedVault);

        return (_vaultId, wPowerPerpAmount);
    }

    /**
     * @notice wrapper function which burn wPowerPerp and redeem collateral
     * @param _account who should receive wPowerPerp
     * @param _vaultId id of the vault
     * @param _burnAmount amount to mint
     * @param _withdrawAmount amount of eth as collateral
     * @param _isWAmount true if the amount is wPowerPerp
     * @return total burned wPowerPower amount
     */
    function _burnAndWithdraw(
        address _account,
        uint256 _vaultId,
        uint256 _burnAmount,
        uint256 _withdrawAmount,
        bool _isWAmount
    ) internal returns (uint256) {
        uint256 cachedNormFactor = _applyFunding();

        uint256 wBurnAmount = _isWAmount ? _burnAmount : _burnAmount.mul(1e18).div(cachedNormFactor);

        VaultLib.Vault memory cachedVault = vaults[_vaultId];
        if (wBurnAmount > 0) _burnWPowerPerp(cachedVault, _account, _vaultId, wBurnAmount);
        if (_withdrawAmount > 0) _withdrawCollateral(cachedVault, _account, _vaultId, _withdrawAmount);
        _checkVault(cachedVault, cachedNormFactor);
        _writeVault(_vaultId, cachedVault);

        return wBurnAmount;
    }

    /**
     * @dev create a new vault and bind it with a new short vault id.
     * @return id of the newly created vault
     * @return newly created vault memory
     */
    function _openVault(address _recipient) internal returns (uint256, VaultLib.Vault memory) {
        uint256 vaultId = shortPowerPerp.mintNFT(_recipient);

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
     * @dev deposit uni v3 position token into a vault.
     * @dev this function will update the vault memory in-place
     * @param _vault the Vault memory to update.
     * @param _account account we should transfer the uni nft from
     * @param _vaultId id of the vault
     * @param _uniTokenId uniswap v3 position token id
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
     * @dev add eth collateral into a vault
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
     * @dev remove uniswap v3 position token from the vault
     * @param _vault the Vault memory to update.
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
     * @dev remove eth collateral from the vault
     * @dev this function will update the vault memory in-place
     * @param _vault the Vault memory to update.
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
        payable(_account).sendValue(_amount);

        emit WithdrawCollateral(_vaultId, _amount, 0);
    }

    /**
     * @dev mint wPowerPerp (ERC20) to an account
     * @dev this function will update the vault memory in-place
     * @param _vault the Vault memory to update.
     * @param _account who should receive wPowerPerp
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
        wPowerPerp.mint(_account, _wPowerPerpAmount);

        emit MintShort(_wPowerPerpAmount, _vaultId);
    }

    /**
     * @dev burn wPowerPerp (ERC20) from an account.
     * @dev this function will update the vault memory in-place
     * @param _vault the Vault memory to update.
     * @param _account who pay the wPowerPerp
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
        wPowerPerp.burn(_account, _wPowerPerpAmount);

        emit BurnShort(_wPowerPerpAmount, _vaultId);
    }

    /**
     * @notice liquidate a vault, pay the liquidator
     * @dev liquidator can only liquidate at most 1/2 of the vault in 1 transaction
     * @dev this function will update the vault memory in-place
     * @param _vault the Vault memory to update.
     * @param _maxWPowerPerpAmount max debt amount liquidator is willing to repay
     * @param _liquidator address which will receive eth
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

        // try limiting max liquidatable amount to half of the vault
        (uint256 wAmountToLiquidate, uint256 collateralToPay) = _getLiquidationAmount(
            _maxWPowerPerpAmount,
            vaultShortAmount.div(2),
            _normalizationFactor
        );

        if (vaultCollateralAmount > collateralToPay) {
            if (vaultCollateralAmount.sub(collateralToPay) < MIN_COLLATERAL) {
                // the vault is left with dust after liquidation, allow liquidating full vault.
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

        wPowerPerp.burn(_liquidator, wAmountToLiquidate);
        _vault.removeShort(wAmountToLiquidate);
        _vault.removeEthCollateral(collateralToPay);

        (, bool isDust) = _getVaultStatus(_vault, _normalizationFactor);
        require(!isDust, "Dust vault left");

        // pay the liquidator
        payable(_liquidator).sendValue(collateralToPay);

        return (wAmountToLiquidate, collateralToPay);
    }

    /**
     * @notice this function will redeem the NFT in a vault
     * @notice and reduce debt in the target vault if there's a nft in the vault
     * @dev this function will be executed before liquidation if there's a NFT in the vault.
     * @dev when it's called by liquidate(), it pays out a small bounty to the liquidator.
     * @dev this function will update the vault memory in-place
     * @param _vault the Vault memory to update.
     * @param _owner where should the excess go to
     * @param _isLiquidation whether we're paying to the recipient the 2% discount or not.
     * @return bounty amount of bounty paid for liquidator
     */
    function _reduceDebt(
        VaultLib.Vault memory _vault,
        address _owner,
        uint256 _normalizationFactor,
        bool _isLiquidation
    ) internal returns (uint256) {
        uint256 nftId = _vault.NftCollateralId;
        if (nftId == 0) return 0;

        (uint256 withdrawnEthAmount, uint256 withdrawnWPowerPerpAmount) = _redeemUniToken(nftId);

        // change weth back to eth
        if (withdrawnEthAmount > 0) IWETH9(weth).withdraw(withdrawnEthAmount);

        // the bounty is 2% on top of total value withdrawn from the NFT.
        uint256 bounty;
        if (_isLiquidation) {
            uint256 totalValue = Power2Base
                ._getCollateralByRepayAmount(
                    withdrawnWPowerPerpAmount,
                    address(oracle),
                    ethDaiPool,
                    weth,
                    dai,
                    _normalizationFactor
                )
                .add(withdrawnEthAmount);

            bounty = totalValue.mul(2).div(100);
        }

        _vault.removeUniNftCollateral();
        _vault.addEthCollateral(withdrawnEthAmount);
        _vault.removeEthCollateral(bounty);

        // burn min of (shortAmount, withdrawnWPowerPerpAmount) from the vault.
        if (withdrawnWPowerPerpAmount > _vault.shortAmount) {
            uint256 excess = withdrawnWPowerPerpAmount.sub(_vault.shortAmount);
            withdrawnWPowerPerpAmount = _vault.shortAmount;
            wPowerPerp.transfer(_owner, excess);
        }

        _vault.removeShort(withdrawnWPowerPerpAmount);
        wPowerPerp.burn(address(this), withdrawnWPowerPerpAmount);

        return bounty;
    }

    /**
     * @dev pay the fee to the fee recipient in eth from either the vault or the deposit amount
     * @param _vault the Vault memory to update.
     * @param _wSqueethAmount the amount of wSqueeth to mint
     * @param _depositAmount the amount depositing or withdrawing
     * @return the amount of actual deposited eth into the vault, this is less than the original amount if a fee was removed from it
     */
    function _payFee(
        VaultLib.Vault memory _vault,
        uint256 _wSqueethAmount,
        uint256 _depositAmount
    ) internal returns (uint256) {
        uint256 cachedFeeRate = feeRate;
        if (cachedFeeRate == 0) return _depositAmount;
        uint256 depositAmountAfterFee;
        uint256 ethEquivalentMinted = Power2Base._getCollateralByRepayAmount(
            _wSqueethAmount,
            address(oracle),
            ethDaiPool,
            weth,
            dai,
            normalizationFactor
        );
        uint256 feeAmount = ethEquivalentMinted.mul(cachedFeeRate).div(10000);

        // if fee can be paid from deposited collateral, pay from _depositAmount
        if (_depositAmount > feeAmount) {
            depositAmountAfterFee = _depositAmount.sub(feeAmount);
            payable(feeRecipient).sendValue(feeAmount);
            // if not, adjust the vault to pay from the vault collateral
        } else {
            _vault.removeEthCollateral(feeAmount);
            payable(feeRecipient).sendValue(feeAmount);
            depositAmountAfterFee = _depositAmount;
        }
        //return the deposit amount, which has only been reduced by a fee if it is paid out of the deposit amount
        return depositAmountAfterFee;
    }

    /**
     * @dev write new vault structure to storage.
     */
    function _writeVault(uint256 _vaultId, VaultLib.Vault memory _vault) private {
        vaults[_vaultId] = _vault;
    }

    /**
     * @dev redeem a uni v3 position token and get back wPerp and eth.
     * @param _uniTokenId uniswap v3 position token id
     * @return wethAmount amount of weth withdrawn from uniswap
     * @return wPowerPerpAmount amount of wPowerPerp withdrawn from uniswap
     */
    function _redeemUniToken(uint256 _uniTokenId) internal returns (uint256, uint256) {
        INonfungiblePositionManager positionManager = INonfungiblePositionManager(uniswapPositionManager);

        (, , uint128 liquidity) = VaultLib._getUniswapPositionInfo(uniswapPositionManager, _uniTokenId);

        // prepare parameters to withdraw liquidity from Uniswap V3 Position Manager.
        INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseParams = INonfungiblePositionManager
            .DecreaseLiquidityParams({
                tokenId: _uniTokenId,
                liquidity: liquidity,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            });

        // the decreaseLiquidity function returns the amount collectable by the owner.
        (uint256 amount0, uint256 amount1) = positionManager.decreaseLiquidity(decreaseParams);

        // withdraw weth and wPowerPerp from Uniswap V3.
        INonfungiblePositionManager.CollectParams memory collectParams = INonfungiblePositionManager.CollectParams({
            tokenId: _uniTokenId,
            recipient: address(this),
            amount0Max: uint128(amount0),
            amount1Max: uint128(amount1)
        });

        (uint256 collectedToken0, uint256 collectedToken1) = positionManager.collect(collectParams);

        bool cacheIsWethToken0 = isWethToken0; // cache storage variable
        uint256 wethAmount = cacheIsWethToken0 ? collectedToken0 : collectedToken1;
        uint256 wPowerPerpAmount = cacheIsWethToken0 ? collectedToken1 : collectedToken0;

        return (wethAmount, wPowerPerpAmount);
    }

    /**
     * @notice Update the normalization factor as a way to pay funding.
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
     * @dev calculate new normalization factor base on the current timestamp.
     * @return new normalization factor if funding happens in the current block.
     */
    function _getNewNormalizationFactor() internal view returns (uint256) {
        uint32 period = uint32(block.timestamp.sub(lastFundingUpdateTimestamp));

        // make sure we use the same period for mark and index, and this period won't cause revert.
        uint32 fairPeriod = _getFairPeriodForOracle(period);

        // avoid reading normalizationFactor  from storage multiple times
        uint256 cacheNormFactor = normalizationFactor;

        uint256 mark = Power2Base._getDenormalizedMark(
            fairPeriod,
            address(oracle),
            wPowerPerpPool,
            ethDaiPool,
            weth,
            dai,
            address(wPowerPerp),
            cacheNormFactor
        );
        uint256 index = Power2Base._getIndex(fairPeriod, address(oracle), ethDaiPool, weth, dai);
        uint256 rFunding = (uint256(1e18).mul(uint256(period))).div(FUNDING_PERIOD);

        // Truncate mark to be at least 80% of index
        uint256 lowerBound = index.mul(4).div(5);
        if (mark < lowerBound) mark = lowerBound;

        // Truncate mark to be at most 120% of index
        uint256 upperBound = index.mul(5).div(4);
        if (mark > upperBound) mark = upperBound;

        // mul by 1e36 to keep newNormalizationFactor in 18 decimals
        // uint256 newNormalizationFactor = (mark * 1e36) / (((1e18 + rFunding) * mark - index * rFunding));
        uint256 newNormalizationFactor = (mark.mul(1e36)).div(
            ((uint256(1e18).add(rFunding)).mul(mark).sub(index.mul(rFunding)))
        );

        return cacheNormFactor.mul(newNormalizationFactor).div(1e18);
    }

    /**
     * @dev check that the specified uni tokenId is a valid powerPerp/weth lp token.
     * @param _uniTokenId uniswap v3 position token id
     */
    function _checkUniNFT(uint256 _uniTokenId) internal view {
        (, , address token0, address token1, , , , , , , , ) = INonfungiblePositionManager(uniswapPositionManager)
            .positions(_uniTokenId);
        // only check token0 and token1, ignore fee.
        // If there are multiple wPowerPerp/eth pools with different fee rate, we accept LP tokens from all of them.
        address wPowerPerpAddr = address(wPowerPerp); // cache storage variable
        address wethAddr = weth; // cache storage variable
        require(
            (token0 == wPowerPerpAddr && token1 == wethAddr) || (token1 == wPowerPerpAddr && token0 == wethAddr),
            "Invalid nft"
        );
    }

    /**
     * @dev revert if the vault is insolvent, or a dust vault
     * @param _vault the Vault memory to update.
     * @param _normalizationFactor normalization factor
     */
    function _checkVault(VaultLib.Vault memory _vault, uint256 _normalizationFactor) internal view {
        (bool isSafe, bool isDust) = _getVaultStatus(_vault, _normalizationFactor);
        require(isSafe, "Invalid state");
        require(!isDust, "Dust vault");
    }

    /**
     * @dev check that the vault is properly collateralized
     * @return if the vault is properly collateralized.
     */
    function _isVaultSafe(VaultLib.Vault memory _vault, uint256 _normalizationFactor) internal view returns (bool) {
        (bool isSafe, ) = _getVaultStatus(_vault, _normalizationFactor);
        return isSafe;
    }

    /**
     * @dev get the vault latest status, if it's above water or a dust vault
     * @param _vault the Vault memory to update.
     * @param _normalizationFactor normalization factor
     * @return if the vault is safe
     * @return if the vault is a dust vault
     */
    function _getVaultStatus(VaultLib.Vault memory _vault, uint256 _normalizationFactor)
        internal
        view
        returns (bool, bool)
    {
        uint256 scaledEthPrice = Power2Base._getScaledTwapSafe(address(oracle), ethDaiPool, weth, dai, 300);
        int24 perpPoolTick = oracle.getTimeWeightedAverageTickSafe(wPowerPerpPool, 300);
        return
            VaultLib.getVaultStatus(
                _vault,
                uniswapPositionManager,
                _normalizationFactor,
                scaledEthPrice,
                MIN_COLLATERAL,
                perpPoolTick,
                isWethToken0
            );
    }

    /**
     * @dev get how much wPowerPerp will be exchanged for collateral given a max wPowerPerp amount and debt ceiling
     * @param _maxInputWAmount max wPowerPerp amount liquidator is willing to pay
     * @param _maxLiquidatableWAmount max wPowerPerp amount a liquidator can take out from a vault
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
            ethDaiPool,
            weth,
            dai,
            _normalizationFactor
        );

        // add 10% bonus for liquidators
        collateralToPay = collateralToPay.add(collateralToPay.div(10));

        return (finalWAmountToLiquidate, collateralToPay);
    }

    /**
     * @notice get a fair period that should be used to request twap for 2 pools
     * @dev if the period we want to use is greater than min(max_pool_1, max_pool_2),
     *      return min(max_pool_1, max_pool_2)
     * @param _period max period that we intend to use
     * @return fair period not greator than _period to be used for both pools.
     */
    function _getFairPeriodForOracle(uint32 _period) internal view returns (uint32) {
        uint32 maxSafePeriod = _getMaxSafePeriod();
        return _period > maxSafePeriod ? maxSafePeriod : _period;
    }

    /**
     * @dev get the smaller of the max periods of 2 pools
     * @return return min(max_pool_1, max_pool_2)
     */
    function _getMaxSafePeriod() internal view returns (uint32) {
        uint32 maxPeriodPool1 = oracle.getMaxPeriod(ethDaiPool);
        uint32 maxPeriodPool2 = oracle.getMaxPeriod(wPowerPerpPool);
        return maxPeriodPool1 > maxPeriodPool2 ? maxPeriodPool2 : maxPeriodPool1;
    }
}
