//SPDX-License-Identifier: BUSL-1.1

pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {INonfungiblePositionManager} from "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";
import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";
import {IShortPowerPerp} from "../interfaces/IShortPowerPerp.sol";
import {IOracle} from "../interfaces/IOracle.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

//contract
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

//lib
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ABDKMath64x64} from "../libs/ABDKMath64x64.sol";
import {VaultLib} from "../libs/VaultLib.sol";
import {Uint256Casting} from "../libs/Uint256Casting.sol";
import {Power2Base} from "../libs/Power2Base.sol";

/**
 *
 * Error
 * C0: Paused
 * C1: Not paused
 * C2: Shutdown
 * C3: Not shutdown
 * C4: Invalid oracle address
 * C5: Invalid shortPowerPerp address
 * C6: Invalid wPowerPerp address
 * C7: Invalid weth address
 * C8: Invalid quote currency address
 * C9: Invalid eth:quoteCurrency pool address
 * C10: Invalid wPowerPerp:eth pool address
 * C11: Invalid Uniswap position manager
 * C12: Can not liquidate safe vault
 * C13: Invalid address
 * C14: Set fee recipient first
 * C15: Fee too high
 * C16: Paused too many times
 * C17: Pause time limit exceeded
 * C18: Not enough paused time has passed
 * C19: Cannot receive eth
 * C20: Not allowed
 * C21: Need full liquidation
 * C22: Dust vault left
 * C23: Invalid nft
 * C24: Invalid state
 * C25: 0 liquidity Uniswap position token
 * C26: Wrong fee tier for NFT deposit
 */
contract Controller is Ownable, ReentrancyGuard, IERC721Receiver {
    using SafeMath for uint256;
    using Uint256Casting for uint256;
    using ABDKMath64x64 for int128;
    using VaultLib for VaultLib.Vault;
    using Address for address payable;

    uint256 internal constant MIN_COLLATERAL = 0.5 ether;
    /// @dev system can only be paused for 182 days from deployment
    uint256 internal constant PAUSE_TIME_LIMIT = 182 days;

    uint256 public constant FUNDING_PERIOD = 420 hours;
    uint24 public immutable feeTier;
    uint32 public constant TWAP_PERIOD = 420 seconds;

    //80% of index
    uint256 internal constant LOWER_MARK_RATIO = 8e17;
    //140% of index
    uint256 internal constant UPPER_MARK_RATIO = 140e16;
    // 10%
    uint256 internal constant LIQUIDATION_BOUNTY = 1e17;
    // 2%
    uint256 internal constant REDUCE_DEBT_BOUNTY = 2e16;

    /// @dev basic unit used for calculation
    uint256 private constant ONE = 1e18;

    address public immutable weth;
    address public immutable quoteCurrency;
    address public immutable ethQuoteCurrencyPool;
    /// @dev address of the powerPerp/weth pool
    address public immutable wPowerPerpPool;
    address internal immutable uniswapPositionManager;
    address public immutable shortPowerPerp;
    address public immutable wPowerPerp;
    address public immutable oracle;
    address public feeRecipient;

    uint256 internal immutable deployTimestamp;
    /// @dev fee rate in basis point. feeRate of 1 = 0.01%
    uint256 public feeRate;
    /// @dev the settlement price for each wPowerPerp for settlement
    uint256 public indexForSettlement;

    uint256 public pausesLeft = 4;
    uint256 public lastPauseTime;

    // these 2 parameters are always updated together. Use uint128 to batch read and write.
    uint128 public normalizationFactor;
    uint128 public lastFundingUpdateTimestamp;

    bool internal immutable isWethToken0;
    bool public isShutDown;
    bool public isSystemPaused;

    /// @dev vault data storage
    mapping(uint256 => VaultLib.Vault) public vaults;

    /// Events
    event OpenVault(address sender, uint256 vaultId);
    event DepositCollateral(address sender, uint256 vaultId, uint256 amount);
    event DepositUniPositionToken(address sender, uint256 vaultId, uint256 tokenId);
    event WithdrawCollateral(address sender, uint256 vaultId, uint256 amount);
    event WithdrawUniPositionToken(address sender, uint256 vaultId, uint256 tokenId);
    event MintShort(address sender, uint256 amount, uint256 vaultId);
    event BurnShort(address sender, uint256 amount, uint256 vaultId);
    event ReduceDebt(
        address sender,
        uint256 vaultId,
        uint256 ethRedeemed,
        uint256 wPowerPerpRedeemed,
        uint256 wPowerPerpBurned,
        uint256 wPowerPerpExcess,
        uint256 bounty
    );
    event UpdateOperator(address sender, uint256 vaultId, address operator);
    event FeeRateUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address oldFeeRecipient, address newFeeRecipient);
    event Liquidate(address liquidator, uint256 vaultId, uint256 debtAmount, uint256 collateralPaid);
    event NormalizationFactorUpdated(
        uint256 oldNormFactor,
        uint256 newNormFactor,
        uint256 lastModificationTimestamp,
        uint256 timestamp
    );
    event Paused(uint256 pausesLeft);
    event UnPaused(address unpauser);
    event Shutdown(uint256 indexForSettlement);
    event RedeemLong(address sender, uint256 wPowerPerpAmount, uint256 payoutAmount);
    event RedeemShort(address sender, uint256 vauldId, uint256 collateralAmount);

    modifier notPaused() {
        require(!isSystemPaused, "C0");
        _;
    }

    modifier isPaused() {
        require(isSystemPaused, "C1");
        _;
    }

    modifier notShutdown() {
        require(!isShutDown, "C2");
        _;
    }

    modifier isShutdown() {
        require(isShutDown, "C3");
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
        address _uniPositionManager,
        uint24 _feeTier
    ) {
        require(_oracle != address(0), "C4");
        require(_shortPowerPerp != address(0), "C5");
        require(_wPowerPerp != address(0), "C6");
        require(_weth != address(0), "C7");
        require(_quoteCurrency != address(0), "C8");
        require(_ethQuoteCurrencyPool != address(0), "C9");
        require(_wPowerPerpPool != address(0), "C10");
        require(_uniPositionManager != address(0), "C11");

        oracle = _oracle;
        shortPowerPerp = _shortPowerPerp;
        wPowerPerp = _wPowerPerp;
        weth = _weth;
        quoteCurrency = _quoteCurrency;
        ethQuoteCurrencyPool = _ethQuoteCurrencyPool;
        wPowerPerpPool = _wPowerPerpPool;
        uniswapPositionManager = _uniPositionManager;
        feeTier = _feeTier;
        isWethToken0 = _weth < _wPowerPerp;

        normalizationFactor = 1e18;
        deployTimestamp = block.timestamp;
        lastFundingUpdateTimestamp = block.timestamp.toUint128();
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
        return Power2Base._getIndex(_period, oracle, ethQuoteCurrencyPool, weth, quoteCurrency);
    }

    /**
     * @notice the unscaled index of the power perp in USD, scaled by 18 decimals
     * @dev this is the mark that would be be used for future funding after a new normalization factor is applied
     * @param _period period which you want to calculate twap with
     * @return index price denominated in $USD, scaled by 1e18
     */
    function getUnscaledIndex(uint32 _period) external view returns (uint256) {
        return Power2Base._getUnscaledIndex(_period, oracle, ethQuoteCurrencyPool, weth, quoteCurrency);
    }

    /**
     * @notice get the expected mark price of powerPerp after funding has been applied
     * @param _period period of time for the twap in seconds
     * @return mark price denominated in $USD, scaled by 1e18
     */
    function getDenormalizedMark(uint32 _period) external view returns (uint256) {
        return
            Power2Base._getDenormalizedMark(
                _period,
                oracle,
                wPowerPerpPool,
                ethQuoteCurrencyPool,
                weth,
                quoteCurrency,
                wPowerPerp,
                _getNewNormalizationFactor()
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
                oracle,
                wPowerPerpPool,
                ethQuoteCurrencyPool,
                weth,
                quoteCurrency,
                wPowerPerp,
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
        uint256 _powerPerpAmount,
        uint256 _uniTokenId
    ) external payable notPaused nonReentrant returns (uint256, uint256) {
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
        uint256 _wPowerPerpAmount,
        uint256 _uniTokenId
    ) external payable notPaused nonReentrant returns (uint256) {
        (uint256 vaultId, ) = _openDepositMint(msg.sender, _vaultId, _wPowerPerpAmount, msg.value, _uniTokenId, true);
        return vaultId;
    }

    /**
     * @dev deposit collateral into a vault
     * @param _vaultId id of the vault
     */
    function deposit(uint256 _vaultId) external payable notPaused nonReentrant {
        _checkCanModifyVault(_vaultId, msg.sender);

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
    function depositUniPositionToken(uint256 _vaultId, uint256 _uniTokenId) external notPaused nonReentrant {
        _checkCanModifyVault(_vaultId, msg.sender);

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
    function withdraw(uint256 _vaultId, uint256 _amount) external notPaused nonReentrant {
        _checkCanModifyVault(_vaultId, msg.sender);

        uint256 cachedNormFactor = _applyFunding();
        VaultLib.Vault memory cachedVault = vaults[_vaultId];

        _withdrawCollateral(cachedVault, _vaultId, _amount);
        _checkVault(cachedVault, cachedNormFactor);
        _writeVault(_vaultId, cachedVault);
        payable(msg.sender).sendValue(_amount);
    }

    /**
     * @notice withdraw uniswap v3 position token from a vault
     * @param _vaultId id of the vault
     */
    function withdrawUniPositionToken(uint256 _vaultId) external notPaused nonReentrant {
        _checkCanModifyVault(_vaultId, msg.sender);

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
    ) external notPaused nonReentrant {
        _checkCanModifyVault(_vaultId, msg.sender);

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
    ) external notPaused nonReentrant returns (uint256) {
        _checkCanModifyVault(_vaultId, msg.sender);

        return _burnAndWithdraw(msg.sender, _vaultId, _powerPerpAmount, _withdrawAmount, false);
    }

    /**
     * @notice after the system is shutdown, insolvent vaults need to be have their uniswap v3 token assets withdrawn by force
     * @notice if a vault has a uniswap v3 position in it, anyone can call to withdraw uniswap v3 token assets, reducing debt and increasing collateral in the vault
     * @dev the caller won't get any bounty. this is expected to be used for insolvent vaults in shutdown
     * @param _vaultId vault containing uniswap v3 position to liquidate
     */
    function reduceDebtShutdown(uint256 _vaultId) external isShutdown nonReentrant {
        VaultLib.Vault memory cachedVault = vaults[_vaultId];
        _reduceDebt(cachedVault, IShortPowerPerp(shortPowerPerp).ownerOf(_vaultId), _vaultId, false);
        _writeVault(_vaultId, cachedVault);
    }

    /**
     * @notice withdraw assets from uniswap v3 position, reducing debt and increasing collateral in the vault
     * @dev the caller won't get any bounty. this is expected to be used by vault owner
     * @param _vaultId target vault
     */
    function reduceDebt(uint256 _vaultId) external notPaused nonReentrant {
        _checkCanModifyVault(_vaultId, msg.sender);
        VaultLib.Vault memory cachedVault = vaults[_vaultId];

        _reduceDebt(cachedVault, IShortPowerPerp(shortPowerPerp).ownerOf(_vaultId), _vaultId, false);

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
    function liquidate(uint256 _vaultId, uint256 _maxDebtAmount) external notPaused nonReentrant returns (uint256) {
        uint256 cachedNormFactor = _applyFunding();

        VaultLib.Vault memory cachedVault = vaults[_vaultId];

        require(!_isVaultSafe(cachedVault, cachedNormFactor), "C12");

        // try to save target vault before liquidation by reducing debt
        uint256 bounty = _reduceDebt(cachedVault, IShortPowerPerp(shortPowerPerp).ownerOf(_vaultId), _vaultId, true);

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

        emit Liquidate(msg.sender, _vaultId, debtAmount, collateralPaid);

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
        require(
            (shortPowerPerp == msg.sender) || (IShortPowerPerp(shortPowerPerp).ownerOf(_vaultId) == msg.sender),
            "C20"
        );
        vaults[_vaultId].operator = _operator;
        emit UpdateOperator(msg.sender, _vaultId, _operator);
    }

    /**
     * @notice set the recipient who will receive the fee
     * @dev this should be a contract handling insurance
     * @param _newFeeRecipient new fee recipient
     */
    function setFeeRecipient(address _newFeeRecipient) external onlyOwner {
        require(_newFeeRecipient != address(0), "C13");
        emit FeeRecipientUpdated(feeRecipient, _newFeeRecipient);
        feeRecipient = _newFeeRecipient;
    }

    /**
     * @notice set the fee rate when user mints
     * @dev this function cannot be called if the feeRecipient is still un-set
     * @param _newFeeRate new fee rate in basis points. can't be higher than 1%
     */
    function setFeeRate(uint256 _newFeeRate) external onlyOwner {
        require(feeRecipient != address(0), "C14");
        require(_newFeeRate <= 100, "C15");
        emit FeeRateUpdated(feeRate, _newFeeRate);
        feeRate = _newFeeRate;
    }

    /**
     * @notice shutting down the system allows all long wPowerPerp to be settled at index * normalizationFactor
     * @notice short positions can be redeemed for vault collateral minus value of debt
     * @notice pause (if not paused) and then immediately shutdown the system, can be called when paused already
     * @dev this bypasses the check on number of pauses or time based checks, but is irreversible and enables emergency settlement
     */
    function shutDown() external onlyOwner notShutdown {
        isSystemPaused = true;
        isShutDown = true;
        indexForSettlement = Power2Base._getScaledTwap(
            oracle,
            ethQuoteCurrencyPool,
            weth,
            quoteCurrency,
            TWAP_PERIOD,
            false
        );
        emit Shutdown(indexForSettlement);
    }

    /**
     * @notice pause the system for up to 24 hours after which any one can unpause
     * @dev can only be called for 365 days since the contract was launched or 4 times
     */
    function pause() external onlyOwner notShutdown notPaused {
        require(pausesLeft > 0, "C16");
        uint256 timeSinceDeploy = block.timestamp.sub(deployTimestamp);
        require(timeSinceDeploy < PAUSE_TIME_LIMIT, "C17");
        isSystemPaused = true;
        pausesLeft -= 1;
        lastPauseTime = block.timestamp;

        emit Paused(pausesLeft);
    }

    /**
     * @notice unpause the contract
     * @dev anyone can unpause the contract after 24 hours
     */
    function unPauseAnyone() external isPaused notShutdown {
        require(block.timestamp > (lastPauseTime + 1 days), "C18");
        isSystemPaused = false;
        emit UnPaused(msg.sender);
    }

    /**
     * @notice unpause the contract
     * @dev owner can unpause at any time
     */
    function unPauseOwner() external onlyOwner isPaused notShutdown {
        isSystemPaused = false;
        emit UnPaused(msg.sender);
    }

    /**
     * @notice redeem wPowerPerp for (settlement index value) * normalizationFactor when the system is shutdown
     * @param _wPerpAmount amount of wPowerPerp to burn
     */
    function redeemLong(uint256 _wPerpAmount) external isShutdown nonReentrant {
        IWPowerPerp(wPowerPerp).burn(msg.sender, _wPerpAmount);

        uint256 longValue = Power2Base._getLongSettlementValue(_wPerpAmount, indexForSettlement, normalizationFactor);
        payable(msg.sender).sendValue(longValue);

        emit RedeemLong(msg.sender, _wPerpAmount, longValue);
    }

    /**
     * @notice redeem short position when the system is shutdown
     * @dev short position is redeemed by valuing the debt at the (settlement index value) * normalizationFactor
     * @param _vaultId vault id
     */
    function redeemShort(uint256 _vaultId) external isShutdown nonReentrant {
        _checkCanModifyVault(_vaultId, msg.sender);

        VaultLib.Vault memory cachedVault = vaults[_vaultId];
        uint256 cachedNormFactor = normalizationFactor;

        _reduceDebt(cachedVault, msg.sender, _vaultId, false);

        uint256 debt = Power2Base._getLongSettlementValue(
            cachedVault.shortAmount,
            indexForSettlement,
            cachedNormFactor
        );
        // if the debt is more than collateral, this line will revert
        uint256 excess = uint256(cachedVault.collateralAmount).sub(debt);

        // reset the vault but don't burn the nft, just because people may want to keep it
        cachedVault.shortAmount = 0;
        cachedVault.collateralAmount = 0;
        _writeVault(_vaultId, cachedVault);

        payable(msg.sender).sendValue(excess);

        emit RedeemShort(msg.sender, _vaultId, excess);
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
        require(msg.sender == weth, "C19");
    }

    /**
     * @dev accept erc721 from safeTransferFrom and safeMint after callback
     * @return returns received selector
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /*
     * ======================
     * | Internal Functions |
     * ======================
     */

    /**
     * @notice check if an address can modify a vault
     * @param _vaultId the id of the vault to check if can be modified by _account
     * @param _account the address to check if can modify the vault
     */
    function _checkCanModifyVault(uint256 _vaultId, address _account) internal view {
        require(
            IShortPowerPerp(shortPowerPerp).ownerOf(_vaultId) == _account || vaults[_vaultId].operator == _account,
            "C20"
        );
    }

    /**
     * @notice wrapper function which opens a vault, adds collateral and mints wPowerPerp
     * @param _account account to receive wPowerPerp
     * @param _vaultId id of the vault
     * @param _mintAmount amount to mint
     * @param _depositAmount amount of eth as collateral
     * @param _uniTokenId id of uniswap v3 position token
     * @param _isWAmount if the input amount is a wPowerPerp amount (as opposed to rebasing powerPerp)
     * @return the vaultId that was acted on or for a new vault the newly created vaultId
     * @return the minted wPowerPerp amount
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
        uint256 wPowerPerpAmount = _isWAmount ? _mintAmount : _mintAmount.mul(ONE).div(cachedNormFactor);
        uint256 feeAmount;
        VaultLib.Vault memory cachedVault;

        // load vault or create new a new one
        if (_vaultId == 0) {
            (_vaultId, cachedVault) = _openVault(_account);
        } else {
            // make sure we're not accessing an unexistent vault.
            _checkCanModifyVault(_vaultId, msg.sender);
            cachedVault = vaults[_vaultId];
        }

        if (wPowerPerpAmount > 0) {
            (feeAmount, depositAmountWithFee) = _getFee(cachedVault, wPowerPerpAmount, _depositAmount);
            _mintWPowerPerp(cachedVault, _account, _vaultId, wPowerPerpAmount);
        }
        if (_depositAmount > 0) _addEthCollateral(cachedVault, _vaultId, depositAmountWithFee);
        if (_uniTokenId != 0) _depositUniPositionToken(cachedVault, _account, _vaultId, _uniTokenId);

        _checkVault(cachedVault, cachedNormFactor);
        _writeVault(_vaultId, cachedVault);

        // pay insurance fee
        if (feeAmount > 0) payable(feeRecipient).sendValue(feeAmount);

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
        uint256 cachedNormFactor = _applyFunding();
        uint256 wBurnAmount = _isWAmount ? _burnAmount : _burnAmount.mul(ONE).div(cachedNormFactor);

        VaultLib.Vault memory cachedVault = vaults[_vaultId];
        if (wBurnAmount > 0) _burnWPowerPerp(cachedVault, _account, _vaultId, wBurnAmount);
        if (_withdrawAmount > 0) _withdrawCollateral(cachedVault, _vaultId, _withdrawAmount);
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
        emit OpenVault(msg.sender, vaultId);
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
        //get tokens for uniswap NFT
        (, , address token0, address token1, uint24 fee, , , uint128 liquidity, , , , ) = INonfungiblePositionManager(
            uniswapPositionManager
        ).positions(_uniTokenId);

        // require that liquidity is above 0
        require(liquidity > 0, "C25");
        // accept NFTs from only the wPowerPerp pool
        require(fee == feeTier, "C26");
        // check token0 and token1
        require((token0 == wPowerPerp && token1 == weth) || (token1 == wPowerPerp && token0 == weth), "C23");

        _vault.addUniNftCollateral(_uniTokenId);
        INonfungiblePositionManager(uniswapPositionManager).safeTransferFrom(_account, address(this), _uniTokenId);
        emit DepositUniPositionToken(msg.sender, _vaultId, _uniTokenId);
    }

    /**
     * @notice add eth collateral into a vault
     * @dev this function will update the vault memory in-place
     * @param _vault the Vault memory to update.
     * @param _vaultId id of the vault
     * @param _amount amount of eth adding to the vault
     */
    function _addEthCollateral(
        VaultLib.Vault memory _vault,
        uint256 _vaultId,
        uint256 _amount
    ) internal {
        _vault.addEthCollateral(_amount);
        emit DepositCollateral(msg.sender, _vaultId, _amount);
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
        uint256 tokenId = _vault.NftCollateralId;
        _vault.removeUniNftCollateral();
        INonfungiblePositionManager(uniswapPositionManager).safeTransferFrom(address(this), _account, tokenId);
        emit WithdrawUniPositionToken(msg.sender, _vaultId, tokenId);
    }

    /**
     * @notice remove eth collateral from the vault
     * @dev this function will update the vault memory in-place
     * @param _vault the Vault memory to update
     * @param _vaultId id of the vault
     * @param _amount amount of eth to withdraw
     */
    function _withdrawCollateral(
        VaultLib.Vault memory _vault,
        uint256 _vaultId,
        uint256 _amount
    ) internal {
        _vault.removeEthCollateral(_amount);

        emit WithdrawCollateral(msg.sender, _vaultId, _amount);
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
        _vault.addShort(_wPowerPerpAmount);
        IWPowerPerp(wPowerPerp).mint(_account, _wPowerPerpAmount);

        emit MintShort(msg.sender, _wPowerPerpAmount, _vaultId);
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

        emit BurnShort(msg.sender, _wPowerPerpAmount, _vaultId);
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
        (uint256 liquidateAmount, uint256 collateralToPay) = _getLiquidationResult(
            _maxWPowerPerpAmount,
            uint256(_vault.shortAmount),
            uint256(_vault.collateralAmount)
        );

        // if the liquidator didn't specify enough wPowerPerp to burn, revert.
        require(_maxWPowerPerpAmount >= liquidateAmount, "C21");

        IWPowerPerp(wPowerPerp).burn(_liquidator, liquidateAmount);
        _vault.removeShort(liquidateAmount);
        _vault.removeEthCollateral(collateralToPay);

        (, bool isDust) = _getVaultStatus(_vault, _normalizationFactor);
        require(!isDust, "C22");

        return (liquidateAmount, collateralToPay);
    }

    /**
     * @notice redeem uniswap v3 position in a vault for its constituent eth and wPowerPerp
     * @notice this will increase vault collateral by the amount of eth, and decrease debt by the amount of wPowerPerp
     * @dev will be executed before liquidation if there's an NFT in the vault
     * @dev pays a 2% bounty to the liquidator if called by liquidate()
     * @dev will update the vault memory in-place
     * @param _vault the Vault memory to update
     * @param _owner account to send any excess
     * @param _vaultId id of the vault to reduce debt on
     * @param _payBounty true if paying caller 2% bounty
     * @return bounty amount of bounty paid for liquidator
     */
    function _reduceDebt(
        VaultLib.Vault memory _vault,
        address _owner,
        uint256 _vaultId,
        bool _payBounty
    ) internal returns (uint256) {
        uint256 nftId = _vault.NftCollateralId;
        if (nftId == 0) return 0;

        (uint256 withdrawnEthAmount, uint256 withdrawnWPowerPerpAmount) = _redeemUniToken(nftId);

        // change weth back to eth
        if (withdrawnEthAmount > 0) IWETH9(weth).withdraw(withdrawnEthAmount);

        (uint256 burnAmount, uint256 excess, uint256 bounty) = _getReduceDebtResultInVault(
            _vault,
            withdrawnEthAmount,
            withdrawnWPowerPerpAmount,
            _payBounty
        );

        if (excess > 0) IWPowerPerp(wPowerPerp).transfer(_owner, excess);
        if (burnAmount > 0) IWPowerPerp(wPowerPerp).burn(address(this), burnAmount);

        emit ReduceDebt(
            msg.sender,
            _vaultId,
            withdrawnEthAmount,
            withdrawnWPowerPerpAmount,
            burnAmount,
            excess,
            bounty
        );

        return bounty;
    }

    /**
     * @notice pay fee recipient
     * @dev pay in eth from either the vault or the deposit amount
     * @param _vault the Vault memory to update
     * @param _wPowerPerpAmount the amount of wPowerPerpAmount minting
     * @param _depositAmount the amount of eth depositing or withdrawing
     * @return the amount of actual deposited eth into the vault, this is less than the original amount if a fee was taken
     */
    function _getFee(
        VaultLib.Vault memory _vault,
        uint256 _wPowerPerpAmount,
        uint256 _depositAmount
    ) internal view returns (uint256, uint256) {
        uint256 cachedFeeRate = feeRate;
        if (cachedFeeRate == 0) return (uint256(0), _depositAmount);
        uint256 depositAmountAfterFee;
        uint256 ethEquivalentMinted = Power2Base._getDebtValueInEth(
            _wPowerPerpAmount,
            oracle,
            wPowerPerpPool,
            wPowerPerp,
            weth
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

        (, , uint128 liquidity, , ) = VaultLib._getUniswapPositionInfo(uniswapPositionManager, _uniTokenId);

        // prepare parameters to withdraw liquidity from uniswap v3 position manager
        INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseParams = INonfungiblePositionManager
            .DecreaseLiquidityParams({
                tokenId: _uniTokenId,
                liquidity: liquidity,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            });

        positionManager.decreaseLiquidity(decreaseParams);

        // withdraw max amount of weth and wPowerPerp from uniswap
        INonfungiblePositionManager.CollectParams memory collectParams = INonfungiblePositionManager.CollectParams({
            tokenId: _uniTokenId,
            recipient: address(this),
            amount0Max: uint128(-1),
            amount1Max: uint128(-1)
        });

        (uint256 collectedToken0, uint256 collectedToken1) = positionManager.collect(collectParams);

        return isWethToken0 ? (collectedToken0, collectedToken1) : (collectedToken1, collectedToken0);
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

        emit NormalizationFactorUpdated(
            normalizationFactor,
            newNormalizationFactor,
            lastFundingUpdateTimestamp,
            block.timestamp
        );

        // the following will be batch into 1 SSTORE because of type uint128
        normalizationFactor = newNormalizationFactor.toUint128();
        lastFundingUpdateTimestamp = block.timestamp.toUint128();

        return newNormalizationFactor;
    }

    /**
     * @dev calculate new normalization factor base on the current timestamp
     * @return new normalization factor if funding happens in the current block
     */
    function _getNewNormalizationFactor() internal view returns (uint256) {
        uint32 period = block.timestamp.sub(lastFundingUpdateTimestamp).toUint32();

        if (period == 0) {
            return normalizationFactor;
        }

        // make sure we use the same period for mark and index
        uint32 periodForOracle = _getConsistentPeriodForOracle(period);

        // avoid reading normalizationFactor from storage multiple times
        uint256 cacheNormFactor = normalizationFactor;

        uint256 mark = Power2Base._getDenormalizedMark(
            periodForOracle,
            oracle,
            wPowerPerpPool,
            ethQuoteCurrencyPool,
            weth,
            quoteCurrency,
            wPowerPerp,
            cacheNormFactor
        );
        uint256 index = Power2Base._getIndex(periodForOracle, oracle, ethQuoteCurrencyPool, weth, quoteCurrency);

        //the fraction of the funding period. used to compound the funding rate
        int128 rFunding = ABDKMath64x64.divu(period, FUNDING_PERIOD);

        // floor mark to be at least LOWER_MARK_RATIO of index
        uint256 lowerBound = index.mul(LOWER_MARK_RATIO).div(ONE);
        if (mark < lowerBound) {
            mark = lowerBound;
        } else {
            // cap mark to be at most UPPER_MARK_RATIO of index
            uint256 upperBound = index.mul(UPPER_MARK_RATIO).div(ONE);
            if (mark > upperBound) mark = upperBound;
        }

        // normFactor(new) = multiplier * normFactor(old)
        // multiplier = (index/mark)^rFunding
        // x^r = n^(log_n(x) * r)
        // multiplier = 2^( log2(index/mark) * rFunding )

        int128 base = ABDKMath64x64.divu(index, mark);
        int128 logTerm = ABDKMath64x64.log_2(base).mul(rFunding);
        int128 multiplier = logTerm.exp_2();
        return multiplier.mulu(cacheNormFactor);
    }

    /**
     * @notice check if vault has enough collateral and is not a dust vault
     * @dev revert if vault has insufficient collateral or is a dust vault
     * @param _vault the Vault memory to update
     * @param _normalizationFactor normalization factor
     */
    function _checkVault(VaultLib.Vault memory _vault, uint256 _normalizationFactor) internal view {
        (bool isSafe, bool isDust) = _getVaultStatus(_vault, _normalizationFactor);
        require(isSafe, "C24");
        require(!isDust, "C22");
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
        uint256 scaledEthPrice = Power2Base._getScaledTwap(
            oracle,
            ethQuoteCurrencyPool,
            weth,
            quoteCurrency,
            TWAP_PERIOD,
            true // do not call more than maximum period so it does not revert
        );
        return
            VaultLib.getVaultStatus(
                _vault,
                uniswapPositionManager,
                _normalizationFactor,
                scaledEthPrice,
                MIN_COLLATERAL,
                IOracle(oracle).getTimeWeightedAverageTickSafe(wPowerPerpPool, TWAP_PERIOD),
                isWethToken0
            );
    }

    /**
     * @notice get the expected excess, burnAmount and bounty if Uniswap position token got burned
     * @dev this function will update the vault memory in-place
     * @return burnAmount amount of wPowerPerp that should be burned
     * @return wPowerPerpExcess amount of wPowerPerp that should be send to the vault owner
     * @return bounty amount of bounty should be paid out to caller
     */
    function _getReduceDebtResultInVault(
        VaultLib.Vault memory _vault,
        uint256 nftEthAmount,
        uint256 nftWPowerperpAmount,
        bool _payBounty
    )
        internal
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        uint256 bounty;
        if (_payBounty) bounty = _getReduceDebtBounty(nftEthAmount, nftWPowerperpAmount);

        uint256 burnAmount = nftWPowerperpAmount;
        uint256 wPowerPerpExcess;

        if (nftWPowerperpAmount > _vault.shortAmount) {
            wPowerPerpExcess = nftWPowerperpAmount.sub(_vault.shortAmount);
            burnAmount = _vault.shortAmount;
        }

        _vault.removeShort(burnAmount);
        _vault.removeUniNftCollateral();
        _vault.addEthCollateral(nftEthAmount);
        _vault.removeEthCollateral(bounty);

        return (burnAmount, wPowerPerpExcess, bounty);
    }

    /**
     * @notice get how much bounty you can get by helping a vault reducing the debt.
     * @dev bounty is 2% of the total value of the position token
     * @param _ethWithdrawn amount of eth withdrawn from uniswap by redeeming the position token
     * @param _wPowerPerpReduced amount of wPowerPerp withdrawn from uniswap by redeeming the position token
     */
    function _getReduceDebtBounty(uint256 _ethWithdrawn, uint256 _wPowerPerpReduced) internal view returns (uint256) {
        return
            Power2Base
                ._getDebtValueInEth(_wPowerPerpReduced, oracle, wPowerPerpPool, wPowerPerp, weth)
                .add(_ethWithdrawn)
                .mul(REDUCE_DEBT_BOUNTY)
                .div(ONE);
    }

    /**
     * @notice get the expected wPowerPerp needed to liquidate a vault.
     * @dev a liquidator cannot liquidate more than half of a vault, unless only liquidating half of the debt will make the vault a "dust vault"
     * @dev a liquidator cannot take out more collateral than the vault holds
     * @param _maxWPowerPerpAmount the max amount of wPowerPerp willing to pay
     * @param _vaultShortAmount the amount of short in the vault
     * @param _maxWPowerPerpAmount the amount of collateral in the vault
     * @return finalLiquidateAmount the amount that should be liquidated. This amount can be higher than _maxWPowerPerpAmount, which should be checked
     * @return collateralToPay final amount of collateral paying out to the liquidator
     */
    function _getLiquidationResult(
        uint256 _maxWPowerPerpAmount,
        uint256 _vaultShortAmount,
        uint256 _vaultCollateralAmount
    ) internal view returns (uint256, uint256) {
        // try limiting liquidation amount to half of the vault debt
        (uint256 finalLiquidateAmount, uint256 collateralToPay) = _getSingleLiquidationAmount(
            _maxWPowerPerpAmount,
            _vaultShortAmount.div(2)
        );

        if (_vaultCollateralAmount > collateralToPay) {
            if (_vaultCollateralAmount.sub(collateralToPay) < MIN_COLLATERAL) {
                // the vault is left with dust after liquidation, allow liquidating full vault
                // calculate the new liquidation amount and collateral again based on the new limit
                (finalLiquidateAmount, collateralToPay) = _getSingleLiquidationAmount(
                    _maxWPowerPerpAmount,
                    _vaultShortAmount
                );
            }
        }

        // check if final collateral to pay is greater than vault amount.
        // if so the system only pays out the amount the vault has, which may not be profitable
        if (collateralToPay > _vaultCollateralAmount) {
            // force liquidator to pay full debt amount
            finalLiquidateAmount = _vaultShortAmount;
            collateralToPay = _vaultCollateralAmount;
        }

        return (finalLiquidateAmount, collateralToPay);
    }

    /**
     * @notice determine how much wPowerPerp to liquidate, and how much collateral to return
     * @param _maxInputWAmount maximum wPowerPerp amount liquidator is willing to repay
     * @param _maxLiquidatableWAmount maximum wPowerPerp amount a liquidator is allowed to repay
     * @return finalWAmountToLiquidate amount of wPowerPerp the liquidator will burn
     * @return collateralToPay total collateral the liquidator will get
     */
    function _getSingleLiquidationAmount(uint256 _maxInputWAmount, uint256 _maxLiquidatableWAmount)
        internal
        view
        returns (uint256, uint256)
    {
        uint256 finalWAmountToLiquidate = _maxInputWAmount > _maxLiquidatableWAmount
            ? _maxLiquidatableWAmount
            : _maxInputWAmount;

        uint256 collateralToPay = Power2Base._getDebtValueInEth(
            finalWAmountToLiquidate,
            oracle,
            wPowerPerpPool,
            wPowerPerp,
            weth
        );

        // add 10% bonus for liquidators
        collateralToPay = collateralToPay.add(collateralToPay.mul(LIQUIDATION_BOUNTY).div(ONE));

        return (finalWAmountToLiquidate, collateralToPay);
    }

    /**
     * @notice get a period can be used to request a twap for 2 uniswap v3 pools
     * @dev if the period is greater than min(max_pool_1, max_pool_2), return min(max_pool_1, max_pool_2)
     * @param _period max period that we intend to use
     * @return fair period not greator than _period to be used for both pools.
     */
    function _getConsistentPeriodForOracle(uint32 _period) internal view returns (uint32) {
        uint32 maxPeriodPool1 = IOracle(oracle).getMaxPeriod(ethQuoteCurrencyPool);
        uint32 maxPeriodPool2 = IOracle(oracle).getMaxPeriod(wPowerPerpPool);

        uint32 maxSafePeriod = maxPeriodPool1 > maxPeriodPool2 ? maxPeriodPool2 : maxPeriodPool1;
        return _period > maxSafePeriod ? maxSafePeriod : _period;
    }
}
