/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL subscription operation: subscriptionSwaps
// ====================================================

export interface subscriptionSwaps_swaps_transaction {
  __typename: "Transaction";
  id: string;
  blockNumber: any;
}

export interface subscriptionSwaps_swaps {
  __typename: "Swap";
  id: string;
  recipient: any;
  amount0: any;
  amount1: any;
  timestamp: any;
  origin: any;
  transaction: subscriptionSwaps_swaps_transaction;
}

export interface subscriptionSwaps {
  swaps: subscriptionSwaps_swaps[];
}

export interface subscriptionSwapsVariables {
  poolAddress: string;
  origin: string;
  recipients: string[];
  orderDirection: string;
}
