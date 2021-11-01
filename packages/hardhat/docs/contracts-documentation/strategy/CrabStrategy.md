# `CrabStrategy`

Contract for Crab strategy

CrabStrategy contract

## All Functions:

- `constructor(address _wSqueethController, address _oracle, address _weth, address _uniswapFactory, address _ethWSqueethPool, uint256 _hedgeTimeThreshold, uint256 _hedgePriceThreshold, uint256 _auctionTime, uint256 _minPriceMultiplier, uint256 _maxPriceMultiplier)`

- `receive()`

- `flashDeposit(uint256 _ethToDeposit, uint256 _ethToBorrow)`

- `flashWithdraw(uint256 _crabAmount, uint256 _maxEthToPay)`

- `deposit()`

- `withdraw(uint256 _crabAmount, uint256 _wSqueethAmount)`

- `timeHedgeOnUniswap()`

- `priceHedgeOnUniswap(uint256 _auctionTriggerTime)`

- `timeHedge(bool _isStrategySellingWSqueeth, uint256 _limitPrice)`

- `priceHedge(uint256 _auctionTriggerTime, bool _isStrategySellingWSqueeth, uint256 _limitPrice)`

- `checkPriceHedge(uint256 _auctionTriggerTime)`

- `checkTimeHedge()`

- `getWsqueethFromCrabAmount(uint256 _crabAmount)`

## All Events:

- `Deposit(address depositor, uint256 wSqueethAmount, uint256 lpAmount)`

- `Withdraw(address withdrawer, uint256 crabAmount, uint256 wSqueethAmount, uint256 ethWithdrawn)`

- `FlashDeposit(address depositor, uint256 depositedAmount, uint256 borrowedAmount, uint256 totalDepositedAmount, uint256 tradedAmountOut)`

- `FlashWithdraw(address withdrawer, uint256 crabAmount, uint256 wSqueethAmount)`

- `TimeHedgeOnUniswap(address hedger, uint256 hedgeTimestamp, uint256 auctionTriggerTimestamp)`

- `PriceHedgeOnUniswap(address hedger, uint256 hedgeTimestamp, uint256 auctionTriggerTimestamp)`

- `TimeHedge(address hedger, bool auctionType, uint256 hedgerPrice, uint256 auctionTriggerTimestamp)`

- `PriceHedge(address hedger, bool auctionType, uint256 hedgerPrice, uint256 auctionTriggerTimestamp)`

- `Hedge(address hedger, bool auctionType, uint256 hedgerPrice, uint256 auctionPrice, uint256 wSqueethHedgeTargetAmount, uint256 ethHedgetargetAmount)`

- `HedgeOnUniswap(address hedger, bool auctionType, uint256 auctionPrice, uint256 wSqueethHedgeTargetAmount, uint256 ethHedgetargetAmount)`

- `ExecuteSellAuction(address buyer, uint256 wSqueethSold, uint256 ethBought, bool isHedgingOnUniswap)`

- `ExecuteBuyAuction(address seller, uint256 wSqueethBought, uint256 ethSold, bool isHedgingOnUniswap)`

# Functions

## `constructor(address _wSqueethController, address _oracle, address _weth, address _uniswapFactory, address _ethWSqueethPool, uint256 _hedgeTimeThreshold, uint256 _hedgePriceThreshold, uint256 _auctionTime, uint256 _minPriceMultiplier, uint256 _maxPriceMultiplier)`

strategy constructor

this will open a vault in the power token contract and store the vault ID

### Parameters:

- `address _wSqueethController`: power token controller address

- `address _oracle`: oracle address

- `address _weth`: weth address

- `address _uniswapFactory`: uniswap factory address

- `address _ethWSqueethPool`: eth:wSqueeth uniswap pool address

- `uint256 _hedgeTimeThreshold`: hedge time threshold (seconds)

- `uint256 _hedgePriceThreshold`: hedge price threshold (0.1*1e18 = 10%)

- `uint256 _auctionTime`: auction duration (seconds)

- `uint256 _minPriceMultiplier`: minimum auction price multiplier (0.9*1e18 = min auction price is 90% of twap)

- `uint256 _maxPriceMultiplier`: maximum auction price multiplier (1.1*1e18 = max auction price is 110% of twap)

## `receive()`

receive function to allow ETH transfer to this contract

## `flashDeposit(uint256 _ethToDeposit, uint256 _ethToBorrow)`

flash deposit into strategy

this function sells minted WSqueeth for _ethToBorrow

### Parameters:

- `uint256 _ethToDeposit`: ETH sent from depositor

- `uint256 _ethToBorrow`: ETH to flashswap on uniswap

## `flashWithdraw(uint256 _crabAmount, uint256 _maxEthToPay)`

flash withdraw from strategy

this function will borrow wSqueeth amount and repay for selling some of the ETH collateral

### Parameters:

- `uint256 _crabAmount`: crab token amount to burn

- `uint256 _maxEthToPay`: maximum ETH to pay

## `deposit() → uint256, uint256`

deposit ETH into strategy

provide eth, return wSqueeth and strategy token

### Return Values:

- `` wSqueethToMint minted amount of wSqueeth

- `` depositorCrabAmount minted amount of strategy token

## `withdraw(uint256 _crabAmount, uint256 _wSqueethAmount)`

withdraw WETH from strategy

provide strategy tokens and wSqueeth, returns eth

### Parameters:

- `uint256 _crabAmount`: amount of crab token to burn

- `uint256 _wSqueethAmount`: amount of wSqueeth to burn

## `timeHedgeOnUniswap()`

hedge startegy based on time threshold with uniswap arbing

## `priceHedgeOnUniswap(uint256 _auctionTriggerTime)`

hedge startegy based on price threshold with uniswap arbing

## `timeHedge(bool _isStrategySellingWSqueeth, uint256 _limitPrice)`

strategy hedging based on time threshold

need to attach msg.value if buying WSqueeth

### Parameters:

- `bool _isStrategySellingWSqueeth`: sell or buy auction, true for sell auction

- `uint256 _limitPrice`: hedger limit auction price, should be the max price when auction is sell auction, min price when it is a buy auction

## `priceHedge(uint256 _auctionTriggerTime, bool _isStrategySellingWSqueeth, uint256 _limitPrice)`

strategy hedging based on price threshold

need to attach msg.value if buying WSqueeth

### Parameters:

- `uint256 _auctionTriggerTime`: timestamp where auction started

## `checkPriceHedge(uint256 _auctionTriggerTime) → bool`

check if hedging based on price threshold is allowed

### Parameters:

- `uint256 _auctionTriggerTime`: alleged timestamp where auction was triggered

### Return Values:

- `uint256` true if hedging is allowed

## `checkTimeHedge() → bool, uint256`

check if hedging based on time threshold is allowed

### Return Values:

- `` isTimeHedgeAllowed true if hedging is allowed

- `` auctionTriggertime auction trigger timestamp

## `getWsqueethFromCrabAmount(uint256 _crabAmount) → uint256`

get wSqueeth debt amount associated with crab token amount

_crabAmount strategy token amount

### Return Values:

- `uint256` wSqueeth amount
