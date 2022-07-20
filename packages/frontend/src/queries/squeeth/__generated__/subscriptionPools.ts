/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL subscription operation: subscriptionPools
// ====================================================

export interface subscriptionPools_pools {
  __typename: "Pool";
  id: string;
  token0Price: any | null;
  token1Price: any | null;
}

export interface subscriptionPools {
  pools: subscriptionPools_pools[];
}
