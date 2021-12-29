/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: Vault
// ====================================================

export interface Vault_vault_owner {
  __typename: "Account";
  id: string;
}

export interface Vault_vault {
  __typename: "Vault";
  id: string;
  shortAmount: any;
  collateralAmount: any;
  NftCollateralId: any | null;
  owner: Vault_vault_owner;
  operator: any | null;
}

export interface Vault {
  vault: Vault_vault | null;
}

export interface VaultVariables {
  vaultID: string;
}
