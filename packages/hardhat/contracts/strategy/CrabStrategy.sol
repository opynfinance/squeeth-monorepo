//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

// interface
import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";
import {IOracle} from "../interfaces/IOracle.sol";

// contract
import {StrategyBase} from "./base/StrategyBase.sol";

// lib
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/**
 * @dev CrabStrategy contract
 * @notice Contract for Crab strategy
 * @author Opyn team
 */
contract CrabStrategy is StrategyBase {
    using SafeMath for uint256;
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

    /// TODO: implement flashswap in diff PR
    function flashDeposit(uint256 _amount) external returns (uint256, uint256) {
        weth.transferFrom(msg.sender, address(this), _amount);

        // load vars for gas optimization
        uint256 strategyCollateral = _ethCollateral;
        uint256 strategyDebt = _wSqueethDebt;

        uint256 wSqueethToMint = calcWsqueethToMint(_amount, strategyDebt, strategyCollateral);
        uint256 depositorStrategyShare = calcSharesToMint(_amount, strategyCollateral, totalSupply());

        // update strategy state
        _ethCollateral = strategyCollateral.add(_amount);
        _wSqueethDebt = strategyDebt.add(wSqueethToMint);

        // mint wSqueeth
        _mintWsqueeth(msg.sender, wSqueethToMint, true);
        // mint LP to depositor
        _mint(msg.sender, depositorStrategyShare);

        emit Deposit(msg.sender, wSqueethToMint, depositorStrategyShare);

        return (wSqueethToMint, depositorStrategyShare);
    }

    /**
     * @notice deposit WETH into strategy
     * @dev this function do not use flashswap
     * @param _amount WETH amount
     * @return minted debt amount of LP amount
     */
    function deposit(uint256 _amount) external returns (uint256, uint256) {
        weth.transferFrom(msg.sender, address(this), _amount);

        // load vars for gas optimization
        uint256 strategyCollateral = _ethCollateral;
        uint256 strategyDebt = _wSqueethDebt;

        uint256 wSqueethToMint = calcWsqueethToMint(_amount, strategyDebt, strategyCollateral);
        uint256 depositorStrategyShare = calcSharesToMint(_amount, strategyCollateral, totalSupply());

        // update strategy state
        _ethCollateral = strategyCollateral.add(_amount);
        _wSqueethDebt = strategyDebt.add(wSqueethToMint);

        // mint wSqueeth and send it to msg.sender
        _mintWsqueeth(msg.sender, wSqueethToMint, false);
        // mint LP to depositor
        _mint(msg.sender, depositorStrategyShare);

        emit Deposit(msg.sender, wSqueethToMint, depositorStrategyShare);

        return (wSqueethToMint, depositorStrategyShare);
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
     * @notice mint wSqueeth
     * @dev this function will keep minted wSqueeth in this contract if _keepWsqueeth == true
     * @param _receiver receiver address
     * @param _amount amount of wSqueeth to mint
     * @param _keepWsqueeth keep minted wSqueeth in this contract if it is set to true
     */
    function _mintWsqueeth(
        address _receiver,
        uint256 _amount,
        bool _keepWsqueeth
    ) internal {
        (, uint256 mintedWsqueeth) = powerTokenController.mint(_vaultId, uint128(_amount), 0);

        if (!_keepWsqueeth) {
            IWPowerPerp wSqueeth = IWPowerPerp(powerTokenController.wPowerPerp());
            wSqueeth.transfer(_receiver, mintedWsqueeth);
        }
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
            wSqueethToMint = _depositedAmount.mul(1e18).div(squeethDelta);
        } else {
            wSqueethToMint = _depositedAmount.mul(_strategyDebt).div(_strategyCollateral);
        }

        return wSqueethToMint;
    }

    /**
     * @dev calculate amount of LP to mint for depositor
     * @param _amount amount of WETH deposited
     * @param _strategyCollateral amount of strategy collateral
     * @param _totalLp amount of LP supply
     * @return amount of new minted LP token
     */
    function calcSharesToMint(
        uint256 _amount,
        uint256 _strategyCollateral,
        uint256 _totalLp
    ) internal pure returns (uint256) {
        uint256 depositorShare = _amount.mul(1e18).div(_strategyCollateral.add(_amount));

        uint256 depositorStrategyShare;
        if (_totalLp != 0) {
            depositorStrategyShare = (_totalLp.mul(depositorShare)).div(uint256(1e18).sub(depositorShare));
        } else {
            depositorStrategyShare = _amount;
        }

        return depositorStrategyShare;
    }
}
