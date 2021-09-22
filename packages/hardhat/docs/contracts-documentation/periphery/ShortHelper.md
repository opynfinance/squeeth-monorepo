# `ShortHelper`

## Functions:

- `constructor(address _controllerAddr, address _swapRouter, address _wethAddr) (public)`

- `openShort(uint256 _vaultId, uint128 _shortSqueethAmount, uint256 _uniNftId, struct ISwapRouter.ExactInputSingleParams _exactInputParams) (external)`

- `closeShort(uint256 _vaultId, uint256 _removeShortAmount, uint128 _withdrawAmount, struct ISwapRouter.ExactOutputSingleParams _exactOutputParams) (external)`

- `receive() (external)`

### Function `constructor(address _controllerAddr, address _swapRouter, address _wethAddr) public`

### Function `openShort(uint256 _vaultId, uint128 _shortSqueethAmount, uint256 _uniNftId, struct ISwapRouter.ExactInputSingleParams _exactInputParams) external`

mint squeeth, trade with uniswap and send back premium in eth.

### Function `closeShort(uint256 _vaultId, uint256 _removeShortAmount, uint128 _withdrawAmount, struct ISwapRouter.ExactOutputSingleParams _exactOutputParams) external`

buy back some squeeth and close the position.

### Function `receive() external`

only receive eth from weth contract and controller.
