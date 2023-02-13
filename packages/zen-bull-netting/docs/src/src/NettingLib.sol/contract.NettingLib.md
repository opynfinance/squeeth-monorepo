# NettingLib
[Git Source](https://github.com/opynfinance/squeeth-monorepo/blob/334783aa87db73939fb00d5b133216b0033dfece/src/NettingLib.sol)


## Functions
### transferWethFromMarketMakers

transfer WETH from market maker to netting contract

*this is executed during the deposit auction, MM buying OSQTH for WETH*


```solidity
function transferWethFromMarketMakers(
    address _weth,
    address _trader,
    uint256 _quantity,
    uint256 _oSqthToMint,
    uint256 _clearingPrice
) external returns (bool, uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_weth`|`address`|WETH address|
|`_trader`|`address`|market maker address|
|`_quantity`|`uint256`|oSQTH quantity|
|`_oSqthToMint`|`uint256`|remaining amount of the total oSqthToMint|
|`_clearingPrice`|`uint256`|auction clearing price|


### transferOsqthToMarketMakers

transfer oSQTH to market maker

*this is executed during the deposit auction, MM buying OSQTH for WETH*


```solidity
function transferOsqthToMarketMakers(
    address _oSqth,
    address _trader,
    uint256 _bidId,
    uint256 _oSqthBalance,
    uint256 _quantity
) external returns (bool, uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_oSqth`|`address`|oSQTH address|
|`_trader`|`address`|market maker address|
|`_bidId`|`uint256`|MM's bid ID|
|`_oSqthBalance`|`uint256`|remaining netting contracts's oSQTH balance|
|`_quantity`|`uint256`|oSQTH quantity in market maker order|


### transferOsqthFromMarketMakers

transfer oSQTH from market maker

*this is executed during the withdraw auction, MM selling OSQTH for WETH*


```solidity
function transferOsqthFromMarketMakers(
    address _oSqth,
    address _trader,
    uint256 _remainingOsqthToPull,
    uint256 _quantity
) internal returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_oSqth`|`address`|oSQTH address|
|`_trader`|`address`|market maker address|
|`_remainingOsqthToPull`|`uint256`|remaining amount of oSQTH from the total oSQTH amount to transfer from order array|
|`_quantity`|`uint256`|oSQTH quantity in market maker order|


### transferWethToMarketMaker

transfer WETH to market maker

*this is executed during the withdraw auction, MM selling OSQTH for WETH*


```solidity
function transferWethToMarketMaker(
    address _weth,
    address _trader,
    uint256 _bidId,
    uint256 _remainingOsqthToPull,
    uint256 _quantity,
    uint256 _clearingPrice
) external returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_weth`|`address`|WETH address|
|`_trader`|`address`|market maker address|
|`_bidId`|`uint256`|market maker bid ID|
|`_remainingOsqthToPull`|`uint256`|total oSQTH to get from orders array|
|`_quantity`|`uint256`|market maker's oSQTH order quantity|
|`_clearingPrice`|`uint256`|auction clearing price|


### getCrabPrice

get _crab token price


```solidity
function getCrabPrice(
    address _oracle,
    address _crab,
    address _ethUsdcPool,
    address _ethSqueethPool,
    address _oSqth,
    address _usdc,
    address _weth,
    address _zenBull,
    uint32 _auctionTwapPeriod
) external view returns (uint256, uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_oracle`|`address`|oracle address|
|`_crab`|`address`|crab token address|
|`_ethUsdcPool`|`address`|ETH/USDC Uni v3 pool address|
|`_ethSqueethPool`|`address`|ETH/oSQTH Uni v3 pool address|
|`_oSqth`|`address`|oSQTH address|
|`_usdc`|`address`|USDC address|
|`_weth`|`address`|WETH address|
|`_zenBull`|`address`|ZenBull strategy address|
|`_auctionTwapPeriod`|`uint32`|auction TWAP|


### getZenBullPrice

get ZenBull token price


```solidity
function getZenBullPrice(
    address _zenBull,
    address _eulerLens,
    address _usdc,
    address _weth,
    uint256 _crabFairPriceInEth,
    uint256 _ethUsdcPrice
) external view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_zenBull`|`address`|ZenBull token address|
|`_eulerLens`|`address`|EulerSimpleLens contract address|
|`_usdc`|`address`|USDC address|
|`_weth`|`address`|WETH address|
|`_crabFairPriceInEth`|`uint256`|Crab token price|
|`_ethUsdcPrice`|`uint256`|ETH/USDC price|


### estimateOsqthToMintAndEthIntoCrab

calculate oSQTH to mint and amount of eth to deposit into Crab v2 based on amount of crab token


```solidity
function estimateOsqthToMintAndEthIntoCrab(address _crab, address _zenBull, uint256 _crabAmount)
    external
    view
    returns (uint256, uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_crab`|`address`|crab strategy address|
|`_zenBull`|`address`|ZenBull strategy address|
|`_crabAmount`|`uint256`|amount of crab token|


### calcWethToLendAndUsdcToBorrow

calculate amount of WETH to lend in and USDC to borrow from Euler


```solidity
function calcWethToLendAndUsdcToBorrow(
    address _eulerLens,
    address _zenBull,
    address _weth,
    address _usdc,
    uint256 _crabAmount
) external view returns (uint256, uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_eulerLens`|`address`|EulerSimpleLens contract address|
|`_zenBull`|`address`|ZenBull strategy address|
|`_weth`|`address`|WETH address|
|`_usdc`|`address`|USDC address|
|`_crabAmount`|`uint256`|amount of crab token|


### calcOsqthAmount

calculate amount of oSQTH to get based on amount of ZenBull to Withdraw


```solidity
function calcOsqthAmount(address _zenBull, address _crab, uint256 _withdrawsToProcess)
    external
    view
    returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_zenBull`|`address`|ZenBull strategy address|
|`_crab`|`address`|crab strategy address|
|`_withdrawsToProcess`|`uint256`|amount of ZenBull token to withdraw|


### mul


```solidity
function mul(uint256 _x, uint256 _y) internal pure returns (uint256);
```

### div


```solidity
function div(uint256 _x, uint256 _y) internal pure returns (uint256);
```

## Events
### TransferWethFromMarketMakers

```solidity
event TransferWethFromMarketMakers(
    address indexed trader, uint256 quantity, uint256 wethAmount, uint256 remainingOsqthBalance, uint256 clearingPrice
);
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

