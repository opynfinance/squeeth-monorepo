/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: crabAuctions
// ====================================================

export interface crabAuctions_crabAuctions {
  __typename: "CrabAuction";
  id: string;
  owner: any;
  squeethAmount: any;
  ethAmount: any;
  isSellingSqueeth: boolean;
  isHedgingOnUniswap: boolean;
  timestamp: any;
}

export interface crabAuctions {
  crabAuctions: crabAuctions_crabAuctions[];
}
