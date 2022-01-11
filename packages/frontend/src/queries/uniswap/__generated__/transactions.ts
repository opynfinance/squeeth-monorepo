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

export interface transactions_swaps_transaction {
  __typename: "Transaction";
  id: string;
  blockNumber: any;
}

export interface transactions_swaps {
  __typename: "Swap";
  id: string;
  recipient: any;
  amount0: any;
  amount1: any;
  timestamp: any;
  origin: any;
  transaction: transactions_swaps_transaction;
}

export interface transactions {
  positionSnapshots: transactions_positionSnapshots[];
  swaps: transactions_swaps[];
}

export interface transactionsVariables {
  poolAddress: any;
  owner: string;
  origin: string;
  recipients: string[];
  orderDirection: string;
}
