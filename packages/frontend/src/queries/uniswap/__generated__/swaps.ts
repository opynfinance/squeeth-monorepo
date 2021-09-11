/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: swaps
// ====================================================

export interface swaps_swaps_transaction {
  __typename: "Transaction";
  id: string;
}

export interface swaps_swaps {
  __typename: "Swap";
  id: string;
  recipient: any;
  amount0: any;
  amount1: any;
  timestamp: any;
  origin: any;
  transaction: swaps_swaps_transaction;
}

export interface swaps {
  swaps: swaps_swaps[];
}

export interface swapsVariables {
  poolAddress: string;
  origin: string;
  recipients: string[];
  orderDirection: string;
}
