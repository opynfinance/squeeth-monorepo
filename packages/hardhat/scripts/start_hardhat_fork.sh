# HOW TO USE:
# Run the following shell script using: ALCHEMY_KEY=ur_keeeeey ./start_hardhat_fork.sh
# To stop hardhat fork, run ./stop_hardhat_fork.sh

#!/bin/bash

alchemyKey=$ALCHEMY_KEY

echo "Using the current infura key: ${alchemyKey}" 

$(npm bin)/hardhat node --no-deploy --network hardhat --fork https://eth-mainnet.g.alchemy.com/v2/$alchemyKey