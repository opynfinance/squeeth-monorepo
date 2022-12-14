# BULL VAULT

## Table of Contents

- [BULL VAULT](#bull-vault)
  - [Table of Contents](#table-of-contents)
  - [Local Development](#local-development)
  - [How To Deploy](#how-to-deploy)
  - [Contracts Architecture](#contracts-architecture)
  - [Audits](#audits)
  - [License](#license)

## Local Development

To install dependencies and compile contracts:

```bash
git clone https://github.com/opynfinance/squeeth-monorepo && cd packages/bull-vault
```

To install Foundry (assuming a Linux or macOS system):

```bash
curl -L https://foundry.paradigm.xyz | bash
```

This will download foundryup. To start Foundry, run:

```bash
foundryup
```

To install dependencies:

```
forge install
```

<!-- There are three Foundry profiles for running the test suites, which bypass the IR pipeline to speed up compilation. To run tests, run any of the following: -->

```bash
FOUNDRY_PROFILE=test forge test # run only test functions
FOUNDRY_PROFILE=fuzz forge test # run only fuz testing (function with name that include "Fuzzing")
FOUNDRY_PROFILE=coverage forge coverage # coverage report
```

To run tests, you need to create `.env` file with the variables included in `.env.example`.

You may wish to include a `.env` file that `export`s a specific profile when developing locally.

The following modifiers are also available:

- Level 2 (-vv): Logs emitted during tests are also displayed.
- Level 3 (-vvv): Stack traces for failing tests are also displayed.
- Level 4 (-vvvv): Stack traces for all tests are displayed, and setup traces for failing tests are displayed.
- Level 5 (-vvvvv): Stack traces and setup traces are always displayed.

```bash
FOUNDRY_PROFILE=test forge test forge test  -vvvv
```

For more information on foundry testing and use, see [Foundry Book installation instructions](https://book.getfoundry.sh/getting-started/installation.html).

## How To Deploy

Before running the deployment script, make sure to copy `.env.example` in a `.env` file and set the environment variables.

The deployment script for [Mainnet](/packages/bull-vault/script/MainnetDeploy.s.sol) and [Goerli](/packages/bull-vault/script/GoerliDeploy.s.sol) can be executed using the below command:
```shell
$ source .env
$ forge script script/MainnetDeploy.s.sol:MainnetDeploy --rpc-url $MAINNET_RPC_URL --broadcast --verify -vvvv
```

## SCRIPTS

### ADD LIQUIDITY IN EULER MARKET

Make sure to add the env vars `SCRIPT_USER_PK` and `UNDERLYING_AMOUNT` in the `.env` file.

To add USDC liquidity:
```shell
$ source .env

# for USDC 
$ forge script script/GoerliAddUsdcLiquidityEuler.s.sol:GoerliAddUsdcLiquidityEuler --rpc-url $GOERLI_RPC_URL --broadcast --verify -vvvv

# for WETH
$ forge script script/GoerliAddWethLiquidityEuler.s.sol:GoerliAddWethLiquidityEuler --rpc-url $GOERLI_RPC_URL --broadcast --verify -vvvv
```

To add liquidity for asset other than WETH or USDC, create a new script following the `GoerliAddUsdcLiquidityEuler` pattern. 

## Audits

## License
