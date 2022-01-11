/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: positions
// ====================================================

export interface positions_positions_token0 {
  __typename: "Token";
  id: string;
  symbol: string;
}

export interface positions_positions_token1 {
  __typename: "Token";
  id: string;
  symbol: string;
}

export interface positions_positions_pool {
  __typename: "Pool";
  id: string;
}

export interface positions_positions_tickLower {
  __typename: "Tick";
  id: string;
  price0: any;
  price1: any;
  tickIdx: any;
}

export interface positions_positions_tickUpper {
  __typename: "Tick";
  id: string;
  price0: any;
  price1: any;
  tickIdx: any;
}

export interface positions_positions {
  __typename: "Position";
  id: string;
  owner: any;
  liquidity: any;
  token0: positions_positions_token0;
  token1: positions_positions_token1;
  pool: positions_positions_pool;
  tickLower: positions_positions_tickLower;
  tickUpper: positions_positions_tickUpper;
  collectedFeesToken0: any;
  collectedFeesToken1: any;
  depositedToken0: any;
  depositedToken1: any;
  withdrawnToken0: any;
  withdrawnToken1: any;
}

export interface positions {
  positions: positions_positions[];
}

export interface positionsVariables {
  poolAddress: string;
  owner: string;
}
