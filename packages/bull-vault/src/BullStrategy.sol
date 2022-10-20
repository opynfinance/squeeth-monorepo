// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;

// contract
import {ERC20} from "openzeppelin/token/ERC20/ERC20.sol";
import {LeverageBull} from "./LeverageBull.sol";
import {UniBull} from "./UniBull.sol";
// lib
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only

/**
 * @notice BullStrategy contract
 * @dev this is an abstracted BullStrategy in term of deposit and withdraw functionalities
 * @author opyn team
 */
contract BullStrategy is ERC20, LeverageBull, UniBull {
    using StrategyMath for uint256;

    uint256 private constant ONE = 1e18;

    /// @dev Crab contract address
    address public immutable crab;
    
    /// @dev the cap in ETH for the strategy, above which deposits will be rejected
    uint256 public strategyCap;

    /// @dev true if Bull was initialized
    bool public isInitialized;

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

    /// @dev set to true when redeemShortShutdown has been called
    bool private hasRedeemedInShutdown;

    /// @dev ETH:wSqueeth Uniswap pool
    address public immutable ethWSqueethPool;

    /// @dev ETH:USDC Uniswap pool
    address public immutable ethUSDCPool;

    /**
     * @notice constructor for BullStrategy
     * @dev this will open a vault in the power token contract and store the vault ID
     * @param _crab crab address
     * @param _name token name for strategy ERC20 token
     * @param _symbol token symbol for strategy ERC20 token
     */
    constructor(address _crab, address _factory, string memory _name, string memory _symbol)
        ERC20(_name, _symbol)
        UniBull(_factory)
    {
        crab = _crab;
    }

    /**
     * @notice deposit function that handle minting shares and depositing into the leverage component
     * @dev this function assume the _from depositor already have _crabAmount
     * @param _from depositor address
     * @param _crabAmount amount of crab token
     */
    function deposit(address _from, uint256 _crabAmount) external payable {
        ERC20(crab).transferFrom(_from, address(this), _crabAmount);

        uint256 share = ONE;
        uint256 bullToMint = _crabAmount;

        if (totalSupply() == 0) {
            _mint(_from, _crabAmount);
        } else {
            share = _crabAmount.wdiv(ERC20(crab).balanceOf(address(this)));
            uint256 bullTotalSupply = totalSupply();
            bullToMint = share.wmul(bullTotalSupply).wdiv(ONE.sub(bullTotalSupply));
            _mint(_from, bullToMint);
        }

        // TODO: get prices
        uint256 crabUsdPrice = 0;
        uint256 ethUsdPrice = 0;

        _leverageDeposit(bullToMint, share, crabUsdPrice, ethUsdPrice);

        // TODO: sell USDC for ETH
    }

    function withdraw() external {}
}
