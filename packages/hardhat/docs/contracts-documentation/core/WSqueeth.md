# `WSqueeth`

this is the ERC20 contract for long position of Squeeth

this contract implements IWPowerPerp interface, makes it controllable by Controller.

decimals of squeeth is chosen as 14.

## Modifiers:

- `onlyController()`

## Functions:

- `decimals() (public)`

- `init(address _controller) (external)`

- `mint(address _account, uint256 _amount) (external)`

- `burn(address _account, uint256 _amount) (external)`

### Modifier `onlyController()`

### Function `decimals() → uint8 public`

override decimals with 14.

### Function `init(address _controller) external`

### Function `mint(address _account, uint256 _amount) external`

### Function `burn(address _account, uint256 _amount) external`
