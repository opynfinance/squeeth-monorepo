// SPDX-License-Identifier: GPL-3.0-only

pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import {IController} from "../interfaces/IController.sol";
import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";
import {IOracle} from "../interfaces/IOracle.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IController} from "../interfaces/IController.sol";

// contract
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {StrategyBase} from "./base/StrategyBase.sol";
import {StrategyFlashSwap} from "./base/StrategyFlashSwap.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// lib
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
// StrategyMath licensed under AGPL-3.0-only
import {StrategyMath} from "./base/StrategyMath.sol";
import {Power2Base} from "../libs/Power2Base.sol";

import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {ECDSA} from "@openzeppelin/contracts/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/drafts/EIP712.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


import "hardhat/console.sol";

/**
 * @dev CrabStrategyV2 contract
 * @notice Contract for Crab strategy
 * @author Opyn team
 */
contract CrabStrategyV2 is StrategyBase, StrategyFlashSwap, ReentrancyGuard, Ownable, EIP712 {
    using Counters for Counters.Counter;
    using StrategyMath for uint256;
    using Address for address payable;

    /// @dev the cap in ETH for the strategy, above which deposits will be rejected
    uint256 public strategyCap;

    /// @dev the TWAP_PERIOD used in the PowerPerp Controller contract
    uint32 public constant POWER_PERP_PERIOD = 420 seconds;
    /// @dev twap period to use for hedge calculations
    uint32 public hedgingTwapPeriod = 420 seconds;

    /// @dev enum to differentiate between uniswap swap callback function source
    enum FLASH_SOURCE {
        FLASH_DEPOSIT,
        FLASH_WITHDRAW,
        FLASH_HEDGE_SELL,
        FLASH_HEDGE_BUY
    }

    /// @dev ETH:WSqueeth uniswap pool
    address public immutable ethWSqueethPool;
    /// @dev strategy uniswap oracle
    address public immutable oracle;
    address public immutable ethQuoteCurrencyPool;
    address public immutable quoteCurrency;

    /// @dev strategy will only allow hedging if collateral to trade is at least a set percentage of the total strategy collateral
    uint256 public deltaHedgeThreshold = 1e15;
    /// @dev time difference to trigger a hedge (seconds)
    uint256 public hedgeTimeThreshold;
    /// @dev price movement to trigger a hedge (0.1*1e18 = 10%)
    uint256 public hedgePriceThreshold;
    /// @dev hedge auction duration (seconds)
    uint256 public auctionTime;
    /// @dev start auction price multiplier for hedge buy auction and reserve price for hedge sell auction (scaled 1e18)
    uint256 public minPriceMultiplier;
    /// @dev start auction price multiplier for hedge sell auction and reserve price for hedge buy auction (scaled 1e18)
    uint256 public maxPriceMultiplier;

    /// @dev timestamp when last hedge executed
    uint256 public timeAtLastHedge;
    /// @dev WSqueeth/Eth price when last hedge executed
    uint256 public priceAtLastHedge;

    /// @dev set to true when redeemShortShutdown has been called
    bool private hasRedeemedInShutdown;

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
    event WithdrawShutdown(address indexed withdrawer, uint256 crabAmount, uint256 ethWithdrawn);
    event FlashDeposit(address indexed depositor, uint256 depositedAmount, uint256 tradedAmountOut);
    event FlashWithdraw(address indexed withdrawer, uint256 crabAmount, uint256 wSqueethAmount);
    event FlashDepositCallback(address indexed depositor, uint256 flashswapDebt, uint256 excess);
    event FlashWithdrawCallback(address indexed withdrawer, uint256 flashswapDebt, uint256 excess);
    event TimeHedgeOnUniswap(
        address indexed hedger,
        uint256 hedgeTimestamp,
        uint256 auctionTriggerTimestamp,
        uint256 minWSqueeth,
        uint256 minEth
    );
    event TimeHedge(address indexed hedger, bool auctionType, uint256 hedgerPrice, uint256 auctionTriggerTimestamp);
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
    event SetStrategyCap(uint256 newCapAmount);
    event SetDeltaHedgeThreshold(uint256 newDeltaHedgeThreshold);
    event SetHedgingTwapPeriod(uint32 newHedgingTwapPeriod);
    event SetHedgeTimeThreshold(uint256 newHedgeTimeThreshold);
    event SetAuctionTime(uint256 newAuctionTime);
    event SetMinPriceMultiplier(uint256 newMinPriceMultiplier);
    event SetMaxPriceMultiplier(uint256 newMaxPriceMultiplier);

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
    ) StrategyBase(_wSqueethController, _weth, "Crab Strategy v2", "Crabv2") StrategyFlashSwap(_uniswapFactory) EIP712("CrabOTC","2") {
        require(_oracle != address(0), "invalid oracle address");
        require(_ethWSqueethPool != address(0), "invalid ETH:WSqueeth address");
        require(_hedgeTimeThreshold > 0, "invalid hedge time threshold");
        require(_hedgePriceThreshold > 0, "invalid hedge price threshold");
        require(_auctionTime > 0, "invalid auction time");
        require(_minPriceMultiplier < 1e18, "min price multiplier too high");
        require(_minPriceMultiplier > 0, "invalid min price multiplier");
        require(_maxPriceMultiplier > 1e18, "max price multiplier too low");

        oracle = _oracle;
        ethWSqueethPool = _ethWSqueethPool;
        hedgeTimeThreshold = _hedgeTimeThreshold;
        hedgePriceThreshold = _hedgePriceThreshold;
        auctionTime = _auctionTime;
        minPriceMultiplier = _minPriceMultiplier;
        maxPriceMultiplier = _maxPriceMultiplier;
        ethQuoteCurrencyPool = IController(_wSqueethController).ethQuoteCurrencyPool();
        quoteCurrency = IController(_wSqueethController).quoteCurrency();
    }

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable {
        require(msg.sender == weth || msg.sender == address(powerTokenController), "Cannot receive eth");
    }

    /**
     * @notice owner can set the strategy cap in ETH collateral terms
     * @dev deposits are rejected if it would put the strategy above the cap amount
     * @dev strategy collateral can be above the cap amount due to hedging activities
     * @param _capAmount the maximum strategy collateral in ETH, checked on deposits
     */
    function setStrategyCap(uint256 _capAmount) external onlyOwner {
        strategyCap = _capAmount;

        emit SetStrategyCap(_capAmount);
    }

    /**
     * @notice called to redeem the net value of a vault post shutdown
     * @dev needs to be called 1 time before users can exit the strategy using withdrawShutdown
     */
    function redeemShortShutdown() external {
        hasRedeemedInShutdown = true;
        powerTokenController.redeemShort(vaultId);
    }

    /**
     * @notice flash deposit into strategy, providing ETH, selling wSqueeth and receiving strategy tokens
     * @dev this function will execute a flash swap where it receives ETH, deposits and mints using flash swap proceeds and msg.value, and then repays the flash swap with wSqueeth
     * @dev _ethToDeposit must be less than msg.value plus the proceeds from the flash swap
     * @dev the difference between _ethToDeposit and msg.value provides the minimum that a user can receive for their sold wSqueeth
     * @param _ethToDeposit total ETH that will be deposited in to the strategy which is a combination of msg.value and flash swap proceeds
     */
    function flashDeposit(uint256 _ethToDeposit) external payable nonReentrant {
        (uint256 cachedStrategyDebt, uint256 cachedStrategyCollateral) = _syncStrategyState();
        _checkStrategyCap(_ethToDeposit, cachedStrategyCollateral);

        (uint256 wSqueethToMint, ) = _calcWsqueethToMintAndFee(
            _ethToDeposit,
            cachedStrategyDebt,
            cachedStrategyCollateral
        );

        if (cachedStrategyDebt == 0 && cachedStrategyCollateral == 0) {
            // store hedge data as strategy is delta neutral at this point
            // only execute this upon first deposit
            uint256 wSqueethEthPrice = IOracle(oracle).getTwap(
                ethWSqueethPool,
                wPowerPerp,
                weth,
                hedgingTwapPeriod,
                true
            );
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
     * @notice flash withdraw from strategy, providing strategy tokens, buying wSqueeth, burning and receiving ETH
     * @dev this function will execute a flash swap where it receives wSqueeth, burns, withdraws ETH and then repays the flash swap with ETH
     * @param _crabAmount strategy token amount to burn
     * @param _maxEthToPay maximum ETH to pay to buy back the owed wSqueeth debt
     */
    function flashWithdraw(uint256 _crabAmount, uint256 _maxEthToPay) external nonReentrant {
        uint256 exactWSqueethNeeded = _getDebtFromStrategyAmount(_crabAmount);

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
     * @dev provide ETH, return wSqueeth and strategy token
     */
    function deposit() external payable nonReentrant {
        uint256 amount = msg.value;

        (uint256 wSqueethToMint, uint256 depositorCrabAmount) = _deposit(msg.sender, amount, false);

        emit Deposit(msg.sender, wSqueethToMint, depositorCrabAmount);
    }

    /**
     * @notice withdraw WETH from strategy
     * @dev provide strategy tokens and wSqueeth, returns eth
     * @param _crabAmount amount of strategy token to burn
     */
    function withdraw(uint256 _crabAmount) external nonReentrant {
        uint256 wSqueethAmount = _getDebtFromStrategyAmount(_crabAmount);
        uint256 ethToWithdraw = _withdraw(msg.sender, _crabAmount, wSqueethAmount, false);

        // send back ETH collateral
        payable(msg.sender).sendValue(ethToWithdraw);

        emit Withdraw(msg.sender, _crabAmount, wSqueethAmount, ethToWithdraw);
    }

    /**
     * @notice called to exit a vault if the Squeeth Power Perp contracts are shutdown
     * @param _crabAmount amount of strategy token to burn
     */
    function withdrawShutdown(uint256 _crabAmount) external nonReentrant {
        require(powerTokenController.isShutDown(), "Squeeth contracts not shut down");
        require(hasRedeemedInShutdown, "Crab must redeemShortShutdown");

        uint256 strategyShare = _calcCrabRatio(_crabAmount, totalSupply());
        uint256 ethToWithdraw = _calcEthToWithdraw(strategyShare, address(this).balance);
        _burn(msg.sender, _crabAmount);

        payable(msg.sender).sendValue(ethToWithdraw);
        emit WithdrawShutdown(msg.sender, _crabAmount, ethToWithdraw);
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
     * @notice check if hedging based on time threshold is allowed
     * @return isTimeHedgeAllowed true if hedging is allowed
     * @return auctionTriggertime auction trigger timestamp
     */
    function checkTimeHedge() external view returns (bool, uint256) {
        return _isTimeHedge();
    }

    /**
     * @notice get wSqueeth debt amount associated with strategy token amount
     * @param _crabAmount strategy token amount
     * @return wSqueeth amount
     */
    function getWsqueethFromCrabAmount(uint256 _crabAmount) external view returns (uint256) {
        return _getDebtFromStrategyAmount(_crabAmount);
    }

    /**
     * @notice owner can set the delta hedge threshold as a percent scaled by 1e18 of ETH collateral
     * @dev the strategy will not allow a hedge if the trade size is below this threshold
     * @param _deltaHedgeThreshold minimum hedge size in a percent of ETH collateral
     */
    function setDeltaHedgeThreshold(uint256 _deltaHedgeThreshold) external onlyOwner {
        deltaHedgeThreshold = _deltaHedgeThreshold;

        emit SetDeltaHedgeThreshold(_deltaHedgeThreshold);
    }

    /**
     * @notice owner can set the twap period in seconds that is used for calculating twaps for hedging
     * @param _hedgingTwapPeriod the twap period, in seconds
     */
    function setHedgingTwapPeriod(uint32 _hedgingTwapPeriod) external onlyOwner {
        require(_hedgingTwapPeriod >= 180, "twap period is too short");

        hedgingTwapPeriod = _hedgingTwapPeriod;

        emit SetHedgingTwapPeriod(_hedgingTwapPeriod);
    }

    /**
     * @notice owner can set the hedge time threshold in seconds that determines how often the strategy can be hedged
     * @param _hedgeTimeThreshold the hedge time threshold, in seconds
     */
    function setHedgeTimeThreshold(uint256 _hedgeTimeThreshold) external onlyOwner {
        require(_hedgeTimeThreshold > 0, "invalid hedge time threshold");

        hedgeTimeThreshold = _hedgeTimeThreshold;

        emit SetHedgeTimeThreshold(_hedgeTimeThreshold);
    }

    /**
     * @notice owner can set the auction time, in seconds, that a hedge auction runs for
     * @param _auctionTime the length of the hedge auction in seconds
     */
    function setAuctionTime(uint256 _auctionTime) external onlyOwner {
        require(_auctionTime > 0, "invalid auction time");

        auctionTime = _auctionTime;

        emit SetAuctionTime(_auctionTime);
    }

    /**
     * @notice owner can set the min price multiplier in a percentage scaled by 1e18 (9e17 is 90%)
     * @dev the min price multiplier is multiplied by the TWAP price to get the intial auction price
     * @param _minPriceMultiplier the min price multiplier, a percentage, scaled by 1e18
     */
    function setMinPriceMultiplier(uint256 _minPriceMultiplier) external onlyOwner {
        require(_minPriceMultiplier < 1e18, "min price multiplier too high");

        minPriceMultiplier = _minPriceMultiplier;

        emit SetMinPriceMultiplier(_minPriceMultiplier);
    }

    /**
     * @notice owner can set the max price multiplier in a percentage scaled by 1e18 (11e18 is 110%)
     * @dev the max price multiplier is multiplied by the TWAP price to get the final auction price
     * @param _maxPriceMultiplier the max price multiplier, a percentage, scaled by 1e18
     */
    function setMaxPriceMultiplier(uint256 _maxPriceMultiplier) external onlyOwner {
        require(_maxPriceMultiplier > 1e18, "max price multiplier too low");

        maxPriceMultiplier = _maxPriceMultiplier;

        emit SetMaxPriceMultiplier(_maxPriceMultiplier);
    }

    /**
     * @notice check if a user deposit puts the strategy above the cap
     * @dev reverts if a deposit amount puts strategy over the cap
     * @dev it is possible for the strategy to be over the cap from trading/hedging activities, but withdrawals are still allowed
     * @param _depositAmount the user deposit amount in ETH
     * @param _strategyCollateral the updated strategy collateral
     */
    function _checkStrategyCap(uint256 _depositAmount, uint256 _strategyCollateral) internal view {
        require(_strategyCollateral.add(_depositAmount) <= strategyCap, "Deposit exceeds strategy cap");
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

            // convert WETH to ETH as Uniswap uses WETH
            IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));

            //use user msg.value and unwrapped WETH from uniswap flash swap proceeds to deposit into strategy
            //will revert if data.totalDeposit is > eth balance in contract
            _deposit(_caller, data.totalDeposit, true);

            //repay the flash swap
            IWPowerPerp(wPowerPerp).transfer(ethWSqueethPool, _amountToPay);

            emit FlashDepositCallback(_caller, _amountToPay, address(this).balance);

            //return excess eth to the user that was not needed for slippage
            if (address(this).balance > 0) {
                payable(_caller).sendValue(address(this).balance);
            }
        } else if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_WITHDRAW) {
            FlashWithdrawData memory data = abi.decode(_callData, (FlashWithdrawData));

            //use flash swap wSqueeth proceeds to withdraw ETH along with user crabAmount
            uint256 ethToWithdraw = _withdraw(
                _caller,
                data.crabAmount,
                IWPowerPerp(wPowerPerp).balanceOf(address(this)),
                true
            );

            //use some amount of withdrawn ETH to repay flash swap
            IWETH9(weth).deposit{value: _amountToPay}();
            IWETH9(weth).transfer(ethWSqueethPool, _amountToPay);

            //excess ETH not used to repay flash swap is transferred to the user
            uint256 proceeds = ethToWithdraw.sub(_amountToPay);

            emit FlashWithdrawCallback(_caller, _amountToPay, proceeds);

            if (proceeds > 0) {
                payable(_caller).sendValue(proceeds);
            }
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
        _checkStrategyCap(_amount, strategyCollateral);

        (uint256 wSqueethToMint, uint256 ethFee) = _calcWsqueethToMintAndFee(_amount, strategyDebt, strategyCollateral);

        uint256 depositorCrabAmount = _calcSharesToMint(_amount.sub(ethFee), strategyCollateral, totalSupply());

        if (strategyDebt == 0 && strategyCollateral == 0) {
            // store hedge data as strategy is delta neutral at this point
            // only execute this upon first deposit
            uint256 wSqueethEthPrice = IOracle(oracle).getTwap(
                ethWSqueethPool,
                wPowerPerp,
                weth,
                hedgingTwapPeriod,
                true
            );
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
     * @param _crabAmount amount of strategy token to burn
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
        (, uint256 strategyCollateral) = _syncStrategyState();

        uint256 strategyShare = _calcCrabRatio(_crabAmount, totalSupply());
        uint256 ethToWithdraw = _calcEthToWithdraw(strategyShare, strategyCollateral);

        _burnWPowerPerp(_from, _wSqueethAmount, ethToWithdraw, _isFlashWithdraw);
        _burn(_from, _crabAmount);

        return ethToWithdraw;
    }

    struct Order {
        uint256 bidId;
        address trader;
        address traderToken;
        uint256 traderAmount;
        address managerToken;
        uint256 managerAmount;
        uint256 nonce;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    bytes32 private constant _CRAB_BALANCE_TYPEHASH =
    keccak256(
        "Order(uint256 bidId,address trader,address traderToken,uint256 tradeAmount,address managerToken, uint256 managerAmount ,uint256 nonce)"
    );
    mapping(address => Counters.Counter) private _nonces;

    function _useNonce(address owner) internal returns (uint256 current) {
        Counters.Counter storage nonce = _nonces[owner];
        current = nonce.current();
        nonce.increment();
    }

    function nonces(address owner) external view returns (uint256) {
        return _nonces[owner].current();
    }

    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // hedge function should be upgradeable , take a look at controller Helper
    //struct RebalanceLpInVaultParams {
     //   RebalanceVaultNftType rebalanceLpInVaultType;
     //   bytes data;
     // calldata
    ///}

    // then work on upgradability

    event HedgeOTC(
        address trader,
        uint256 managerAmount,
        uint256 traderAmount
    );

    function _execOrder(uint256 managerSellAmount, uint256 managerBuyPrice, Order memory _order) internal {
        bytes32 structHash = keccak256(
            abi.encode(
                _CRAB_BALANCE_TYPEHASH,
                _order.bidId,
                _order.trader,
                _order.traderToken,
                _order.traderAmount,
                _order.managerToken,
                _order.managerAmount,
                _useNonce(_order.trader)
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);
        console.log(string(abi.encodePacked(hash)));
        address offerSigner = ECDSA.recover(hash, _order.v, _order.r, _order.s);
        //require(offerSigner == _order.trader, "Invalid offer signature");

        //adjust managerAmount and TraderAmount for partial fills
        // TODO test this a lot
        if(managerSellAmount < _order.managerAmount) {
            _order.managerAmount = managerSellAmount;
            _order.traderAmount = _order.traderAmount.mul(managerSellAmount.div(_order.managerAmount));
        }
        //adjust if manager is giving better price
        // TODO test this a lot
        uint256 sellerPrice = _order.managerAmount.div(_order.traderAmount);
        if(managerBuyPrice > sellerPrice) {
            _order.managerAmount = _order.traderAmount.mul(managerBuyPrice);
        }

        IERC20(_order.traderToken).transferFrom(_order.trader, address(this), _order.traderAmount);

        // if the trader is selling WETH to us i.e if we are selling oSQTH
        if(_order.traderToken == weth) {
            IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this))); 
            // if last param is false, transfer happens again
            _mintWPowerPerp(_order.trader, _order.managerAmount, _order.traderAmount, true);
            emit ExecuteSellAuction(_order.trader, _order.managerAmount, _order.traderAmount, true);
        } else {
            // oSQTH in, WETH out
            _burnWPowerPerp(_order.trader, _order.traderAmount, _order.managerAmount, true); 
            // if last param is false, transfer happens again
            emit ExecuteBuyAuction(_order.trader, _order.traderAmount, _order.managerAmount, true);
        }

        IERC20(_order.managerToken).transfer(_order.trader, _order.managerAmount);

        emit HedgeOTC(
            _order.trader, // market maker
            //_order.managerToken === wPowerPerp, // is managerSelling oSQTH
            _order.managerAmount, // token out
            _order.traderAmount // token in
        );

    }

    function hedgeOTC(uint256 managerSellAmount, uint256 sellerPrice , Order[] memory _orders) external onlyOwner {
        uint256 remainingAmount = managerSellAmount;
        for (uint i=0; i < _orders.length; i++) {
            if(remainingAmount > _orders[i].managerAmount) {
                remainingAmount = remainingAmount.sub(_orders[i].managerAmount);
                _execOrder(remainingAmount, sellerPrice, _orders[i]);
            } else {
                _execOrder(remainingAmount, sellerPrice, _orders[i]);
                break;
            }
        }
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
            require(auctionWSqueethEthPrice <= _limitPrice, "Auction price > max price");
            require(msg.value >= ethProceeds, "Low ETH amount received");

            _executeSellAuction(msg.sender, msg.value, wSqueethToAuction, ethProceeds, false);
        } else {
            require(msg.value == 0, "ETH attached for buy auction");
            // Receiving wSqueeth and paying ETH
            require(auctionWSqueethEthPrice >= _limitPrice, "Auction price < min price");
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
     * @notice execute sell auction based on the parameters calculated
     * @dev if _isHedgingOnUniswap, wSqueeth minted is kept to repay flashswap, otherwise sent to seller
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
     * @notice execute buy auction based on the parameters calculated
     * @dev if _isHedgingOnUniswap, ETH proceeds are not sent to seller
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
     * @notice determine auction direction, price, and ensure auction hasn't switched directions
     * @param _auctionTriggerTime auction starting time
     * @return auction type
     * @return WSqueeth amount to sell or buy
     * @return ETH to sell/buy
     * @return auction WSqueeth/ETH price
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
        uint256 currentWSqueethPrice = IOracle(oracle).getTwap(
            ethWSqueethPool,
            wPowerPerp,
            weth,
            hedgingTwapPeriod,
            true
        );
        uint256 feeAdjustment = _calcFeeAdjustment();
        (bool isSellingAuction, ) = _checkAuctionType(strategyDebt, ethDelta, currentWSqueethPrice, feeAdjustment);
        uint256 auctionWSqueethEthPrice = _getAuctionPrice(_auctionTriggerTime, currentWSqueethPrice, isSellingAuction);
        (bool isStillSellingAuction, uint256 wSqueethToAuction) = _checkAuctionType(
            strategyDebt,
            ethDelta,
            auctionWSqueethEthPrice,
            feeAdjustment
        );

        require(isSellingAuction == isStillSellingAuction, "auction direction changed");

        uint256 ethProceeds = wSqueethToAuction.wmul(auctionWSqueethEthPrice);

        timeAtLastHedge = block.timestamp;
        priceAtLastHedge = currentWSqueethPrice;

        return (isSellingAuction, wSqueethToAuction, ethProceeds, auctionWSqueethEthPrice);
    }

    /**
     * @notice sync strategy debt and collateral amount from vault
     * @return synced debt amount
     * @return synced collateral amount
     */
    function _syncStrategyState() internal view returns (uint256, uint256) {
        (, , uint256 syncedStrategyCollateral, uint256 syncedStrategyDebt) = _getVaultDetails();

        return (syncedStrategyDebt, syncedStrategyCollateral);
    }

    /**
     * @notice calculate the fee adjustment factor, which is the amount of ETH owed per 1 wSqueeth minted
     * @dev the fee is a based off the index value of squeeth and uses a twap scaled down by the PowerPerp's INDEX_SCALE
     * @return the fee adjustment factor
     */
    function _calcFeeAdjustment() internal view returns (uint256) {
        uint256 wSqueethEthPrice = Power2Base._getTwap(
            oracle,
            ethWSqueethPool,
            wPowerPerp,
            weth,
            POWER_PERP_PERIOD,
            false
        );
        uint256 feeRate = IController(powerTokenController).feeRate();
        return wSqueethEthPrice.mul(feeRate).div(10000);
    }

    /**
     * @notice calculate amount of wSqueeth to mint and fee paid from deposited amount
     * @param _depositedAmount amount of deposited WETH
     * @param _strategyDebtAmount amount of strategy debt
     * @param _strategyCollateralAmount collateral amount in strategy
     * @return amount of minted wSqueeth and ETH fee paid on minted squeeth
     */
    function _calcWsqueethToMintAndFee(
        uint256 _depositedAmount,
        uint256 _strategyDebtAmount,
        uint256 _strategyCollateralAmount
    ) internal view returns (uint256, uint256) {
        uint256 wSqueethToMint;
        uint256 feeAdjustment = _calcFeeAdjustment();

        if (_strategyDebtAmount == 0 && _strategyCollateralAmount == 0) {
            require(totalSupply() == 0, "Crab contracts shut down");

            uint256 wSqueethEthPrice = IOracle(oracle).getTwap(
                ethWSqueethPool,
                wPowerPerp,
                weth,
                hedgingTwapPeriod,
                true
            );
            uint256 squeethDelta = wSqueethEthPrice.wmul(2e18);
            wSqueethToMint = _depositedAmount.wdiv(squeethDelta.add(feeAdjustment));
        } else {
            wSqueethToMint = _depositedAmount.wmul(_strategyDebtAmount).wdiv(
                _strategyCollateralAmount.add(_strategyDebtAmount.wmul(feeAdjustment))
            );
        }

        uint256 fee = wSqueethToMint.wmul(feeAdjustment);

        return (wSqueethToMint, fee);
    }

    /**
     * @notice check if hedging based on time threshold is allowed
     * @return true if time hedging is allowed
     * @return auction trigger timestamp
     */
    function _isTimeHedge() internal view returns (bool, uint256) {
        uint256 auctionTriggerTime = timeAtLastHedge.add(hedgeTimeThreshold);

        return (block.timestamp >= auctionTriggerTime, auctionTriggerTime);
    }


    /**
     * @notice calculate auction price based on auction direction, start time and wSqueeth price
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
        uint256 auctionCompletionRatio = block.timestamp.sub(_auctionTriggerTime) >= auctionTime
            ? 1e18
            : (block.timestamp.sub(_auctionTriggerTime)).wdiv(auctionTime);

        uint256 priceMultiplier;
        if (_isSellingAuction) {
            priceMultiplier = maxPriceMultiplier.sub(
                auctionCompletionRatio.wmul(maxPriceMultiplier.sub(minPriceMultiplier))
            );
        } else {
            priceMultiplier = minPriceMultiplier.add(
                auctionCompletionRatio.wmul(maxPriceMultiplier.sub(minPriceMultiplier))
            );
        }

        return _wSqueethEthPrice.wmul(priceMultiplier);
    }

    /**
     * @notice check the direction of auction and the target amount of wSqueeth to hedge
     * @param _debt strategy debt
     * @param _ethDelta ETH delta (amount of ETH in strategy)
     * @param _wSqueethEthPrice WSqueeth/ETH price
     * @param _feeAdjustment the fee adjustment, the amount of ETH owed per wSqueeth minted
     * @return auction type(sell or buy) and auction initial target hedge in wSqueeth
     */
    function _checkAuctionType(
        uint256 _debt,
        uint256 _ethDelta,
        uint256 _wSqueethEthPrice,
        uint256 _feeAdjustment
    ) internal view returns (bool, uint256) {
        uint256 wSqueethDelta = _debt.wmul(2e18).wmul(_wSqueethEthPrice);

        (uint256 targetHedge, bool isSellingAuction) = _getTargetHedgeAndAuctionType(
            wSqueethDelta,
            _ethDelta,
            _wSqueethEthPrice,
            _feeAdjustment
        );

        require(targetHedge.wmul(_wSqueethEthPrice).wdiv(_ethDelta) > deltaHedgeThreshold, "strategy is delta neutral");

        return (isSellingAuction, targetHedge);
    }

    /**
     * @dev calculate amount of strategy token to mint for depositor
     * @param _amount amount of ETH deposited
     * @param _strategyCollateralAmount amount of strategy collateral
     * @param _crabTotalSupply total supply of strategy token
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
     * @notice calculates the ownership proportion for strategy debt and collateral relative to a total amount of strategy tokens
     * @param _crabAmount strategy token amount
     * @param _totalSupply strategy total supply
     * @return ownership proportion of a strategy token amount relative to the total strategy tokens
     */
    function _calcCrabRatio(uint256 _crabAmount, uint256 _totalSupply) internal pure returns (uint256) {
        return _crabAmount.wdiv(_totalSupply);
    }

    /**
     * @notice calculate ETH to withdraw from strategy given a ownership proportion
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
     * @param _feeAdjustment the fee adjustment, the amount of ETH owed per wSqueeth minted
     * @return target hedge in wSqueeth
     * @return auction type: true if auction is selling WSqueeth, false if buying WSqueeth
     */
    function _getTargetHedgeAndAuctionType(
        uint256 _wSqueethDelta,
        uint256 _ethDelta,
        uint256 _wSqueethEthPrice,
        uint256 _feeAdjustment
    ) internal pure returns (uint256, bool) {
        return
            (_wSqueethDelta > _ethDelta)
                ? ((_wSqueethDelta.sub(_ethDelta)).wdiv(_wSqueethEthPrice), false)
                : ((_ethDelta.sub(_wSqueethDelta)).wdiv(_wSqueethEthPrice.add(_feeAdjustment)), true);
    }
}
