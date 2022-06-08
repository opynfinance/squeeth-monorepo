/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { TransactionType } from "./../../../../types/global_apollo";

// ====================================================
// GraphQL query operation: TransactionHistories
// ====================================================

export interface TransactionHistories_transactionHistories {
  __typename: "TransactionHistory";
  id: string;
  transactionType: TransactionType;
  timestamp: any;
  ethAmount: any;
  oSqthAmount: any;
  oSqthPrice: any;
}

export interface TransactionHistories {
  transactionHistories: TransactionHistories_transactionHistories[];
}

export interface TransactionHistoriesVariables {
  ownerId: string;
}
