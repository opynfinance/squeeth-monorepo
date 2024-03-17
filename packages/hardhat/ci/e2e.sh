#!/bin/bash

# TO RUN: execute in packages/hardhat dir: ALCHEMY_KEY=key ./ci/e2e.sh

echo "Starting E2E mainnet fork tests"
echo "Using the current Alchemy key: " $ALCHEMY_KEY

$(npm bin)/hardhat node --fork https://eth-mainnet.g.alchemy.com/v2/$ALCHEMY_KEY --fork-block-number 14345140 --no-deploy --network hardhat > /dev/null 2>&1 & sleep 10 && MAINNET_FORK=true $(npm bin)/hardhat test ./test/e2e/**.ts 