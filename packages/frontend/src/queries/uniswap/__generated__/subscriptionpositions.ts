/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL subscription operation: subscriptionpositions
// ====================================================

export interface subscriptionpositions_positions_token0 {
  __typename: "Token";
  id: string;
  symbol: string;
}

export interface subscriptionpositions_positions_token1 {
  __typename: "Token";
  id: string;
  symbol: string;
}

export interface subscriptionpositions_positions_pool {
  __typename: "Pool";
  id: string;
}

export interface subscriptionpositions_positions_tickLower {
  __typename: "Tick";
  id: string;
  price0: any;
  price1: any;
  tickIdx: any;
}

export interface subscriptionpositions_positions_tickUpper {
  __typename: "Tick";
  id: string;
  price0: any;
  price1: any;
  tickIdx: any;
}

export interface subscriptionpositions_positions {
  __typename: "Position";
  id: string;
  owner: any;
  liquidity: any;
  token0: subscriptionpositions_positions_token0;
  token1: subscriptionpositions_positions_token1;
  pool: subscriptionpositions_positions_pool;
  tickLower: subscriptionpositions_positions_tickLower;
  tickUpper: subscriptionpositions_positions_tickUpper;
  collectedFeesToken0: any;
  collectedFeesToken1: any;
  depositedToken0: any;
  depositedToken1: any;
  withdrawnToken0: any;
  withdrawnToken1: any;
}

export interface subscriptionpositions {
  positions: subscriptionpositions_positions[];
}

export interface subscriptionpositionsVariables {
  poolAddress: string;
  owner: string;
}
