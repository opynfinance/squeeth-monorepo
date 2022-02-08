/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: transactions
// ====================================================

export interface transactions_positionSnapshots_transaction {
  __typename: "Transaction";
  id: string;
  timestamp: any;
}

export interface transactions_positionSnapshots {
  __typename: "PositionSnapshot";
  id: string;
  owner: any;
  liquidity: any;
  depositedToken0: any;
  depositedToken1: any;
  withdrawnToken0: any;
  withdrawnToken1: any;
  transaction: transactions_positionSnapshots_transaction;
}

export interface transactions {
  positionSnapshots: transactions_positionSnapshots[];
}

export interface transactionsVariables {
  poolAddress: any;
  owner: string;
  origin: string;
  recipients: string[];
  orderDirection: string;
}
