/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: userBullTxes
// ====================================================

export interface userBullTxes_bullUserTxes {
  __typename: "BullUserTx";
  id: string;
  owner: any;
  bullAmount: any;
  ethAmount: any;
  type: string;
  timestamp: any;
}

export interface userBullTxes {
  bullUserTxes: userBullTxes_bullUserTxes[];
}

export interface userBullTxesVariables {
  ownerId: string;
  orderDirection: string;
}
