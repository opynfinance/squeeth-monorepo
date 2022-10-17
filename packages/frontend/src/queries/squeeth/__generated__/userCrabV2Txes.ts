/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: userCrabV2Txes
// ====================================================

export interface userCrabV2Txes_crabUserTxes {
  __typename: "CrabUserTx";
  id: string;
  type: string;
  ethAmount: any;
  wSqueethAmount: any | null;
  lpAmount: any | null;
  timestamp: any;
  excessEth: any | null;
  erc20Token: string | null;
  erc20Amount: any | null;
}

export interface userCrabV2Txes {
  crabUserTxes: userCrabV2Txes_crabUserTxes[];
}

export interface userCrabV2TxesVariables {
  ownerId: string;
  orderDirection: string;
}
