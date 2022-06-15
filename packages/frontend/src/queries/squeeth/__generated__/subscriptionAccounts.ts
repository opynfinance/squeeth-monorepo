/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { PositionType } from "./../../../../types/global_apollo";

// ====================================================
// GraphQL subscription operation: subscriptionAccounts
// ====================================================

export interface subscriptionAccounts_accounts_positions {
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

export interface subscriptionAccounts_accounts_lppositions {
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

export interface subscriptionAccounts_accounts {
  __typename: "Account";
  id: string;
  positions: subscriptionAccounts_accounts_positions[];
  lppositions: subscriptionAccounts_accounts_lppositions[];
}

export interface subscriptionAccounts {
  accounts: subscriptionAccounts_accounts[];
}

export interface subscriptionAccountsVariables {
  ownerId: string;
}
