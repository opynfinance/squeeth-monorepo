/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL subscription operation: subscriptionSwaps
// ====================================================

export interface subscriptionSwaps_swaps_pool_token0 {
  __typename: "Token";
  id: string;
  symbol: string;
}

export interface subscriptionSwaps_swaps_pool_token1 {
  __typename: "Token";
  id: string;
  symbol: string;
}

export interface subscriptionSwaps_swaps_pool {
  __typename: "Pool";
  token0: subscriptionSwaps_swaps_pool_token0;
  token1: subscriptionSwaps_swaps_pool_token1;
}

export interface subscriptionSwaps_swaps_transaction {
  __typename: "Transaction";
  id: string;
  blockNumber: any;
}

export interface subscriptionSwaps_swaps {
  __typename: "Swap";
  pool: subscriptionSwaps_swaps_pool;
  id: string;
  timestamp: any;
  recipient: any;
  amount0: any;
  amount1: any;
  amountUSD: any;
  origin: any;
  transaction: subscriptionSwaps_swaps_transaction;
}

export interface subscriptionSwaps {
  swaps: subscriptionSwaps_swaps[];
}

export interface subscriptionSwapsVariables {
  tokenAddress: any;
  origin: any;
  orderDirection: string;
  recipient_not_in: any[];
}
