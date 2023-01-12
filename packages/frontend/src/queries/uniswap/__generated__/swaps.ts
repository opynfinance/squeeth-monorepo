/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: swaps
// ====================================================

export interface swaps_swaps_pool_token0 {
  __typename: "Token";
  id: string;
  symbol: string;
}

export interface swaps_swaps_pool_token1 {
  __typename: "Token";
  id: string;
  symbol: string;
}

export interface swaps_swaps_pool {
  __typename: "Pool";
  token0: swaps_swaps_pool_token0;
  token1: swaps_swaps_pool_token1;
}

export interface swaps_swaps_transaction {
  __typename: "Transaction";
  id: string;
  blockNumber: any;
}

export interface swaps_swaps {
  __typename: "Swap";
  pool: swaps_swaps_pool;
  id: string;
  timestamp: any;
  recipient: any;
  amount0: any;
  amount1: any;
  amountUSD: any;
  origin: any;
  transaction: swaps_swaps_transaction;
}

export interface swaps {
  swaps: swaps_swaps[];
}

export interface swapsVariables {
  tokenAddress: any;
  origin: any;
  orderDirection: string;
  recipient_not_in: any[];
}
