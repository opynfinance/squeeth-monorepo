#!/bin/bash

# TO RUN: execute in packages/hardhat dir: INFURA_KEY=key ./ci/e2e.sh

echo "Starting E2E mainnet fork tests"
echo "Using the current Infura key: " $INFURA_KEY

$(npm bin)/hardhat node --fork https://mainnet.infura.io/v3/$INFURA_KEY  --no-deploy --network hardhat > /dev/null 2>&1 & sleep 10 && MAINNET_FORK=true $(npm bin)/hardhat test ./test/hardhat-test/e2e/periphery/controller-helper.ts