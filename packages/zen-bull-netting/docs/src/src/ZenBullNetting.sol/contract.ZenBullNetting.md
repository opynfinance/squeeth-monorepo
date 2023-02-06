# ZenBullNetting
[Git Source](https://github.com/opynfinance/squeeth-monorepo/blob/334783aa87db73939fb00d5b133216b0033dfece/src/ZenBullNetting.sol)

**Inherits:**
Ownable, EIP712, [FlashSwap](/src/FlashSwap.sol/contract.FlashSwap.md)

**Author:**
Opyn team

Error codes
ZBN01: Auction TWAP is less than min value
ZBN02: OTC price tolerance is greater than max OTC tolerance price
ZBN03: Amount to queue for deposit is less than min amount
ZBN04: Can not dequeue deposited amount because auction is already live and force dequeued not activated
ZBN05: Amount of ETH to deposit left in the queue is less than min amount
ZBN06: Queued deposit is not longer than 1 week to force dequeue
ZBN07: Amount of ZenBull to queue for withdraw is less than min amount
ZBN08: Amount of ZenBull to withdraw left in the queue is less than min amount
ZBN09: Queued withdraw is not longer than 1 week to force dequeue
ZBN10: ETH quantity to net is less than queued for deposits
ZBN11: ZenBull quantity to net is less than queued for withdraws
ZBN12: ZenBull Price too high
ZBN13: ZenBull Price too low
ZBN14: Clearing price too high relative to Uniswap twap
ZBN15: Clearing price too low relative to Uniswap twap
ZBN16: Invalid order signer
ZBN17: Order already expired
ZBN18: Nonce already used
ZBN19: auction order is not selling
ZBN20: sell order price greater than clearing
ZBN21: auction order is not buying
ZBN22: buy order price greater than clearing
ZBN23: not enough buy orders for sqth
ZBN24: not authorized to perform netting at price

Contract for Netting Deposits and Withdrawals in ZenBull

*ZenBullNetting contract*


## State Variables
### _ZENBULL_NETTING_TYPEHASH
*typehash for signed orders*


```solidity
bytes32 private constant _ZENBULL_NETTING_TYPEHASH = keccak256(
    "Order(uint256 bidId,address trader,uint256 quantity,uint256 price,bool isBuying,uint256 expiry,uint256 nonce)"
);
```


### MAX_OTC_PRICE_TOLERANCE
*OTC price tolerance cannot exceed 20%*


```solidity
uint256 public constant MAX_OTC_PRICE_TOLERANCE = 2e17;
```


### MIN_AUCTION_TWAP
*min auction TWAP*


```solidity
uint32 public constant MIN_AUCTION_TWAP = 180 seconds;
```


### isAuctionLive
*owner sets to true when starting auction*


```solidity
bool public isAuctionLive;
```


### minEthAmount
*min ETH amounts to withdraw or deposit via netting*


```solidity
uint256 public minEthAmount;
```


### minZenBullAmount
*min ZenBull amounts to withdraw or deposit via netting*


```solidity
uint256 public minZenBullAmount;
```


### depositsIndex
*array index of last processed deposits*


```solidity
uint256 public depositsIndex;
```


### withdrawsIndex
*array index of last processed withdraws*


```solidity
uint256 public withdrawsIndex;
```


### otcPriceTolerance

```solidity
uint256 public otcPriceTolerance;
```


### auctionTwapPeriod
*twap period to use for auction calculations*


```solidity
uint32 public auctionTwapPeriod;
```


### weth
*WETH token address*


```solidity
address private immutable weth;
```


### oSqth
*oSQTH token address*


```solidity
address private immutable oSqth;
```


### usdc
*USDC token address*


```solidity
address private immutable usdc;
```


### zenBull
*ZenBull token address*


```solidity
address private immutable zenBull;
```


### oracle
*WPowerPerp Oracle address*


```solidity
address private immutable oracle;
```


### ethSqueethPool
*ETH/oSQTH uniswap v3 pool address*


```solidity
address private immutable ethSqueethPool;
```


### ethUsdcPool
*ETH/USDC uniswap v3 pool address*


```solidity
address private immutable ethUsdcPool;
```


### eulerLens
*Euler Simple Lens contract address*


```solidity
address private immutable eulerLens;
```


### crab
*crab strategy contract address*


```solidity
address private immutable crab;
```


### flashZenBull
*FlashZen contract address*


```solidity
address private immutable flashZenBull;
```


### bot
*bot address to automate netAtPrice() calls*


```solidity
address public bot;
```


### deposits
*array of ETH deposit receipts*


```solidity
Receipt[] public deposits;
```


### withdraws
*array of ZenBull withdrawal receipts*


```solidity
Receipt[] public withdraws;
```


### ethBalance
*ETH amount to deposit for an address*


```solidity
mapping(address => uint256) public ethBalance;
```


### zenBullBalance
*ZenBull amount to withdraw for an address*


```solidity
mapping(address => uint256) public zenBullBalance;
```


### userDepositsIndex
*indexes of deposit receipts of an address*


```solidity
mapping(address => uint256[]) public userDepositsIndex;
```


### userWithdrawsIndex
*indexes of withdraw receipts of an address*


```solidity
mapping(address => uint256[]) public userWithdrawsIndex;
```


### nonces
*store the used flag for a nonce for each address*


```solidity
mapping(address => mapping(uint256 => bool)) public nonces;
```


## Functions
### constructor


```solidity
constructor(address _zenBull, address _eulerSimpleLens, address _flashZenBull, address _uniFactory)
    EIP712("ZenBullNetting", "1")
    FlashSwap(_uniFactory);
```

### receive

receive function to allow ETH transfer to this contract


```solidity
receive() external payable;
```

### DOMAIN_SEPARATOR

*view function to get the domain seperator used in signing*


```solidity
function DOMAIN_SEPARATOR() external view returns (bytes32);
```

### toggleAuctionLive

*toggles the value of isAuctionLive*


```solidity
function toggleAuctionLive() external onlyOwner;
```

### setMinEthAmount

set min ETH amount


```solidity
function setMinEthAmount(uint256 _amount) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_amount`|`uint256`|the amount to be set as minEthAmount|


### setMinZenBullAmount

set minZenBullAmount


```solidity
function setMinZenBullAmount(uint256 _amount) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_amount`|`uint256`|the number to be set as minZenBullAmount|


### setDepositsIndex

set the depositIndex so that we want to skip processing some deposits


```solidity
function setDepositsIndex(uint256 _newDepositsIndex) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newDepositsIndex`|`uint256`|the new deposits index|


### setWithdrawsIndex

set the withdraw index so that we want to skip processing some withdraws


```solidity
function setWithdrawsIndex(uint256 _newWithdrawsIndex) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_newWithdrawsIndex`|`uint256`|the new withdraw index|


### setAuctionTwapPeriod

owner can set the twap period in seconds that is used for obtaining TWAP prices


```solidity
function setAuctionTwapPeriod(uint32 _auctionTwapPeriod) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_auctionTwapPeriod`|`uint32`|the twap period, in seconds|


### setOTCPriceTolerance

owner can set a threshold, scaled by 1e18 that determines the maximum discount of a clearing sale price to the current uniswap twap price


```solidity
function setOTCPriceTolerance(uint256 _otcPriceTolerance) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_otcPriceTolerance`|`uint256`|the OTC price tolerance, in percent, scaled by 1e18|


### setBot

set bot address


```solidity
function setBot(address _bot) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_bot`|`address`|bot address|


### cancelNonce

*cancel nonce by marking it as used*


```solidity
function cancelNonce(uint256 _nonce) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_nonce`|`uint256`|nonce to cancel|


### queueEth

queue ETH for deposit into ZenBull

*payable function*


```solidity
function queueEth() external payable;
```

### dequeueEth

withdraw ETH from queue


```solidity
function dequeueEth(uint256 _amount, bool _force) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_amount`|`uint256`|ETH amount to dequeue|
|`_force`|`bool`|forceWithdraw if deposited more than a week ago|


### queueZenBull

queue ZenBull token for withdraw from strategy


```solidity
function queueZenBull(uint256 _amount) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_amount`|`uint256`|ZenBull amount to withdraw|


### dequeueZenBull

withdraw ZenBull from queue


```solidity
function dequeueZenBull(uint256 _amount, bool _force) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_amount`|`uint256`|ZenBull amount to dequeue|
|`_force`|`bool`|forceWithdraw if queued more than a week ago|


### netAtPrice

swaps quantity amount of ETH for ZenBull token at ZenBull/ETH price


```solidity
function netAtPrice(uint256 _price, uint256 _quantity) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_price`|`uint256`|price of ZenBull in ETH|
|`_quantity`|`uint256`|amount of ETH to net|


### depositAuction

auction for queued deposits

*takes in orders from MM's to buy oSQTH*


```solidity
function depositAuction(DepositAuctionParams calldata _params) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_params`|`DepositAuctionParams`|deposit Params|


### withdrawAuction

auction for queued withdraws

*takes in orders from MM's to sell oSQTH*


```solidity
function withdrawAuction(WithdrawAuctionParams calldata _params) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_params`|`WithdrawAuctionParams`|withdraw Params|


### _uniFlashSwap

*to handle uniswap flashswap callback*


```solidity
function _uniFlashSwap(address pool, uint256 amountToPay, bytes memory callData, uint8 callSource) internal override;
```

### _queueEth

*queue ETH for deposit into ZenBull*


```solidity
function _queueEth() internal;
```

### depositsQueued

get the sum of queued ETH


```solidity
function depositsQueued() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|sum ETH amount in queue|


### getDepositReceipt

get a deposit receipt by index


```solidity
function getDepositReceipt(uint256 _index) external view returns (address, uint256, uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_index`|`uint256`|deposit index in deposits array|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|receipt sender, amount and timestamp|
|`<none>`|`uint256`||
|`<none>`|`uint256`||


### withdrawsQueued

get the sum of queued ZenBull


```solidity
function withdrawsQueued() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|sum ZenBull amount in queue|


### getWithdrawReceipt

get a withdraw receipt by index


```solidity
function getWithdrawReceipt(uint256 _index) external view returns (address, uint256, uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_index`|`uint256`|withdraw index in withdraws array|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|receipt sender, amount and timestamp|
|`<none>`|`uint256`||
|`<none>`|`uint256`||


### checkOrder

checks the expiry nonce and signer of an order


```solidity
function checkOrder(Order memory _order) external view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_order`|`Order`|Order struct|


### _useNonce

*set nonce flag of the trader to true*


```solidity
function _useNonce(address _trader, uint256 _nonce) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_trader`|`address`|address of the signer|
|`_nonce`|`uint256`|number that is to be traded only once|


### _getZenBullPrice

*get ZenBull token price using uniswap TWAP*


```solidity
function _getZenBullPrice() internal view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|ZenBull price|


### _checkOTCPrice

check that the proposed sale price is within a tolerance of the current Uniswap twap


```solidity
function _checkOTCPrice(uint256 _price, bool _isAuctionBuying) internal view;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_price`|`uint256`|clearing price provided by manager|
|`_isAuctionBuying`|`bool`|is auction buying or selling oSQTH|


### _checkOrder

*checks the expiry nonce and signer of an order*


```solidity
function _checkOrder(Order memory _order) internal view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_order`|`Order`|Order struct|


## Events
### SetMinZenBullAmount

```solidity
event SetMinZenBullAmount(uint256 oldAmount, uint256 newAmount);
```

### SetMinEthAmount

```solidity
event SetMinEthAmount(uint256 oldAmount, uint256 newAmount);
```

### SetDepositsIndex

```solidity
event SetDepositsIndex(uint256 oldDepositsIndex, uint256 newDepositsIndex);
```

### SetWithdrawsIndex

```solidity
event SetWithdrawsIndex(uint256 oldWithdrawsIndex, uint256 newWithdrawsIndex);
```

### SetAuctionTwapPeriod

```solidity
event SetAuctionTwapPeriod(uint32 previousTwap, uint32 newTwap);
```

### SetOTCPriceTolerance

```solidity
event SetOTCPriceTolerance(uint256 previousTolerance, uint256 newOtcPriceTolerance);
```

### ToggledAuctionLive

```solidity
event ToggledAuctionLive(bool isAuctionLive);
```

### QueueEth

```solidity
event QueueEth(address indexed depositor, uint256 amount, uint256 depositorsBalance, uint256 indexed receiptIndex);
```

### DequeueEth

```solidity
event DequeueEth(address indexed depositor, uint256 amount, uint256 depositorsBalance);
```

### QueueZenBull

```solidity
event QueueZenBull(
    address indexed withdrawer, uint256 amount, uint256 withdrawersBalance, uint256 indexed receiptIndex
);
```

### DequeueZenBull

```solidity
event DequeueZenBull(address indexed withdrawer, uint256 amount, uint256 withdrawersBalance);
```

### NetAtPrice

```solidity
event NetAtPrice(
    bool indexed isDeposit,
    address indexed receiver,
    uint256 amountQueuedProcessed,
    uint256 amountReceived,
    uint256 indexed index
);
```

### EthDeposited

```solidity
event EthDeposited(
    address indexed depositor,
    uint256 ethAmount,
    uint256 zenBullAmount,
    uint256 indexed receiptIndex,
    uint256 refundedETH
);
```

### ZenBullWithdrawn

```solidity
event ZenBullWithdrawn(
    address indexed withdrawer, uint256 zenBullAmount, uint256 ethAmount, uint256 indexed receiptIndex
);
```

### SetBot

```solidity
event SetBot(address bot);
```

### DepositAuction

```solidity
event DepositAuction(
    uint256 wethDeposited, uint256 crabAmount, uint256 clearingPrice, uint256 oSqthAmount, uint256 depositsIndex
);
```

### WithdrawAuction

```solidity
event WithdrawAuction(uint256 zenBullWithdrawn, uint256 clearingPrice, uint256 oSqthAmount, uint256 withdrawsIndex);
```

### CancelNonce

```solidity
event CancelNonce(address trader, uint256 nonce);
```

### TransferWethFromMarketMakers
*shared events with the NettingLib for client side to detect them*


```solidity
event TransferWethFromMarketMakers(address indexed trader, uint256 quantity, uint256 wethAmount, uint256 clearingPrice);
```

### TransferOsqthToMarketMakers

```solidity
event TransferOsqthToMarketMakers(
    address indexed trader, uint256 bidId, uint256 quantity, uint256 remainingOsqthBalance
);
```

### TransferOsqthFromMarketMakers

```solidity
event TransferOsqthFromMarketMakers(address indexed trader, uint256 quantity, uint256 oSqthRemaining);
```

### TransferWethToMarketMaker

```solidity
event TransferWethToMarketMaker(
    address indexed trader,
    uint256 bidId,
    uint256 quantity,
    uint256 wethAmount,
    uint256 oSqthRemaining,
    uint256 clearingPrice
);
```

## Structs
### Order
*order struct for a signed order from market maker*


```solidity
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
```

### Receipt
*receipt used to store deposits and withdraws*


```solidity
struct Receipt {
    address sender;
    uint256 amount;
    uint256 timestamp;
}
```

### DepositAuctionParams

```solidity
struct DepositAuctionParams {
    uint256 depositsToProcess;
    uint256 crabAmount;
    Order[] orders;
    uint256 clearingPrice;
    uint256 flashDepositEthToCrab;
    uint256 flashDepositMinEthFromSqth;
    uint256 flashDepositMinEthFromUsdc;
    uint24 flashDepositWPowerPerpPoolFee;
    uint24 wethUsdcPoolFee;
}
```

### WithdrawAuctionParams
*params for withdraw auction*


```solidity
struct WithdrawAuctionParams {
    uint256 withdrawsToProcess;
    Order[] orders;
    uint256 clearingPrice;
    uint256 maxWethForUsdc;
    uint24 wethUsdcPoolFee;
}
```

### MemoryVar
*struct to store proportional amounts of erc20s (received or to send)*


```solidity
struct MemoryVar {
    uint256 currentZenBullBalance;
    uint256 remainingEth;
    uint256 remainingDeposits;
    uint256 oSqthBalance;
}
```

