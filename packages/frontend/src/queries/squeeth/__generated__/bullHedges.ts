/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: bullHedges
// ====================================================

export interface bullHedges_fullRebalances {
  __typename: "FullRebalance";
  id: string;
  wPowerPerpAmount: any | null;
  isDepositingInCrab: boolean | null;
  timestamp: any;
  wethTargetInEuler: any | null;
}

export interface bullHedges_leverageRebalances {
  __typename: "LeverageRebalance";
  id: string;
  isSellingUsdc: boolean | null;
  usdcAmount: any;
  timestamp: any;
}

export interface bullHedges {
  fullRebalances: bullHedges_fullRebalances[];
  leverageRebalances: bullHedges_leverageRebalances[];
}
