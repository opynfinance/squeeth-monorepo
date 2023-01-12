/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: swapsRopsten
// ====================================================

export interface swapsRopsten_swaps_pool_token0 {
  __typename: "Token";
  id: string;
  symbol: string;
}

export interface swapsRopsten_swaps_pool_token1 {
  __typename: "Token";
  id: string;
  symbol: string;
}

export interface swapsRopsten_swaps_pool {
  __typename: "Pool";
  token0: swapsRopsten_swaps_pool_token0;
  token1: swapsRopsten_swaps_pool_token1;
}

export interface swapsRopsten_swaps_transaction {
  __typename: "Transaction";
  id: string;
  blockNumber: any;
}

export interface swapsRopsten_swaps {
  __typename: "Swap";
  pool: swapsRopsten_swaps_pool;
  id: string;
  timestamp: any;
  recipient: any;
  amount0: any;
  amount1: any;
  amountUSD: any;
  origin: any;
  transaction: swapsRopsten_swaps_transaction;
}

export interface swapsRopsten {
  swaps: swapsRopsten_swaps[];
}

export interface swapsRopstenVariables {
  poolAddress: string;
  recipients: string[];
  origin: any;
  orderDirection: string;
  recipient_not_in: any[];
}
