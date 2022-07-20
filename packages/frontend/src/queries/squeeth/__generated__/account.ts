/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: account
// ====================================================

export interface account_account {
  __typename: "Account";
  sqthOpenAmount: any;
  sqthOpenUnitPrice: any;
  sqthCloseAmount: any;
  sqthCloseUnitPrice: any;
  ethDepositAmount: any;
  ethDepositUnitPrice: any;
  ethWithdrawAmount: any;
  ethWithdrawUnitPrice: any;
}

export interface account {
  account: account_account | null;
}

export interface accountVariables {
  id: string;
}
