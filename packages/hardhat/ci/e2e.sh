#!/bin/bash

# TO RUN: execute in packages/hardhat dir: ALCHEMY_RPC=rpc ./ci/e2e.sh

echo "Starting E2E mainnet fork tests"
echo "Using the current Alechemy RPC: " $ALCHEMY_RPC

$(npm bin)/hardhat node --fork $ALCHEMY_RPC --fork-block-number 14345140 --no-deploy --network hardhat > /dev/null 2>&1 & sleep 10 && MAINNET_FORK=true $(npm bin)/hardhat test ./test/e2e/**.ts 