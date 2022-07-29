/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL subscription operation: subscriptionVaults
// ====================================================

export interface subscriptionVaults_vaults_owner {
  __typename: "Account";
  id: string;
}

export interface subscriptionVaults_vaults {
  __typename: "Vault";
  id: string;
  shortAmount: any;
  collateralAmount: any;
  NftCollateralId: any | null;
  owner: subscriptionVaults_vaults_owner;
  operator: any | null;
}

export interface subscriptionVaults {
  vaults: subscriptionVaults_vaults[];
}

export interface subscriptionVaultsVariables {
  ownerId: string;
}
