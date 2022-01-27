/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL subscription operation: subscriptionTxs
// ====================================================

export interface subscriptionTxs_swaps_pool_token0 {
  __typename: "Token";
  id: string;
  symbol: string;
}

export interface subscriptionTxs_swaps_pool_token1 {
  __typename: "Token";
  id: string;
  symbol: string;
}

export interface subscriptionTxs_swaps_pool {
  __typename: "Pool";
  token0: subscriptionTxs_swaps_pool_token0;
  token1: subscriptionTxs_swaps_pool_token1;
}

export interface subscriptionTxs_swaps_transaction {
  __typename: "Transaction";
  id: string;
  blockNumber: any;
}

export interface subscriptionTxs_swaps {
  __typename: "Swap";
  pool: subscriptionTxs_swaps_pool;
  id: string;
  timestamp: any;
  recipient: any;
  amount0: any;
  amount1: any;
  amountUSD: any;
  origin: any;
  transaction: subscriptionTxs_swaps_transaction;
}

export interface subscriptionTxs {
  swaps: subscriptionTxs_swaps[];
}

export interface subscriptionTxsVariables {
  tokenAddress: any;
  origin: string;
}
