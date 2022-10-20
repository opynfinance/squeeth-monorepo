// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

pragma abicoder v2;

// interface
import {IController} from "squeeth-monorepo/interfaces/IController.sol";
import {ICrabStrategyV2} from "./interface/ICrabStrategyV2.sol";
import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
// contract
import {ERC20} from "openzeppelin/token/ERC20/ERC20.sol";
import {LeverageBull} from "./LeverageBull.sol";
import {UniBull} from "./UniBull.sol";
// lib
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
import {VaultLib} from "squeeth-monorepo/libs/VaultLib.sol";

/**
 * @notice BullStrategy contract
 * @dev this is an abstracted BullStrategy in term of deposit and withdraw functionalities
 * @author opyn team
 */
contract BullStrategy is ERC20, LeverageBull, UniBull {
    using StrategyMath for uint256;

    uint256 private constant ONE = 1e18;
    uint32 private constant TWAP = 420;

    /// @dev set to true when redeemShortShutdown has been called
    bool private hasRedeemedInShutdown;
    /// @dev ETH:wSqueeth Uniswap pool
    address private immutable ethWSqueethPool;
    /// @dev ETH:USDC Uniswap pool
    address private immutable ethUSDCPool;
    /// @dev wPowerPerp address
    address private immutable wPowerPerp;

    /// @dev Crab contract address
    address public immutable crab;
    /// @dev PowerToken controller
    address public immutable powerTokenController;

    /// @dev true if Bull was initialized
    bool public isInitialized;
    /// @dev the cap in ETH for the strategy, above which deposits will be rejected
    uint256 public strategyCap;
    /// @dev the highest delta we can have without rebalancing
    uint256 public deltaUpper;
    /// @dev the lowest delta we can have without rebalancing
    uint256 public deltaLower;
    /// @dev the highest CR we can have before rebalancing
    uint256 public crUpper;
    /// @dev the lowest CR we can have before rebalancing
    uint256 public crLower;
    /// @dev target CR for our ETH collateral
    uint256 public crTarget;

    /**
     * @notice constructor for BullStrategy
     * @dev this will open a vault in the power token contract and store the vault ID
     * @param _crab crab address
     * @param _powerTokenController wPowerPerp Controller address
     * @param _factory uniswap factory
     */
    constructor(
        address _crab,
        address _powerTokenController,
        address _factory,
        address _euler,
        address _eulerMarketsModule
    )
        ERC20("Bull Vault", "BullVault")
        UniBull(_factory)
        LeverageBull(_euler, _eulerMarketsModule, _powerTokenController)
    {
        crab = _crab;
        powerTokenController = _powerTokenController;
        wPowerPerp = IController(_powerTokenController).wPowerPerp();
        ethWSqueethPool = IController(_powerTokenController).wPowerPerpPool();
        ethUSDCPool = IController(_powerTokenController).ethQuoteCurrencyPool();
    }

    /**
     * @notice deposit function that handle minting shares and depositing into the leverage component
     * @dev this function assume the _from depositor already have _crabAmount
     * @param _crabAmount amount of crab token
     */
    function deposit(uint256 _crabAmount) external payable {
        IERC20(crab).transferFrom(msg.sender, address(this), _crabAmount);

        uint256 share = ONE;
        uint256 bullToMint = _crabAmount;

        if (totalSupply() == 0) {
            _mint(msg.sender, _crabAmount);
        } else {
            share = _crabAmount.wdiv(IERC20(crab).balanceOf(address(this)));
            uint256 bullTotalSupply = totalSupply();
            bullToMint = share.wmul(bullTotalSupply).wdiv(ONE.sub(bullTotalSupply));
            _mint(msg.sender, bullToMint);
        }

        uint256 ethUsdPrice = _getTwap(ethUSDCPool, weth, usdc, TWAP, false);
        uint256 squeethEthPrice = _getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP, false);
        (uint256 ethInCrab, uint256 squeethInCrab) = _getCrabVaultDetails();
        uint256 crabUsdPrice = (ethInCrab.wmul(ethUsdPrice).sub(squeethInCrab.wmul(squeethEthPrice).wmul(ethUsdPrice)))
            .wdiv(IERC20(crab).totalSupply());

        (, uint256 usdcBorrowed) = _leverageDeposit(bullToMint, share, crabUsdPrice, ethUsdPrice);

        IERC20(usdc).transfer(msg.sender, usdcBorrowed);
    }

    function withdraw() external {}

    function _uniFlashSwap(
        address, /*_caller*/
        address _pool,
        address _tokenIn,
        address, /*_tokenOut*/
        uint24, /*_fee*/
        uint256 _amountToPay,
        bytes memory, /*_callData*/
        uint8 /*_callSource*/
    ) internal override {
        IERC20(_tokenIn).transfer(_pool, _amountToPay);
    }

    function _getCrabVaultDetails() internal view returns (uint256, uint256) {
        VaultLib.Vault memory strategyVault = IController(powerTokenController).vaults(ICrabStrategyV2(crab).vaultId());

        return (strategyVault.collateralAmount, strategyVault.shortAmount);
    }
}
