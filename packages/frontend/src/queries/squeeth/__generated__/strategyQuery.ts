/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: strategyQuery
// ====================================================

export interface strategyQuery_strategy {
  __typename: "Strategy";
  id: string;
  vaultId: any;
  lastHedgeTx: string;
  lastHedgeTimestamp: any;
}

export interface strategyQuery {
  strategy: strategyQuery_strategy | null;
}

export interface strategyQueryVariables {
  strategyId: string;
}
