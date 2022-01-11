# HOW TO USE:
# Run the following shell script using: INFURA_KEY=ur_keeeeey ./start_hardhat_fork.sh
# To stop hardhat fork, run ./stop_hardhat_fork.sh

#!/bin/bash

infuraKey=$INFURA_KEY

echo "Using the current infura key: ${infuraKey}" 

$(npm bin)/hardhat node --no-deploy --network hardhat --fork https://mainnet.infura.io/v3/$infuraKey