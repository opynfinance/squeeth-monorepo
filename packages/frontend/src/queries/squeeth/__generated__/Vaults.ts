/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: Vaults
// ====================================================

export interface Vaults_vaults_owner {
  __typename: "Account";
  id: string;
}

export interface Vaults_vaults {
  __typename: "Vault";
  id: string;
  shortAmount: any;
  collateralAmount: any;
  NftCollateralId: any | null;
  owner: Vaults_vaults_owner;
  operator: any | null;
}

export interface Vaults {
  vaults: Vaults_vaults[];
}

export interface VaultsVariables {
  ownerId: string;
}
