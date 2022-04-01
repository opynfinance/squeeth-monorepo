/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: VaultHistory
// ====================================================

export interface VaultHistory_vaultHistories {
  __typename: "VaultHistory";
  id: string;
  timestamp: any;
  totalEthCollateralAmount: any;
  oSqthAmount: any;
  ethCollateralAmount: any;
  action: string;
  vaultId: any;
}

export interface VaultHistory {
  vaultHistories: VaultHistory_vaultHistories[];
}

export interface VaultHistoryVariables {
  vaultId: any;
}
