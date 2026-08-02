import type { ValidationIssue } from '../core/model';

export type Params = Record<string, number>;
export const isCoverLid = (parameters: Params) => parameters.lidStyle >= 0.5;
export const isBoxLid = (parameters: Params) => parameters.lidStyle >= 1.5 && parameters.lidStyle < 2.5;
export const isCombinationLid = (parameters: Params) => parameters.lidStyle >= 2.5;

export const lidLabel = (parameters: Params) =>
  isBoxLid(parameters)
    ? 'Box lid top'
    : isCombinationLid(parameters)
      ? 'Flush lid top'
      : isCoverLid(parameters)
        ? 'Cover lid'
        : 'Inset lid';

export const resolvedLidLift = (parameters: Params) =>
  Number.isFinite(parameters.lidLift)
    ? Math.max(0, parameters.lidLift)
    : Math.max(0.5, parameters.wallThickness * 0.08);

export const positive = (parameters: Params, fields: string[]): ValidationIssue[] =>
  fields
    .filter((field) => !Number.isFinite(parameters[field]) || parameters[field] <= 0)
    .map((field) => ({ field, message: 'Must be greater than zero' }));
