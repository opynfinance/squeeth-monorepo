/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL subscription operation: subscriptionVaultHistory
// ====================================================

export interface subscriptionVaultHistory_vaultHistories {
  __typename: "VaultHistory";
  id: string;
  timestamp: any;
  totalEthCollateralAmount: any;
  oSqthAmount: any;
  ethCollateralAmount: any;
  action: string;
  vaultId: any;
}

export interface subscriptionVaultHistory {
  vaultHistories: subscriptionVaultHistory_vaultHistories[];
}

export interface subscriptionVaultHistoryVariables {
  vaultId: any;
}
