/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: crabStrategyTxes
// ====================================================

export interface crabStrategyTxes_crabStrategyTxes {
  __typename: "CrabStrategyTx";
  id: string;
  type: string;
  ethAmount: any | null;
  wSqueethAmount: any | null;
  lpAmount: any | null;
  timestamp: any;
}

export interface crabStrategyTxes {
  crabStrategyTxes: crabStrategyTxes_crabStrategyTxes[];
}
