// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import { ZenBullNetting } from "../src/ZenBullNetting.sol";

contract DeployScript is Script {
    /// @dev owner address for BullStrategy, EmergencyShutdown and AuctionBull
    address private ownerAddress;
    address private zenBullAddress;
    address private eulerSimpleLensAddress;
    address private flashZenAddress;
    address private uniFactoryAddress;

    uint256 private initialMinEthAmount;
    uint256 private initialMinZenBullAmount;

    // Deploy contracts
    ZenBullNetting zenBullNetting;

    constructor(
        address _ownerAddress,
        address _zenBullAddress,
        address _eulerSimpleLensAddress,
        address _flashZenAddress,
        address _uniFactoryAddress,
        uint256 _initialMinEthAmount,
        uint256 _initialMinZenBullAmount
    ) {
        require(_ownerAddress != address(0), "Invalid owner address");
        require(_zenBullAddress != address(0), "Invalid ZenBull address");
        require(_eulerSimpleLensAddress != address(0), "Invalid EulerSimpleLens address");
        require(_flashZenAddress != address(0), "Invalid FlashZen address");
        require(_uniFactoryAddress != address(0), "Invalid Uni V3 Factory address");
        require(_initialMinEthAmount > 0, "Invalid min ETH amount");
        require(_initialMinZenBullAmount > 0, "Invalid min ZenBull amount");

        ownerAddress = _ownerAddress;
        zenBullAddress = _zenBullAddress;
        eulerSimpleLensAddress = _eulerSimpleLensAddress;
        flashZenAddress = _flashZenAddress;
        uniFactoryAddress = _uniFactoryAddress;
        initialMinEthAmount = _initialMinEthAmount;
        initialMinZenBullAmount = _initialMinZenBullAmount;
    }

    function run() public {
        uint256 deployerKey = vm.envUint("DEPLOYER_PK");

        address deployerAddress = vm.rememberKey(deployerKey);

        vm.startBroadcast(deployerAddress);

        // deploy contracts
        zenBullNetting =
        new ZenBullNetting(zenBullAddress, eulerSimpleLensAddress, flashZenAddress, uniFactoryAddress);

        // set initial params
        zenBullNetting.setMinEthAmount(initialMinEthAmount);
        zenBullNetting.setMinZenBullAmount(initialMinZenBullAmount);

        // transfer ownership
        zenBullNetting.transferOwnership(ownerAddress);

        vm.stopBroadcast();

        require(zenBullNetting.owner() == ownerAddress);
        require(zenBullNetting.MAX_OTC_PRICE_TOLERANCE() == 2e17);
        require(zenBullNetting.MIN_AUCTION_TWAP() == 180);
        require(zenBullNetting.otcPriceTolerance() == 5e16);
        require(zenBullNetting.auctionTwapPeriod() == 420);
        require(
            zenBullNetting.DOMAIN_SEPARATOR()
                == keccak256(
                    abi.encode(
                        keccak256(
                            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                        ),
                        keccak256(bytes("ZenBullNetting")),
                        keccak256(bytes("1")),
                        block.chainid,
                        address(zenBullNetting)
                    )
                )
        );
    }

    function testAvoidCoverage() public pure {
        return;
    }
}
