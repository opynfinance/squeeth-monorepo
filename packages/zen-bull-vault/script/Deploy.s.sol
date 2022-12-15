// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import "forge-std/Script.sol";

import { ZenBullStrategy } from "../src/ZenBullStrategy.sol";
import { ZenEmergencyShutdown } from "../src/ZenEmergencyShutdown.sol";
import { ZenAuction } from "../src/ZenAuction.sol";
import { FlashZen } from "../src/FlashZen.sol";

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

    uint256 private zenBullStrategyCap;
    uint256 private fullRebalancePriceTolerance;
    uint256 private rebalanceWethLimitPriceTolerance;
    uint256 private crUpper;
    uint256 private crLower;
    uint256 private deltaUpper;
    uint256 private deltaLower;

    // Deploy contracts
    ZenBullStrategy zenBullStrategy;
    ZenEmergencyShutdown emergencyShutdown;
    ZenAuction zenAuction;
    FlashZen flashZen;

    function run() public {
        uint256 deployerKey = vm.envUint("DEPLOYER_PK");

        address deployerAddress = vm.rememberKey(deployerKey);

        vm.startBroadcast(deployerAddress);

        // deploy contracts
        zenBullStrategy =
        new ZenBullStrategy(crabAddress, powerTokenControllerAddress, eulerAddress, eulerMarketsModuleAddress);
        emergencyShutdown = new ZenEmergencyShutdown(address(zenBullStrategy), uniFactoryAddress);
        zenAuction =
        new ZenAuction(auctionManagerAddress, address(zenBullStrategy), uniFactoryAddress, crabAddress, eTokenAddress, dTokenAddress);
        flashZen = new FlashZen(address(zenBullStrategy), uniFactoryAddress);

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
        uint256 _zenBullStrategyCap,
        uint256 _fullRebalancePriceTolerance,
        uint256 _rebalanceWethLimitPriceTolerance,
        uint256 _crUpper,
        uint256 _crLower,
        uint256 _deltaUpper,
        uint256 _deltaLower
    ) internal {
        zenBullStrategyCap = _zenBullStrategyCap;
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

        require(zenBullStrategyCap > 0);
    }

    function setBullStrategyParams() private {
        zenBullStrategy.setCap(zenBullStrategyCap);
        zenBullStrategy.setShutdownContract(address(emergencyShutdown));
        zenBullStrategy.setAuction(address(zenAuction));

        require(zenBullStrategy.strategyCap() == zenBullStrategyCap);
        require(zenBullStrategy.shutdownContract() == address(emergencyShutdown));
        require(zenBullStrategy.auction() == address(zenAuction));
    }

    function setAuctionBullParams() private {
        zenAuction.setAuctionManager(auctionManagerAddress);
        zenAuction.setFullRebalanceClearingPriceTolerance(fullRebalancePriceTolerance);
        zenAuction.setRebalanceWethLimitPriceTolerance(rebalanceWethLimitPriceTolerance);
        zenAuction.setCrUpperAndLower(crLower, crUpper);
        zenAuction.setDeltaUpperAndLower(deltaLower, deltaUpper);

        require(zenAuction.auctionManager() == auctionManagerAddress);
        require(zenAuction.fullRebalanceClearingPriceTolerance() == fullRebalancePriceTolerance);
        require(zenAuction.rebalanceWethLimitPriceTolerance() == rebalanceWethLimitPriceTolerance);
        require(zenAuction.crLower() == crLower && zenAuction.crUpper() == crUpper);
        require(zenAuction.deltaLower() == deltaLower && zenAuction.deltaUpper() == deltaUpper);
    }

    function transferOwnershipToSystemOwnerAddress() private {
        zenBullStrategy.transferOwnership(systemOwnerAddress);
        emergencyShutdown.transferOwnership(systemOwnerAddress);
        zenAuction.transferOwnership(systemOwnerAddress);

        require(zenBullStrategy.owner() == systemOwnerAddress);
        require(emergencyShutdown.owner() == systemOwnerAddress);
        require(zenAuction.owner() == systemOwnerAddress);
    }
}
