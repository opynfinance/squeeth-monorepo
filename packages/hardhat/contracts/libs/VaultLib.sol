//SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

library VaultLib {
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

    function depositETHCollateral(Vault storage _vault, uint256 _amount) internal {
        _vault.collateralAmount += _amount;
    }

    function withdrawETHCollateral(Vault storage _vault, uint256 _amount) internal {
        _vault.collateralAmount -= _amount;
    }

    function mintSqueeth(Vault storage _vault, uint256 _amount) internal {
        _vault.shortAmount += _amount;
    }

    function burnSqueeth(Vault storage _vault, uint256 _amount) internal {
        _vault.shortAmount -= _amount;
    }

    function isProperlyCollateralized(
        Vault memory _vault,
        uint256 _normalizedFactor,
        uint256 _ethUsdPrice
    ) internal pure returns (bool) {
        if (_vault.shortAmount == 0) return true;
        return _isProperlyCollateralized(_vault, _normalizedFactor, _ethUsdPrice);
    }

    function _isProperlyCollateralized(
        Vault memory _vault,
        uint256 _normalizedFactor,
        uint256 _ethUsdPrice
    ) internal pure returns (bool) {
        uint256 debtValueInETH = (_vault.shortAmount * _normalizedFactor * _ethUsdPrice) / 1e36;
        return _vault.collateralAmount * 2 >= debtValueInETH * 3;
    }
}
