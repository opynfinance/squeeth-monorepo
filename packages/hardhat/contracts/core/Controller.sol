//SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

import "hardhat/console.sol";

import {IWSqueeth} from "../interfaces/IWSqueeth.sol";
import {IVaultManagerNFT} from "../interfaces/IVaultManagerNFT.sol";
import {IOracle} from "../interfaces/IOracle.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {INonfungiblePositionManager} from "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/Initializable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {VaultLib} from "../libs/VaultLib.sol";

contract Controller is Initializable, Ownable {
    using SafeMath for uint256;
    using VaultLib for VaultLib.Vault;
    using Address for address payable;

    uint256 internal constant secInDay = 86400;

    bool public isShutDown = false;

    address public weth;
    address public dai;
    address public ethDaiPool;
    address public wSqueethEthPool;
    address public uniswapPositionManager;

    uint256 public shutDownEthPriceSnapshot;
    uint256 public normalizationFactor;
    uint256 public lastFundingUpdateTimestamp;

    bool public isWethToken0;

    /// @dev The token ID vault data
    mapping(uint256 => VaultLib.Vault) public vaults;

    IVaultManagerNFT public vaultNFT;
    IWSqueeth public wsqueeth;
    IOracle public oracle;

    /// Events
    event OpenVault(uint256 vaultId);
    event CloseVault(uint256 vaultId);
    event DepositCollateral(uint256 vaultId, uint128 amount, uint128 collateralId);
    event DepositUniNftCollateral(uint256 vaultId, uint256 tokenId);
    event WithdrawCollateral(uint256 vaultId, uint256 amount, uint128 collateralId);
    event WithdrawUniNftCollateral(uint256 vaultId, uint256 tokenId);
    event MintShort(uint256 amount, uint256 vaultId);
    event BurnShort(uint256 amount, uint256 vaultId);
    event UpdateOperator(uint256 vaultId, address operator);
    event Liquidate(uint256 vaultId, uint256 debtAmount, uint256 collateralToSell);

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
     * init controller with squeeth and short NFT address
     */
    function init(
        address _oracle,
        address _vaultNFT,
        address _squeeth,
        address _weth,
        address _dai,
        address _ethDaiPool,
        address _wSqueethEthPool,
        address _uniPositionManager
    ) public initializer {
        require(_oracle != address(0), "Invalid oracle address");
        require(_vaultNFT != address(0), "Invalid vaultNFT address");
        require(_squeeth != address(0), "Invalid squeeth address");
        require(_ethDaiPool != address(0), "Invalid eth:dai pool address");
        require(_wSqueethEthPool != address(0), "Invalid wsqueeth:eth pool address");

        oracle = IOracle(_oracle);
        vaultNFT = IVaultManagerNFT(_vaultNFT);
        wsqueeth = IWSqueeth(_squeeth);

        ethDaiPool = _ethDaiPool;
        wSqueethEthPool = _wSqueethEthPool;
        uniswapPositionManager = _uniPositionManager;

        weth = _weth;
        dai = _dai;

        normalizationFactor = 1e18;
        lastFundingUpdateTimestamp = block.timestamp;

        isWethToken0 = weth < _squeeth;
    }

    /**
     * put down collateral and mint squeeth.
     * This mints an amount of rSqueeth.
     */
    function mint(
        uint256 _vaultId,
        uint128 _mintAmount,
        uint256 _nftTokenId
    ) external payable notShutdown returns (uint256, uint256 _wSqueethMinted) {
        _applyFunding();
        if (_vaultId == 0) _vaultId = _openVault(msg.sender);
        if (msg.value > 0) _addEthCollateral(_vaultId, msg.value);
        if (_nftTokenId != 0) _depositUniNFT(msg.sender, _vaultId, _nftTokenId);
        if (_mintAmount > 0) {
            _wSqueethMinted = _addShort(msg.sender, _vaultId, _mintAmount);
        }
        _checkVault(_vaultId);
        return (_vaultId, _wSqueethMinted);
    }

    /**
     * Deposit collateral into a vault
     */
    function deposit(uint256 _vaultId) external payable notShutdown {
        _applyFunding();
        _addEthCollateral(_vaultId, msg.value);
    }

    /**
     * Deposit Uni NFT as collateral
     */
    function depositUniNFT(uint256 _vaultId, uint256 _tokenId) external notShutdown {
        _applyFunding();
        _depositUniNFT(msg.sender, _vaultId, _tokenId);
    }

    /**
     * Withdraw collateral from a vault.
     */
    function withdraw(uint256 _vaultId, uint256 _amount) external payable notShutdown {
        _applyFunding();
        _withdrawCollateral(msg.sender, _vaultId, _amount);
        _checkVault(_vaultId);
    }

    /**
     * Withdraw Uni NFT from a vault
     */
    function withdrawUniNFT(uint256 _vaultId) external notShutdown {
        _applyFunding();
        _withdrawUniNFT(msg.sender, _vaultId);
        _checkVault(_vaultId);
    }

    /**
     * burn squueth and remove collateral from a vault.
     * This burns an amount of wSqueeth.
     */
    function burn(
        uint256 _vaultId,
        uint256 _amount,
        uint256 _withdrawAmount
    ) external notShutdown {
        _applyFunding();
        if (_amount > 0) _removeShort(msg.sender, _vaultId, _amount);
        if (_withdrawAmount > 0) _withdrawCollateral(msg.sender, _vaultId, _withdrawAmount);
        _checkVault(_vaultId);
    }

    function liquidate(uint256 _vaultId, uint256 _debtAmount) external notShutdown {
        _applyFunding();

        VaultLib.Vault storage vault = vaults[_vaultId];

        require(!_isVaultSafe(vault), "Can not liquidate safe vault");

        require(_debtAmount <= vault.shortAmount.div(2), "Can not repay more than 50% of vault debt");

        uint256 collateralPriceUSD = oracle.getTwaPriceSafe(ethDaiPool, weth, dai, 600);
        uint256 collateralToSell = _debtAmount.mul(normalizationFactor).mul(collateralPriceUSD).div(1e36);
        collateralToSell = collateralToSell.add(collateralToSell.div(10));

        wsqueeth.burn(msg.sender, _debtAmount);
        vault.removeShort(_debtAmount);
        vault.removeEthCollateral(collateralToSell);
        payable(msg.sender).sendValue(collateralToSell);

        emit Liquidate(_vaultId, _debtAmount, collateralToSell);
    }

    function getIndex(uint32 _period) external view returns (uint256) {
        return _getIndex(_period);
    }

    function getDenormalizedMark(uint32 _period) external view returns (uint256) {
        return _getDenormalizedMark(_period);
    }

    /**
     * Authorize an address to modify the vault. Can be revoke by setting address to 0.
     */
    function updateOperator(uint256 _vaultId, address _operator) external {
        require(_canModifyVault(_vaultId, msg.sender), "not allowed");
        vaults[_vaultId].operator = _operator;
        emit UpdateOperator(_vaultId, _operator);
    }

    /**
     * shutdown the system and enable redeeming long and short
     */
    function shutDown() external onlyOwner {
        require(!isShutDown, "shutdown");
        isShutDown = true;
        shutDownEthPriceSnapshot = oracle.getTwaPriceSafe(ethDaiPool, weth, dai, 600);
    }

    function redeemLong(uint256 _wsqueethAmount) external {
        require(isShutDown, "!shutdown");
        wsqueeth.burn(msg.sender, _wsqueethAmount);
        // convert wSqueeth amount to real short position with normalizationFactor
        uint256 longValue = _wsqueethAmount.mul(normalizationFactor).mul(shutDownEthPriceSnapshot).div(1e36);
        payable(msg.sender).sendValue(longValue);
    }

    function redeemShort(uint256 _vaultId) external {
        require(isShutDown, "!shutdown");
        require(_canModifyVault(_vaultId, msg.sender), "not allowed");

        uint256 _shortSqueethAmount = vaults[_vaultId].shortAmount;
        uint256 debt = _shortSqueethAmount.mul(shutDownEthPriceSnapshot).mul(normalizationFactor).div(1e36);
        // if the debt is more than collateral, this line will revert
        uint256 excess = vaults[_vaultId].collateralAmount.sub(debt);

        // reset the vault but don't burn the nft, just because people may want to keep it.
        vaults[_vaultId].shortAmount = 0;
        vaults[_vaultId].collateralAmount = 0;

        // todo: handle uni nft collateral

        payable(msg.sender).sendValue(excess);
    }

    /**
     * Update the normalized factor as a way to pay funding.
     */
    function applyFunding() external {
        _applyFunding();
    }

    /**
     * a function to add eth into a contract, in case it got insolvent and have ensufficient eth to pay out.
     */
    function donate() external payable {}

    /*
     * ======================
     * | Internal Functions |
     * ======================
     */

    function _canModifyVault(uint256 _vaultId, address _account) internal view returns (bool) {
        return vaultNFT.ownerOf(_vaultId) == _account || vaults[_vaultId].operator == _account;
    }

    /**
     * create a new vault and bind it with a new NFT id.
     */
    function _openVault(address _recipient) internal returns (uint256 vaultId) {
        vaultId = vaultNFT.mintNFT(_recipient);
        vaults[vaultId] = VaultLib.Vault({
            NftCollateralId: 0,
            collateralAmount: 0,
            shortAmount: 0,
            operator: address(0)
        });
        emit OpenVault(vaultId);
    }

    function _depositUniNFT(
        address _account,
        uint256 _vaultId,
        uint256 _tokenId
    ) internal {
        _checkUniNFT(_tokenId);
        vaults[_vaultId].addUniNftCollateral(_tokenId);
        INonfungiblePositionManager(uniswapPositionManager).transferFrom(_account, address(this), _tokenId);
        emit DepositUniNftCollateral(_vaultId, _tokenId);
    }

    /**
     * add collateral to a vault
     */
    function _addEthCollateral(uint256 _vaultId, uint256 _amount) internal {
        vaults[_vaultId].addEthCollateral(uint128(_amount));
        emit DepositCollateral(_vaultId, uint128(_amount), 0);
    }

    /**
     * withdraw uni nft
     */
    function _withdrawUniNFT(address _account, uint256 _vaultId) internal {
        uint256 tokenId = vaults[_vaultId].removeUniNftCollateral();
        INonfungiblePositionManager(uniswapPositionManager).transferFrom(address(this), _account, tokenId);
        emit WithdrawUniNftCollateral(_vaultId, tokenId);
    }

    /**
     * remove collateral from the vault
     */
    function _withdrawCollateral(
        address _account,
        uint256 _vaultId,
        uint256 _amount
    ) internal {
        require(_canModifyVault(_vaultId, _account), "not allowed");
        vaults[_vaultId].removeEthCollateral(_amount);
        payable(_account).sendValue(_amount);
        emit WithdrawCollateral(_vaultId, _amount, 0);
    }

    /**
     * mint wsqueeth (ERC20) to an account
     */
    function _addShort(
        address _account,
        uint256 _vaultId,
        uint256 _squeethAmount
    ) internal returns (uint256 amountToMint) {
        require(_canModifyVault(_vaultId, _account), "not allowed");

        amountToMint = _squeethAmount.mul(1e18).div(normalizationFactor);
        vaults[_vaultId].addShort(amountToMint);
        wsqueeth.mint(_account, amountToMint);

        emit MintShort(amountToMint, _vaultId);
    }

    /**
     * burn wsqueeth (ERC20) from an account.
     */
    function _removeShort(
        address _account,
        uint256 _vaultId,
        uint256 _amount
    ) internal {
        vaults[_vaultId].removeShort(_amount);
        wsqueeth.burn(_account, _amount);

        emit BurnShort(_amount, _vaultId);
    }

    /**
     * Update the normalized factor as a way to pay funding.
     */
    function _applyFunding() internal {
        uint32 period = uint32(block.timestamp - lastFundingUpdateTimestamp);

        // make sure we use the same period for mark and index, and this period won't cause revert.
        uint32 fairPeriod = _getFairPeriodForOracle(period);

        uint256 mark = _getDenormalizedMark(fairPeriod);
        uint256 index = _getIndex(fairPeriod);
        uint256 rFunding = (uint256(1e18).mul(uint256(period))).div(secInDay);

        // mul by 1e36 to keep newNormalizationFactor in 18 decimals
        // uint256 newNormalizationFactor = (mark * 1e36) / (((1e18 + rFunding) * mark - index * rFunding));
        uint256 newNormalizationFactor = (mark.mul(1e36)).div(
            ((uint256(1e18).add(rFunding)).mul(mark).sub(index.mul(rFunding)))
        );

        normalizationFactor = normalizationFactor.mul(newNormalizationFactor).div(1e18);
        lastFundingUpdateTimestamp = block.timestamp;
    }

    /**
     * check that the specified tokenId is a valid squeeth/weth lp token.
     */
    function _checkUniNFT(uint256 _tokenId) internal view {
        (, , address token0, address token1, , , , , , , , ) = INonfungiblePositionManager(uniswapPositionManager)
            .positions(_tokenId);
        // only check token0 and token1, ignore fee.
        // If there are multiple wsqueeth/eth pools with different fee rate, we accept LP tokens from all of them.
        address wsqueethAddr = address(wsqueeth); // cache storage variable
        address wethAddr = weth; // cache storage variable
        require(
            (token0 == wsqueethAddr && token1 == wethAddr) || (token1 == wsqueethAddr && token0 == wethAddr),
            "Invalid nft"
        );
    }

    /**
     * @dev check that the vault is solvent and has enough collateral.
     */
    function _checkVault(uint256 _vaultId) internal view {
        if (_vaultId == 0) return;
        VaultLib.Vault memory vault = vaults[_vaultId];

        require(_isVaultSafe(vault), "Invalid state");
    }

    function _isVaultSafe(VaultLib.Vault memory _vault) internal view returns (bool) {
        uint256 ethDaiPrice = oracle.getTwaPriceSafe(ethDaiPool, weth, dai, 300);
        int24 squeethPoolTick = oracle.getTimeWeightedAverageTickSafe(wSqueethEthPool, 300);
        return
            VaultLib.isProperlyCollateralized(
                _vault,
                uniswapPositionManager,
                normalizationFactor,
                ethDaiPrice,
                squeethPoolTick,
                isWethToken0
            );
    }

    function _getIndex(uint32 _period) internal view returns (uint256) {
        uint256 ethDaiPrice = _getTwap(ethDaiPool, weth, dai, _period);
        return ethDaiPrice.mul(ethDaiPrice).div(1e18);
    }

    function _getDenormalizedMark(uint32 _period) public view returns (uint256) {
        uint256 ethDaiPrice = _getTwap(ethDaiPool, weth, dai, _period);
        uint256 squeethEthPrice = _getTwap(wSqueethEthPool, address(wsqueeth), weth, _period);

        return squeethEthPrice.mul(ethDaiPrice).div(normalizationFactor);
    }

    function _getFairPeriodForOracle(uint32 _period) internal view returns (uint32) {
        uint32 maxSafePeriod = _getMaxSafePeriod();
        return _period > maxSafePeriod ? maxSafePeriod : _period;
    }

    /**
     * return the smaller of the max periods of 2 pools
     */
    function _getMaxSafePeriod() internal view returns (uint32) {
        uint32 maxPeriodPool1 = oracle.getMaxPeriod(ethDaiPool);
        uint32 maxPeriodPool2 = oracle.getMaxPeriod(wSqueethEthPool);
        return maxPeriodPool1 > maxPeriodPool2 ? maxPeriodPool2 : maxPeriodPool1;
    }

    function _getTwap(
        address _pool,
        address _base,
        address _quote,
        uint32 _period
    ) internal view returns (uint256) {
        // period reaching this point should be check, otherwise might revert
        uint256 twap = oracle.getTwaPrice(_pool, _base, _quote, _period);
        require(twap != 0, "WAP WAP WAP");

        return twap;
    }
}
