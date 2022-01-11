# HOW TO USE:
# Run the following shell script using: KEY=ur_keeeeey ./etherscan_verify.sh

#!/bin/bash

etherscanKey=$KEY

echo "Using the current etherscan key: ${etherscanKey}" 

$(npm bin)/hardhat etherscan-verify --api-key $etherscanKey