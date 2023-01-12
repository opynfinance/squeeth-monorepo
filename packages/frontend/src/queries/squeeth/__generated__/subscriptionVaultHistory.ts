/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { Action } from "./../../../../types/global_apollo";

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
  action: Action;
  vaultId: any;
}

export interface subscriptionVaultHistory {
  vaultHistories: subscriptionVaultHistory_vaultHistories[];
}

export interface subscriptionVaultHistoryVariables {
  vaultId: any;
}
