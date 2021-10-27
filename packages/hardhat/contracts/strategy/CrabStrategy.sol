//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import "hardhat/console.sol";

// interface
import {IController} from "../interfaces/IController.sol";
import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";
import {IOracle} from "../interfaces/IOracle.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

// contract
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {StrategyBase} from "./base/StrategyBase.sol";
import {StrategyFlashSwap} from "./base/StrategyFlashSwap.sol";

// lib
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {StrategyMath} from "./base/StrategyMath.sol";

/**
 * @dev CrabStrategy contract
 * @notice Contract for Crab strategy
 * @author Opyn team
 */
contract CrabStrategy is StrategyBase, StrategyFlashSwap, ReentrancyGuard {
    using StrategyMath for uint256;
    using Address for address payable;

    uint32 public constant TWAP_PERIOD = 600;

    /// @dev enum to differenciate between uniswap swap callback function source
    enum FLASH_SOURCE {
        FLASH_DEPOSIT,
        FLASH_WITHDRAW
    }

    /// @dev ETH:WSqueeth uniswap V3 pool
    address public ethWSqueethPool;
    /// @dev startegy UNI v3 oracle
    address public oracle;

    /// @dev time difference between two hedges
    uint256 public immutable hedgeTimeThreshold;
    /// @dev price deviation to allow hedging
    uint256 public immutable hedgePriceThreshold;
    /// @dev full auction time
    uint256 public immutable auctionTime;
    /// @dev start auction price multiplier for hedge buy auction and reserve price for end sell auction in 18 decimals
    uint256 public immutable minPriceMultiplier;
    /// @dev start auction price multiplier for hedge sell auction and reserve price for hedge buy auction in 18 decimals
    uint256 public immutable maxPriceMultiplier;

    /// @dev timestamp when last hedging executed
    uint256 public timeAtLastHedge;
    /// @dev WSqueeth/Eth price when last hedging executed
    uint256 public priceAtLastHedge;
    uint256 public auctionStartTime;

    bool public isAuctionRunning;

    event Deposit(address indexed depositor, uint256 wSqueethAmount, uint256 lpAmount);
    event Withdraw(address indexed withdrawer, uint256 crabAmount, uint256 wSqueethAmount, uint256 ethWithdrawn);
    event FlashDeposit(
        address indexed depositor,
        uint256 depositedAmount,
        uint256 borrowedAmount,
        uint256 totalDepositedAmount,
        uint256 tradedAmountOut
    );
    event FlashWithdraw(address indexed withdrawer, uint256 crabAmount, uint256 wSqueethAmount);

    /**
     * @notice Strategy base constructor
     * @dev this will open a vault in the power token contract and store vault ID
     * @param _wSqueethController power token controller address
     * @param _oracle oracle address
     * @param _weth weth address
     * @param _uniswapFactory uniswap factory address
     * @param _ethWSqueethPool eth:dai uniswap v3 address
     * @param _hedgeTimeThreshold hedge time threshold
     * @param _hedgePriceThreshold hedge price threshold
     * @param _auctionTime auction full time
     * @param _minPriceMultiplier minimum auction price multiplier
     * @param _maxPriceMultiplier maximum auction price multiplier
     */
    constructor(
        address _wSqueethController,
        address _oracle,
        address _weth,
        address _uniswapFactory,
        address _ethWSqueethPool,
        uint256 _hedgeTimeThreshold,
        uint256 _hedgePriceThreshold,
        uint256 _auctionTime,
        uint256 _minPriceMultiplier,
        uint256 _maxPriceMultiplier
    ) StrategyBase(_wSqueethController, _weth, "Crab Strategy", "Crab") StrategyFlashSwap(_uniswapFactory) {
        require(_oracle != address(0), "invalid oracle address");
        require(_ethWSqueethPool != address(0), "invalid ETH:WSqueeth address");
        require(_hedgeTimeThreshold > 0, "invalid hedge time threshold");
        require(_hedgePriceThreshold > 0, "invalid hedge price threshold");
        require(_auctionTime > 0, "invalid auction time");
        require(_minPriceMultiplier > 0, "invalid auction min price multiplier");
        require(_maxPriceMultiplier > 0, "invalid auction max price multiplier");

        oracle = _oracle;
        ethWSqueethPool = _ethWSqueethPool;
        hedgeTimeThreshold = _hedgeTimeThreshold;
        hedgePriceThreshold = _hedgePriceThreshold;
        auctionTime = _auctionTime;
        minPriceMultiplier = _minPriceMultiplier;
        maxPriceMultiplier = _maxPriceMultiplier;
    }

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable {}

    /**
     * @notice flash deposit
     * @dev this function sell minted WSqueeth for _ethToBorrow
     * @param _ethToDeposit ETH sent from depositor
     * @param _ethToBorrow ETH to flashswap on uni v3
     */
    function flashDeposit(uint256 _ethToDeposit, uint256 _ethToBorrow) external payable {
        require(msg.value > _ethToDeposit, "Need some buffer");

        uint256 wSqueethToMint = _calcWsqueethToMint(
            _ethToDeposit.add(_ethToBorrow),
            _strategyDebt,
            _strategyCollateral
        );

        _exactInFlashSwap(
            wPowerPerp,
            weth,
            IUniswapV3Pool(ethWSqueethPool).fee(),
            wSqueethToMint,
            _ethToDeposit.add(_ethToBorrow).sub(msg.value),
            uint8(FLASH_SOURCE.FLASH_DEPOSIT),
            _ethToDeposit.add(_ethToBorrow)
        );

        emit FlashDeposit(msg.sender, _ethToDeposit, _ethToBorrow, msg.value, wSqueethToMint);
    }

    /**
     * @notice flash withdraw
     * @dev this function will borrow wSqueeth amount and repay for selling some of the ETH collateral
     * @param _crabAmount crab token amount to burn
     */
    function flashWithdraw(uint256 _crabAmount, uint256 _maxEthToPay) external {
        uint256 exactWSqueethNeeded = _strategyDebt.wmul(_crabAmount).wdiv(totalSupply());

        _exactOutFlashSwap(
            weth,
            wPowerPerp,
            IUniswapV3Pool(ethWSqueethPool).fee(),
            exactWSqueethNeeded,
            _maxEthToPay,
            uint8(FLASH_SOURCE.FLASH_WITHDRAW),
            _crabAmount
        );

        emit FlashWithdraw(msg.sender, _crabAmount, exactWSqueethNeeded);
    }

    /**
     * @notice deposit ETH into strategy
     * @dev this function do not use flashswap
     * @return minted debt amount of LP amount
     */
    function deposit() external payable returns (uint256, uint256) {
        uint256 amount = msg.value;

        (uint256 wSqueethToMint, uint256 depositorCrabAmount) = _deposit(msg.sender, amount, false);

        emit Deposit(msg.sender, wSqueethToMint, depositorCrabAmount);

        return (wSqueethToMint, depositorCrabAmount);
    }

    /**
     * @notice withdraw WETH from strategy
     * @dev this function do not use flashswap
     * @param _crabAmount amount of crab token to burn
     * @param _wSqueethAmount amount of wSqueeth to burn
     */
    function withdraw(uint256 _crabAmount, uint256 _wSqueethAmount) external payable {
        uint256 ethToWithdraw = _withdraw(msg.sender, _crabAmount, _wSqueethAmount, false);

        // send back ETH collateral
        payable(msg.sender).sendValue(ethToWithdraw);

        emit Withdraw(msg.sender, _crabAmount, _wSqueethAmount, ethToWithdraw);
    }

    /**
     * @notice strategy hedging based on time threshold
     * @dev need to attach msg.value if buying WSqueeth
     */
    function timeHedge() external payable {
        (bool isTimeHedgeAllowed, uint256 auctionTriggerTime) = _isTimeHedge();

        require(isTimeHedgeAllowed, "Time hedging is not allowed");

        _hedge(auctionTriggerTime);
    }

    /**
     * @notice strategy hedging based on price threshold
     * @dev need to attach msg.value if buying WSqueeth
     * @param _auctionTriggerTime timestamp where auction started
     */
    function priceHedge(uint256 _auctionTriggerTime) external payable {
        require(_isPriceHedge(_auctionTriggerTime), "Price hedging not allowed");

        _hedge(_auctionTriggerTime);
    }

    /**
     * @notice check if hedging based on price threshold is allowed
     * @param _auctionTriggerTime timestamp where auction started
     * @return true if hedging is allowed
     */
    function checkPriceHedge(uint256 _auctionTriggerTime) external view returns (bool) {
        return _isPriceHedge(_auctionTriggerTime);
    }

    /**
     * @notice check if hedging based on time threshold is allowed
     * @return true if hedging is allowed, and auction trigger timestamp
     */
    function checkTimeHedge() external view returns (bool, uint256) {
        (bool isTimeHedgeAllowed, uint256 auctionTriggerTime) = _isTimeHedge();

        return (isTimeHedgeAllowed, auctionTriggerTime);
    }

    /**
     * @notice get wSqueeth debt amount from crab token amount
     * @notice _crabAmount strategy token amount
     * @return wSqueeth amount
     */
    function getWsqueethFromCrabAmount(uint256 _crabAmount) external view returns (uint256) {
        return _getDebtFromStrategyAmount(_crabAmount);
    }

    /**
     * @notice startegy uniswap flash swap
     * @dev this function will be called by flashswap callback function uniswapV3SwapCallback()
     * @param _tokenIn token IN address
     * @param _tokenOut token OUT address
     * @param _fee uniswap pool fee
     * @param _amountToPay amount to pay back for flashswap
     */
    function _strategyFlash(
        address _caller,
        address _tokenIn,
        address _tokenOut,
        uint24 _fee,
        uint256 _amountToPay,
        uint256 _callAmount,
        uint8 _callSource
    ) internal override {
        if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_DEPOSIT) {
            // convert WETH to ETH as Uniswap use WETH
            IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));

            _deposit(_caller, _callAmount, true);

            IWPowerPerp(wPowerPerp).transfer(ethWSqueethPool, _amountToPay);

            if (address(this).balance > 0) {
                payable(_caller).sendValue(address(this).balance);
            }
        }
        if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_WITHDRAW) {
            uint256 ethToWithdraw = _withdraw(
                _caller,
                _callAmount,
                IWPowerPerp(wPowerPerp).balanceOf(address(this)),
                true
            );

            IWETH9(weth).deposit{value: _amountToPay}();
            IWETH9(weth).transfer(ethWSqueethPool, _amountToPay);

            uint256 proceeds = ethToWithdraw.sub(_amountToPay);
            if (proceeds > 0) {
                payable(_caller).sendValue(proceeds);
            }
        }
    }

    /**
     * @dev deposit into strategy
     * @param _amount amount of ETH collateral to deposit
     * @param _isFlashDeposit true if this function is called by flash deposit
     * @return minted amount of WSqueeth and minted CRAB token amount
     */
    function _deposit(
        address _depositor,
        uint256 _amount,
        bool _isFlashDeposit
    ) internal returns (uint256, uint256) {
        // load vars for gas optimization
        uint256 strategyCollateral = _strategyCollateral;

        uint256 wSqueethToMint = _calcWsqueethToMint(_amount, _strategyDebt, strategyCollateral);
        uint256 depositorCrabAmount = _calcSharesToMint(_amount, strategyCollateral, totalSupply());

        // mint wSqueeth and send it to msg.sender
        _mintWPowerPerp(_depositor, wSqueethToMint, _amount, _isFlashDeposit);
        // mint LP to depositor
        _mintStrategyToken(_depositor, depositorCrabAmount);

        return (wSqueethToMint, depositorCrabAmount);
    }

    /**
     * @notice withdraw WETH from strategy
     * @dev this function do not use flashswap
     * @param _crabAmount amount of crab token to burn
     * @param _wSqueethAmount amount of wSqueeth to burn
     * @return ETH amount to withdraw
     */
    function _withdraw(
        address _from,
        uint256 _crabAmount,
        uint256 _wSqueethAmount,
        bool _isFlashWithdraw
    ) internal returns (uint256) {
        uint256 strategyShare = _calcCrabRatio(_crabAmount, totalSupply());
        uint256 ethToWithdraw = _calcEthToWithdraw(strategyShare, _strategyCollateral);

        require(_wSqueethAmount.wdiv(_strategyDebt) == strategyShare, "invalid ratio");

        _burnWPowerPerp(_from, _wSqueethAmount, ethToWithdraw, _isFlashWithdraw);
        _burn(_from, _crabAmount);

        return ethToWithdraw;
    }

    /**
     * @notice hedging function to achieve delta neutral strategy
     * @param _auctionTriggerTime timestamp where auction started
     */
    function _hedge(uint256 _auctionTriggerTime) internal {
        uint256 ethDelta = _strategyCollateral;
        uint256 currentWSqueethPrice = IOracle(oracle).getTwapSafe(ethWSqueethPool, wPowerPerp, weth, TWAP_PERIOD);
        uint256 wSqueethDelta = _strategyDebt.wmul(2e18).wmul(currentWSqueethPrice);
        (uint256 wSqueethTargetHedge, bool isSellingWSqueethAuction) = _getTargetHedgeAndAuctionType(
            wSqueethDelta,
            ethDelta,
            currentWSqueethPrice
        );

        require(wSqueethTargetHedge != 0, "strategy is delta neutral");

        uint256 priceMultiplier;
        uint256 auctionWSqueethEthPrice;
        uint256 auctionExecution = block.timestamp.sub(_auctionTriggerTime) >= auctionTime
            ? 1e18
            : (block.timestamp.sub(_auctionTriggerTime)).wdiv(auctionTime);

        if (isSellingWSqueethAuction) {
            priceMultiplier = maxPriceMultiplier.sub(auctionExecution.wmul(maxPriceMultiplier.sub(minPriceMultiplier)));
        } else {
            priceMultiplier = minPriceMultiplier.add(auctionExecution.wmul(maxPriceMultiplier.sub(minPriceMultiplier)));
        }

        auctionWSqueethEthPrice = currentWSqueethPrice.wmul(priceMultiplier);
        wSqueethDelta = _strategyDebt.mul(2).wmul(auctionWSqueethEthPrice);
        (uint256 auctionWSqueethTargetHedge, bool isStillSellingWSqueethAuction) = _getTargetHedgeAndAuctionType(
            wSqueethDelta,
            ethDelta,
            auctionWSqueethEthPrice
        );

        require(
            isSellingWSqueethAuction == isStillSellingWSqueethAuction,
            "can not execute hedging trade as auction type changed"
        );

        uint256 ethProceeds = auctionWSqueethTargetHedge.wmul(auctionWSqueethEthPrice);

        if (isSellingWSqueethAuction) {
            // Receiving ETH and paying wSqueeth
            require(msg.value >= ethProceeds, "Low ETH amount received");

            _mintWPowerPerp(msg.sender, auctionWSqueethTargetHedge, ethProceeds, false);

            uint256 remainingEth = uint256(msg.value).sub(ethProceeds);

            if (remainingEth > 0) {
                payable(msg.sender).sendValue(remainingEth);
            }
        } else {
            // Receiving wSqueeth and paying ETH
            _burnWPowerPerp(msg.sender, auctionWSqueethTargetHedge, ethProceeds, false);
            payable(msg.sender).sendValue(ethProceeds);
        }

        timeAtLastHedge = block.timestamp;
        priceAtLastHedge = currentWSqueethPrice;
    }

    /**
     * @dev calculate amount of debt to mint
     * @param _depositedAmount amount of deposited WETH
     * @param _strategyDebtAmount amount of strategy debt
     * @param _strategyCollateralAmount collateral amount in strategy
     * @return amount of minted wSqueeth
     */
    function _calcWsqueethToMint(
        uint256 _depositedAmount,
        uint256 _strategyDebtAmount,
        uint256 _strategyCollateralAmount
    ) internal returns (uint256) {
        uint256 wSqueethToMint;

        if (_strategyDebtAmount == 0) {
            uint256 wSqueethEthPrice = IOracle(oracle).getTwapSafe(ethWSqueethPool, wPowerPerp, weth, TWAP_PERIOD);
            uint256 squeethDelta = wSqueethEthPrice.wmul(2e18);
            wSqueethToMint = _depositedAmount.wdiv(squeethDelta);

            // store hedge data as strategy is delta neutral at this point
            timeAtLastHedge = block.timestamp;
            priceAtLastHedge = wSqueethEthPrice;
        } else {
            wSqueethToMint = _depositedAmount.wmul(_strategyDebtAmount).wdiv(_strategyCollateralAmount);
        }

        return wSqueethToMint;
    }

    function _isTimeHedge() internal view returns (bool, uint256) {
        uint256 auctionTriggerTime = timeAtLastHedge.add(hedgeTimeThreshold);

        return (block.timestamp >= auctionTriggerTime, auctionTriggerTime);
    }

    function _isPriceHedge(uint256 _auctionTriggerTime) internal view returns (bool) {
        uint32 secondsToPriceHedgeTrigger = uint32(block.timestamp.sub(_auctionTriggerTime));
        uint256 wSqueethEthPriceAtTriggerTime = IOracle(oracle).getHistoricalTwap(
            ethWSqueethPool,
            wPowerPerp,
            weth,
            secondsToPriceHedgeTrigger + TWAP_PERIOD,
            secondsToPriceHedgeTrigger
        );
        uint256 cachedRatio = wSqueethEthPriceAtTriggerTime.wdiv(priceAtLastHedge);
        uint256 priceTolerance = cachedRatio > 1e18 ? (cachedRatio).sub(1e18) : uint256(1e18).sub(cachedRatio);

        return priceTolerance >= hedgePriceThreshold;
    }

    /**
     * @dev calculate amount of LP to mint for depositor
     * @param _amount amount of WETH deposited
     * @param _strategyCollateralAmount amount of strategy collateral
     * @param _crabTotalSupply amount of crab token total supply
     * @return amount of new minted LP token
     */
    function _calcSharesToMint(
        uint256 _amount,
        uint256 _strategyCollateralAmount,
        uint256 _crabTotalSupply
    ) internal pure returns (uint256) {
        uint256 depositorShare = _amount.wdiv(_strategyCollateralAmount.add(_amount));

        uint256 depositorCrabAmount;
        if (_crabTotalSupply != 0) {
            depositorCrabAmount = (_crabTotalSupply.wmul(depositorShare)).wdiv(uint256(1e18).sub(depositorShare));
        } else {
            depositorCrabAmount = _amount;
        }

        return depositorCrabAmount;
    }

    /**
     * @notice calc crab ratio
     * @param _crabAmount crab token amount
     * @param _totalSupply crab total supply
     * @return ratio
     */
    function _calcCrabRatio(uint256 _crabAmount, uint256 _totalSupply) internal pure returns (uint256) {
        return _crabAmount.wdiv(_totalSupply);
    }

    /**
     * @notice calc ETH to withdraw from strategy
     * @param _crabRatio crab ratio
     * @param _strategyCollateralAmount amount of collateral in strategy
     * @return amount of ETH allowed to withdraw
     */
    function _calcEthToWithdraw(uint256 _crabRatio, uint256 _strategyCollateralAmount) internal pure returns (uint256) {
        return _strategyCollateralAmount.wmul(_crabRatio);
    }

    /**
     * @notice Get target hedge and auction type (selling/buying auction)
     * @param _wSqueethDelta WSqueeth delta
     * @param _ethDelta ETH delta
     * @param _wSqueethEthPrice WSqueeth/ETH price
     * @return target hedge value and auction type. Target hedge is the amount of WSqueeth the auction need to sell or buy to reach delta neutral strategy, depend on auction type (true if auction is selling WSqueeth, false for buying WSqueeth)
     */
    function _getTargetHedgeAndAuctionType(
        uint256 _wSqueethDelta,
        uint256 _ethDelta,
        uint256 _wSqueethEthPrice
    ) internal pure returns (uint256, bool) {
        return
            (_wSqueethDelta > _ethDelta)
                ? ((_wSqueethDelta.sub(_ethDelta)).wdiv(_wSqueethEthPrice), false)
                : ((_ethDelta.sub(_wSqueethDelta)).wdiv(_wSqueethEthPrice), true);
    }
}
