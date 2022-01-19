/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: userCrabTxes
// ====================================================

export interface userCrabTxes_crabStrategyTxes {
  __typename: "CrabStrategyTx";
  id: string;
  type: string;
  ethAmount: any;
  wSqueethAmount: any | null;
  lpAmount: any | null;
  timestamp: any;
}

export interface userCrabTxes {
  crabStrategyTxes: userCrabTxes_crabStrategyTxes[];
}

export interface userCrabTxesVariables {
  ownerId: string;
  orderDirection: string;
}
