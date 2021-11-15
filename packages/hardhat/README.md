# Squeeth Contracts

[![Coverage Status](https://coveralls.io/repos/github/opynfinance/squeeth-monorepo/badge.svg?t=XrsOxo)](https://coveralls.io/github/opynfinance/squeeth-monorepo) [![CircleCI](https://circleci.com/gh/opynfinance/squeeth-monorepo/tree/master.svg?style=svg&circle-token=5d9ceb617a91160d922e21209489eb3060f326a3)](https://circleci.com/gh/opynfinance/squeeth-monorepo/tree/master)

Here you can find all the contracts that is related to squeeth. To read auto-generated contract doc, you can go to `/docs/contracts-documentation`. 
For a more comprehensive documentation about how the system works together, we suggest visiting our [GitBook page](https://app.gitbook.com/invite/-LufZJ5ZhQjPzA36K4pN/5P9fhUvlTZOdOQZy68Jr)  

# Running this Project

This project is developed with the **hardhat** framework, which means you can run the following commands directly through `npx hardhat` if you want to be flexible.

## Setting environments

### Mnemonic seed phrase

Some commands (like `deploy`) need a mnemonic seed phrase specified as the tx sender. This will require you to have a `mnemonic.txt` file at the root of this folder, containing the mnemonic seed phrase you want to use to sign the transactions.

### Environment variables

To deploy contract on testnet or mainnet, you will need to provide a infura key to connect to a infura provider. You can do this easily by changing the `.env.example` file and specify your keys there.

The `ETHERSCAN_KEY` is useful to verify contracts through command, and the `GAS_REPORT` boolean is something you can turn on to run tests with gas consumption report

## Useful scripts

### Compile

```shell
yarn compile
```

### Test

run test with default hardhat network

```shell
yarn test

# run a specific test or on a different network
npx hardhat test test/unit-tests/controller.ts --network localhost

```

### Run Coverage test

A coverage report will be available at `/coverage/index.html` after running the following command:

```shell
yarn coverage
```

### Deploy

to start deployment on the hardhat localhost network.
```shell
# start the local chain
yarn chain

# deploy on local chain
yarn deploy
```

to deploying on testnet, with INFURA_KEY specified as environment variable

```shell
npx hardhat deploy --network ropsten
```

### Lint

```shell
yarn lint
```