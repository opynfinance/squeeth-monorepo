// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import "forge-std/Script.sol";

import { BullStrategy } from "../src/BullStrategy.sol";
import { EmergencyShutdown } from "../src/EmergencyShutdown.sol";
import { AuctionBull } from "../src/AuctionBull.sol";
import { FlashBull } from "../src/FlashBull.sol";

contract DeployScript is Script {
    /// @dev owner address for BullStrategy, EmergencyShutdown and AuctionBull
    address private systemOwnerAddress;
    address private auctionManagerAddress;
    address private crabAddress;
    address private powerTokenControllerAddress;
    address private eulerAddress;
    address private eulerMarketsModuleAddress;
    address private uniFactoryAddress;
    address private eTokenAddress;
    address private dTokenAddress;

    uint256 private bullStrategyCap;
    uint256 private fullRebalancePriceTolerance;
    uint256 private rebalanceWethLimitPriceTolerance;
    uint256 private crUpper;
    uint256 private crLower;
    uint256 private deltaUpper;
    uint256 private deltaLower;

    // Deploy contracts
    BullStrategy bullStrategy;
    EmergencyShutdown emergencyShutdown;
    AuctionBull auctionBull;
    FlashBull flashBull;

    function run() public {
        uint256 deployerKey = vm.envUint("DEPLOYER_PK");

        address deployerAddress = vm.rememberKey(deployerKey);

        vm.startBroadcast(deployerAddress);

        // deploy contracts
        bullStrategy =
        new BullStrategy(crabAddress, powerTokenControllerAddress, eulerAddress, eulerMarketsModuleAddress);
        emergencyShutdown = new EmergencyShutdown(address(bullStrategy), uniFactoryAddress);
        auctionBull =
        new AuctionBull(auctionManagerAddress, address(bullStrategy), uniFactoryAddress, crabAddress, eTokenAddress, dTokenAddress);
        flashBull = new FlashBull(address(bullStrategy), uniFactoryAddress);

        // set contracts params
        setBullStrategyParams();
        setAuctionBullParams();

        // transfer ownership
        transferOwnershipToSystemOwnerAddress();

        vm.stopBroadcast();
    }

    function setAddressParamsAtConstructor(
        address _systemOwnerAddress,
        address _auctionManagerAddress,
        address _crabAddress,
        address _powerTokenControllerAddress,
        address _eulerAddress,
        address _eulerMarketsModuleAddress,
        address _uniFactoryAddress,
        address _eTokenAddress,
        address _dTokenAddress
    ) internal {
        systemOwnerAddress = _systemOwnerAddress;
        auctionManagerAddress = _auctionManagerAddress;
        crabAddress = _crabAddress;
        powerTokenControllerAddress = _powerTokenControllerAddress;
        eulerAddress = _eulerAddress;
        eulerMarketsModuleAddress = _eulerMarketsModuleAddress;
        uniFactoryAddress = _uniFactoryAddress;
        eTokenAddress = _eTokenAddress;
        dTokenAddress = _dTokenAddress;
    }

    function setUintParamsAtConstructor(
        uint256 _bullStrategyCap,
        uint256 _fullRebalancePriceTolerance,
        uint256 _rebalanceWethLimitPriceTolerance,
        uint256 _crUpper,
        uint256 _crLower,
        uint256 _deltaUpper,
        uint256 _deltaLower
    ) internal {
        bullStrategyCap = _bullStrategyCap;
        fullRebalancePriceTolerance = _fullRebalancePriceTolerance;
        rebalanceWethLimitPriceTolerance = _rebalanceWethLimitPriceTolerance;
        crUpper = _crUpper;
        crLower = _crLower;
        deltaLower = _deltaLower;
        deltaUpper = _deltaUpper;
    }

    function checkParams() private view {
        require(systemOwnerAddress != address(0));
        require(auctionManagerAddress != address(0));
        require(crabAddress != address(0));
        require(powerTokenControllerAddress != address(0));
        require(eulerAddress != address(0));
        require(eulerMarketsModuleAddress != address(0));
        require(uniFactoryAddress != address(0));
        require(eTokenAddress != address(0));
        require(dTokenAddress != address(0));

        require(bullStrategyCap > 0);
    }

    function setBullStrategyParams() private {
        bullStrategy.setCap(bullStrategyCap);
        bullStrategy.setShutdownContract(address(emergencyShutdown));
        bullStrategy.setAuction(address(auctionBull));

        require(bullStrategy.strategyCap() == bullStrategyCap);
        require(bullStrategy.shutdownContract() == address(emergencyShutdown));
        require(bullStrategy.auction() == address(auctionBull));
    }

    function setAuctionBullParams() private {
        auctionBull.setAuctionManager(auctionManagerAddress);
        auctionBull.setFullRebalanceClearingPriceTolerance(fullRebalancePriceTolerance);
        auctionBull.setRebalanceWethLimitPriceTolerance(rebalanceWethLimitPriceTolerance);
        auctionBull.setCrUpperAndLower(crLower, crUpper);
        auctionBull.setDeltaUpperAndLower(deltaLower, deltaUpper);

        require(auctionBull.auctionManager() == auctionManagerAddress);
        require(auctionBull.fullRebalanceClearingPriceTolerance() == fullRebalancePriceTolerance);
        require(auctionBull.rebalanceWethLimitPriceTolerance() == rebalanceWethLimitPriceTolerance);
        require(auctionBull.crLower() == crLower && auctionBull.crUpper() == crUpper);
        require(auctionBull.deltaLower() == deltaLower && auctionBull.deltaUpper() == deltaUpper);
    }

    function transferOwnershipToSystemOwnerAddress() private {
        bullStrategy.transferOwnership(systemOwnerAddress);
        emergencyShutdown.transferOwnership(systemOwnerAddress);
        auctionBull.transferOwnership(systemOwnerAddress);

        require(bullStrategy.owner() == systemOwnerAddress);
        require(emergencyShutdown.owner() == systemOwnerAddress);
        require(auctionBull.owner() == systemOwnerAddress);
    }
}
