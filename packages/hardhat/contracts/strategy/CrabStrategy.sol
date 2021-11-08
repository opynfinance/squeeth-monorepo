//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

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

    /// @dev enum to differentiate between uniswap swap callback function source
    enum FLASH_SOURCE {
        FLASH_DEPOSIT,
        FLASH_WITHDRAW,
        FLASH_HEDGE_SELL,
        FLASH_HEDGE_BUY
    }

    /// @dev ETH:WSqueeth uniswap pool
    address public ethWSqueethPool;
    /// @dev strategy uniswap oracle
    address public oracle;

    /// @dev time difference to trigger a hedge (seconds)
    uint256 public immutable hedgeTimeThreshold;
    /// @dev price movement to trigger a hedge (0.1*1e18 = 10%)
    uint256 public immutable hedgePriceThreshold;
    /// @dev hedge auction duration (seconds)
    uint256 public immutable auctionTime;
    /// @dev start auction price multiplier for hedge buy auction and reserve price for end sell auction (scaled 1e18)
    uint256 public immutable minPriceMultiplier;
    /// @dev start auction price multiplier for hedge sell auction and reserve price for hedge buy auction (scaled 1e18)
    uint256 public immutable maxPriceMultiplier;

    /// @dev timestamp when last hedge executed
    uint256 public timeAtLastHedge;
    /// @dev WSqueeth/Eth price when last hedge executed
    uint256 public priceAtLastHedge;
    uint256 public auctionStartTime;

    struct FlashDepositData {
        uint256 totalDeposit;
    }

    struct FlashWithdrawData {
        uint256 crabAmount;
    }

    struct FlashHedgeData {
        uint256 wSqueethAmount;
        uint256 ethProceeds;
        uint256 minWSqueeth;
        uint256 minEth;
    }

    event Deposit(address indexed depositor, uint256 wSqueethAmount, uint256 lpAmount);
    event Withdraw(address indexed withdrawer, uint256 crabAmount, uint256 wSqueethAmount, uint256 ethWithdrawn);
    event FlashDeposit(address indexed depositor, uint256 depositedAmount, uint256 tradedAmountOut);
    event FlashWithdraw(address indexed withdrawer, uint256 crabAmount, uint256 wSqueethAmount);
    event TimeHedgeOnUniswap(
        address indexed hedger,
        uint256 hedgeTimestamp,
        uint256 auctionTriggerTimestamp,
        uint256 minWSqueeth,
        uint256 minEth
    );
    event PriceHedgeOnUniswap(
        address indexed hedger,
        uint256 hedgeTimestamp,
        uint256 auctionTriggerTimestamp,
        uint256 minWSqueeth,
        uint256 minEth
    );
    event TimeHedge(address indexed hedger, bool auctionType, uint256 hedgerPrice, uint256 auctionTriggerTimestamp);
    event PriceHedge(address indexed hedger, bool auctionType, uint256 hedgerPrice, uint256 auctionTriggerTimestamp);
    event Hedge(
        address indexed hedger,
        bool auctionType,
        uint256 hedgerPrice,
        uint256 auctionPrice,
        uint256 wSqueethHedgeTargetAmount,
        uint256 ethHedgetargetAmount
    );
    event HedgeOnUniswap(
        address indexed hedger,
        bool auctionType,
        uint256 auctionPrice,
        uint256 wSqueethHedgeTargetAmount,
        uint256 ethHedgetargetAmount
    );
    event ExecuteSellAuction(address indexed buyer, uint256 wSqueethSold, uint256 ethBought, bool isHedgingOnUniswap);
    event ExecuteBuyAuction(address indexed seller, uint256 wSqueethBought, uint256 ethSold, bool isHedgingOnUniswap);

    /**
     * @notice strategy constructor
     * @dev this will open a vault in the power token contract and store the vault ID
     * @param _wSqueethController power token controller address
     * @param _oracle oracle address
     * @param _weth weth address
     * @param _uniswapFactory uniswap factory address
     * @param _ethWSqueethPool eth:wSqueeth uniswap pool address
     * @param _hedgeTimeThreshold hedge time threshold (seconds)
     * @param _hedgePriceThreshold hedge price threshold (0.1*1e18 = 10%)
     * @param _auctionTime auction duration (seconds)
     * @param _minPriceMultiplier minimum auction price multiplier (0.9*1e18 = min auction price is 90% of twap)
     * @param _maxPriceMultiplier maximum auction price multiplier (1.1*1e18 = max auction price is 110% of twap)
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
        require(_minPriceMultiplier < 1e18, "auction min price multiplier too high");
        require(_minPriceMultiplier > 0, "invalid auction min price multiplier");
        require(_maxPriceMultiplier > 1e18, "auction max price multiplier too low");

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
    receive() external payable {
        require(msg.sender == weth || msg.sender == address(powerTokenController), "Cannot receive eth");
    }

    /**
     * @notice flash deposit into strategy
     * @dev this function sells minted WSqueeth
     * @param _ethToDeposit ETH sent from depositor
     */
    function flashDeposit(uint256 _ethToDeposit) external payable nonReentrant {
        (uint256 cachedStrategyDebt, ) = _syncStrategyState();

        (uint256 wSqueethToMint, uint256 wSqueethEthPrice) = _calcWsqueethToMint(
            _ethToDeposit,
            cachedStrategyDebt,
            _strategyCollateral
        );

        if (cachedStrategyDebt == 0) {
            // store hedge data as strategy is delta neutral at this point
            timeAtLastHedge = block.timestamp;
            priceAtLastHedge = wSqueethEthPrice;
        }

        _exactInFlashSwap(
            wPowerPerp,
            weth,
            IUniswapV3Pool(ethWSqueethPool).fee(),
            wSqueethToMint,
            _ethToDeposit.sub(msg.value),
            uint8(FLASH_SOURCE.FLASH_DEPOSIT),
            abi.encodePacked(_ethToDeposit)
        );

        emit FlashDeposit(msg.sender, _ethToDeposit, wSqueethToMint);
    }

    /**
     * @notice flash withdraw from strategy
     * @dev this function will borrow wSqueeth amount and repay for selling some of the ETH collateral
     * @param _crabAmount crab token amount to burn
     * @param _maxEthToPay maximum ETH to pay
     */
    function flashWithdraw(uint256 _crabAmount, uint256 _maxEthToPay) external nonReentrant {
        (uint256 strategyDebt, ) = _syncStrategyState();

        uint256 exactWSqueethNeeded = strategyDebt.wmul(_crabAmount).wdiv(totalSupply());

        _exactOutFlashSwap(
            weth,
            wPowerPerp,
            IUniswapV3Pool(ethWSqueethPool).fee(),
            exactWSqueethNeeded,
            _maxEthToPay,
            uint8(FLASH_SOURCE.FLASH_WITHDRAW),
            abi.encodePacked(_crabAmount)
        );

        emit FlashWithdraw(msg.sender, _crabAmount, exactWSqueethNeeded);
    }

    /**
     * @notice deposit ETH into strategy
     * @dev provide eth, return wSqueeth and strategy token
     * @return wSqueethToMint minted amount of wSqueeth
     * @return depositorCrabAmount minted amount of strategy token
     */
    function deposit() external payable nonReentrant returns (uint256, uint256) {
        uint256 amount = msg.value;

        (uint256 wSqueethToMint, uint256 depositorCrabAmount) = _deposit(msg.sender, amount, false);

        emit Deposit(msg.sender, wSqueethToMint, depositorCrabAmount);

        return (wSqueethToMint, depositorCrabAmount);
    }

    /**
     * @notice withdraw WETH from strategy
     * @dev provide strategy tokens and wSqueeth, returns eth
     * @param _crabAmount amount of crab token to burn
     * @param _wSqueethAmount amount of wSqueeth to burn
     */
    function withdraw(uint256 _crabAmount, uint256 _wSqueethAmount) external payable nonReentrant {
        uint256 ethToWithdraw = _withdraw(msg.sender, _crabAmount, _wSqueethAmount, false);

        // send back ETH collateral
        payable(msg.sender).sendValue(ethToWithdraw);

        emit Withdraw(msg.sender, _crabAmount, _wSqueethAmount, ethToWithdraw);
    }

    /**
     * @notice hedge startegy based on time threshold with uniswap arbing
     * @param _minWSqueeth minimum WSqueeth amount of profit if hedge auction is selling WSqueeth
     * @param _minEth minimum ETH amount of profit if hedge auction is buying WSqueeth
     */
    function timeHedgeOnUniswap(uint256 _minWSqueeth, uint256 _minEth) external {
        uint256 auctionTriggerTime = timeAtLastHedge.add(hedgeTimeThreshold);

        require(block.timestamp >= auctionTriggerTime, "Time hedging is not allowed");

        _hedgeOnUniswap(auctionTriggerTime, _minWSqueeth, _minEth);

        emit TimeHedgeOnUniswap(msg.sender, block.timestamp, auctionTriggerTime, _minWSqueeth, _minEth);
    }

    /**
     * @notice hedge startegy based on price threshold with uniswap arbing
     */
    function priceHedgeOnUniswap(
        uint256 _auctionTriggerTime,
        uint256 _minWSqueeth,
        uint256 _minEth
    ) external payable {
        require(_isPriceHedge(_auctionTriggerTime), "Price hedging not allowed");

        _hedgeOnUniswap(_auctionTriggerTime, _minWSqueeth, _minEth);

        emit PriceHedgeOnUniswap(msg.sender, block.timestamp, _auctionTriggerTime, _minWSqueeth, _minEth);
    }

    /**
     * @notice strategy hedging based on time threshold
     * @dev need to attach msg.value if buying WSqueeth
     * @param _isStrategySellingWSqueeth sell or buy auction, true for sell auction
     * @param _limitPrice hedger limit auction price, should be the max price when auction is sell auction, min price when it is a buy auction
     */
    function timeHedge(bool _isStrategySellingWSqueeth, uint256 _limitPrice) external payable nonReentrant {
        (bool isTimeHedgeAllowed, uint256 auctionTriggerTime) = _isTimeHedge();

        require(isTimeHedgeAllowed, "Time hedging is not allowed");

        _hedge(auctionTriggerTime, _isStrategySellingWSqueeth, _limitPrice);

        emit TimeHedge(msg.sender, _isStrategySellingWSqueeth, _limitPrice, auctionTriggerTime);
    }

    /**
     * @notice strategy hedging based on price threshold
     * @dev need to attach msg.value if buying WSqueeth
     * @param _auctionTriggerTime timestamp where auction started
     */
    function priceHedge(
        uint256 _auctionTriggerTime,
        bool _isStrategySellingWSqueeth,
        uint256 _limitPrice
    ) external payable nonReentrant {
        require(_isPriceHedge(_auctionTriggerTime), "Price hedging not allowed");

        _hedge(_auctionTriggerTime, _isStrategySellingWSqueeth, _limitPrice);

        emit PriceHedge(msg.sender, _isStrategySellingWSqueeth, _limitPrice, _auctionTriggerTime);
    }

    /**
     * @notice check if hedging based on price threshold is allowed
     * @param _auctionTriggerTime alleged timestamp where auction was triggered
     * @return true if hedging is allowed
     */
    function checkPriceHedge(uint256 _auctionTriggerTime) external view returns (bool) {
        return _isPriceHedge(_auctionTriggerTime);
    }

    /**
     * @notice check if hedging based on time threshold is allowed
     * @return isTimeHedgeAllowed true if hedging is allowed
     * @return auctionTriggertime auction trigger timestamp
     */
    function checkTimeHedge() external view returns (bool, uint256) {
        (bool isTimeHedgeAllowed, uint256 auctionTriggerTime) = _isTimeHedge();

        return (isTimeHedgeAllowed, auctionTriggerTime);
    }

    /**
     * @notice get wSqueeth debt amount associated with crab token amount
     * @dev _crabAmount strategy token amount
     * @return wSqueeth amount
     */
    function getWsqueethFromCrabAmount(uint256 _crabAmount) external view returns (uint256) {
        return _getDebtFromStrategyAmount(_crabAmount);
    }

    /**
     * @notice uniswap flash swap callback function
     * @dev this function will be called by flashswap callback function uniswapV3SwapCallback()
     * @param _caller address of original function caller
     * @param _amountToPay amount to pay back for flashswap
     * @param _callData arbitrary data attached to callback
     * @param _callSource identifier for which function triggered callback
     */
    function _strategyFlash(
        address _caller,
        address, /*_tokenIn*/
        address, /*_tokenOut*/
        uint24, /*_fee*/
        uint256 _amountToPay,
        bytes memory _callData,
        uint8 _callSource
    ) internal override {
        if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_DEPOSIT) {
            FlashDepositData memory data = abi.decode(_callData, (FlashDepositData));

            // convert WETH to ETH as Uniswap use WETH
            IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));

            _deposit(_caller, data.totalDeposit, true);

            IWPowerPerp(wPowerPerp).transfer(ethWSqueethPool, _amountToPay);

            if (address(this).balance > 0) {
                payable(_caller).sendValue(address(this).balance);
            }
        }
        if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_WITHDRAW) {
            FlashWithdrawData memory data = abi.decode(_callData, (FlashWithdrawData));
            uint256 ethToWithdraw = _withdraw(
                _caller,
                data.crabAmount,
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
        if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_HEDGE_SELL) {
            FlashHedgeData memory data = abi.decode(_callData, (FlashHedgeData));
            IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));
            _executeSellAuction(_caller, data.ethProceeds, data.wSqueethAmount, data.ethProceeds, true);

            uint256 wSqueethProfit = data.wSqueethAmount.sub(_amountToPay);
            require(wSqueethProfit >= data.minWSqueeth, "profit is less than min wSqueeth");

            IWPowerPerp(wPowerPerp).transfer(ethWSqueethPool, _amountToPay);
            IWPowerPerp(wPowerPerp).transfer(_caller, wSqueethProfit);
        }
        if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_HEDGE_BUY) {
            FlashHedgeData memory data = abi.decode(_callData, (FlashHedgeData));
            _executeBuyAuction(_caller, data.wSqueethAmount, data.ethProceeds, true);

            uint256 ethProfit = data.ethProceeds.sub(_amountToPay);

            require(ethProfit >= data.minEth, "profit is less than min ETH");

            IWETH9(weth).deposit{value: _amountToPay}();
            IWETH9(weth).transfer(ethWSqueethPool, _amountToPay);
            payable(_caller).sendValue(ethProfit);
        }
    }

    /**
     * @notice deposit into strategy
     * @dev if _isFlashDeposit is true, keeps wSqueeth in contract, otherwise sends to user
     * @param _depositor depositor address
     * @param _amount amount of ETH collateral to deposit
     * @param _isFlashDeposit true if called by flashDeposit
     * @return wSqueethToMint minted amount of WSqueeth
     * @return depositorCrabAmount minted CRAB strategy token amount
     */
    function _deposit(
        address _depositor,
        uint256 _amount,
        bool _isFlashDeposit
    ) internal returns (uint256, uint256) {
        (uint256 strategyDebt, uint256 strategyCollateral) = _syncStrategyState();

        (uint256 wSqueethToMint, uint256 wSqueethEthPrice) = _calcWsqueethToMint(
            _amount,
            strategyDebt,
            strategyCollateral
        );
        uint256 depositorCrabAmount = _calcSharesToMint(_amount, strategyCollateral, totalSupply());

        if (strategyDebt == 0) {
            // store hedge data as strategy is delta neutral at this point
            timeAtLastHedge = block.timestamp;
            priceAtLastHedge = wSqueethEthPrice;
        }

        // mint wSqueeth and send it to msg.sender
        _mintWPowerPerp(_depositor, wSqueethToMint, _amount, _isFlashDeposit);
        // mint LP to depositor
        _mintStrategyToken(_depositor, depositorCrabAmount);

        return (wSqueethToMint, depositorCrabAmount);
    }

    /**
     * @notice withdraw WETH from strategy
     * @dev if _isFlashDeposit is true, keeps wSqueeth in contract, otherwise sends to user
     * @param _crabAmount amount of crab token to burn
     * @param _wSqueethAmount amount of wSqueeth to burn
     * @param _isFlashWithdraw flag if called by flashWithdraw
     * @return ETH amount to withdraw
     */
    function _withdraw(
        address _from,
        uint256 _crabAmount,
        uint256 _wSqueethAmount,
        bool _isFlashWithdraw
    ) internal returns (uint256) {
        (uint256 strategyDebt, uint256 strategyCollateral) = _syncStrategyState();

        uint256 strategyShare = _calcCrabRatio(_crabAmount, totalSupply());
        uint256 ethToWithdraw = _calcEthToWithdraw(strategyShare, strategyCollateral);

        require(_wSqueethAmount.wdiv(strategyDebt) == strategyShare, "invalid ratio");

        _burnWPowerPerp(_from, _wSqueethAmount, ethToWithdraw, _isFlashWithdraw);
        _burn(_from, _crabAmount);

        return ethToWithdraw;
    }

    /**
     * @notice hedging function to adjust collateral and debt to be eth delta neutral
     * @param _auctionTriggerTime timestamp where auction started
     * @param _isStrategySellingWSqueeth auction type, true for sell auction
     * @param _limitPrice hedger accepted auction price, should be the max price when auction is sell auction, min price when it is a buy auction
     */
    function _hedge(
        uint256 _auctionTriggerTime,
        bool _isStrategySellingWSqueeth,
        uint256 _limitPrice
    ) internal {
        (
            bool isSellingAuction,
            uint256 wSqueethToAuction,
            uint256 ethProceeds,
            uint256 auctionWSqueethEthPrice
        ) = _startAuction(_auctionTriggerTime);

        require(_isStrategySellingWSqueeth == isSellingAuction, "wrong auction type");

        if (isSellingAuction) {
            // Receiving ETH and paying wSqueeth
            require(auctionWSqueethEthPrice <= _limitPrice, "Auction price greater than max accepted price");
            require(msg.value >= ethProceeds, "Low ETH amount received");

            _executeSellAuction(msg.sender, msg.value, wSqueethToAuction, ethProceeds, false);
        } else {
            require(msg.value == 0, "ETH attached for buy auction");
            // Receiving wSqueeth and paying ETH
            require(auctionWSqueethEthPrice >= _limitPrice, "Auction price greater than min accepted price");
            _executeBuyAuction(msg.sender, wSqueethToAuction, ethProceeds, false);
        }

        emit Hedge(
            msg.sender,
            _isStrategySellingWSqueeth,
            _limitPrice,
            auctionWSqueethEthPrice,
            wSqueethToAuction,
            ethProceeds
        );
    }

    /**
     * @notice execute arb between auction price and uniswap price
     * @param _auctionTriggerTime auction starting time
     */
    function _hedgeOnUniswap(
        uint256 _auctionTriggerTime,
        uint256 _minWSqueeth,
        uint256 _minEth
    ) internal {
        (
            bool isSellingAuction,
            uint256 wSqueethToAuction,
            uint256 ethProceeds,
            uint256 auctionWSqueethEthPrice
        ) = _startAuction(_auctionTriggerTime);

        if (isSellingAuction) {
            _exactOutFlashSwap(
                wPowerPerp,
                weth,
                IUniswapV3Pool(ethWSqueethPool).fee(),
                ethProceeds,
                wSqueethToAuction,
                uint8(FLASH_SOURCE.FLASH_HEDGE_SELL),
                abi.encodePacked(wSqueethToAuction, ethProceeds, _minWSqueeth, _minEth)
            );
        } else {
            _exactOutFlashSwap(
                weth,
                wPowerPerp,
                IUniswapV3Pool(ethWSqueethPool).fee(),
                wSqueethToAuction,
                ethProceeds,
                uint8(FLASH_SOURCE.FLASH_HEDGE_BUY),
                abi.encodePacked(wSqueethToAuction, ethProceeds, _minWSqueeth, _minEth)
            );
        }

        emit HedgeOnUniswap(msg.sender, isSellingAuction, auctionWSqueethEthPrice, wSqueethToAuction, ethProceeds);
    }

    /**
     * @notice execute sell auction
     * @param _buyer buyer address
     * @param _buyerAmount buyer ETH amount sent
     * @param _wSqueethToSell wSqueeth amount to sell
     * @param _ethToBuy ETH amount to buy
     * @param _isHedgingOnUniswap true if arbing with uniswap price
     */
    function _executeSellAuction(
        address _buyer,
        uint256 _buyerAmount,
        uint256 _wSqueethToSell,
        uint256 _ethToBuy,
        bool _isHedgingOnUniswap
    ) internal {
        if (_isHedgingOnUniswap) {
            _mintWPowerPerp(_buyer, _wSqueethToSell, _ethToBuy, true);
        } else {
            _mintWPowerPerp(_buyer, _wSqueethToSell, _ethToBuy, false);

            uint256 remainingEth = _buyerAmount.sub(_ethToBuy);

            if (remainingEth > 0) {
                payable(_buyer).sendValue(remainingEth);
            }
        }

        emit ExecuteSellAuction(_buyer, _wSqueethToSell, _ethToBuy, _isHedgingOnUniswap);
    }

    /**
     * @notice execute buy auction
     * @param _seller seller address
     * @param _wSqueethToBuy wSqueeth amount to buy
     * @param _ethToSell ETH amount to sell
     * @param _isHedgingOnUniswap true if arbing with uniswap price
     */
    function _executeBuyAuction(
        address _seller,
        uint256 _wSqueethToBuy,
        uint256 _ethToSell,
        bool _isHedgingOnUniswap
    ) internal {
        _burnWPowerPerp(_seller, _wSqueethToBuy, _ethToSell, _isHedgingOnUniswap);

        if (!_isHedgingOnUniswap) {
            payable(_seller).sendValue(_ethToSell);
        }

        emit ExecuteBuyAuction(_seller, _wSqueethToBuy, _ethToSell, _isHedgingOnUniswap);
    }

    /**
     * @notice start auction
     * @param _auctionTriggerTime auction starting time
     * @return auction type, WSqueeth amount to sell or buy, ETH to sell/buy, auction WSqueeth/ETH price
     */
    function _startAuction(uint256 _auctionTriggerTime)
        internal
        returns (
            bool,
            uint256,
            uint256,
            uint256
        )
    {
        (uint256 strategyDebt, uint256 ethDelta) = _syncStrategyState();
        uint256 currentWSqueethPrice = IOracle(oracle).getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP_PERIOD, true);
        (bool isSellingAuction, ) = _checkAuctionType(strategyDebt, ethDelta, currentWSqueethPrice);
        uint256 auctionWSqueethEthPrice = _getAuctionPrice(_auctionTriggerTime, currentWSqueethPrice, isSellingAuction);
        (bool isStillSellingAuction, uint256 wSqueethToAuction) = _checkAuctionType(
            strategyDebt,
            ethDelta,
            auctionWSqueethEthPrice
        );

        require(isSellingAuction == isStillSellingAuction, "can not execute hedging trade as auction type changed");

        uint256 ethProceeds = wSqueethToAuction.wmul(auctionWSqueethEthPrice);

        timeAtLastHedge = block.timestamp;
        priceAtLastHedge = currentWSqueethPrice;

        return (isSellingAuction, wSqueethToAuction, ethProceeds, auctionWSqueethEthPrice);
    }

    /**
     * @notice sync strategy debt and collateral amount
     * @return synced debt and collateral amount
     */
    function _syncStrategyState() internal returns (uint256, uint256) {
        (, , uint256 syncedStrategyCollateral, uint256 syncedStrategyDebt) = _getVaultDetails();
        _strategyDebt = syncedStrategyDebt;
        _strategyCollateral = syncedStrategyCollateral;

        return (syncedStrategyDebt, syncedStrategyCollateral);
    }

    /**
     * @notice calculate amount of wSqueeth to mint from deposited amount
     * @param _depositedAmount amount of deposited WETH
     * @param _strategyDebtAmount amount of strategy debt
     * @param _strategyCollateralAmount collateral amount in strategy
     * @return amount of minted wSqueeth and WSqueeth/ETH price
     */
    function _calcWsqueethToMint(
        uint256 _depositedAmount,
        uint256 _strategyDebtAmount,
        uint256 _strategyCollateralAmount
    ) internal view returns (uint256, uint256) {
        uint256 wSqueethToMint;
        uint256 wSqueethEthPrice;

        if (_strategyDebtAmount == 0) {
            wSqueethEthPrice = IOracle(oracle).getTwap(ethWSqueethPool, wPowerPerp, weth, TWAP_PERIOD, true);
            uint256 squeethDelta = wSqueethEthPrice.wmul(2e18);
            wSqueethToMint = _depositedAmount.wdiv(squeethDelta);
        } else {
            wSqueethToMint = _depositedAmount.wmul(_strategyDebtAmount).wdiv(_strategyCollateralAmount);
        }

        return (wSqueethToMint, wSqueethEthPrice);
    }

    /**
     * @notice check if hedging based on time threshold is allowed
     * @return true if time hedging is allowed, and auction trigger timestamp
     */
    function _isTimeHedge() internal view returns (bool, uint256) {
        uint256 auctionTriggerTime = timeAtLastHedge.add(hedgeTimeThreshold);

        return (block.timestamp >= auctionTriggerTime, auctionTriggerTime);
    }

    /**
     * @notice check if hedging based on price threshold is allowed
     * @return true if hedging is allowed
     */
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
        uint256 priceThreshold = cachedRatio > 1e18 ? (cachedRatio).sub(1e18) : uint256(1e18).sub(cachedRatio);

        return priceThreshold >= hedgePriceThreshold;
    }

    /**
     * @notice Get auction price
     * @param _auctionTriggerTime timestamp where auction started
     * @param _wSqueethEthPrice WSqueeth/ETH price
     * @param _isSellingAuction auction type (true for selling, false for buying auction)
     * @return auction price
     */
    function _getAuctionPrice(
        uint256 _auctionTriggerTime,
        uint256 _wSqueethEthPrice,
        bool _isSellingAuction
    ) internal view returns (uint256) {
        uint256 auctionExecution = block.timestamp.sub(_auctionTriggerTime) >= auctionTime
            ? 1e18
            : (block.timestamp.sub(_auctionTriggerTime)).wdiv(auctionTime);

        uint256 priceMultiplier;
        if (_isSellingAuction) {
            priceMultiplier = maxPriceMultiplier.sub(auctionExecution.wmul(maxPriceMultiplier.sub(minPriceMultiplier)));
        } else {
            priceMultiplier = minPriceMultiplier.add(auctionExecution.wmul(maxPriceMultiplier.sub(minPriceMultiplier)));
        }

        return _wSqueethEthPrice.wmul(priceMultiplier);
    }

    /**
     * @notice Check running auction type
     * @param _debt strategy debt
     * @param _ethDelta ETH delta (= amount of ETH in strategy)
     * @param _wSqueethEthPrice WSqueeth/ETH price
     * @return auction type(sell or buy) and auction initial target hedge
     */
    function _checkAuctionType(
        uint256 _debt,
        uint256 _ethDelta,
        uint256 _wSqueethEthPrice
    ) internal pure returns (bool, uint256) {
        uint256 wSqueethDelta = _debt.wmul(2e18).wmul(_wSqueethEthPrice);

        (uint256 targetHedge, bool isSellingAuction) = _getTargetHedgeAndAuctionType(
            wSqueethDelta,
            _ethDelta,
            _wSqueethEthPrice
        );

        require(targetHedge != 0, "strategy is delta neutral");

        return (isSellingAuction, targetHedge);
    }

    /**
     * @dev calculate amount of strategy token to mint for depositor
     * @param _amount amount of WETH deposited
     * @param _strategyCollateralAmount amount of strategy collateral
     * @param _crabTotalSupply total supply of crab token
     * @return amount of strategy token to mint
     */
    function _calcSharesToMint(
        uint256 _amount,
        uint256 _strategyCollateralAmount,
        uint256 _crabTotalSupply
    ) internal pure returns (uint256) {
        uint256 depositorShare = _amount.wdiv(_strategyCollateralAmount.add(_amount));

        if (_crabTotalSupply != 0) return _crabTotalSupply.wmul(depositorShare).wdiv(uint256(1e18).sub(depositorShare));

        return _amount;
    }

    /**
     * @notice calculate ratio of crab amount to total supply
     * @param _crabAmount crab token amount
     * @param _totalSupply crab total supply
     * @return ratio of amount to total supply
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
     * @notice determine target hedge and auction type (selling/buying auction)
     * @dev target hedge is the amount of WSqueeth the auction needs to sell or buy to be eth delta neutral
     * @param _wSqueethDelta WSqueeth delta
     * @param _ethDelta ETH delta
     * @param _wSqueethEthPrice WSqueeth/ETH price
     * @return target hedge
     * @return auction type: true if auction is selling WSqueeth, false if buying WSqueeth
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
