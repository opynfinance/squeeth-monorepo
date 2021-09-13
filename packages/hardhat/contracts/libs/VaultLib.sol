//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

library VaultLib {
    using SafeMath for uint256;
    /** 
     collateral is always eth, 
     while we can also add a Uniswap V3 NFT in to the vault to reduce collateral amount.
    */
    struct Vault {
        address operator;
        // address NFTCollateralAddress; // the uni v3 pool address, may not need this if we only support ETH / SQUEETH;
        uint256 NFTCollateralId; // the uni v3 pool NFT id
        uint256 collateralAmount;
        uint256 shortAmount;
    }

    function isEmpty(Vault storage _vault) internal view returns (bool) {
        return _vault.collateralAmount == 0 && _vault.shortAmount == 0;
    }

    function addEthCollateral(Vault storage _vault, uint256 _amount) internal {
        _vault.collateralAmount = _vault.collateralAmount.add(_amount);
    }

    function removeEthCollateral(Vault storage _vault, uint256 _amount) internal {
        _vault.collateralAmount = _vault.collateralAmount.sub(_amount);
    }

    function addShort(Vault storage _vault, uint256 _amount) internal {
        _vault.shortAmount = _vault.shortAmount.add(_amount);
    }

    function removeShort(Vault storage _vault, uint256 _amount) internal {
        _vault.shortAmount = _vault.shortAmount.sub(_amount);
    }

    function isProperlyCollateralized(
        Vault memory _vault,
        uint256 _normalizedFactor,
        uint256 _ethDaiPrice
    ) internal pure returns (bool) {
        if (_vault.shortAmount == 0) return true;
        return _isProperlyCollateralized(_vault, _normalizedFactor, _ethDaiPrice);
    }

    function _isProperlyCollateralized(
        Vault memory _vault,
        uint256 _normalizedFactor,
        uint256 _ethDaiPrice
    ) internal pure returns (bool) {
        uint256 debtValueInETH = _vault.shortAmount.mul(_normalizedFactor).mul(_ethDaiPrice).div(1e36);
        return _vault.collateralAmount.mul(2) >= debtValueInETH.mul(3);
    }
}
