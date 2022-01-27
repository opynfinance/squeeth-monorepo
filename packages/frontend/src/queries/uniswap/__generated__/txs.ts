/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: txs
// ====================================================

export interface txs_swaps_pool_token0 {
  __typename: "Token";
  id: string;
  symbol: string;
}

export interface txs_swaps_pool_token1 {
  __typename: "Token";
  id: string;
  symbol: string;
}

export interface txs_swaps_pool {
  __typename: "Pool";
  token0: txs_swaps_pool_token0;
  token1: txs_swaps_pool_token1;
}

export interface txs_swaps_transaction {
  __typename: "Transaction";
  id: string;
  blockNumber: any;
}

export interface txs_swaps {
  __typename: "Swap";
  pool: txs_swaps_pool;
  id: string;
  timestamp: any;
  recipient: any;
  amount0: any;
  amount1: any;
  amountUSD: any;
  origin: any;
  transaction: txs_swaps_transaction;
}

export interface txs {
  swaps: txs_swaps[];
}

export interface txsVariables {
  tokenAddress: any;
  origin: string;
}
