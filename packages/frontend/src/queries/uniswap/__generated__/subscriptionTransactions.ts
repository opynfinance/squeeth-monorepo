/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL subscription operation: subscriptionTransactions
// ====================================================

export interface subscriptionTransactions_positionSnapshots_transaction {
  __typename: "Transaction";
  id: string;
  timestamp: any;
}

export interface subscriptionTransactions_positionSnapshots {
  __typename: "PositionSnapshot";
  id: string;
  owner: any;
  liquidity: any;
  depositedToken0: any;
  depositedToken1: any;
  withdrawnToken0: any;
  withdrawnToken1: any;
  transaction: subscriptionTransactions_positionSnapshots_transaction;
}

export interface subscriptionTransactions {
  positionSnapshots: subscriptionTransactions_positionSnapshots[];
}

export interface subscriptionTransactionsVariables {
  poolAddress: any;
  owner: string;
  origin: string;
  recipients: string[];
  orderDirection: string;
}
