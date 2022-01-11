# `WPowerPerp`

ERC20 Token representing wrapped long power perpetual position

value of power perpetual is expected to go down over time through the impact of funding

## All Functions:

- `constructor(string _name, string _symbol)`

- `init(address _controller)`

- `mint(address _account, uint256 _amount)`

- `burn(address _account, uint256 _amount)`

# Functions

## `constructor(string _name, string _symbol)`

long power perpetual constructor

### Parameters:

- `string _name`: token name for ERC20

- `string _symbol`: token symbol for ERC20

## `init(address _controller)`

init wPowerPerp contract

### Parameters:

- `address _controller`: controller address

## `mint(address _account, uint256 _amount)`

mint wPowerPerp

### Parameters:

- `address _account`: account to mint to

- `uint256 _amount`: amount to mint

## `burn(address _account, uint256 _amount)`

burn wPowerPerp

### Parameters:

- `address _account`: account to burn from

- `uint256 _amount`: amount to burn
