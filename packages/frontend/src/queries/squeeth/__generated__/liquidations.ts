/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: liquidations
// ====================================================

export interface liquidations_liquidations {
  __typename: "Liquidation";
  id: string;
  debtAmount: any;
  liquidator: any;
  vaultId: any;
  collateralPaid: any;
}

export interface liquidations {
  liquidations: liquidations_liquidations[];
}

export interface liquidationsVariables {
  vaultId: any;
}
