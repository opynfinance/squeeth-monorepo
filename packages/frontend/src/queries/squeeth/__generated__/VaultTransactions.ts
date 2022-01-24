/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { Type } from "./../../../../types/global_apollo";

// ====================================================
// GraphQL query operation: VaultTransactions
// ====================================================

export interface VaultTransactions_vaultTransactions {
  __typename: "VaultTransaction";
  id: string;
  amount: any;
  type: Type;
  timestamp: any;
  totalCollateralAmount: any;
}

export interface VaultTransactions {
  vaultTransactions: VaultTransactions_vaultTransactions[];
}

export interface VaultTransactionsVariables {
  vaultId: string;
}
