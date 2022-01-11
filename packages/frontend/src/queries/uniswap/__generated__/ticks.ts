/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: ticks
// ====================================================

export interface ticks_ticks {
  __typename: "Tick";
  id: string;
  tickIdx: any;
  liquidityNet: any;
  liquidityGross: any;
}

export interface ticks {
  ticks: ticks_ticks[];
}

export interface ticksVariables {
  poolAddress: string;
}
