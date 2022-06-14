/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: normalizationFactorTimeUpdates
// ====================================================

export interface normalizationFactorTimeUpdates_normalizationFactorUpdates {
  __typename: "NormalizationFactorUpdate";
  id: string;
  oldNormFactor: any;
  newNormFactor: any;
  lastModificationTimestamp: any;
  timestamp: any;
}

export interface normalizationFactorTimeUpdates {
  normalizationFactorUpdates: normalizationFactorTimeUpdates_normalizationFactorUpdates[];
}

export interface normalizationFactorTimeUpdatesVariables {
  timestamp?: number | null;
  timestampOnedayAfter?: number | null;
}
