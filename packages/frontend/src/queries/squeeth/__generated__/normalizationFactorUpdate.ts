/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: normalizationFactorUpdate
// ====================================================

export interface normalizationFactorUpdate_normalizationFactorUpdates {
  __typename: "NormalizationFactorUpdate";
  id: string;
  oldNormFactor: any;
  newNormFactor: any;
  lastModificationTimestamp: any;
  timestamp: any;
}

export interface normalizationFactorUpdate {
  normalizationFactorUpdates: normalizationFactorUpdate_normalizationFactorUpdates[];
}

export interface normalizationFactorUpdateVariables {
  skipCount?: number | null;
}
