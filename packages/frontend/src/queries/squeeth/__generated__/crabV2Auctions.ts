/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: crabV2Auctions
// ====================================================

export interface crabV2Auctions_hedgeOTCs {
  __typename: "HedgeOTC";
  id: string;
  bidID: any;
  quantity: any;
  isBuying: boolean;
  clearingPrice: any;
  timestamp: any;
}

export interface crabV2Auctions {
  hedgeOTCs: crabV2Auctions_hedgeOTCs[];
}
