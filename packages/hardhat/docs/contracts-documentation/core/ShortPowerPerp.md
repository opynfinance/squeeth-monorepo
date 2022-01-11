# `ShortPowerPerp`

ERC721 NFT representing ownership of a vault (short position)

## All Functions:

- `constructor(string _name, string _symbol)`

- `init(address _controller)`

- `mintNFT(address _recipient)`

# Functions

## `constructor(string _name, string _symbol)`

short power perpetual constructor

### Parameters:

- `string _name`: token name for ERC721

- `string _symbol`: token symbol for ERC721

## `init(address _controller)`

initialize short contract

### Parameters:

- `address _controller`: controller address

## `mintNFT(address _recipient) → uint256 tokenId`

mint new NFT

autoincrement tokenId starts at 1

### Parameters:

- `address _recipient`: recipient address for NFT
