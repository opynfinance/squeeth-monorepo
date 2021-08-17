//SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

library VaultLib {
    /** 
     collateral is always eth, 
     while we can also add a Uniswap V3 NFT in to the vault to reduce collateral amount.
    */
    struct Vault {
        // address NFTCollateralAddress; // the uni v3 pool address, may not need this if we only support ETH / SQUEETH;
        uint128 NFTCollateralId; // the uni v3 pool NFT id
        uint128 collateralAmount;
        uint128 shortAmount;
    }

    function isProperlyCollateralized(
        Vault memory _vault,
        uint128 _ethPrice,
        uint128 _squeethPriceInEth
    ) internal pure returns (bool) {
        return _isProperlyCollateralized(_vault, _ethPrice, _squeethPriceInEth);
    }

    function _isProperlyCollateralized(
        Vault memory, /*_vault*/
        uint128, /** ethPrice */
        uint128 /* squeethPriceInEth*/
    ) internal pure returns (bool) {
        return true;
        // uint128 value = _vault.collateralAmount * ethPrice;
        // uint128 debt = _vault.shortAmount * squeethPriceInEth * ethPrice;
        // return value * 2 < debt * 3;
    }
}
