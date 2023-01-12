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
import {IShortPowerPerp} from "../interfaces/IShortPowerPerp.sol";

// contract
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {StrategyBase} from "./base/StrategyBase.sol";
import {StrategyFlashSwap} from "./base/StrategyFlashSwap.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/drafts/EIP712.sol";

// lib
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
// StrategyMath licensed under AGPL-3.0-only
import {StrategyMath} from "./base/StrategyMath.sol";
import {Power2Base} from "../libs/Power2Base.sol";
import {ECDSA} from "@openzeppelin/contracts/cryptography/ECDSA.sol";

/**
 * Crab V2 Error Codes:
 * C1: Caller is not timelock
 * C2: Contract not yet initialized
 * C3: Invalid oracle address
 * C4: Invalid timelock address
 * C5: Invalid ETH:WSqueeth address
 * C6: Invalid crabMigration address
 * C7: Invalid hedge time threshold
 * C8: Invalid hedge price threshold
 * C9: Cannot receive ETH
 * C10: Caller not Crab Migration contract
 * C11: Crab V2 already initialized
 * C12: Squeeth contracts not shut down
 * C13: Crab must redeemShortShutdown
 * C14: Twap period is too short
 * C15: Price tolerance is too high
 * C16: Deposit exceeds strategy cap
 * C17: Clearing Price should be below bid price
 * C18: Clearing Price should be above offer price
 * C19: Invalid offer signature
 * C20: Order has expired
 * C21: Manager Price should be greater than 0
 * C22: Not a valid Time or Price hedge
 * C23: Orders must take the opposite side of the hedge
 * C24: All orders must be either buying or selling
 * C25: Orders are not arranged properly
 * C26: Crab contracts shut down
 *  C27: Nonce already used.
 */

/**
 * @dev CrabStrategyV2 contract
 * @notice Contract for Crab strategy
 * @author Opyn team
 */
contract CrabStrategyV2 is StrategyBase, StrategyFlashSwap, ReentrancyGuard, Ownable, EIP712 {
    using StrategyMath for uint256;
    using Address for address payable;

    /// @dev the cap in ETH for the strategy, above which deposits will be rejected
    uint256 public strategyCap;

    /// @dev the TWAP_PERIOD used in the PowerPerp Controller contract
    uint32 public constant POWER_PERP_PERIOD = 420 seconds;

    /// @dev basic unit used for calculation
    uint256 private constant ONE = 1e18;
    uint256 private constant ONE_ONE = 1e36;

    // @dev OTC price must be within this distance of the uniswap twap price
    uint256 public otcPriceTolerance = 5e16; // 5%

    // @dev OTC price tolerance cannot exceed 20%
    uint256 public constant MAX_OTC_PRICE_TOLERANCE = 2e17; // 20%

    /// @dev twap period to use for hedge calculations
    uint32 public hedgingTwapPeriod = 420 seconds;
    /// @dev true if CrabV2 was initialized
    bool public isInitialized;

    /// @dev typehash for signed orders
    bytes32 private constant _CRAB_BALANCE_TYPEHASH =
        keccak256(
            "Order(uint256 bidId,address trader,uint256 quantity,uint256 price,bool isBuying,uint256 expiry,uint256 nonce)"
        );

    /// @dev enum to differentiate between uniswap swap callback function source
    enum FLASH_SOURCE {
        FLASH_DEPOSIT,
        FLASH_WITHDRAW
    }

    /// @dev ETH:wSqueeth uniswap pool
    address public immutable ethWSqueethPool;
    /// @dev strategy uniswap oracle
    address public immutable oracle;
    address public immutable timelock;
    address public immutable crabMigration;

    /// @dev time difference to trigger a hedge (seconds)
    uint256 public hedgeTimeThreshold;
    /// @dev price movement to trigger a hedge (0.1*1e18 = 10%)
    uint256 public hedgePriceThreshold;

    /// @dev timestamp when last hedge executed
    uint256 public timeAtLastHedge;
    /// @dev wSqueeth/Eth price when last hedge executed
    uint256 public priceAtLastHedge;

    /// @dev set to true when redeemShortShutdown has been called
    bool private hasRedeemedInShutdown;

    /// @dev store the used flag for a nonce for each address
    mapping(address => mapping(uint256 => bool)) public nonces;

    struct FlashDepositData {
        uint256 totalDeposit;
    }

    struct FlashWithdrawData {
        uint256 crabAmount;
    }

    struct Order {
        uint256 bidId;
        address trader;
        uint256 quantity;
        uint256 price;
        bool isBuying;
        uint256 expiry;
        uint256 nonce;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    event Deposit(address indexed depositor, uint256 wSqueethAmount, uint256 lpAmount);
    event Withdraw(address indexed withdrawer, uint256 crabAmount, uint256 wSqueethAmount, uint256 ethWithdrawn);
    event WithdrawShutdown(address indexed withdrawer, uint256 crabAmount, uint256 ethWithdrawn);
    event FlashDeposit(address indexed depositor, uint256 depositedAmount, uint256 tradedAmountOut);
    event FlashWithdraw(address indexed withdrawer, uint256 crabAmount, uint256 wSqueethAmount);
    event FlashDepositCallback(address indexed depositor, uint256 flashswapDebt, uint256 excess);
    event FlashWithdrawCallback(address indexed withdrawer, uint256 flashswapDebt, uint256 excess);
    event HedgeOTCSingle(
        address trader,
        uint256 bidId,
        uint256 quantity,
        uint256 price,
        bool isBuying,
        uint256 clearingPrice
    );
    event HedgeOTC(uint256 bidId, uint256 quantity, bool isBuying, uint256 clearingPrice);
    event SetStrategyCap(uint256 newCapAmount);
    event SetHedgingTwapPeriod(uint32 newHedgingTwapPeriod);
    event SetHedgeTimeThreshold(uint256 newHedgeTimeThreshold);
    event SetHedgePriceThreshold(uint256 newHedgePriceThreshold);
    event SetOTCPriceTolerance(uint256 otcPriceTolerance);
    event VaultTransferred(address indexed newStrategy, uint256 vaultId);

    modifier onlyTimelock() {
        require(msg.sender == timelock, "C1");
        _;
    }

    modifier afterInitialization() {
        require(isInitialized, "C2");
        _;
    }

    /**
     * @notice strategy constructor
     * @dev this will open a vault in the power token contract and store the vault ID
     * @param _wSqueethController power token controller address
     * @param _oracle oracle address
     * @param _weth weth address
     * @param _uniswapFactory uniswap factory address
     * @param _ethWSqueethPool eth:wSqueeth uniswap pool address
     * @param _timelock timelock contract address
     * @param _crabMigration crab migration contract address
     * @param _hedgeTimeThreshold hedge time threshold (seconds)
     * @param _hedgePriceThreshold hedge price threshold (0.1*1e18 = 10%)
     */
    constructor(
        address _wSqueethController,
        address _oracle,
        address _weth,
        address _uniswapFactory,
        address _ethWSqueethPool,
        address _timelock,
        address _crabMigration,
        uint256 _hedgeTimeThreshold,
        uint256 _hedgePriceThreshold
    )
        StrategyBase(_wSqueethController, _weth, "Crab Strategy v2", "Crabv2")
        StrategyFlashSwap(_uniswapFactory)
        EIP712("CrabOTC", "2")
    {
        require(_oracle != address(0), "C3");
        require(_timelock != address(0), "C4");
        require(_ethWSqueethPool != address(0), "C5");
        require(_crabMigration != address(0), "C6");
        require(_hedgeTimeThreshold > 0, "C7");
        require((_hedgePriceThreshold > 0) && (_hedgePriceThreshold <= ONE), "C8");

        oracle = _oracle;
        ethWSqueethPool = _ethWSqueethPool;
        hedgeTimeThreshold = _hedgeTimeThreshold;
        hedgePriceThreshold = _hedgePriceThreshold;
        timelock = _timelock;
        crabMigration = _crabMigration;
    }

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable {
        require(msg.sender == weth || msg.sender == address(powerTokenController), "C9");
    }

    /**
     * @notice initializes the collateral ratio after the first migration
     * @param _wSqueethToMint amount of wPowerPerp to mint
     * @param _crabSharesToMint crab shares to mint
     * @param _timeAtLastHedge time at last hedge for crab V1
     * @param _priceAtLastHedge price at last hedge for crab V1
     * @param _strategyCap strategy cap for crab V2
     */
    function initialize(
        uint256 _wSqueethToMint,
        uint256 _crabSharesToMint,
        uint256 _timeAtLastHedge,
        uint256 _priceAtLastHedge,
        uint256 _strategyCap
    ) external payable {
        require(msg.sender == crabMigration, "C10");
        require(!isInitialized, "C11");

        _setStrategyCap(_strategyCap);

        uint256 amount = msg.value;

        _checkStrategyCap(amount, 0);

        // store hedge data from crab V1
        timeAtLastHedge = _timeAtLastHedge;
        priceAtLastHedge = _priceAtLastHedge;

        // mint wSqueeth and send it to msg.sender
        _mintWPowerPerp(msg.sender, _wSqueethToMint, amount, false);
        // mint LP to depositor
        _mintStrategyToken(msg.sender, _crabSharesToMint);

        isInitialized = true;
    }

    /**
     * @notice transfer vault NFT to new contract
     * @dev strategy cap is set to 0 to avoid future deposits
     * @param _newStrategy new strategy contract address
     */
    function transferVault(address _newStrategy) external onlyTimelock afterInitialization {
        IShortPowerPerp(powerTokenController.shortPowerPerp()).safeTransferFrom(address(this), _newStrategy, vaultId);
        _setStrategyCap(0);

        emit VaultTransferred(_newStrategy, vaultId);
    }

    /**
     * @notice owner can set the strategy cap in ETH collateral terms
     * @dev deposits are rejected if it would put the strategy above the cap amount
     * @dev strategy collateral can be above the cap amount due to hedging activities
     * @param _capAmount the maximum strategy collateral in ETH, checked on deposits
     */
    function setStrategyCap(uint256 _capAmount) external onlyOwner afterInitialization {
        _setStrategyCap(_capAmount);
    }

    /**
     * @notice set strategy cap amount
     * @dev deposits are rejected if it would put the strategy above the cap amount
     * @dev strategy collateral can be above the cap amount due to hedging activities
     * @param _capAmount the maximum strategy collateral in ETH, checked on deposits
     */
    function _setStrategyCap(uint256 _capAmount) internal {
        strategyCap = _capAmount;
        emit SetStrategyCap(_capAmount);
    }

    /**
     * @notice called to redeem the net value of a vault post shutdown
     * @dev needs to be called before users can exit strategy using withdrawShutdown
     */
    function redeemShortShutdown() external afterInitialization {
        hasRedeemedInShutdown = true;
        powerTokenController.redeemShort(vaultId);
    }

    /**
     * @notice flash deposit into strategy, providing ETH, selling wSqueeth and receiving strategy tokens
     * @dev this function will execute a flash swap where it receives ETH, deposits and mints using flash swap proceeds and msg.value, and then repays the flash swap with wSqueeth
     * @dev _ethToDeposit must be less than msg.value plus the proceeds from the flash swap
     * @dev the difference between _ethToDeposit and msg.value provides the minimum that a user can receive for their sold wSqueeth
     * @param _ethToDeposit total ETH that will be deposited in to the strategy which is a combination of msg.value and flash swap proceeds
     * @param _poolFee Uniswap pool fee
     */
    function flashDeposit(uint256 _ethToDeposit, uint24 _poolFee) external payable nonReentrant {
        (uint256 cachedStrategyDebt, uint256 cachedStrategyCollateral) = _syncStrategyState();
        _checkStrategyCap(_ethToDeposit, cachedStrategyCollateral);

        (uint256 wSqueethToMint, ) = _calcWsqueethToMintAndFee(
            _ethToDeposit,
            cachedStrategyDebt,
            cachedStrategyCollateral
        );

        _exactInFlashSwap(
            wPowerPerp,
            weth,
            _poolFee,
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
     * @param _maxEthToPay maximum ETH to pay to buy back the wSqueeth debt
     * @param _poolFee Uniswap pool fee

     */
    function flashWithdraw(
        uint256 _crabAmount,
        uint256 _maxEthToPay,
        uint24 _poolFee
    ) external nonReentrant {
        uint256 exactWSqueethNeeded = _getDebtFromStrategyAmount(_crabAmount);

        _exactOutFlashSwap(
            weth,
            wPowerPerp,
            _poolFee,
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
     * @dev provide strategy tokens and wSqueeth, returns ETH
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
        require(powerTokenController.isShutDown(), "C12");
        require(hasRedeemedInShutdown, "C13");

        uint256 strategyShare = _calcCrabRatio(_crabAmount, totalSupply());
        uint256 ethToWithdraw = _calcEthToWithdraw(strategyShare, address(this).balance);
        _burn(msg.sender, _crabAmount);

        payable(msg.sender).sendValue(ethToWithdraw);
        emit WithdrawShutdown(msg.sender, _crabAmount, ethToWithdraw);
    }

    /**
     * @notice set nonce to true
     * @param _nonce the number to be set true
     */
    function setNonceTrue(uint256 _nonce) external {
        nonces[msg.sender][_nonce] = true;
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
     * @notice owner can set the twap period in seconds that is used for calculating twaps for hedging
     * @param _hedgingTwapPeriod the twap period, in seconds
     */
    function setHedgingTwapPeriod(uint32 _hedgingTwapPeriod) external onlyOwner {
        require(_hedgingTwapPeriod >= 180, "C14");

        hedgingTwapPeriod = _hedgingTwapPeriod;

        emit SetHedgingTwapPeriod(_hedgingTwapPeriod);
    }

    /**
     * @notice owner can set the hedge time threshold in seconds that determines how often the strategy can be hedged
     * @param _hedgeTimeThreshold the hedge time threshold, in seconds
     */
    function setHedgeTimeThreshold(uint256 _hedgeTimeThreshold) external onlyOwner {
        require(_hedgeTimeThreshold > 0, "C7");

        hedgeTimeThreshold = _hedgeTimeThreshold;

        emit SetHedgeTimeThreshold(_hedgeTimeThreshold);
    }

    /**
     * @notice owner can set the hedge time threshold in percent, scaled by 1e18 that determines the deviation in wPowerPerp price that can trigger a rebalance
     * @param _hedgePriceThreshold the hedge price threshold, in percent, scaled by 1e18
     */
    function setHedgePriceThreshold(uint256 _hedgePriceThreshold) external onlyOwner {
        require((_hedgePriceThreshold > 0) && (_hedgePriceThreshold <= ONE), "C8");

        hedgePriceThreshold = _hedgePriceThreshold;

        emit SetHedgePriceThreshold(_hedgePriceThreshold);
    }

    /**
     * @notice owner can set a threshold, scaled by 1e18 that determines the maximum discount of a clearing sale price to the current uniswap twap price
     * @param _otcPriceTolerance the OTC price tolerance, in percent, scaled by 1e18
     */
    function setOTCPriceTolerance(uint256 _otcPriceTolerance) external onlyOwner {
        // Tolerance cannot be more than 20%
        require(_otcPriceTolerance <= MAX_OTC_PRICE_TOLERANCE, "C15");

        otcPriceTolerance = _otcPriceTolerance;

        emit SetOTCPriceTolerance(_otcPriceTolerance);
    }

    /**
     * @notice check if a user deposit puts the strategy above the cap
     * @dev reverts if a deposit amount puts strategy over the cap
     * @dev it is possible for the strategy to be over the cap from trading/hedging activities, but withdrawals are still allowed
     * @param _depositAmount the user deposit amount in ETH
     * @param _strategyCollateral the updated strategy collateral
     */
    function _checkStrategyCap(uint256 _depositAmount, uint256 _strategyCollateral) internal view {
        require(_strategyCollateral.add(_depositAmount) <= strategyCap, "C16");
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
        address _tokenIn,
        address _tokenOut,
        uint24 _fee,
        uint256 _amountToPay,
        bytes memory _callData,
        uint8 _callSource
    ) internal override {
        if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_DEPOSIT) {
            FlashDepositData memory data = abi.decode(_callData, (FlashDepositData));

            // convert WETH to ETH as Uniswap uses WETH
            IWETH9(weth).withdraw(IWETH9(weth).balanceOf(address(this)));

            // use user msg.value and unwrapped WETH from uniswap flash swap proceeds to deposit into strategy
            // will revert if data.totalDeposit is > eth balance in contract
            _deposit(_caller, data.totalDeposit, true);

            IUniswapV3Pool pool = _getPool(_tokenIn, _tokenOut, _fee);

            // repay the flash swap
            IWPowerPerp(wPowerPerp).transfer(address(pool), _amountToPay);

            emit FlashDepositCallback(_caller, _amountToPay, address(this).balance);

            // return excess eth to the user that was not needed for slippage
            if (address(this).balance > 0) {
                payable(_caller).sendValue(address(this).balance);
            }
        } else if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_WITHDRAW) {
            FlashWithdrawData memory data = abi.decode(_callData, (FlashWithdrawData));

            // use flash swap wSqueeth proceeds to withdraw ETH along with user crabAmount
            uint256 ethToWithdraw = _withdraw(
                _caller,
                data.crabAmount,
                IWPowerPerp(wPowerPerp).balanceOf(address(this)),
                true
            );

            IUniswapV3Pool pool = _getPool(_tokenIn, _tokenOut, _fee);

            // use some amount of withdrawn ETH to repay flash swap
            IWETH9(weth).deposit{value: _amountToPay}();
            IWETH9(weth).transfer(address(pool), _amountToPay);

            // excess ETH not used to repay flash swap is transferred to the user
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

    /**
     * @dev set nonce flag of the trader to true
     * @param _trader address of the signer
     * @param _nonce number that is to be traded only once
     */
    function _useNonce(address _trader, uint256 _nonce) internal {
        require(!nonces[_trader][_nonce], "C27");
        nonces[_trader][_nonce] = true;
    }

    /**
     * @dev view function to get the domain seperator used in signing
     */
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @dev check the signer and swap tokens in the order
     * @param _remainingAmount quantity the manager wants to trade
     * @param _clearingPrice the price at which all orders are traded
     * @param _order a signed order to swap tokens
     */
    function _execOrder(
        uint256 _remainingAmount,
        uint256 _clearingPrice,
        Order memory _order
    ) internal {
        // check that order beats clearing price
        if (_order.isBuying) {
            require(_clearingPrice <= _order.price, "C17");
        } else {
            require(_clearingPrice >= _order.price, "C18");
        }

        _useNonce(_order.trader, _order.nonce);
        bytes32 structHash = keccak256(
            abi.encode(
                _CRAB_BALANCE_TYPEHASH,
                _order.bidId,
                _order.trader,
                _order.quantity,
                _order.price,
                _order.isBuying,
                _order.expiry,
                _order.nonce
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);
        address offerSigner = ECDSA.recover(hash, _order.v, _order.r, _order.s);
        require(offerSigner == _order.trader, "C19");
        require(_order.expiry >= block.timestamp, "C20");

        // adjust quantity for partial fills
        if (_remainingAmount < _order.quantity) {
            _order.quantity = _remainingAmount;
        }
        // weth clearing price for the order
        uint256 wethAmount = _order.quantity.mul(_clearingPrice).div(ONE);

        if (_order.isBuying) {
            // trader sends weth and receives oSQTH
            IWETH9(weth).transferFrom(_order.trader, address(this), wethAmount);
            IWETH9(weth).withdraw(wethAmount);
            _mintWPowerPerp(_order.trader, _order.quantity, wethAmount, false);
        } else {
            // trader sends oSQTH and receives weth
            _burnWPowerPerp(_order.trader, _order.quantity, wethAmount, false);
            // wrap it
            IWETH9(weth).deposit{value: wethAmount}();
            IWETH9(weth).transfer(_order.trader, wethAmount);
        }

        emit HedgeOTCSingle(
            _order.trader, // market maker
            _order.bidId,
            _order.quantity, // order oSQTH quantity
            _order.price, // order price
            _order.isBuying, // order direction
            _clearingPrice // executed price for order
        );
    }

    /**
     * @dev hedge function to reduce delta using an array of signed orders
     * @param _totalQuantity quantity the manager wants to trade
     * @param _clearingPrice clearing price in weth
     * @param _isHedgeBuying direction of hedge trade
     * @param _orders an array of signed order to swap tokens
     */
    function hedgeOTC(
        uint256 _totalQuantity,
        uint256 _clearingPrice,
        bool _isHedgeBuying,
        Order[] memory _orders
    ) external onlyOwner afterInitialization {
        require(_clearingPrice > 0, "C21");
        require(_isTimeHedge() || _isPriceHedge(), "C22");
        _checkOTCPrice(_clearingPrice, _isHedgeBuying);

        timeAtLastHedge = block.timestamp;
        priceAtLastHedge = _clearingPrice;

        uint256 remainingAmount = _totalQuantity;
        uint256 prevPrice = _orders[0].price;
        uint256 currentPrice = _orders[0].price;
        bool isOrderBuying = _orders[0].isBuying;
        require(_isHedgeBuying != isOrderBuying, "C23");

        // iterate through order array and execute if valid
        for (uint256 i; i < _orders.length; ++i) {
            currentPrice = _orders[i].price;
            require(_orders[i].isBuying == isOrderBuying, "C24");
            if (_isHedgeBuying) {
                require(currentPrice >= prevPrice, "C25");
            } else {
                require(currentPrice <= prevPrice, "C25");
            }
            prevPrice = currentPrice;

            _execOrder(remainingAmount, _clearingPrice, _orders[i]);

            if (remainingAmount > _orders[i].quantity) {
                remainingAmount = remainingAmount.sub(_orders[i].quantity);
            } else {
                break;
            }
        }

        emit HedgeOTC(_orders[0].bidId, _totalQuantity, _isHedgeBuying, _clearingPrice);
    }

    /**
     * @notice check that the proposed sale price is within a tolerance of the current Uniswap twap
     * @param _price clearing price provided by manager
     * @param _isHedgeBuying is crab buying or selling oSQTH
     */
    function _checkOTCPrice(uint256 _price, bool _isHedgeBuying) internal view {
        // Get twap
        uint256 wSqueethEthPrice = IOracle(oracle).getTwap(ethWSqueethPool, wPowerPerp, weth, hedgingTwapPeriod, true);

        if (_isHedgeBuying) {
            require(
                _price <= wSqueethEthPrice.mul((ONE.add(otcPriceTolerance))).div(ONE),
                "Price too high relative to Uniswap twap."
            );
        } else {
            require(
                _price >= wSqueethEthPrice.mul((ONE.sub(otcPriceTolerance))).div(ONE),
                "Price too low relative to Uniswap twap."
            );
        }
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
        bool isShutdown = (_strategyDebtAmount == 0 && _strategyCollateralAmount == 0) && (totalSupply() != 0);
        require(!isShutdown, "C26");

        wSqueethToMint = _depositedAmount.wmul(_strategyDebtAmount).wdiv(
            _strategyCollateralAmount.add(_strategyDebtAmount.wmul(feeAdjustment))
        );

        uint256 fee = wSqueethToMint.wmul(feeAdjustment);

        return (wSqueethToMint, fee);
    }

    /**
     * @notice check if hedging based on time threshold is allowed
     * @return true if time hedging is allowed
     */
    function _isTimeHedge() internal view returns (bool) {
        return (block.timestamp >= timeAtLastHedge.add(hedgeTimeThreshold));
    }

    /**
     * @notice check if hedging based on price threshold is allowed
     * @return true if hedging is allowed
     */
    function _isPriceHedge() internal view returns (bool) {
        uint256 wSqueethEthPrice = IOracle(oracle).getTwap(ethWSqueethPool, wPowerPerp, weth, hedgingTwapPeriod, true);
        uint256 cachedRatio = wSqueethEthPrice.wdiv(priceAtLastHedge);
        uint256 priceThreshold = cachedRatio > ONE ? (cachedRatio).sub(ONE) : uint256(ONE).sub(cachedRatio);

        return priceThreshold >= hedgePriceThreshold;
    }

    /**
     * @notice check if hedging based on price threshold is allowed
     * @return true if hedging is allowed
     */
    function checkPriceHedge() external view returns (bool) {
        return _isPriceHedge();
    }

    /**
     * @notice check if hedging based on time threshold is allowed
     * @return true if hedging is allowed
     */
    function checkTimeHedge() external view returns (bool) {
        return _isTimeHedge();
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

        if (_crabTotalSupply != 0) return _crabTotalSupply.wmul(depositorShare).wdiv(uint256(ONE).sub(depositorShare));

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
}
