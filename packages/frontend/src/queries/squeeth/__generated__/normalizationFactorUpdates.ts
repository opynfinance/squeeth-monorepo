/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: normalizationFactorUpdates
// ====================================================

export interface normalizationFactorUpdates_normalizationFactorUpdates {
  __typename: "NormalizationFactorUpdate";
  id: string;
  oldNormFactor: any;
  newNormFactor: any;
  lastModificationTimestamp: any;
  timestamp: any;
}

export interface normalizationFactorUpdates {
  normalizationFactorUpdates: normalizationFactorUpdates_normalizationFactorUpdates[];
}

export interface normalizationFactorUpdatesVariables {
  skipCount?: number | null;
}
