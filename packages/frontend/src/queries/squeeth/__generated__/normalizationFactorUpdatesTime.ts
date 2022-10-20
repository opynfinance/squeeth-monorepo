/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: normalizationFactorUpdatesTime
// ====================================================

export interface normalizationFactorUpdatesTime_normalizationFactorUpdates {
  __typename: "NormalizationFactorUpdate";
  id: string;
  oldNormFactor: any;
  newNormFactor: any;
  lastModificationTimestamp: any;
  timestamp: any;
}

export interface normalizationFactorUpdatesTime {
  normalizationFactorUpdates: normalizationFactorUpdatesTime_normalizationFactorUpdates[];
}

export interface normalizationFactorUpdatesTimeVariables {
  timestamp?: number | null;
  timestampOnedayAfter?: number | null;
}
