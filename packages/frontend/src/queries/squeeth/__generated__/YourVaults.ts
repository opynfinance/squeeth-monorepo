/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: YourVaults
// ====================================================

export interface YourVaults_vaults {
  __typename: "Vault";
  id: string;
  shortAmount: any;
  collateralAmount: any;
}

export interface YourVaults {
  vaults: YourVaults_vaults[];
}

export interface YourVaultsVariables {
  ownerId: string;
}
