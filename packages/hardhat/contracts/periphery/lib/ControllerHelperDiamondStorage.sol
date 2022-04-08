//SPDX-License-Identifier: BUSL-1.1

pragma solidity =0.7.6;
pragma abicoder v2;

/// @dev this storage is only used for state variable with type address
library ControllerHelperDiamondStorage {

  // defining state variables
  struct DiamondStorage {
    address controller;
    address oracle;
    address shortPowerPerp;
    address wPowerPerpPool;
    address wPowerPerp;
    address weth;
    address nonfungiblePositionManager;
  }

  // return a struct storage pointer for accessing the state variables
  function diamondStorage() 
    internal 
    pure 
    returns (DiamondStorage storage ds) 
  {
    bytes32 position = keccak256("diamond.standard.diamond.storage");
    assembly { ds.slot := position }
  }

  // set state variables
  function setStorageVariables(
    address _controller,
    address _oracle,
    address _shortPowerPerp,
    address _wPowerPerpPool,
    address _wPowerPerp,
    address _weth,
    address _nonfungiblePositionManager
  ) 
    internal 
  {
    DiamondStorage storage ds = diamondStorage();
    ds.controller = _controller;
    ds.oracle = _oracle;
    ds.shortPowerPerp = _shortPowerPerp;
    ds.wPowerPerpPool = _wPowerPerpPool;
    ds.wPowerPerp = _wPowerPerp;
    ds.weth = _weth;
    ds.nonfungiblePositionManager = _nonfungiblePositionManager;
  }

  // get state variable
  function getAddressAtSlot(uint256 _slot) internal view returns (address) {
      if (_slot == 0) {
          return diamondStorage().controller;
      }
      else if (_slot == 1) { 
          return diamondStorage().oracle;
      }
      else if (_slot == 2) {
          return diamondStorage().shortPowerPerp;
      }
      else if (_slot == 3) {
          return diamondStorage().wPowerPerpPool;
      }
      else if (_slot == 4) {
          return diamondStorage().wPowerPerp;
      }
      else if (_slot == 5) {
          return diamondStorage().weth;
      }
      else if (_slot == 6) {
          return diamondStorage().nonfungiblePositionManager;
      }
      else {
          return address(0);
      }
    }
}