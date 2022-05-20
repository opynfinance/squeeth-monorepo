# include .env file and export its env vars
# (-include to ignore error if it does not exist)
-include .env

all: clean install update build

# Install proper solc version.
solc:; nix-env -f https://github.com/dapphub/dapptools/archive/master.tar.gz -iA solc-static-versions.solc_0_7_06

# Clean the repo
clean  :; forge clean

# Install the Modules
forge-install :; forge install

# Update Dependencies
forge-update:; forge update

# Builds
forge-build  :; forge build

# chmod scripts
scripts :; chmod +x ./scripts/*

# Tests
forge-test :; forge clean && forge test -vvvv # --ffi # enable if you need the `ffi` cheat code on HEVM

# Lints
lint :; prettier --write contracts/**/*.sol && prettier --write contracts/*.sol

# Generate Gas Snapshots
forge-snapshot :; forge clean && forge snapshot