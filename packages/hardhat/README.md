# Squeeth Contracts

[![Coverage Status](https://coveralls.io/repos/github/opynfinance/squeeth-monorepo/badge.svg?t=XrsOxo)](https://coveralls.io/github/opynfinance/squeeth-monorepo) [![CircleCI](https://circleci.com/gh/opynfinance/squeeth-monorepo/tree/master.svg?style=svg&circle-token=5d9ceb617a91160d922e21209489eb3060f326a3)](https://circleci.com/gh/opynfinance/squeeth-monorepo/tree/master)

Here you can find all the contracts that is related to squeeth. To read auto-generated contract doc, you can go to `/docs/contracts-documentation`. 
For a more comprehensive documentation about how the system works together, we suggest visiting our [GitBook page](https://opyn.gitbook.io/squeeth/)  

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

# Run E2E test
ALCHEMY_KEY=XXXX yarn test:e2e
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

## Licensing

The primary license for Squeeth V1 Core is the Business Source License 1.1 (`BUSL-1.1`), see [`LICENSE_BUSL`](./LICENSE_BUSL).

### Exceptions
- Some files in `contracts/core/` are licensed under `GPL-2.0-or-later` (as indicated in their SPDX headers), see [`contracts/core/LICENSE_GPL_3`](./contracts/core/LICENSE_GPL_3)
- Some files in `contracts/external/` are licensed under `GPL-3.0-or-later` (as indicated in their SPDX headers), see [`contracts/external/LICENSE_GPL_3`](./contracts/external/LICENSE_GNU)
- All files in `contracts/interfaces/` are licensed under `MIT` (as indicated in their SPDX headers), see [`contracts/interfaces/LICENSE_MIT`](./contracts/interfaces/LICENSE_MIT)
- Some files in `contracts/libs/` are licensed under `GPL-2.0-or-later` (as indicated in their SPDX headers), see [`contracts/libs/LICENSE_GPL_3`](./contracts/libraries/LICENSE_GPL_3)
- Some files in `contracts/libs/` are licensed under `MIT` (as indicated in their SPDX headers), see [`contracts/libs/LICENSE_MIT`](./contracts/libs/LICENSE_MIT)
- Some files in `contracts/libs/` are licensed under `BSD-4-Clause` (as indicated in their SPDX headers), see [`contracts/libs/LICENSE_BSD`](./contracts/libs/LICENSE_BSD)
- Some files in `contracts/mocks/` are licensed under `MIT` (as indicated in their SPDX headers), see [`contracts/mocks/LICENSE_MIT`](./contracts/mocks/LICENSE_MIT)
- Some files in `contracts/mocks/` are licensed under `GPL-2.0-or-later` (as indicated in their SPDX headers), see [`contracts/mocks/LICENSE_GPL_3`](./contracts/mocks/LICENSE_GPL_3)
- All files in `contracts/periphery/` are licensed under `GPL-2.0-or-later` (as indicated in their SPDX headers), see [`contracts/periphery/LICENSE_GPL_3`](./contracts/periphery/LICENSE_GPL_3)
- All files in `contracts/import/` are licensed under `GPL-2.0-or-later` (as indicated in their SPDX headers), see [`contracts/periphery/LICENSE_GPL_3`](./contracts/periphery/LICENSE_GPL_3)
- Some files in `contracts/strategy/` are licensed under `GPL-3.0-only` (as indicated in their SPDX headers), see [`contracts/strategy/LICENSE_GPL_3`](./contracts/strategy/LICENSE_GPL_3)
- Some files in `contracts/strategy/` are licensed under `AGPL-3.0-only` (as indicated in their SPDX headers), see [`contracts/strategy/LICENSE_AGPL_3`](./contracts/strategy/LICENSE_MIT)
- Some files in `contracts/test/` are licensed under `GPL-2.0-or-later` (as indicated in their SPDX headers), see [`contracts/strategy/LICENSE_GPL_3`](./contracts/strategy/LICENSE_GPL_3)
- Some files in `contracts/test/` are licensed under `BSD-4-Clause` (as indicated in their SPDX headers), see [`contracts/test/LICENSE_BSD_4_Clause`](./contracts/test/LICENSE_BSD_4_Clause)
- Most files in `deploy, deployments, docs, scripts, tasks, test` remain unlicensed (unless indicated in their SPDX headers).