/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL subscription operation: subscriptionSwapsRopsten
// ====================================================

export interface subscriptionSwapsRopsten_swaps_pool_token0 {
  __typename: "Token";
  id: string;
  symbol: string;
}

export interface subscriptionSwapsRopsten_swaps_pool_token1 {
  __typename: "Token";
  id: string;
  symbol: string;
}

export interface subscriptionSwapsRopsten_swaps_pool {
  __typename: "Pool";
  token0: subscriptionSwapsRopsten_swaps_pool_token0;
  token1: subscriptionSwapsRopsten_swaps_pool_token1;
}

export interface subscriptionSwapsRopsten_swaps_transaction {
  __typename: "Transaction";
  id: string;
  blockNumber: any;
}

export interface subscriptionSwapsRopsten_swaps {
  __typename: "Swap";
  pool: subscriptionSwapsRopsten_swaps_pool;
  id: string;
  timestamp: any;
  recipient: any;
  amount0: any;
  amount1: any;
  amountUSD: any;
  origin: any;
  transaction: subscriptionSwapsRopsten_swaps_transaction;
}

export interface subscriptionSwapsRopsten {
  swaps: subscriptionSwapsRopsten_swaps[];
}

export interface subscriptionSwapsRopstenVariables {
  poolAddress: string;
  recipients: string[];
  origin: any;
  orderDirection: string;
  recipient_not_in: any[];
}
