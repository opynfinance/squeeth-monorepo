/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: normalizationFactorUpdatesByLastTimestamp
// ====================================================

export interface normalizationFactorUpdatesByLastTimestamp_normalizationFactorUpdates {
  __typename: "NormalizationFactorUpdate";
  id: string;
  oldNormFactor: any;
  newNormFactor: any;
  lastModificationTimestamp: any;
  timestamp: any;
}

export interface normalizationFactorUpdatesByLastTimestamp {
  normalizationFactorUpdates: normalizationFactorUpdatesByLastTimestamp_normalizationFactorUpdates[];
}

export interface normalizationFactorUpdatesByLastTimestampVariables {
  lastTimestamp?: number | null;
}
