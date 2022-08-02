/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL subscription operation: accountSubscription
// ====================================================

export interface accountSubscription_account {
  __typename: "Account";
  sqthOpenAmount: any;
  sqthOpenUnitPrice: any;
  sqthCloseAmount: any;
  sqthCloseUnitPrice: any;
  ethDepositAmount: any;
  ethDepositUnitPrice: any;
  ethWithdrawAmount: any;
  ethWithdrawUnitPrice: any;
  sqthCollected: any;
  ethCollected: any;
}

export interface accountSubscription {
  account: accountSubscription_account | null;
}

export interface accountSubscriptionVariables {
  id: string;
}
