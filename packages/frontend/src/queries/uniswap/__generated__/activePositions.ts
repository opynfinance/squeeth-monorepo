/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: activePositions
// ====================================================

export interface activePositions_positions_token0 {
  __typename: "Token";
  id: string;
  symbol: string;
}

export interface activePositions_positions_token1 {
  __typename: "Token";
  id: string;
  symbol: string;
}

export interface activePositions_positions_pool {
  __typename: "Pool";
  id: string;
}

export interface activePositions_positions_tickLower {
  __typename: "Tick";
  id: string;
  price0: any;
  price1: any;
  tickIdx: any;
}

export interface activePositions_positions_tickUpper {
  __typename: "Tick";
  id: string;
  price0: any;
  price1: any;
  tickIdx: any;
}

export interface activePositions_positions {
  __typename: "Position";
  id: string;
  owner: any;
  liquidity: any;
  token0: activePositions_positions_token0;
  token1: activePositions_positions_token1;
  pool: activePositions_positions_pool;
  tickLower: activePositions_positions_tickLower;
  tickUpper: activePositions_positions_tickUpper;
  collectedFeesToken0: any;
  collectedFeesToken1: any;
  depositedToken0: any;
  depositedToken1: any;
  withdrawnToken0: any;
  withdrawnToken1: any;
}

export interface activePositions {
  positions: activePositions_positions[];
}

export interface activePositionsVariables {
  poolAddress: string;
  owner: string;
}
