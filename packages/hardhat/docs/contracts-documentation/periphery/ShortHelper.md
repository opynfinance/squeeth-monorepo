# `ShortHelper`

contract simplifies opening a short wPowerPerp position by selling wPowerPerp on uniswap v3 and returning eth to user

## All Functions:

- `constructor(address _controllerAddr, address _swapRouter, address _wethAddr)`

- `openShort(uint256 _vaultId, uint128 _powerPerpAmount, uint256 _uniNftId, struct ISwapRouter.ExactInputSingleParams _exactInputParams)`

- `closeShort(uint256 _vaultId, uint256 _wPowerPerpAmount, uint128 _withdrawAmount, struct ISwapRouter.ExactOutputSingleParams _exactOutputParams)`

- `receive()`

# Functions

## `constructor(address _controllerAddr, address _swapRouter, address _wethAddr)`

constructor for short helper

### Parameters:

- `address _controllerAddr`: controller address for wPowerPerp

- `address _swapRouter`: uniswap v3 swap router address

- `address _wethAddr`: weth address

## `openShort(uint256 _vaultId, uint128 _powerPerpAmount, uint256 _uniNftId, struct ISwapRouter.ExactInputSingleParams _exactInputParams)`

mint power perp, trade with uniswap v3 and send back premium in eth

### Parameters:

- `uint256 _vaultId`: short wPowerPerp vault id

- `uint128 _powerPerpAmount`: amount of powerPerp to mint/sell

- `uint256 _uniNftId`: uniswap v3 position token id

## `closeShort(uint256 _vaultId, uint256 _wPowerPerpAmount, uint128 _withdrawAmount, struct ISwapRouter.ExactOutputSingleParams _exactOutputParams)`

buy back wPowerPerp with eth on uniswap v3 and close position

### Parameters:

- `uint256 _vaultId`: short wPowerPerp vault id

- `uint256 _wPowerPerpAmount`: amount of wPowerPerp to mint/sell

- `uint128 _withdrawAmount`: amount to withdraw

## `receive()`

only receive eth from weth contract and controller.
