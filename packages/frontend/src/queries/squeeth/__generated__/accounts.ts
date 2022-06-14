/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { PositionType } from "./../../../../types/global_apollo";

// ====================================================
// GraphQL query operation: accounts
// ====================================================

export interface accounts_accounts_positions {
  __typename: "Position";
  id: string;
  positionType: PositionType;
  currentOSQTHAmount: any;
  currentETHAmount: any;
  unrealizedOSQTHUnitCost: any;
  unrealizedETHUnitCost: any;
  realizedOSQTHUnitCost: any;
  realizedETHUnitCost: any;
  realizedOSQTHUnitGain: any;
  realizedETHUnitGain: any;
  realizedOSQTHAmount: any;
  realizedETHAmount: any;
}

export interface accounts_accounts_lppositions {
  __typename: "LPPosition";
  id: string;
  currentOSQTHAmount: any;
  currentETHAmount: any;
  unrealizedOSQTHUnitCost: any;
  unrealizedETHUnitCost: any;
  realizedOSQTHUnitCost: any;
  realizedETHUnitCost: any;
  realizedOSQTHUnitGain: any;
  realizedETHUnitGain: any;
  realizedOSQTHAmount: any;
  realizedETHAmount: any;
}

export interface accounts_accounts {
  __typename: "Account";
  id: string;
  positions: accounts_accounts_positions[];
  lppositions: accounts_accounts_lppositions[];
}

export interface accounts {
  accounts: accounts_accounts[];
}

export interface accountsVariables {
  ownerId: string;
}
