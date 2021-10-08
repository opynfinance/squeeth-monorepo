//SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma abicoder v2;

import "hardhat/console.sol";

import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";
import {IVaultManagerNFT} from "../interfaces/IVaultManagerNFT.sol";
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

    uint256 internal constant secInDay = 86400;

    bool public isShutDown = false;

    address public weth;
    address public dai;
    address public ethDaiPool;

    /// @dev address of the powerPerp/weth pool
    address public powerPerpPool;

    address public uniswapPositionManager;

    uint256 public shutDownEthPriceSnapshot;
    uint256 public normalizationFactor;
    uint256 public lastFundingUpdateTimestamp;

    bool public isWethToken0;

    /// @dev The token ID vault data
    mapping(uint256 => VaultLib.Vault) public vaults;

    IVaultManagerNFT public vaultNFT;
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
    event Liquidate(uint256 vaultId, uint256 debtAmount, uint256 collateralPaid);
    event NormalizationFactorUpdated(uint256 oldNormFactor, uint256 newNormFactor, uint256 timestamp);

    modifier notShutdown() {
        require(!isShutDown, "shutdown");
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
        return
            Power2Base._getDenormalizedMark(
                _period,
                address(oracle),
                powerPerpPool,
                ethDaiPool,
                weth,
                dai,
                address(wPowerPerp),
                normalizationFactor
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
     * @param _vaultNFT erc721 token address representing the short position
     * @param _wPowerPerp erc20 token address representing non-rebasing long position
     * @param _weth weth address
     * @param _dai dai address
     * @param _ethDaiPool uniswap v3 pool for weth / dai
     * @param _powerPerpPool uniswap v3 pool for wPowerPerp / weth
     * @param _uniPositionManager uniswap v3 nonfungible position manager address
     */
    function init(
        address _oracle,
        address _vaultNFT,
        address _wPowerPerp,
        address _weth,
        address _dai,
        address _ethDaiPool,
        address _powerPerpPool,
        address _uniPositionManager
    ) public initializer {
        require(_oracle != address(0), "Invalid oracle address");
        require(_vaultNFT != address(0), "Invalid vaultNFT address");
        require(_wPowerPerp != address(0), "Invalid power perp address");
        require(_ethDaiPool != address(0), "Invalid eth:dai pool address");
        require(_powerPerpPool != address(0), "Invalid powerperp:eth pool address");

        oracle = IOracle(_oracle);
        vaultNFT = IVaultManagerNFT(_vaultNFT);
        wPowerPerp = IWPowerPerp(_wPowerPerp);

        ethDaiPool = _ethDaiPool;
        powerPerpPool = _powerPerpPool;
        uniswapPositionManager = _uniPositionManager;

        weth = _weth;
        dai = _dai;

        normalizationFactor = 1e18;
        lastFundingUpdateTimestamp = block.timestamp;

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
    ) external payable notShutdown returns (uint256, uint256) {
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
    ) external payable notShutdown returns (uint256) {
        (uint256 vaultId, ) = _openDepositMint(msg.sender, _vaultId, _wPowerPerpAmount, msg.value, _uniTokenId, true);
        return vaultId;
    }

    /**
     * @dev deposit collateral into a vault
     * @param _vaultId id of the vault
     */
    function deposit(uint256 _vaultId) external payable notShutdown {
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
    function depositUniPositionToken(uint256 _vaultId, uint256 _uniTokenId) external notShutdown {
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
    function withdraw(uint256 _vaultId, uint256 _amount) external payable notShutdown {
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
    function withdrawUniPositionToken(uint256 _vaultId) external notShutdown {
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
    ) external notShutdown {
        _burnAndWithdraw(msg.sender, _vaultId, _wPowerPerpAmount, _withdrawAmount, true);
    }

    /**
     * @notice burn powerPerp and remove collateral from a vault.
     * @param _vaultId id of the vault
     * @param _powerPerpAmount amount of powerPerp to burn
     * @param _withdrawAmount amount of eth to withdraw
     * @return amount of wPowerPerp burned
     */
    function burnOnPowerPerpAmount(
        uint256 _vaultId,
        uint256 _powerPerpAmount,
        uint256 _withdrawAmount
    ) external notShutdown returns (uint256) {
        return _burnAndWithdraw(msg.sender, _vaultId, _powerPerpAmount, _withdrawAmount, false);
    }

    /**
     * @notice if a vault is unsafe and has a UNI NFT in it, owner call redeem the NFT to pay back some debt.
     * @dev the caller won't get any bounty. this is expected to be used by vault owner
     * @param _vaultId the vault you want to save
     */
    function reduceDebt(uint256 _vaultId) external notShutdown {
        require(_canModifyVault(_vaultId, msg.sender), "not allowed");
        uint256 cachedNormFactor = _applyFunding();
        VaultLib.Vault memory cachedVault = vaults[_vaultId];

        _reduceDebt(cachedVault, vaultNFT.ownerOf(_vaultId), cachedNormFactor, false);

        _writeVault(_vaultId, cachedVault);
    }

    /**
     * @notice if a vault is under the 150% collateral ratio, anyone can liquidate the vault by burning wPowerPerp
     * @dev liquidator can get back (powerPerp burned) * (index price) * 110% in collateral
     * @param _vaultId the vault you want to liquidate
     * @param _maxDebtAmount max amount of wPowerPerpetual you want to repay.
     * @return amount of wPowerPerp repaid.
     */
    function liquidate(uint256 _vaultId, uint256 _maxDebtAmount) external notShutdown returns (uint256) {
        uint256 cachedNormFactor = _applyFunding();

        VaultLib.Vault memory cachedVault = vaults[_vaultId];

        require(!_isVaultSafe(cachedVault, cachedNormFactor), "Can not liquidate safe vault");

        // try to save target vault before liquidation by reducing debt
        uint256 bounty = _reduceDebt(cachedVault, vaultNFT.ownerOf(_vaultId), cachedNormFactor, true);

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
        require(_canModifyVault(_vaultId, msg.sender), "not allowed");
        vaults[_vaultId].operator = _operator;
        emit UpdateOperator(_vaultId, _operator);
    }

    /**
     * @dev shutdown the system and enable system settlement
     */
    function shutDown() external onlyOwner {
        require(!isShutDown, "shutdown");
        isShutDown = true;
        shutDownEthPriceSnapshot = oracle.getTwapSafe(ethDaiPool, weth, dai, 600);
    }

    /**
     * @dev redeem wPowerPerp for its index value when the system is shutdown
     * @param _wPerpAmount amount of wPowerPerp to burn
     */
    function redeemLong(uint256 _wPerpAmount) external {
        require(isShutDown, "!shutdown");
        wPowerPerp.burn(msg.sender, _wPerpAmount);

        uint256 longValue = Power2Base._getLongSettlementValue(
            _wPerpAmount,
            shutDownEthPriceSnapshot,
            normalizationFactor
        );
        payable(msg.sender).sendValue(longValue);
    }

    /**
     * @dev redeem additional collateral from the vault when the system is shutdown
     * @param _vaultId vauld id
     */
    function redeemShort(uint256 _vaultId) external {
        require(isShutDown, "!shutdown");
        require(_canModifyVault(_vaultId, msg.sender), "not allowed");

        uint256 debt = Power2Base._getLongSettlementValue(
            vaults[_vaultId].shortAmount,
            shutDownEthPriceSnapshot,
            normalizationFactor
        );
        // if the debt is more than collateral, this line will revert
        uint256 excess = uint256(vaults[_vaultId].collateralAmount).sub(debt);

        // reset the vault but don't burn the nft, just because people may want to keep it.
        vaults[_vaultId].shortAmount = 0;
        vaults[_vaultId].collateralAmount = 0;

        // todo: handle uni nft collateral

        payable(msg.sender).sendValue(excess);
    }

    /**
     * @dev update the normalization factor as a way to pay funding.
     */
    function applyFunding() external {
        _applyFunding();
    }

    /**
     * @notice a function to add eth into a contract, in case it got insolvent and have ensufficient eth to pay out.
     */
    function donate() external payable {}

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
        if (_vaultId == 0) return true; // create a new vault
        return vaultNFT.ownerOf(_vaultId) == _account || vaults[_vaultId].operator == _account;
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

        uint256 wPowerPerpAmount = _isWAmount ? _mintAmount : _mintAmount.mul(1e18).div(cachedNormFactor);

        VaultLib.Vault memory cachedVault;

        // load vault or create new a new one
        if (_vaultId == 0) {
            (_vaultId, cachedVault) = _openVault(_account);
        } else {
            cachedVault = vaults[_vaultId];
        }

        if (_depositAmount > 0) _addEthCollateral(cachedVault, _vaultId, _depositAmount);
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
        uint256 vaultId = vaultNFT.mintNFT(_recipient);

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
        require(_canModifyVault(_vaultId, _account), "not allowed");
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
        require(_canModifyVault(_vaultId, _account), "not allowed");

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
        require(_canModifyVault(_vaultId, _account), "not allowed");

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
        uint256 maxLiquidationAmount = uint256(_vault.shortAmount).div(2);

        uint256 wAmountToLiquidate = _maxWPowerPerpAmount > maxLiquidationAmount
            ? maxLiquidationAmount
            : _maxWPowerPerpAmount;

        uint256 collateralToPay = Power2Base._getCollateralByRepayAmount(
            wAmountToLiquidate,
            address(oracle),
            ethDaiPool,
            weth,
            dai,
            _normalizationFactor
        );

        // 10% bonus for liquidators
        collateralToPay = collateralToPay.add(collateralToPay.div(10));

        // if collateralToPay is higher than the total collateral in the vault
        // the system only pays out the amount the vault has, which may not be profitable
        if (collateralToPay > _vault.collateralAmount) collateralToPay = _vault.collateralAmount;

        wPowerPerp.burn(_liquidator, wAmountToLiquidate);
        _vault.removeShort(wAmountToLiquidate);
        _vault.removeEthCollateral(collateralToPay);

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
        uint32 period = uint32(block.timestamp - lastFundingUpdateTimestamp);

        // make sure we use the same period for mark and index, and this period won't cause revert.
        uint32 fairPeriod = _getFairPeriodForOracle(period);

        // avoid reading normalizationFactor  from storage multiple times
        uint256 cacheNormFactor = normalizationFactor;

        uint256 mark = Power2Base._getDenormalizedMark(
            fairPeriod,
            address(oracle),
            powerPerpPool,
            ethDaiPool,
            weth,
            dai,
            address(wPowerPerp),
            cacheNormFactor
        );
        uint256 index = Power2Base._getIndex(fairPeriod, address(oracle), ethDaiPool, weth, dai);
        uint256 rFunding = (uint256(1e18).mul(uint256(period))).div(secInDay);

        // mul by 1e36 to keep newNormalizationFactor in 18 decimals
        // uint256 newNormalizationFactor = (mark * 1e36) / (((1e18 + rFunding) * mark - index * rFunding));
        uint256 newNormalizationFactor = (mark.mul(1e36)).div(
            ((uint256(1e18).add(rFunding)).mul(mark).sub(index.mul(rFunding)))
        );

        return cacheNormFactor.mul(newNormalizationFactor).div(1e18);
    }

    /**
     * @dev check that the specified uni tokenId is a valid powerPerp/weth lp token.
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
     * @dev check that the vault is solvent and has enough collateral.
     */
    function _checkVault(VaultLib.Vault memory _vault, uint256 _normalizationFactor) internal view {
        require(_isVaultSafe(_vault, _normalizationFactor), "Invalid state");
    }

    /**
     * @dev check that the vault is properly collateralized
     * @return if the vault is properly collateralized.
     */
    function _isVaultSafe(VaultLib.Vault memory _vault, uint256 _normalizationFactor) internal view returns (bool) {
        uint256 ethDaiPrice = oracle.getTwapSafe(ethDaiPool, weth, dai, 300);
        int24 perpPoolTick = oracle.getTimeWeightedAverageTickSafe(powerPerpPool, 300);
        return
            VaultLib.isProperlyCollateralized(
                _vault,
                uniswapPositionManager,
                _normalizationFactor,
                ethDaiPrice,
                perpPoolTick,
                isWethToken0
            );
    }

    /**
     * @notice get a fair period that should be used to request twap for 2 pools
     * @dev if the period we want to use is greator than min(max_pool_1, max_pool_2),
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
        uint32 maxPeriodPool2 = oracle.getMaxPeriod(powerPerpPool);
        return maxPeriodPool1 > maxPeriodPool2 ? maxPeriodPool2 : maxPeriodPool1;
    }
}
